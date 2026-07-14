// prompt-version: 1.0
// last-updated: 2026-07-14
// author: ai-engineer
//
// Classifies an assignment as HIGH / MEDIUM / LOW priority using an LLM call.
// All inputs are assignment metadata only — no student PII enters the prompt.
// Falls back to MEDIUM on any LLM error or invalid response.

import { getAiClient, getAiModel } from '../lib/aiClient'
import { prisma } from '../lib/prisma'
import { logger } from '../common/logger'
import { writeAuditLog } from '../lib/auditLog'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AssignmentPriority = 'HIGH' | 'MEDIUM' | 'LOW'

export interface AssignmentInput {
  title: string
  subject: string
  dueDate: Date
  estimatedMinutes?: number | null
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const VALID_PRIORITIES = new Set<AssignmentPriority>(['HIGH', 'MEDIUM', 'LOW'])

function isValidPriority(value: string): value is AssignmentPriority {
  return VALID_PRIORITIES.has(value as AssignmentPriority)
}

function buildSystemPrompt(): string {
  return `You are a student planner assistant. Your only job is to classify an assignment as HIGH, MEDIUM, or LOW priority.

Classification criteria:
- HIGH: due within 24 hours, OR estimated time greater than 90 minutes, OR subject is a core class (Math, Science, English, History) with less than 48 hours until due
- MEDIUM: due in 24–72 hours, or notably time-consuming but not imminent
- LOW: due more than 72 hours away and estimated time is short or unknown

Reply with ONLY the single word HIGH, MEDIUM, or LOW — no punctuation, no explanation, no other text.`
}

function buildUserMessage(input: AssignmentInput): string {
  const daysUntilDue = +((input.dueDate.getTime() - Date.now()) / 86400000).toFixed(1)
  const parts: string[] = [
    `title: ${input.title}`,
    `subject: ${input.subject}`,
    `daysUntilDue: ${daysUntilDue}`,
  ]
  if (input.estimatedMinutes != null) {
    parts.push(`estimatedMinutes: ${input.estimatedMinutes}`)
  }
  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// Primary scoring function
// ---------------------------------------------------------------------------

// FERPA NOTE: inputs are assignment metadata only (title, subject, due date, estimated time) — no student PII. Verify OpenRouter/NVIDIA ToS prohibits training on submitted data before this ships to real users.
export async function scoreAssignmentPriority(
  input: AssignmentInput,
): Promise<AssignmentPriority> {
  try {
    const response = await getAiClient().chat.completions.create({
      model: getAiModel(),
      max_tokens: 10,
      // Force deterministic classification — random sampling caused
      // inconsistent results for identical inputs during manual testing.
      temperature: 0,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserMessage(input) },
      ],
    })

    const raw = response.choices[0]?.message?.content ?? ''
    const candidate = raw.trim().toUpperCase()

    if (isValidPriority(candidate)) {
      return candidate
    }

    // The model returned something unexpected (extra text, empty string, etc.)
    logger.warn('assignment_priority_scorer_unexpected_response', {
      feature: 'assignmentPriorityScorer',
      rawLength: raw.length,
    })
    return 'MEDIUM'
  } catch (error) {
    logger.warn('assignment_priority_scorer_llm_error', {
      feature: 'assignmentPriorityScorer',
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      // errorCode included for transport-level debugging; never the assignment
      // title or any user-identifying value.
      errorCode: error instanceof Error ? (error as NodeJS.ErrnoException).code ?? null : null,
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    return 'MEDIUM'
  }
}

// ---------------------------------------------------------------------------
// Persist helper — called by the route layer (batch or fire-and-forget)
// ---------------------------------------------------------------------------

export async function scoreSingleAssignmentPriority(
  assignmentId: number,
  userId: number,
  input: AssignmentInput,
): Promise<void> {
  try {
    const priority = await scoreAssignmentPriority(input)

    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { priority },
    })

    await writeAuditLog({
      userId,
      resourceType: 'ASSIGNMENT',
      resourceId: String(assignmentId),
      action: 'AI_PRIORITY_SCORED',
      // This function is called server-side (background/batch), not from an
      // HTTP request handler, so there is no client IP available. 'system'
      // signals an internal automated write, consistent with how other
      // server-side audit writes in this codebase handle the field.
      ipAddress: 'system',
    })
  } catch (error) {
    // Never throw — callers may fire-and-forget and a thrown error would
    // silently swallow the parent request's response or crash a worker.
    logger.warn('assignment_priority_scorer_persist_error', {
      feature: 'assignmentPriorityScorer',
      assignmentId,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    })
  }
}
