import { describe, expect, it, jest } from '@jest/globals'

import {
  buildMonthGrid,
  classifyAttendance,
  longDate,
  monthForOffset,
  parseAttendance,
  weekdayAbbreviation,
} from '../attendance'

const NOVEMBER_2026 = { year: 2026, monthIndex: 10 }

function entry(day: number, description: string, periods: { period: string; status: string }[] = []) {
  const date = `2026-11-${String(day).padStart(2, '0')}`
  return { date, dayOfWeek: 'Mon', dayNum: day, bgColor: '#FBBF24', description, isSchoolClosed: false, periods }
}

// The e2e / backend demo shape: only the notable days are listed.
const demo = {
  month: 'November',
  year: 2026,
  monthIndex: 10,
  days: [
    entry(4, 'Tardy', [{ period: '1', status: 'Tardy' }]),
    entry(9, 'Excused absence', [
      { period: '1', status: 'Excused' },
      { period: '2', status: 'Excused' },
    ]),
    entry(12, 'Present'),
  ],
  summary: { absences: 0, excused: 1, tardies: 1, multiple: 0 },
}

describe('classifyAttendance', () => {
  it.each([
    ['Tardy', false, 'tardy'],
    ['Late arrival', false, 'tardy'],
    ['Excused absence', false, 'excused'],
    ['Doctor note', false, 'excused'],
    ['Approved absence', false, 'excused'],
    ['Absent', false, 'absent'],
    ['Absent unexcused', false, 'absent'],
    ['Unexcused', false, 'absent'],
    ['Multiple Attendance Codes', false, 'multiple'],
    ['School Closed', false, 'closed'],
    ['Winter holiday', false, 'closed'],
    ['', true, 'closed'],
    ['Present', false, 'present'],
    ['Field trip', false, 'other'],
    ['', false, null],
  ] as const)('sorts %j (closed flag %s) as %s', (description, closed, expected) => {
    expect(classifyAttendance(description, closed)).toBe(expected)
  })

  it('lets a closed day win over any other wording', () => {
    expect(classifyAttendance('Excused absence', true)).toBe('closed')
  })
})

describe('parseAttendance', () => {
  it('reads the demo shape', () => {
    expect(parseAttendance(demo, NOVEMBER_2026)).toEqual({
      marked: [
        { day: 4, kind: 'tardy', description: 'Tardy', periodsText: 'Period 1' },
        { day: 9, kind: 'excused', description: 'Excused absence', periodsText: 'Periods 1, 2' },
        { day: 12, kind: 'present', description: 'Present', periodsText: null },
      ],
      counts: { absences: 0, excused: 1, tardies: 1 },
      hasCalendar: true,
    })
  })

  it('treats a live HAC month where every day is plain as a calendar with nothing marked', () => {
    const days = Array.from({ length: 20 }, (_, index) => entry(index + 1, ''))
    const model = parseAttendance(
      { month: 'November 2026', year: 2026, monthIndex: 10, days, summary: { absences: 0, excused: 0, tardies: 0, multiple: 0 } },
      NOVEMBER_2026,
    )
    expect(model).toEqual({ marked: [], counts: { absences: 0, excused: 0, tardies: 0 }, hasCalendar: true })
  })

  it('reads live HAC whole-day events, mixed codes and a closed day', () => {
    const model = parseAttendance(
      {
        days: [
          entry(2, 'School Closed', [{ period: 'all', status: 'School Closed' }]),
          entry(5, 'Multiple Attendance Codes', [
            { period: '1', status: 'Tardy' },
            { period: '3', status: 'Excused' },
          ]),
          entry(6, 'Absent', [{ period: 'all', status: 'Absent' }]),
        ],
      },
      NOVEMBER_2026,
    )
    expect(model?.marked).toEqual([
      { day: 2, kind: 'closed', description: 'School Closed', periodsText: 'All day' },
      { day: 5, kind: 'multiple', description: 'Multiple Attendance Codes', periodsText: 'P1 Tardy · P3 Excused' },
      { day: 6, kind: 'absent', description: 'Absent', periodsText: 'All day' },
    ])
    // No summary: the counts come from the marked days.
    expect(model?.counts).toEqual({ absences: 1, excused: 0, tardies: 0 })
  })

  it('marks a closed day that carries only the flag, and names it', () => {
    const model = parseAttendance({ days: [{ ...entry(11, ''), isSchoolClosed: true }] }, NOVEMBER_2026)
    expect(model?.marked).toEqual([{ day: 11, kind: 'closed', description: 'School closed', periodsText: null }])
  })

  it('prefers the summary counts and falls back per field', () => {
    const model = parseAttendance(
      { days: [entry(4, 'Tardy'), entry(5, 'Absent')], summary: { absences: '3', excused: 'n/a', tardies: -1 } },
      NOVEMBER_2026,
    )
    expect(model?.counts).toEqual({ absences: 3, excused: 0, tardies: 1 })
  })

  it('takes the day from dayNum only when the date is missing or unparseable, and the date wins otherwise', () => {
    const model = parseAttendance(
      {
        days: [
          { dayNum: 8, description: 'Tardy' },
          { date: 'not a date', dayNum: 20, description: 'Absent' },
          { date: '2026-11-17', dayNum: 3, description: 'Present' },
        ],
      },
      NOVEMBER_2026,
    )
    expect(model?.marked.map((day) => [day.day, day.kind])).toEqual([
      [8, 'tardy'],
      [17, 'present'],
      [20, 'absent'],
    ])
  })

  it('drops an entry whose date is in another month instead of drawing it on the displayed month', () => {
    const model = parseAttendance(
      {
        days: [
          { date: '2026-10-30', dayNum: 20, description: 'Absent' },
          { date: '2025-11-05', dayNum: 5, description: 'Tardy' },
          { date: '11/09/2026', dayNum: 9, description: 'Excused absence' },
        ],
      },
      NOVEMBER_2026,
    )
    expect(model?.marked).toEqual([{ day: 9, kind: 'excused', description: 'Excused absence', periodsText: null }])
    expect(model?.counts).toEqual({ absences: 0, excused: 1, tardies: 0 })
  })

  it('does not draw a payload for another month on the requested month', () => {
    const august = {
      month: 'August 2026',
      year: 2026,
      monthIndex: 7,
      days: [{ date: '2026-08-14', dayNum: 14, description: 'Unexcused Absence' }],
    }
    expect(parseAttendance(august, { year: 2026, monthIndex: 6 })).toBeNull()
    // The same payload is fine for the month it describes.
    expect(parseAttendance(august, { year: 2026, monthIndex: 7 })?.marked).toEqual([
      { day: 14, kind: 'absent', description: 'Unexcused Absence', periodsText: null },
    ])
  })

  it('returns null when the payload names another year or month, but not when it names only one', () => {
    const days = [entry(4, 'Tardy')]
    expect(parseAttendance({ year: 2025, monthIndex: 10, days }, NOVEMBER_2026)).toBeNull()
    expect(parseAttendance({ year: 2026, monthIndex: 9, days }, NOVEMBER_2026)).toBeNull()
    expect(parseAttendance({ year: 2026, monthIndex: 10, days }, NOVEMBER_2026)?.marked).toHaveLength(1)
    expect(parseAttendance({ year: 2025, days }, NOVEMBER_2026)?.marked).toHaveLength(1)
    expect(parseAttendance({ monthIndex: 3, days }, NOVEMBER_2026)?.marked).toHaveLength(1)
    expect(parseAttendance({ year: 'x', monthIndex: null, days }, NOVEMBER_2026)?.marked).toHaveLength(1)
  })

  it('drops entries with no usable day or a day the month does not have, and keeps the first duplicate', () => {
    const model = parseAttendance(
      {
        days: [
          { description: 'Tardy' },
          { dayNum: 31, description: 'Absent' },
          { dayNum: 0, description: 'Absent' },
          { dayNum: 4.5, description: 'Absent' },
          entry(4, 'Tardy'),
          entry(4, 'Absent'),
        ],
      },
      NOVEMBER_2026,
    )
    expect(model?.marked).toEqual([{ day: 4, kind: 'tardy', description: 'Tardy', periodsText: null }])
  })

  it('reads days without a month when none is given', () => {
    const model = parseAttendance({ days: [{ dayNum: 31, description: 'Tardy' }] })
    expect(model?.marked.map((day) => day.day)).toEqual([31])
  })

  it('reads the date of an entry when no month is given, and ignores a disagreeing dayNum', () => {
    const model = parseAttendance({ year: 2025, monthIndex: 3, days: [{ date: '2026-08-14', dayNum: 2, description: 'Absent' }] })
    expect(model?.marked.map((day) => day.day)).toEqual([14])
  })

  it('names each period when a whole-day entry is mixed with period entries', () => {
    const model = parseAttendance(
      { days: [entry(5, 'Multiple Attendance Codes', [{ period: 'all', status: 'Absent' }, { period: '3', status: 'Tardy' }])] },
      NOVEMBER_2026,
    )
    expect(model?.marked[0].periodsText).toBe('All day Absent · P3 Tardy')
  })

  it('only closes a day for a real true, not for any truthy value the scraper might send', () => {
    const model = parseAttendance({ days: [{ ...entry(5, 'Tardy'), isSchoolClosed: 'false' }] }, NOVEMBER_2026)
    expect(model?.marked[0].kind).toBe('tardy')
  })

  it('is recognised from a numeric summary alone', () => {
    const model = parseAttendance({ summary: { absences: 2, excused: 0, tardies: 1 } }, NOVEMBER_2026)
    expect(model).toEqual({ marked: [], counts: { absences: 2, excused: 0, tardies: 1 }, hasCalendar: true })
  })

  it('reports no calendar when the portal sent an empty days list and no summary', () => {
    expect(parseAttendance({ month: 'November', days: [] }, NOVEMBER_2026)).toEqual({
      marked: [],
      counts: { absences: 0, excused: 0, tardies: 0 },
      hasCalendar: false,
    })
  })

  it('returns null for payloads that are not attendance', () => {
    expect(parseAttendance(null)).toBeNull()
    expect(parseAttendance(undefined)).toBeNull()
    expect(parseAttendance({})).toBeNull()
    expect(parseAttendance([])).toBeNull()
    expect(parseAttendance('November')).toBeNull()
    expect(parseAttendance({ absences: 2 })).toBeNull()
    expect(parseAttendance({ note: 'Attendance is not posted' })).toBeNull()
    expect(parseAttendance({ days: 'none', summary: { note: 'x' } })).toBeNull()
  })

  it('does not throw on fields of the wrong type', () => {
    const model = parseAttendance(
      {
        days: [null, 7, 'x', { dayNum: '12', description: 42, periods: 'all' }, { dayNum: 5, description: 'Tardy', periods: [null, { period: {} }, { period: 2 }] }],
        summary: { absences: {}, excused: [] },
      },
      NOVEMBER_2026,
    )
    expect(model?.marked).toEqual([{ day: 5, kind: 'tardy', description: 'Tardy', periodsText: 'Period 2' }])
  })

  it('never logs the payload', () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) => jest.spyOn(console, method))
    parseAttendance(demo, NOVEMBER_2026)
    parseAttendance({ days: 'bad' })
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    }
  })
})

describe('buildMonthGrid', () => {
  it('lays out a month that starts on a Sunday', () => {
    const rows = buildMonthGrid(NOVEMBER_2026)
    expect(rows).toHaveLength(5)
    expect(rows[0]).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(rows[4]).toEqual([29, 30, null, null, null, null, null])
  })

  it('fits February of a non-leap year into exactly four weeks', () => {
    const rows = buildMonthGrid({ year: 2026, monthIndex: 1 })
    expect(rows).toHaveLength(4)
    expect(rows[0][0]).toBe(1)
    expect(rows[3][6]).toBe(28)
  })

  it('knows a leap February has 29 days', () => {
    const rows = buildMonthGrid({ year: 2028, monthIndex: 1 })
    expect(rows.flat().filter((cell) => cell !== null)).toHaveLength(29)
    expect(rows[0]).toEqual([null, null, 1, 2, 3, 4, 5])
  })

  it('needs six weeks for a 31-day month that starts on a Saturday', () => {
    const rows = buildMonthGrid({ year: 2026, monthIndex: 7 })
    expect(rows).toHaveLength(6)
    expect(rows[0]).toEqual([null, null, null, null, null, null, 1])
    expect(rows[5]).toEqual([30, 31, null, null, null, null, null])
  })

  it('always returns rows of seven cells', () => {
    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      for (const row of buildMonthGrid({ year: 2026, monthIndex })) expect(row).toHaveLength(7)
    }
  })
})

describe('month helpers', () => {
  it('steps back across a year boundary', () => {
    const now = new Date(2026, 0, 31)
    expect(monthForOffset(0, now)).toEqual({ year: 2026, monthIndex: 0 })
    expect(monthForOffset(-1, now)).toEqual({ year: 2025, monthIndex: 11 })
    expect(monthForOffset(-13, now)).toEqual({ year: 2024, monthIndex: 11 })
  })

  it('names weekdays and dates', () => {
    expect(weekdayAbbreviation(NOVEMBER_2026, 1)).toBe('Sun')
    expect(weekdayAbbreviation(NOVEMBER_2026, 4)).toBe('Wed')
    expect(longDate(NOVEMBER_2026, 4)).toBe('November 4')
  })
})
