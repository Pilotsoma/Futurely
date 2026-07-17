const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

// Web never holds the raw JWT at all — auth is entirely via the httpOnly
// access_token/refresh_token cookies the backend sets and reads automatically
// (including on the WebSocket handshake). The backend also omits the token from
// login/register/refresh response bodies for web (see X-Client-Platform below),
// so there's nothing sensitive in this module's memory to steal via XSS or to
// find in a network trace.
//
// We still track a local "authenticated until" timestamp — not for auth, only
// so callers can cheaply avoid an extra refresh round-trip when we already know
// the 15-minute access token is still fresh.
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000
const SAFETY_MARGIN_MS = 60 * 1000
let _authedUntil = 0
export function markWebAuthed(): void { _authedUntil = Date.now() + ACCESS_TOKEN_TTL_MS - SAFETY_MARGIN_MS }
export function clearWebAuthed(): void { _authedUntil = 0 }
export function isWebAuthed(): boolean { return Date.now() < _authedUntil }

export class ApiError extends Error {
  code?: string
  secondsRemaining?: number
  httpStatus?: number
  constructor(message: string, code?: string, secondsRemaining?: number, httpStatus?: number) {
    super(message)
    this.code = code
    this.secondsRemaining = secondsRemaining
    this.httpStatus = httpStatus
  }
}

// Prevents concurrent token refreshes — all callers share the same in-flight promise.
let _refreshPromise: Promise<boolean> | null = null

async function silentRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise
  _refreshPromise = (async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        signal: controller.signal,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'web' },
      })
      if (!res.ok) { clearWebAuthed(); return false }
      markWebAuthed()
      return true
    } catch {
      clearWebAuthed()
      return false
    } finally {
      clearTimeout(timeout)
      _refreshPromise = null
    }
  })()
  return _refreshPromise
}

// Once the backend reports it had to fall back off the primary AI model
// (e.g. Deepseek down), remember that for the rest of this browser session so
// every subsequent AI-backed call skips straight to the reliable model
// instead of paying for a doomed primary attempt each time. sessionStorage
// (not memory) so it survives a page reload within the same tab/session.
const AI_SKIP_PRIMARY_KEY = 'ns_ai_skip_primary'

function shouldSkipAiPrimary(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(AI_SKIP_PRIMARY_KEY) === '1'
}

function markAiFallbackSeen(): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(AI_SKIP_PRIMARY_KEY, '1')
}

async function request<T>(path: string, options?: RequestInit, _retried = false, timeoutMs = 30000): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'web',
        ...(shouldSkipAiPrimary() ? { 'X-AI-Skip-Primary': '1' } : {}),
        ...options?.headers,
      },
    })
  } finally {
    clearTimeout(timeout)
  }
  if (res.headers.get('X-AI-Used-Fallback') === '1') markAiFallbackSeen()
  // On 401, attempt a silent token refresh and retry once.
  if (res.status === 401 && !_retried) {
    const refreshed = await silentRefresh()
    if (refreshed) return request<T>(path, options, true, timeoutMs)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string | { message?: string; code?: string }; secondsRemaining?: number }
    const msg  = typeof body?.error === 'string' ? body.error : body?.error?.message
    const code = typeof body?.error === 'object' ? body?.error?.code : undefined
    // Consent not yet recorded for this OAuth account — redirect back to the consent modal.
    if (res.status === 403 && code === 'CONSENT_REQUIRED' && typeof window !== 'undefined') {
      window.location.replace('/login?oauth=new')
      return new Promise<T>(() => {})
    }
    throw new ApiError(msg ?? `HTTP ${res.status}`, code, body.secondsRemaining, res.status)
  }
  const { data } = await res.json() as { data: T }
  return data
}

// Like request<T> but preserves the `meta` envelope field that request<T>
// silently discards. Use this for paginated endpoints that return
// { data: T, meta: { nextCursor, hasNextPage, ... } }.
async function requestWithMeta<T>(path: string, options?: RequestInit, _retried = false, timeoutMs = 30000): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'web',
        ...(shouldSkipAiPrimary() ? { 'X-AI-Skip-Primary': '1' } : {}),
        ...options?.headers,
      },
    })
  } finally {
    clearTimeout(timeout)
  }
  if (res.headers.get('X-AI-Used-Fallback') === '1') markAiFallbackSeen()
  if (res.status === 401 && !_retried) {
    const refreshed = await silentRefresh()
    if (refreshed) return requestWithMeta<T>(path, options, true, timeoutMs)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string | { message?: string; code?: string }; secondsRemaining?: number }
    const msg  = typeof body?.error === 'string' ? body.error : body?.error?.message
    const code = typeof body?.error === 'object' ? body?.error?.code : undefined
    if (res.status === 403 && code === 'CONSENT_REQUIRED' && typeof window !== 'undefined') {
      window.location.replace('/login?oauth=new')
      return new Promise<{ data: T; meta?: Record<string, unknown> }>(() => {})
    }
    throw new ApiError(msg ?? `HTTP ${res.status}`, code, body.secondsRemaining, res.status)
  }
  const { data, meta } = await res.json() as { data: T; meta?: Record<string, unknown> }
  return { data, meta }
}

interface LoginResult {
  // Omitted by the backend for web clients (see X-Client-Platform) — auth
  // cookies are set instead. Still present for mobile, which has no cookie jar.
  token?: string
  user: { id: number; name: string | null; role: string }
}

interface StudentData {
  id: number
  name: string | null
  email: string
  role: string
  hasPassword: boolean
  profile: {
    weightedGpa: number
    unweightedGpa: number
    gradeLevel: number
    graduationYear: number
    futureDecision: string | null
    satScore: number | null
    actScore: number | null
    counselorName: string | null
  } | null
  courses: Array<{
    id: number
    name: string
    teacher: string
    period: number
    courseType: string
    semester: string
    creditHours: number
    grade: { letterGrade: string; percentage: number } | null
  }>
  assignments: Array<{
    id: number
    title: string
    subject: string
    dueDate: string
    estimatedMinutes: number
    completed: boolean
    completedAt: string | null
    priority?: string | null
  }>
  stats: {
    totalCourses: number
    pendingAssignments: number
    assignmentsDueToday: number
    assignmentsDueThisWeek: number
    completedAssignments?: number
  }
  hacGrades?: {
    classes: Array<{
      name: string
      teacher: string
      period: string
      room: string
      average: string | null
      scores: Array<{ name: string; category: string; score: number | null; totalPoints: number | null; percentage: string; dateDue: string }>
    }>
    availablePeriods: string[]
    currentPeriod: string
  }
}

export const api = {
  register: (email: string, password: string, otp: string, name: string | undefined, role: string | undefined, agreedTos: boolean, agreedPrivacy: boolean, agreedAge: boolean) =>
    request<LoginResult>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, otp, name, role, agreedTos, agreedPrivacy, agreedAge }),
    }),
  submitConsent: () =>
    request<{ tosAcceptedAt: string; privacyAcceptedAt: string; ageConfirmedAt: string }>('/api/auth/consent', {
      method: 'POST',
      body: JSON.stringify({ agreedTos: true, agreedPrivacy: true, agreedAge: true }),
    }),
  login: (email: string, password: string) =>
    request<LoginResult>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  authMe: () =>
    request<{ id: number; email: string; name: string | null; role: string; emailVerified: boolean }>('/api/auth/me'),
  searchSchools: (q: string) =>
    request<Array<{ name: string; city: string; state: string }>>(`/api/schools/search?q=${encodeURIComponent(q)}`),
  sendOtp: (email: string) =>
    request<{ sent: boolean }>('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  forgotPassword: (email: string) =>
    request<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
  me: () => request<StudentData>('/api/students/me'),
  updateProfile: (fields: { satScore?: number | null; actScore?: number | null; futureDecision?: string | null }) =>
    request<{ id: number }>('/api/students/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(fields),
    }),
  streakReward: (streak: number) =>
    request<{ newTags: Array<{ days: number; tag: string; tagColor: string }> }>(
      '/api/students/me/streak-reward',
      { method: 'POST', body: JSON.stringify({ streak }) }
    ),
  updateAvatarUrl: (avatarUrl: string | null) =>
    request<{ avatarUrl: string | null }>('/api/students/me/avatar', {
      method: 'PATCH',
      body: JSON.stringify({ avatarUrl }),
    }),
  roadmap: () => request<RoadmapData>('/api/roadmap'),
  // Personalized milestones are fetched separately from the fast structured-data
  // load above, so the page never blocks on the LLM call.
  // A single LLM call can now take up to ~60s worst case (createChatCompletion
  // retries once against a fallback model on failure), so single-call endpoints
  // get 65s. /api/ai/chat makes two sequential calls (intent classifier, then
  // the actual response) and gets 95s to cover both.
  roadmapInsights: () =>
    request<{ milestones: RoadmapData['milestones'] }>('/api/roadmap/insights', undefined, false, 65000),
  chat: (message: string, history: Array<{ role: 'user' | 'assistant'; content: string }> = []) =>
    request<{ reply: string }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history, renderMarkdown: true }),
    }, false, 95000),
  studyPlan: () => request<{
    overview: string
    days: Array<{
      label: string
      date: string
      sessions: Array<{
        assignmentId: number
        title: string
        subject: string
        dueDate: string
        minutesToSpend: number
        notes: string
      }>
    }>
  }>('/api/ai/study-plan', undefined, false, 65000),

  // ── School Portal Integration ──────────────────────────────────────────────

  portalStatus: () =>
    request<{
      connected: boolean
      systemType: string | null
      districtUrl: string | null
      sessionExpiresIn: number
      lastSynced: string | null
    }>('/api/integrations/grades/status'),

  portalLoginHAC: (baseUrl: string, username: string, password: string) =>
    request<{
      sessionToken: string
      systemType: string
      districtUrl: string
      expiresIn: number
    }>('/api/integrations/grades/hac/login', {
      method: 'POST',
      body: JSON.stringify({ baseUrl, username, password }),
    }),

  portalLoginPS: (baseUrl: string, username: string, password: string) =>
    request<{
      sessionToken: string
      systemType: string
      districtUrl: string
      expiresIn: number
    }>('/api/integrations/grades/powerschool/login', {
      method: 'POST',
      body: JSON.stringify({ baseUrl, username, password }),
    }),

  portalDisconnect: () =>
    request<{ disconnected: boolean }>(
      '/api/integrations/grades/session',
      { method: 'DELETE' },
    ),

  portalSyncProfile: () =>
    request<{
      synced: boolean
      name: string | null
      profile: {
        id: number
        userId: number
        gradeLevel: number
        graduationYear: number | null
        weightedGpa: number
        unweightedGpa: number
        futureDecision: string | null
        satScore: number | null
        actScore: number | null
        counselorName: string | null
      } | null
      studentInfo: {
        name: string
        grade: string
        school: string
        district: string
        counselor: string
        cohortYear: string
      }
    }>('/api/integrations/grades/sync-profile', {
      method: 'POST',
    }),

  portalGrades: () =>
    request<{
      systemType: string
      grades: NormalizedCourse[]
    }>('/api/integrations/grades/current'),

  portalTranscript: () =>
    request<{
      systemType: string
      transcript: {
        semesters: Array<{
          year: string
          semester: string
          courses: Array<{ name: string; grade: string; credits: string }>
        }>
        cumulativeGPA: string | null
        weightedGPA: string | null
        unweightedGPA: string | null
        classRank: string | null
        quartile: string | null
      }
    }>('/api/integrations/grades/transcript'),

  portalSchedule: () =>
    request<{ schedule: Record<string, string>[] }>('/api/integrations/grades/schedule'),

  portalClasswork: (period?: string) =>
    request<{
      classes: Array<{ name: string; period: string; teacher: string; room: string; average: string | null; scores: Array<{ name: string; category: string; score: number | null; totalPoints: number | null; percentage: string; dateDue: string }> }>
      availablePeriods: string[]
      currentPeriod: string
    }>(`/api/integrations/grades/classwork${period ? `?period=${encodeURIComponent(period)}` : ''}`),

  portalReportCard: (period?: string) =>
    request<{
      reportingPeriods: string[]
      currentPeriod: string
      semesters: {
        sem1: Array<{ name: string; period: string; numericGrade: string; letterGrade: string; credits: string; teacher: string }>
        sem2: Array<{ name: string; period: string; numericGrade: string; letterGrade: string; credits: string; teacher: string }>
      }
    }>(`/api/integrations/grades/report-card${period ? `?period=${encodeURIComponent(period)}` : ''}`),

  portalGpa: () =>
    request<{
      gpa: number | null
      unweightedGpa: number | null
      weightedGpa: number | null
      courseCount: number
      systemType: string
    }>('/api/integrations/grades/gpa'),

  portalProgressReport: (date?: string) =>
    request<{
      availableDates: string[]
      currentDate: string
      courses: Array<{ name: string; period: string; average: string; letterGrade: string; teacher: string }>
    }>(`/api/integrations/grades/progress-report${date ? `?date=${encodeURIComponent(date)}` : ''}`),

  portalContactTeachers: () =>
    request<{
      teachers: Array<{ name: string; courseName: string; period: string; email: null; emailNote: string; emailHint: string }>
    }>('/api/integrations/grades/contact-teachers'),

  portalAttendance: (monthOffset = 0) =>
    request<{
      month: string
      year: number
      monthIndex: number
      days: Array<{ date: string; dayOfWeek: string; status: string; code: string; description: string }>
      summary: { absences: number; tardies: number; excused: number }
    }>(`/api/integrations/grades/attendance?monthOffset=${monthOffset}`),

  // ── Study Feed ──────────────────────────────────────────────────────────────

  feedPosts: (page = 1, limit = 20, network: 'global' | 'isd' = 'global') =>
    request<{
      posts: FeedPost[]
      total: number
      page: number
      pageSize: number
      hasMore: boolean
    }>(`/api/feed/posts?page=${page}&limit=${limit}&network=${network}`),

  feedFollowingPosts: (page = 1, limit = 20) =>
    request<{
      posts: FeedPost[]
      total: number
      page: number
      pageSize: number
      hasMore: boolean
    }>(`/api/feed/posts/following?page=${page}&limit=${limit}`),

  feedCreatePost: (body: string, network: 'global' | 'isd' = 'global') =>
    request<FeedPost>('/api/feed/posts', {
      method: 'POST',
      body: JSON.stringify({ body, network }),
    }),

  feedDeletePost: (postId: number) =>
    request<{ deleted: boolean }>(`/api/feed/posts/${postId}`, {
      method: 'DELETE',
    }),

  feedToggleLike: (postId: number) =>
    request<{ liked: boolean }>(`/api/feed/posts/${postId}/like`, {
      method: 'POST',
    }),

  feedAddComment: (postId: number, body: string) =>
    request<FeedComment>(`/api/feed/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  feedToggleCommentLike: (postId: number, commentId: number) =>
    request<{ liked: boolean; count: number }>(`/api/feed/posts/${postId}/comments/${commentId}/like`, {
      method: 'POST',
    }),

  feedPostDetail: (postId: number) =>
    request<FeedPost & { comments: FeedComment[] }>(`/api/feed/posts/${postId}`),

  feedToggleFollow: (targetUserId: number) =>
    request<{ following: boolean }>(`/api/feed/users/${targetUserId}/follow`, {
      method: 'POST',
    }),

  feedUserProfile: (targetUserId: number) =>
    request<FeedUserProfile>(`/api/feed/users/${targetUserId}/profile`),

  feedSearchUsers: (q: string) =>
    request<Array<{ id: number; name: string | null; tag: string | null; tagColor: string | null; avatarUrl?: string | null }>>(
      `/api/feed/users/search?q=${encodeURIComponent(q)}`,
    ),

  feedUserPosts: (targetUserId: number, page = 1, limit = 20) =>
    request<{
      posts: FeedPost[]
      total: number
      page: number
      pageSize: number
      hasMore: boolean
    }>(`/api/feed/users/${targetUserId}/posts?page=${page}&limit=${limit}`),

  feedUpdateTag: (tag: string) =>
    request<{ id: number; name: string | null; email: string; tag: string | null }>(
      '/api/feed/users/me/tag',
      {
        method: 'PUT',
        body: JSON.stringify({ tag }),
      },
    ),

  feedAwardTag: (targetUserId: number, tag: string, tagColor?: string) =>
    request<{ tag: string | null; tagColor: string | null; allTags: Array<{ tag: string; tagColor: string }> }>(
      `/api/feed/users/${targetUserId}/tag`,
      {
        method: 'PUT',
        body: JSON.stringify({ tag, ...(tagColor ? { tagColor } : {}) }),
      },
    ),

  feedResetTag: (targetUserId: number) =>
    request<{ tag: string | null; tagColor: string | null; allTags: Array<{ tag: string; tagColor: string }> }>(
      `/api/feed/users/${targetUserId}/tag`,
      { method: 'DELETE' },
    ),

  feedRemoveTagFromUser: (targetUserId: number, tagName: string) =>
    request<{ tag: string | null; tagColor: string | null; allTags: Array<{ tag: string; tagColor: string }> }>(
      `/api/feed/users/${targetUserId}/tags/${encodeURIComponent(tagName)}`,
      { method: 'DELETE' },
    ),

  feedSetDisplayTag: (tag: string, tagColor: string) =>
    request<{ tag: string | null; tagColor: string | null }>(
      '/api/feed/users/me/display-tag',
      { method: 'PUT', body: JSON.stringify({ tag, tagColor }) },
    ),

  feedBanUser: (targetUserId: number, banned: boolean) =>
    request<{ banned: boolean }>(`/api/feed/users/${targetUserId}/ban`, {
      method: 'PUT',
      body: JSON.stringify({ banned }),
    }),

  feedMuteUser: (targetUserId: number, minutes: number | null) =>
    request<{ mutedUntil: string | null }>(`/api/feed/users/${targetUserId}/mute`, {
      method: 'PUT',
      body: JSON.stringify({ minutes }),
    }),

  feedSetUserRole: (targetUserId: number, role: string) =>
    request<{ role: string }>(`/api/feed/users/${targetUserId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  feedDeleteUser: (targetUserId: number) =>
    request<{ deleted: boolean }>(`/api/feed/users/${targetUserId}`, { method: 'DELETE' }),

  feedDevStats: () =>
    request<{ totalCoins: number; totalInventoryValue: number; userCount: number }>('/api/feed/dev-stats'),

  feedAdjustCoins: (targetUserId: number, action: 'add' | 'remove' | 'zero', amount?: number) =>
    request<{ coins: number }>(`/api/feed/users/${targetUserId}/coins`, {
      method: 'PUT',
      body: JSON.stringify({ action, amount }),
    }),

  feedCreateGiveaway: (data: { body: string; durationMinutes: number; giveawayTag?: string; giveawayTagColor?: string; giveawayCoinAmount?: number; giveawayItemType?: string; giveawayItemId?: string; giveawayItemRarity?: string }) =>
    request<FeedPost>('/api/feed/posts/giveaway', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  feedEnterGiveaway: (postId: number) =>
    request<{ entered: boolean; count: number }>(`/api/feed/posts/${postId}/giveaway/enter`, {
      method: 'POST',
    }),

  feedDrawGiveaway: (postId: number) =>
    request<{ winnerId: number; winnerName: string }>(`/api/feed/posts/${postId}/giveaway/draw`, {
      method: 'POST',
    }),

  feedPinPost: (postId: number) =>
    request<{ pinnedUntil: string | null }>(`/api/feed/posts/${postId}/pin`, { method: 'PUT' }),

  feedUnpinPost: (postId: number) =>
    request<{ ok: boolean }>(`/api/feed/posts/${postId}/unpin`, { method: 'PUT' }),

  // ── Planner ───────────────────────────────────────────────────────────────────

  plannerList: () =>
    request<PlannerItem[]>('/api/assignments?limit=100'),

  plannerCreate: (item: { title: string; subject?: string; startDate?: string; dueDate: string; dueTime?: string }) =>
    request<PlannerItem>('/api/assignments', {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  plannerToggle: (id: number, completed: boolean) =>
    request<PlannerItem>(`/api/assignments/${id}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),

  // dueDate/startDate here are full ISO timestamps, preserving time-of-day across the move
  plannerReschedule: (id: number, dates: { startDate: string | null; dueDate: string }) =>
    request<PlannerItem>(`/api/assignments/${id}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify(dates),
    }),

  plannerDelete: (id: number) =>
    request<{ deleted: boolean }>(`/api/assignments/${id}`, {
      method: 'DELETE',
    }),

  plannerScorePriorities: () =>
    request<{ scored: number }>('/api/assignments/score-priorities', {
      method: 'POST',
    }, false, 65000),

  // ── Canvas Integration ────────────────────────────────────────────────────────

  canvasStatus: () =>
    request<CanvasStatus>('/api/integrations/canvas/status'),

  canvasConnect: (canvasInstanceUrl: string, accessToken: string) =>
    request<{ connected: boolean; canvasUserName: string; canvasInstanceUrl: string }>(
      '/api/integrations/canvas/connect',
      { method: 'POST', body: JSON.stringify({ canvasInstanceUrl, accessToken }) }
    ),

  canvasSync: () =>
    request<{ syncedCount: number; assignments: Array<{ title: string; subject: string; dueDate: string }> }>(
      '/api/integrations/canvas/sync',
      { method: 'POST' }
    ),

  canvasDashboard: (canvasInstanceUrl?: string) =>
    request<{ canvasInstanceUrl: string; todo: CanvasTodoItem[]; courses: CanvasCourseWithGrade[] }>(
      `/api/integrations/canvas/dashboard${canvasInstanceUrl ? `?canvasInstanceUrl=${encodeURIComponent(canvasInstanceUrl)}` : ''}`,
    ),

  canvasCourseModules: (courseId: number, canvasInstanceUrl?: string) =>
    request<CanvasModule[]>(
      `/api/integrations/canvas/courses/${courseId}/modules${canvasInstanceUrl ? `?canvasInstanceUrl=${encodeURIComponent(canvasInstanceUrl)}` : ''}`,
    ),

  canvasCourseAnnouncements: (courseId: number, canvasInstanceUrl?: string) =>
    request<CanvasAnnouncement[]>(
      `/api/integrations/canvas/courses/${courseId}/announcements${canvasInstanceUrl ? `?canvasInstanceUrl=${encodeURIComponent(canvasInstanceUrl)}` : ''}`,
    ),

  canvasAssignmentDetail: (courseId: number, assignmentId: number, canvasInstanceUrl?: string) =>
    request<CanvasAssignmentDetail>(
      `/api/integrations/canvas/courses/${courseId}/assignments/${assignmentId}${canvasInstanceUrl ? `?canvasInstanceUrl=${encodeURIComponent(canvasInstanceUrl)}` : ''}`,
    ),

  canvasCourseFiles: (courseId: number, canvasInstanceUrl?: string) =>
    request<CanvasCourseFile[]>(
      `/api/integrations/canvas/courses/${courseId}/files${canvasInstanceUrl ? `?canvasInstanceUrl=${encodeURIComponent(canvasInstanceUrl)}` : ''}`,
    ),

  canvasCoursePage: (courseId: number, pageSlug: string, canvasInstanceUrl?: string) =>
    request<CanvasPage>(
      `/api/integrations/canvas/courses/${courseId}/pages/${encodeURIComponent(pageSlug)}${canvasInstanceUrl ? `?canvasInstanceUrl=${encodeURIComponent(canvasInstanceUrl)}` : ''}`,
    ),

  canvasDiscussion: (courseId: number, topicId: number, canvasInstanceUrl?: string) =>
    request<{ topic: CanvasDiscussionTopic; view: CanvasDiscussionView }>(
      `/api/integrations/canvas/courses/${courseId}/discussions/${topicId}${canvasInstanceUrl ? `?canvasInstanceUrl=${encodeURIComponent(canvasInstanceUrl)}` : ''}`,
    ),

  canvasDiscussionPost: (courseId: number, topicId: number, body: { message: string; parentEntryId?: number; canvasInstanceUrl?: string }) =>
    request<{ id: number }>(
      `/api/integrations/canvas/courses/${courseId}/discussions/${topicId}/entries`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  canvasQuiz: (courseId: number, quizId: number, canvasInstanceUrl?: string) =>
    request<{ quiz: CanvasQuizDetail; questions: CanvasQuizQuestion[]; submissions: CanvasQuizSubmission[] }>(
      `/api/integrations/canvas/courses/${courseId}/quizzes/${quizId}${canvasInstanceUrl ? `?canvasInstanceUrl=${encodeURIComponent(canvasInstanceUrl)}` : ''}`,
    ),

  canvasStartQuizSubmission: (courseId: number, quizId: number, canvasInstanceUrl?: string) =>
    request<CanvasActiveQuizSubmission>(
      `/api/integrations/canvas/courses/${courseId}/quizzes/${quizId}/submissions`,
      { method: 'POST', body: JSON.stringify({ canvasInstanceUrl }) },
    ),

  canvasGetSubmissionQuestions: (courseId: number, quizId: number, submissionId: number, validationToken: string, canvasInstanceUrl?: string) =>
    request<CanvasSubmissionQuestion[]>(
      `/api/integrations/canvas/courses/${courseId}/quizzes/${quizId}/submissions/${submissionId}/questions?validationToken=${encodeURIComponent(validationToken)}${canvasInstanceUrl ? `&canvasInstanceUrl=${encodeURIComponent(canvasInstanceUrl)}` : ''}`,
    ),

  canvasSaveQuizAnswers: (courseId: number, quizId: number, submissionId: number, body: { validationToken: string; attempt: number; quizQuestions: Array<{ id: number; flagged: boolean; answer: unknown }>; canvasInstanceUrl?: string }) =>
    request<{ ok: boolean }>(
      `/api/integrations/canvas/courses/${courseId}/quizzes/${quizId}/submissions/${submissionId}/questions`,
      { method: 'PUT', body: JSON.stringify(body) },
    ),

  canvasCompleteQuizSubmission: (courseId: number, quizId: number, submissionId: number, body: { validationToken: string; attempt: number; canvasInstanceUrl?: string }) =>
    request<{ ok: boolean }>(
      `/api/integrations/canvas/courses/${courseId}/quizzes/${quizId}/submissions/${submissionId}/complete`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  canvasSubmitAssignment: (courseId: number, assignmentId: number, submission: { submissionType: 'online_text_entry' | 'online_url'; body?: string; url?: string; canvasInstanceUrl?: string }) =>
    request<{ ok: boolean }>(
      `/api/integrations/canvas/courses/${courseId}/assignments/${assignmentId}/submit`,
      { method: 'POST', body: JSON.stringify(submission) },
    ),

  canvasGrades: () =>
    request<CanvasGradesConnection[]>('/api/integrations/canvas/grades'),

  canvasRefreshToken: (canvasInstanceUrl: string, newToken: string) =>
    request<{ success: boolean }>(
      '/api/integrations/canvas/refresh-token',
      { method: 'POST', body: JSON.stringify({ canvasInstanceUrl, newToken }) },
    ),

  canvasDisconnect: (canvasInstanceUrl?: string) =>
    request<{ disconnected: boolean; deletedAssignmentsCount: number; canvasInstanceUrl?: string }>(
      '/api/integrations/canvas/disconnect',
      {
        method: 'DELETE',
        body: canvasInstanceUrl ? JSON.stringify({ canvasInstanceUrl }) : undefined,
      }
    ),

  // ── Colleges ──────────────────────────────────────────────────────────────────

  collegeList: () =>
    request<CollegeListItem[]>('/api/colleges'),

  collegeSearch: (q: string) =>
    request<CollegeSearchResult[]>(`/api/colleges/search?q=${encodeURIComponent(q)}`),

  collegeAdd: (name: string, scorecardUnitId?: string) =>
    request<CollegeListItem>('/api/colleges', {
      method: 'POST',
      body: JSON.stringify({ name, ...(scorecardUnitId ? { scorecardUnitId } : {}) }),
    }),

  collegeRemove: (id: number) =>
    request<{ deleted: boolean }>(`/api/colleges/${id}`, { method: 'DELETE' }),

  collegeInsights: (id: number) =>
    request<CollegeInsights>(`/api/colleges/${id}/insights`, undefined, false, 65000),

  deleteAccount: (password?: string) =>
    request<{ deleted: boolean }>('/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),

  // ── Notifications ─────────────────────────────────────────────────────────────

  getNotifications: () =>
    request<{ notifications: AppNotification[]; unreadCount: number }>('/api/notifications'),

  markAllNotificationsRead: () =>
    request<{ ok: boolean }>('/api/notifications/read-all', { method: 'POST' }),

  // ── Marketplace ───────────────────────────────────────────────────────────────

  marketplaceDailyClaim: (streak?: number) =>
    request<{ coins: number; claimed: boolean; alreadyClaimed: boolean; coinBonus: number }>('/api/marketplace/daily-coins', {
      method: 'POST',
      body: JSON.stringify({ streak: streak ?? 1 }),
    }),

  marketplaceFreeSpin: () =>
    request<{ coins: number; reward: number; rarity: string }>('/api/marketplace/free-spin', { method: 'POST' }),

  marketplaceInventory: () =>
    request<InventoryData>('/api/marketplace/inventory'),

  marketplaceOpenBox: (boxType: string, quantity = 1) =>
    request<BoxResult & { results?: Array<{ won: BoxResult['won']; alreadyHad: boolean }> }>('/api/marketplace/open-box', { method: 'POST', body: JSON.stringify({ boxType, quantity }) }),

  marketplaceQuicksell: (itemType: 'tag' | 'name-color' | 'avatar', itemId: string) =>
    request<{ coins: number; payout: number }>('/api/marketplace/quicksell', {
      method: 'POST',
      body: JSON.stringify({ itemType, itemId }),
    }),

  marketplaceQuicksellDuplicates: (exclude: string[] = []) =>
    request<{ coins: number; sold: number; totalPayout: number }>('/api/marketplace/quicksell/duplicates', { method: 'POST', body: JSON.stringify({ exclude }), headers: { 'Content-Type': 'application/json' } }),

  marketplaceEquip: (type: 'name-color' | 'avatar' | 'tag', itemId: string | null) =>
    request<{ nameColor?: string | null; avatarEffect?: string | null }>('/api/marketplace/equip', {
      method: 'PUT',
      body: JSON.stringify({ type, itemId }),
    }),

  equipBadge: (itemId: string | null) =>
    request<{ badge: string | null }>('/api/marketplace/equip', {
      method: 'PUT',
      body: JSON.stringify({ type: 'badge', itemId }),
    }),

  marketplaceAdminGrant: (payload: { type: 'coins'; amount: number } | { type: 'name-color' | 'avatar' | 'tag'; itemId: string }) =>
    request<{ coins?: number; granted?: MarketplaceItem & { tag?: string; tagColor?: string }; tag?: string; tagColor?: string }>('/api/marketplace/admin/grant', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  marketplaceGetListings: () =>
    request<MarketplaceListing[]>('/api/marketplace/listings'),

  marketplaceCreateListing: (payload: { itemType: string; itemId: string; price: number }) =>
    request<{ listing: MarketplaceListing; listingFee: number }>('/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  marketplaceCancelListing: (listingId: number) =>
    request<{ ok: boolean }>(`/api/marketplace/listings/${listingId}`, { method: 'DELETE' }),

  marketplaceBuyListing: (listingId: number) =>
    request<{ ok: boolean; coins: number }>(`/api/marketplace/listings/${listingId}/buy`, { method: 'POST' }),

  marketplaceGetUserInventory: (userId: number) =>
    request<UserPublicInventory>(`/api/marketplace/users/${userId}/inventory`),

  marketplaceCreateTrade: (payload: { receiverId: number; senderItems: TradeItem[]; receiverItems: TradeItem[]; note?: string }) =>
    request<TradeOffer>('/api/marketplace/trades', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  marketplaceGetIncomingTrades: () =>
    request<TradeOffer[]>('/api/marketplace/trades/incoming'),

  marketplaceGetSentTrades: () =>
    request<TradeOffer[]>('/api/marketplace/trades/sent'),

  marketplaceGetTradesHistory: () =>
    request<TradeOffer[]>('/api/marketplace/trades/history'),

  marketplaceAcceptTrade: (tradeId: number) =>
    request<{ ok: boolean }>(`/api/marketplace/trades/${tradeId}/accept`, { method: 'POST' }),

  marketplaceDeclineTrade: (tradeId: number) =>
    request<{ ok: boolean }>(`/api/marketplace/trades/${tradeId}/decline`, { method: 'POST' }),

  marketplaceCancelTrade: (tradeId: number) =>
    request<{ ok: boolean }>(`/api/marketplace/trades/${tradeId}/cancel`, { method: 'POST' }),

  getItemPrices: () =>
    request<Record<string, number>>('/api/marketplace/prices'),

  marketplaceItemHistory: (itemType: string, itemId: string) =>
    request<ItemSalePoint[]>(`/api/marketplace/item/${itemType}/${encodeURIComponent(itemId)}/history`),

  marketplaceItemOwners: (itemType: string, itemId: string) =>
    request<ItemOwnersData>(`/api/marketplace/item/${itemType}/${encodeURIComponent(itemId)}/owners`),

  marketplaceLeaderboard: () =>
    request<LeaderboardData>('/api/marketplace/leaderboard'),

  // ── Wandering Trader ──────────────────────────────────────────────────────────

  traderStatus: () =>
    request<{ sellsUsed: number; sellsRemaining: number; buysUsed: number; buysRemaining: number; tradesUsed: number; tradesRemaining: number }>('/api/marketplace/trader/status'),

  traderCatalog: () =>
    request<Array<{ type: 'tag' | 'name-color' | 'avatar'; id: string; name: string; rarity: string; traderPrice: number; tag?: string; tagColor?: string; value?: string }>>('/api/marketplace/trader/catalog'),

  traderSell: (itemType: 'tag' | 'name-color' | 'avatar', itemId: string) =>
    request<{ ok: boolean; payout: number; sellsRemaining: number }>('/api/marketplace/trader/sell', {
      method: 'POST',
      body: JSON.stringify({ itemType, itemId }),
    }),

  traderBuy: (itemType: 'tag' | 'name-color' | 'avatar', itemId: string) =>
    request<{ ok: boolean; price: number; buysRemaining: number }>('/api/marketplace/trader/buy', {
      method: 'POST',
      body: JSON.stringify({ itemType, itemId }),
    }),

  traderTrade: (
    offerItems: Array<{ type: 'tag' | 'name-color' | 'avatar'; id: string }>,
    wantItems: Array<{ type: 'tag' | 'name-color' | 'avatar'; id: string }>,
  ) =>
    request<{ ok: boolean; tradesRemaining: number }>('/api/marketplace/trader/trade', {
      method: 'POST',
      body: JSON.stringify({ offerItems, wantItems }),
    }),

  spinStats: () =>
    request<SpinStats>('/api/marketplace/spin-stats'),

  // ── Parent API ────────────────────────────────────────────────────────────────

  parentLinkStudent: (credentials: { districtUrl: string; username: string; password: string }) =>
    request<{ linked: boolean; student: { id: number; name: string | null; email: string } }>(
      '/api/parent/link-student',
      { method: 'POST', body: JSON.stringify(credentials) },
    ),

  parentStudents: () =>
    request<ParentStudentSummary[]>('/api/parent/students'),

  parentStudentDetail: (studentId: number) =>
    request<StudentData>(`/api/parent/students/${studentId}`),

  parentStudentGrades: (studentId: number, period?: string) =>
    request<{ classes: NonNullable<StudentData['hacGrades']>['classes']; availablePeriods: string[]; currentPeriod: string }>(
      `/api/parent/students/${studentId}/grades${period ? `?period=${encodeURIComponent(period)}` : ''}`,
    ),

  parentUnlinkStudent: (studentId: number) =>
    request<{ unlinked: boolean }>(`/api/parent/students/${studentId}`, { method: 'DELETE' }),

  parentStudentChat: (studentId: number, message: string) =>
    request<{ reply: string }>(`/api/parent/students/${studentId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }, false, 65000),

  adminStats: () =>
    request<{ totalUsers: number; activeUsers: number; liveUsers: number }>('/api/marketplace/admin/stats'),

  adminLookupUser: (userId: number) =>
    request<{ id: number; name: string | null; hacName: string | null; email: string; role: string; tag: string | null; tagColor: string | null; nameColor: string | null; avatarEffect: string | null; coins: number; loginStreak: number; chatBanned: boolean; marketplaceBanned: boolean; marketplaceAccess: boolean; deletedAt: string | null; createdAt: string; lastSeenAt: string | null }>(`/api/admin/users/${userId}`),

  adminGrantMarketAccess: (userId: number) =>
    request<{ ok: boolean }>('/api/admin/grant-market-access', { method: 'POST', body: JSON.stringify({ userId }) }),

  adminBanMarketplace: (userId: number, banned: boolean) =>
    request<{ ok: boolean }>('/api/admin/ban-marketplace', { method: 'POST', body: JSON.stringify({ userId, banned }) }),

  sendCoins: (receiverId: number, amount: number) =>
    request<{ ok: boolean; newBalance: number }>('/api/marketplace/coins/send', { method: 'POST', body: JSON.stringify({ receiverId, amount }) }),

  // ── Educator (Teacher + Counselor shared) ─────────────────────────────────

  educatorMe: () =>
    request<{ role: string; name: string | null; email: string; requestStatus: string | null; requestedRole: string | null }>('/api/educator/me'),

  educatorRequestRole: (requestedRole: 'TEACHER' | 'COUNSELOR', institution: string) =>
    request<{ id: number }>('/api/educator/request-role', {
      method: 'POST',
      body: JSON.stringify({ requestedRole, institution }),
    }),

  educatorClassrooms: () =>
    request<EducatorClassroom[]>('/api/educator/classrooms'),

  educatorCreateClassroom: (name: string, description?: string) =>
    request<EducatorClassroom>('/api/educator/classrooms', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),

  educatorClassroomDetail: (classroomId: number) =>
    request<EducatorClassroomDetail>(`/api/educator/classrooms/${classroomId}`),

  educatorDeleteClassroom: (classroomId: number) =>
    request<{ deleted: boolean }>(`/api/educator/classrooms/${classroomId}`, { method: 'DELETE' }),

  educatorCreateAssignment: (classroomId: number, payload: { title: string; description?: string; subject: string; dueDate: string }) =>
    request<EducatorAssignment>(`/api/educator/classrooms/${classroomId}/assignments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  educatorGrantCoins: (classroomId: number, studentId: number, coins: number, reason?: string) =>
    request<{ ok: boolean }>(`/api/educator/classrooms/${classroomId}/coins`, {
      method: 'POST',
      body: JSON.stringify({ studentId, coins, reason }),
    }),

  educatorStudentDetail: (classroomId: number, studentId: number) =>
    request<EducatorStudentProfile>(`/api/educator/classrooms/${classroomId}/students/${studentId}`),

  // ── Counselor ─────────────────────────────────────────────────────────────

  counselorAddStudent: (studentId: number) =>
    request<{ id: number }>('/api/counselor/students', {
      method: 'POST',
      body: JSON.stringify({ studentId }),
    }),

  counselorStudents: () =>
    request<CounselorStudentSummary[]>('/api/counselor/students'),

  counselorSearchStudents: (q: string) =>
    request<Array<{ id: number; name: string | null; email: string; hacUsername: string | null }>>(`/api/counselor/students/search?q=${encodeURIComponent(q)}`),

  counselorRemoveStudent: (studentId: number) =>
    request<{ removed: boolean }>(`/api/counselor/students/${studentId}`, { method: 'DELETE' }),

  counselorStudentDetail: (studentId: number) =>
    request<CounselorStudentDetail>(`/api/counselor/students/${studentId}`),

  counselorStudentCourses: (studentId: number) =>
    request<CounselorStudentCourse[]>(`/api/counselor/students/${studentId}/courses`),

  counselorAddCourseComment: (studentId: number, courseId: number, body: string) =>
    request<CounselorComment>(`/api/counselor/students/${studentId}/courses/${courseId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  counselorGetCourseComments: (studentId: number, courseId: number) =>
    request<CounselorComment[]>(`/api/counselor/students/${studentId}/courses/${courseId}/comments`),

  counselorAddRecommendation: (studentId: number, payload: { courseName: string; courseCode?: string; rationale?: string; semester: string }) =>
    request<CounselorRecommendation>(`/api/counselor/students/${studentId}/recommendations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  counselorGetRecommendations: (studentId: number) =>
    request<CounselorRecommendation[]>(`/api/counselor/students/${studentId}/recommendations`),

  counselorDeleteRecommendation: (id: number) =>
    request<{ deleted: boolean }>(`/api/counselor/recommendations/${id}`, { method: 'DELETE' }),

  counselorAddNote: (studentId: number, body: string) =>
    request<CounselorNote>(`/api/counselor/students/${studentId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  counselorGetNotes: (studentId: number) =>
    request<CounselorNote[]>(`/api/counselor/students/${studentId}/notes`),

  counselorUpdateNote: (id: number, body: string) =>
    request<CounselorNote>(`/api/counselor/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    }),

  counselorDeleteNote: (id: number) =>
    request<{ deleted: boolean }>(`/api/counselor/notes/${id}`, { method: 'DELETE' }),

  counselorAddActionItem: (studentId: number, payload: { title: string; description?: string; dueDate?: string }) =>
    request<CounselorActionItem>(`/api/counselor/students/${studentId}/action-items`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  counselorGetActionItems: (studentId: number) =>
    request<CounselorActionItem[]>(`/api/counselor/students/${studentId}/action-items`),

  counselorUpdateActionItem: (id: number, payload: { title?: string; description?: string; dueDate?: string; completed?: boolean }) =>
    request<CounselorActionItem>(`/api/counselor/action-items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  counselorDeleteActionItem: (id: number) =>
    request<{ deleted: boolean }>(`/api/counselor/action-items/${id}`, { method: 'DELETE' }),

  counselorSendChat: (studentId: number, body: string) =>
    request<CounselorChatMessage>(`/api/counselor/students/${studentId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  counselorGetChat: (studentId: number, cursor?: string, limit = 50) =>
    request<CounselorChatPage>(`/api/counselor/students/${studentId}/chat?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),

  counselorMarkChatRead: (studentId: number) =>
    request<{ ok: boolean }>(`/api/counselor/students/${studentId}/chat/read`, { method: 'PUT' }),

  counselorUnreadTotal: () =>
    request<{ total: number }>('/api/counselor/unread-total'),

  // ── Admin ─────────────────────────────────────────────────────────────────

  adminEducatorRequests: (status: 'PENDING' | 'APPROVED' | 'DENIED' = 'PENDING') =>
    request<EducatorRequest[]>(`/api/admin/educator-requests?status=${status}`),

  adminApproveEducatorRequest: (id: number) =>
    request<{ ok: boolean }>(`/api/admin/educator-requests/${id}/approve`, { method: 'POST' }),

  adminDenyEducatorRequest: (id: number) =>
    request<{ ok: boolean }>(`/api/admin/educator-requests/${id}/deny`, { method: 'POST' }),

  adminRevokeEducatorRequest: (id: number) =>
    request<{ ok: boolean }>(`/api/admin/educator-requests/${id}/revoke`, { method: 'POST' }),

  adminReinstateEducatorRequest: (id: number) =>
    request<{ ok: boolean }>(`/api/admin/educator-requests/${id}/reinstate`, { method: 'POST' }),

  // ── Student classroom + counselor ────────────────────────────────────────

  studentClassrooms: () =>
    request<StudentClassroom[]>('/api/students/classrooms'),

  studentClassroomDetail: (id: number) =>
    request<ClassroomDetail>(`/api/students/classrooms/${id}`),

  studentJoinClassroom: (inviteCode: string) =>
    request<{ id: number }>('/api/students/classrooms/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode: inviteCode.toUpperCase() }),
    }),

  classroomPosts: (classroomId: number, page = 1) =>
    request<ClassroomPost[]>(`/api/students/classrooms/${classroomId}/posts?page=${page}`),

  classroomCreatePost: (classroomId: number, body: string) =>
    request<ClassroomPost>(`/api/students/classrooms/${classroomId}/posts`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  // ── Question Sets ──────────────────────────────────────────────────────────
  sets: (params?: { q?: string; subject?: string; mine?: boolean }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.subject) qs.set('subject', params.subject)
    if (params?.mine) qs.set('mine', 'true')
    return request<QuestionSet[]>(`/api/sets?${qs.toString()}`)
  },
  createSet: (data: { title: string; description?: string | null; subject?: string | null; visibility: 'PUBLIC' | 'PRIVATE'; questions?: QuestionInput[] }) =>
    request<QuestionSetWithQuestions>('/api/sets', { method: 'POST', body: JSON.stringify(data) }),
  getSet: (id: number) =>
    request<QuestionSetWithQuestions>(`/api/sets/${id}`),
  updateSet: (id: number, data: Partial<{ title: string; description: string | null; subject: string | null; visibility: 'PUBLIC' | 'PRIVATE' }>) =>
    request<QuestionSetWithQuestions>(`/api/sets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSet: (id: number) =>
    request<{ id: number }>(`/api/sets/${id}`, { method: 'DELETE' }),
  addQuestion: (setId: number, q: QuestionInput) =>
    request<Question>(`/api/sets/${setId}/questions`, { method: 'POST', body: JSON.stringify(q) }),
  updateQuestion: (setId: number, qid: number, q: Partial<QuestionInput>) =>
    request<Question>(`/api/sets/${setId}/questions/${qid}`, { method: 'PUT', body: JSON.stringify(q) }),
  deleteQuestion: (setId: number, qid: number) =>
    request<{ id: number }>(`/api/sets/${setId}/questions/${qid}`, { method: 'DELETE' }),
  reorderQuestions: (setId: number, order: number[]) =>
    request<{ ok: boolean }>(`/api/sets/${setId}/questions/reorder`, { method: 'PUT', body: JSON.stringify({ order }) }),

  // ── Game Sessions ──────────────────────────────────────────────────────────
  createGame: (setId: number) =>
    request<GameSession>('/api/games', { method: 'POST', body: JSON.stringify({ setId }) }),
  createBattleGame: (setId: number) =>
    request<GameSession>('/api/games', { method: 'POST', body: JSON.stringify({ setId, type: 'BATTLE' }) }),
  getGame: (code: string) =>
    request<GameSession>(`/api/games/${code.toUpperCase()}`),
  joinGame: (code: string) =>
    request<GameSession>(`/api/games/${code.toUpperCase()}/join`, { method: 'POST' }),
  startGame: (code: string) =>
    request<GameSession>(`/api/games/${code.toUpperCase()}/start`, { method: 'POST' }),
  submitAnswer: (code: string, data: { questionId: number; answer: string; timeMs: number }) =>
    request<{ isCorrect: boolean; pointsEarned: number }>(`/api/games/${code.toUpperCase()}/answer`, { method: 'POST', body: JSON.stringify(data) }),
  revealResults: (code: string) =>
    request<{ ok: boolean }>(`/api/games/${code.toUpperCase()}/reveal`, { method: 'POST' }),
  nextQuestion: (code: string) =>
    request<{ status: string; questionIndex?: number }>(`/api/games/${code.toUpperCase()}/next`, { method: 'POST' }),

  studentActionItems: () =>
    request<StudentActionItem[]>('/api/students/action-items'),

  studentPendingCounselorLinks: () =>
    request<CounselorLink[]>('/api/students/counselor-links/pending'),

  studentActiveCounselorLinks: () =>
    request<CounselorLink[]>('/api/students/counselor-links/active'),

  studentAcceptCounselorLink: (counselorId: number) =>
    request<{ ok: boolean }>(`/api/students/counselor-links/${counselorId}/accept`, { method: 'POST' }),

  studentDeclineCounselorLink: (counselorId: number) =>
    request<{ deleted: boolean }>(`/api/students/counselor-links/${counselorId}/decline`, { method: 'DELETE' }),

  studentSendCounselorMessage: (counselorId: number, body: string) =>
    request<CounselorChatMessage>(`/api/students/counselor-chat/${counselorId}`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  studentGetCounselorChat: (counselorId: number) =>
    request<{ messages: CounselorChatMessage[]; nextCursor: string | null }>(`/api/students/counselor-chat/${counselorId}`),

  studentCounselorPortal: (counselorId: number) =>
    request<StudentCounselorPortal>(`/api/students/counselor-portal/${counselorId}`),

  studentToggleActionItem: (id: number) =>
    request<StudentActionItem>(`/api/students/action-items/${id}`, { method: 'PATCH' }),

  // ── ClassLink Integration ─────────────────────────────────────────────────────

  classlinkDistricts: () =>
    request<{ districts: { id: string; name: string; state: string }[] }>('/api/integrations/classlink/districts'),

  classlinkConnect: (districtId: string, username: string, password: string) =>
    request<{ success: boolean; districtName: string; schoology: boolean; infiniteCampus: boolean }>(
      '/api/integrations/classlink/connect',
      { method: 'POST', body: JSON.stringify({ districtId, username, password }) }
    ),

  classlinkSchoologyGradebook: () =>
    request<{ courses: unknown[]; assignments: unknown[]; lastUpdated: string }>(
      '/api/integrations/classlink/schoology/gradebook'
    ),

  classlinkInfiniteCampus: () =>
    request<{ schedule: unknown[]; reportCards: unknown[]; attendance: unknown[]; transcript: unknown[]; counselorName: string | null; counselorEmail: string | null }>(
      '/api/integrations/classlink/infinitecampus'
    ),

  // ── AI Agent sessions ─────────────────────────────────────────────────────

  startAgentSession: (module: AgentModule, userMessage?: string) =>
    request<{ sessionId: number; status: 'RUNNING' }>('/api/ai/agent/session', {
      method: 'POST',
      body: JSON.stringify({ module, userMessage }),
    }),

  getAgentSession: (sessionId: number) =>
    request<AgentSessionData>(`/api/ai/agent/sessions/${sessionId}`),

  getAgentSessions: async (cursor?: number): Promise<{ sessions: AgentSessionData[]; nextCursor: number | null }> => {
    const { data, meta } = await requestWithMeta<AgentSessionData[]>(
      `/api/ai/agent/sessions${cursor != null ? `?cursor=${cursor}` : ''}`
    )
    return {
      sessions: data,
      nextCursor: (meta?.nextCursor ?? null) as number | null,
    }
  },

  getAgentToolCalls: (sessionId: number) =>
    request<AgentToolCallData[]>(`/api/ai/agent/sessions/${sessionId}/tool-calls`),

  confirmAgentAction: (sessionId: number, confirmed: boolean) =>
    request<{ ok: boolean }>(`/api/ai/agent/sessions/${sessionId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ confirmed }),
    }),

  updateAutonomousConsent: (accepted: boolean) =>
    request<{ ok: boolean }>('/api/users/me/autonomous-consent', {
      method: 'PATCH',
      body: JSON.stringify({ accepted }),
    }),

}

// ── Planner types ─────────────────────────────────────────────────────────

export interface PlannerItem {
  id: number
  title: string
  subject: string | null
  startDate: string | null
  dueDate: string
  dueTime: string | null
  completed: boolean
  completedAt: string | null
  userId: number
  source?: string
  priority: string | null
}

export interface RoadmapData {
  gradeLevel: number
  graduationYear: number | null
  creditsCompleted: number
  creditsRequired: number
  percentComplete: number
  creditsByCategory: Record<string, number>
  milestones: Array<{ grade: number; label: string; done: boolean }>
  weightedGpa: number
  unweightedGpa: number
  futureDecision: string | null
}

export interface CanvasConnectionInfo {
  canvasInstanceUrl: string
  canvasUserName: string | null
  lastSynced: string | null
  syncStatus: string | null
  syncError: string | null
  tokenInvalid: boolean
}

export interface CanvasStatus {
  connected: boolean
  connections: CanvasConnectionInfo[]
  // Backwards-compat: first connection
  canvasInstanceUrl: string | null
  canvasUserName: string | null
  lastSynced: string | null
  syncStatus: string | null
  syncError: string | null
  tokenInvalid?: boolean
}

// ── Canvas Dashboard types ─────────────────────────────────────────────────

export interface CanvasCourseWithGrade {
  id: number
  name: string
  currentScore: number | null
  currentGrade: string | null
}

export interface CanvasTodoItem {
  type: string
  assignment: {
    id: number
    name: string
    due_at: string | null
    points_possible: number | null
    course_id: number
    html_url: string
  }
  context_name: string
  html_url: string
  ignore: string
}

export interface CanvasModuleItem {
  id: number
  title: string
  type: string
  content_id: number | null
  html_url: string
  url: string | null
  published: boolean
  completion_requirement: {
    type: string
    min_score?: number
    completed: boolean
  } | null
}

export interface CanvasModule {
  id: number
  name: string
  position: number
  unlock_at: string | null
  items_count: number
  items: CanvasModuleItem[]
}

export interface CanvasAnnouncement {
  id: number
  title: string
  message: string
  posted_at: string
  author: { display_name: string; avatar_image_url: string | null }
  read_state: string
  html_url: string
}

export interface CanvasAssignmentDetail {
  id: number
  name: string
  description: string | null
  due_at: string | null
  points_possible: number | null
  submission_types: string[]
  html_url: string
  course_id: number
  submission: CanvasGradesSubmission | null
  rubric?: Array<{
    id: string
    description: string
    long_description: string
    points: number
  }>
}

export interface CanvasPage {
  url: string
  title: string
  body: string | null
  updated_at: string
}

export interface CanvasDiscussionParticipant {
  id: number
  display_name: string
  avatar_image_url: string | null
}

export interface CanvasDiscussionEntry {
  id: number
  user_id: number
  message: string
  created_at: string
  replies?: CanvasDiscussionEntry[]
  read_state?: string
}

export interface CanvasDiscussionTopic {
  id: number
  title: string
  message: string | null
  posted_at: string
  author: { display_name: string; avatar_image_url: string | null }
  html_url: string
}

export interface CanvasDiscussionView {
  participants: CanvasDiscussionParticipant[]
  unread_entries: number[]
  view: CanvasDiscussionEntry[]
}

export interface CanvasQuizAnswer {
  id: number
  text: string
  html?: string
  weight: number
}

export interface CanvasQuizQuestion {
  id: number
  question_name: string
  question_text: string
  question_type: string
  points_possible: number
  answers?: CanvasQuizAnswer[]
}

export interface CanvasQuizDetail {
  id: number
  title: string
  description: string | null
  time_limit: number | null
  question_count: number
  quiz_type: string
  allowed_attempts: number
  points_possible: number
  due_at: string | null
  show_correct_answers: boolean
  html_url: string
}

export interface CanvasQuizSubmissionData {
  question_id: number
  correct: boolean | null
  points: number
  answer_id?: number
  text?: string
  answer_for_text_entry?: string
}

export interface CanvasQuizSubmission {
  id: number
  quiz_id: number
  score: number | null
  kept_score: number | null
  workflow_state: string
  finished_at: string | null
  attempt: number
  quiz_points_possible: number
  submission_data?: CanvasQuizSubmissionData[]
}

export interface CanvasActiveQuizSubmission {
  id: number
  quiz_id: number
  attempt: number
  validation_token: string
  started_at: string | null
  end_at: string | null
  workflow_state: string
  time_limit: number | null
}

export interface CanvasSubmissionQuestionAnswer {
  id: number
  text: string
  html?: string
  match_id?: number
}

export interface CanvasSubmissionQuestion {
  id: number
  question_name: string
  question_text: string
  question_type: string
  points_possible: number
  answers?: CanvasSubmissionQuestionAnswer[]
  matches?: Array<{ text: string; match_id: number }>
}

export interface CanvasCourseFile {
  id: number
  display_name: string
  filename: string
  'content-type': string
  url: string
  size: number
  updated_at: string
  folder_id: number
  locked: boolean
}

// ── Canvas Grades types ─────────────────────────────────────────────────────

export interface CanvasGradesSubmission {
  score: number | null
  grade: string | null
  submitted_at: string | null
  workflow_state: string
  late: boolean
  missing: boolean
}

export interface CanvasGradesAssignment {
  id: number
  name: string
  due_at: string | null
  points_possible: number | null
  html_url: string
  submission: CanvasGradesSubmission | null
}

export interface CanvasGradesCourse {
  id: number
  name: string
  currentScore: number | null
  currentGrade: string | null
  assignments: CanvasGradesAssignment[]
}

export interface CanvasGradesConnection {
  canvasInstanceUrl: string
  canvasUserName: string | null
  error?: string
  courses: CanvasGradesCourse[]
}

// ── Study Feed types ───────────────────────────────────────────────────────

export interface FeedUser {
  id: number
  name: string | null
  tag: string | null
  tagColor: string | null
  nameColor: string | null
  avatarEffect: string | null
  badge?: string | null
  avatarUrl?: string | null
}

export interface FeedPost {
  id: number
  userId: number
  body: string
  createdAt: string
  updatedAt: string
  user: FeedUser
  likedByMe: boolean
  enteredByMe: boolean
  type: string
  pinnedUntil: string | null
  giveawayTag: string | null
  giveawayTagColor: string | null
  giveawayCoinAmount: number | null
  giveawayEndsAt: string | null
  giveawayWinnerId: number | null
  giveawayWinner: { id: number; name: string | null; email: string } | null
  giveawayItemType: string | null
  giveawayItemId: string | null
  giveawayItemRarity: string | null
  unboxItemType: string | null
  unboxItemId: string | null
  unboxItemName: string | null
  unboxItemValue: string | null
  unboxItemRarity: string | null
  unboxItemEstValue: number | null
  unboxItemTagColor: string | null
  network: string
  isdCode: string | null
  _count: { likes: number; comments: number; giveawayEntries: number }
}

export interface FeedComment {
  id: number
  postId: number
  userId: number
  body: string
  createdAt: string
  user: FeedUser
  likedByMe: boolean
  _count: { likes: number }
}

export interface FeedUserProfile {
  id: number
  name: string | null
  hacName?: string | null
  tag: string | null
  tagColor: string | null
  nameColor: string | null
  avatarEffect: string | null
  badge?: string | null
  avatarUrl?: string | null
  role: string
  isFollowing: boolean
  totalLikes: number
  chatBanned: boolean
  chatMutedUntil: string | null
  deletedAt?: string | null
  allTags: Array<{ tag: string; tagColor: string }>
  _count: { followers: number; following: number; posts: number }
  coins?: number
  isdCode?: string | null
  isdDisplayName?: string | null
}

export interface MarketplaceItem {
  id: string
  name: string
  value: string
  rarity: string
  weight: number
}

export interface TagInventoryItem {
  id: string
  tag: string
  tagColor: string
  rarity: string
}

export interface InventoryData {
  name?: string | null
  coins: number
  canClaimToday: boolean
  tag: string | null
  tagColor: string | null
  nameColor: string | null
  avatarEffect: string | null
  badge?: string | null
  ownedTags: TagInventoryItem[]
  ownedNameColors: MarketplaceItem[]
  ownedAvatarEffects: MarketplaceItem[]
  marketplaceAccess?: boolean
  nextFreeSpin?: string | null
  isdCode?: string | null
  isdDisplayName?: string | null
}

export interface SpinStats {
  spinCoinsSpent: number
  spinTotalSpins: number
  spinCommon: number
  spinUncommon: number
  spinRare: number
  spinEpic: number
  spinLegendary: number
  spinMythic: number
  spinCurse: number
}

export interface BoxResult {
  coins: number
  won: { id: string; name?: string; tag?: string; tagColor?: string; value?: string; rarity: string; type: string }
  alreadyHad: boolean
}

export interface TradeItem {
  type: 'tag' | 'name-color' | 'avatar'
  id: string
  tag?: string
  tagColor?: string
  name?: string
  value?: string
  rarity: string
}

export interface MarketplaceListing {
  id: number
  sellerId: number
  itemType: string
  itemId: string
  itemName: string
  itemValue: string
  itemRarity: string
  itemRarityRank: number
  price: number
  status: string
  buyerId: number | null
  createdAt: string
  seller: { id: number; name: string | null; tag: string | null; tagColor: string | null; nameColor: string | null; badge?: string | null }
}

export interface TradeOffer {
  id: number
  senderId: number
  receiverId: number
  senderItems: TradeItem[]
  receiverItems: TradeItem[]
  status: string
  note?: string | null
  createdAt: string
  sender: { id: number; name: string | null; tag: string | null; tagColor: string | null; nameColor: string | null; badge?: string | null }
  receiver: { id: number; name: string | null; tag: string | null; tagColor: string | null; nameColor: string | null; badge?: string | null }
}

export interface UserPublicInventory {
  user: { id: number; name: string | null; tag: string | null; tagColor: string | null; nameColor: string | null; badge?: string | null }
  tags: TagInventoryItem[]
  nameColors: MarketplaceItem[]
  avatarEffects: MarketplaceItem[]
}

export interface ItemSalePoint { price: number; soldAt: string }

export interface ItemOwner {
  rank: number; id: number; name: string | null
  tag: string | null; tagColor: string | null; nameColor: string | null; avatarEffect: string | null; badge?: string | null
  qty: number
}

export interface ItemOwnersData { owners: ItemOwner[]; total: number }

export interface LeaderboardEntry {
  rank: number; id: number; name: string | null
  tag: string | null; tagColor: string | null; nameColor: string | null; avatarEffect: string | null; badge?: string | null; value: number
}

export interface LeaderboardData {
  coins: LeaderboardEntry[]
  streak: LeaderboardEntry[]
  inventory: LeaderboardEntry[]
}

// ── Parent API ─────────────────────────────────────────────────────────────────

export interface ParentStudentSummary {
  id: number
  name: string | null
  email: string
  gradeLevel: number | null
  graduationYear: number | null
  weightedGpa: number
  unweightedGpa: number
  pendingAssignments: number
  totalCourses: number
  courses: Array<{ name: string; letterGrade: string | null; percentage: number | null }>
}

export type { StudentData }

export interface NormalizedCourse {
  id: string
  name: string
  teacher: string
  period: string
  average: number | null
  letterGrade: string | null
  assignments: Array<{
    name: string
    category: string
    score: number | null
    totalPoints: number | null
    percentage: string
    dateDue: string
  }>
  upcomingAssignments: Array<{
    name: string
    category: string
    score: number | null
    totalPoints: number | null
    percentage: string
    dateDue: string
  }>
}

// Kept for backwards compatibility — same shape as NormalizedCourse
export type HacGrade = NormalizedCourse

export interface CollegeListItem {
  id: number
  name: string
  scorecardUnitId: string | null
  createdAt: string
  unitId: string | null
  city: string | null
  state: string | null
  admissionRate: number | null
  sat25th: number | null
  sat75th: number | null
  score: number | null
  label: string | null
}

export interface CollegeInsightsStep {
  step: string
  category: 'test' | 'gpa' | 'essay' | 'extracurricular' | 'strategy'
  priority: 'high' | 'medium' | 'low'
}

export interface CollegeInsights {
  collegeListItemId: number
  collegeName: string
  score: number | null
  label: 'Likely' | 'Possible' | 'Reach' | 'Far Reach' | null
  narrativeSummary: string
  actionableSteps: CollegeInsightsStep[]
  generatedAt: string
  cached: boolean
}

export interface CollegeSearchResult {
  unitId: string
  name: string
  city: string | null
  state: string | null
  admissionRate: number | null
  sat25th: number | null
  sat75th: number | null
  score: number | null
  label: string | null
}

export interface AppNotification {
  id: number
  userId: number
  fromUserId: number
  type: 'FOLLOW' | 'LIKE' | 'COMMENT' | 'GIVEAWAY_WIN' | 'TRADE_OFFER' | 'TRADE_ACCEPTED' | 'TRADE_DECLINED' | 'LISTING_SOLD' | 'ASSIGNMENT_CREATED' | 'ASSIGNMENT_DUE_SOON' | 'TEACHER_ASSIGNMENT' | 'CLASSROOM_JOINED' | 'COUNSELOR_LINKED' | 'COUNSELOR_NOTE_ADDED' | 'COUNSELOR_RECOMMENDATION_ADDED' | 'ACTION_ITEM_CREATED' | 'COIN_RECEIVED'
  postId: number | null
  preview: string | null
  read: boolean
  createdAt: string
  sender: FeedUser
}

// ── Educator types ─────────────────────────────────────────────────────────

export interface EducatorClassroom {
  id: number
  name: string
  inviteCode: string
  description: string | null
  _count: { memberships: number }
}

export interface EducatorAssignment {
  id: number
  title: string
  subject: string
  description: string | null
  dueDate: string
}

export interface EducatorClassroomDetail {
  id: number
  name: string
  inviteCode: string
  description: string | null
  memberships: Array<{
    student: { id: number; name: string | null; email: string }
  }>
  assignments: EducatorAssignment[]
}

export interface EducatorStudentProfile {
  id: number
  name: string | null
  email: string
  courses: Array<{ id: number; name: string; grade: { letterGrade: string; percentage: number } | null }>
}

// ── Counselor types ─────────────────────────────────────────────────────────

export interface CounselorStudentProfile {
  gradeLevel: number | null
  graduationYear: number | null
  weightedGpa: number | null
  unweightedGpa: number | null
  satScore: number | null
  actScore: number | null
}

export interface CounselorStudentSummary {
  id: number
  name: string | null
  email: string
  profile: CounselorStudentProfile | null
  unreadCount: number
}

export interface CounselorStudentDetail {
  id: number
  name: string | null
  email: string
  profile: CounselorStudentProfile | null
}

export interface CounselorStudentCourse {
  id: number
  name: string
  teacher: string
  period: number | string
  grade: { letterGrade: string; percentage: number } | null
}

export interface CounselorComment {
  id: number
  body: string
  createdAt: string
  author?: { id: number; name: string | null }
}

export interface CounselorRecommendation {
  id: number
  courseName: string
  courseCode: string | null
  rationale: string | null
  semester: string
  createdAt: string
}

export interface CounselorNote {
  id: number
  body: string
  createdAt: string
  updatedAt: string
}

export interface CounselorActionItem {
  id: number
  title: string
  description: string | null
  dueDate: string | null
  completed: boolean
  createdAt: string
}

export interface CounselorChatMessage {
  id: number
  body: string
  senderId: number | null
  senderName: string | null
  createdAt: string
}

export interface CounselorChatPage {
  messages: CounselorChatMessage[]
  nextCursor: string | null
}

// ── Student classroom + counselor types ────────────────────────────────────

export interface StudentClassroom {
  id: number
  name: string
  description: string | null
  inviteCode: string
  educator: { id: number; name: string | null; email: string }
}

export interface ClassroomAssignment {
  id: number
  title: string
  description: string | null
  subject: string
  dueDate: string
  createdAt: string
}

export interface ClassroomDetail extends StudentClassroom {
  assignments: ClassroomAssignment[]
  memberships: Array<{ id: number; student: { id: number; name: string | null } }>
}

export interface ClassroomPost {
  id: number
  classroomId: number
  body: string
  createdAt: string
  author: {
    id: number
    name: string | null
    tag: string | null
    tagColor: string | null
    nameColor: string | null
    avatarUrl: string | null
  }
}

export interface StudentActionItem {
  id: number
  title: string
  description: string | null
  dueDate: string | null
  completed: boolean
  createdAt: string
}

export interface StudentCounselorNote {
  id: number
  body: string
  createdAt: string
  updatedAt: string
}

export interface StudentCounselorRecommendation {
  id: number
  courseName: string
  courseCode: string | null
  rationale: string | null
  semester: string
  createdAt: string
}

export interface StudentCounselorPortal {
  counselor: { id: number; name: string | null; email: string }
  notes: StudentCounselorNote[]
  recommendations: StudentCounselorRecommendation[]
  actionItems: StudentActionItem[]
}

export interface CounselorLink {
  id: number
  counselorId: number
  studentId: number
  status: string
  createdAt: string
  counselor: { id: number; name: string | null; email: string }
}

// ── Admin educator-request types ───────────────────────────────────────────

export interface EducatorRequest {
  id: number
  requestedRole: 'TEACHER' | 'COUNSELOR'
  institution: string
  status: 'PENDING' | 'APPROVED' | 'DENIED'
  createdAt: string
  user: { id: number; name: string | null; email: string }
}

// ── Review Game types ───────────────────────────────────────────────────────

export interface QuestionInput {
  questionText: string
  questionType: 'MULTIPLE_CHOICE' | 'TRUE_FALSE'
  options: string[]
  correctAnswer: string
  timeLimit?: number
}

export interface Question {
  id: number
  setId: number
  orderIndex: number
  questionText: string
  questionType: 'MULTIPLE_CHOICE' | 'TRUE_FALSE'
  options: string[]
  correctAnswer: string
  timeLimit: number
}

export interface QuestionSet {
  id: number
  creatorId: number
  title: string
  description: string | null
  subject: string | null
  visibility: 'PUBLIC' | 'PRIVATE'
  createdAt: string
  updatedAt: string
  creator: { id: number; name: string | null }
  _count?: { questions: number }
}

export interface QuestionSetWithQuestions extends QuestionSet {
  questions: Question[]
}

export interface GameParticipant {
  id: number
  sessionId: number
  userId: number
  score: number
  joinedAt: string
  user: { id: number; name: string | null; tag: string | null; tagColor: string | null; nameColor: string | null; avatarUrl: string | null }
}

export interface GameSession {
  id: number
  setId: number
  hostId: number
  joinCode: string
  status: 'WAITING' | 'ACTIVE' | 'FINISHED'
  type: 'QUIZ' | 'BATTLE'
  currentQuestion: number
  createdAt: string
  set: {
    title: string
    questions: Array<{ id: number; questionText: string; questionType: string; options: string[]; timeLimit: number; correctAnswer?: string }>
  }
  host: { id: number; name: string | null }
  participants: GameParticipant[]
}

// ── AI Agent types ──────────────────────────────────────────────────────────

export type AgentModule = 'PLANNER' | 'GPA' | 'ROADMAP' | 'CHAT'
export type AgentStatus = 'RUNNING' | 'COMPLETED' | 'FAILED'
export type ToolCallStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'DENIED'

export interface AgentSessionData {
  id: number
  module: AgentModule
  trigger: string
  status: AgentStatus
  toolCallCount: number
  maxToolCalls: number
  userMessage: string | null
  finalResponse: string | null
  startedAt: string
  completedAt: string | null
  errorMessage: string | null
}

export interface AgentToolCallData {
  id: number
  sessionId: number
  toolName: string
  toolInput: Record<string, unknown>
  toolOutput: Record<string, unknown> | null
  status: ToolCallStatus
  executedAt: string | null
  createdAt: string
}
