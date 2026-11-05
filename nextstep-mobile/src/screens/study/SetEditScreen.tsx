import React, { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Screen } from '../../components/ui/Screen'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { ErrorRetryBlock } from '../../components/ui/ErrorRetryBlock'
import { QuestionEditor } from '../../components/study/QuestionEditor'
import {
  blankDraft,
  draftFromQuestion,
  draftToInput,
  validateDraft,
  type QuestionDraft,
} from '../../components/study/questionDraft'
import { errorMessage } from '../../components/study/util'
import { addQuestion, createSet, deleteQuestion, getSet, updateQuestion, updateSet } from '../../api/setsApi'
import type { StudyStackParamList } from '../../navigation/StudyNavigator'
import { colors, radii, spacing, typography } from '../../theme/tokens'

const MAX_QUESTIONS = 50

export default function SetEditScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<StudyStackParamList, 'SetEdit'>>()
  const route = useRoute<RouteProp<StudyStackParamList, 'SetEdit'>>()
  const setId = route.params?.setId

  const [loading, setLoading] = useState(setId !== undefined)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('')
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PRIVATE')
  const [drafts, setDrafts] = useState<QuestionDraft[]>(() => (setId === undefined ? [blankDraft()] : []))
  const [originalIds, setOriginalIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (setId === undefined) return
    getSet(setId)
      .then(
        (set) => {
          setTitle(set.title)
          setDescription(set.description ?? '')
          setSubject(set.subject ?? '')
          setVisibility(set.visibility)
          setDrafts(set.questions.map(draftFromQuestion))
          setOriginalIds(set.questions.map((q) => q.id))
        },
        (err: unknown) => setLoadError(errorMessage(err, 'Could not load this set.')),
      )
      .finally(() => setLoading(false))
  }, [setId, reloadKey])

  async function save(): Promise<void> {
    if (!title.trim()) {
      setSaveError('Give your set a title.')
      return
    }
    for (const d of drafts) {
      const problem = validateDraft(d)
      if (problem) {
        setSaveError(problem)
        return
      }
    }
    setSaving(true)
    setSaveError(null)
    const meta = {
      title: title.trim(),
      description: description.trim() || null,
      subject: subject.trim() || null,
      visibility,
    }
    try {
      if (setId === undefined) {
        const created = await createSet({ ...meta, questions: drafts.map(draftToInput) })
        navigation.replace('SetDetail', { setId: created.id })
        return
      }
      await updateSet(setId, meta)
      const keptIds = new Set(drafts.filter((d) => d.id !== undefined).map((d) => d.id))
      for (const id of originalIds) {
        if (!keptIds.has(id)) await deleteQuestion(setId, id)
      }
      for (const d of drafts) {
        if (d.id !== undefined) await updateQuestion(setId, d.id, draftToInput(d))
        else await addQuestion(setId, draftToInput(d))
      }
      navigation.goBack()
    } catch (err) {
      setSaveError(errorMessage(err, 'Could not save. Please try again.'))
      // A partial save may have changed server state, so re-sync ids before a retry.
      if (setId !== undefined) { setLoading(true); setReloadKey((k) => k + 1) }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }
  if (loadError) {
    return (
      <Screen>
        <ErrorRetryBlock message={loadError} onRetry={() => { setLoadError(null); setLoading(true); setReloadKey((k) => k + 1) }} />
      </Screen>
    )
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Input label="Title" value={title} onChangeText={setTitle} placeholder="AP Biology: Cells" maxLength={120} />
          <Input
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={400}
          />
          <Input label="Subject (optional)" value={subject} onChangeText={setSubject} maxLength={80} />

          <View style={styles.visRow}>
            {(['PRIVATE', 'PUBLIC'] as const).map((v) => {
              const active = visibility === v
              return (
                <Pressable
                  key={v}
                  onPress={() => setVisibility(v)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.visChip, active && styles.visChipActive]}
                >
                  <Text style={[styles.visText, active && styles.visTextActive]}>
                    {v === 'PRIVATE' ? 'Private' : 'Public'}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <Text style={styles.section}>Questions ({drafts.length}/{MAX_QUESTIONS})</Text>
          {drafts.map((d, i) => (
            <QuestionEditor
              key={d.key}
              draft={d}
              index={i}
              onChange={(next) => setDrafts((prev) => prev.map((x) => (x.key === d.key ? next : x)))}
              onDelete={() => setDrafts((prev) => prev.filter((x) => x.key !== d.key))}
            />
          ))}
          <Button
            label="Add question"
            variant="secondary"
            disabled={drafts.length >= MAX_QUESTIONS}
            onPress={() => setDrafts((prev) => [...prev, blankDraft()])}
          />

          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
          <Button label={setId === undefined ? 'Create set' : 'Save changes'} onPress={() => void save()} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { gap: spacing.md, paddingVertical: spacing.md, paddingBottom: spacing.massive },
  section: { ...typography.h3, color: colors.text, marginTop: spacing.sm },
  visRow: { flexDirection: 'row', gap: spacing.sm },
  visChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  visChipActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  visText: { ...typography.caption, color: colors.textSecondary },
  visTextActive: { color: colors.text },
  error: { ...typography.body, color: colors.error },
})
