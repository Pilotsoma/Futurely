import { countUnread, groupMessagesByDay, latestMessageId, mergeMessages } from '../chatUtils'
import type { CounselorChatMessage } from '../../../api/counselorApi'

const msg = (id: number, senderId: number, createdAt: string): CounselorChatMessage => ({
  id,
  body: `m${id}`,
  senderId,
  senderName: null,
  createdAt,
})

describe('chatUtils', () => {
  it('merges, de-dupes and sorts oldest first', () => {
    const a = [msg(3, 1, '2026-01-03T10:00:00'), msg(2, 1, '2026-01-02T10:00:00')]
    const b = [msg(3, 1, '2026-01-03T10:00:00'), msg(4, 9, '2026-01-04T10:00:00')]
    expect(mergeMessages(a, b).map((m) => m.id)).toEqual([2, 3, 4])
  })

  it('counts only counselor messages newer than last seen', () => {
    const ms = [msg(1, 5, '2026-01-01T10:00:00'), msg(2, 9, '2026-01-01T11:00:00'), msg(3, 5, '2026-01-01T12:00:00')]
    expect(countUnread(ms, 5, null)).toBe(2)
    expect(countUnread(ms, 5, 1)).toBe(1)
    expect(countUnread(ms, 5, 3)).toBe(0)
  })

  it('finds the latest id', () => {
    expect(latestMessageId([])).toBeNull()
    expect(latestMessageId([msg(2, 1, '2026-01-01T10:00:00'), msg(7, 1, '2026-01-01T10:00:00')])).toBe(7)
  })

  it('groups by day with Today/Yesterday labels', () => {
    const now = new Date(2026, 5, 10, 15, 0, 0)
    const ms = [
      msg(1, 1, new Date(2026, 5, 8, 9).toISOString()),
      msg(2, 1, new Date(2026, 5, 9, 23).toISOString()),
      msg(3, 1, new Date(2026, 5, 10, 8).toISOString()),
      msg(4, 1, new Date(2026, 5, 10, 9).toISOString()),
    ]
    const groups = groupMessagesByDay(ms, now)
    expect(groups.map((g) => g.label).slice(1)).toEqual(['Yesterday', 'Today'])
    expect(groups.map((g) => g.messages.length)).toEqual([1, 1, 2])
  })
})
