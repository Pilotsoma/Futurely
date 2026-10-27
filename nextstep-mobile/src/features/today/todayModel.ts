import type { Assignment } from '../../types/assignments'
import type { CurrentGradeCourse } from '../../types/grades'

export const LOW_COURSE_AVERAGE_THRESHOLD = 80
export const MAX_VISIBLE_ALERTS = 3

export interface DueGroups {
  overdue: Assignment[]
  today: Assignment[]
  tomorrow: Assignment[]
}

export type TodayAlert =
  | { kind: 'assignment'; key: string; title: string; detail: string; assignmentId: number }
  | { kind: 'course'; key: string; title: string; detail: string }

export interface TodayAlerts {
  visible: TodayAlert[]
  hiddenCount: number
}

// A "YYYY-MM-DD" string is a calendar date, so parse it as local time. Anything
// else (full ISO timestamps) is an instant, so convert it to the local day.
function toLocalDayKey(value: string): number | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (dateOnly) {
    return Number(dateOnly[1]) * 10000 + Number(dateOnly[2]) * 100 + Number(dateOnly[3])
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return dayKeyOf(parsed)
}

function dayKeyOf(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
}

function compareAssignments(
  left: { assignment: Assignment; day: number },
  right: { assignment: Assignment; day: number },
): number {
  if (left.day !== right.day) return left.day - right.day
  const timeDifference = (left.assignment.dueTime ?? '').localeCompare(right.assignment.dueTime ?? '')
  if (timeDifference !== 0) return timeDifference
  return left.assignment.title.localeCompare(right.assignment.title)
}

export function groupDueAssignments(assignments: Assignment[], now: Date): DueGroups {
  const todayKey = dayKeyOf(now)
  const tomorrowKey = dayKeyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))

  const overdue: { assignment: Assignment; day: number }[] = []
  const today: { assignment: Assignment; day: number }[] = []
  const tomorrow: { assignment: Assignment; day: number }[] = []

  for (const assignment of assignments) {
    if (assignment.completed) continue
    const day = toLocalDayKey(assignment.dueDate)
    if (day === null) continue

    const entry = { assignment, day }
    if (day < todayKey) overdue.push(entry)
    else if (day === todayKey) today.push(entry)
    else if (day === tomorrowKey) tomorrow.push(entry)
  }

  const unwrap = (entries: { assignment: Assignment; day: number }[]): Assignment[] =>
    entries.sort(compareAssignments).map((entry) => entry.assignment)

  return { overdue: unwrap(overdue), today: unwrap(today), tomorrow: unwrap(tomorrow) }
}

export function getLowCourses(courses: CurrentGradeCourse[]): CurrentGradeCourse[] {
  return courses
    .filter(
      (course) =>
        typeof course.average === 'number' &&
        Number.isFinite(course.average) &&
        course.average < LOW_COURSE_AVERAGE_THRESHOLD,
    )
    .sort((left, right) => (left.average ?? 0) - (right.average ?? 0))
}

export function buildAlerts(
  assignments: Assignment[],
  courses: CurrentGradeCourse[],
  now: Date,
  maxVisible = MAX_VISIBLE_ALERTS,
): TodayAlerts {
  const alerts: TodayAlert[] = [
    ...groupDueAssignments(assignments, now).overdue.map(
      (assignment): TodayAlert => ({
        kind: 'assignment',
        key: `assignment-${assignment.id}`,
        title: assignment.title,
        detail: 'Overdue',
        assignmentId: assignment.id,
      }),
    ),
    ...getLowCourses(courses).map(
      (course): TodayAlert => ({
        kind: 'course',
        key: `course-${course.id}`,
        title: `${course.name} is at ${Math.round(course.average ?? 0)}%`,
        detail: 'Below 80%',
      }),
    ),
  ]

  return {
    visible: alerts.slice(0, maxVisible),
    hiddenCount: Math.max(0, alerts.length - maxVisible),
  }
}
