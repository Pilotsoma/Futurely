import { averageToLetter } from '../../../constants/gradeScale'
import type { GradeLetter } from '../../../preferences/displayPreferences'

// Helpers shared by every grades portal parser and view. Portal payloads are
// scraped, loosely typed and FERPA education records: these helpers only narrow
// and format values, they never throw and never log.

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null
}

/** Trimmed non-empty string; numbers are stringified; everything else null. */
export function asText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

const NUMERIC_TEXT = /^-?(\d+\.?\d*|\.\d+)$/

/** Finite number from a number or a numeric string ("93.5", "93.5%"); else null. */
export function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/%$/, '').trim()
  if (!NUMERIC_TEXT.test(trimmed)) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * The actual key of the first alias (priority order) that matches a key of the
 * row case- and punctuation-insensitively and carries non-empty text.
 */
export function pickKey(row: Record<string, unknown>, aliases: readonly string[]): string | null {
  const entries = Object.keys(row).map((key) => ({ key, normalized: normalizeKey(key) }))
  for (const alias of aliases) {
    const wanted = normalizeKey(alias)
    const hit = entries.find((entry) => entry.normalized === wanted && asText(row[entry.key]) !== null)
    if (hit) return hit.key
  }
  return null
}

/** Case- and punctuation-insensitive key lookup: pickText(row, ['courseName','course','description']). */
export function pickText(row: Record<string, unknown>, aliases: readonly string[]): string | null {
  const key = pickKey(row, aliases)
  return key === null ? null : asText(row[key])
}

export interface GradeDisplay {
  /** What to print in the chip: "A", "B+", "P". Null when there is nothing to print. */
  label: string | null
  /** Base letter used only to pick the colour. Null means neutral colour. */
  letter: GradeLetter | null
  /** Numeric average when one is known, already rounded to at most 1 decimal: "93.5". */
  percent: string | null
}

const LETTER_GRADE = /^([ABCDF])([+-]?)(?![A-Za-z0-9])/
const MAX_SHORT_LABEL = 4
const MAX_PERCENT = 200

function isGradeLetter(value: string): value is GradeLetter {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D' || value === 'F'
}

function toPercent(value: number | null): number | null {
  return value !== null && value >= 0 && value <= MAX_PERCENT ? Math.round(value * 10) / 10 : null
}

/**
 * Resolve a grade from whatever the portal sent. `letterRaw` wins when it starts with A, B, C, D or F
 * (so "A-" gives label "A-", letter "A"). Otherwise a numeric `numericRaw` (or a numeric `letterRaw`,
 * which live HAC sends) gives percent, and the letter comes from averageToLetter. A short non-numeric
 * value such as "P" or "I" becomes the label with letter null.
 *
 * Order of precedence: a letter grade, then a short non-numeric token (its text is never replaced by a
 * derived letter), then a numeric value. The numeric value fills `percent` in every case.
 */
export function resolveGrade(letterRaw: unknown, numericRaw: unknown): GradeDisplay {
  const letterText = asText(letterRaw)
  const percentValue = toPercent(asNumber(numericRaw) ?? asNumber(letterRaw))
  const percent = percentValue === null ? null : String(percentValue)

  if (letterText !== null) {
    const match = LETTER_GRADE.exec(letterText.toUpperCase())
    if (match && isGradeLetter(match[1])) {
      return { label: match[1] + match[2], letter: match[1], percent }
    }
    if (asNumber(letterText) === null && letterText.length <= MAX_SHORT_LABEL) {
      return { label: letterText, letter: null, percent }
    }
  }

  if (percentValue !== null) {
    const derived = averageToLetter(percentValue)
    return { label: derived, letter: isGradeLetter(derived) ? derived : null, percent }
  }
  return { label: null, letter: null, percent: null }
}

/** "1.0" -> "1 credit", "0.5" -> "0.5 credits"; null when not numeric. */
export function formatCredits(value: unknown): string | null {
  const parsed = asNumber(value)
  if (parsed === null || parsed < 0) return null
  const rounded = Math.round(parsed * 100) / 100
  return rounded === 1 ? '1 credit' : `${rounded} credits`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function validDate(year: number, month: number, day: number): { year: number; monthIndex: number; day: number } | null {
  if (month < 1 || month > 12 || day < 1) return null
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day <= daysInMonth ? { year, monthIndex: month - 1, day } : null
}

/** Parses "YYYY-MM-DD" or "MM/DD/YYYY" by splitting (never `new Date(string)`, which shifts a day in US time zones). */
export function parsePortalDate(value: unknown): { year: number; monthIndex: number; day: number } | null {
  const text = asText(value)
  if (text === null) return null
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(text)
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (us) return validDate(Number(us[3]), Number(us[1]), Number(us[2]))
  return null
}

/** "Nov 6" for the current year, "Nov 6, 2025" otherwise; falls back to the raw string. */
export function formatPortalDate(value: unknown): string | null {
  const parsed = parsePortalDate(value)
  if (parsed === null) return asText(value)
  const base = `${MONTHS[parsed.monthIndex]} ${parsed.day}`
  return parsed.year === new Date().getFullYear() ? base : `${base}, ${parsed.year}`
}
