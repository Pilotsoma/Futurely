import { formatLastSynced, selectPortalItems, shouldAutoSyncCanvas } from '../plannerSync'
import type { CurrentGradeCourse, NormalizedAssignment } from '../../../types/grades'

const now = new Date(2026, 9, 27, 12, 0, 0)
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString()

function upcoming(name: string, dateDue: string): NormalizedAssignment {
  return { name, category: 'Homework', score: null, totalPoints: null, percentage: '', dateDue }
}

function course(name: string, items: NormalizedAssignment[]): CurrentGradeCourse {
  return {
    id: name,
    name,
    teacher: '',
    period: '1',
    average: null,
    letterGrade: null,
    assignments: [],
    upcomingAssignments: items,
  }
}

describe('shouldAutoSyncCanvas', () => {
  it('is false when disconnected, even if never synced', () => {
    expect(shouldAutoSyncCanvas({ connected: false, lastSynced: null }, now)).toBe(false)
    expect(shouldAutoSyncCanvas({ connected: false, lastSynced: minutesAgo(600) }, now)).toBe(false)
  })

  it('is true when connected and never synced', () => {
    expect(shouldAutoSyncCanvas({ connected: true, lastSynced: null }, now)).toBe(true)
  })

  it('respects the 30 minute threshold edges', () => {
    expect(shouldAutoSyncCanvas({ connected: true, lastSynced: minutesAgo(29) }, now)).toBe(false)
    expect(shouldAutoSyncCanvas({ connected: true, lastSynced: minutesAgo(30) }, now)).toBe(false)
    expect(
      shouldAutoSyncCanvas(
        { connected: true, lastSynced: new Date(now.getTime() - 30 * 60_000 - 1).toISOString() },
        now,
      ),
    ).toBe(true)
    expect(shouldAutoSyncCanvas({ connected: true, lastSynced: minutesAgo(31) }, now)).toBe(true)
  })

  it('treats an unparseable lastSynced as stale', () => {
    expect(shouldAutoSyncCanvas({ connected: true, lastSynced: 'nope' }, now)).toBe(true)
  })
})

describe('selectPortalItems', () => {
  it('dedupes against planner assignments by normalized title and due day', () => {
    const courses = [
      course('Biology', [upcoming('Cell  Lab Report', '2026-10-30'), upcoming('Quiz 4', '2026-10-30')]),
    ]
    const planner = [{ title: ' cell lab REPORT ', dueDate: new Date(2026, 9, 30, 23, 59).toISOString() }]
    expect(selectPortalItems(courses, planner, now).map((i) => i.title)).toEqual(['Quiz 4'])
  })

  it('keeps an item with the same title on a different day', () => {
    const courses = [course('Bio', [upcoming('Lab', '2026-10-31')])]
    const planner = [{ title: 'Lab', dueDate: new Date(2026, 9, 30, 12).toISOString() }]
    expect(selectPortalItems(courses, planner, now)).toHaveLength(1)
  })

  it('parses YYYY-MM-DD as a local day', () => {
    const [item] = selectPortalItems([course('Bio', [upcoming('Lab', '2026-10-30')])], [], now)
    expect(item.dueKey).toBe('2026-10-30')
    expect(item.dueDate.getDate()).toBe(30)
    expect(item.dueDate.getHours()).toBe(0)
  })

  it('drops unparseable dates and items more than 1 day in the past', () => {
    const courses = [
      course('Bio', [
        upcoming('Bad date', 'someday'),
        upcoming('Empty date', ''),
        upcoming('Two days ago', '2026-10-25'),
        upcoming('Yesterday', '2026-10-26'),
        upcoming('Today', '2026-10-27'),
      ]),
    ]
    expect(selectPortalItems(courses, [], now).map((i) => i.title)).toEqual(['Yesterday', 'Today'])
  })

  it('flattens courses and sorts by due date', () => {
    const courses = [
      course('Math', [upcoming('Worksheet', '2026-11-02'), upcoming('Test', '2026-10-28')]),
      course('Art', [upcoming('Sketch', '2026-10-29')]),
    ]
    const items = selectPortalItems(courses, [], now)
    expect(items.map((i) => i.title)).toEqual(['Test', 'Sketch', 'Worksheet'])
    expect(items.map((i) => i.courseName)).toEqual(['Math', 'Art', 'Math'])
  })
})

describe('formatLastSynced', () => {
  it('buckets relative times', () => {
    expect(formatLastSynced(minutesAgo(0), now)).toBe('just now')
    expect(formatLastSynced(minutesAgo(5), now)).toBe('5m ago')
    expect(formatLastSynced(minutesAgo(59), now)).toBe('59m ago')
    expect(formatLastSynced(minutesAgo(120), now)).toBe('2h ago')
  })

  it('uses yesterday and dates for older syncs', () => {
    expect(formatLastSynced(new Date(2026, 9, 26, 8).toISOString(), now)).toBe('yesterday')
    expect(formatLastSynced(new Date(2026, 9, 20, 8).toISOString(), now)).toBe('Oct 20')
  })

  it('handles null and invalid input', () => {
    expect(formatLastSynced(null, now)).toBe('never')
    expect(formatLastSynced('bad', now)).toBe('never')
  })
})
