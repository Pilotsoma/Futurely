import { asArray, asNumber, asRecord, asText, formatPortalDate, pickText, resolveGrade, type GradeDisplay } from './shared'

export interface ProgressCourse {
  name: string
  /** "Dr. Rivera · Period 1". */
  subtitle: string | null
  grade: GradeDisplay
  /** A non-numeric, non-letter average such as "EX", printed in place of the percent. */
  rawAverage: string | null
}

export interface ProgressReportModel {
  /** "Nov 6" for the report date the portal is showing. */
  asOf: string | null
  courses: ProgressCourse[]
}

const NAME_ALIASES = ['name', 'courseName', 'course'] as const
const MAX_RAW_AVERAGE = 10

function readAverage(letterRaw: unknown, averageRaw: unknown): { grade: GradeDisplay; rawAverage: string | null } {
  let grade = resolveGrade(letterRaw, averageRaw)
  const averageText = asText(averageRaw)
  if (averageText === null || asNumber(averageText) !== null) return { grade, rawAverage: null }

  // The average cell holds a word, not a number: a letter grade, or a code like "EX".
  const asLetter = resolveGrade(averageText, null)
  if (asLetter.letter !== null) {
    if (grade.label === null) grade = asLetter
    return { grade, rawAverage: null }
  }
  return { grade, rawAverage: averageText.length <= MAX_RAW_AVERAGE ? averageText : null }
}

function readCourse(value: unknown): ProgressCourse | null {
  const row = asRecord(value)
  if (!row) return null
  const name = pickText(row, NAME_ALIASES)
  if (name === null) return null
  const teacher = pickText(row, ['teacher', 'teacherName'])
  const period = pickText(row, ['period'])
  const { grade, rawAverage } = readAverage(row.letterGrade, row.average)
  const subtitleParts = [teacher, period === null ? null : `Period ${period}`].filter(
    (part): part is string => part !== null,
  )
  return {
    name,
    subtitle: subtitleParts.length > 0 ? subtitleParts.join(' · ') : null,
    grade,
    rawAverage,
  }
}

/**
 * Progress-report payload: `{ availableDates, currentDate, courses: [...] }`. An empty course list gives
 * an empty model (the screen shows its empty state); a list where no course has a name gives null, so
 * the screen falls back to the generic view. Never throws, never logs.
 */
export function parseProgressReport(payload: unknown): ProgressReportModel | null {
  const envelope = asRecord(payload)
  const list = envelope ? asArray(envelope.courses) : null
  if (!envelope || !list) return null
  const courses = list.map(readCourse).filter((course): course is ProgressCourse => course !== null)
  if (list.length > 0 && courses.length === 0) return null
  return { asOf: formatPortalDate(envelope.currentDate), courses }
}
