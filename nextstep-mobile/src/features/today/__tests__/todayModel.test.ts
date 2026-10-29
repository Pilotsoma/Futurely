import { buildAlerts, groupDueAssignments } from '../todayModel'
import type { Assignment } from '../../../types/assignments'
import type { CurrentGradeCourse } from '../../../types/grades'

function assignment(id: number, dueDate: string, completed = false): Assignment {
  return {
    id,
    userId: 1,
    title: `Task ${id}`,
    subject: 'Math',
    dueDate,
    dueTime: null,
    estimatedMinutes: null,
    completed,
    completedAt: null,
    source: 'MANUAL',
    priority: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function course(id: string, average: number | null): CurrentGradeCourse {
  return {
    id,
    name: `Course ${id}`,
    teacher: 'Teacher',
    period: '1',
    average,
    letterGrade: null,
    assignments: [],
    upcomingAssignments: [],
  }
}

describe('groupDueAssignments', () => {
  it('splits overdue, today and tomorrow across a month boundary', () => {
    const now = new Date(2026, 0, 31, 9, 0) // Jan 31 local
    const groups = groupDueAssignments(
      [
        assignment(1, '2026-01-30'),
        assignment(2, '2026-01-31'),
        assignment(3, '2026-02-01'),
        assignment(4, '2026-02-02'),
      ],
      now,
    )

    expect(groups.overdue.map((item) => item.id)).toEqual([1])
    expect(groups.today.map((item) => item.id)).toEqual([2])
    expect(groups.tomorrow.map((item) => item.id)).toEqual([3])
  })

  it('excludes completed assignments and invalid dates', () => {
    const now = new Date(2026, 5, 10, 12, 0)
    const groups = groupDueAssignments(
      [assignment(1, '2026-06-09', true), assignment(2, '2026-06-10', true), assignment(3, 'nope')],
      now,
    )

    expect(groups).toEqual({ overdue: [], today: [], tomorrow: [] })
  })

  it('uses the local calendar day for timestamps', () => {
    const now = new Date(2026, 2, 5, 23, 30)
    const localNoonTomorrow = new Date(2026, 2, 6, 12, 0).toISOString()
    const groups = groupDueAssignments([assignment(1, localNoonTomorrow)], now)

    expect(groups.tomorrow.map((item) => item.id)).toEqual([1])
  })
})

describe('buildAlerts', () => {
  const now = new Date(2026, 3, 15, 8, 0)

  it('returns nothing when everything is fine', () => {
    expect(buildAlerts([assignment(1, '2026-04-15')], [course('a', 92)], now)).toEqual({
      visible: [],
      hiddenCount: 0,
    })
  })

  it('flags overdue assignments and courses below 80 only', () => {
    const { visible, hiddenCount } = buildAlerts(
      [assignment(1, '2026-04-14'), assignment(2, '2026-04-13', true)],
      [course('a', 76.4), course('b', 80), course('c', null)],
      now,
    )

    expect(hiddenCount).toBe(0)
    expect(visible).toHaveLength(2)
    expect(visible[0]).toMatchObject({ kind: 'assignment', assignmentId: 1, detail: 'Overdue' })
    expect(visible[1]).toMatchObject({ kind: 'course', title: 'Course a is at 76%' })
  })

  it('caps visible alerts at 3 and counts the rest', () => {
    const { visible, hiddenCount } = buildAlerts(
      [assignment(1, '2026-04-10'), assignment(2, '2026-04-11')],
      [course('a', 70), course('b', 60), course('c', 50)],
      now,
    )

    expect(visible).toHaveLength(3)
    expect(hiddenCount).toBe(2)
  })
})
