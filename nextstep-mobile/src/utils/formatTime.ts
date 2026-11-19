const CLOCK_24H = /^(\d{1,2}):(\d{2})(?::\d{2})?$/

/**
 * Formats a stored 24-hour "HH:MM" time (optionally "HH:MM:SS") as a 12-hour
 * clock time: "15:30" -> "3:30 PM", "09:05" -> "9:05 AM", "00:15" -> "12:15 AM".
 *
 * Anything that is not a valid 24-hour time (e.g. an already formatted
 * "3:30 PM") is returned trimmed and otherwise unchanged. Empty, null and
 * undefined return null.
 */
export function formatClockTime(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const match = CLOCK_24H.exec(trimmed)
  if (!match) return trimmed

  const hours = Number(match[1])
  const minutes = match[2]
  if (hours > 23 || Number(minutes) > 59) return trimmed

  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${hour12}:${minutes} ${period}`
}
