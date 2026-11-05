import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRoute, type RouteProp } from '@react-navigation/native'
import { Screen } from '../../components/ui/Screen'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ErrorRetryBlock } from '../../components/ui/ErrorRetryBlock'
import { errorMessage } from '../../components/study/util'
import { getSet, type Question } from '../../api/setsApi'
import { emptyProgress, markCard, shuffle, summarizeProgress, type CardResult, type FlashcardProgress } from '../../lib/flashcards'
import type { StudyStackParamList } from '../../navigation/StudyNavigator'
import { colors, spacing, typography } from '../../theme/tokens'

function answerText(q: Question): string {
  const i = Number(q.correctAnswer)
  return q.options[i] ?? q.correctAnswer
}

export default function FlashcardsScreen(): React.JSX.Element {
  const { setId } = useRoute<RouteProp<StudyStackParamList, 'Flashcards'>>().params
  const [cards, setCards] = useState<Question[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [progress, setProgress] = useState<FlashcardProgress>(emptyProgress)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    getSet(setId).then(
      (set) => setCards(set.questions),
      (err: unknown) => setError(errorMessage(err, 'Could not load this set.')),
    )
  }, [setId, reloadKey])

  const summary = useMemo(() => summarizeProgress(progress, cards?.length ?? 0), [progress, cards])

  if (error) {
    return (
      <Screen>
        <ErrorRetryBlock message={error} onRetry={() => { setError(null); setReloadKey((k) => k + 1) }} />
      </Screen>
    )
  }
  if (!cards) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }
  if (cards.length === 0) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.hint}>This set has no questions to practice yet.</Text>
        </View>
      </Screen>
    )
  }

  const card = cards[index]
  const total = cards.length

  function go(next: number): void {
    setIndex(Math.min(total - 1, Math.max(0, next)))
    setFlipped(false)
  }

  function mark(result: CardResult): void {
    setProgress((p) => markCard(p, card.id, result))
    if (index < total - 1) go(index + 1)
    else setFlipped(false)
  }

  function restart(deck: Question[]): void {
    setCards(deck)
    setProgress(emptyProgress)
    setIndex(0)
    setFlipped(false)
  }

  const status = progress.known.includes(card.id) ? 'known' : progress.learning.includes(card.id) ? 'learning' : null

  return (
    <Screen>
      <View style={styles.counts}>
        <Text style={[styles.count, { color: colors.warning }]}>Still learning {summary.learning}</Text>
        <Text style={styles.position}>
          {index + 1} / {total}
        </Text>
        <Text style={[styles.count, { color: colors.success }]}>Got it {summary.known}</Text>
      </View>

      <Pressable
        onPress={() => setFlipped((f) => !f)}
        accessibilityRole="button"
        accessibilityLabel={flipped ? 'Show question' : 'Show answer'}
        style={styles.cardWrap}
      >
        <Card style={[styles.card, flipped && styles.cardBack]}>
          <Text style={styles.side}>{flipped ? 'Answer' : 'Question'}</Text>
          <Text style={styles.cardText}>{flipped ? answerText(card) : card.questionText}</Text>
          <Text style={styles.hint}>Tap to flip</Text>
          {status ? (
            <Text style={[styles.badge, { color: status === 'known' ? colors.success : colors.warning }]}>
              {status === 'known' ? 'Marked: got it' : 'Marked: still learning'}
            </Text>
          ) : null}
        </Card>
      </Pressable>

      {summary.done ? (
        <Text style={styles.done}>
          Round complete: {summary.known} got it, {summary.learning} still learning.
        </Text>
      ) : null}

      <View style={styles.row}>
        <Button label="Still learning" variant="secondary" style={styles.flex} onPress={() => mark('learning')} />
        <Button label="Got it" style={styles.flex} onPress={() => mark('known')} />
      </View>
      <View style={styles.row}>
        <Button label="Prev" variant="secondary" style={styles.flex} disabled={index === 0} onPress={() => go(index - 1)} />
        <Button label="Next" variant="secondary" style={styles.flex} disabled={index === total - 1} onPress={() => go(index + 1)} />
      </View>
      <View style={styles.row}>
        <Button label="Shuffle" variant="secondary" style={styles.flex} onPress={() => restart(shuffle(cards))} />
        <Button
          label="Review missed"
          variant="secondary"
          style={styles.flex}
          disabled={progress.learning.length === 0}
          onPress={() => restart(cards.filter((c) => progress.learning.includes(c.id)))}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  counts: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  count: { ...typography.label },
  position: { ...typography.h3, color: colors.text },
  cardWrap: { flex: 1, marginBottom: spacing.md },
  card: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  cardBack: { borderColor: colors.primary, backgroundColor: colors.surface2 },
  side: { ...typography.label, color: colors.textMuted },
  cardText: { ...typography.h2, color: colors.text, textAlign: 'center' },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  badge: { ...typography.caption },
  done: { ...typography.body, color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  flex: { flex: 1 },
})
