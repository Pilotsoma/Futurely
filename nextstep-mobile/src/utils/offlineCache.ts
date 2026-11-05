import AsyncStorage from '@react-native-async-storage/async-storage'

import { formatLastSynced } from '../features/assignments/plannerSync'

export type CacheName = 'grades' | 'planner' | 'dashboard'

export interface CacheEntry<T> {
  savedAt: string // ISO
  data: T
}

const PREFIX = 'futurely.cache.'

export function cacheKey(userId: string | number, name: CacheName): string {
  return `${PREFIX}${userId}.${name}`
}

export async function getCache<T>(userId: string | number, name: CacheName): Promise<CacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId, name))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CacheEntry<T>>
    return typeof parsed.savedAt === 'string' && parsed.data !== undefined
      ? { savedAt: parsed.savedAt, data: parsed.data }
      : null
  } catch {
    return null
  }
}

export async function setCache<T>(userId: string | number, name: CacheName, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { savedAt: new Date().toISOString(), data }
    await AsyncStorage.setItem(cacheKey(userId, name), JSON.stringify(entry))
  } catch {
    // Cache is best-effort.
  }
}

/** Removes every cache key for this user (used on logout). */
export async function clearCache(userId: string | number): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys()
    const mine = keys.filter((key) => key.startsWith(`${PREFIX}${userId}.`))
    if (mine.length > 0) await AsyncStorage.multiRemove(mine)
  } catch {
    // Best-effort.
  }
}

export function lastUpdatedLabel(savedAt: string | null): string | null {
  return savedAt ? `Last updated ${formatLastSynced(savedAt, new Date())}` : null
}
