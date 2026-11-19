import { formatClockTime } from '../formatTime'

describe('formatClockTime', () => {
  it('converts 24-hour times to a 12-hour clock', () => {
    expect(formatClockTime('15:30')).toBe('3:30 PM')
    expect(formatClockTime('09:05')).toBe('9:05 AM')
    expect(formatClockTime('00:15')).toBe('12:15 AM')
    expect(formatClockTime('12:00')).toBe('12:00 PM')
    expect(formatClockTime('23:59')).toBe('11:59 PM')
    expect(formatClockTime(' 7:45 ')).toBe('7:45 AM')
    expect(formatClockTime('15:30:00')).toBe('3:30 PM')
  })

  it('returns anything that is not a 24-hour time trimmed and unchanged', () => {
    expect(formatClockTime('3:30 PM')).toBe('3:30 PM')
    expect(formatClockTime('  End of day ')).toBe('End of day')
    expect(formatClockTime('25:00')).toBe('25:00')
    expect(formatClockTime('10:75')).toBe('10:75')
  })

  it('returns null when there is no time', () => {
    expect(formatClockTime(null)).toBeNull()
    expect(formatClockTime(undefined)).toBeNull()
    expect(formatClockTime('')).toBeNull()
    expect(formatClockTime('   ')).toBeNull()
  })
})
