import React, { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { SegmentedControl } from '../ui/SegmentedControl'
import { colors, radii, spacing, typography } from '../../theme/tokens'
import {
  applyWhatIf,
  computeAverage,
  emptyWhatIf,
  isWhatIfEmpty,
  letterFor,
  minScoreNeeded,
  TARGET_MIN,
  type CategoryWeights,
  type TargetLetter,
  type WhatIfAssignment,
  type WhatIfState,
} from '../../lib/whatIf'

interface Props {
  assignments: WhatIfAssignment[]
  weights?: CategoryWeights
}

const TARGETS: readonly TargetLetter[] = ['A', 'B', 'C']

function fmt(avg: number | null): string {
  return avg === null ? '—' : `${avg.toFixed(1)}% (${letterFor(avg)})`
}

// Component-state only: nothing here calls an API or persists.
export function WhatIfPanel({ assignments, weights }: Props): React.JSX.Element {
  const [on, setOn] = useState(false)
  const [state, setState] = useState<WhatIfState>(emptyWhatIf())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [newName, setNewName] = useState('')
  const [newPoints, setNewPoints] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [target, setTarget] = useState<TargetLetter>('A')
  const [targetId, setTargetId] = useState<string | null>(null)

  const categories = weights ? Object.keys(weights) : []
  const projected = useMemo(() => applyWhatIf(assignments, state), [assignments, state])
  const realAvg = useMemo(() => computeAverage(assignments, weights), [assignments, weights])
  const projAvg = useMemo(() => computeAverage(projected, weights), [projected, weights])

  const targetResult = useMemo(
    () => (targetId ? minScoreNeeded(projected, targetId, TARGET_MIN[target], weights) : null),
    [projected, targetId, target, weights],
  )
  const targetItem = projected.find((a) => a.id === targetId)

  function commitScore(id: string): void {
    const n = parseFloat(draft)
    setState((s) => {
      const scores = { ...s.scores }
      if (Number.isNaN(n) || n < 0) delete scores[id]
      else scores[id] = n
      const added = s.added.map((a) => (a.id === id ? { ...a, earned: Number.isNaN(n) || n < 0 ? null : n } : a))
      return { scores, added }
    })
    setEditingId(null)
  }

  function addAssignment(): void {
    const possible = parseFloat(newPoints)
    if (!newName.trim() || Number.isNaN(possible) || possible <= 0) return
    const category = categories.length > 0 ? (newCategory || categories[0]) : undefined
    const item: WhatIfAssignment = {
      id: `h${Date.now()}${state.added.length}`,
      name: newName.trim(),
      earned: null,
      possible,
      category,
    }
    setState((s) => ({ ...s, added: [...s.added, item] }))
    setNewName('')
    setNewPoints('')
  }

  function reset(): void {
    setState(emptyWhatIf())
    setEditingId(null)
    setTargetId(null)
  }

  if (!on) {
    return <Button label="What-if" variant="secondary" onPress={() => setOn(true)} style={styles.toggle} />
  }

  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <Text style={styles.title}>What-if mode</Text>
        <Button label="Off" variant="secondary" onPress={() => { reset(); setOn(false) }} style={styles.small} />
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryCol}>
          <Text style={styles.caption}>Real</Text>
          <Text style={styles.value}>{fmt(realAvg)}</Text>
        </View>
        <View style={styles.summaryCol}>
          <Text style={styles.caption}>Projected</Text>
          <Text style={[styles.value, styles.projected]}>{fmt(projAvg)}</Text>
        </View>
      </View>

      {categories.length === 0 ? (
        <Text style={styles.caption}>Estimate: category weights unknown, so all points count equally.</Text>
      ) : null}

      {assignments.length === 0 && state.added.length === 0 ? (
        <Text style={styles.caption}>No assignment details for this class yet. Add a hypothetical one below.</Text>
      ) : null}

      {projected.map((a) => {
        const hypothetical = a.id in state.scores || state.added.some((h) => h.id === a.id)
        return (
          <View key={a.id}>
            <Pressable
              style={styles.assignment}
              onPress={() => {
                setEditingId(editingId === a.id ? null : a.id)
                setDraft(a.earned === null ? '' : String(a.earned))
              }}
              accessibilityRole="button"
              accessibilityLabel={`Set hypothetical score for ${a.name}`}
            >
              <Text style={styles.assignmentName} numberOfLines={1}>{a.name}</Text>
              <Text style={[styles.assignmentScore, hypothetical && styles.projected]}>
                {a.earned === null ? '—' : a.earned} / {a.possible}
              </Text>
            </Pressable>
            {editingId === a.id ? (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Input
                    label={`Score out of ${a.possible}`}
                    value={draft}
                    onChangeText={setDraft}
                    keyboardType="decimal-pad"
                    onSubmitEditing={() => commitScore(a.id)}
                  />
                </View>
                <Button label="Set" onPress={() => commitScore(a.id)} style={styles.small} />
              </View>
            ) : null}
          </View>
        )
      })}

      <Text style={styles.sectionLabel}>Add a future assignment</Text>
      <Input label="Name" value={newName} onChangeText={setNewName} placeholder="Final exam" />
      <Input
        label="Points possible"
        value={newPoints}
        onChangeText={setNewPoints}
        keyboardType="decimal-pad"
        placeholder="100"
      />
      {categories.length > 0 ? (
        <View style={styles.chips}>
          {categories.map((c) => (
            <Button
              key={c}
              label={c}
              variant={(newCategory || categories[0]) === c ? 'primary' : 'secondary'}
              onPress={() => setNewCategory(c)}
              style={styles.small}
            />
          ))}
        </View>
      ) : null}
      <Button label="Add assignment" variant="secondary" onPress={addAssignment} />

      <Text style={styles.sectionLabel}>Target grade</Text>
      <SegmentedControl segments={TARGETS} value={target} onChange={setTarget} />
      <View style={styles.chips}>
        {projected.map((a) => (
          <Button
            key={a.id}
            label={a.name}
            variant={targetId === a.id ? 'primary' : 'secondary'}
            onPress={() => setTargetId(a.id)}
            style={styles.small}
          />
        ))}
      </View>
      {targetResult && targetItem ? (
        <Text style={styles.value}>
          {targetResult.reachable
            ? targetResult.needed === 0
              ? `Already on track for ${target}.`
              : `Need at least ${targetResult.needed} / ${targetItem.possible} on ${targetItem.name} for ${target}.`
            : `${target} is not reachable with ${targetItem.name}.`}
        </Text>
      ) : (
        <Text style={styles.caption}>Pick an assignment to see the minimum score needed.</Text>
      )}

      <Button label="Reset" variant="destructive" onPress={reset} disabled={isWhatIfEmpty(state)} />
    </View>
  )
}

const styles = StyleSheet.create({
  toggle: { alignSelf: 'flex-start', paddingHorizontal: spacing.md, height: 36 },
  panel: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  flex: { flex: 1 },
  title: { ...typography.h3, color: colors.text, flex: 1 },
  small: { paddingHorizontal: spacing.md, height: 36 },
  summary: { flexDirection: 'row', gap: spacing.md },
  summaryCol: { flex: 1, gap: spacing.xs },
  caption: { ...typography.caption, color: colors.textSecondary },
  value: { ...typography.body, color: colors.text },
  projected: { color: colors.primary },
  sectionLabel: { ...typography.label, color: colors.textSecondary, marginTop: spacing.sm },
  assignment: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.surface2,
  },
  assignmentName: { ...typography.body, color: colors.text, flex: 1 },
  assignmentScore: { ...typography.body, color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
})
