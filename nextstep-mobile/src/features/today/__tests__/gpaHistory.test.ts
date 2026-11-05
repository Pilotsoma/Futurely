import { appendGpaReading, MAX_GPA_READINGS } from '../gpaHistory'

jest.mock(
  '@react-native-async-storage/async-storage',
  // Jest's official AsyncStorage mock is CommonJS-only.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

describe('appendGpaReading', () => {
  it('replaces the same-day entry', () => {
    const next = appendGpaReading(
      [{ date: '2026-04-01', gpa: 3.1 }],
      { date: '2026-04-01', gpa: 3.4 },
    )

    expect(next).toEqual([{ date: '2026-04-01', gpa: 3.4 }])
  })

  it('keeps the list sorted by date', () => {
    const next = appendGpaReading(
      [
        { date: '2026-04-03', gpa: 3.3 },
        { date: '2026-04-01', gpa: 3.1 },
      ],
      { date: '2026-04-02', gpa: 3.2 },
    )

    expect(next.map((entry) => entry.date)).toEqual(['2026-04-01', '2026-04-02', '2026-04-03'])
  })

  it('caps at 60 entries, dropping the oldest', () => {
    const history = Array.from({ length: MAX_GPA_READINGS }, (_, index) => ({
      date: new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10),
      gpa: 3,
    }))
    const next = appendGpaReading(history, { date: '2026-06-01', gpa: 4 })

    expect(next).toHaveLength(MAX_GPA_READINGS)
    expect(next[0].date).toBe('2026-01-02')
    expect(next[next.length - 1]).toEqual({ date: '2026-06-01', gpa: 4 })
  })
})
