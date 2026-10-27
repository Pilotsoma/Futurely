import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRoute, type RouteProp } from '@react-navigation/native'
import { Screen } from '../../components/ui/Screen'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ErrorRetryBlock } from '../../components/ui/ErrorRetryBlock'
import { errorMessage, useFocusedInterval } from '../../components/study/util'
import {
  GAME_POLL_INTERVAL_MS,
  getGame,
  nextQuestion,
  revealResults,
  startGame,
  submitAnswer,
  type GameSession,
} from '../../api/gamesApi'
import { useAuth } from '../../context/AuthContext'
import type { StudyStackParamList } from '../../navigation/StudyNavigator'
import { colors, radii, spacing, typography } from '../../theme/tokens'

const OPTION_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b']
const LABELS = ['A', 'B', 'C', 'D']

interface MyAnswer {
  qIndex: number
  selected: string
  result: { isCorrect: boolean; pointsEarned: number } | null
}

function Leaderboard({ session, meId }: { session: GameSession; meId?: number }): React.JSX.Element {
  const rows = [...session.participants].sort((a, b) => b.score - a.score)
  if (rows.length === 0) return <Text style={styles.sub}>No players yet.</Text>
  return (
    <View style={styles.board}>
      {rows.map((p, i) => (
        <View key={p.id} style={[styles.boardRow, p.userId === meId && styles.boardRowMe]}>
          <Text style={styles.rank}>{i + 1}</Text>
          <Text style={styles.boardName} numberOfLines={1}>
            {p.user.name ?? 'Player'}
            {p.userId === meId ? ' (you)' : ''}
          </Text>
          <Text style={styles.score}>{p.score}</Text>
        </View>
      ))}
    </View>
  )
}

export default function GameScreen(): React.JSX.Element {
  const { code } = useRoute<RouteProp<StudyStackParamList, 'Game'>>().params
  const { user } = useAuth()

  const [session, setSession] = useState<GameSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [myAnswer, setMyAnswer] = useState<MyAnswer | null>(null)
  const [revealedIndex, setRevealedIndex] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const questionStart = useRef(Date.now())
  const trackedIndex = useRef<number | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const s = await getGame(code)
      if (!mounted.current) return
      setSession(s)
      setError(null)
    } catch (err) {
      if (!mounted.current) return
      // Keep showing the last good state during transient poll failures.
      setError((prev) => prev ?? errorMessage(err, 'Could not load this game.'))
    }
  }, [code])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const status = session?.status
  // Poll like the web page (3s) until the game is finished; cleared on blur/unmount.
  useFocusedInterval(() => void refresh(), GAME_POLL_INTERVAL_MS, status !== 'FINISHED')

  const currentIndex = session?.currentQuestion ?? 0
  const question = session?.set.questions[currentIndex]

  // New question: reset local timer. (The previous answer stays keyed by qIndex, so no reset needed.)
  useEffect(() => {
    if (status !== 'ACTIVE' || !question) return
    if (trackedIndex.current !== currentIndex) {
      trackedIndex.current = currentIndex
      questionStart.current = Date.now()
      setSecondsLeft(question.timeLimit)
    }
  }, [status, currentIndex, question])

  useFocusedInterval(
    () => {
      if (!question) return
      const left = question.timeLimit - Math.floor((Date.now() - questionStart.current) / 1000)
      setSecondsLeft(Math.max(0, left))
    },
    1000,
    status === 'ACTIVE',
  )

  if (error && !session) {
    return (
      <Screen>
        <ErrorRetryBlock message={error} onRetry={() => void refresh()} />
      </Screen>
    )
  }
  if (!session) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }

  const isHost = user?.id === session.hostId
  const total = session.set.questions.length

  async function run(action: () => Promise<unknown>): Promise<void> {
    setBusy(true)
    setActionError(null)
    try {
      await action()
      await refresh()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function answer(optionIndex: number): Promise<void> {
    if (!question || myAnswer?.qIndex === currentIndex || secondsLeft === 0) return
    const selected = String(optionIndex)
    const qIndex = currentIndex
    setMyAnswer({ qIndex, selected, result: null })
    try {
      const result = await submitAnswer(code, {
        questionId: question.id,
        answer: selected,
        timeMs: Date.now() - questionStart.current,
      })
      setMyAnswer({ qIndex, selected, result })
      void refresh()
    } catch (err) {
      setMyAnswer(null)
      setActionError(errorMessage(err, 'Could not submit your answer.'))
    }
  }

  const header = (
    <View style={styles.codeBox}>
      <Text style={styles.sub}>{session.set.title}</Text>
      <Text style={styles.code} accessibilityLabel={`Game code ${session.joinCode.split('').join(' ')}`}>
        {session.joinCode}
      </Text>
    </View>
  )

  // ── Lobby ──
  if (session.status === 'WAITING') {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          <Text style={styles.h}>
            Lobby · {session.participants.length} player{session.participants.length === 1 ? '' : 's'}
          </Text>
          <Leaderboard session={session} meId={user?.id} />
          {isHost ? (
            <Button
              label="Start game"
              loading={busy}
              disabled={session.participants.length === 0}
              onPress={() => void run(() => startGame(code))}
            />
          ) : (
            <Text style={styles.sub}>Waiting for {session.host.name ?? 'the host'} to start...</Text>
          )}
          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
        </ScrollView>
      </Screen>
    )
  }

  // ── Finished ──
  if (session.status === 'FINISHED') {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Final scores</Text>
          <Leaderboard session={session} meId={user?.id} />
        </ScrollView>
      </Screen>
    )
  }

  // ── Active ──
  if (!question) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }

  const mine = myAnswer?.qIndex === currentIndex ? myAnswer : null
  const revealed = isHost ? revealedIndex === currentIndex : mine?.result != null
  const isLast = currentIndex >= total - 1
  const correctIndex = question.correctAnswer

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.sub}>
            Question {currentIndex + 1} / {total}
          </Text>
          <Text style={[styles.timer, secondsLeft <= 5 && { color: colors.error }]}>{secondsLeft}s</Text>
        </View>
        <Text style={styles.question}>{question.questionText}</Text>

        {question.options.map((opt, i) => {
          const selected = mine?.selected === String(i)
          const isCorrect = correctIndex !== undefined && correctIndex === String(i)
          let bg: string = OPTION_COLORS[i] ?? colors.primary
          if (isHost && !revealed) bg = colors.surface2
          if (!isHost && mine && !selected) bg = colors.surface2
          if (revealed && isCorrect) bg = colors.success
          else if (revealed && selected && mine?.result && !mine.result.isCorrect) bg = colors.error
          const disabled = isHost || !!mine || secondsLeft === 0
          return (
            <Pressable
              key={i}
              disabled={disabled}
              onPress={() => void answer(i)}
              accessibilityRole="button"
              accessibilityLabel={`Option ${LABELS[i]}: ${opt}`}
              accessibilityState={{ disabled, selected }}
              style={[styles.option, { backgroundColor: bg, opacity: mine && !selected && !revealed ? 0.5 : 1 }]}
            >
              <Text style={styles.optLabel}>{LABELS[i]}</Text>
              <Text style={styles.optText}>{opt}</Text>
            </Pressable>
          )
        })}

        {!isHost && mine && !mine.result ? <Text style={styles.sub}>Submitting...</Text> : null}
        {!isHost && mine?.result ? (
          <Card style={styles.resultCard}>
            <Text style={[styles.h, { color: mine.result.isCorrect ? colors.success : colors.error }]}>
              {mine.result.isCorrect ? `Correct! +${mine.result.pointsEarned}` : 'Not quite'}
            </Text>
            <Text style={styles.sub}>Waiting for the host to move on...</Text>
          </Card>
        ) : null}
        {!isHost && !mine && secondsLeft === 0 ? <Text style={styles.sub}>Time is up for this question.</Text> : null}

        {(revealed || isHost) && <Text style={styles.h}>Scores</Text>}
        {(revealed || isHost) && <Leaderboard session={session} meId={user?.id} />}

        {isHost ? (
          <View style={styles.hostRow}>
            <Button
              label="Reveal results"
              variant="secondary"
              style={styles.flex}
              loading={busy}
              disabled={revealed}
              onPress={() => void run(async () => {
                await revealResults(code)
                setRevealedIndex(currentIndex)
              })}
            />
            <Button
              label={isLast ? 'Finish game' : 'Next question'}
              style={styles.flex}
              loading={busy}
              onPress={() => void run(() => nextQuestion(code))}
            />
          </View>
        ) : null}
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { gap: spacing.md, paddingVertical: spacing.md, paddingBottom: spacing.massive },
  title: { ...typography.h1, color: colors.text },
  h: { ...typography.h3, color: colors.text },
  sub: { ...typography.caption, color: colors.textSecondary },
  error: { ...typography.body, color: colors.error },
  codeBox: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  code: { ...typography.display, color: colors.text, letterSpacing: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timer: { ...typography.h2, color: colors.text },
  question: { ...typography.h2, color: colors.text },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    minHeight: 56,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.ms,
  },
  optLabel: { ...typography.h3, color: '#FFFFFF', width: 20 },
  optText: { ...typography.body, color: '#FFFFFF', flex: 1 },
  resultCard: { gap: spacing.xs },
  board: { gap: spacing.sm },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    padding: spacing.ms,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  boardRowMe: { borderColor: colors.primary },
  rank: { ...typography.h3, color: colors.textSecondary, width: 24 },
  boardName: { ...typography.body, color: colors.text, flex: 1 },
  score: { ...typography.h3, color: colors.text },
  hostRow: { flexDirection: 'row', gap: spacing.sm },
})
