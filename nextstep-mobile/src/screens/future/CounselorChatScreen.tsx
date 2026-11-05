import React, { useCallback, useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import { Screen } from '../../components/ui/Screen'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorRetryBlock } from '../../components/ui/ErrorRetryBlock'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import Skeleton from '../../components/ui/Skeleton'
import * as counselorApi from '../../api/counselorApi'
import type { CounselorChatMessage, CounselorLink, CounselorPortal } from '../../api/counselorApi'
import { groupMessagesByDay, latestMessageId, mergeMessages } from '../../components/future/chatUtils'
import { saveLastSeenId } from '../../components/future/chatSeen'
import { colors, radii, spacing, typography } from '../../theme/tokens'

// The web app gets new messages via Supabase realtime broadcast; the mobile app has
// no realtime client, so it polls the same GET endpoint while focused.
const POLL_MS = 8000

type Tab = 'Chat' | 'Plan'
const TABS = ['Chat', 'Plan'] as const

type Row =
  | { type: 'day'; key: string; label: string }
  | { type: 'msg'; key: string; message: CounselorChatMessage }

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function CounselorChatScreen(): React.JSX.Element {
  const [link, setLink] = useState<CounselorLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<CounselorChatMessage[]>([])
  const [portal, setPortal] = useState<CounselorPortal | null>(null)
  const [tab, setTab] = useState<Tab>('Chat')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const listRef = useRef<FlatList<Row>>(null)

  const counselorId = link?.counselorId ?? null

  const markSeen = useCallback((id: number, list: readonly CounselorChatMessage[]) => {
    const latest = latestMessageId(list)
    if (latest !== null) void saveLastSeenId(id, latest)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const links = await counselorApi.listActiveCounselorLinks()
      const first = links[0] ?? null
      setLink(first)
      if (first) {
        const [page, p] = await Promise.all([
          counselorApi.getCounselorChat(first.counselorId),
          counselorApi.getCounselorPortal(first.counselorId).catch(() => null),
        ])
        const list = mergeMessages([], page.messages)
        setMessages(list)
        setPortal(p)
        markSeen(first.counselorId, list) // opening the chat marks everything read
      }
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [markSeen])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  // Poll only while focused; the interval is cleared on blur.
  useFocusEffect(
    useCallback(() => {
      if (counselorId === null) return undefined
      const id = setInterval(() => {
        counselorApi
          .getCounselorChat(counselorId)
          .then((page) => {
            setMessages((prev) => {
              const merged = mergeMessages(prev, page.messages)
              markSeen(counselorId, merged)
              return merged.length === prev.length ? prev : merged
            })
          })
          .catch(() => {})
      }, POLL_MS)
      return () => clearInterval(id)
    }, [counselorId, markSeen]),
  )

  const send = async (): Promise<void> => {
    const body = draft.trim()
    if (!body || counselorId === null || sending) return
    setSending(true)
    setSendError(null)
    try {
      const sent = await counselorApi.sendCounselorMessage(counselorId, body)
      setMessages((prev) => {
        const merged = mergeMessages(prev, [sent])
        markSeen(counselorId, merged)
        return merged
      })
      setDraft('')
    } catch (e) {
      setSendError(errMsg(e))
    } finally {
      setSending(false)
    }
  }

  if (loading && !link) {
    return (
      <Screen>
        <View style={styles.skeletons}>
          <Skeleton height={48} radius={radii.md} />
          <Skeleton height={48} width="70%" radius={radii.md} />
          <Skeleton height={48} radius={radii.md} />
        </View>
      </Screen>
    )
  }

  if (error) {
    return (
      <Screen>
        <ErrorRetryBlock message={error} onRetry={() => void load()} />
      </Screen>
    )
  }

  if (!link || counselorId === null) {
    return (
      <Screen>
        <EmptyState
          icon="user-x"
          title="No counselor linked"
          message="Your school counselor needs to send you a link request, and you need to accept it. Once you are linked, you can message them here and see their action items and course recommendations."
        />
      </Screen>
    )
  }

  const rows: Row[] = groupMessagesByDay(messages).flatMap((g) => [
    { type: 'day' as const, key: `d-${g.key}`, label: g.label },
    ...g.messages.map((m) => ({ type: 'msg' as const, key: `m-${m.id}`, message: m })),
  ])

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.name}>{link.counselor.name ?? link.counselor.email}</Text>
        <Text style={styles.sub}>Your counselor</Text>
      </View>
      <SegmentedControl segments={TABS} value={tab} onChange={setTab} />

      {tab === 'Chat' ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={listRef}
            style={styles.flex}
            contentContainerStyle={styles.list}
            data={rows}
            keyExtractor={(r) => r.key}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <EmptyState icon="message-circle" title="No messages yet" message="Say hello to your counselor." />
            }
            renderItem={({ item }) => {
              if (item.type === 'day') return <Text style={styles.day}>{item.label}</Text>
              const mine = item.message.senderId !== counselorId
              return (
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  <Text style={styles.bubbleText}>{item.message.body}</Text>
                  <Text style={styles.time}>
                    {new Date(item.message.createdAt).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              )
            }}
          />
          {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Message your counselor"
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={2000}
              accessibilityLabel="Message your counselor"
            />
            <Pressable
              onPress={() => void send()}
              disabled={sending || !draft.trim()}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              style={[styles.send, (sending || !draft.trim()) && styles.sendDisabled]}
            >
              <Feather name="send" size={18} color={colors.text} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <FlatList
          style={styles.flex}
          contentContainerStyle={styles.plan}
          data={[1]}
          keyExtractor={() => 'plan'}
          renderItem={() => <PlanView portal={portal} />}
        />
      )}
    </Screen>
  )
}

function PlanView({ portal }: { portal: CounselorPortal | null }): React.JSX.Element {
  if (!portal) {
    return <EmptyState icon="alert-circle" title="Could not load plan" message="Leave and reopen this screen to retry." />
  }
  return (
    <View style={styles.planInner}>
      <Text style={styles.section}>Action items</Text>
      {portal.actionItems.length === 0 ? (
        <Text style={styles.sub}>No action items yet.</Text>
      ) : (
        portal.actionItems.map((a) => (
          <Card key={a.id} style={styles.item}>
            <Feather
              name={a.completed ? 'check-circle' : 'circle'}
              size={18}
              color={a.completed ? colors.success : colors.textMuted}
            />
            <View style={styles.flex}>
              <Text style={[styles.itemTitle, a.completed && styles.done]}>{a.title}</Text>
              {a.description ? <Text style={styles.sub}>{a.description}</Text> : null}
              {a.dueDate ? <Text style={styles.sub}>Due {formatDate(a.dueDate)}</Text> : null}
            </View>
          </Card>
        ))
      )}
      <Text style={styles.section}>Recommended courses</Text>
      {portal.recommendations.length === 0 ? (
        <Text style={styles.sub}>No recommendations yet.</Text>
      ) : (
        portal.recommendations.map((r) => (
          <Card key={r.id} style={styles.item}>
            <Feather name="book-open" size={18} color={colors.primary} />
            <View style={styles.flex}>
              <Text style={styles.itemTitle}>
                {r.courseName}
                {r.courseCode ? ` (${r.courseCode})` : ''}
              </Text>
              <Text style={styles.sub}>{r.semester}</Text>
              {r.rationale ? <Text style={styles.sub}>{r.rationale}</Text> : null}
            </View>
          </Card>
        ))
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  skeletons: { gap: spacing.md, paddingTop: spacing.md },
  header: { marginBottom: spacing.md },
  name: { ...typography.h2, color: colors.text },
  sub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  list: { paddingVertical: spacing.md, gap: spacing.sm, flexGrow: 1 },
  day: { ...typography.label, color: colors.textMuted, textAlign: 'center', marginVertical: spacing.sm },
  bubble: { maxWidth: '82%', padding: spacing.ms, borderRadius: radii.md },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  bubbleText: { fontSize: typography.body.fontSize, color: colors.text },
  time: { ...typography.caption, color: colors.textSecondary, marginTop: 2, alignSelf: 'flex-end' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingVertical: spacing.sm },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body.fontSize,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  error: { ...typography.caption, color: colors.error },
  plan: { paddingVertical: spacing.md },
  planInner: { gap: spacing.sm },
  section: { ...typography.h3, color: colors.text, marginTop: spacing.md },
  item: { flexDirection: 'row', gap: spacing.ms, alignItems: 'flex-start' },
  itemTitle: { ...typography.h3, color: colors.text },
  done: { textDecorationLine: 'line-through', color: colors.textSecondary },
})
