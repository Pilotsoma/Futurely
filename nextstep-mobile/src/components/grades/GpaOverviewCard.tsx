import React, { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'

import type { CurrentGradeCourse, GpaSummary } from '../../types/grades'
import { getGpaDisplayValues, formatGpa } from '../../features/grades/academicSummary'
import { colors, fonts } from '../../theme/tokens'

interface GpaOverviewCardProps {
  summary: GpaSummary | null
  courses: CurrentGradeCourse[]
  loading?: boolean
  error?: string | null
  syncing?: boolean
  hidden?: boolean
  onPress?: () => void
  onSync?: () => void
  testID?: string
}

export function GpaOverviewCard({
  summary,
  courses,
  loading = false,
  error = null,
  syncing = false,
  hidden = false,
  onPress,
  onSync,
  testID = 'gpa-overview-card',
}: GpaOverviewCardProps): React.JSX.Element {
  const [focused, setFocused] = useState(false)
  const values = getGpaDisplayValues(summary, courses)
  const hasGpa = values.unweighted !== null || values.weighted !== null

  const stateLabel = loading
    ? 'Loading GPA'
    : error
      ? error
      : hasGpa
        ? hidden
          ? 'GPA hidden'
          : `Unweighted GPA ${formatGpa(values.unweighted)}, weighted GPA ${formatGpa(values.weighted)}`
        : 'No GPA data available'

  const courseLine = [
    `${values.courseCount} ${values.courseCount === 1 ? 'course' : 'courses'}`,
    values.averageGrade === null ? null : `${values.averageGrade.toFixed(1)}% average`,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <View style={[styles.card, focused && styles.cardFocused]}>
      <Pressable
        testID={testID}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityHint={onPress ? 'Opens the what-if GPA simulator' : undefined}
        accessibilityValue={{ text: stateLabel }}
        disabled={!onPress}
        onPress={onPress}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => [styles.body, pressed && onPress && styles.pressed]}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>GPA</Text>
          {onPress ? (
            <View style={styles.hint}>
              <Text style={styles.hintText}>What-if</Text>
              <Feather name="chevron-right" size={14} color="#A88BFF" />
            </View>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.stateRow} testID={`${testID}-loading`}>
            <ActivityIndicator size="small" color={colors.text} />
            <Text style={styles.stateText}>Loading GPA…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateRow} testID={`${testID}-error`}>
            <Feather name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : !hasGpa ? (
          <View style={styles.stateRow} testID={`${testID}-empty`}>
            <Text style={styles.stateText}>No GPA yet. Re-sync after your school posts grades.</Text>
          </View>
        ) : (
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.number} testID={`${testID}-unweighted`}>
                {formatGpa(values.unweighted, hidden)}
              </Text>
              <Text style={styles.metricLabel}>Unweighted</Text>
            </View>
            <View style={styles.metric}>
              <Text style={[styles.number, styles.numberSecondary]} testID={`${testID}-weighted`}>
                {formatGpa(values.weighted, hidden)}
              </Text>
              <Text style={styles.metricLabel}>Weighted</Text>
            </View>
          </View>
        )}

        <Text style={styles.courseLine}>{courseLine}</Text>
      </Pressable>

      <View style={styles.footer}>
        <View style={styles.source}>
          <View style={styles.sourceDot} />
          <Text style={styles.sourceText} numberOfLines={1}>
            Synced from {summary?.systemType ?? 'your school portal'}
          </Text>
        </View>

        {onSync ? (
          <Pressable
            testID={`${testID}-sync`}
            disabled={syncing}
            onPress={onSync}
            hitSlop={8}
            style={({ pressed }) => [styles.sync, pressed && !syncing && styles.pressed, syncing && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel="Re-sync grades"
            accessibilityState={{ disabled: syncing, busy: syncing }}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#C5AEFF" />
            ) : (
              <Feather name="refresh-cw" size={13} color="#C5AEFF" />
            )}
            <Text style={styles.syncText}>{syncing ? 'Syncing' : 'Re-sync'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    backgroundColor: '#10121E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  cardFocused: { borderColor: '#A990FF' },
  body: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, gap: 10, minHeight: 168 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.textSecondary, fontFamily: fonts.semiBold, fontSize: 14, fontWeight: '600' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  hintText: { color: '#A88BFF', fontFamily: fonts.medium, fontSize: 13, fontWeight: '500' },
  metrics: { flexDirection: 'row', gap: 28, alignItems: 'flex-end' },
  metric: { gap: 2 },
  number: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  numberSecondary: { fontSize: 30, lineHeight: 36, color: '#C9CBE0', letterSpacing: -0.8 },
  metricLabel: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 13 },
  stateRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stateText: { flexShrink: 1, color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  courseLine: { color: '#7D8099', fontFamily: fonts.regular, fontSize: 13 },
  footer: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  source: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sourceDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  sourceText: { color: '#7D8099', fontFamily: fonts.regular, fontSize: 12 },
  sync: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(127,34,254,0.16)',
  },
  syncText: { color: '#C5AEFF', fontFamily: fonts.semiBold, fontSize: 12, fontWeight: '600' },
})
