import React, { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as gradesApi from '../../api/gradesApi'
import { usePortalFetch } from '../../hooks/usePortalFetch'
import { Screen, FLOATING_TAB_CLEARANCE } from '../../components/ui/Screen'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'
import { ErrorRetryBlock } from '../../components/ui/ErrorRetryBlock'
import { UnsupportedPortalBlock } from '../../components/ui/UnsupportedPortalBlock'
import { averageToLetter, detectLevel, gradePoints, type CourseLevel, type GpaType } from '../../constants/gradeScale'
import { colors, fonts, gradients, spacing, typography } from '../../theme/tokens'

interface SimCourse {
  name: string
  average: number
  level: CourseLevel
}

const LEVELS: CourseLevel[] = ['Regular', 'KAP', 'AP', 'Dual Credit']

/** Map grade letter to a representative average score for the chip buttons. */
const GRADE_AVERAGES: Record<string, number> = { A: 95, B: 85, C: 75, D: 65, F: 55 }
const GRADE_LETTERS = ['A', 'B', 'C', 'D', 'F'] as const

// Client-side "what-if" math only — never persists to the server, mirrors
// web's hardcoded Katy ISD scale exactly (see constants/gradeScale.ts).
// Sourced from /integrations/grades/classwork, which is HAC-only.
export default function GpaSimulatorScreen(): React.JSX.Element {
  const { data, loading, unsupported, error, reload } = usePortalFetch(() => gradesApi.getClasswork())
  const [overrides, setOverrides] = useState<Record<number, SimCourse>>({})
  const [gpaType, setGpaType] = useState<GpaType>('weighted')

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
              <Text style={styles.gpaValue}>{baseGpa !== null ? baseGpa.toFixed(2) : '—'}</Text>
            </View>
            <View style={styles.gpaDivider} />
            <View style={styles.gpaMetric}>
              <Text style={styles.gpaCaption}>Projected</Text>
              <Text style={styles.gpaValue}>{simulatedGpa !== null ? simulatedGpa.toFixed(2) : '—'}</Text>
            </View>
          </View>
          {gpaDelta !== null && gpaDelta !== 0 ? (
            <View style={[styles.deltaChip, { backgroundColor: gpaDelta > 0 ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)' }]}>
              <Text style={[styles.deltaText, { color: gpaDelta > 0 ? colors.success : colors.error }]}>
                {gpaDelta > 0 ? `+${gpaDelta.toFixed(3)}` : gpaDelta.toFixed(3)} {gpaType}
              </Text>
            </View>
          ) : null}
          <View style={styles.toggleRow}>
            <Button
              label="Weighted"
              variant={gpaType === 'weighted' ? 'primary' : 'secondary'}
              onPress={() => setGpaType('weighted')}
              style={styles.toggleButton}
            />
            <Button
              label="Unweighted"
              variant={gpaType === 'unweighted' ? 'primary' : 'secondary'}
              onPress={() => setGpaType('unweighted')}
              style={styles.toggleButton}
            />
          </View>
        </Card>

        {courses.length === 0 ? (
          <Text style={styles.empty}>No courses found to simulate.</Text>
        ) : (
          courses.map((course, i) => {
            const baseCourse = baseCourses[i]
            const currentLetter = averageToLetter(course.average)
            const baseLetter = baseCourse ? averageToLetter(baseCourse.average) : null
            const hasChanged = baseLetter !== null && currentLetter !== baseLetter
            const deltaGp = baseCourse
              ? Math.round((gradePoints(course.average, course.level, gpaType) - gradePoints(baseCourse.average, baseCourse.level, gpaType)) * 100) / 100
              : 0
            return (
              <Card key={i} style={styles.courseCard}>
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
                    const chipColor = isActive ? colors.primary : colors.textMuted
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
              </Card>
            )
          })
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingTop: spacing.lg, paddingBottom: FLOATING_TAB_CLEARANCE },
  note: { ...typography.caption, color: colors.textSecondary },
  gpaCard: { gap: spacing.sm },
  gpaMetricsRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  gpaMetric: { flex: 1, alignItems: 'center', gap: 2 },
  gpaDivider: { width: 1, height: 48, backgroundColor: 'rgba(255,255,255,0.20)' },
  gpaValue: { fontFamily: fonts.groteskBold, fontSize: 32, fontWeight: '700', color: '#FFFFFF', letterSpacing: -1 },
  gpaCaption: { ...typography.caption, color: 'rgba(240, 241, 255, 0.7)' },
  deltaChip: {
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  deltaText: { fontFamily: fonts.bold, fontSize: 11, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggleButton: { flex: 1 },
  courseCard: { gap: spacing.sm },
  courseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  courseName: { ...typography.h3, color: colors.text, flex: 1 },
  courseDeltaChip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99 },
  courseDeltaText: { fontFamily: fonts.bold, fontSize: 10, fontWeight: '700' },
  gradeChips: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  gradeChip: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gradeChipActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  gradeChipText: { fontFamily: fonts.groteskBold, fontSize: 14, fontWeight: '700' },
  stepperWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: 'auto' },
  levelRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  levelButton: { paddingHorizontal: spacing.sm, height: 36 },
  stepButton: { width: 36, height: 36, minHeight: 36 },
  averageValue: { ...typography.h3, color: colors.text, minWidth: 42, textAlign: 'center' },
  empty: { ...typography.body, color: colors.textMuted },
})
