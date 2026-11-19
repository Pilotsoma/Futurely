import { asArray, asNumber, asRecord, asText, formatCredits, pickText, resolveGrade, type GradeDisplay } from './shared'

// Report-card payloads come in two shapes:
//   A (demo, e2e):  { reportingPeriods, currentPeriod, semesters: { sem1: [...], sem2: [...] } }
//   B (live HAC):   { reportingPeriods, currentPeriod, message?, courses: [{ name: "CODE - description", sixWeeks1.., semester1.. }] }
// Both are normalised into sections. Parsers here never throw and never log: a report card is a FERPA
// education record.

export interface ReportCardBreakdownItem {
  label: string
  value: string
}

export interface ReportCardRow {
  name: string
  /** "Dr. Rivera · Period 1". */
  subtitle: string | null
  grade: GradeDisplay
  creditsText: string | null
  /** Six-weeks and exam marks (shape B only): "1st 92 · 2nd 90 · 3rd 94 · Exam 88" in the view. */
  breakdown: ReportCardBreakdownItem[]
}

export interface ReportCardSection {
  /** Unique within the model, because the semester switcher uses it as the segment value. */
  label: string
  rows: ReportCardRow[]
  /** "5.5 credits"; null when no row has numeric credits. */
  creditsTotalText: string | null
  hasGrades: boolean
}

export interface ReportCardModel {
  sections: ReportCardSection[]
  /** The section to select first. */
  initialIndex: number
  /** HAC's own "nothing published yet" text. */
  portalMessage: string | null
}

/** A row with the numeric credits the section total is summed from. */
interface RowEntry {
  row: ReportCardRow
  credits: number | null
}

const NAME_ALIASES = ['name', 'courseName', 'course'] as const
// HAC puts the course code and description in one cell, joined by an em dash.
const CODE_SEPARATOR = ` ${String.fromCharCode(0x2014)} `

interface SemesterSpec {
  label: string
  weeks: readonly (readonly [string, string])[]
  exam: string
  semester: string
}

const SEMESTERS: readonly SemesterSpec[] = [
  {
    label: 'Semester 1',
    weeks: [
      ['1st', 'sixWeeks1'],
      ['2nd', 'sixWeeks2'],
      ['3rd', 'sixWeeks3'],
    ],
    exam: 'exam1',
    semester: 'semester1',
  },
  {
    label: 'Semester 2',
    weeks: [
      ['4th', 'sixWeeks4'],
      ['5th', 'sixWeeks5'],
      ['6th', 'sixWeeks6'],
    ],
    exam: 'exam2',
    semester: 'semester2',
  },
]

const HAC_KEYS: ReadonlySet<string> = new Set(
  SEMESTERS.flatMap((spec) => [...spec.weeks.map(([, key]) => key), spec.exam, spec.semester].map((key) => key.toLowerCase())),
)

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function subtitleOf(record: Record<string, unknown>): string | null {
  const teacher = pickText(record, ['teacher', 'teacherName'])
  const period = pickText(record, ['period'])
  const parts = [teacher, period === null ? null : `Period ${period}`].filter((part): part is string => part !== null)
  return parts.length > 0 ? parts.join(' · ') : null
}

function hasGradeContent(row: ReportCardRow): boolean {
  return row.grade.label !== null || row.grade.percent !== null || row.breakdown.length > 0
}

function totalCredits(entries: RowEntry[]): string | null {
  const numeric = entries.map((entry) => entry.credits).filter((credits): credits is number => credits !== null)
  return numeric.length > 0 ? formatCredits(numeric.reduce((sum, credits) => sum + credits, 0)) : null
}

function finishSection(label: string, entries: RowEntry[]): ReportCardSection {
  const rows = entries.map((entry) => entry.row)
  return { label, rows, creditsTotalText: totalCredits(entries), hasGrades: rows.some(hasGradeContent) }
}

/** Appends " 2", " 3" and so on on a clash, case-insensitively; an empty label becomes "Section N". */
function uniqueLabels(labels: string[]): string[] {
  const seen = new Set<string>()
  return labels.map((label, index) => {
    const base = label === '' ? `Section ${index + 1}` : label
    let candidate = base
    for (let n = 2; seen.has(candidate.toLowerCase()); n += 1) candidate = `${base} ${n}`
    seen.add(candidate.toLowerCase())
    return candidate
  })
}

// ---- Shape A ----

function readSemesterRow(value: unknown): RowEntry | null {
  const record = asRecord(value)
  if (!record) return null
  const name = pickText(record, NAME_ALIASES)
  if (name === null) return null
  return {
    row: {
      name,
      subtitle: subtitleOf(record),
      grade: resolveGrade(record.letterGrade, record.numericGrade),
      creditsText: formatCredits(record.credits),
      breakdown: [],
    },
    credits: asNumber(record.credits),
  }
}

function keyLabel(key: string): string {
  const digits = /(\d+)$/.exec(key)
  if (digits) return `Semester ${digits[1]}`
  return key.charAt(0).toUpperCase() + key.slice(1)
}

/** `reportingPeriods[i]` names section i when the lists line up; otherwise the label comes from the key. */
function semesterLabels(keys: string[], reportingPeriods: unknown): string[] {
  const names = (asArray(reportingPeriods) ?? []).map(asText)
  if (names.length === keys.length && names.every((name): name is string => name !== null)) return names
  return keys.map(keyLabel)
}

interface ParsedSections {
  /** The labels as the portal named them, before de-duplication; compared with `currentPeriod`. */
  rawLabels: string[]
  sections: ReportCardSection[]
}

function readSemestersShape(envelope: Record<string, unknown>): ParsedSections | null {
  const semesters = asRecord(envelope.semesters)
  if (!semesters) return null
  const keys = Object.keys(semesters).filter((key) => Array.isArray(semesters[key]))
  if (keys.length === 0) return null
  const rawLabels = semesterLabels(keys, envelope.reportingPeriods)
  const labels = uniqueLabels(rawLabels)
  const sections = keys.map((key, index) => {
    const entries = (asArray(semesters[key]) ?? [])
      .map(readSemesterRow)
      .filter((entry): entry is RowEntry => entry !== null)
    return finishSection(labels[index], entries)
  })
  return { rawLabels, sections }
}

// ---- Shape B ----

function displayName(name: string): string {
  const index = name.indexOf(CODE_SEPARATOR)
  return index < 0 ? name : name.slice(index + CODE_SEPARATOR.length).trim()
}

function readBreakdown(record: Record<string, unknown>, spec: SemesterSpec): ReportCardBreakdownItem[] {
  const pairs: (readonly [string, string])[] = [...spec.weeks, ['Exam', spec.exam]]
  const items: ReportCardBreakdownItem[] = []
  for (const [label, key] of pairs) {
    const value = pickText(record, [key])
    if (value !== null) items.push({ label, value })
  }
  return items
}

function readCourseRow(record: Record<string, unknown>, spec: SemesterSpec): RowEntry | null {
  const rawName = pickText(record, NAME_ALIASES)
  if (rawName === null) return null
  const semesterGrade = pickText(record, [spec.semester])
  const earned = pickText(record, ['earnedCredit'])
  const credits = asNumber(earned) !== null ? earned : pickText(record, ['attemptedCredit'])
  return {
    row: {
      name: displayName(rawName),
      subtitle: subtitleOf(record),
      // The semester cell is a number on live HAC, but a letter or a code is shown as sent.
      grade: resolveGrade(semesterGrade, semesterGrade),
      creditsText: formatCredits(credits),
      breakdown: readBreakdown(record, spec),
    },
    credits: asNumber(credits),
  }
}

function looksLikeHacRow(value: unknown): boolean {
  const record = asRecord(value)
  if (!record || pickText(record, NAME_ALIASES) === null) return false
  return Object.keys(record).some((key) => HAC_KEYS.has(normalizeKey(key)))
}

function readCoursesShape(envelope: Record<string, unknown>): ParsedSections | null {
  const courses = asArray(envelope.courses)
  if (courses === null) return null
  // An empty list is a recognised "nothing published yet"; a non-empty one must look like HAC rows.
  if (courses.length > 0 && !courses.some(looksLikeHacRow)) return null
  const rawLabels = SEMESTERS.map((spec) => spec.label)
  const sections = SEMESTERS.map((spec) => {
    const entries = courses
      .map((course) => {
        const record = asRecord(course)
        return record ? readCourseRow(record, spec) : null
      })
      .filter((entry): entry is RowEntry => entry !== null)
    return finishSection(spec.label, entries)
  })
  return { rawLabels, sections }
}

// ---- Shared ----

function hasRows(parsed: ParsedSections): boolean {
  return parsed.sections.some((section) => section.rows.length > 0)
}

function pickInitialIndex(parsed: ParsedSections, currentPeriod: unknown): number {
  const wanted = asText(currentPeriod)?.toLowerCase()
  if (wanted !== undefined) {
    const matched = parsed.sections.findIndex(
      (section, index) => section.label.toLowerCase() === wanted || parsed.rawLabels[index].toLowerCase() === wanted,
    )
    if (matched >= 0) return matched
  }
  for (let index = parsed.sections.length - 1; index >= 0; index -= 1) {
    if (parsed.sections[index].hasGrades) return index
  }
  return 0
}

/**
 * Recognised when `semesters` is a record of arrays (shape A) or `courses` is an array of HAC rows
 * (shape B). A recognised payload with no course rows anywhere gives a model with no sections, so
 * the screen shows its empty state (with the portal's own message when there is one) instead of a
 * raw dump of the reporting periods. Anything else gives null. Never throws, never logs.
 */
export function parseReportCard(payload: unknown): ReportCardModel | null {
  const envelope = asRecord(payload)
  if (!envelope) return null
  const semesters = readSemestersShape(envelope)
  const parsed = semesters !== null && hasRows(semesters) ? semesters : (readCoursesShape(envelope) ?? semesters)
  if (parsed === null) return null
  const portalMessage = typeof envelope.message === 'string' ? asText(envelope.message) : null
  if (!hasRows(parsed)) return { sections: [], initialIndex: 0, portalMessage }
  return {
    sections: parsed.sections,
    initialIndex: pickInitialIndex(parsed, envelope.currentPeriod),
    portalMessage,
  }
}
