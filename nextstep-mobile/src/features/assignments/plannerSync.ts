import type { CanvasStatus } from '../../api/canvasApi'
import type { CurrentGradeCourse } from '../../types/grades'
import type { Assignment } from '../../types/assignments'

export const CANVAS_AUTO_SYNC_MAX_AGE_MS = 30 * 60 * 1000

const MINUTE_MS = 60_000

export interface PortalItem {
  /** Stable key: normalized title + due day + course. */
  key: string
  title: string
  courseName: string
  /** Local midnight of the due day. */
  dueDate: Date
  /** 'YYYY-MM-DD' of the local due day, ready for createAssignment. */
  dueKey: string
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function localDay(year: number, month: number, day: number): Date | null {
  const d = new Date(year, month - 1, day)
  // Reject overflow such as 2026-02-31 rolling into March.
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return d
}

/**
 * Parses a due date to a local calendar day. 'YYYY-MM-DD' (and 'M/D/YYYY') are read as
 * local days, never UTC; anything else goes through Date and is truncated to its local day.
 */
export function parseLocalDay(value: string | null | undefined): Date | null {
  if (!value) return null
  const text = value.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (iso) return localDay(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (us) return localDay(Number(us[3]), Number(us[1]), Number(us[2]))
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed)
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** True when Canvas is connected and has never synced, or last synced more than 30 minutes ago. */
export function shouldAutoSyncCanvas(
  status: Pick<CanvasStatus, 'connected' | 'lastSynced'> | null | undefined,
  now: Date,
): boolean {
  if (!status?.connected) return false
  if (!status.lastSynced) return true
  const last = new Date(status.lastSynced).getTime()
  if (Number.isNaN(last)) return true
  return now.getTime() - last > CANVAS_AUTO_SYNC_MAX_AGE_MS
}

/**
 * Flattens portal upcoming assignments, drops ones already in the planner (same normalized
 * title and due day), unparseable dates, and dates more than 1 day in the past, then sorts
 * by due day (title as tiebreak).
 */
export function selectPortalItems(
  courses: CurrentGradeCourse[],
  assignments: Pick<Assignment, 'title' | 'dueDate'>[],
  now: Date,
): PortalItem[] {
  const seen = new Set<string>()
  for (const assignment of assignments) {
    const day = parseLocalDay(assignment.dueDate)
    if (day) seen.add(`${normalizeTitle(assignment.title)}|${toDayKey(day)}`)
  }

  const earliest = startOfDay(now)
  earliest.setDate(earliest.getDate() - 1)

  const items: PortalItem[] = []
  for (const course of courses) {
    for (const upcoming of course.upcomingAssignments ?? []) {
      const title = (upcoming.name ?? '').trim().replace(/\s+/g, ' ')
      if (!title) continue
      const day = parseLocalDay(upcoming.dateDue)
      if (!day || day.getTime() < earliest.getTime()) continue
      const dedupeKey = `${normalizeTitle(title)}|${toDayKey(day)}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      items.push({
        key: `${dedupeKey}|${course.id ?? course.name}`,
        title,
        courseName: course.name,
        dueDate: day,
        dueKey: toDayKey(day),
      })
    }
  }

  return items.sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.title.localeCompare(b.title),
  )
}

/** "just now", "5m ago", "2h ago", "yesterday", or a short date. */
export function formatLastSynced(iso: string | null | undefined, now: Date): string {
  if (!iso) return 'never'
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return 'never'
  const diff = now.getTime() - then.getTime()
  if (diff < MINUTE_MS) return 'just now'
  if (diff < 60 * MINUTE_MS) return `${Math.floor(diff / MINUTE_MS)}m ago`

  const dayDiff = Math.round(
    (startOfDay(now).getTime() - startOfDay(then).getTime()) / 86_400_000,
  )
  if (dayDiff <= 0) return `${Math.floor(diff / (60 * MINUTE_MS))}h ago`
  if (dayDiff === 1) return 'yesterday'
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
