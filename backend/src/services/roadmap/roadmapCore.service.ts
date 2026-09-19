import { prisma } from '../../lib/prisma'
import { getPortalData } from '../../lib/studentContext'

export interface RoadmapCore {
  gradeLevel: number
  graduationYear: number | null
  creditsCompleted: number
  creditsRequired: number
  creditsByCategory: Record<string, number>
  weightedGpa: number
  unweightedGpa: number
  futureDecision: string | null
  /**
   * Real HAC-synced course subject names for this student, stripped of any
   * grade or percentage information. Compliance requirement: no numeric grade
   * or letter grade may appear in any entry (see COMPLIANCE.md). Populated
   * from getPortalData().courseList; empty array when no portal sync exists.
   * Consumed by ai-engineer's roadmapInsights prompt (Phase 2).
   */
  courseSubjects: string[]
}

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /english|literature|writing|composition|oral interp|reading/, category: 'English' },
  { pattern: /math|calculus|geometry|algebra|statistics|precalculus|reasoning/, category: 'Math' },
  { pattern: /biology|chemistry|physics|science|integrated physics/, category: 'Science' },
  { pattern: /history|government|economics|geography|social/, category: 'Social Studies' },
  { pattern: /spanish|french|chinese|latin|german|japanese/, category: 'Language' },
  { pattern: /art|music|theater|floral|design|photography|fine/, category: 'Fine Arts' },
  { pattern: /pe |physical|health|athletics|tennis|swimming|gym/, category: 'PE / Health' },
]

export function categorize(name: string): string {
  const n = name.toLowerCase()
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(n)) return category
  }
  return 'Electives'
}

export function deriveGradeLevel(graduationYear: number | null, stored: number | null): number {
  if (graduationYear !== null) {
    const now = new Date()
    const effectiveYear = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear()
    const derived = 12 - (graduationYear - effectiveYear)
    if (derived >= 9 && derived <= 12) return derived
  }
  return stored ?? 9
}

export const CREDITS_REQUIRED = 26

export async function gatherRoadmapCore(userId: number): Promise<RoadmapCore> {
  // Fetch profile, credit-bearing course records, and live HAC-synced portal
  // data in parallel. portalData may be null if the student has not completed
  // an HAC sync yet — the null case is handled explicitly below.
  const [profile, courses, portalData] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.course.findMany({
      where: { userId },
      include: { grades: { where: { gradingPeriod: 'CURRENT' }, take: 1 } },
    }),
    getPortalData(userId),
  ])

  const creditsByCategory: Record<string, number> = {
    English: 0, Math: 0, Science: 0, 'Social Studies': 0,
    Language: 0, 'Fine Arts': 0, 'PE / Health': 0, Electives: 0,
  }

  // Prefer the real HAC transcript's credit history over the separate
  // Course/Grade tables, which aren't populated by the current HAC sync flow
  // and were the reason graduation progress showed 0% / "connect your school
  // account" even for students with a fully synced transcript. Only fall back
  // to the Course table when no HAC sync exists yet.
  let creditsCompleted = 0
  if (portalData && portalData.courseCredits.length > 0) {
    for (const c of portalData.courseCredits) {
      if (c.passed) {
        creditsCompleted += c.credits
        const cat = categorize(c.name)
        creditsByCategory[cat] = (creditsByCategory[cat] ?? 0) + c.credits
      }
    }
  } else {
    for (const c of courses) {
      const grade = c.grades[0]
      const passed = grade !== undefined && grade.letterGrade !== 'F'
      if (passed) {
        creditsCompleted += c.creditHours
        const cat = categorize(c.name)
        creditsByCategory[cat] = (creditsByCategory[cat] ?? 0) + c.creditHours
      }
    }
  }

  // GPA: prefer live HAC-synced values from the portal cache; fall back to the
  // Profile table values when no sync has run yet. Mirrors the pattern used in
  // ai.ts handlePersonalizedChat so both features draw from the same source.
  const weightedGpa = portalData?.weightedGpa ?? profile?.weightedGpa ?? 0
  const unweightedGpa = portalData?.unweightedGpa ?? profile?.unweightedGpa ?? 0

  // courseSubjects: real course names from the HAC-synced portal, stripped of
  // grade information. getPortalData() returns entries in the format
  // "<course name>: <grade>" (e.g. "AP Chemistry: A (94%)"). We keep only the
  // text before the first colon to ensure no letter grade, numeric average, or
  // percentage value ever appears in this field, including the edge case where
  // a course name itself contains a colon (stripping from the first colon still
  // guarantees grade isolation — course-name fidelity is not a compliance risk).
  // When portalData is null (no sync yet) this field is an empty array, which
  // the ai-engineer's prompt layer must treat as "no course data available".
  const courseSubjects: string[] = (portalData?.courseList ?? [])
    .map((entry) => {
      const colonIndex = entry.indexOf(':')
      return colonIndex !== -1 ? entry.slice(0, colonIndex).trim() : entry.trim()
    })
    .filter((name) => name.length > 0)

  return {
    gradeLevel: deriveGradeLevel(profile?.graduationYear ?? null, profile?.gradeLevel ?? null),
    graduationYear: profile?.graduationYear ?? null,
    creditsCompleted,
    creditsRequired: CREDITS_REQUIRED,
    creditsByCategory,
    weightedGpa,
    unweightedGpa,
    futureDecision: profile?.futureDecision ?? null,
    courseSubjects,
  }
}
