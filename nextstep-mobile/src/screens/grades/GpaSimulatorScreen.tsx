import React, { useCallback, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import * as gradesApi from '../../api/gradesApi'
import * as collegesApi from '../../api/collegesApi'
import { usePortalFetch } from '../../hooks/usePortalFetch'
import { Screen } from '../../components/ui/Screen'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { GradeBadge } from '../../components/ui/GradeBadge'
import { LoadingSkeleton } from '../../components/ui/Skeleton'
import { ErrorRetryBlock } from '../../components/ui/ErrorRetryBlock'
import { UnsupportedPortalBlock } from '../../components/ui/UnsupportedPortalBlock'
import {
  averageToLetter,
  detectLevel,
  gradePoints,
  type CourseLevel,
  type GpaType,
} from '../../constants/gradeScale'
import type { GpaSummary } from '../../types/grades'
import type { CollegeListItem } from '../../types/colleges'
import {
  colors,
  fonts,
  radii,
  spacing,
  typography,
  getGradeTierColor,
} from '../../theme/tokens'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SimCourse {
  name: string
  average: number
  level: CourseLevel
}

type CollegeTier = 'reach' | 'target' | 'safety'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEVELS: CourseLevel[] = ['Regular', 'KAP', 'AP', 'Dual Credit']

// Labels for the Weighted / Unweighted SegmentedControl (displayed as-is)
const GPA_SEGMENT_LABELS = ['Weighted', 'Unweighted'] as const
type GpaSegmentLabel = (typeof GPA_SEGMENT_LABELS)[number]

// Max GPA value per type — used to scale the progress comparison bars
const GPA_MAX: Record<GpaType, number> = { weighted: 5.0, unweighted: 4.0 }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gpaTypeFromLabel(label: GpaSegmentLabel): GpaType {
  return label === 'Weighted' ? 'weighted' : 'unweighted'
}

function labelFromGpaType(t: GpaType): GpaSegmentLabel {
  return t === 'weighted' ? 'Weighted' : 'Unweighted'
}

function classifyCollegeTier(label: string | null): CollegeTier | null {
  const lower = (label ?? '').toLowerCase()
  if (lower.includes('safety')) return 'safety'
  if (lower.includes('target') || lower.includes('match')) return 'target'
  if (lower.includes('reach')) return 'reach'
  return null
}

function formatDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta.toFixed(2)}`
}

// ---------------------------------------------------------------------------
// Component
//
// Client-side "what-if" math only — never persists to the server, mirrors
// web's hardcoded Katy ISD scale exactly (see constants/gradeScale.ts).
// Sourced from /integrations/grades/classwork, which is HAC-only.
// ---------------------------------------------------------------------------

export default function GpaSimulatorScreen(): React.JSX.Element {
  const { data, loading, unsupported, error, reload } = usePortalFetch(() => gradesApi.getClasswork())
  const [overrides, setOverrides] = useState<Record<number, SimCourse>>({})
  const [gpaType, setGpaType] = useState<GpaType>('weighted')

  // Real GPA — for the delta chip comparing simulated vs. actual
  const [realGpa, setRealGpa] = useState<GpaSummary | null>(null)
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      gradesApi
        .getGpa()
        .then((result) => { if (!cancelled) setRealGpa(result) })
        .catch(() => { /* non-critical; delta chip is omitted when unavailable */ })
      return () => { cancelled = true }
    }, []),
  )

  // Saved colleges — for the tier-fit summary row
  const [savedColleges, setSavedColleges] = useState<CollegeListItem[]>([])
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      collegesApi
        .listSavedColleges()
        .then((result) => { if (!cancelled) setSavedColleges(result) })
        .catch(() => { /* non-critical; tier section is omitted when unavailable */ })
      return () => { cancelled = true }
    }, []),
  )

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const baseCourses: SimCourse[] = useMemo(() => {
    if (!data) return []
    return data.classes
      .filter((c) => c.name)
      .map((c) => {
        const name = c.name as string
        const avg = c.average ? parseFloat(c.average) : NaN
        return { name, average: Number.isNaN(avg) ? 70 : avg, level: detectLevel(name) }
      })
  }, [data])

  const courses = useMemo(
    () => baseCourses.map((c, i) => overrides[i] ?? c),
    [baseCourses, overrides],
  )

  const simulatedGpa = useMemo(() => {
    if (courses.length === 0) return null
    const total = courses.reduce((sum, c) => sum + gradePoints(c.average, c.level, gpaType), 0)
    return Math.round((total / courses.length) * 1000) / 1000
  }, [courses, gpaType])

  const realGpaValue: number | null = useMemo(() => {
    if (!realGpa) return null
    const val = gpaType === 'weighted' ? realGpa.weightedGpa : realGpa.unweightedGpa
    return val !== null && Number.isFinite(val) ? val : null
  }, [realGpa, gpaType])

  const delta: number | null = simulatedGpa !== null && realGpaValue !== null
    ? simulatedGpa - realGpaValue
    : null

  const tierCounts = useMemo<Record<CollegeTier, number>>(() => {
    const counts: Record<CollegeTier, number> = { reach: 0, target: 0, safety: 0 }
    for (const c of savedColleges) {
      const tier = classifyCollegeTier(c.label)
      if (tier) counts[tier]++
    }
    return counts
  }, [savedColleges])

  const hasTierData = tierCounts.reach > 0 || tierCounts.target > 0 || tierCounts.safety > 0

  const gpaMax = GPA_MAX[gpaType]
  const simulatedBarValue = simulatedGpa !== null ? Math.min(1, simulatedGpa / gpaMax) : 0
  const realBarValue = realGpaValue !== null ? Math.min(1, realGpaValue / gpaMax) : 0

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  function adjustAverage(index: number, delta: number): void {
    setOverrides((prev) => {
      const current = prev[index] ?? courses[index]
      const nextAverage = Math.max(0, Math.min(100, current.average + delta))
      return { ...prev, [index]: { ...current, average: nextAverage } }
    })
  }

  function setLevel(index: number, level: CourseLevel): void {
    setOverrides((prev) => {
      const current = prev[index] ?? courses[index]
      return { ...prev, [index]: { ...current, level } }
    })
  }

  // ---------------------------------------------------------------------------
  // Render guards
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <LoadingSkeleton rows={4} />
      </Screen>
    )
  }
  if (unsupported) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <UnsupportedPortalBlock feature="What-if GPA calculator" />
      </Screen>
    )
  }
  if (error) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <ErrorRetryBlock message={error} onRetry={reload} />
      </Screen>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Disclaimer note */}
        <Text style={styles.note}>
          Adjust hypothetical grades to see how they&apos;d affect your GPA.
          Nothing here saves or changes your real grades.
        </Text>

        {/* Hero GPA card */}
        <Card variant="glass" style={styles.heroCard}>
          {/* GPA numeral + delta chip */}
          <View style={styles.gpaRow}>
            <Text style={styles.gpaValue}>
              {simulatedGpa !== null ? simulatedGpa.toFixed(2) : '—'}
            </Text>
            {delta !== null ? (
              <View
                style={[
                  styles.deltaChip,
                  {
                    backgroundColor: delta >= 0 ? colors.tierGreenBg : colors.tierRedBg,
                    borderColor: delta >= 0 ? colors.tierGreen : colors.tierRed,
                  },
                ]}
                accessibilityLabel={`${delta >= 0 ? 'Increase' : 'Decrease'} of ${Math.abs(delta).toFixed(2)} GPA points`}
              >
                <Text
                  style={[
                    styles.deltaText,
                    { color: delta >= 0 ? colors.tierGreen : colors.tierRed },
                  ]}
                >
                  {formatDelta(delta)}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.gpaCaption}>Simulated {gpaType} GPA</Text>

          {/* Weighted / Unweighted toggle */}
          <SegmentedControl<GpaSegmentLabel>
            segments={GPA_SEGMENT_LABELS}
            value={labelFromGpaType(gpaType)}
            onChange={(label) => setGpaType(gpaTypeFromLabel(label))}
          />

          {/* Current vs. projected comparison bars */}
          {(realGpaValue !== null || simulatedGpa !== null) ? (
            <View style={styles.barsSection}>
              <View style={styles.barRow}>
                <Text style={styles.barLabel}>Current</Text>
                <View style={styles.barTrack}>
                  <ProgressBar
                    value={realBarValue}
                    color={colors.textDim}
                    height={6}
                  />
                </View>
                <Text style={styles.barValue}>
                  {realGpaValue !== null ? realGpaValue.toFixed(2) : '—'}
                </Text>
              </View>
              <View style={styles.barRow}>
                <Text style={styles.barLabel}>Projected</Text>
                <View style={styles.barTrack}>
                  <ProgressBar
                    value={simulatedBarValue}
                    color={colors.accent2}
                    height={6}
                  />
                </View>
                <Text style={[styles.barValue, { color: colors.accent2 }]}>
                  {simulatedGpa !== null ? simulatedGpa.toFixed(2) : '—'}
                </Text>
              </View>
            </View>
          ) : null}
        </Card>

        {/* School tier fit — only shown when the student has saved colleges with labels */}
        {hasTierData ? (
          <Card style={styles.tierCard}>
            <Text style={styles.tierLabel}>SCHOOL TIER FIT</Text>
            <View style={styles.tierChipsRow}>
              {(
                [
                  { tier: 'reach' as CollegeTier, count: tierCounts.reach },
                  { tier: 'target' as CollegeTier, count: tierCounts.target },
                  { tier: 'safety' as CollegeTier, count: tierCounts.safety },
                ] as const
              ).map(({ tier, count }) => {
                const isActive = count > 0
                return (
                  <View
                    key={tier}
                    style={[styles.tierChip, !isActive && styles.tierChipInactive]}
                    accessibilityLabel={`${count} ${tier} school${count !== 1 ? 's' : ''}`}
                  >
                    <GradeBadge tier={tier} size="sm" />
                    <View style={styles.tierChipText}>
                      <Text style={[styles.tierChipName, !isActive && styles.tierChipNameInactive]}>
                        {tier.charAt(0).toUpperCase() + tier.slice(1)}
                      </Text>
                      <Text style={[styles.tierChipCount, !isActive && styles.tierChipNameInactive]}>
                        {count}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          </Card>
        ) : null}

        {/* Course list */}
        {courses.length === 0 ? (
          <Text style={styles.empty}>No courses found to simulate.</Text>
        ) : (
          courses.map((course, i) => {
            const letterGrade = averageToLetter(course.average)
            const gradeColors = getGradeTierColor(letterGrade)
            return (
              <Card key={i} style={styles.courseCard}>
                {/* Course name + current letter grade badge */}
                <View style={styles.courseHeaderRow}>
                  <Text style={styles.courseName} numberOfLines={2}>{course.name}</Text>
                  <GradeBadge letter={letterGrade} size="sm" />
                </View>

                {/* Level selector */}
                <View style={styles.levelRow}>
                  {LEVELS.map((level) => (
                    <Button
                      key={level}
                      label={level}
                      variant={course.level === level ? 'primary' : 'secondary'}
                      onPress={() => setLevel(i, level)}
                      style={styles.levelButton}
                    />
                  ))}
                </View>

                {/* Average stepper */}
                <View style={styles.averageRow}>
                  <Button
                    label="−1"
                    onPress={() => adjustAverage(i, -1)}
                    variant="secondary"
                    style={styles.stepButton}
                  />
                  <View style={styles.averageDisplay}>
                    <Text style={styles.averageValue}>{course.average.toFixed(0)}</Text>
                    <Text style={[styles.averageLetter, { color: gradeColors.color }]}>
                      {letterGrade}
                    </Text>
                  </View>
                  <Button
                    label="+1"
                    onPress={() => adjustAverage(i, 1)}
                    variant="secondary"
                    style={styles.stepButton}
                  />
                </View>
              </Card>
            )
          })
        )}
      </ScrollView>
    </Screen>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  note: {
    ...typography.caption,
    color: colors.textDim,
    lineHeight: 18,
  },

  // Hero GPA card
  heroCard: {
    gap: spacing.ms,
  },
  gpaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gpaValue: {
    ...typography.display,
    color: colors.text,
    fontSize: 42,
    lineHeight: 48,
    letterSpacing: -1.5,
  },
  deltaChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  deltaText: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 14,
    fontWeight: '600',
  },
  gpaCaption: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: -4,
  },

  // Comparison bars
  barsSection: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barLabel: {
    ...typography.caption,
    color: colors.textDim,
    width: 58,
  },
  barTrack: {
    flex: 1,
  },
  barValue: {
    ...typography.caption,
    fontFamily: fonts.bodyMedium,
    color: colors.textDim,
    width: 32,
    textAlign: 'right',
  },

  // Tier fit section
  tierCard: {
    gap: spacing.sm,
  },
  tierLabel: {
    ...typography.label,
    color: colors.textFaint,
  },
  tierChipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tierChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.input,
    backgroundColor: colors.cardFallback,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tierChipInactive: {
    opacity: 0.4,
  },
  tierChipText: {
    flex: 1,
  },
  tierChipName: {
    ...typography.caption,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
    fontSize: 11,
  },
  tierChipCount: {
    ...typography.caption,
    color: colors.textDim,
    fontSize: 10,
  },
  tierChipNameInactive: {
    color: colors.textFaint,
  },

  // Course cards
  courseCard: {
    gap: spacing.sm,
  },
  courseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  courseName: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  levelRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  levelButton: {
    paddingHorizontal: spacing.sm,
    height: 36,
  },
  averageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  stepButton: {
    width: 56,
  },
  averageDisplay: {
    alignItems: 'center',
    minWidth: 80,
  },
  averageValue: {
    ...typography.h2,
    color: colors.text,
  },
  averageLetter: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },

  empty: {
    ...typography.body,
    color: colors.textDim,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
})
