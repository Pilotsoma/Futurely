import { describe, expect, it } from '@jest/globals'

import { toDueDateIso } from '../assignmentsApi'

jest.mock(
  '@react-native-async-storage/async-storage',
  // Jest's official AsyncStorage mock is CommonJS-only.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

describe('toDueDateIso', () => {
  it('turns a date-only string into end of that local day', () => {
    const iso = toDueDateIso('2026-03-31')
    const local = new Date(iso)
    expect([local.getFullYear(), local.getMonth(), local.getDate()]).toEqual([2026, 2, 31])
    expect([local.getHours(), local.getMinutes()]).toEqual([23, 59])
  })

  it('uses dueTime when given', () => {
    const local = new Date(toDueDateIso('2026-03-31', '08:30'))
    expect([local.getDate(), local.getHours(), local.getMinutes()]).toEqual([31, 8, 30])
  })

  it('passes full timestamps through unchanged', () => {
    expect(toDueDateIso('2026-03-31T12:00:00.000Z')).toBe('2026-03-31T12:00:00.000Z')
  })
})
