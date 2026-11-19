import { asArray, asNumber, asRecord, formatPortalDate, pickText, resolveGrade, type GradeDisplay } from './shared'

// Classwork payload: `{ classes: [{ name, period, teacher, room, average, categoryWeights?, scores: [...] }],
// availablePeriods, currentPeriod }`. Live HAC sends no letter grade, so it is derived from the average.
// Parsers here never throw and never log: classwork is a FERPA education record.

export type AssignmentTone = 'success' | 'neutral' | 'warning' | 'error'

export interface ClassworkAssignment {
  name: string
  category: string | null
  /** "Nov 5"; the view adds the "Due" prefix. */
  dueText: string | null
  /** "94/100", "94", or null when the assignment is not graded yet. */
  scoreText: string | null
  tone: AssignmentTone
}

export interface ClassworkClassModel {
  name: string
  teacher: string | null
  period: string | null
  grade: GradeDisplay
  /** "Daily 40% · Minor 30% · Major 30%". */
  weightsText: string | null
  assignments: ClassworkAssignment[]
}

export interface ClassworkModel {
  classes: ClassworkClassModel[]
}

const SUCCESS_AT = 90
const NEUTRAL_AT = 70
const WARNING_AT = 60
const CLASS_NAME_ALIASES = ['name', 'className', 'courseName', 'course'] as const
const ASSIGNMENT_NAME_ALIASES = ['name', 'assignment', 'title'] as const

function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100)
}

/** Weights at or below 1 are fractions (0.4 is 40%); larger values are already percents. */
function formatWeight(weight: number): string {
  const percent = weight <= 1 ? weight * 100 : weight
  return `${Math.round(percent * 10) / 10}%`
}

/** Null unless every entry is a labelled, non-negative number, so a half-read set of weights is never shown. */
function readWeights(value: unknown): string | null {
  const record = asRecord(value)
  if (!record) return null
  const parts: string[] = []
  for (const [key, raw] of Object.entries(record)) {
    const weight = asNumber(raw)
    const label = key.trim()
    if (weight === null || weight < 0 || label === '') return null
    parts.push(`${label} ${formatWeight(weight)}`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

function toneFor(score: number | null, total: number | null): AssignmentTone {
  if (score === null || total === null) return 'neutral'
  const percent = (score / total) * 100
  if (percent >= SUCCESS_AT) return 'success'
  if (percent >= NEUTRAL_AT) return 'neutral'
  if (percent >= WARNING_AT) return 'warning'
  return 'error'
}

function readAssignment(value: unknown): ClassworkAssignment | null {
  const row = asRecord(value)
  if (!row) return null
  const name = pickText(row, ASSIGNMENT_NAME_ALIASES)
  if (name === null) return null
  const score = asNumber(row.score)
  const rawTotal = asNumber(row.totalPoints)
  // A total of zero (extra credit) cannot give a percentage, so it is treated as missing.
  const total = rawTotal !== null && rawTotal > 0 ? rawTotal : null
  let scoreText: string | null = null
  if (score !== null) scoreText = total !== null ? `${formatNumber(score)}/${formatNumber(total)}` : formatNumber(score)
  return {
    name,
    category: pickText(row, ['category']),
    dueText: formatPortalDate(row.dateDue),
    scoreText,
    tone: toneFor(score, total),
  }
}

function readClass(value: unknown): ClassworkClassModel | null {
  const row = asRecord(value)
  if (!row) return null
  const name = pickText(row, CLASS_NAME_ALIASES)
  if (name === null) return null
  const scores = asArray(row.scores) ?? []
  return {
    name,
    teacher: pickText(row, ['teacher', 'teacherName']),
    period: pickText(row, ['period']),
    grade: resolveGrade(row.letterGrade, row.average),
    weightsText: readWeights(row.categoryWeights),
    assignments: scores.map(readAssignment).filter((item): item is ClassworkAssignment => item !== null),
  }
}

/**
 * Recognised when `classes` is an array. An empty array gives a model with no classes (the screen shows its
 * empty state); a non-empty array where no entry has a name is not a classwork payload and gives null, so the
 * screen falls back to the generic view. The portal's own order is kept. Never throws, never logs.
 */
export function parseClasswork(payload: unknown): ClassworkModel | null {
  const envelope = asRecord(payload)
  const list = envelope ? asArray(envelope.classes) : null
  if (!list) return null
  const classes = list.map(readClass).filter((item): item is ClassworkClassModel => item !== null)
  if (list.length > 0 && classes.length === 0) return null
  return { classes }
}
