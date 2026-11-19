import {
  asArray,
  asNumber,
  asRecord,
  asText,
  formatCredits,
  pickKey,
  resolveGrade,
  type GradeDisplay,
} from './shared'

export interface TranscriptSummary {
  unweighted: number | null
  weighted: number | null
  cumulative: number | null
  /** Class rank exactly as the portal prints it, e.g. "58/412". */
  rankText: string | null
  /** "Quartile 1". */
  quartileText: string | null
}

export interface TranscriptRow {
  name: string
  grade: GradeDisplay
  creditsText: string | null
  /** PowerSchool only: one entry per reporting-term column that has a value, e.g. Q1 / 92. */
  terms: { label: string; value: string }[]
}

export interface TranscriptSection {
  title: string
  meta: string | null
  creditsTotalText: string | null
  rows: TranscriptRow[]
}

export interface TranscriptModel {
  summary: TranscriptSummary | null
  sections: TranscriptSection[]
}

const EMPTY_GRADE: GradeDisplay = { label: null, letter: null, percent: null }
const COURSE_KEY_ALIASES = ['course', 'courseName', 'class', 'name'] as const
// PowerSchool columns that are bookkeeping, not grades.
const SKIPPED_COLUMNS = new Set(['exp', 'lastweek', 'thisweek', 'absences', 'tardies'])

function squash(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function columnId(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function sectionTitle(semester: string | null, year: string | null, index: number): { title: string; meta: string | null } {
  if (semester !== null) {
    return { title: /^\d+$/.test(semester) ? `Semester ${semester}` : semester, meta: year }
  }
  return { title: year ?? `Semester ${index + 1}`, meta: null }
}

function sumCredits(rows: { credits: number | null }[]): string | null {
  const known = rows.map((row) => row.credits).filter((credits): credits is number => credits !== null)
  return known.length > 0 ? formatCredits(known.reduce((sum, credits) => sum + credits, 0)) : null
}

function readSummary(transcript: Record<string, unknown>): TranscriptSummary | null {
  const quartile = asText(transcript.quartile)
  const summary: TranscriptSummary = {
    unweighted: asNumber(transcript.unweightedGPA),
    weighted: asNumber(transcript.weightedGPA),
    cumulative: asNumber(transcript.cumulativeGPA),
    rankText: asText(transcript.classRank),
    quartileText: quartile === null ? null : `Quartile ${quartile}`,
  }
  const hasAny = Object.values(summary).some((value) => value !== null)
  return hasAny ? summary : null
}

function readHacSection(value: unknown, index: number): TranscriptSection | null {
  const semester = asRecord(value)
  const list = semester ? asArray(semester.courses) : null
  if (!semester || !list) return null

  const courses = list.flatMap((entry) => {
    const course = asRecord(entry)
    const name = course ? asText(course.name) : null
    if (!course || name === null) return []
    // HAC prints either a letter or a number in the same field.
    return [{ name, grade: resolveGrade(course.grade, course.grade), credits: asNumber(course.credits) }]
  })
  if (courses.length === 0) return null

  const { title, meta } = sectionTitle(asText(semester.semester), asText(semester.year), index)
  return {
    title,
    meta,
    creditsTotalText: sumCredits(courses),
    rows: courses.map((course) => ({
      name: course.name,
      grade: course.grade,
      creditsText: formatCredits(course.credits),
      terms: [],
    })),
  }
}

function parseHac(transcript: Record<string, unknown>, semesters: unknown[]): TranscriptModel | null {
  const sections = semesters
    .map(readHacSection)
    .filter((section): section is TranscriptSection => section !== null)
  return sections.length > 0 ? { summary: readSummary(transcript), sections } : null
}

function readPowerSchoolRow(
  row: Record<string, unknown>,
  nameKey: string,
  termColumns: readonly string[],
): TranscriptRow | null {
  const rawName = asText(row[nameKey])
  if (rawName === null) return null
  const nameId = columnId(nameKey)
  const seen = new Set<string>()
  const terms: { label: string; value: string }[] = []
  for (const column of termColumns) {
    const id = columnId(column)
    const text = asText(row[column])
    if (id === nameId || SKIPPED_COLUMNS.has(id) || seen.has(id) || text === null) continue
    seen.add(id)
    terms.push({ label: squash(column), value: squash(text) })
  }
  return { name: squash(rawName), grade: EMPTY_GRADE, creditsText: null, terms }
}

function parsePowerSchool(transcript: Record<string, unknown>): TranscriptModel | null {
  const courses = asArray(transcript.courses)
  const termList = asArray(transcript.terms)
  if (!courses || !termList) return null
  const termColumns = termList.flatMap((term) => {
    const text = asText(term)
    return text === null ? [] : [text]
  })

  const records = courses.flatMap((entry) => {
    const record = asRecord(entry)
    return record ? [record] : []
  })
  const nameKey = records.map((record) => pickKey(record, COURSE_KEY_ALIASES)).find((key) => key !== null) ?? null
  if (nameKey === null) return null

  const rows = records
    .map((record) => readPowerSchoolRow(record, pickKey(record, COURSE_KEY_ALIASES) ?? nameKey, termColumns))
    .filter((row): row is TranscriptRow => row !== null)
  if (rows.length === 0) return null
  return { summary: null, sections: [{ title: 'Courses', meta: null, creditsTotalText: null, rows }] }
}

/**
 * Transcript payload (the `transcript` field of the response): the HAC shape with a
 * `semesters` array, or the PowerSchool shape with `terms` and header-keyed `courses`.
 * Returns null when neither is recognised, so the screen falls back to the generic view.
 * Never throws, never logs.
 */
export function parseTranscript(payload: unknown): TranscriptModel | null {
  const transcript = asRecord(payload)
  if (!transcript) return null
  const semesters = asArray(transcript.semesters)
  return semesters ? parseHac(transcript, semesters) : parsePowerSchool(transcript)
}
