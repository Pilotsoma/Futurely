import { asArray, asRecord, asText, pickText } from './shared'

export interface TeacherEntry {
  name: string
  /** "AP Biology · Period 1", several courses joined with ", ". */
  coursesText: string | null
  /** Room and building joined with " · ". */
  placeText: string | null
  /** Only a plausible address; anything else is dropped. */
  email: string | null
}

export interface TeachersModel {
  teachers: TeacherEntry[]
}

// Strict allowlist: an address goes straight into a mailto: link, so it can never carry `,` `;` `%` `&` `?` `#`
// (a second recipient, a percent-encoded header or a query parameter).
const EMAIL = /^[A-Za-z0-9._+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/

const NAME_ALIASES = ['name', 'teacherName', 'fullName', 'teacher'] as const
const COURSE_NAME_ALIASES = ['courseName', 'course', 'name', 'description'] as const
const PERIOD_ALIASES = ['period', 'periods'] as const
const EMAIL_ALIASES = ['email', 'emailAddress'] as const
const ROOM_ALIASES = ['room', 'roomNumber', 'rm'] as const
const BUILDING_ALIASES = ['building', 'campus'] as const

function courseText(value: unknown): string | null {
  const plain = asText(value)
  if (plain !== null) return plain
  const course = asRecord(value)
  if (!course) return null
  const name = pickText(course, COURSE_NAME_ALIASES)
  if (name === null) return null
  const period = pickText(course, PERIOD_ALIASES)
  return period === null ? name : `${name} · Period ${period}`
}

function coursesText(value: unknown): string | null {
  const list = asArray(value)
  if (!list) return null
  const texts = list.map(courseText).filter((text): text is string => text !== null)
  const unique = texts.filter((text, index) => texts.indexOf(text) === index)
  return unique.length > 0 ? unique.join(', ') : null
}

function joinParts(parts: (string | null)[]): string | null {
  const present = parts.filter((part): part is string => part !== null)
  return present.length > 0 ? present.join(' · ') : null
}

function readTeacher(value: unknown): TeacherEntry | null {
  const row = asRecord(value)
  if (!row) return null
  const name = pickText(row, NAME_ALIASES)
  if (name === null) return null
  const email = pickText(row, EMAIL_ALIASES)
  return {
    name,
    coursesText: coursesText(row.courses),
    placeText: joinParts([pickText(row, ROOM_ALIASES), pickText(row, BUILDING_ALIASES)]),
    email: email !== null && EMAIL.test(email) ? email : null,
  }
}

/**
 * Contact-teachers payload: `{ teachers: [...] }` or the bare array. An empty list gives an empty model
 * (the screen shows its empty state); a list where no entry has a name gives null, so the screen falls
 * back to the generic view. Never throws, never logs.
 */
export function parseTeachers(payload: unknown): TeachersModel | null {
  const envelope = asRecord(payload)
  const list = asArray(envelope ? envelope.teachers : payload)
  if (!list) return null
  const teachers = list.map(readTeacher).filter((teacher): teacher is TeacherEntry => teacher !== null)
  if (list.length > 0 && teachers.length === 0) return null
  return { teachers }
}
