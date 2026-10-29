import AsyncStorage from '@react-native-async-storage/async-storage'

export interface GpaReading {
  date: string // YYYY-MM-DD, local day
  gpa: number
}

export const MAX_GPA_READINGS = 60

export function gpaHistoryKey(userId: string | number): string {
  return `futurely.gpaHistory.${userId}`
}

export function toLocalDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function appendGpaReading(history: GpaReading[], reading: GpaReading): GpaReading[] {
  return [...history.filter((entry) => entry.date !== reading.date), reading]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-MAX_GPA_READINGS)
}

function isReading(value: unknown): value is GpaReading {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<GpaReading>
  return (
    typeof candidate.date === 'string' &&
    typeof candidate.gpa === 'number' &&
    Number.isFinite(candidate.gpa)
  )
}

export async function loadGpaHistory(userId: string | number): Promise<GpaReading[]> {
  try {
    const raw = await AsyncStorage.getItem(gpaHistoryKey(userId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isReading) : []
  } catch {
    return []
  }
}

export async function recordGpaReading(
  userId: string | number,
  gpa: number,
  now = new Date(),
): Promise<GpaReading[]> {
  const history = await loadGpaHistory(userId)
  const next = appendGpaReading(history, { date: toLocalDateString(now), gpa })
  try {
    await AsyncStorage.setItem(gpaHistoryKey(userId), JSON.stringify(next))
  } catch {
    // Storage is best effort; the in-memory history still renders.
  }
  return next
}
