import React, { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Feather } from '@expo/vector-icons'
import { Screen } from '../../components/ui/Screen'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ErrorRetryBlock } from '../../components/ui/ErrorRetryBlock'
import { errorMessage } from '../../components/study/util'
import { createGame } from '../../api/gamesApi'
import { deleteQuestion, deleteSet, getSet, type QuestionSetWithQuestions } from '../../api/setsApi'
import { useAuth } from '../../context/AuthContext'
import type { StudyStackParamList } from '../../navigation/StudyNavigator'
import { colors, spacing, typography } from '../../theme/tokens'

const LABELS = ['A', 'B', 'C', 'D']

export default function SetDetailScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<StudyStackParamList, 'SetDetail'>>()
  const { setId } = useRoute<RouteProp<StudyStackParamList, 'SetDetail'>>().params
  const { user } = useAuth()

  const [set, setSet] = useState<QuestionSetWithQuestions | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      setSet(await getSet(setId))
    } catch (err) {
      setError(errorMessage(err, 'Could not load this set.'))
    }
  }, [setId])

  // Refetch whenever we return from the editor.
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  if (error && !set) {
    return (
      <Screen>
        <ErrorRetryBlock message={error} onRetry={() => void load()} />
      </Screen>
    )
  }
  if (!set) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }

  const isOwner = user?.id === set.creatorId
  const hasQuestions = set.questions.length > 0

  async function host(): Promise<void> {
    setBusy(true)
    try {
      const game = await createGame(setId)
      navigation.navigate('Game', { code: game.joinCode })
    } catch (err) {
      Alert.alert('Could not host game', errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function confirmDeleteQuestion(id: number): void {
    Alert.alert('Delete question?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteQuestion(setId, id)
            .then(load)
            .catch((err) => Alert.alert('Could not delete', errorMessage(err)))
        },
      },
    ])
  }

  function confirmDeleteSet(): void {
    Alert.alert('Delete this set?', 'The set and all its questions will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteSet(setId)
            .then(() => navigation.goBack())
            .catch((err) => Alert.alert('Could not delete', errorMessage(err)))
        },
      },
    ])
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{set.title}</Text>
        {set.description ? <Text style={styles.desc}>{set.description}</Text> : null}
        <Text style={styles.meta}>
          {[set.subject, `${set.questions.length} question${set.questions.length === 1 ? '' : 's'}`, set.visibility === 'PUBLIC' ? 'Public' : 'Private', set.creator.name ? `by ${set.creator.name}` : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>

        <View style={styles.actions}>
          <Button
            label="Practice"
            disabled={!hasQuestions}
            onPress={() => navigation.navigate('Flashcards', { setId })}
          />
          <Button label="Host a game" variant="secondary" disabled={!hasQuestions} loading={busy} onPress={() => void host()} />
          {isOwner ? (
            <Button label="Edit / add questions" variant="secondary" onPress={() => navigation.navigate('SetEdit', { setId })} />
          ) : null}
        </View>

        {set.questions.map((q, i) => (
          <Card key={q.id} style={styles.qCard}>
            <View style={styles.qHeader}>
              <Text style={styles.qIndex}>
                {i + 1}. {q.questionType === 'TRUE_FALSE' ? 'True / False' : 'Multiple choice'} · {q.timeLimit}s
              </Text>
              {isOwner ? (
                <Pressable
                  onPress={() => confirmDeleteQuestion(q.id)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete question ${i + 1}`}
                >
                  <Feather name="trash-2" size={18} color={colors.error} />
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.qText}>{q.questionText}</Text>
            {q.options.map((opt, oi) => {
              const correct = q.correctAnswer === String(oi)
              return (
                <View key={oi} style={styles.optRow}>
                  <Feather
                    name={correct ? 'check-circle' : 'circle'}
                    size={16}
                    color={correct ? colors.success : colors.textMuted}
                  />
                  <Text style={[styles.optText, correct && { color: colors.success }]}>
                    {LABELS[oi]}. {opt}
                  </Text>
                </View>
              )
            })}
          </Card>
        ))}

        {!hasQuestions ? <Text style={styles.desc}>No questions yet.</Text> : null}

        {isOwner ? <Button label="Delete set" variant="destructive" onPress={confirmDeleteSet} /> : null}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { gap: spacing.md, paddingVertical: spacing.md, paddingBottom: spacing.massive },
  title: { ...typography.h1, color: colors.text },
  desc: { ...typography.body, color: colors.textSecondary },
  meta: { ...typography.caption, color: colors.textMuted },
  actions: { gap: spacing.sm },
  qCard: { gap: spacing.sm },
  qHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qIndex: { ...typography.caption, color: colors.textMuted },
  qText: { ...typography.h3, color: colors.text },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  optText: { ...typography.body, color: colors.textSecondary, flex: 1 },
})
