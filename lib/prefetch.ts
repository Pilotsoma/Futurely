import { type StudentData, api } from './api'

let _promise: Promise<StudentData | null> | null = null

/** Called by the layout immediately after initWebAuth() so the heavy
 *  /students/me query runs in parallel with authMe instead of after it. */
export function startStudentPrefetch(): void {
  _promise = api.me().catch(() => null)
}

/** Called once by the dashboard to grab the in-flight promise.
 *  Returns null if the prefetch wasn't started (e.g. direct nav). */
export function consumeStudentPrefetch(): Promise<StudentData | null> | null {
  const p = _promise
  _promise = null
  return p
}
