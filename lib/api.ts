const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

// Access token stored in module memory only — never persisted to localStorage.
// Set by authState.setWebLogin() after login/register; cleared on logout.
// httpOnly cookies carry the refresh token; the backend also reads access_token cookie.
let _apiToken: string | null = null
export function setApiToken(token: string | null): void { _apiToken = token }
export function getApiToken(): string | null { return _apiToken }
export function clearApiToken(): void { _apiToken = null }

export class ApiError extends Error {
  code?: string
  secondsRemaining?: number
  constructor(message: string, code?: string, secondsRemaining?: number) {
    super(message)
    this.code = code
    this.secondsRemaining = secondsRemaining
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = _apiToken
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',  // sends httpOnly cookies (access_token, refresh_token) automatically
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string | { message?: string; code?: string }; secondsRemaining?: number }
    const msg  = typeof body?.error === 'string' ? body.error : body?.error?.message
    const code = typeof body?.error === 'object' ? body?.error?.code : undefined
    throw new ApiError(msg ?? `HTTP ${res.status}`, code, body.secondsRemaining)
  }
  const { data } = await res.json() as { data: T }
  return data
}

interface LoginResult {
  token: string
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
  register: (email: string, password: string, otp: string, name?: string, role?: string) =>
    request<LoginResult>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, otp, name, role }),
    }),
  login: (email: string, password: string) =>
    request<LoginResult>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
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
  roadmap: () => request<{
    gradeLevel: number
    creditsCompleted: number
    creditsRequired: number
    percentComplete: number
    weightedGpa: number
    unweightedGpa: number
    futureDecision: string | null
  }>('/api/roadmap'),
  chat: (message: string) =>
    request<{ reply: string }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
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
  }>('/api/ai/study-plan'),

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

  feedPosts: (page = 1, limit = 20) =>
    request<{
      posts: FeedPost[]
      total: number
      page: number
      pageSize: number
      hasMore: boolean
    }>(`/api/feed/posts?page=${page}&limit=${limit}`),

  feedFollowingPosts: (page = 1, limit = 20) =>
    request<{
      posts: FeedPost[]
      total: number
      page: number
      pageSize: number
      hasMore: boolean
    }>(`/api/feed/posts/following?page=${page}&limit=${limit}`),

  feedCreatePost: (body: string) =>
    request<FeedPost>('/api/feed/posts', {
      method: 'POST',
      body: JSON.stringify({ body }),
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

  plannerCreate: (item: { title: string; subject?: string; dueDate: string; dueTime?: string }) =>
    request<PlannerItem>('/api/assignments', {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  plannerToggle: (id: number, completed: boolean) =>
    request<PlannerItem>(`/api/assignments/${id}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),

  plannerDelete: (id: number) =>
    request<{ deleted: boolean }>(`/api/assignments/${id}`, {
      method: 'DELETE',
    }),

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

  collegeAdd: (name: string) =>
    request<CollegeListItem>('/api/colleges', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  collegeRemove: (id: number) =>
    request<{ deleted: boolean }>(`/api/colleges/${id}`, { method: 'DELETE' }),

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

  marketplaceInventory: () =>
    request<InventoryData>('/api/marketplace/inventory'),

  marketplaceOpenBox: (boxType: string, quantity = 1) =>
    request<BoxResult & { results?: Array<{ won: BoxResult['won']; alreadyHad: boolean }> }>('/api/marketplace/open-box', { method: 'POST', body: JSON.stringify({ boxType, quantity }) }),

  marketplaceQuicksell: (itemType: 'tag' | 'name-color' | 'pfp', itemId: string) =>
    request<{ coins: number; payout: number }>('/api/marketplace/quicksell', {
      method: 'POST',
      body: JSON.stringify({ itemType, itemId }),
    }),

  marketplaceQuicksellDuplicates: (exclude: string[] = []) =>
    request<{ coins: number; sold: number; totalPayout: number }>('/api/marketplace/quicksell/duplicates', { method: 'POST', body: JSON.stringify({ exclude }), headers: { 'Content-Type': 'application/json' } }),

  marketplaceEquip: (type: 'name-color' | 'pfp' | 'tag', itemId: string | null) =>
    request<{ nameColor?: string | null; pfpEffect?: string | null }>('/api/marketplace/equip', {
      method: 'PUT',
      body: JSON.stringify({ type, itemId }),
    }),

  marketplaceAdminGrant: (payload: { type: 'coins'; amount: number } | { type: 'name-color' | 'pfp' | 'tag'; itemId: string }) =>
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

  marketplaceCreateTrade: (payload: { receiverId: number; senderItems: TradeItem[]; receiverItems: TradeItem[] }) =>
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
    request<ItemOwner[]>(`/api/marketplace/item/${itemType}/${encodeURIComponent(itemId)}/owners`),

  marketplaceLeaderboard: () =>
    request<LeaderboardData>('/api/marketplace/leaderboard'),

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
    }),

  adminStats: () =>
    request<{ totalUsers: number; activeUsers: number; liveUsers: number }>('/api/marketplace/admin/stats'),
}

// ── Planner types ─────────────────────────────────────────────────────────

export interface PlannerItem {
  id: number
  title: string
  subject: string | null
  dueDate: string
  dueTime: string | null
  completed: boolean
  completedAt: string | null
  userId: number
  source?: string
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
  pfpEffect: string | null
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
  pfpEffect: string | null
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
  coins: number
  canClaimToday: boolean
  tag: string | null
  tagColor: string | null
  nameColor: string | null
  pfpEffect: string | null
  ownedTags: TagInventoryItem[]
  ownedNameColors: MarketplaceItem[]
  ownedPfpEffects: MarketplaceItem[]
}

export interface BoxResult {
  coins: number
  won: { id: string; name?: string; tag?: string; tagColor?: string; value?: string; rarity: string; type: string }
  alreadyHad: boolean
}

export interface TradeItem {
  type: 'tag' | 'name-color' | 'pfp'
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
  seller: { id: number; name: string | null; tag: string | null; tagColor: string | null; nameColor: string | null }
}

export interface TradeOffer {
  id: number
  senderId: number
  receiverId: number
  senderItems: TradeItem[]
  receiverItems: TradeItem[]
  status: string
  createdAt: string
  sender: { id: number; name: string | null; tag: string | null; tagColor: string | null; nameColor: string | null }
  receiver: { id: number; name: string | null; tag: string | null; tagColor: string | null; nameColor: string | null }
}

export interface UserPublicInventory {
  user: { id: number; name: string | null; tag: string | null; tagColor: string | null; nameColor: string | null }
  tags: TagInventoryItem[]
  nameColors: MarketplaceItem[]
  pfpEffects: MarketplaceItem[]
}

export interface ItemSalePoint { price: number; soldAt: string }

export interface ItemOwner {
  rank: number; id: number; name: string | null
  tag: string | null; tagColor: string | null; nameColor: string | null; pfpEffect: string | null
}

export interface LeaderboardEntry {
  rank: number; id: number; name: string | null
  tag: string | null; tagColor: string | null; nameColor: string | null; pfpEffect: string | null; value: number
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
  userId: number
  name: string
  createdAt: string
}

export interface AppNotification {
  id: number
  userId: number
  fromUserId: number
  type: 'FOLLOW' | 'LIKE' | 'COMMENT' | 'GIVEAWAY_WIN' | 'TRADE_OFFER' | 'TRADE_ACCEPTED' | 'TRADE_DECLINED' | 'LISTING_SOLD' | 'ASSIGNMENT_CREATED'
  postId: number | null
  preview: string | null
  read: boolean
  createdAt: string
  sender: FeedUser
}
