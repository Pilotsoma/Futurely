import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import Text from '../components/ui/Text'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import Card from '../components/ui/Card'
import ScreenHeader from '../components/ui/ScreenHeader'
import DeltaCard from '../components/simulator/DeltaCard'
import GradeAdjustRow from '../components/simulator/GradeAdjustRow'
import { colors } from '../constants/colors'
import { ResetIcon } from '../components/icons'
import { fetchGrades, type CourseWithGrade, type GradeData } from '../api/gradesApi'
import {
  calculateGpa,
  isLetterGrade,
  isCourseType,
  type GradeInput,
  type GpaResult,
  type LetterGrade,
} from '../lib/gpa'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toInputs(
  courses: CourseWithGrade[],
  overrides: Record<number, LetterGrade>,
): GradeInput[] {
  const inputs: GradeInput[] = []
  for (const c of courses) {
    if (c.grade === null) continue
    const rawGrade  = overrides[c.id] ?? c.grade.letterGrade
    if (!isLetterGrade(rawGrade)) continue
    const courseType = isCourseType(c.courseType) ? c.courseType : 'STANDARD'
    inputs.push({ letterGrade: rawGrade, courseType, creditHours: c.creditHours })
  }
  return inputs
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingView(): React.JSX.Element {
  return (
    <ScrollView scrollEnabled={false} contentContainerStyle={styles.scrollContent}>
      <Text variant="heading" style={styles.screenTitle}>GPA Simulator</Text>

      {/* DeltaCard skeleton — mirrors both weighted and unweighted rows */}
      <Card style={styles.cardSpacing}>
        {/* Row 1: Weighted */}
        <View style={styles.skeletonDeltaRow}>
          <View style={{ flex: 1 }}>
            <Skeleton width={80} height={11} style={{ marginBottom: 12 }} />
            <Skeleton width={64} height={40} style={{ marginBottom: 10 }} />
            <Skeleton width={56} height={11} />
          </View>
          <View style={styles.skeletonDivider} />
          <View style={{ flex: 1 }}>
            <Skeleton width={88} height={11} style={{ marginBottom: 12 }} />
            <Skeleton width={100} height={28} />
          </View>
        </View>
        {/* Row 2: Unweighted */}
        <View style={styles.skeletonHDivider} />
        <View style={styles.skeletonDeltaRow}>
          <View style={{ flex: 1 }}>
            <Skeleton width={72} height={11} style={{ marginBottom: 8 }} />
            <Skeleton width={52} height={22} />
          </View>
          <View style={styles.skeletonDivider} />
          <View style={{ flex: 1 }}>
            <Skeleton width={84} height={11} style={{ marginBottom: 8 }} />
            <Skeleton width={52} height={22} />
          </View>
        </View>
      </Card>

      {/* Section header skeleton */}
      <View style={styles.sectionHeader}>
        <Skeleton width={72} height={11} />
        <Skeleton width={40} height={11} />
      </View>

      {/* Row skeletons */}
      {Array.from({ length: 5 }, (_, i) => (
        <Card key={i} style={styles.cardSpacing}>
          <Skeleton width="65%" height={15} style={{ marginBottom: 8 }} />
          <Skeleton width="40%" height={11} style={{ marginBottom: 14 }} />
          <View style={styles.skeletonPillRow}>
            {Array.from({ length: 6 }, (__, j) => (
              <Skeleton key={j} width={44} height={44} radius={8} />
            ))}
          </View>
        </Card>
      ))}
    </ScrollView>
  )
}

// ─── Error & Empty ────────────────────────────────────────────────────────────

function ErrorView({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}): React.JSX.Element {
  return (
    <View style={styles.centerState}>
      <Text variant="h3" color={colors.error} style={styles.stateTitle}>
        Unable to Load Grades
      </Text>
      <Text variant="body" color={colors.textSecondary} style={styles.stateMessage}>
        {message}
      </Text>
      <Button label="Try Again" onPress={onRetry} />
    </View>
  )
}

function EmptyView(): React.JSX.Element {
  return (
    <View style={styles.centerState}>
      <Text variant="h3" style={styles.stateTitle}>No Grades to Simulate</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.stateMessage}>
        Check back once your courses have grades recorded.
      </Text>
    </View>
  )
}

// ─── College readiness bar ────────────────────────────────────────────────────

const TARGET_GPA = 3.5

function CollegeReadinessBar({ gpa }: { gpa: number | null }): React.JSX.Element {
  const progress = useMemo(() => {
    if (gpa === null) return 0
    return Math.min(1, Math.max(0, gpa / TARGET_GPA))
  }, [gpa])

  const anim = useRef(new Animated.Value(0)).current
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(progress)
      return
    }
    Animated.timing(anim, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
    }).start()
  }, [progress, anim, reduceMotion])

  const barColor = gpa !== null && gpa >= TARGET_GPA ? colors.success : colors.primary

  return (
    <View style={styles.readinessCard}>
      <View style={styles.readinessHeader}>
        <Text variant="label" color={colors.textSecondary}>College Readiness</Text>
        <Text variant="label" color={gpa !== null && gpa >= TARGET_GPA ? colors.success : colors.textSecondary}>
          {gpa !== null ? `${((progress) * 100).toFixed(0)}%` : '—'} toward 3.5
        </Text>
      </View>
      <View style={styles.readinessTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
        <Animated.View
          style={[
            styles.readinessFill,
            {
              backgroundColor: barColor,
              width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      <Text variant="caption" color={colors.textMuted} style={{ marginTop: 6 }}>
        Target: 3.50 weighted GPA for competitive admissions
      </Text>
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GpaSimulatorScreen(): React.JSX.Element {
  const [courses,   setCourses]   = useState<CourseWithGrade[]>([])
  const [overrides, setOverrides] = useState<Record<number, LetterGrade>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const loadGrades = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setError(null)
    setOverrides({})
    try {
      const data = await fetchGrades()
      setCourses([...data.courses].sort((a, b) => a.period - b.period))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load grades.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void loadGrades() }, [loadGrades])

  const originalGpa: GpaResult | null = useMemo(
    () => calculateGpa(toInputs(courses, {})),
    [courses],
  )

  const projectedGpa: GpaResult | null = useMemo(
    () => calculateGpa(toInputs(courses, overrides)),
    [courses, overrides],
  )

  const handleGradeChange = useCallback((courseId: number, grade: LetterGrade): void => {
    setOverrides((prev) => ({ ...prev, [courseId]: grade }))
  }, [])

  const handleReset = useCallback((): void => {
    setOverrides({})
  }, [])

  const hasChanges    = Object.keys(overrides).length > 0
  const gradedCourses = courses.filter(
    (c): c is CourseWithGrade & { grade: GradeData } => c.grade !== null,
  )

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="GPA Simulator" />
        <LoadingView />
      </View>
    )
  }

  if (error !== null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="GPA Simulator" />
        <ErrorView message={error} onRetry={() => void loadGrades()} />
      </View>
    )
  }

  if (gradedCourses.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="GPA Simulator" />
        <EmptyView />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="GPA Simulator" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="heading" style={styles.screenTitle}>GPA Simulator</Text>

        <DeltaCard
          currentGpa={originalGpa?.weighted ?? null}
          projectedGpa={projectedGpa?.weighted ?? null}
          currentUnweightedGpa={originalGpa?.unweighted ?? null}
          projectedUnweightedGpa={projectedGpa?.unweighted ?? null}
          hasChanges={hasChanges}
        />

        <CollegeReadinessBar
          gpa={hasChanges ? (projectedGpa?.weighted ?? null) : (originalGpa?.weighted ?? null)}
        />

        <View style={styles.sectionHeader}>
          <Text variant="label" color={colors.textSecondary}>Courses</Text>
          <TouchableOpacity
            onPress={handleReset}
            disabled={!hasChanges}
            style={[styles.resetButton, !hasChanges && styles.resetButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Reset all grades to original"
            accessibilityState={{ disabled: !hasChanges }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <ResetIcon size={14} color={!hasChanges ? colors.textSecondary : colors.primary}/>
              <Text style={[styles.resetText, !hasChanges && styles.resetTextDisabled]}>Reset</Text>
            </View>
          </TouchableOpacity>
        </View>

        {gradedCourses.map((course) => (
          <GradeAdjustRow
            key={course.id}
            courseId={course.id}
            courseName={course.name}
            courseType={course.courseType}
            originalGrade={course.grade.letterGrade}
            selectedGrade={overrides[course.id] ?? course.grade.letterGrade}
            onGradeChange={handleGradeChange}
            style={styles.cardSpacing}
          />
        ))}
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  screenTitle: {
    paddingTop: 24,
    marginBottom: 16,
  },
  cardSpacing: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  resetButtonDisabled: {
    opacity: 0.4,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  resetTextDisabled: {
    color: colors.textSecondary,
  },
  // Loading skeleton styles
  skeletonDeltaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  skeletonDivider: {
    width: 1,
    height: 80,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  skeletonPillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  skeletonHDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  // College readiness bar
  readinessCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 8,
  },
  readinessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  readinessTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  readinessFill: {
    height: '100%',
    borderRadius: 4,
  },
  // State views
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  stateMessage: {
    textAlign: 'center' as const,
    marginBottom: 24,
  },
})
