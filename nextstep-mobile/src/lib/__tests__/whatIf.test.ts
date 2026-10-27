import {
  applyWhatIf, computeAverage, emptyWhatIf, isWhatIfEmpty, letterFor, minScoreNeeded, TARGET_MIN,
  parseAssignments, type WhatIfAssignment, type WhatIfState,
} from '../whatIf'

const base: WhatIfAssignment[] = [
  { id: 'a0', name: 'HW 1', earned: 18, possible: 20, category: 'Homework' },
  { id: 'a1', name: 'Test 1', earned: 70, possible: 100, category: 'Tests' },
  { id: 'a2', name: 'Final', earned: null, possible: 100, category: 'Tests' },
]
const weights = { Homework: 40, Tests: 60 }

describe('computeAverage', () => {
  it('unweighted: pools points, ignoring ungraded', () => {
    expect(computeAverage(base)).toBeCloseTo((88 / 120) * 100)
  })
  it('weighted: averages per category then applies weights', () => {
    expect(computeAverage(base, weights)).toBeCloseTo(0.9 * 40 + 0.7 * 60)
  })
  it('returns null when nothing is graded', () => {
    expect(computeAverage([base[2]])).toBeNull()
  })
  it('letter follows the app scale', () => {
    expect(letterFor(89.9)).toBe('B')
    expect(letterFor(null)).toBeNull()
  })
})

describe('applyWhatIf / reset', () => {
  it('hypotheticals change the projection; reset restores the real average', () => {
    const real = computeAverage(base, weights) as number
    const state: WhatIfState = {
      scores: { a2: 100 },
      added: [{ id: 'h1', name: 'Quiz', earned: 10, possible: 10, category: 'Homework' }],
    }
    const projected = computeAverage(applyWhatIf(base, state), weights) as number
    expect(projected).toBeGreaterThan(real)
    expect(isWhatIfEmpty(state)).toBe(false)

    const reset = emptyWhatIf()
    expect(isWhatIfEmpty(reset)).toBe(true)
    expect(computeAverage(applyWhatIf(base, reset), weights)).toBeCloseTo(real)
  })
})

describe('minScoreNeeded', () => {
  it('unweighted: exact minimum for a B', () => {
    const r = minScoreNeeded(base, 'a2', TARGET_MIN.B)
    // (88 + x) / 220 = 0.8 -> x = 88
    expect(r.reachable).toBe(true)
    expect(r.needed).toBeCloseTo(88, 1)
  })
  it('unweighted: A is not reachable (needs 110/100)', () => {
    expect(minScoreNeeded(base, 'a2', TARGET_MIN.A)).toEqual({ reachable: false, needed: null })
  })
  it('weighted: solves within the category', () => {
    const r = minScoreNeeded(base, 'a2', TARGET_MIN.B, weights)
    // 0.9*40 + t*60 = 80 -> t = 0.7333 -> (70 + x)/200 -> x = 76.67
    expect(r.needed).toBeCloseTo(76.67, 1)
    const check = computeAverage(applyWhatIf(base, { scores: { a2: r.needed as number }, added: [] }), weights) as number
    expect(check).toBeGreaterThanOrEqual(80 - 1e-6)
  })
  it('weighted: not reachable when full marks still fall short', () => {
    expect(minScoreNeeded(base, 'a2', TARGET_MIN.A, weights).reachable).toBe(false)
  })
  it('returns 0 when the target is already met', () => {
    expect(minScoreNeeded(base, 'a2', TARGET_MIN.C).needed).toBeCloseTo(66, 1)
    expect(minScoreNeeded(base, 'a2', 30).needed).toBe(0)
  })
})

describe('parseAssignments', () => {
  it('maps NormalizedAssignment, treating null score as ungraded and skipping no-point items', () => {
    const out = parseAssignments([
      { name: 'HW', category: 'Homework', score: 9, totalPoints: 10, percentage: '90', dateDue: '' },
      { name: 'Final', category: 'Tests', score: null, totalPoints: 100, percentage: '', dateDue: '' },
      { name: 'Bonus', category: '', score: 1, totalPoints: null, percentage: '', dateDue: '' },
    ])
    expect(out).toHaveLength(2)
    expect(out[1].earned).toBeNull()
    expect(computeAverage(out)).toBeCloseTo(90)
  })
})
