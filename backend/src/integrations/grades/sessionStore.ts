import { randomUUID } from 'crypto'

const TTL_MS = 30 * 60 * 1000 // 30 minutes

export type SchoolSystemType = 'HAC' | 'PowerSchool'

export interface StoredSession {
  sessionData: string // Serialized cookie jar JSON
  systemType: SchoolSystemType
  baseUrl: string
  userId: number
  createdAt: number
  expiresAt: number
}

const store = new Map<string, StoredSession>()

// Purge expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of store.entries()) {
    if (val.expiresAt < now) store.delete(key)
  }
}, 5 * 60 * 1000).unref()

export function saveSession(
  userId: number,
  systemType: SchoolSystemType,
  baseUrl: string,
  sessionData: string
): string {
  // One active session per user — overwrite any existing one
  for (const [key, val] of store.entries()) {
    if (val.userId === userId) store.delete(key)
  }
  const token = randomUUID()
  store.set(token, {
    sessionData,
    systemType,
    baseUrl,
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + TTL_MS,
  })
  return token
}

export function getSessionByToken(token: string): StoredSession | null {
  const s = store.get(token)
  if (!s) return null
  if (s.expiresAt < Date.now()) {
    store.delete(token)
    return null
  }
  return s
}

export function getSessionByUserId(userId: number): { token: string; session: StoredSession } | null {
  for (const [token, s] of store.entries()) {
    if (s.userId === userId) {
      if (s.expiresAt < Date.now()) {
        store.delete(token)
        return null
      }
      return { token, session: s }
    }
  }
  return null
}

export function deleteSessionByUserId(userId: number): void {
  for (const [key, val] of store.entries()) {
    if (val.userId === userId) store.delete(key)
  }
}

/**
 * Save a session to the in-memory store AND optionally persist to DB.
 */
export async function saveSessionWithPersistence(
  userId: number,
  systemType: SchoolSystemType,
  baseUrl: string,
  sessionData: string,
  prismaUpdate: (token: string, sessionData: string) => Promise<void>
): Promise<string> {
  const token = saveSession(userId, systemType, baseUrl, sessionData)
  try {
    await prismaUpdate(token, sessionData)
  } catch (e) {
    console.warn('[SESSION STORE] Failed to persist session to DB:',
      e instanceof Error ? e.message : String(e))
  }
  return token
}

/**
 * Restore a session into the in-memory store from a cached serialized cookie jar.
 * Returns the new session token, or null if cache is invalid.
 */
export function restoreSessionFromCache(
  userId: number,
  systemType: SchoolSystemType,
  baseUrl: string,
  cachedSessionData: string
): string | null {
  try {
    JSON.parse(cachedSessionData)
    return saveSession(userId, systemType, baseUrl, cachedSessionData)
  } catch {
    return null
  }
}
