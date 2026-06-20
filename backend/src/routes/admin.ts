import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requireAdmin } from '../middleware/requireAdmin'
import { writeAuditLog } from '../lib/auditLog'
import { logger } from '../common/logger'

const router = Router()
router.use(requireAdmin)

function parseTagArr(raw: unknown): Array<{ tag: string; tagColor: string }> {
  if (Array.isArray(raw)) return raw as Array<{ tag: string; tagColor: string }>
  try { return JSON.parse(String(raw ?? '[]')) } catch { return [] }
}

// ── GET /admin/educator-requests ──
const listRequestsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'DENIED', 'ALL']).optional().default('PENDING'),
})

router.get('/educator-requests', async (req: AuthRequest, res: Response): Promise<void> => {
  const parse = listRequestsQuerySchema.safeParse(req.query)
  if (!parse.success) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parse.error.errors[0]?.message ?? 'Invalid query' } })
    return
  }
  const { status } = parse.data
  try {
    const requests = await prisma.educatorRoleRequest.findMany({
      where: status === 'ALL' ? {} : { status },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ data: requests, error: null })
  } catch (err: unknown) {
    logger.error('admin_educator_requests_list_error', { adminId: req.userId, error: err instanceof Error ? err.message : String(err) })
    res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch educator requests' } })
  }
})

// ── POST /admin/educator-requests/:id/approve ──
router.post('/educator-requests/:id/approve', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid id' } })
    return
  }
  try {
    const request = await prisma.educatorRoleRequest.findUnique({ where: { id } })
    if (!request) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Educator role request not found' } })
      return
    }
    if (request.status !== 'PENDING') {
      res.status(409).json({ data: null, error: { code: 'ALREADY_REVIEWED', message: 'Request has already been reviewed' } })
      return
    }
    const updated = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.educatorRoleRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedBy: req.userId!,
          reviewedAt: new Date(),
        },
      })
      await tx.user.update({
        where: { id: request.userId },
        data: { role: request.requestedRole },
      })

      // If approving a counselor, also grant the Counselor display tag
      if (request.requestedRole === 'COUNSELOR') {
        const targetUser = await tx.user.findUnique({
          where: { id: request.userId },
          select: { allTags: true, tag: true },
        })
        if (targetUser) {
          const tags = parseTagArr(targetUser.allTags)
          if (!tags.some(t => t.tag === 'Counselor')) {
            tags.push({ tag: 'Counselor', tagColor: '#8B5CF6' })
            const tagUpdates: Record<string, unknown> = { allTags: JSON.stringify(tags) }
            if (!targetUser.tag || targetUser.tag === 'Student' || targetUser.tag === 'Teacher') {
              tagUpdates.tag = 'Counselor'
              tagUpdates.tagColor = '#8B5CF6'
            }
            await tx.user.update({ where: { id: request.userId }, data: tagUpdates })
          }
        }
      }

      await tx.complianceAuditLog.create({
        data: {
          userId: req.userId!,
          resourceType: 'USER_ROLE',
          resourceId: request.userId.toString(),
          action: 'ROLE_GRANTED',
          ipAddress: req.ip ?? 'unknown',
        },
      })
      return updatedRequest
    })
    logger.info('educator_request_approved', { adminId: req.userId, requestId: id, targetUserId: request.userId, role: request.requestedRole })
    res.json({ data: updated, error: null })
  } catch (err: unknown) {
    logger.error('admin_approve_educator_request_error', { adminId: req.userId, requestId: id, error: err instanceof Error ? err.message : String(err) })
    res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to approve request' } })
  }
})

// ── POST /admin/educator-requests/:id/deny ──
router.post('/educator-requests/:id/deny', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid id' } })
    return
  }
  try {
    const request = await prisma.educatorRoleRequest.findUnique({ where: { id } })
    if (!request) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Educator role request not found' } })
      return
    }
    if (request.status !== 'PENDING') {
      res.status(409).json({ data: null, error: { code: 'ALREADY_REVIEWED', message: 'Request has already been reviewed' } })
      return
    }
    const updated = await prisma.educatorRoleRequest.update({
      where: { id },
      data: {
        status: 'DENIED',
        reviewedBy: req.userId!,
        reviewedAt: new Date(),
      },
    })
    await writeAuditLog({
      userId: req.userId!,
      resourceType: 'USER_ROLE',
      resourceId: request.userId.toString(),
      action: 'ROLE_DENIED',
      ipAddress: req.ip ?? 'unknown',
    })
    logger.info('educator_request_denied', { adminId: req.userId, requestId: id, targetUserId: request.userId })
    res.json({ data: updated, error: null })
  } catch (err: unknown) {
    logger.error('admin_deny_educator_request_error', { adminId: req.userId, requestId: id, error: err instanceof Error ? err.message : String(err) })
    res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to deny request' } })
  }
})

export default router
