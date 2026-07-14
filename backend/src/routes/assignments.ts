import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { logger } from '../common/logger'
import { ASSIGNMENT_SOURCE } from '../constants/assignmentSource'
import { createAndSendNotification } from '../lib/notifications'
import { scoreSingleAssignmentPriority } from '../services/assignmentPriorityScorer'

const router = Router()

const listQuerySchema = z.object({
  status: z.enum(['incomplete', 'complete', 'all']).default('all'),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
})

const createBodySchema = z.object({
  title: z.string().min(1).max(200),
  subject: z.string().max(100).optional(),
  dueDate: z.string().min(1),
  dueTime: z.string().max(20).optional(),
})

const patchBodySchema = z.object({
  completed: z.boolean(),
})

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.userId === undefined) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED' } })
    return
  }

  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(422).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
    })
    return
  }

  const { status, cursor, limit } = parsed.data

  try {
    const where = {
      userId: req.userId,
      source: { notIn: [ASSIGNMENT_SOURCE.SEED, ASSIGNMENT_SOURCE.HAC] }, // HAC kept here to filter any legacy rows
      ...(status === 'incomplete' && { completed: false }),
      ...(status === 'complete' && { completed: true }),
    }

    const assignments = await prisma.assignment.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      take: limit + 1,
      ...(cursor !== undefined && {
        cursor: { id: cursor },
        skip: 1,
      }),
    })

    const hasNextPage = assignments.length > limit
    const page = hasNextPage ? assignments.slice(0, limit) : assignments
    const nextCursor = hasNextPage ? page[page.length - 1].id : null

    res.status(200).json({
      data: page,
      meta: { nextCursor, hasNextPage, count: page.length },
    })
  } catch (err) {
    logger.error('Failed to fetch assignments', { err })
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch assignments' },
    })
  }
})

router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.userId === undefined) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED' } })
    return
  }

  const parsed = createBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
    })
    return
  }

  const { title, subject, dueDate, dueTime } = parsed.data

  // Parse date as local time by splitting components — new Date("YYYY-MM-DD") is UTC midnight
  // which shifts the day back by one in US timezones. Using Date(y, m, d, h, min) is always local.
  const [year, month, day] = dueDate.split('-').map(Number)
  const [hours, minutes] = (dueTime?.trim() || '23:59').split(':').map(Number)
  const parsedDate = new Date(year, month - 1, day, hours, minutes, 0)
  if (isNaN(parsedDate.getTime())) {
    res.status(422).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid dueDate' },
    })
    return
  }

  try {
    const assignment = await prisma.assignment.create({
      data: {
        title: title.trim(),
        subject: subject?.trim() ?? '',
        dueDate: parsedDate,
        dueTime: dueTime?.trim() || null,
        userId: req.userId,
        source: ASSIGNMENT_SOURCE.MANUAL,
      },
    })

    // Notify the user of their new assignment (fire-and-forget; createAndSendNotification never throws)
    const due = parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    createAndSendNotification({
      userId: req.userId,
      fromUserId: req.userId,
      type: 'ASSIGNMENT_CREATED',
      preview: `${title.trim()} — due ${due}`,
    })

    // Kick off AI priority scoring without blocking the 201 response
    scoreSingleAssignmentPriority(assignment.id, req.userId, {
      title: assignment.title,
      subject: assignment.subject ?? '',
      dueDate: assignment.dueDate,
      estimatedMinutes: assignment.estimatedMinutes,
    }).catch(err => logger.warn('priority_scoring_failed', { err }))

    res.status(201).json({ data: assignment })
  } catch (err) {
    logger.error('Failed to create assignment', { err })
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create assignment' },
    })
  }
})

router.patch('/:id/complete', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.userId === undefined) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED' } })
    return
  }

  const params = idParamSchema.safeParse(req.params)
  const body = patchBodySchema.safeParse(req.body)

  if (!params.success || !body.success) {
    res.status(422).json({
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        details: {
          ...(!params.success && { params: params.error.flatten() }),
          ...(!body.success && { body: body.error.flatten() }),
        },
      },
    })
    return
  }

  const { id } = params.data
  const { completed } = body.data

  try {
    const result = await prisma.assignment.updateMany({
      where: { id, userId: req.userId },
      data: {
        completed,
        completedAt: completed ? new Date() : null,
      },
    })

    if (result.count === 0) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Assignment not found' },
      })
      return
    }

    const updated = await prisma.assignment.findFirst({ where: { id, userId: req.userId } })
    res.status(200).json({ data: updated })
  } catch (err) {
    logger.error('Failed to update assignment completion', { err })
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update assignment' },
    })
  }
})

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.userId === undefined) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED' } })
    return
  }

  const params = idParamSchema.safeParse(req.params)
  if (!params.success) {
    res.status(422).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', details: params.error.flatten() },
    })
    return
  }

  const { id } = params.data

  try {
    const result = await prisma.assignment.deleteMany({
      where: { id, userId: req.userId },
    })

    if (result.count === 0) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Assignment not found' },
      })
      return
    }

    res.status(200).json({ data: { deleted: true } })
  } catch (err) {
    logger.error('Failed to delete assignment', { err })
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete assignment' },
    })
  }
})

// POST /api/assignments/score-priorities
// Finds all unscored incomplete assignments for the authenticated user (up to 50)
// and runs AI priority scoring on them concurrently. Returns the count that settled
// as fulfilled. Individual scoring failures are handled inside scoreSingleAssignmentPriority
// (falls back to MEDIUM, never throws), so this endpoint essentially always succeeds.
router.post('/score-priorities', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.userId === undefined) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED' } })
    return
  }

  const userId = req.userId

  try {
    const unscored = await prisma.assignment.findMany({
      where: { userId, priority: null, completed: false },
      orderBy: { dueDate: 'asc' },
      take: 50,
    })

    const results = await Promise.allSettled(
      unscored.map(a =>
        scoreSingleAssignmentPriority(a.id, userId, {
          title: a.title,
          subject: a.subject ?? '',
          dueDate: a.dueDate,
          estimatedMinutes: a.estimatedMinutes,
        })
      )
    )

    const scored = results.filter(r => r.status === 'fulfilled').length

    res.status(200).json({ data: { scored } })
  } catch (err) {
    logger.error('Failed to score assignment priorities', { userId, err })
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to score assignment priorities' },
    })
  }
})

export default router
