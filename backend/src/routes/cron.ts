/**
 * Cron route handlers.
 *
 * These endpoints are called exclusively by Vercel's cron scheduler, NOT by
 * authenticated user sessions. Authentication is via a shared CRON_SECRET
 * environment variable validated against the `Authorization: Bearer <secret>`
 * header that Vercel attaches to every scheduled invocation.
 *
 * IMPORTANT: do not apply requireAuth or requireConsent to these routes —
 * they use a separate secret-based auth model intentionally.
 */

import { Router, Request, Response } from 'express'
import { logger } from '../common/logger'
import { checkAndSendReminders } from '../services/assignmentReminder.service'

const router = Router()

const CRON_SECRET_MISSING_MSG =
  'CRON_SECRET environment variable is not set — the cron endpoint will reject all requests until it is configured.'

if (!process.env.CRON_SECRET) {
  logger.warn('cron_secret_missing', { message: CRON_SECRET_MISSING_MSG })
}

/**
 * GET /cron/assignment-reminders
 *
 * Called by Vercel Cron every 10 minutes (configured in vercel.json).
 * Finds assignments due in ~1 hour and sends ASSIGNMENT_DUE_SOON notifications.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
router.get('/assignment-reminders', async (req: Request, res: Response): Promise<void> => {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.authorization

  if (!secret || authHeader !== `Bearer ${secret}`) {
    logger.warn('cron_unauthorized', {
      path: req.originalUrl,
      hasAuthHeader: Boolean(authHeader),
    })
    res.status(401).json({
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron secret.' },
    })
    return
  }

  try {
    const result = await checkAndSendReminders()
    res.status(200).json({ data: { processed: result.processed } })
  } catch (err) {
    logger.error('cron_assignment_reminders_failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Reminder check failed.' },
    })
  }
})

export default router
