import { expect, test as base, type Page, type Route } from '@playwright/test'

const now = new Date()

/** Local noon, `offsetDays` from today, as an ISO timestamp. */
const dayAtNoon = (offsetDays: number): string => {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  date.setHours(12, 0, 0, 0)
  return date.toISOString()
}

const todayAtNoon = (): string => dayAtNoon(0)

/** "YYYY-MM-DD" for a local date. */
const dateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** "MM/DD/YYYY", the format HAC prints for progress report dates. */
const usDate = (date: Date): string =>
  `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`

const daysAgo = (days: number): Date => {
  const date = new Date(now)
  date.setDate(date.getDate() - days)
  return date
}

// The US school year runs August to May. From August on we are in the school
// year that ends next calendar year, so an 11th grader in Nov 2026 is Class of 2028.
const GRADE_LEVEL = 11
const schoolYearEnd = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear()
const schoolYearStart = schoolYearEnd - 1
const graduationYear = schoolYearEnd + (12 - GRADE_LEVEL)
const schoolYear = (yearsBack: number): string =>
  `${schoolYearStart - yearsBack}-${schoolYearEnd - yearsBack}`

const authUser = {
  id: 1,
  email: 'student@example.test',
  name: 'Avery Student',
  role: 'STUDENT',
  emailVerified: true,
  accountStatus: 'ACTIVE',
  bannedUntilDate: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  dobCorrectionAttempts: 0,
  hasSchoolConnection: true,
  hasSchoolRecord: true,
}

// One row per class; the grades, classwork, schedule, report card, progress
// report and teacher payloads below are all derived from it so they agree.
const courseRows = [
  { id: 'course-1', name: 'AP Biology', teacher: 'Dr. Rivera', period: '1', room: 'Rm 214', average: 93.5, letterGrade: 'A', credits: '1.0' },
  { id: 'course-2', name: 'English III', teacher: 'Ms. Brooks', period: '2', room: 'Rm 108', average: 88, letterGrade: 'B', credits: '1.0' },
  { id: 'course-3', name: 'AP U.S. History', teacher: 'Mr. Williams', period: '3', room: 'Rm 121', average: 91, letterGrade: 'A', credits: '1.0' },
  { id: 'course-4', name: 'Pre-Calculus', teacher: 'Mrs. Patel', period: '4', room: 'Rm 302', average: 86.5, letterGrade: 'B', credits: '1.0' },
  { id: 'course-5', name: 'Spanish III', teacher: 'Sra. Martinez', period: '5', room: 'Rm 117', average: 95, letterGrade: 'A', credits: '1.0' },
  { id: 'course-6', name: 'Physical Education', teacher: 'Coach Davis', period: '6', room: 'Gym', average: 98, letterGrade: 'A', credits: '0.5' },
]

const courses = courseRows.map((course) => ({
  id: course.id,
  name: course.name,
  teacher: course.teacher,
  period: course.period,
  average: course.average,
  letterGrade: course.letterGrade,
  assignments: [],
  upcomingAssignments: [],
}))

const classwork = {
  classes: courseRows.map((course) => ({
    name: course.name,
    period: course.period,
    teacher: course.teacher,
    room: course.room,
    average: String(course.average),
    letterGrade: course.letterGrade,
    categoryWeights: { Daily: 0.4, Minor: 0.3, Major: 0.3 },
    scores: [
      { name: 'Unit Test', category: 'Major', score: Math.round(course.average), totalPoints: 100, percentage: String(Math.round(course.average)), dateDue: dateKey(daysAgo(6)) },
      { name: 'Homework Set', category: 'Daily', score: Math.round(course.average * 0.2), totalPoints: 20, percentage: String(Math.round(course.average)), dateDue: dateKey(daysAgo(2)) },
    ],
  })),
  availablePeriods: courseRows.map((course) => course.period),
  currentPeriod: courseRows[0].period,
}

const schedule = courseRows.map((course) => ({
  Period: course.period,
  Course: course.name,
  Teacher: course.teacher,
  Room: course.room,
  Days: 'A Day',
  Semester: 'Full Year',
}))

const reportCard = {
  reportingPeriods: ['1st Semester', '2nd Semester'],
  currentPeriod: '1st Semester',
  semesters: {
    sem1: courseRows.map((course) => ({
      name: course.name,
      period: course.period,
      numericGrade: String(course.average),
      letterGrade: course.letterGrade,
      credits: course.credits,
      teacher: course.teacher,
    })),
    sem2: courseRows.map((course) => ({
      name: course.name,
      period: course.period,
      numericGrade: String(Math.min(100, course.average + 1)),
      letterGrade: course.letterGrade,
      credits: course.credits,
      teacher: course.teacher,
    })),
  },
}

const progressReport = {
  availableDates: [usDate(daysAgo(5)), usDate(daysAgo(33)), usDate(daysAgo(61))],
  currentDate: usDate(daysAgo(5)),
  courses: courseRows.map((course) => ({
    name: course.name,
    period: course.period,
    average: String(course.average),
    letterGrade: course.letterGrade,
    teacher: course.teacher,
  })),
}

const contactTeachers = {
  teachers: courseRows.map((course) => ({
    name: course.teacher,
    email: `${course.teacher.split(' ').pop()?.toLowerCase()}@school.example.test`,
    room: course.room,
    building: 'Main Building',
    courses: [{ courseName: course.name, period: course.period }],
  })),
}

const sophomoreCourses = [
  { name: 'Biology', grade: 'A', credits: '1.0' },
  { name: 'English II', grade: 'A', credits: '1.0' },
  { name: 'Geometry', grade: 'B', credits: '1.0' },
  { name: 'World History', grade: 'A', credits: '1.0' },
  { name: 'Spanish II', grade: 'A', credits: '1.0' },
  { name: 'Health', grade: 'A', credits: '0.5' },
]

const freshmanCourses = [
  { name: 'Algebra I', grade: 'B', credits: '1.0' },
  { name: 'English I', grade: 'A', credits: '1.0' },
  { name: 'Earth Science', grade: 'A', credits: '1.0' },
  { name: 'Geography', grade: 'B', credits: '1.0' },
  { name: 'Spanish I', grade: 'A', credits: '1.0' },
  { name: 'Physical Education', grade: 'A', credits: '0.5' },
]

// Only completed semesters appear on a transcript, so the current school year is absent.
const transcript = {
  semesters: [
    { year: schoolYear(1), semester: 'Spring', courses: sophomoreCourses },
    { year: schoolYear(1), semester: 'Fall', courses: sophomoreCourses },
    { year: schoolYear(2), semester: 'Spring', courses: freshmanCourses },
    { year: schoolYear(2), semester: 'Fall', courses: freshmanCourses },
  ],
  cumulativeGPA: '3.875',
  weightedGPA: '4.125',
  unweightedGPA: '3.875',
  classRank: '58/412',
  quartile: '1',
}

/** The first weekday (Mon to Fri) on or after `day` in the given month. */
function weekdayOnOrAfter(year: number, monthIndex: number, day: number): number {
  let current = day
  while ([0, 6].includes(new Date(year, monthIndex, current).getDay())) current += 1
  return current
}

function attendanceFor(monthOffset: number) {
  const first = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const year = first.getFullYear()
  const monthIndex = first.getMonth()
  const entry = (day: number, bgColor: string, description: string, periods: { period: string; status: string }[]) => {
    const date = new Date(year, monthIndex, day)
    return {
      date: dateKey(date),
      dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: day,
      bgColor,
      description,
      isSchoolClosed: false,
      periods,
    }
  }
  const tardyDay = weekdayOnOrAfter(year, monthIndex, 4)
  const absentDay = weekdayOnOrAfter(year, monthIndex, 9)
  const presentDay = weekdayOnOrAfter(year, monthIndex, 12)
  return {
    month: first.toLocaleDateString('en-US', { month: 'long' }),
    year,
    monthIndex,
    days: [
      entry(tardyDay, '#FBBF24', 'Tardy', [{ period: '1', status: 'Tardy' }]),
      entry(absentDay, '#F87171', 'Excused absence', [
        { period: '1', status: 'Excused' },
        { period: '2', status: 'Excused' },
      ]),
      entry(presentDay, '#4ADE80', 'Present', []),
    ],
    summary: { absences: 0, excused: 1, tardies: 1, multiple: 0 },
  }
}

const assignment = {
  id: 101,
  userId: 1,
  title: 'Biology lab reflection',
  subject: 'AP Biology',
  dueDate: todayAtNoon(),
  dueTime: '15:30',
  estimatedMinutes: 30,
  completed: false,
  completedAt: null,
  source: 'Canvas',
  priority: 'HIGH',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const assignmentTomorrow = {
  id: 102,
  userId: 1,
  title: 'English III essay outline',
  subject: 'English III',
  dueDate: dayAtNoon(1),
  dueTime: '23:59',
  estimatedMinutes: 45,
  completed: false,
  completedAt: null,
  source: 'Canvas',
  priority: 'MEDIUM',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const assignmentLater = {
  id: 103,
  userId: 1,
  title: 'Pre-Calculus chapter 4 quiz',
  subject: 'Pre-Calculus',
  dueDate: dayAtNoon(4),
  dueTime: '08:15',
  estimatedMinutes: 25,
  completed: false,
  completedAt: null,
  source: 'Manual',
  priority: 'LOW',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

// Keep id 101 first: the dashboard and planner specs open it directly.
const assignments = [assignment, assignmentTomorrow, assignmentLater]

const student = {
  id: 1,
  email: authUser.email,
  name: authUser.name,
  role: authUser.role,
  hasPassword: true,
  profile: {
    id: 1,
    userId: 1,
    gradeLevel: GRADE_LEVEL,
    graduationYear,
    weightedGpa: 4.125,
    unweightedGpa: 3.875,
    futureDecision: 'Computer science',
    satScore: 1280,
    actScore: 29,
    counselorName: 'Jordan Lee',
  },
  courses: [],
  assignments,
  stats: {
    totalCourses: courseRows.length,
    completedAssignments: 4,
    pendingAssignments: assignments.length,
    assignmentsDueToday: 1,
    assignmentsDueThisWeek: assignments.length,
  },
}

const questionSetBase = {
  creatorId: 1,
  visibility: 'PRIVATE' as const,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  creator: { id: 1, name: authUser.name },
}

const studySets = [
  {
    ...questionSetBase,
    id: 11,
    title: 'AP Biology: cell structure',
    description: 'Organelles and membrane transport',
    subject: 'Biology',
    _count: { questions: 3 },
  },
  {
    ...questionSetBase,
    id: 12,
    title: 'Pre-Calculus: trig identities',
    description: 'Unit circle and identity practice',
    subject: 'Math',
    _count: { questions: 3 },
  },
]

const setQuestions: Record<number, { questionText: string; options: string[]; correctAnswer: string }[]> = {
  11: [
    { questionText: 'Which organelle makes most of the cell\'s ATP?', options: ['Nucleus', 'Mitochondrion', 'Golgi apparatus', 'Ribosome'], correctAnswer: '1' },
    { questionText: 'The cell membrane is selectively permeable.', options: ['True', 'False'], correctAnswer: '0' },
    { questionText: 'Where does protein synthesis take place?', options: ['Ribosome', 'Lysosome', 'Vacuole', 'Centriole'], correctAnswer: '0' },
  ],
  12: [
    { questionText: 'sin^2(x) + cos^2(x) equals what?', options: ['0', '1', '2', 'tan(x)'], correctAnswer: '1' },
    { questionText: 'tan(x) is sin(x) divided by cos(x).', options: ['True', 'False'], correctAnswer: '0' },
    { questionText: 'What is cos(0)?', options: ['0', '1', '-1', 'undefined'], correctAnswer: '1' },
  ],
}

function questionSetWithQuestions(id: number) {
  const set = studySets.find((item) => item.id === id)
  if (!set) return null
  return {
    ...set,
    questions: (setQuestions[id] ?? []).map((question, index) => ({
      id: id * 100 + index + 1,
      setId: id,
      orderIndex: index,
      questionType: question.options.length === 2 ? 'TRUE_FALSE' : 'MULTIPLE_CHOICE',
      timeLimit: 20,
      ...question,
    })),
  }
}

const feedUser = (id: number, name: string) => ({
  id,
  name,
  hacName: null,
  tag: null,
  tagColor: null,
  nameColor: null,
  avatarEffect: null,
  badge: null,
  avatarUrl: null,
})

const feedPosts = [
  {
    id: 301,
    userId: 2,
    body: 'Does anyone have a good way to remember the stages of mitosis? Unit 4 test is on Friday.',
    network: 'global',
    type: null,
    pinnedUntil: null,
    createdAt: dayAtNoon(-1),
    user: feedUser(2, 'Maya Chen'),
    likedByMe: false,
    _count: { likes: 6, comments: 2 },
  },
  {
    id: 302,
    userId: 3,
    body: 'I turned my chemistry notes into a study set and quiz myself in game mode. Worth trying before finals.',
    network: 'global',
    type: null,
    pinnedUntil: null,
    createdAt: dayAtNoon(-2),
    user: feedUser(3, 'Jordan Reyes'),
    likedByMe: true,
    _count: { likes: 11, comments: 0 },
  },
]

const colleges = [
  {
    id: 501,
    name: 'Texas A&M University',
    scorecardUnitId: '228723',
    createdAt: '2026-09-15T00:00:00.000Z',
    unitId: '228723',
    city: 'College Station',
    state: 'TX',
    admissionRate: 0.63,
    sat25th: 1160,
    sat75th: 1400,
    score: 81,
    label: 'Likely',
  },
  {
    id: 502,
    name: 'University of Texas at Austin',
    scorecardUnitId: '228778',
    createdAt: '2026-09-16T00:00:00.000Z',
    unitId: '228778',
    city: 'Austin',
    state: 'TX',
    admissionRate: 0.29,
    sat25th: 1230,
    sat75th: 1480,
    score: 58,
    label: 'Possible',
  },
  {
    id: 503,
    name: 'Stanford University',
    scorecardUnitId: '243744',
    createdAt: '2026-09-17T00:00:00.000Z',
    unitId: '243744',
    city: 'Stanford',
    state: 'CA',
    admissionRate: 0.04,
    sat25th: 1500,
    sat75th: 1570,
    score: 22,
    label: 'Far Reach',
  },
]

export interface MockApi {
  requests: { method: string; path: string; body: unknown }[]
  gpa: {
    gpa: number | null
    unweightedGpa: number | null
    weightedGpa: number | null
    courseCount: number
    systemType: 'HAC'
  }
  failProfileSave: boolean
  aiDelayMs: number
}

type Fixtures = { mockApi: MockApi }

function json(route: Route, data: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(status >= 400 ? data : { data }),
  })
}

async function installApiMock(page: Page, state: MockApi): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('futurely.accessToken', 'e2e-access-token')
    window.localStorage.setItem('futurely.refreshToken', 'e2e-refresh-token')
  })

  await page.route('http://localhost:3001/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    let body: unknown = null
    try {
      body = request.postDataJSON()
    } catch {
      body = request.postData()
    }
    state.requests.push({ method, path, body })

    if (path === '/auth/me') return json(route, authUser)
    if (path === '/auth/logout' && method === 'POST') {
      return route.fulfill({ status: 204, body: '' })
    }
    if (path === '/integrations/grades/status') {
      return json(route, {
        connected: true,
        systemType: 'HAC',
        districtUrl: 'https://school.example.test',
        lastSynced: '2026-08-01T12:00:00.000Z',
        sessionExpiresIn: 3600,
      })
    }
    if (path === '/students/me' && method === 'GET') return json(route, student)
    if (path === '/students/me/profile' && method === 'PATCH') {
      if (state.failProfileSave) {
        return json(route, { data: null, error: { code: 'SAVE_FAILED', message: 'Profile save rejected by test server.' } }, 500)
      }
      const update = (body ?? {}) as Record<string, unknown>
      Object.assign(student.profile, update)
      return json(route, student.profile)
    }
    if (path === '/students/counselor-links/active') return json(route, [])
    if (path === '/integrations/grades/gpa') return json(route, state.gpa)
    if (path === '/integrations/grades/current') {
      return json(route, { systemType: 'HAC', grades: courses })
    }
    if (path === '/integrations/grades/sync-profile' && method === 'POST') {
      state.gpa.unweightedGpa = 3.925
      state.gpa.weightedGpa = 4.175
      state.gpa.gpa = 3.925
      return json(route, { synced: true, systemType: 'HAC' })
    }
    if (path === '/assignments') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: assignments,
          meta: { nextCursor: null, hasNextPage: false, count: assignments.length },
        }),
      })
    }
    // Row actions succeed without mutating the shared fixture, so tests stay independent.
    const assignmentAction = /^\/assignments\/(\d+)(\/complete)?$/.exec(path)
    if (assignmentAction) {
      const target = assignments.find((item) => item.id === Number(assignmentAction[1]))
      if (target && method === 'DELETE') return json(route, { deleted: true })
      if (target && method === 'PATCH' && assignmentAction[2]) {
        const completed = Boolean((body as { completed?: boolean } | null)?.completed)
        return json(route, { ...target, completed })
      }
    }
    if (path === '/ai/chat' && method === 'POST') {
      if (state.aiDelayMs) await new Promise((resolve) => setTimeout(resolve, state.aiDelayMs))
      const message = (body as { message?: string } | null)?.message ?? ''
      return json(route, { reply: `Test coach reply for: ${message}` })
    }
    if (path === '/integrations/canvas/status') {
      return json(route, {
        connected: false,
        canvasInstanceUrl: null,
        canvasUserName: null,
        lastSynced: null,
        connections: [],
      })
    }
    if (path === '/integrations/grades/classwork') return json(route, classwork)
    if (path === '/integrations/grades/transcript') {
      return json(route, { systemType: 'HAC', transcript })
    }
    if (path === '/integrations/grades/schedule') return json(route, { schedule })
    if (path === '/integrations/grades/attendance') {
      const requestedOffset = Number(url.searchParams.get('monthOffset') ?? 0)
      return json(route, attendanceFor(Number.isInteger(requestedOffset) ? requestedOffset : 0))
    }
    if (path === '/integrations/grades/report-card') return json(route, reportCard)
    if (path === '/integrations/grades/progress-report') return json(route, progressReport)
    if (path === '/integrations/grades/contact-teachers') return json(route, contactTeachers)
    if (path.startsWith('/integrations/grades/')) return json(route, {})
    if (path === '/sets' && method === 'GET') return json(route, studySets)
    const setMatch = /^\/sets\/(\d+)$/.exec(path)
    if (setMatch && method === 'GET') {
      const found = questionSetWithQuestions(Number(setMatch[1]))
      if (found) return json(route, found)
    }
    if (path === '/feed/posts' && method === 'GET') {
      return json(route, { posts: feedPosts, total: feedPosts.length, page: 1, pageSize: 20, hasMore: false })
    }
    if (path === '/feed/posts/following' && method === 'GET') {
      return json(route, { posts: [], total: 0, page: 1, pageSize: 20, hasMore: false })
    }
    if (path === '/colleges' && method === 'GET') return json(route, colleges)
    if (path === '/roadmap') {
      return json(route, {
        gradeLevel: GRADE_LEVEL,
        graduationYear,
        creditsCompleted: 18,
        creditsRequired: 24,
        percentComplete: 75,
        creditsByCategory: { English: 4, Math: 4, Science: 3, 'Social Studies': 3, Electives: 4 },
        milestones: [
          { grade: 9, label: 'Build strong foundations', done: true },
          { grade: 10, label: 'Explore academic interests', done: true },
          { grade: 11, label: 'Prepare for college applications', done: false },
          { grade: 12, label: 'Complete graduation requirements', done: false },
        ],
        weightedGpa: state.gpa.weightedGpa,
        unweightedGpa: state.gpa.unweightedGpa,
        futureDecision: null,
      })
    }

    return json(route, { data: null, error: { code: 'E2E_UNHANDLED', message: `Unhandled E2E route: ${method} ${path}` } }, 404)
  })
}

export const test = base.extend<Fixtures>({
  mockApi: [
    async ({ page }, use) => {
      const state: MockApi = {
        requests: [],
        gpa: {
          gpa: 3.875,
          unweightedGpa: 3.875,
          weightedGpa: 4.125,
          courseCount: courseRows.length,
          systemType: 'HAC',
        },
        failProfileSave: false,
        aiDelayMs: 0,
      }
      await installApiMock(page, state)
      await use(state)
    },
    { auto: true },
  ],
})

export { expect }
