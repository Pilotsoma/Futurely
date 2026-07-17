/**
 * AutonomousJobSchedulerService — enqueues and processes AutonomousAgentJob rows.
 *
 * Guardrails:
 * - All execution is gated by AUTONOMOUS_AGENTS_ENABLED=true env var.
 *   If unset or false, enqueueJobs() is a no-op and worker skips all jobs.
 * - Write tools are never dispatched in SYSTEM sessions — enforced by
 *   AgentExecutionService.dispatchTool before any tool runs.
 * - No PII in worker log lines — userId references only.
 * - COPPA check happens inside AgentExecutionService.startSession.
 *
 * Scheduling pattern:
 * - A setInterval (started from index.ts) polls for pending jobs every minute.
 * - Jobs are enqueued once per day by enqueueJobs() (also called from
 *   index.ts after server start, and scheduled at midnight + 7am via
 *   the same interval by checking the current hour).
 */

import { prisma } from '../../lib/prisma'
import { logger } from '../../common/logger'
import { startSession, completeSession } from './agentExecution.service'

export type JobTriggerType = 'NIGHTLY_GPA_CHECKIN' | 'PROACTIVE_PLANNER_NUDGE'

const WORKER_BATCH_SIZE = 20
const SYSTEM_IP = 'scheduler'

// ── Job enqueueing ────────────────────────────────────────────────────────────

/**
 * Enqueues autonomous jobs for all eligible users if they haven't been
 * scheduled already for today's window.
 *
 * Eligible users: autonomousConsentAcceptedAt IS NOT NULL.
 * COPPA check: handled by AgentExecutionService when the job executes.
 *
 * Called at server startup and whenever the scheduler checks the hour.
 */
export async function enqueueJobsForToday(): Promise<void> {
  if (process.env.AUTONOMOUS_AGENTS_ENABLED !== 'true') {
    logger.info('autonomous_scheduler_flag_off', { action: 'enqueue_skipped' })
    return
  }

  const now = new Date()
  const todayMidnightUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const today7amUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 7))

  // Find eligible users (opted in to autonomous features)
  const eligibleUsers = await prisma.user.findMany({
    where: { autonomousConsentAcceptedAt: { not: null }, deletedAt: null },
    select: { id: true },
  })

  if (eligibleUsers.length === 0) {
    logger.info('autonomous_enqueue_no_eligible_users', { date: todayMidnightUtc.toISOString() })
    return
  }

  const jobsToCreate: Array<{
    userId: number
    module: string
    triggerType: JobTriggerType
    scheduledAt: Date
  }> = []

  for (const user of eligibleUsers) {
    // Check if today's NIGHTLY_GPA_CHECKIN already exists for this user
    const existingNightly = await prisma.autonomousAgentJob.findFirst({
      where: {
        userId: user.id,
        triggerType: 'NIGHTLY_GPA_CHECKIN',
        scheduledAt: { gte: todayMidnightUtc },
      },
      select: { id: true },
    })

    if (existingNightly === null) {
      jobsToCreate.push({
        userId: user.id,
        module: 'GPA',
        triggerType: 'NIGHTLY_GPA_CHECKIN',
        scheduledAt: todayMidnightUtc,
      })
    }

    // Check if today's PROACTIVE_PLANNER_NUDGE already exists
    const existingNudge = await prisma.autonomousAgentJob.findFirst({
      where: {
        userId: user.id,
        triggerType: 'PROACTIVE_PLANNER_NUDGE',
        scheduledAt: { gte: todayMidnightUtc },
      },
      select: { id: true },
    })

    if (existingNudge === null) {
      jobsToCreate.push({
        userId: user.id,
        module: 'PLANNER',
        triggerType: 'PROACTIVE_PLANNER_NUDGE',
        scheduledAt: today7amUtc,
      })
    }
  }

  if (jobsToCreate.length === 0) {
    logger.info('autonomous_enqueue_already_done', {
      date: todayMidnightUtc.toISOString(),
      userCount: eligibleUsers.length,
    })
    return
  }

  await prisma.autonomousAgentJob.createMany({ data: jobsToCreate })

  logger.info('autonomous_enqueue_complete', {
    jobsCreated: jobsToCreate.length,
    userCount: eligibleUsers.length,
  })
}

// ── Job processing worker ─────────────────────────────────────────────────────

let isWorkerRunning = false

/**
 * Processes pending autonomous jobs in batches of 20.
 * Guards against concurrent execution with an in-process flag.
 *
 * No PII in log lines. Job IDs and status codes only.
 */
export async function runWorkerBatch(): Promise<void> {
  if (process.env.AUTONOMOUS_AGENTS_ENABLED !== 'true') {
    return
  }

  if (isWorkerRunning) {
    logger.info('autonomous_worker_already_running', {})
    return
  }

  isWorkerRunning = true

  try {
    const now = new Date()
    const pendingJobs = await prisma.autonomousAgentJob.findMany({
      where: { status: 'PENDING', scheduledAt: { lte: now } },
      orderBy: { scheduledAt: 'asc' },
      take: WORKER_BATCH_SIZE,
      select: {
        id: true,
        userId: true,
        module: true,
        triggerType: true,
      },
    })

    if (pendingJobs.length === 0) return

    logger.info('autonomous_worker_processing', { batchSize: pendingJobs.length })

    for (const job of pendingJobs) {
      await processJob(job.id, job.userId, job.module, job.triggerType)
    }
  } catch (err) {
    logger.error('autonomous_worker_batch_error', {
      error: err instanceof Error ? err.message : String(err),
    })
  } finally {
    isWorkerRunning = false
  }
}

async function processJob(
  jobId: number,
  userId: number | null,
  module: string,
  triggerType: string,
): Promise<void> {
  // Mark job as RUNNING
  await prisma.autonomousAgentJob.update({
    where: { id: jobId },
    data: { status: 'RUNNING', executedAt: new Date() },
  })

  try {
    // Skip jobs with no userId (shouldn't happen with current enqueue logic,
    // but guard defensively)
    if (userId === null) {
      await prisma.autonomousAgentJob.update({
        where: { id: jobId },
        data: { status: 'SKIPPED_FLAG_OFF', result: { reason: 'no_user_id' } },
      })
      return
    }

    // Validate module is a known AgentModule
    const validModules = ['PLANNER', 'GPA', 'ROADMAP', 'CHAT'] as const
    if (!(validModules as readonly string[]).includes(module)) {
      await prisma.autonomousAgentJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', result: { reason: 'unknown_module', module } },
      })
      return
    }

    const typedModule = module as typeof validModules[number]

    const sessionResult = await startSession(
      userId,
      typedModule,
      'SYSTEM',
      undefined,
      SYSTEM_IP,
      jobId,
    )

    // Handle flag-off skip
    if (sessionResult.blockedReason === 'SKIPPED_FLAG_OFF') {
      await prisma.autonomousAgentJob.update({
        where: { id: jobId },
        data: { status: 'SKIPPED_FLAG_OFF' },
      })
      return
    }

    // Handle COPPA block
    if (sessionResult.blockedReason === 'COPPA_GATE') {
      await prisma.autonomousAgentJob.update({
        where: { id: jobId },
        data: { status: 'SKIPPED_COPPA' },
      })
      return
    }

    const sessionId = sessionResult.sessionId

    // For SYSTEM sessions, dispatch only read tools appropriate to the trigger.
    // Write tools are blocked at the AgentExecutionService level.
    // The actual tool dispatch and response generation is handled by the
    // ai-engineer's orchestration layer (Tasks 7-9). For now we create a
    // completed session with a placeholder — the orchestrator will replace this.
    const summaryMessage = buildSystemSummaryMessage(triggerType)

    await completeSession(sessionId, summaryMessage, 'COMPLETED')

    await prisma.autonomousAgentJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        result: { sessionId, triggerType, summary: summaryMessage },
      },
    })

    logger.info('autonomous_job_completed', { jobId, triggerType, sessionId })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)

    logger.error('autonomous_job_failed', { jobId, triggerType, error: errorMessage })

    await prisma.autonomousAgentJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', result: { error: errorMessage } },
    }).catch(() => {
      // Swallow secondary update failure to avoid masking original error in logs
    })
  }
}

/**
 * Builds a placeholder summary for SYSTEM session final responses.
 * The ai-engineer's orchestration layer (Tasks 7-9) will replace this with
 * actual tool-derived insights.
 */
function buildSystemSummaryMessage(triggerType: string): string {
  switch (triggerType) {
    case 'NIGHTLY_GPA_CHECKIN':
      return 'Nightly GPA check-in completed. Your academic data has been reviewed.'
    case 'PROACTIVE_PLANNER_NUDGE':
      return 'Daily planner review completed. Check your upcoming assignments.'
    default:
      return 'Autonomous agent job completed.'
  }
}

// ── Scheduler loop ────────────────────────────────────────────────────────────

let schedulerIntervalId: ReturnType<typeof setInterval> | null = null

/**
 * Starts the autonomous job scheduler.
 *
 * Called once from index.ts after server start.
 * Uses setInterval (appropriate for Render's persistent web service deployment).
 * Vercel/serverless: this interval would not survive invocation boundaries —
 * if the project ever moves to serverless, replace with an external cron trigger.
 */
export function startScheduler(): void {
  if (schedulerIntervalId !== null) {
    logger.warn('autonomous_scheduler_already_started', {})
    return
  }

  // Run worker batch every 60 seconds
  schedulerIntervalId = setInterval(() => {
    const nowUtc = new Date()
    const hourUtc = nowUtc.getUTCHours()
    const minuteUtc = nowUtc.getUTCMinutes()

    // Enqueue daily jobs at midnight UTC (hour=0, first 5-minute window)
    // and at 7am UTC (hour=7, first 5-minute window)
    if ((hourUtc === 0 || hourUtc === 7) && minuteUtc < 5) {
      enqueueJobsForToday().catch(err => {
        logger.error('autonomous_enqueue_error', {
          error: err instanceof Error ? err.message : String(err),
        })
      })
    }

    // Always run the worker batch to process pending jobs
    runWorkerBatch().catch(err => {
      logger.error('autonomous_worker_error', {
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }, 60 * 1000)

  logger.info('autonomous_scheduler_started', {
    enabled: process.env.AUTONOMOUS_AGENTS_ENABLED === 'true',
  })
}

export function stopScheduler(): void {
  if (schedulerIntervalId !== null) {
    clearInterval(schedulerIntervalId)
    schedulerIntervalId = null
    logger.info('autonomous_scheduler_stopped', {})
  }
}
