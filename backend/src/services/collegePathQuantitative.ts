import {
  predictBatch,
  computeTier,
  ModelServiceUnavailableError,
  type BatchAdjustment,
  type AdjustableField,
  type AdmissionTier,
} from './collegeProbability'
import { logger } from '../common/logger'

// Re-export so route handlers can reference it without importing from two places.
export { ModelServiceUnavailableError }

// ── Constants ─────────────────────────────────────────────────────────────────

const SAT_MAX = 1600
const ACT_MAX = 36
const GPA_MAX = 4.0

const SAT_DELTAS = [50, 100, 150] as const
const ACT_DELTAS = [1, 2, 3] as const
const GPA_DELTAS = [0.1, 0.2] as const

// ── Output type ───────────────────────────────────────────────────────────────

export interface QuantitativeStep {
  type: 'quantitative'
  title: string
  description: string
  /** Change in probability (percentage points) relative to baseline */
  percentBoost: number
  source: 'model'
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Build candidate adjustments for a single stat field.
 * Skips any new value that exceeds the cap.
 */
function buildCandidates(
  field: AdjustableField,
  currentValue: number,
  deltas: readonly number[],
  cap: number
): BatchAdjustment[] {
  const candidates: BatchAdjustment[] = []
  for (const delta of deltas) {
    const newValue = parseFloat((currentValue + delta).toFixed(2))
    if (newValue <= cap) {
      candidates.push({ field, newValue })
    }
  }
  return candidates
}

/**
 * From a list of (probability, adjustment) pairs for a single stat, select:
 * 1. The smallest delta whose probability crosses into a strictly higher tier
 *    than baseline (first tier-crossing step).
 * 2. The largest/stretch delta regardless of tier (maximum delta step).
 *
 * Returns at most 2 results with duplicates collapsed (when the tier-crosser
 * and the stretch are the same adjustment).
 */
function selectStepsForStat(
  candidates: BatchAdjustment[],
  probabilities: number[],
  baselineTier: AdmissionTier,
  baseline: number
): Array<{ adjustment: BatchAdjustment; probability: number }> {
  if (candidates.length === 0) return []

  // Pair each candidate with its resulting probability
  const paired = candidates.map((adj, i) => ({
    adjustment: adj,
    probability: probabilities[i] ?? baseline,
  }))

  let tierCrosser: { adjustment: BatchAdjustment; probability: number } | null = null
  for (const p of paired) {
    if (computeTier(p.probability) !== baselineTier) {
      tierCrosser = p
      break // smallest delta first due to SAT_DELTAS/ACT_DELTAS/GPA_DELTAS ordering
    }
  }

  const stretch = paired[paired.length - 1]

  // Deduplicate: if tier-crosser and stretch are the same adjustment, return only one
  if (
    tierCrosser &&
    stretch &&
    tierCrosser.adjustment.field === stretch.adjustment.field &&
    tierCrosser.adjustment.newValue === stretch.adjustment.newValue
  ) {
    return [tierCrosser]
  }

  const selected: Array<{ adjustment: BatchAdjustment; probability: number }> = []
  if (tierCrosser) selected.push(tierCrosser)
  if (stretch) selected.push(stretch)
  return selected
}

function formatStat(field: AdjustableField, newValue: number): string {
  switch (field) {
    case 'studentSat': return `SAT to ${Math.round(newValue)}`
    case 'studentAct': return `ACT to ${Math.round(newValue)}`
    case 'studentGpa': return `GPA to ${newValue.toFixed(2)}`
  }
}

function formatStatLabel(field: AdjustableField): string {
  switch (field) {
    case 'studentSat': return 'SAT'
    case 'studentAct': return 'ACT'
    case 'studentGpa': return 'GPA'
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface CollegePathQuantitativeInput {
  studentSat: number
  studentAct: number | null
  studentGpa: number
  avgSat: number
  avgAct: number
  avgGpa: number
  /** 0-1 decimal */
  acceptanceRate: number
}

/**
 * Calls the model's /predict-batch endpoint once with all candidate stat
 * adjustments, then selects up to 2 steps per stat (≤ 6 total, fewer when
 * ACT is null or no qualifying adjustments exist).
 *
 * Throws ModelServiceUnavailableError on model service failure — callers
 * (the route handler) are responsible for treating this as a 503 response.
 */
export async function getQuantitativeSteps(
  input: CollegePathQuantitativeInput
): Promise<QuantitativeStep[]> {
  const { studentSat, studentAct, studentGpa, avgSat, avgAct, avgGpa, acceptanceRate } = input

  // Build all candidate adjustments, skipping those exceeding the cap
  const satCandidates = buildCandidates('studentSat', studentSat, SAT_DELTAS, SAT_MAX)
  // Skip ACT entirely if the student has no ACT score
  const actCandidates = studentAct !== null
    ? buildCandidates('studentAct', studentAct, ACT_DELTAS, ACT_MAX)
    : []
  const gpaCandidates = buildCandidates('studentGpa', studentGpa, GPA_DELTAS, GPA_MAX)

  const allAdjustments: BatchAdjustment[] = [
    ...satCandidates,
    ...actCandidates,
    ...gpaCandidates,
  ]

  if (allAdjustments.length === 0) {
    logger.info('college_path_quantitative_no_candidates', {
      studentSat,
      studentAct,
      studentGpa,
    })
    return []
  }

  // Single batch call — ModelServiceUnavailableError propagates to caller
  const batchResult = await predictBatch({
    studentSat,
    studentAct,
    studentGpa,
    avgSat,
    avgAct,
    avgGpa,
    acceptanceRate,
    adjustments: allAdjustments,
  })

  const { baseline, results } = batchResult
  const baselineTier = computeTier(baseline)

  // Map results back to adjustments by index within each stat group
  const satCount = satCandidates.length
  const actCount = actCandidates.length

  const satProbs = results.slice(0, satCount).map(r => r.probability)
  const actProbs = results.slice(satCount, satCount + actCount).map(r => r.probability)
  const gpaProbs = results.slice(satCount + actCount).map(r => r.probability)

  // Select ≤2 steps per stat
  const satSelected = selectStepsForStat(satCandidates, satProbs, baselineTier, baseline)
  const actSelected = selectStepsForStat(actCandidates, actProbs, baselineTier, baseline)
  const gpaSelected = selectStepsForStat(gpaCandidates, gpaProbs, baselineTier, baseline)

  const chosen = [...satSelected, ...actSelected, ...gpaSelected]

  const steps: QuantitativeStep[] = chosen.map(({ adjustment, probability }) => {
    const label = formatStatLabel(adjustment.field)
    const statDisplay = formatStat(adjustment.field, adjustment.newValue)
    const fromPct = Math.round(baseline)
    const toPct = Math.round(probability)
    return {
      type: 'quantitative' as const,
      title: `Raise ${statDisplay}`,
      description: `Would raise your ${label} from your current score, increasing your admission probability from ${fromPct}% to ${toPct}%.`,
      percentBoost: probability - baseline,
      source: 'model' as const,
    }
  })

  logger.info('college_path_quantitative_steps_generated', {
    baseline,
    baselineTier,
    stepCount: steps.length,
  })

  return steps
}
