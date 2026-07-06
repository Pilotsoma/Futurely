/**
 * collegePathQualitative.ts — AI-estimated qualitative improvement steps
 *
 * Design overview (two-source model):
 *   This file produces AI-estimated qualitative steps (e.g. "lead a relevant
 *   extracurricular", "tailor your essay to X's stated values"). The sibling
 *   file collegePathQuantitative.ts produces model-calculated quantitative steps
 *   (e.g. "raise SAT to 1400"). Both sets are merged and returned by the
 *   POST /colleges/path route handler. Each step carries a `source` field
 *   ('ai_estimate' here, 'model' in the quantitative file) so the frontend can
 *   visually distinguish data-driven steps from AI-estimated ones.
 *
 * Impact-tier to percentBoost mapping:
 *   The Anthropic model returns an impactTier of 'Low', 'Medium', or 'High'.
 *   We map each tier to a rough midpoint constant (LOW_BOOST_MIDPOINT = 1.5,
 *   MEDIUM_BOOST_MIDPOINT = 4, HIGH_BOOST_MIDPOINT = 7). These are intentionally
 *   rough calibration values — adjust the three constants directly if the
 *   estimates feel systematically too high or too low. They are expressed in
 *   percentage-point units to be comparable with the quantitative steps' actual
 *   model-computed probability deltas.
 *
 * Caching strategy:
 *   AI responses are cached per (userId, collegeId) for 14 days. A SHA-256
 *   hash of the student's current SAT/ACT/GPA is stored alongside the cached
 *   steps; if that hash changes (student updated their stats), the cache is
 *   treated as stale and regenerated even if expiresAt hasn't elapsed yet.
 */

import crypto from 'crypto'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { logger } from '../common/logger'
import {
  generateCollegePathSteps,
  AnthropicServiceUnavailableError,
} from '../lib/anthropic'
import { writeAuditLog } from '../lib/auditLog'

// ── Impact-tier midpoints (percentage points) ─────────────────────────────────
// Adjust these constants to recalibrate how AI-estimated steps compare in
// magnitude to the quantitative steps produced by the model server.
const LOW_BOOST_MIDPOINT = 1.5
const MEDIUM_BOOST_MIDPOINT = 4
const HIGH_BOOST_MIDPOINT = 7

// ── Output type ───────────────────────────────────────────────────────────────

export interface QualitativeStep {
  type: 'qualitative'
  title: string
  description: string
  /** Estimated percentage-point boost, based on impactTier midpoint */
  percentBoost: number
  source: 'ai_estimate'
}

// ── Input type ────────────────────────────────────────────────────────────────

export interface CollegePathQualitativeInput {
  userId: number
  collegeId: number
  studentSat: number
  studentAct: number | null
  studentGpa: number
  collegeName: string
  avgSat: number
  avgAct: number
  avgGpa: number
  /** 0-1 decimal, e.g. 0.06 = 6% acceptance rate */
  acceptanceRate: number
  ipAddress: string
}

// ── Zod schema for validating the AI response ─────────────────────────────────

const AiStepSchema = z.array(
  z.object({
    title: z.string(),
    description: z.string(),
    impactTier: z.enum(['Low', 'Medium', 'High']),
  })
)

type AiStep = z.infer<typeof AiStepSchema>[number]

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeStudentStatsHash(
  studentSat: number,
  studentAct: number | null,
  studentGpa: number
): string {
  const raw = `${studentSat}:${studentAct ?? 'null'}:${studentGpa}`
  return crypto.createHash('sha256').update(raw).digest('hex')
}

/**
 * Strip markdown code fences and return the inner JSON string.
 * Mirrors the extractJson function in routes/ai.ts (not exported from there,
 * so duplicated here — do not refactor ai.ts to export it).
 */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  return fenced ? fenced[1].trim() : raw.trim()
}

function tierToBoost(tier: AiStep['impactTier']): number {
  switch (tier) {
    case 'Low':    return LOW_BOOST_MIDPOINT
    case 'Medium': return MEDIUM_BOOST_MIDPOINT
    case 'High':   return HIGH_BOOST_MIDPOINT
  }
}

function mapToQualitativeSteps(validated: z.infer<typeof AiStepSchema>): QualitativeStep[] {
  return validated.map(item => ({
    type: 'qualitative' as const,
    title: item.title,
    description: item.description,
    percentBoost: tierToBoost(item.impactTier),
    source: 'ai_estimate' as const,
  }))
}

/**
 * Validate that a value from the Prisma Json column is a valid QualitativeStep[].
 * Returns null if the shape doesn't match — caller falls back to regeneration.
 */
function validateCachedSteps(raw: unknown): QualitativeStep[] | null {
  const result = z.array(
    z.object({
      type: z.literal('qualitative'),
      title: z.string(),
      description: z.string(),
      percentBoost: z.number(),
      source: z.literal('ai_estimate'),
    })
  ).safeParse(raw)
  return result.success ? result.data : null
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns AI-estimated qualitative improvement steps for a student targeting
 * a specific college. Results are cached per (userId, collegeId) for 14 days
 * and invalidated when the student's SAT/ACT/GPA stats change.
 *
 * Never throws. On any AI failure (missing API key, network error, invalid
 * response shape), logs the error and returns [] so the quantitative steps
 * are still surfaced to the caller without interruption.
 */
export async function getQualitativeSteps(
  input: CollegePathQualitativeInput
): Promise<QualitativeStep[]> {
  const {
    userId,
    collegeId,
    studentSat,
    studentAct,
    studentGpa,
    collegeName,
    avgSat,
    avgAct,
    avgGpa,
    acceptanceRate,
    ipAddress,
  } = input

  const statsHash = computeStudentStatsHash(studentSat, studentAct, studentGpa)

  // ── Cache lookup ────────────────────────────────────────────────────────────
  try {
    const cached = await prisma.collegePathCache.findUnique({
      where: { userId_collegeId: { userId, collegeId } },
    })

    if (
      cached &&
      cached.expiresAt > new Date() &&
      cached.studentStatsHash === statsHash
    ) {
      const validated = validateCachedSteps(cached.steps)
      if (validated) {
        await writeAuditLog({
          userId,
          resourceType: 'college_path_cache',
          resourceId: String(collegeId),
          action: 'cache_hit',
          ipAddress,
        })
        return validated
      }
      // Shape mismatch — treat as cache miss and regenerate
      logger.warn('college_path_cache_shape_invalid', { userId, collegeId })
    }
  } catch (err: unknown) {
    logger.error('college_path_cache_lookup_failed', {
      error: err instanceof Error ? err.message : String(err),
      userId,
      collegeId,
    })
    // Non-fatal — fall through to generation
  }

  // ── AI generation ───────────────────────────────────────────────────────────
  let steps: QualitativeStep[] = []

  try {
    const raw = await generateCollegePathSteps({
      studentSat,
      studentAct,
      studentGpa,
      collegeName,
      avgSat,
      avgAct,
      avgGpa,
      acceptanceRate,
    })

    const extracted = extractJson(raw)
    const parsed: unknown = JSON.parse(extracted)
    const validation = AiStepSchema.safeParse(parsed)

    if (!validation.success) {
      logger.error('college_path_ai_response_invalid', {
        userId,
        collegeId,
        collegeName,
        zodError: validation.error.message,
      })
      return []
    }

    steps = mapToQualitativeSteps(validation.data)
  } catch (err: unknown) {
    if (err instanceof AnthropicServiceUnavailableError) {
      logger.warn('college_path_anthropic_unavailable', {
        userId,
        collegeId,
        collegeName,
        error: err.message,
      })
    } else {
      logger.error('college_path_ai_generation_failed', {
        userId,
        collegeId,
        collegeName,
        error: err instanceof Error ? err.message : String(err),
      })
    }
    // Do not throw — quantitative steps must still work with zero AI configuration
    return []
  }

  // ── Cache upsert ────────────────────────────────────────────────────────────
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  try {
    // Cast through Prisma.InputJsonValue to satisfy the Json column constraint.
    // JSON.parse(JSON.stringify(...)) round-trips to a plain JS structure that
    // matches the Prisma JSON input type at runtime.
    const stepsJson = JSON.parse(JSON.stringify(steps)) as Prisma.InputJsonValue
    await prisma.collegePathCache.upsert({
      where: { userId_collegeId: { userId, collegeId } },
      create: {
        userId,
        collegeId,
        steps: stepsJson,
        studentStatsHash: statsHash,
        generatedAt: now,
        expiresAt,
      },
      update: {
        steps: stepsJson,
        studentStatsHash: statsHash,
        generatedAt: now,
        expiresAt,
      },
    })
  } catch (err: unknown) {
    // Non-fatal — log but still return the steps we generated
    logger.error('college_path_cache_upsert_failed', {
      error: err instanceof Error ? err.message : String(err),
      userId,
      collegeId,
    })
  }

  await writeAuditLog({
    userId,
    resourceType: 'college_path_cache',
    resourceId: String(collegeId),
    action: 'generate',
    ipAddress,
  })

  return steps
}
