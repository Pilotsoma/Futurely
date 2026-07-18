/**
 * Assignment reminder service.
 *
 * Invoked by the Vercel Cron Job (GET /api/cron/assignment-reminders, every 10
 * minutes). For each incomplete assignment whose deadline falls within the next
 * 50–70 minutes and has not yet had a reminder sent, it fires an in-app
 * ASSIGNMENT_DUE_SOON notification and stamps `reminderSentAt` on the row.
 *
 * Design notes:
 * - Each assignment is processed independently (no batch transaction) so that a
 *   failure on one row does not abort the remainder of the batch.
 * - No ComplianceAuditLog entry is written here, consistent with the existing
 *   ASSIGNMENT_CREATED notification which is also not audit-logged (assignment
 *   metadata is not a FERPA-protected education record under current architect
 *   ruling).
 * - PENDING-consent users are explicitly excluded even though a correctly-
 *   functioning system should have no assignments for them. The cron route has
 *   no upstream auth middleware, so this filter is defensive, not redundant.
 */

import { prisma } from '../lib/prisma'
import { logger } from '../common/logger'
import { createAndSendNotification } from '../lib/notifications'

export interface ReminderResult {
  processed: number
}

/** Window constants (milliseconds). */
const WINDOW_LOWER_MS = 50 * 60 * 1000 // 50 minutes
const WINDOW_UPPER_MS = 70 * 60 * 1000 // 70 minutes

/**
 * A slightly wider pre-filter applied at DB query time to fetch candidates.
 * In-code deadline computation then narrows to the exact [50, 70]-minute window.
 */
const DB_PREFILTER_LOWER_MS = 45 * 60 * 1000 // 45 minutes
const DB_PREFILTER_UPPER_MS = 75 * 60 * 1000 // 75 minutes

/**
 * Returns the effective UTC deadline for an assignment.
 *
 * Since the 2026-07-17 timezone fix, `dueDate` is always a complete,
 * timezone-correct UTC timestamp (constructed by the browser client in the
 * user's real local timezone and converted to UTC via .toISOString() before
 * being stored). The `dueTime` column is now a display-only field ("21:30")
 * with no role in date math — `dueDate` is the single source of truth.
 */
export function computeDeadline(dueDate: Date): Date {
  return dueDate
}

/**
 * Finds all assignments whose deadline falls within [now+50min, now+70min],
 * skips those with a PENDING coppaConsentStatus, and sends each eligible one
 * an in-app ASSIGNMENT_DUE_SOON notification, then stamps `reminderSentAt`.
 *
 * Returns the count of reminders successfully dispatched.
 */
export async function checkAndSendReminders(): Promise<ReminderResult> {
  const now = new Date()
  const prefilterStart = new Date(now.getTime() + DB_PREFILTER_LOWER_MS)
  const prefilterEnd = new Date(now.getTime() + DB_PREFILTER_UPPER_MS)

  const candidates = await prisma.assignment.findMany({
    where: {
      completed: false,
      reminderSentAt: null,
      dueDate: {
        gte: prefilterStart,
        lte: prefilterEnd,
      },
    },
    include: {
      user: {
        select: { coppaConsentStatus: true },
      },
    },
  })

  const windowStart = now.getTime() + WINDOW_LOWER_MS
  const windowEnd = now.getTime() + WINDOW_UPPER_MS

  let processed = 0

  for (const assignment of candidates) {
    // Defensive COPPA filter — cron has no upstream auth/consent middleware
    if (assignment.user.coppaConsentStatus === 'PENDING') {
      logger.warn('assignment_reminder_skipped_coppa_pending', { assignmentId: assignment.id })
      continue
    }

    const deadline = computeDeadline(assignment.dueDate)
    const deadlineMs = deadline.getTime()

    if (deadlineMs < windowStart || deadlineMs > windowEnd) {
      // Computed deadline falls outside the exact 50–70 minute window
      continue
    }

    try {
      // Fire notification (never throws — failures are logged inside)
      await createAndSendNotification({
        userId: assignment.userId,
        fromUserId: assignment.userId,
        type: 'ASSIGNMENT_DUE_SOON',
        preview: `${assignment.title} is due in about an hour`,
      })

      // Mark reminder sent only after notification was dispatched
      await prisma.assignment.update({
        where: { id: assignment.id },
        data: { reminderSentAt: new Date() },
      })

      processed++
    } catch (err) {
      // A failure on one assignment (e.g., DB write to mark reminderSentAt) must
      // not abort the loop. Log with assignment ID only — no PII.
      logger.error('assignment_reminder_processing_failed', {
        assignmentId: assignment.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  logger.info('assignment_reminders_completed', { processed, candidates: candidates.length })

  return { processed }
}
