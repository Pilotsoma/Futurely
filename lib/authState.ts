/**
 * Web auth state — access token lives in module memory only (never localStorage).
 * Refresh token is persisted as an httpOnly cookie set by the backend.
 *
 * On page load call initWebAuth() to rehydrate the access token from the cookie.
 * Mobile clients use a separate path (AsyncStorage + Authorization header).
 */

import { setApiToken, clearApiToken, getApiToken } from './api'

const BASE = () => process.env.NEXT_PUBLIC_API_URL ?? ''

// BroadcastChannel for cross-tab logout signalling (replaces storage-event on ns_token)
const authChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('ns_auth')
  : null

/** Call once on app boot. Returns true if a valid session was found. */
export async function initWebAuth(): Promise<boolean> {
  if (getApiToken()) return true  // already loaded (e.g., just logged in)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    const res = await fetch(`${BASE()}/api/auth/refresh`, {
      method: 'POST',
      signal: controller.signal,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) return false

    const { data } = (await res.json()) as { data: { token: string } }
    setApiToken(data.token)
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

/** Store access token in memory after a successful login / register. */
export function setWebLogin(token: string): void {
  setApiToken(token)
}

/** Clear access token from memory and signal other tabs to do the same. */
export function clearWebAuth(): void {
  clearApiToken()
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
