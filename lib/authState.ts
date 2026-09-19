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

import { markWebAuthed, clearWebAuthed, isWebAuthed, silentRefresh } from './api'

// BroadcastChannel for cross-tab logout signalling (replaces storage-event on ns_token)
const authChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('ns_auth')
  : null

/**
 * Call once on app boot. Returns true if a valid session was found.
 *
 * Delegates to silentRefresh() from api.ts so both the mount-time check and
 * the reactive 401-retry path share the same in-flight dedup lock
 * (_refreshPromise). This prevents the race where two concurrent refreshes
 * each present the same refresh token to the backend: the backend rotates
 * tokens on use, so the second caller arrives with an already-revoked token
 * and gets INVALID_TOKEN, causing cookies to be cleared and the user to be
 * bounced to /login.
 *
 * Fail-closed guarantee: silentRefresh() calls clearWebAuthed() on any
 * failure (network error, HTTP error, revoked token) and returns false. The
 * caller (AppShell.checkAuth) redirects to /login on false.
 */
export async function initWebAuth(): Promise<boolean> {
  if (isWebAuthed()) return true
  return silentRefresh()
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
