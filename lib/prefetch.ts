import { type StudentData, api } from './api'

let _promise: Promise<StudentData | null> | null = null

/**
 * Called by the layout immediately after initWebAuth() so the heavy
 * /students/me query runs in parallel with authMe instead of after it.
 *
 * Accepts an optional AbortSignal (from AppShell's useEffect cleanup).
 * If the signal fires before the fetch completes, the cached promise is
 * cleared so a stale result from a previous mount cycle is never consumed
 * by the next mount's dashboard.
 */
export function startStudentPrefetch(signal?: AbortSignal): void {
  const p = api.me().catch(() => null)
  _promise = p
  if (signal) {
    signal.addEventListener('abort', () => {
      // Only clear if our promise hasn't already been consumed or replaced
      if (_promise === p) _promise = null
    }, { once: true })
  }
}

/** Called once by the dashboard to grab the in-flight promise.
 *  Returns null if the prefetch wasn't started (e.g. direct nav). */
export function consumeStudentPrefetch(): Promise<StudentData | null> | null {
  const p = _promise
  _promise = null
  return p
}
