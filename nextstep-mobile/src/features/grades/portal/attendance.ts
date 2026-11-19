import { asArray, asNumber, asRecord, asText, parsePortalDate } from './shared'

// Attendance payload: `{ month, year, monthIndex, days: [...], summary: {...} }`. Live HAC lists every
// school day (plain days have an empty description); the demo lists only notable days. Parsers here
// never throw and never log: attendance is a FERPA education record.

export type AttendanceKind = 'absent' | 'excused' | 'tardy' | 'multiple' | 'closed' | 'present' | 'other'

export interface AttendanceDayModel {
  /** Day of the displayed month, 1 to 31. */
  day: number
  kind: AttendanceKind
  /** The portal's own wording, e.g. "Excused absence". */
  description: string
  /** "All day", "Period 1", "Periods 1, 2" or "P1 Tardy · P3 Excused". Null when the portal sent no periods. */
  periodsText: string | null
}

export interface AttendanceCounts {
  absences: number
  excused: number
  tardies: number
}

export interface AttendanceModel {
  /** Only days that carry a status, in day order. Plain school days are not in this list. */
  marked: AttendanceDayModel[]
  counts: AttendanceCounts
  /** True when the payload carried calendar content: at least one day entry or a numeric summary. */
  hasCalendar: boolean
}

/** The month the screen asked for. The grid is built from this, never from the payload's own year or month. */
export interface AttendanceMonth {
  year: number
  monthIndex: number
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const
const DAYS_PER_WEEK = 7

/** The month `monthOffset` months from `now` (0 is the current month, -1 the previous one). */
export function monthForOffset(monthOffset: number, now: Date = new Date()): AttendanceMonth {
  const first = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  return { year: first.getFullYear(), monthIndex: first.getMonth() }
}

function daysInMonth(month: AttendanceMonth): number {
  return new Date(month.year, month.monthIndex + 1, 0).getDate()
}

/** Calendar rows of seven cells, Sunday first. A cell is a day number, or null outside the month. */
export function buildMonthGrid(month: AttendanceMonth): (number | null)[][] {
  const leading = new Date(month.year, month.monthIndex, 1).getDay()
  const cells: (number | null)[] = Array.from({ length: leading }, () => null)
  for (let day = 1; day <= daysInMonth(month); day += 1) cells.push(day)
  while (cells.length % DAYS_PER_WEEK !== 0) cells.push(null)
  const rows: (number | null)[][] = []
  for (let start = 0; start < cells.length; start += DAYS_PER_WEEK) {
    rows.push(cells.slice(start, start + DAYS_PER_WEEK))
  }
  return rows
}

/** "Wed" for a day of the month. */
export function weekdayAbbreviation(month: AttendanceMonth, day: number): string {
  return WEEKDAYS[new Date(month.year, month.monthIndex, day).getDay()]
}

/** "November 4", the spoken date of a calendar cell. */
export function longDate(month: AttendanceMonth, day: number): string {
  return `${MONTH_NAMES[month.monthIndex]} ${day}`
}

/**
 * Sorts a day's description into a kind. First match wins; null means the day carries no status
 * (a plain school day). Mirrors the regexes the backend uses to build its own summary counts.
 */
export function classifyAttendance(description: string, isSchoolClosed: boolean): AttendanceKind | null {
  if (isSchoolClosed || /school.?closed|holiday/i.test(description)) return 'closed'
  if (description === '') return null
  if (/multiple/i.test(description)) return 'multiple'
  if (/unexcused/i.test(description) || (/absen/i.test(description) && !/excus|approved|doctor/i.test(description))) return 'absent'
  if (/excus|approved.?absence|doctor/i.test(description)) return 'excused'
  if (/tardy|late/i.test(description)) return 'tardy'
  if (/present/i.test(description)) return 'present'
  return 'other'
}

interface PeriodEntry {
  period: string
  status: string | null
}

function readPeriods(value: unknown): PeriodEntry[] {
  const entries: PeriodEntry[] = []
  for (const item of asArray(value) ?? []) {
    const row = asRecord(item)
    const period = row ? asText(row.period) : null
    if (row && period !== null) entries.push({ period, status: asText(row.status) })
  }
  return entries
}

function isAllDay(entry: PeriodEntry): boolean {
  return entry.period.toLowerCase() === 'all'
}

function describePeriods(entries: PeriodEntry[]): string | null {
  if (entries.length === 0) return null
  if (entries.some(isAllDay)) {
    return entries.every(isAllDay) ? 'All day' : describeMixed(entries)
  }
  const statuses = new Set(entries.map((entry) => (entry.status ?? '').toLowerCase()))
  if (statuses.size > 1) return describeMixed(entries)
  const list = entries.map((entry) => entry.period).join(', ')
  return entries.length === 1 ? `Period ${list}` : `Periods ${list}`
}

function describeMixed(entries: PeriodEntry[]): string {
  return entries
    .map((entry) => {
      const label = isAllDay(entry) ? 'All day' : `P${entry.period}`
      return entry.status === null ? label : `${label} ${entry.status}`
    })
    .join(' · ')
}

/**
 * The day of the displayed month an entry belongs to. A parseable `date` is the truth: it is used when
 * it falls in the displayed month and the entry is dropped when it does not (live HAC can answer with a
 * different month than the one asked for). `dayNum` is only read when there is no usable `date`.
 */
function readDay(row: Record<string, unknown>, month: AttendanceMonth | undefined): number | null {
  const parsed = parsePortalDate(row.date)
  if (parsed !== null && month !== undefined && (parsed.year !== month.year || parsed.monthIndex !== month.monthIndex)) {
    return null
  }
  const day = parsed !== null ? parsed.day : asNumber(row.dayNum)
  if (day === null || !Number.isInteger(day) || day < 1 || day > 31) return null
  return month !== undefined && day > daysInMonth(month) ? null : day
}

/** True when the payload names its own year and month and they differ from the month that was asked for. */
function isAnotherMonth(envelope: Record<string, unknown>, month: AttendanceMonth | undefined): boolean {
  if (month === undefined) return false
  const year = asNumber(envelope.year)
  const monthIndex = asNumber(envelope.monthIndex)
  return year !== null && monthIndex !== null && (year !== month.year || monthIndex !== month.monthIndex)
}

function readMarkedDay(value: unknown, month: AttendanceMonth | undefined): AttendanceDayModel | null {
  const row = asRecord(value)
  if (!row) return null
  const day = readDay(row, month)
  if (day === null) return null
  const text = typeof row.description === 'string' ? (asText(row.description) ?? '') : ''
  const kind = classifyAttendance(text, row.isSchoolClosed === true)
  if (kind === null) return null
  return {
    day,
    kind,
    description: text === '' ? 'School closed' : text,
    periodsText: describePeriods(readPeriods(row.periods)),
  }
}

function readMarked(days: unknown[], month: AttendanceMonth | undefined): AttendanceDayModel[] {
  const byDay = new Map<number, AttendanceDayModel>()
  for (const item of days) {
    const entry = readMarkedDay(item, month)
    if (entry !== null && !byDay.has(entry.day)) byDay.set(entry.day, entry)
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day)
}

function summaryCount(summary: Record<string, unknown> | null, key: string): number | null {
  const value = summary ? asNumber(summary[key]) : null
  return value !== null && value >= 0 ? Math.round(value) : null
}

function countKind(marked: AttendanceDayModel[], kind: AttendanceKind): number {
  return marked.filter((entry) => entry.kind === kind).length
}

/**
 * Recognised when `days` is an array or `summary` is a record with a numeric field; otherwise null so
 * the screen shows the generic fallback. `month` (the month the screen asked for) is used to read day
 * numbers and to drop days that do not exist in it. A payload whose own numeric `year` and `monthIndex`
 * both disagree with `month` is another month's data: null, so it is never drawn on this month's grid.
 */
export function parseAttendance(payload: unknown, month?: AttendanceMonth): AttendanceModel | null {
  const envelope = asRecord(payload)
  if (!envelope || isAnotherMonth(envelope, month)) return null
  const days = asArray(envelope.days)
  const summary = asRecord(envelope.summary)
  const hasSummary = summary !== null && Object.values(summary).some((value) => asNumber(value) !== null)
  if (days === null && !hasSummary) return null

  const marked = readMarked(days ?? [], month)
  return {
    marked,
    counts: {
      absences: summaryCount(summary, 'absences') ?? countKind(marked, 'absent'),
      excused: summaryCount(summary, 'excused') ?? countKind(marked, 'excused'),
      tardies: summaryCount(summary, 'tardies') ?? countKind(marked, 'tardy'),
    },
    hasCalendar: hasSummary || (days !== null && days.length > 0),
  }
}
