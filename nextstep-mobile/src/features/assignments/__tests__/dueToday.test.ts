import {
  formatAssignmentDueTime,
  getAssignmentDestination,
  getDueTodayAssignments,
  splitDueTime,
} from '../dueToday'
import type { Assignment } from '../../../types/assignments'

function assignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 1,
    userId: 7,
    title: 'Essay',
    subject: 'English',
    dueDate: new Date(2026, 7, 1, 15, 30).toISOString(),
    dueTime: '3:30 PM',
    estimatedMinutes: 45,
    completed: false,
    completedAt: null,
    source: 'MANUAL',
    priority: 'MEDIUM',
    createdAt: new Date(2026, 6, 30).toISOString(),
    updatedAt: new Date(2026, 6, 30).toISOString(),
    ...overrides,
  }
}

describe('due today assignments', () => {
  const now = new Date(2026, 7, 1, 9, 0)

  it('filters by the local calendar day and excludes completed work', () => {
    const result = getDueTodayAssignments(
      [
        assignment({ id: 1 }),
        assignment({ id: 2, completed: true }),
        assignment({ id: 3, dueDate: new Date(2026, 7, 2, 0, 1).toISOString() }),
      ],
      now,
    )
    expect(result.map((item) => item.id)).toEqual([1])
  })

  it('handles timezone offsets by comparing parsed local calendar fields', () => {
    const localLateNight = new Date(2026, 7, 1, 23, 45)
    const result = getDueTodayAssignments(
      [assignment({ dueDate: localLateNight.toISOString() })],
      now,
    )
    expect(result).toHaveLength(1)
  })

  it('sorts by due instant and then priority and title', () => {
    const sharedTime = new Date(2026, 7, 1, 12, 0).toISOString()
    const result = getDueTodayAssignments(
      [
        assignment({ id: 3, title: 'Zulu', dueDate: sharedTime, priority: 'LOW' }),
        assignment({ id: 2, title: 'Beta', dueDate: sharedTime, priority: 'HIGH' }),
        assignment({ id: 1, title: 'Alpha', dueDate: new Date(2026, 7, 1, 10).toISOString() }),
      ],
      now,
    )
    expect(result.map((item) => item.id)).toEqual([1, 2, 3])
  })

  it('ignores assignments with missing or invalid due dates', () => {
    expect(
      getDueTodayAssignments([assignment({ dueDate: '' }), assignment({ dueDate: 'invalid' })], now),
    ).toEqual([])
  })

  it('uses the explicit due time and validates destinations', () => {
    expect(formatAssignmentDueTime(assignment())).toBe('3:30 PM')
    expect(getAssignmentDestination(42)).toEqual({ assignmentId: 42 })
    expect(getAssignmentDestination(0)).toBeNull()
    expect(getAssignmentDestination(Number.NaN)).toBeNull()
  })
})

describe('splitDueTime', () => {
  it('splits 12-hour, 24-hour and missing times for the time rail', () => {
    expect(splitDueTime(assignment({ dueTime: '3:30 PM' }))).toEqual({ clock: '3:30', period: 'PM' })
    expect(splitDueTime(assignment({ dueTime: '15:30' }))).toEqual({ clock: '3:30', period: 'PM' })
    expect(splitDueTime(assignment({ dueTime: '00:05' }))).toEqual({ clock: '12:05', period: 'AM' })
    expect(splitDueTime(assignment({ dueTime: '11:59 p.m.' }))).toEqual({ clock: '11:59', period: 'PM' })
    expect(splitDueTime(assignment({ dueTime: null, dueDate: 'not a date' }))).toEqual({ clock: '—', period: '' })
  })
})
