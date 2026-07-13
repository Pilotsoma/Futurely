/**
 * Web auth state — the raw JWT is never held in JS at all. Auth is entirely
 * via the httpOnly access_token/refresh_token cookies the backend sets; the
 * backend also omits the token from response bodies for web (X-Client-Platform
 * header), so there's nothing here for XSS, a browser extension, or a network
 * trace to pick up.
 *
 * On page load call initWebAuth() to confirm/refresh the cookie session.
 * Mobile clients use a separate path (AsyncStorage + Authorization header) and
 * are unaffected by any of this.
 */

import { markWebAuthed, clearWebAuthed, isWebAuthed } from './api'

const BASE = () => process.env.NEXT_PUBLIC_API_URL ?? ''

// BroadcastChannel for cross-tab logout signalling (replaces storage-event on ns_token)
const authChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('ns_auth')
  : null

/** Call once on app boot. Returns true if a valid session was found. */
export async function initWebAuth(): Promise<boolean> {
  if (isWebAuthed()) return true

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    const res = await fetch(`${BASE()}/api/auth/refresh`, {
      method: 'POST',
      signal: controller.signal,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'web' },
    })
    if (!res.ok) return false

    markWebAuthed()
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

/** Mark the session authenticated after a successful login / register. */
export function setWebLogin(): void {
  markWebAuthed()
}

/** Clear auth state and signal other tabs to do the same. */
export function clearWebAuth(): void {
  clearWebAuthed()
  authChannel?.postMessage({ type: 'LOGOUT' })
}

/** Listen for cross-tab logout events. Returns a cleanup function. */
export function onCrossTabLogout(callback: () => void): () => void {
  if (!authChannel) return () => {}
  const handler = (e: MessageEvent<{ type: string }>) => {
    if (e.data?.type === 'LOGOUT') callback()
  }
  authChannel.addEventListener('message', handler)
  return () => authChannel.removeEventListener('message', handler)
}
