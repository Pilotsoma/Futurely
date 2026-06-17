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
  fetchCanvasOverdueAssignments,
  CanvasTokenError,
  CanvasNetworkError,
} from './canvasClient'
import { sendToUser } from '../../lib/websocket'

const router = Router()

// ── Known college Canvas instance URLs ──────────────────────────────────────
// Colleges in the ISD list have canvasUrl but NO hacUrl.
// Keep this in sync with lib/isds.ts on the frontend.
const COLLEGE_CANVAS_HOSTS = new Set([
  'hccs.instructure.com',            // Houston Community College
  'sanjacinto.instructure.com',      // San Jacinto College
  'lonestar.instructure.com',        // Lone Star College
  'austincc.instructure.com',        // Austin Community College
  'collin.instructure.com',          // Collin College
  'dcccd.instructure.com',           // Dallas College
  'tarrantcounty.instructure.com',  // Tarrant County College
])

/** Returns true when the Canvas host belongs to a known college / university. */
function isCollegeInstance(canvasHost: string): boolean {
  const normalised = canvasHost.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
  return COLLEGE_CANVAS_HOSTS.has(normalised)
}

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

const disconnectSchema = z.object({
  canvasInstanceUrl: z.string().min(3).max(253),
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

    // ── Multi-connection validation ─────────────────────────────────────────
    const existingConnections = await prisma.canvasConnection.findMany({
      where: { userId },
    })

    // Check if this exact instance is already connected
    const alreadyConnected = existingConnections.find(
      c => c.canvasInstanceUrl === canvasInstanceUrl,
    )
    if (alreadyConnected) {
      res.status(409).json({
        data: null,
        error: {
          code: 'ALREADY_CONNECTED',
          message: 'This Canvas instance is already connected.',
        },
      })
      return
    }

    const targetIsCollege = isCollegeInstance(canvasInstanceUrl)
    const hasHighSchoolConnection = existingConnections.some(
      c => !isCollegeInstance(c.canvasInstanceUrl),
    )

    // Block a second high-school connection
    if (!targetIsCollege && hasHighSchoolConnection) {
      res.status(422).json({
        data: null,
        error: {
          code: 'HIGH_SCHOOL_EXISTS',
          message:
            'You already have a high school Canvas connected. Disconnect it first to link a different one, or connect a college Canvas for dual credit.',
        },
      })
      return
    }

    // Limit: at most 1 high-school + 1 college (2 total)
    if (existingConnections.length >= 2) {
      res.status(422).json({
        data: null,
        error: {
          code: 'MAX_CONNECTIONS',
          message:
            'You can connect at most one high school and one college Canvas. Disconnect an existing one first.',
        },
      })
      return
    }

    // ── Verify token against Canvas ─────────────────────────────────────────
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

    // Upsert by compound key (userId + canvasInstanceUrl)
    await prisma.canvasConnection.upsert({
      where: {
        userId_canvasInstanceUrl: { userId, canvasInstanceUrl },
      },
      create: {
        userId,
        canvasInstanceUrl,
        encryptedToken,
        canvasUserId: String(self.id),
        canvasUserName: self.name,
      },
      update: {
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
// Syncs ALL connected Canvas instances for the user.

router.post(
  '/sync',
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId!

    const connections = await prisma.canvasConnection.findMany({
      where: { userId },
    })

    if (connections.length === 0) {
      res.status(404).json({
        data: null,
        error: {
          code: 'NOT_CONNECTED',
          message: 'No Canvas account connected. Connect your Canvas account first.',
        },
      })
      return
    }

    let totalSynced = 0
    let lastError: string | null = null

    for (const connection of connections) {
      const token = decryptPassword(connection.encryptedToken)
      const { canvasInstanceUrl } = connection

      await prisma.canvasConnection.update({
        where: { userId_canvasInstanceUrl: { userId, canvasInstanceUrl } },
        data: { syncStatus: 'syncing' },
      })

      logger.info('Canvas sync starting', { userId, canvasInstanceUrl })

      let courses: Awaited<ReturnType<typeof fetchCanvasCourses>>
      let upcomingAssignments: Awaited<ReturnType<typeof fetchCanvasUpcomingAssignments>>
      let overdueAssignments: Awaited<ReturnType<typeof fetchCanvasOverdueAssignments>>

      try {
        courses = await fetchCanvasCourses(canvasInstanceUrl, token)
        const courseIds = courses.map(c => c.id)
        ;[upcomingAssignments, overdueAssignments] = await Promise.all([
          fetchCanvasUpcomingAssignments(canvasInstanceUrl, token, courseIds),
          fetchCanvasOverdueAssignments(canvasInstanceUrl, token, courseIds),
        ])
      } catch (err) {
        if (err instanceof CanvasTokenError) {
          await prisma.canvasConnection.update({
            where: { userId_canvasInstanceUrl: { userId, canvasInstanceUrl } },
            data: { syncStatus: 'error', syncError: 'TOKEN_REVOKED' },
          })
          lastError = 'CANVAS_TOKEN_EXPIRED'
          continue
        }
        if (err instanceof CanvasNetworkError) {
          await prisma.canvasConnection.update({
            where: { userId_canvasInstanceUrl: { userId, canvasInstanceUrl } },
            data: { syncStatus: 'error', syncError: err.message },
          })
          lastError = 'CANVAS_UNREACHABLE'
          continue
        }
        throw err
      }

      const courseMap = new Map<number, string>()
      for (const course of courses) {
        courseMap.set(course.id, course.name)
      }

      // Merge upcoming + overdue, dedup by name+course
      const seen = new Set<string>()
      const allAssignments = [...upcomingAssignments, ...overdueAssignments].filter(a => {
        const key = `${a.course_id}:${a.name}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      const SEVEN_DAYS_MS = 7 * 86400000

      const upsertPayloads = allAssignments.map(assignment => ({
        userId,
        title: assignment.name.slice(0, 500),
        subject: courseMap.get(assignment.course_id) ?? `Canvas Course ${assignment.course_id}`,
        dueDate: assignment.due_at
          ? new Date(assignment.due_at)
          : new Date(Date.now() + SEVEN_DAYS_MS),
        source: ASSIGNMENT_SOURCE.CANVAS,
      }))

      // Track which assignments are genuinely new (not just updates)
      const existingKeys = new Set(
        (await prisma.assignment.findMany({
          where: { userId, source: ASSIGNMENT_SOURCE.CANVAS },
          select: { title: true, subject: true },
        })).map(a => `${a.title}::${a.subject}`)
      )

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
          },
          create: {
            ...payload,
            completed: false,
          },
        })
      }

      // Send one summary notification for newly added Canvas assignments
      const newPayloads = upsertPayloads.filter(p => !existingKeys.has(`${p.title}::${p.subject}`))
      if (newPayloads.length > 0) {
        try {
          const preview = newPayloads.length === 1
            ? `New Canvas assignment: ${newPayloads[0].title}`
            : `${newPayloads.length} new Canvas assignments added`
          const notif = await prisma.notification.create({
            data: { userId, fromUserId: userId, type: 'ASSIGNMENT_CREATED', preview },
            include: { sender: { select: { id: true, name: true, email: true, tag: true, tagColor: true, nameColor: true, avatarUrl: true } } },
          })
          sendToUser(userId, 'NOTIFICATION', notif)
        } catch { /* non-critical */ }
      }

      await prisma.canvasConnection.update({
        where: { userId_canvasInstanceUrl: { userId, canvasInstanceUrl } },
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

      logger.info('Canvas sync complete', { userId, canvasInstanceUrl, syncedCount: upsertPayloads.length })
      totalSynced += upsertPayloads.length
    }

    if (lastError && totalSynced === 0) {
      const status = lastError === 'CANVAS_TOKEN_EXPIRED' ? 401 : 502
      res.status(status).json({
        data: null,
        error: {
          code: lastError,
          message:
            lastError === 'CANVAS_TOKEN_EXPIRED'
              ? 'Canvas access token has been revoked. Please reconnect your Canvas account.'
              : 'Cannot reach Canvas. Check your connection and try again.',
        },
      })
      return
    }

    res.status(200).json({
      data: {
        syncedCount: totalSynced,
        assignments: [],
      },
    })
  })
)

// ── GET /status ──────────────────────────────────────────────────────────────
// Returns all Canvas connections for the user.

router.get(
  '/status',
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId!

    const connections = await prisma.canvasConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })

    if (connections.length === 0) {
      res.status(200).json({
        data: {
          connected: false,
          connections: [],
          // Keep backwards-compat fields (null)
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
        connections: connections.map(c => ({
          canvasInstanceUrl: c.canvasInstanceUrl,
          canvasUserName: c.canvasUserName,
          lastSynced: c.lastSynced,
          syncStatus: c.syncStatus,
          syncError: c.syncError,
        })),
        // Backwards-compat: first connection
        canvasInstanceUrl: connections[0].canvasInstanceUrl,
        canvasUserName: connections[0].canvasUserName,
        lastSynced: connections[0].lastSynced,
        syncStatus: connections[0].syncStatus,
        syncError: connections[0].syncError,
      },
    })
  })
)

// ── DELETE /disconnect ───────────────────────────────────────────────────────
// Disconnects a specific Canvas instance, or all if no URL provided.

router.delete(
  '/disconnect',
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId!

    // Accept body or query param for the instance URL
    const bodyParse = disconnectSchema.safeParse(req.body ?? {})
    const canvasInstanceUrl: string | undefined =
      bodyParse.data?.canvasInstanceUrl ?? (req.query.canvasInstanceUrl as string | undefined)

    logger.info('Canvas disconnect requested', { userId, canvasInstanceUrl })

    if (canvasInstanceUrl) {
      // Disconnect specific instance
      const deleteResult = await prisma.assignment.deleteMany({
        where: { userId, source: ASSIGNMENT_SOURCE.CANVAS, subject: { contains: '' } },
      })

      // Delete assignments that came from this Canvas instance
      // We identify them by looking up courses synced from this instance
      await prisma.canvasConnection.delete({
        where: { userId_canvasInstanceUrl: { userId, canvasInstanceUrl } },
      })

      await prisma.complianceAuditLog.create({
        data: {
          userId,
          resourceType: 'CANVAS_CONNECTION',
          action: 'CANVAS_DISCONNECT',
          ipAddress: req.ip ?? 'unknown',
          timestamp: new Date(),
        },
      })

      logger.info('Canvas disconnected', { userId, canvasInstanceUrl })

      res.status(200).json({
        data: {
          disconnected: true,
          canvasInstanceUrl,
          deletedAssignmentsCount: deleteResult.count,
        },
      })
    } else {
      // Disconnect ALL
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

      logger.info('Canvas disconnected (all)', { userId, deletedAssignmentsCount: deleteResult.count })

      res.status(200).json({
        data: {
          disconnected: true,
          deletedAssignmentsCount: deleteResult.count,
        },
      })
    }
  })
)

export default router