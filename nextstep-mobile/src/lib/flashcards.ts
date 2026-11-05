export type CardResult = 'known' | 'learning'

/** Ids of cards the user has marked, per result. A card is in at most one list. */
export interface FlashcardProgress {
  known: number[]
  learning: number[]
}

export const emptyProgress: FlashcardProgress = { known: [], learning: [] }

export function markCard(progress: FlashcardProgress, id: number, result: CardResult): FlashcardProgress {
  const next: FlashcardProgress = {
    known: progress.known.filter((x) => x !== id),
    learning: progress.learning.filter((x) => x !== id),
  }
  next[result] = [...next[result], id]
  return next
}

export interface ProgressSummary {
  known: number
  learning: number
  remaining: number
  done: boolean
}

export function summarizeProgress(progress: FlashcardProgress, total: number): ProgressSummary {
  const known = progress.known.length
  const learning = progress.learning.length
  const remaining = Math.max(0, total - known - learning)
  return { known, learning, remaining, done: total > 0 && remaining === 0 }
}

/** Fisher-Yates over a copy; `rng` is injectable for deterministic tests. */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}
