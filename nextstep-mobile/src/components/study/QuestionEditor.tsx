import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'
import { colors, radii, spacing, typography } from '../../theme/tokens'
import { changeType, type QuestionDraft } from './questionDraft'

const LABELS = ['A', 'B', 'C', 'D']

interface Props {
  draft: QuestionDraft
  index: number
  onChange: (next: QuestionDraft) => void
  onDelete: () => void
}

export function QuestionEditor({ draft, index, onChange, onDelete }: Props): React.JSX.Element {
  const isTF = draft.questionType === 'TRUE_FALSE'
  const options = isTF ? ['True', 'False'] : draft.options

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.heading}>Question {index + 1}</Text>
        <Pressable
          onPress={onDelete}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Delete question ${index + 1}`}
        >
          <Feather name="trash-2" size={18} color={colors.error} />
        </Pressable>
      </View>

      <View style={styles.typeRow}>
        {(['MULTIPLE_CHOICE', 'TRUE_FALSE'] as const).map((t) => {
          const active = draft.questionType === t
          return (
            <Pressable
              key={t}
              onPress={() => onChange(changeType(draft, t))}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.typeChip, active && styles.typeChipActive]}
            >
              <Text style={[styles.typeText, active && styles.typeTextActive]}>
                {t === 'TRUE_FALSE' ? 'True / False' : 'Multiple choice'}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <Input
        label="Question"
        value={draft.questionText}
        onChangeText={(questionText) => onChange({ ...draft, questionText })}
        placeholder="What is the powerhouse of the cell?"
        multiline
        maxLength={500}
      />

      <Text style={styles.sub}>Tap the circle to mark the correct answer</Text>
      {options.map((opt, i) => {
        const correct = draft.correctAnswer === String(i)
        return (
          <View key={i} style={styles.optionRow}>
            <Pressable
              onPress={() => onChange({ ...draft, correctAnswer: String(i) })}
              hitSlop={8}
              accessibilityRole="radio"
              accessibilityState={{ selected: correct }}
              accessibilityLabel={`Mark option ${LABELS[i]} correct`}
              style={[styles.radio, correct && styles.radioOn]}
            >
              {correct ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
            </Pressable>
            {isTF ? (
              <Text style={styles.tfText}>{opt}</Text>
            ) : (
              <View style={styles.optionInput}>
                <Input
                  value={opt}
                  placeholder={`Option ${LABELS[i]}`}
                  maxLength={200}
                  onChangeText={(text) => {
                    const next = [...draft.options]
                    next[i] = text
                    onChange({ ...draft, options: next })
                  }}
                />
              </View>
            )}
          </View>
        )
      })}

      <Input
        label="Time limit (seconds)"
        value={draft.timeLimit}
        keyboardType="number-pad"
        maxLength={3}
        onChangeText={(timeLimit) => onChange({ ...draft, timeLimit: timeLimit.replace(/[^0-9]/g, '') })}
      />
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.ms },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { ...typography.h3, color: colors.text },
  typeRow: { flexDirection: 'row', gap: spacing.sm },
  typeChip: {
    paddingHorizontal: spacing.ms,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  typeText: { ...typography.caption, color: colors.textSecondary },
  typeTextActive: { color: colors.text },
  sub: { ...typography.caption, color: colors.textMuted },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  optionInput: { flex: 1 },
  tfText: { ...typography.body, color: colors.text },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: colors.success, borderColor: colors.success },
})
