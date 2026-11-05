import { averageToLetter } from '../constants/gradeScale'
import type { NormalizedAssignment } from '../types/grades'

// Pure what-if grade math. Letter mapping reuses the app grade scale
// (constants/gradeScale, same one GpaSimulatorScreen uses). Nothing persists.

export interface WhatIfAssignment {
  id: string
  name: string
  /** null = not yet graded */
  earned: number | null
  possible: number
  category?: string
}

/** category name -> weight (any positive scale; normalised internally). Empty/undefined = unweighted points. */
export type CategoryWeights = Record<string, number>

export interface WhatIfState {
  /** hypothetical scores for existing assignments, by id */
  scores: Record<string, number>
  /** hypothetical future assignments */
  added: WhatIfAssignment[]
}

export type TargetLetter = 'A' | 'B' | 'C'
export const TARGET_MIN: Readonly<Record<TargetLetter, number>> = { A: 90, B: 80, C: 70 }

export function emptyWhatIf(): WhatIfState {
  return { scores: {}, added: [] }
}

export function isWhatIfEmpty(s: WhatIfState): boolean {
  return Object.keys(s.scores).length === 0 && s.added.length === 0
}

export function applyWhatIf(base: WhatIfAssignment[], state: WhatIfState): WhatIfAssignment[] {
  const merged = base.map((a) => (a.id in state.scores ? { ...a, earned: state.scores[a.id] } : a))
  return [...merged, ...state.added]
}

function isGraded(a: WhatIfAssignment): boolean {
  return a.earned !== null && Number.isFinite(a.earned) && a.possible > 0
}

/** Class average in percent, or null when nothing is graded. */
export function computeAverage(assignments: WhatIfAssignment[], weights?: CategoryWeights): number | null {
  const graded = assignments.filter(isGraded)
  if (graded.length === 0) return null

  const hasWeights = weights !== undefined && Object.keys(weights).length > 0
  if (!hasWeights) {
    const earned = graded.reduce((s, a) => s + (a.earned as number), 0)
    const possible = graded.reduce((s, a) => s + a.possible, 0)
    return (earned / possible) * 100
  }

  const byCat = new Map<string, { earned: number; possible: number }>()
  for (const a of graded) {
    const key = a.category !== undefined && a.category in weights ? a.category : ''
    const cur = byCat.get(key) ?? { earned: 0, possible: 0 }
    cur.earned += a.earned as number
    cur.possible += a.possible
    byCat.set(key, cur)
  }
  let weighted = 0
  let weightSum = 0
  for (const [key, v] of byCat) {
    const w = key === '' ? 0 : weights[key]
    if (w > 0) {
      weighted += (v.earned / v.possible) * w
      weightSum += w
    }
  }
  // Graded work only in categories without a weight: fall back to plain points.
  if (weightSum === 0) return computeAverage(assignments)
  return (weighted / weightSum) * 100
}

export function letterFor(average: number | null): string | null {
  return average === null ? null : averageToLetter(average)
}

export interface TargetResult {
  reachable: boolean
  /** minimum points to score on the target assignment (0 if already met); null when unreachable */
  needed: number | null
}

/**
 * Minimum score on `targetId` to reach `targetPercent` overall. The average is linear in the
 * target's score, so solve from the two endpoints (0 and full marks).
 */
export function minScoreNeeded(
  assignments: WhatIfAssignment[],
  targetId: string,
  targetPercent: number,
  weights?: CategoryWeights,
): TargetResult {
  const target = assignments.find((a) => a.id === targetId)
  if (!target || !(target.possible > 0)) return { reachable: false, needed: null }

  const at = (earned: number): number =>
    computeAverage(assignments.map((a) => (a.id === targetId ? { ...a, earned } : a)), weights) as number

  const low = at(0)
  const high = at(target.possible)
  if (high < targetPercent - 1e-9) return { reachable: false, needed: null }
  if (low >= targetPercent) return { reachable: true, needed: 0 }
  const needed = (target.possible * (targetPercent - low)) / (high - low)
  return { reachable: true, needed: Math.ceil(needed * 100 - 1e-9) / 100 }
}

// -- Mapping typed portal data -----------------------------------------------

/** Maps typed course assignments; score === null means ungraded. Skips items without points. */
export function parseAssignments(raw: readonly NormalizedAssignment[]): WhatIfAssignment[] {
  const out: WhatIfAssignment[] = []
  raw.forEach((r, i) => {
    if (r.totalPoints === null || !(r.totalPoints > 0)) return
    out.push({
      id: `a${i}`,
      name: r.name || `Assignment ${i + 1}`,
      earned: r.score,
      possible: r.totalPoints,
      category: r.category || undefined,
    })
  })
  return out
}
