/**
 * Cron route handlers.
 *
 * These endpoints are called exclusively by an external scheduled pinger
 * (currently cron-job.org — previously a GitHub Actions `schedule` trigger,
 * moved off because GitHub does not guarantee scheduled workflows fire on
 * time, especially under platform load), NOT by authenticated user sessions.
 * Authentication is via a shared CRON_SECRET environment variable validated
 * against the `Authorization: Bearer <secret>` header the pinger sends.
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
 * Called by an external scheduled pinger (currently cron-job.org) roughly
 * every 10 minutes. Finds assignments due within the catch-up window and
 * sends ASSIGNMENT_DUE_SOON notifications — see assignmentReminder.service.ts.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 *
 * Explicitly marked non-cacheable: this endpoint MUST re-execute its full
 * DB check on every single call — a pinger hitting the exact same URL on a
 * fixed schedule is precisely the shape of request an intermediate cache
 * (a CDN, an edge cache, or the pinging service's own client) would be most
 * tempted to short-circuit with a stale "200 OK" if nothing here told it not
 * to. No caching layer was ever confirmed to actually be the cause of a real
 * incident, but the fix costs nothing and removes an entire category of
 * silent, hard-to-diagnose "the response says success but nothing happened"
 * failure for an endpoint where that failure mode is otherwise invisible.
 */
router.get('/assignment-reminders', async (req: Request, res: Response): Promise<void> => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')

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
    logger.info('cron_assignment_reminders_ran', {
      processed: result.processed,
      ranAt: new Date().toISOString(),
    })
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
