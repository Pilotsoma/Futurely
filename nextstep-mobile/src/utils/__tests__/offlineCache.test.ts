import { beforeEach, describe, expect, it } from '@jest/globals'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { clearCache, getCache, lastUpdatedLabel, setCache } from '../offlineCache'

jest.mock(
  '@react-native-async-storage/async-storage',
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

describe('offlineCache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
  })

  it('round-trips data per user and name', async () => {
    await setCache(1, 'grades', { gpa: 3.9 })
    expect((await getCache<{ gpa: number }>(1, 'grades'))?.data).toEqual({ gpa: 3.9 })
    expect(await getCache(2, 'grades')).toBeNull()
    expect(await getCache(1, 'planner')).toBeNull()
  })

  it('returns null for corrupt entries', async () => {
    await AsyncStorage.setItem('futurely.cache.1.grades', '{nope')
    expect(await getCache(1, 'grades')).toBeNull()
  })

  it('clears only that user cache keys', async () => {
    await setCache(1, 'grades', 1)
    await setCache(1, 'dashboard', 2)
    await setCache(12, 'grades', 3)
    await AsyncStorage.setItem('futurely.gpaHistory.1', '[]')
    await clearCache(1)
    expect(await getCache(1, 'grades')).toBeNull()
    expect(await getCache(1, 'dashboard')).toBeNull()
    expect(await getCache(12, 'grades')).not.toBeNull()
    expect(await AsyncStorage.getItem('futurely.gpaHistory.1')).toBe('[]')
  })

  it('formats the label', () => {
    expect(lastUpdatedLabel(null)).toBeNull()
    expect(lastUpdatedLabel(new Date().toISOString())).toBe('Last updated just now')
  })
})
