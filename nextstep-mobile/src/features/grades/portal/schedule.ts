import { asArray, asRecord, pickText } from './shared'

export interface ScheduleRow {
  /** Class period as the portal prints it ("1", "2A"); null when missing. */
  period: string | null
  course: string
  /** Teacher, days and (only when terms differ) the term, joined with " · ". */
  subtitle: string | null
  room: string | null
}

export interface ScheduleModel {
  rows: ScheduleRow[]
}

// District portals name these columns differently ("Course", "courseName",
// "Course Description"); each list is in priority order.
const COURSE_ALIASES = ['courseName', 'course', 'description', 'courseDescription', 'class', 'className', 'name'] as const
const PERIOD_ALIASES = ['period', 'periods', 'pd', 'per'] as const
const TEACHER_ALIASES = ['teacher', 'teacherName', 'instructor'] as const
const ROOM_ALIASES = ['room', 'roomNumber', 'rm'] as const
const DAYS_ALIASES = ['days', 'day'] as const
const TERM_ALIASES = ['semester', 'term', 'markingPeriods', 'markingPeriod'] as const

interface RawScheduleRow {
  period: string | null
  course: string
  teacher: string | null
  room: string | null
  days: string | null
  term: string | null
}

function readRow(value: unknown): RawScheduleRow | null {
  const row = asRecord(value)
  if (!row) return null
  const course = pickText(row, COURSE_ALIASES)
  if (course === null) return null
  return {
    period: pickText(row, PERIOD_ALIASES),
    course,
    teacher: pickText(row, TEACHER_ALIASES),
    room: pickText(row, ROOM_ALIASES),
    days: pickText(row, DAYS_ALIASES),
    term: pickText(row, TERM_ALIASES),
  }
}

function rowKey(row: RawScheduleRow): string {
  return JSON.stringify([row.period, row.course, row.teacher, row.room, row.days, row.term])
}

function dropDuplicates(rows: RawScheduleRow[]): RawScheduleRow[] {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = rowKey(row)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function leadingNumber(period: string | null): number | null {
  const match = period === null ? null : /^\d+/.exec(period)
  return match ? Number(match[0]) : null
}

/** Numeric period order, but only when every row starts with a number; otherwise the portal's order. */
function sortByPeriod(rows: RawScheduleRow[]): RawScheduleRow[] {
  const keyed = rows.map((row, index) => ({ row, index, order: leadingNumber(row.period) }))
  if (keyed.some((entry) => entry.order === null)) return rows
  keyed.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.index - b.index)
  return keyed.map((entry) => entry.row)
}

function toRow(row: RawScheduleRow, showTerm: boolean): ScheduleRow {
  const parts = [row.teacher, row.days, showTerm ? row.term : null].filter((part): part is string => part !== null)
  return {
    period: row.period,
    course: row.course,
    subtitle: parts.length > 0 ? parts.join(' · ') : null,
    room: row.room,
  }
}

/**
 * Schedule payload: `{ schedule: [...] }` or the bare array. An empty list gives an empty model (the
 * screen shows its empty state); a list where no row names a course gives null, so the screen falls
 * back to the generic view. Never throws, never logs.
 */
export function parseSchedule(payload: unknown): ScheduleModel | null {
  const envelope = asRecord(payload)
  const list = asArray(envelope ? envelope.schedule : payload)
  if (!list) return null

  const raw = list.map(readRow).filter((row): row is RawScheduleRow => row !== null)
  if (raw.length === 0) return list.length === 0 ? { rows: [] } : null

  const unique = sortByPeriod(dropDuplicates(raw))
  // A schedule that is entirely "Full Year" does not need the term repeated on every row.
  const showTerm = new Set(unique.map((row) => row.term ?? '')).size > 1
  return { rows: unique.map((row) => toRow(row, showTerm)) }
}
