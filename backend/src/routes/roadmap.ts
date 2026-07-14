import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { writeAuditLog } from '../lib/auditLog'
import { generatePersonalizedMilestones, buildFallbackMilestones } from '../services/ai/roadmapInsights'

const router = Router()

// Derive current grade level from graduation year.
// Grade 12 graduates in the spring of `graduationYear`.
// In Aug+, the new school year has started so we increment by 1.
function deriveGradeLevel(graduationYear: number | null, stored: number | null): number {
  if (graduationYear) {
    const now = new Date()
    const effectiveYear = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear()
    const derived = 12 - (graduationYear - effectiveYear)
    if (derived >= 9 && derived <= 12) return derived
  }
  return stored ?? 9
}

function categorize(name: string): string {
  const n = name.toLowerCase()
  if (/english|literature|writing|composition|oral interp|reading/.test(n)) return 'English'
  if (/math|calculus|geometry|algebra|statistics|precalculus|reasoning/.test(n)) return 'Math'
  if (/biology|chemistry|physics|science|integrated physics/.test(n)) return 'Science'
  if (/history|government|economics|geography|social/.test(n)) return 'Social Studies'
  if (/spanish|french|chinese|latin|german|japanese/.test(n)) return 'Language'
  if (/art|music|theater|floral|design|photography|fine/.test(n)) return 'Fine Arts'
  if (/pe |physical|health|athletics|tennis|swimming|gym/.test(n)) return 'PE / Health'
  return 'Electives'
}

interface RoadmapCore {
  gradeLevel: number
  graduationYear: number | null
  creditsCompleted: number
  creditsRequired: number
  creditsByCategory: Record<string, number>
  weightedGpa: number
  unweightedGpa: number
  futureDecision: string | null
}

async function gatherRoadmapCore(userId: number): Promise<RoadmapCore> {
  const profile = await prisma.profile.findUnique({ where: { userId } })
  const courses = await prisma.course.findMany({
    where: { userId },
    include: { grades: { where: { gradingPeriod: 'CURRENT' }, take: 1 } },
  })

  const creditsByCategory: Record<string, number> = {
    English: 0, Math: 0, Science: 0, 'Social Studies': 0,
    Language: 0, 'Fine Arts': 0, 'PE / Health': 0, Electives: 0,
  }

  let creditsCompleted = 0
  for (const c of courses) {
    const grade = c.grades[0]
    const passed = grade && grade.letterGrade !== 'F'
    if (passed) {
      creditsCompleted += c.creditHours
      const cat = categorize(c.name)
      creditsByCategory[cat] = (creditsByCategory[cat] ?? 0) + c.creditHours
    }
  }

  return {
    gradeLevel: deriveGradeLevel(profile?.graduationYear ?? null, profile?.gradeLevel ?? null),
    graduationYear: profile?.graduationYear ?? null,
    creditsCompleted,
    creditsRequired: 26,
    creditsByCategory,
    weightedGpa: profile?.weightedGpa ?? 0,
    unweightedGpa: profile?.unweightedGpa ?? 0,
    futureDecision: profile?.futureDecision ?? null,
  }
}

// Fast path: real structured data + instant (non-AI) milestones, so the page
// never blocks on an LLM call. The frontend fetches personalized milestones
// separately from GET /insights once the page has already rendered.
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.userId === undefined) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    return
  }
  try {
    // FERPA: Course and Grade data are education records — audit every read.
    await writeAuditLog({
      userId: req.userId,
      resourceType: 'COURSE',
      resourceId: String(req.userId),
      action: 'READ_ROADMAP',
      ipAddress: req.ip ?? 'unknown',
    })

    const core = await gatherRoadmapCore(req.userId)

    res.json({
      data: {
        ...core,
        percentComplete: Math.round((core.creditsCompleted / core.creditsRequired) * 100),
        milestones: buildFallbackMilestones(core.gradeLevel),
      },
    })
  } catch {
    res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
  }
})

// Slow path: the AI-personalized milestones, fetched separately so the main
// roadmap page load never waits on an LLM call.
router.get('/insights', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.userId === undefined) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    return
  }
  try {
    await writeAuditLog({
      userId: req.userId,
      resourceType: 'COURSE',
      resourceId: String(req.userId),
      action: 'READ_ROADMAP',
      ipAddress: req.ip ?? 'unknown',
    })

    const core = await gatherRoadmapCore(req.userId)
    const milestones = await generatePersonalizedMilestones(core)

    res.json({ data: { milestones } })
  } catch {
    res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
  }
})

export default router
