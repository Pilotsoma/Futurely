import React, { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as gradesApi from '../../api/gradesApi'
import { usePortalFetch } from '../../hooks/usePortalFetch'
import { Screen, SCROLL_BOTTOM_CLEARANCE } from '../../components/ui/Screen'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorRetryBlock } from '../../components/ui/ErrorRetryBlock'
import { UnsupportedPortalBlock } from '../../components/ui/UnsupportedPortalBlock'
import { averageToLetter, detectLevel, gradePoints, type CourseLevel, type GpaType } from '../../constants/gradeScale'
import { formatGpa } from '../../features/grades/academicSummary'
import { colors, fonts, gradients, spacing, touchTarget, typography } from '../../theme/tokens'

interface SimCourse {
  name: string
  average: number
  level: CourseLevel
}

const LEVELS: CourseLevel[] = ['Regular', 'KAP', 'AP', 'Dual Credit']

/** Map grade letter to a representative average score for the chip buttons. */
const GRADE_AVERAGES: Record<string, number> = { A: 95, B: 85, C: 75, D: 65, F: 55 }
const GRADE_LETTERS = ['A', 'B', 'C', 'D', 'F'] as const

type GpaToggle = 'Unweighted' | 'Weighted'

// Client-side "what-if" math only - never persists to the server, mirrors
// web's hardcoded Katy ISD scale exactly (see constants/gradeScale.ts).
// Sourced from /integrations/grades/current, the same endpoint the Grades hub
// reads, so the simulator always lists the courses the student just saw there
// (and works for both HAC and PowerSchool).
export default function GpaSimulatorScreen(): React.JSX.Element {
  const { data, loading, unsupported, error, reload } = usePortalFetch(() => gradesApi.getCurrentGrades())
  const [overrides, setOverrides] = useState<Record<number, SimCourse>>({})
  const [gpaType, setGpaType] = useState<GpaType>('unweighted')

  const baseCourses: SimCourse[] = useMemo(() => {
    if (!data) return []
    // A course with no posted average has nothing to simulate from; inventing
    // a default would skew the "Current" GPA.
    return data.grades.flatMap((course) =>
      course.average === null
        ? []
        : [{ name: course.name, average: course.average, level: detectLevel(course.name) }],
    )
  }, [data])

  const courses = useMemo(
    () => baseCourses.map((c, i) => overrides[i] ?? c),
    [baseCourses, overrides],
  )

  function adjustAverage(index: number, delta: number): void {
    setOverrides((prev) => {
      const current = prev[index] ?? courses[index]
      const nextAverage = Math.max(0, Math.min(100, current.average + delta))
      return { ...prev, [index]: { ...current, average: nextAverage } }
    })
  }

  function setAverage(index: number, value: number): void {
    setOverrides((prev) => {
      const current = prev[index] ?? courses[index]
      return { ...prev, [index]: { ...current, average: value } }
    })
  }

  function setLevel(index: number, level: CourseLevel): void {
    setOverrides((prev) => {
      const current = prev[index] ?? courses[index]
      return { ...prev, [index]: { ...current, level } }
    })
  }

  const baseGpa = useMemo(() => {
    if (baseCourses.length === 0) return null
    const total = baseCourses.reduce((sum, c) => sum + gradePoints(c.average, c.level, gpaType), 0)
    return Math.round((total / baseCourses.length) * 1000) / 1000
  }, [baseCourses, gpaType])

  const simulatedGpa = useMemo(() => {
    if (courses.length === 0) return null
    const total = courses.reduce((sum, c) => sum + gradePoints(c.average, c.level, gpaType), 0)
    return Math.round((total / courses.length) * 1000) / 1000
  }, [courses, gpaType])

  const gpaDelta = baseGpa !== null && simulatedGpa !== null
    ? Math.round((simulatedGpa - baseGpa) * 1000) / 1000
    : null

  const toggleValue: GpaToggle = gpaType === 'weighted' ? 'Weighted' : 'Unweighted'

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

  if (courses.length === 0) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <EmptyState
            icon="sliders"
            title="No grades to simulate yet"
            message="Once your portal posts grades for this term you can try out changes here."
          />
        </ScrollView>
      </Screen>
    )
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.note}>
          Adjust hypothetical grades below to see how they&apos;d affect your GPA. This doesn&apos;t
          save or change your real grades.
        </Text>

        <Card variant="gradient" gradientColors={gradients.accent} style={styles.gpaCard}>
          <View style={styles.gpaMetricsRow}>
            <View style={styles.gpaMetric}>
              <Text style={styles.gpaCaption}>Current</Text>
              <Text style={styles.gpaValue}>{formatGpa(baseGpa)}</Text>
            </View>
            <View style={styles.gpaDivider} />
            <View style={styles.gpaMetric}>
              <Text style={styles.gpaCaption}>Projected</Text>
              <Text style={styles.gpaValue}>{formatGpa(simulatedGpa)}</Text>
            </View>
          </View>
          {gpaDelta !== null && gpaDelta !== 0 ? (
            <View style={[styles.deltaChip, { backgroundColor: gpaDelta > 0 ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)' }]}>
              <Text style={[styles.deltaText, { color: gpaDelta > 0 ? colors.success : colors.error }]}>
                {gpaDelta > 0 ? `+${gpaDelta.toFixed(3)}` : gpaDelta.toFixed(3)} {gpaType}
              </Text>
            </View>
          ) : null}

          <SegmentedControl<GpaToggle>
            segments={['Unweighted', 'Weighted']}
            value={toggleValue}
            onChange={(v) => setGpaType(v === 'Weighted' ? 'weighted' : 'unweighted')}
          />
        </Card>

        {courses.map((course, i) => {
          const baseCourse = baseCourses[i]
          const currentLetter = averageToLetter(course.average)
          const baseLetter = baseCourse ? averageToLetter(baseCourse.average) : null
          const hasChanged = baseLetter !== null && currentLetter !== baseLetter
          const deltaGp = baseCourse
            ? Math.round((gradePoints(course.average, course.level, gpaType) - gradePoints(baseCourse.average, baseCourse.level, gpaType)) * 100) / 100
            : 0
          return (
            <Card key={i} style={[styles.courseCard, { overflow: 'hidden' }]}>
              {/* Left indicator strip - teal for positive delta, red for negative */}
              {deltaGp !== 0 ? (
                <View
                  style={[
                    styles.courseIndicatorStrip,
                    {
                      backgroundColor: deltaGp > 0
                        ? 'rgba(0,229,255,0.5)'
                        : 'rgba(239,68,68,0.5)',
                    },
                  ]}
                />
              ) : null}

              <View style={styles.courseHeader}>
                <Text style={styles.courseName} numberOfLines={1}>{course.name}</Text>
                {hasChanged ? (
                  <View style={[styles.courseDeltaChip, { backgroundColor: deltaGp >= 0 ? 'rgba(16,185,129,0.20)' : 'rgba(239,68,68,0.20)' }]}>
                    <Text style={[styles.courseDeltaText, { color: deltaGp >= 0 ? colors.success : colors.error }]}>
                      {deltaGp >= 0 ? `+${deltaGp.toFixed(2)}` : deltaGp.toFixed(2)} pts
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Grade letter chips */}
              <View style={styles.gradeChips}>
                {GRADE_LETTERS.map((gl) => {
                  const isActive = currentLetter === gl
                  const chipColor = isActive ? colors.violetText : colors.textMuted
                  return (
                    <Pressable
                      key={gl}
                      onPress={() => setAverage(i, GRADE_AVERAGES[gl] ?? 70)}
                      style={({ pressed }) => [
                        styles.gradeChip,
                        isActive && styles.gradeChipActive,
                        pressed && { opacity: 0.75 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Set ${course.name} to grade ${gl}`}
                    >
                      <Text style={[styles.gradeChipText, { color: chipColor }]}>{gl}</Text>
                    </Pressable>
                  )
                })}
                {/* Fine-tune stepper */}
                <View style={styles.stepperWrap}>
                  <Button label="-" onPress={() => adjustAverage(i, -1)} variant="secondary" style={styles.stepButton} />
                  <Text style={styles.averageValue}>{course.average.toFixed(0)}%</Text>
                  <Button label="+" onPress={() => adjustAverage(i, 1)} variant="secondary" style={styles.stepButton} />
                </View>
              </View>

              <View style={styles.levelRow}>
                {LEVELS.map((level) => {
                  const isActive = course.level === level
                  return (
                    <Pressable
                      key={level}
                      onPress={() => setLevel(i, level)}
                      style={({ pressed }) => [
                        styles.levelChip,
                        isActive && styles.levelChipActive,
                        pressed && { opacity: 0.75 },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text style={[styles.levelChipText, isActive && styles.levelChipTextActive]}>
                        {level}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </Card>
          )
        })}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingTop: spacing.lg, paddingBottom: SCROLL_BOTTOM_CLEARANCE },
  note: { ...typography.bodyMd, color: colors.textSecondary },
  gpaCard: { gap: spacing.sm },
  gpaMetricsRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  gpaMetric: { flex: 1, alignItems: 'center', gap: 2 },
  gpaDivider: { width: 1, height: 48, backgroundColor: 'rgba(255,255,255,0.20)' },
  gpaValue: { ...typography.numericLg, color: '#FFFFFF' },
  gpaCaption: { ...typography.bodySm, color: 'rgba(240, 241, 255, 0.7)' },
  deltaChip: {
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  deltaText: { fontFamily: fonts.bold, fontSize: 11, fontWeight: '700' },
  // Course cards
  courseCard: { gap: spacing.sm },
  courseIndicatorStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  courseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  courseName: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  courseDeltaChip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99 },
  courseDeltaText: { fontFamily: fonts.bold, fontSize: 11, fontWeight: '700' },
  gradeChips: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  gradeChip: {
    minWidth: touchTarget,
    height: touchTarget,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gradeChipActive: {
    backgroundColor: colors.violetDim,
    borderColor: colors.violet,
  },
  gradeChipText: { fontFamily: fonts.jakartaExtraBold, fontSize: 14, fontWeight: '700' },
  stepperWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: 'auto' },
  levelRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  // A Button here would apply its padding on both its Pressable and inner view, which
  // shifts it off the card gutter and wraps the row; a plain chip keeps the 44pt target.
  levelChip: {
    minWidth: touchTarget,
    height: touchTarget,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  levelChipActive: {
    backgroundColor: colors.violetDim,
    borderColor: colors.violet,
  },
  levelChipText: { fontFamily: fonts.semiBold, fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  levelChipTextActive: { color: colors.text },
  stepButton: { width: touchTarget, height: touchTarget, paddingHorizontal: 0 },
  averageValue: {
    color: colors.text,
    fontFamily: fonts.jakartaBold,
    fontWeight: '700',
    fontSize: 16,
    minWidth: 42,
    textAlign: 'center',
  },
})
