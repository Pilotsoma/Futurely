import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { ASSIGNMENT_SOURCE } from '../constants/assignmentSource'

// Public, shared login for anyone evaluating the product without a real HAC
// account. Credentials are intentionally not secret — do not treat this
// account as privileged, and never store real student data on it.
export const DEMO_ACCOUNT_EMAIL = 'test@myfuturely.ai'
const DEMO_ACCOUNT_PASSWORD = 'Futurely123'
const DEMO_SEMESTER = '2025-FA'

interface DemoCourseDef {
  name: string
  teacher: string
  period: number
  courseType: string
  creditHours: number
  letterGrade: string
  percentage: number
}

const DEMO_COURSES: DemoCourseDef[] = [
  { name: 'AP English Language', teacher: 'Ms. Rivera',    period: 1, courseType: 'AP',       creditHours: 1.0, letterGrade: 'A-', percentage: 92.0 },
  { name: 'AP Calculus BC',      teacher: 'Mr. Johnson',   period: 2, courseType: 'AP',       creditHours: 1.0, letterGrade: 'B+', percentage: 88.0 },
  { name: 'U.S. History',        teacher: 'Mr. Williams',  period: 3, courseType: 'STANDARD', creditHours: 1.0, letterGrade: 'A',  percentage: 95.0 },
  { name: 'Spanish III',         teacher: 'Sra. Martinez', period: 4, courseType: 'STANDARD', creditHours: 1.0, letterGrade: 'B',  percentage: 83.0 },
  { name: 'Honors Chemistry',    teacher: 'Dr. Patel',     period: 5, courseType: 'HONORS',   creditHours: 1.0, letterGrade: 'B+', percentage: 87.0 },
  { name: 'Physical Education',  teacher: 'Coach Davis',   period: 6, courseType: 'STANDARD', creditHours: 1.0, letterGrade: 'A',  percentage: 98.0 },
]

function due(offsetDays: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  d.setHours(23, 59, 0, 0)
  return d
}

interface DemoAssignmentDef {
  title: string
  subject: string
  dueDate: Date
  estimatedMinutes: number
  completed?: boolean
}

const DEMO_ASSIGNMENTS: DemoAssignmentDef[] = [
  { title: 'Problem Set 7 — Integration by Parts',         subject: 'AP Calculus BC',      dueDate: due(-3),  estimatedMinutes: 90,  completed: true },
  { title: 'Hamlet Act IV Essay Draft',                    subject: 'AP English Language', dueDate: due(-1),  estimatedMinutes: 120 },
  { title: 'Cell Division Lab Report',                     subject: 'Honors Chemistry',    dueDate: due(0),   estimatedMinutes: 60 },
  { title: 'WWII Primary Source Analysis',                 subject: 'U.S. History',        dueDate: due(0),   estimatedMinutes: 45 },
  { title: 'Verb Conjugation Quiz Prep — Subjunctive Mood', subject: 'Spanish III',         dueDate: due(1),   estimatedMinutes: 30 },
  { title: 'Recursion Practice Problems',                  subject: 'AP Calculus BC',      dueDate: due(3),   estimatedMinutes: 75 },
  { title: 'Battle of Midway — Cause & Effect Analysis',   subject: 'U.S. History',        dueDate: due(5),   estimatedMinutes: 90 },
  { title: 'Final Exam Study Guide',                       subject: 'AP Calculus BC',      dueDate: due(14),  estimatedMinutes: 180 },
  { title: 'College Essay Rough Draft',                    subject: 'AP English Language', dueDate: due(10),  estimatedMinutes: 120 },
]

let demoAccountPromise: Promise<void> | null = null

// Idempotent — safe to call on every cold start. Creates (or repairs) the
// shared demo login with a fixed set of courses/grades/assignments so the
// product is fully explorable without connecting a real school portal.
export function ensureDemoAccount(): Promise<void> {
  if (demoAccountPromise) return demoAccountPromise
  demoAccountPromise = (async () => {
    try {
      const passwordHash = await bcrypt.hash(DEMO_ACCOUNT_PASSWORD, 10)
      // Name is deliberately just two words — the initials avatar (see
      // settings page's initials()) takes the first letter of the first and
      // last word, so a parenthetical like "(Demo)" produced a "T(" avatar.
      const user = await prisma.user.upsert({
        where: { email: DEMO_ACCOUNT_EMAIL },
        update: { isDemoAccount: true, name: 'Test Student' },
        create: {
          email: DEMO_ACCOUNT_EMAIL,
          passwordHash,
          name: 'Test Student',
          role: 'STUDENT',
          isDemoAccount: true,
          emailVerified: true,
          tosAcceptedAt: new Date(),
          privacyAcceptedAt: new Date(),
          ageConfirmedAt: new Date(),
          coppaConsentStatus: 'NOT_REQUIRED',
        },
      })

      await prisma.profile.upsert({
        where: { userId: user.id },
        update: { gradeLevel: 11, graduationYear: new Date().getFullYear() + 1, weightedGpa: 3.9, unweightedGpa: 3.6, counselorName: 'Ms. Ortiz (Demo)' },
        create: {
          userId: user.id,
          gradeLevel: 11,
          graduationYear: new Date().getFullYear() + 1,
          weightedGpa: 3.9,
          unweightedGpa: 3.6,
          counselorName: 'Ms. Ortiz (Demo)',
        },
      })

      const existingCourses = await prisma.course.findMany({ where: { userId: user.id }, select: { id: true, name: true } })
      const existingNames = new Set(existingCourses.map(c => c.name))
      const missingCourses = DEMO_COURSES.filter(c => !existingNames.has(c.name))

      for (const def of missingCourses) {
        const course = await prisma.course.create({
          data: {
            userId: user.id,
            name: def.name,
            teacher: def.teacher,
            period: def.period,
            semester: DEMO_SEMESTER,
            courseType: def.courseType,
            creditHours: def.creditHours,
          },
        })
        await prisma.grade.create({
          data: {
            courseId: course.id,
            userId: user.id,
            letterGrade: def.letterGrade,
            percentage: def.percentage,
            gradingPeriod: 'CURRENT',
          },
        })
      }

      // Assignments are due-date relative, so refresh them on every cold start
      // rather than only seeding once — otherwise a demo account provisioned
      // weeks ago would show every assignment as overdue.
      await prisma.assignment.deleteMany({ where: { userId: user.id, source: ASSIGNMENT_SOURCE.SEED } })
      await prisma.assignment.createMany({
        data: DEMO_ASSIGNMENTS.map(a => ({
          userId: user.id,
          title: a.title,
          subject: a.subject,
          dueDate: a.dueDate,
          estimatedMinutes: a.estimatedMinutes,
          completed: a.completed ?? false,
          completedAt: a.completed ? due(-2) : null,
          source: ASSIGNMENT_SOURCE.SEED,
        })),
      })

      console.log('[startup] demo account ready:', DEMO_ACCOUNT_EMAIL)
    } catch (err) {
      console.error('[startup] failed to provision demo account:', err instanceof Error ? err.message : String(err))
    }
  })()
  return demoAccountPromise
}
