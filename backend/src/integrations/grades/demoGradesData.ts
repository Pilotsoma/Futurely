// Canned "school portal" data served to the shared demo account
// (test@myfuturely.ai) instead of scraping a real HAC/PowerSchool session —
// there is no real school connection behind this account. Shapes here must
// mirror exactly what hacClient.ts / gradesRouter.ts normally return, since
// the frontend pages are shared between real and demo accounts.
import type { HACClass, HACStudentInfo } from './hacClient'
import type { NormalizedCourse } from './normalizeGrades'

const DEMO_SYSTEM_TYPE = 'HAC'

interface DemoCourse {
  name: string
  teacher: string
  period: string
  average: number
  letterGrade: string
  credits: string
}

const DEMO_COURSES: DemoCourse[] = [
  { name: 'AP English Language', teacher: 'Ms. Rivera',    period: '1', average: 92, letterGrade: 'A-', credits: '1.0' },
  { name: 'AP Calculus BC',      teacher: 'Mr. Johnson',   period: '2', average: 88, letterGrade: 'B+', credits: '1.0' },
  { name: 'U.S. History',        teacher: 'Mr. Williams',  period: '3', average: 95, letterGrade: 'A',  credits: '1.0' },
  { name: 'Spanish III',         teacher: 'Sra. Martinez', period: '4', average: 83, letterGrade: 'B',  credits: '1.0' },
  { name: 'Honors Chemistry',    teacher: 'Dr. Patel',     period: '5', average: 87, letterGrade: 'B+', credits: '1.0' },
  { name: 'Physical Education',  teacher: 'Coach Davis',   period: '6', average: 98, letterGrade: 'A',  credits: '1.0' },
]

function toId(name: string, i: number): string {
  return `demo-${i}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

// The frontend recomputes displayed percentage as (score / totalPoints) * 100
// rather than trusting the `percentage` field, so score must be scaled to
// totalPoints (not left as a 0-100 value) or e.g. a 96/20 pair renders as 480%.
function scaledScore(pct: number, totalPoints: number): number {
  return Math.round((Math.min(100, pct) / 100) * totalPoints)
}

export function demoCurrentGrades(): { systemType: string; grades: NormalizedCourse[] } {
  return {
    systemType: DEMO_SYSTEM_TYPE,
    grades: DEMO_COURSES.map((c, i) => ({
      id: toId(c.name, i),
      name: c.name,
      teacher: c.teacher,
      period: c.period,
      average: c.average,
      letterGrade: c.letterGrade,
      assignments: [
        { name: 'Unit Test', category: 'Major', score: c.average, totalPoints: 100, percentage: `${c.average}`, dateDue: '2025-11-14' },
        { name: 'Homework Set', category: 'Daily', score: scaledScore(c.average + 4, 20), totalPoints: 20, percentage: `${Math.min(100, c.average + 4)}`, dateDue: '2025-11-10' },
      ],
      upcomingAssignments: [
        { name: 'Chapter Quiz', category: 'Minor', score: null, totalPoints: 25, percentage: '', dateDue: '2025-11-21' },
      ],
    })),
  }
}

export function demoClasswork(): { classes: HACClass[]; availablePeriods: string[]; currentPeriod: string } {
  const classes: HACClass[] = DEMO_COURSES.map(c => ({
    name: c.name,
    period: c.period,
    teacher: c.teacher,
    room: `Rm ${100 + Number(c.period)}`,
    average: String(c.average),
    categoryWeights: { Daily: 0.4, Minor: 0.3, Major: 0.3 },
    scores: [
      { name: 'Unit Test', category: 'Major', score: c.average, totalPoints: 100, percentage: `${c.average}`, dateDue: '2025-11-14' },
      { name: 'Homework Set', category: 'Daily', score: scaledScore(c.average + 4, 20), totalPoints: 20, percentage: `${Math.min(100, c.average + 4)}`, dateDue: '2025-11-10' },
      { name: 'Chapter Quiz', category: 'Minor', score: null, totalPoints: 25, percentage: '', dateDue: '2025-11-21' },
    ],
  }))
  return { classes, availablePeriods: DEMO_COURSES.map(c => c.period), currentPeriod: DEMO_COURSES[0].period }
}

export function demoTranscript(): {
  semesters: Array<{ year: string; semester: string; courses: Array<{ name: string; grade: string; credits: string }> }>
  cumulativeGPA: string
  weightedGPA: string
  unweightedGPA: string
  classRank: string
  quartile: string
} {
  const courses = DEMO_COURSES.map(c => ({ name: c.name, grade: c.letterGrade, credits: c.credits }))
  return {
    semesters: [
      { year: '2025-2026', semester: 'Fall', courses },
      { year: '2024-2025', semester: 'Spring', courses },
    ],
    cumulativeGPA: '3.75',
    weightedGPA: '3.90',
    unweightedGPA: '3.60',
    classRank: '42/310',
    quartile: '1',
  }
}

export function demoGpa(): { gpa: number; unweightedGpa: number; weightedGpa: number; courseCount: number; systemType: string } {
  return { gpa: 3.6, unweightedGpa: 3.6, weightedGpa: 3.9, courseCount: DEMO_COURSES.length, systemType: DEMO_SYSTEM_TYPE }
}

export function demoStudentInfo(): HACStudentInfo {
  return {
    name: 'Test, Student',
    grade: '12',
    school: 'Futurely Demo High School',
    district: 'Futurely Demo ISD',
    counselor: 'Ms. Ortiz (Demo)',
    cohortYear: String(new Date().getFullYear() + 1),
  }
}

export function demoSchedule(): Array<Record<string, string>> {
  return DEMO_COURSES.map(c => ({
    Period: c.period,
    Course: c.name,
    Teacher: c.teacher,
    Room: `Rm ${100 + Number(c.period)}`,
    Days: 'A Day',
    Semester: 'Full Year',
  }))
}

export function demoReportCard(): {
  reportingPeriods: string[]
  currentPeriod: string
  semesters: {
    sem1: Array<{ name: string; period: string; numericGrade: string; letterGrade: string; credits: string; teacher: string }>
    sem2: Array<{ name: string; period: string; numericGrade: string; letterGrade: string; credits: string; teacher: string }>
  }
} {
  const sem = (bump: number) => DEMO_COURSES.map(c => ({
    name: c.name,
    period: c.period,
    numericGrade: String(Math.min(100, c.average + bump)),
    letterGrade: c.letterGrade,
    credits: c.credits,
    teacher: c.teacher,
  }))
  return {
    reportingPeriods: ['1st Semester', '2nd Semester'],
    currentPeriod: '1st Semester',
    semesters: { sem1: sem(0), sem2: sem(1) },
  }
}

export function demoProgressReport(): {
  availableDates: string[]
  currentDate: string
  courses: Array<{ name: string; period: string; average: string; letterGrade: string; teacher: string }>
} {
  const currentDate = '11/14/2025'
  return {
    availableDates: [currentDate, '10/17/2025', '09/19/2025'],
    currentDate,
    courses: DEMO_COURSES.map(c => ({ name: c.name, period: c.period, average: String(c.average), letterGrade: c.letterGrade, teacher: c.teacher })),
  }
}

export function demoAttendance(): {
  month: string
  year: number
  monthIndex: number
  days: Array<{ date: string; dayOfWeek: string; dayNum: number; bgColor: string; description: string; isSchoolClosed: boolean; periods: Array<{ period: string; status: string }> }>
  summary: { absences: number; excused: number; tardies: number; multiple: number }
} {
  const now = new Date()
  return {
    month: now.toLocaleString('en-US', { month: 'long' }),
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
    days: [
      { date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-05`, dayOfWeek: 'Wed', dayNum: 5, bgColor: '#FBBF24', description: 'Tardy', isSchoolClosed: false, periods: [{ period: '1', status: 'Tardy' }] },
      { date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-12`, dayOfWeek: 'Wed', dayNum: 12, bgColor: '#4ADE80', description: 'Present', isSchoolClosed: false, periods: [] },
    ],
    summary: { absences: 1, excused: 2, tardies: 1, multiple: 0 },
  }
}

export function demoContactTeachers(): {
  teachers: Array<{ name: string; email: string; room: string; building: string; courses: Array<{ courseName: string; period: string }> }>
} {
  return {
    teachers: DEMO_COURSES.map(c => ({
      name: c.teacher,
      email: `${c.teacher.split(' ').pop()?.toLowerCase()}@futurelydemoisd.edu`,
      room: `Rm ${100 + Number(c.period)}`,
      building: 'Main Building',
      courses: [{ courseName: c.name, period: c.period }],
    })),
  }
}

export function demoStatus(): { connected: boolean; systemType: string; districtUrl: string; lastSynced: string; sessionExpiresIn: number } {
  return {
    connected: true,
    systemType: DEMO_SYSTEM_TYPE,
    districtUrl: 'https://demo.myfuturely.ai/',
    lastSynced: new Date().toISOString(),
    sessionExpiresIn: 3600,
  }
}

export function demoSyncStatus(): { status: string; lastSyncedAt: string; errorMessage: null; consecutiveSyncFailures: number; portalDown: boolean } {
  return { status: 'idle', lastSyncedAt: new Date().toISOString(), errorMessage: null, consecutiveSyncFailures: 0, portalDown: false }
}

export function demoSyncProfile(): {
  synced: boolean
  name: string
  profile: {
    id: number
    userId: number
    gradeLevel: number
    graduationYear: number
    weightedGpa: number
    unweightedGpa: number
    futureDecision: string | null
    satScore: number | null
    actScore: number | null
    counselorName: string
  }
  studentInfo: HACStudentInfo
} {
  return {
    synced: true,
    name: 'Test, Student',
    profile: {
      id: 0,
      userId: 0,
      gradeLevel: 12,
      graduationYear: new Date().getFullYear() + 1,
      weightedGpa: 3.9,
      unweightedGpa: 3.6,
      futureDecision: null,
      satScore: null,
      actScore: null,
      counselorName: 'Ms. Ortiz (Demo)',
    },
    studentInfo: demoStudentInfo(),
  }
}
