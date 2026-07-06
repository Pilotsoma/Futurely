import { Router, Response } from 'express'
import { z } from 'zod'
import { AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { predictAdmission, ModelServiceUnavailableError } from '../services/collegeProbability'
import { getQuantitativeSteps } from '../services/collegePathQuantitative'
import { getQualitativeSteps } from '../services/collegePathQualitative'
import { writeAuditLog } from '../lib/auditLog'
import { logger } from '../common/logger'
import { checkCoppaGate } from '../lib/coppaGuard'

const router = Router()

const addSchema = z.object({
  name: z.string().min(1).max(200),
})

const predictBodySchema = z.object({
  collegeId: z.number().int().positive(),
  studentSat: z.number().int().min(400).max(1600),
  studentAct: z.number().min(1).max(36).nullable().optional(),
  studentGpa: z.number().min(0).max(5),
})

/**
 * POST /colleges/predict
 *
 * Auth-guarded. Validates input, applies COPPA gate for users under 13,
 * looks up the College catalog row, calls the ML model service, writes an
 * audit log entry, and returns the prediction result.
 */
router.post('/predict', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!

  const parse = predictBodySchema.safeParse(req.body)
  if (!parse.success) {
    const message = parse.error.errors[0]?.message ?? 'Invalid request body'
    res.status(400).json({ data: null, error: { message } })
    return
  }

  const { collegeId, studentSat, studentAct, studentGpa } = parse.data

  try {
    // COPPA gate — must run before any data processing for potentially under-13 users
    const coppa = await checkCoppaGate(userId)
    if (coppa.blocked) {
      res.status(403).json({ data: null, error: { message: coppa.message } })
      return
    }

    // Look up the college catalog row
    const college = await prisma.college.findUnique({
      where: { id: collegeId },
    })

    if (!college) {
      res.status(404).json({ data: null, error: { message: 'College not found.' } })
      return
    }

    // Compliance audit log — written before the data leaves this request, not
    // just on success, so the record reflects the access itself rather than
    // being contingent on the downstream model service being reachable.
    await writeAuditLog({
      userId,
      resourceType: 'college_probability',
      resourceId: String(college.id),
      action: 'predict',
      ipAddress: req.ip ?? '',
    })

    // Call the ML model service
    const prediction = await predictAdmission({
      studentSat,
      studentAct: studentAct ?? null,
      studentGpa,
      college: {
        name: college.name,
        avgSat: college.avgSat,
        avgAct: college.avgAct,
        avgGpa: college.avgGpa,
        acceptanceRate: college.acceptanceRate,
      },
    })

    res.json({ data: prediction })
  } catch (err: unknown) {
    if (err instanceof ModelServiceUnavailableError) {
      res.status(503).json({
        data: null,
        error: {
          message: 'Prediction service is temporarily unavailable. Please try again shortly.',
        },
      })
      return
    }

    logger.error('college_predict_unexpected_error', {
      error: err instanceof Error ? err.message : String(err),
      userId,
    })
    res.status(500).json({ data: null, error: { message: 'An unexpected error occurred.' } })
  }
})

/**
 * POST /colleges/path
 *
 * Auth-guarded. Returns a baseline admission probability plus a merged,
 * sorted list of actionable improvement steps for a target college.
 * Steps come from two sources:
 *   - quantitative (model-calculated, source: 'model')
 *   - qualitative  (AI-estimated,    source: 'ai_estimate')
 * Both are tagged so the frontend can visually distinguish them.
 *
 * The qualitative service never throws — a missing ANTHROPIC_API_KEY or
 * any AI failure returns zero qualitative steps while quantitative steps
 * continue to work normally. ModelServiceUnavailableError from the
 * quantitative service (model server down) surfaces as a 503.
 */
router.post('/path', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!

  const parse = predictBodySchema.safeParse(req.body)
  if (!parse.success) {
    const message = parse.error.errors[0]?.message ?? 'Invalid request body'
    res.status(400).json({ data: null, error: { message } })
    return
  }

  const { collegeId, studentSat, studentAct, studentGpa } = parse.data

  try {
    // COPPA gate — must run before any data processing for potentially under-13 users
    const coppa = await checkCoppaGate(userId)
    if (coppa.blocked) {
      res.status(403).json({ data: null, error: { message: coppa.message } })
      return
    }

    // Look up the college catalog row
    const college = await prisma.college.findUnique({
      where: { id: collegeId },
    })

    if (!college) {
      res.status(404).json({ data: null, error: { message: 'College not found.' } })
      return
    }

    // Compliance audit log — written before any data leaves this request, not
    // contingent on downstream service availability.
    await writeAuditLog({
      userId,
      resourceType: 'college_path',
      resourceId: String(college.id),
      action: 'predict',
      ipAddress: req.ip ?? '',
    })

    // Get baseline probability from the ML model
    const prediction = await predictAdmission({
      studentSat,
      studentAct: studentAct ?? null,
      studentGpa,
      college: {
        name: college.name,
        avgSat: college.avgSat,
        avgAct: college.avgAct,
        avgGpa: college.avgGpa,
        acceptanceRate: college.acceptanceRate,
      },
    })

    const baselineProbability = prediction.probability

    const collegeStats = {
      studentSat,
      studentAct: studentAct ?? null,
      studentGpa,
      avgSat: college.avgSat,
      avgAct: college.avgAct,
      avgGpa: college.avgGpa,
      acceptanceRate: college.acceptanceRate,
    }

    // Run both step generators in parallel. getQualitativeSteps never throws by
    // design. getQuantitativeSteps CAN throw ModelServiceUnavailableError —
    // Promise.all will reject and the catch block handles it with a 503.
    const [quantitativeSteps, qualitativeSteps] = await Promise.all([
      getQuantitativeSteps(collegeStats),
      getQualitativeSteps({
        userId,
        collegeId: college.id,
        collegeName: college.name,
        ipAddress: req.ip ?? '',
        ...collegeStats,
      }),
    ])

    const steps = [...quantitativeSteps, ...qualitativeSteps].sort(
      (a, b) => b.percentBoost - a.percentBoost
    )

    res.json({
      data: {
        collegeName: college.name,
        baselineProbability,
        steps,
      },
    })
  } catch (err: unknown) {
    if (err instanceof ModelServiceUnavailableError) {
      res.status(503).json({
        data: null,
        error: {
          message: 'Prediction service is temporarily unavailable. Please try again shortly.',
        },
      })
      return
    }

    logger.error('college_path_unexpected_error', {
      error: err instanceof Error ? err.message : String(err),
      userId,
    })
    res.status(500).json({ data: null, error: { message: 'An unexpected error occurred.' } })
  }
})

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!
  const items = await prisma.collegeListItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
  res.json({ data: items })
})

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!
  const parse = addSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ data: null, error: { message: parse.error.errors[0]?.message ?? 'Invalid request' } })
    return
  }
  try {
    const item = await prisma.collegeListItem.create({
      data: { userId, name: parse.data.name },
    })
    res.json({ data: item })
  } catch {
    res.status(409).json({ data: null, error: { message: 'College already in your list' } })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) {
    res.status(400).json({ data: null, error: { message: 'Invalid id' } })
    return
  }
  await prisma.collegeListItem.deleteMany({ where: { id, userId } })
  res.json({ data: { deleted: true } })
})

export default router
