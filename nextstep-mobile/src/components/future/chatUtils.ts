import type { CounselorChatMessage } from '../../api/counselorApi'

/** Merge message lists, de-duplicating by id, oldest first. */
export function mergeMessages(
  existing: readonly CounselorChatMessage[],
  incoming: readonly CounselorChatMessage[],
): CounselorChatMessage[] {
  const byId = new Map<number, CounselorChatMessage>()
  for (const m of existing) byId.set(m.id, m)
  for (const m of incoming) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

/**
 * Unread = messages from the counselor newer than the last one the student saw.
 * The backend tracks read state for the counselor side only, so the student's
 * "last seen" id is kept on-device.
 */
export function countUnread(
  messages: readonly CounselorChatMessage[],
  counselorId: number,
  lastSeenId: number | null,
): number {
  return messages.filter((m) => m.senderId === counselorId && (lastSeenId === null || m.id > lastSeenId)).length
}

export function latestMessageId(messages: readonly CounselorChatMessage[]): number | null {
  return messages.reduce<number | null>((max, m) => (max === null || m.id > max ? m.id : max), null)
}

export interface MessageGroup {
  key: string
  label: string
  messages: CounselorChatMessage[]
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** Group oldest-first messages by local calendar day with a Today/Yesterday/date label. */
export function groupMessagesByDay(messages: readonly CounselorChatMessage[], now: Date = new Date()): MessageGroup[] {
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const groups: MessageGroup[] = []
  for (const m of messages) {
    const d = new Date(m.createdAt)
    const key = dayKey(d)
    let g = groups[groups.length - 1]
    if (!g || g.key !== key) {
      const label =
        key === dayKey(now)
          ? 'Today'
          : key === dayKey(yesterday)
            ? 'Yesterday'
            : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      g = { key, label, messages: [] }
      groups.push(g)
    }
    g.messages.push(m)
  }
  return groups
}
