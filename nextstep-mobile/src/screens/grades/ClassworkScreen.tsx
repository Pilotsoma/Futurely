import React, { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as gradesApi from '../../api/gradesApi'
import { usePortalFetch } from '../../hooks/usePortalFetch'
import { Screen, SCROLL_BOTTOM_CLEARANCE } from '../../components/ui/Screen'
import { PortalDataState } from '../../components/grades/PortalDataState'
import { GradeChip, Pill, PortalCard, PortalFallback, PortalRow } from '../../components/grades/portal'
import { isEmptyPortalData } from '../../components/ui/RawDataView'
import {
  parseClasswork,
  type ClassworkAssignment,
  type ClassworkClassModel,
  type ClassworkModel,
} from '../../features/grades/portal/classwork'
import { colors, spacing, touchTarget, typography } from '../../theme/tokens'

const VISIBLE_ASSIGNMENTS = 5

function AssignmentRow({ assignment, isLast }: { assignment: ClassworkAssignment; isLast: boolean }): React.JSX.Element {
  const subtitle = [assignment.category, assignment.dueText !== null ? `Due ${assignment.dueText}` : null]
    .filter((part): part is string => part !== null)
    .join(' · ')
  return (
    <PortalRow
      title={assignment.name}
      subtitle={subtitle === '' ? undefined : subtitle}
      trailing={
        assignment.scoreText === null ? (
          <Pill label="Not graded" />
        ) : (
          <Pill label={assignment.scoreText} tone={assignment.tone} />
        )
      }
      isLast={isLast}
    />
  )
}

function ClassHeader({ cls }: { cls: ClassworkClassModel }): React.JSX.Element {
  const details = [cls.teacher, cls.period !== null ? `Period ${cls.period}` : null]
    .filter((part): part is string => part !== null)
    .join(' · ')
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Text style={styles.className} numberOfLines={2} accessibilityRole="header">
          {cls.name}
        </Text>
        {cls.grade.percent !== null ? <Text style={styles.percent}>{`${cls.grade.percent}%`}</Text> : null}
        <GradeChip grade={cls.grade} />
      </View>
      {details !== '' ? <Text style={styles.meta}>{details}</Text> : null}
      {cls.weightsText !== null ? <Text style={styles.meta}>{cls.weightsText}</Text> : null}
    </View>
  )
}

function ClassCard({ cls, index }: { cls: ClassworkClassModel; index: number }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const total = cls.assignments.length
  const canToggle = total > VISIBLE_ASSIGNMENTS
  const shown = expanded ? cls.assignments : cls.assignments.slice(0, VISIBLE_ASSIGNMENTS)
  return (
    <PortalCard testID={`classwork-class-${index}`}>
      <ClassHeader cls={cls} />
      {total === 0 ? (
        <Text style={styles.none}>No assignments posted yet.</Text>
      ) : (
        <View style={styles.list}>
          {shown.map((assignment, position) => (
            <AssignmentRow
              key={`${assignment.name}-${position}`}
              assignment={assignment}
              isLast={position === shown.length - 1 && !canToggle}
            />
          ))}
          {canToggle ? (
            <Pressable
              onPress={() => setExpanded((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
            >
              <Text style={styles.toggleText}>{expanded ? 'Show fewer' : `Show all ${total} assignments`}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </PortalCard>
  )
}

function ClassworkView({ model }: { model: ClassworkModel }): React.JSX.Element {
  return (
    <>
      {model.classes.map((cls, index) => (
        <ClassCard key={`${cls.name}-${index}`} cls={cls} index={index} />
      ))}
    </>
  )
}

// Shows the current grading period only - the backend's `availablePeriods`/
// `currentPeriod` fields are typed `unknown` (upstream-scraped shape), so a
// period switcher isn't built here rather than guessing an unverified format.
export default function ClassworkScreen(): React.JSX.Element {
  const { data, loading, unsupported, error, reload } = usePortalFetch(() => gradesApi.getClasswork())
  const model = useMemo(() => parseClasswork(data), [data])

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PortalDataState
          loading={loading}
          unsupported={unsupported}
          error={error}
          onRetry={reload}
          feature="Classwork"
          isEmpty={isEmptyPortalData(data) || (model !== null && model.classes.length === 0)}
          emptyIcon="bar-chart-2"
          emptyTitle="No classwork yet"
          emptyMessage="Your teachers haven't posted assignments for this grading period."
        >
          {model ? <ClassworkView model={model} /> : <PortalFallback data={data} />}
        </PortalDataState>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingTop: spacing.lg, paddingBottom: SCROLL_BOTTOM_CLEARANCE },
  header: { gap: 2, paddingBottom: spacing.xs },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  className: { ...typography.h3, color: colors.text, flex: 1, minWidth: 0 },
  percent: { ...typography.numeric, fontSize: 17, lineHeight: 22, color: colors.text },
  meta: { ...typography.bodySm, color: colors.textSecondary },
  list: { marginTop: spacing.xs },
  none: { ...typography.bodyMd, color: colors.textSecondary, paddingVertical: spacing.sm },
  toggle: { minHeight: touchTarget, alignItems: 'center', justifyContent: 'center' },
  toggleText: { ...typography.sectionLabel, color: colors.accentLight },
  pressed: { opacity: 0.75 },
})
