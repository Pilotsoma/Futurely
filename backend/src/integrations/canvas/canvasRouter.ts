import { Router, Response, Request, NextFunction } from 'express'
import { z } from 'zod'
import { AuthRequest } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'
import { logger } from '../../common/logger'
import { encryptPassword, decryptPassword } from '../grades/credentialCrypto'
import { ASSIGNMENT_SOURCE } from '../../constants/assignmentSource'
import {
  verifyCanvasToken,
  fetchCanvasCourses,
  fetchCanvasUpcomingAssignments,
  CanvasTokenError,
  CanvasNetworkError,
} from './canvasClient'

const router = Router()

// ── Input schemas ────────────────────────────────────────────────────────────

const connectSchema = z.object({
  canvasInstanceUrl: z
    .string()
    .min(3)
    .max(253)
    .regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Must be a hostname, not a full URL')
    .transform(url => url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')),
  accessToken: z.string().min(10).max(2048),
})

// ── Async route wrapper ──────────────────────────────────────────────────────

function asyncHandler(
  fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req as AuthRequest, res, next)).catch(err => {
      if (!res.headersSent) {
        logger.error('Unhandled Canvas route error', {
          message: err instanceof Error ? err.message : String(err),
        })
        res.status(500).json({
          data: null,
          error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
        })
      }
    })
  }
}

// ── POST /connect ────────────────────────────────────────────────────────────

router.post(
  '/connect',
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId!

    const parse = connectSchema.safeParse(req.body)
    if (!parse.success) {
      res.status(400).json({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: parse.error.errors[0]?.message ?? 'Invalid request',
        },
      })
      return
    }

    const { canvasInstanceUrl, accessToken } = parse.data

    logger.info('Canvas connect attempt', { userId, canvasInstanceUrl })

    let self: Awaited<ReturnType<typeof verifyCanvasToken>>
    try {
      self = await verifyCanvasToken(canvasInstanceUrl, accessToken)
    } catch (err) {
      if (err instanceof CanvasTokenError) {
        res.status(422).json({
          data: null,
          error: {
            code: 'CANVAS_TOKEN_INVALID',
            message: 'The Canvas access token is invalid or has been revoked.',
          },
        })
        return
      }
      if (err instanceof CanvasNetworkError) {
        res.status(502).json({
          data: null,
          error: {
            code: 'CANVAS_UNREACHABLE',
            message: 'Cannot reach the Canvas instance. Check the hostname and try again.',
          },
        })
        return
      }
      throw err
    }

    const encryptedToken = encryptPassword(accessToken)

    await prisma.canvasConnection.upsert({
      where: { userId },
      create: {
        userId,
        canvasInstanceUrl,
        encryptedToken,
        canvasUserId: String(self.id),
        canvasUserName: self.name,
      },
      update: {
        canvasInstanceUrl,
        encryptedToken,
        canvasUserId: String(self.id),
        canvasUserName: self.name,
        syncStatus: null,
        syncError: null,
        lastSynced: null,
      },
    })

    await prisma.complianceAuditLog.create({
      data: {
        userId,
        resourceType: 'CANVAS_CONNECTION',
        action: 'CANVAS_CONNECT',
        ipAddress: req.ip ?? 'unknown',
        timestamp: new Date(),
      },
    })

    logger.info('Canvas connection established', { userId, canvasUserId: String(self.id) })

    res.status(201).json({
      data: {
        connected: true,
        canvasUserName: self.name,
        canvasInstanceUrl,
      },
    })
  })
)

// ── POST /sync ───────────────────────────────────────────────────────────────

router.post(
  '/sync',
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId!

    const connection = await prisma.canvasConnection.findUnique({ where: { userId } })
    if (!connection) {
      res.status(404).json({
        data: null,
        error: {
          code: 'NOT_CONNECTED',
          message: 'No Canvas account connected. Connect your Canvas account first.',
        },
      })
      return
    }

    const token = decryptPassword(connection.encryptedToken)
    const { canvasInstanceUrl } = connection

    await prisma.canvasConnection.update({
      where: { userId },
      data: { syncStatus: 'syncing' },
    })

    logger.info('Canvas sync starting', { userId, canvasInstanceUrl })

    let courses: Awaited<ReturnType<typeof fetchCanvasCourses>>
    let assignments: Awaited<ReturnType<typeof fetchCanvasUpcomingAssignments>>

    try {
      courses = await fetchCanvasCourses(canvasInstanceUrl, token)
      assignments = await fetchCanvasUpcomingAssignments(canvasInstanceUrl, token)
    } catch (err) {
      if (err instanceof CanvasTokenError) {
        await prisma.canvasConnection.update({
          where: { userId },
          data: { syncStatus: 'error', syncError: 'TOKEN_REVOKED' },
        })
        res.status(401).json({
          data: null,
          error: {
            code: 'CANVAS_TOKEN_EXPIRED',
            message: 'Canvas access token has been revoked. Please reconnect your Canvas account.',
          },
        })
        return
      }
      if (err instanceof CanvasNetworkError) {
        await prisma.canvasConnection.update({
          where: { userId },
          data: { syncStatus: 'error', syncError: err.message },
        })
        res.status(502).json({
          data: null,
          error: {
            code: 'CANVAS_UNREACHABLE',
            message: 'Cannot reach Canvas. Check your connection and try again.',
          },
        })
        return
      }
      throw err
    }

    const courseMap = new Map<number, string>()
    for (const course of courses) {
      courseMap.set(course.id, course.name)
    }

    const SEVEN_DAYS_MS = 7 * 86400000

    const upsertPayloads = assignments.map(assignment => ({
      userId,
      title: assignment.name.slice(0, 500),
      subject: courseMap.get(assignment.course_id) ?? `Canvas Course ${assignment.course_id}`,
      dueDate: assignment.due_at
        ? new Date(assignment.due_at)
        : new Date(Date.now() + SEVEN_DAYS_MS),
      source: ASSIGNMENT_SOURCE.CANVAS,
    }))

    for (const payload of upsertPayloads) {
      await prisma.assignment.upsert({
        where: {
          userId_title_subject: {
            userId: payload.userId,
            title: payload.title,
            subject: payload.subject,
          },
        },
        update: {
          dueDate: payload.dueDate,
          // Note: source is intentionally omitted to preserve existing HAC/manual source
        },
        create: {
          ...payload,
          completed: false,
        },
      })
    }

    await prisma.canvasConnection.update({
      where: { userId },
      data: {
        lastSynced: new Date(),
        syncStatus: 'complete',
        syncError: null,
      },
    })

    await prisma.complianceAuditLog.create({
      data: {
        userId,
        resourceType: 'CANVAS_ASSIGNMENTS',
        resourceId: String(userId),
        action: 'CANVAS_SYNC',
        ipAddress: req.ip ?? 'unknown',
        timestamp: new Date(),
      },
    })

    logger.info('Canvas sync complete', { userId, syncedCount: upsertPayloads.length })

    res.status(200).json({
      data: {
        syncedCount: upsertPayloads.length,
        assignments: upsertPayloads.map(a => ({
          title: a.title,
          subject: a.subject,
          dueDate: a.dueDate,
        })),
      },
    })
  })
)

// ── GET /status ──────────────────────────────────────────────────────────────

router.get(
  '/status',
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId!

    const connection = await prisma.canvasConnection.findUnique({ where: { userId } })

    if (!connection) {
      res.status(200).json({
        data: {
          connected: false,
          canvasInstanceUrl: null,
          canvasUserName: null,
          lastSynced: null,
          syncStatus: null,
          syncError: null,
        },
      })
      return
    }

    res.status(200).json({
      data: {
        connected: true,
        canvasInstanceUrl: connection.canvasInstanceUrl,
        canvasUserName: connection.canvasUserName,
        lastSynced: connection.lastSynced,
        syncStatus: connection.syncStatus,
        syncError: connection.syncError,
      },
    })
  })
)

// ── DELETE /disconnect ───────────────────────────────────────────────────────

router.delete(
  '/disconnect',
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId!

    logger.info('Canvas disconnect requested', { userId })

    const deleteResult = await prisma.assignment.deleteMany({
      where: { userId, source: ASSIGNMENT_SOURCE.CANVAS },
    })

    await prisma.canvasConnection.deleteMany({ where: { userId } })

    await prisma.complianceAuditLog.create({
      data: {
        userId,
        resourceType: 'CANVAS_CONNECTION',
        action: 'CANVAS_DISCONNECT',
        ipAddress: req.ip ?? 'unknown',
        timestamp: new Date(),
      },
    })

    logger.info('Canvas disconnected', { userId, deletedAssignmentsCount: deleteResult.count })

    res.status(200).json({
      data: {
        disconnected: true,
        deletedAssignmentsCount: deleteResult.count,
      },
    })
  })
)

export default router
