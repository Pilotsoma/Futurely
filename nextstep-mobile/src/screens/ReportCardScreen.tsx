import React, { useCallback, useState } from 'react'
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Text from '../components/ui/Text'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import ScreenHeader from '../components/ui/ScreenHeader'
import { colors } from '../constants/colors'
import {
  getPortalStatus,
  getPortalReportCard,
  type PortalReportCardCourse,
} from '../api/portalApi'
import { LinkIcon } from '../components/icons'
import type { GradePortalParamList } from '../navigation/GradePortalNavigator'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BadgeStyle {
  text: string
  bg: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GRADE_BADGE_STYLES: Record<string, BadgeStyle> = {
  A: { text: colors.success, bg: `${colors.success}26` },
  B: { text: colors.primary, bg: `${colors.primary}26` },
  C: { text: colors.warning, bg: `${colors.warning}26` },
  D: { text: colors.orange,  bg: `${colors.orange}26` },
  F: { text: colors.error,   bg: `${colors.error}26` },
}

const FALLBACK_BADGE: BadgeStyle = { text: colors.textMuted, bg: colors.surface }

const SKELETON_CARD_COUNT = 5

// ─── Helpers ──────────────────────────────────────────────────────────────────

function averageToLetterGrade(average: number): string {
  if (average >= 90) return 'A'
  if (average >= 80) return 'B'
  if (average >= 70) return 'C'
  if (average >= 60) return 'D'
  return 'F'
}

function gradeStringToLetter(grade: string): string | null {
  if (grade === '') return null
  const num = parseFloat(grade)
  if (isNaN(num)) return null
  return averageToLetterGrade(num)
}

function gradeColor(grade: string): string {
  const letter = gradeStringToLetter(grade)
  if (letter === null) return colors.textMuted
  return (GRADE_BADGE_STYLES[letter] ?? FALLBACK_BADGE).text
}

function displayGrade(grade: string): string {
  return grade !== '' ? grade : '—'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton(): React.JSX.Element {
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
        <Skeleton key={i} width="100%" height={148} style={{ marginBottom: 12, borderRadius: 12 }} />
      ))}
    </View>
  )
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function ErrorView({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}): React.JSX.Element {
  return (
    <View style={styles.centerState}>
      <Text variant="h3" color={colors.error} style={styles.stateText}>
        Unable to Load Report Card
      </Text>
      <Text variant="body" color={colors.textSecondary} style={styles.stateText}>
        {message}
      </Text>
      <Button label="Try Again" onPress={onRetry} />
    </View>
  )
}

function EmptyView({ message }: { message: string }): React.JSX.Element {
  return (
    <View style={styles.emptyState}>
      <Text variant="h3" style={[styles.stateText, { color: colors.textPrimary }]}>
        No Report Card Yet
      </Text>
      <Text variant="body" style={[styles.stateText, { color: colors.textSecondary }]}>
        {message}
      </Text>
    </View>
  )
}

function NotConnectedView({
  onConnect,
}: {
  onConnect: () => void
}): React.JSX.Element {
  return (
    <View style={styles.emptyState}>
      <LinkIcon size={40} color={colors.textSecondary} />
      <Text variant="h3" style={[styles.stateText, { color: colors.textPrimary, marginTop: 12 }]}>
        Connect Your School Portal
      </Text>
      <Text variant="body" style={[styles.stateText, { color: colors.textSecondary }]}>
        Link your HAC or PowerSchool account to see your official report card.
      </Text>
      <TouchableOpacity
        style={styles.connectButton}
        onPress={onConnect}
        accessibilityRole="button"
        accessibilityLabel="Connect school portal"
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <Text style={styles.connectButtonText}>Connect School Portal</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Grade Cell ───────────────────────────────────────────────────────────────

function GradeCell({ label, value }: { label: string; value: string }): React.JSX.Element {
  const color = gradeColor(value)
  const display = displayGrade(value)

  return (
    <View style={styles.gradeCell}>
      <Text style={styles.gradeCellLabel}>{label}</Text>
      <Text style={[styles.gradeCellValue, { color }]}>{display}</Text>
    </View>
  )
}

// ─── Course Card ──────────────────────────────────────────────────────────────

function CourseCard({ course }: { course: PortalReportCardCourse }): React.JSX.Element {
  const sem1Final = displayGrade(course.semester1)
  const sem2Final = displayGrade(course.semester2)
  const sem1Color = gradeColor(course.semester1)
  const sem2Color = gradeColor(course.semester2)

  const creditText =
    course.attemptedCredit !== '' || course.earnedCredit !== ''
      ? `Credits: ${course.attemptedCredit !== '' ? course.attemptedCredit : '—'} attempted · ${course.earnedCredit !== '' ? course.earnedCredit : '—'} earned`
      : null

  const accessLabel = [
    course.name,
    `Period ${course.period}`,
    course.teacher,
    `Semester 1 final: ${sem1Final}`,
    `Semester 2 final: ${sem2Final}`,
    creditText ?? '',
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <View
      style={styles.courseCard}
      accessibilityRole="text"
      accessibilityLabel={accessLabel}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.periodBadge}>
          <Text style={styles.periodBadgeText}>P{course.period}</Text>
        </View>
        <View style={styles.cardHeaderText}>
          <Text variant="h3" style={styles.courseName} numberOfLines={2}>
            {course.name}
          </Text>
          {course.teacher !== '' && (
            <Text variant="caption" style={styles.teacherName}>
              {course.teacher}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      {/* Semester 1 grades */}
      <View style={styles.semSection}>
        <View style={styles.semLabelRow}>
          <Text style={styles.semLabel}>Semester 1</Text>
          <View style={styles.semFinalBadge}>
            <Text style={[styles.semFinalText, { color: sem1Color }]}>{sem1Final}</Text>
          </View>
        </View>
        <View style={styles.gradeRow}>
          <GradeCell label="1st" value={course.sixWeeks1} />
          <GradeCell label="2nd" value={course.sixWeeks2} />
          <GradeCell label="3rd" value={course.sixWeeks3} />
          <GradeCell label="Exam" value={course.exam1} />
        </View>
      </View>

      <View style={styles.divider} />

      {/* Semester 2 grades */}
      <View style={styles.semSection}>
        <View style={styles.semLabelRow}>
          <Text style={styles.semLabel}>Semester 2</Text>
          <View style={styles.semFinalBadge}>
            <Text style={[styles.semFinalText, { color: sem2Color }]}>{sem2Final}</Text>
          </View>
        </View>
        <View style={styles.gradeRow}>
          <GradeCell label="4th" value={course.sixWeeks4} />
          <GradeCell label="5th" value={course.sixWeeks5} />
          <GradeCell label="6th" value={course.sixWeeks6} />
          <GradeCell label="Exam" value={course.exam2} />
        </View>
      </View>

      {/* Credits footer */}
      {creditText !== null && (
        <>
          <View style={styles.divider} />
          <View style={styles.creditsRow}>
            <Text style={styles.creditsText}>{creditText}</Text>
          </View>
        </>
      )}
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReportCardScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<GradePortalParamList>>()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [courses, setCourses] = useState<PortalReportCardCourse[]>([])
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null)

  const load = useCallback(async (refresh: boolean = false): Promise<void> => {
    if (refresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)
    setEmptyMessage(null)

    try {
      const status = await getPortalStatus()
      setIsConnected(status.connected)

      if (!status.connected) {
        setCourses([])
        return
      }

      const result = await getPortalReportCard()
      const fetched = result.courses ?? []

      if (fetched.length === 0) {
        setCourses([])
        setEmptyMessage(
          result.message ?? 'No report card data is available for the current grading period.',
        )
      } else {
        setCourses(fetched)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report card.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  const handleRefresh = useCallback((): void => {
    void load(true)
  }, [load])

  if (isLoading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Report Card" />
        <LoadingSkeleton />
      </View>
    )
  }

  if (error !== null) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Report Card" />
        <ErrorView message={error} onRetry={() => void load()} />
      </View>
    )
  }

  if (!isConnected) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Report Card" />
        <NotConnectedView onConnect={() => navigation.navigate('PortalConnect')} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="Report Card" />
      <FlatList<PortalReportCardCourse>
        data={courses}
        keyExtractor={(item, index) => `${item.name}-${item.period}-${index}`}
        renderItem={({ item }) => <CourseCard course={item} />}
        ListEmptyComponent={
          emptyMessage !== null ? <EmptyView message={emptyMessage} /> : null
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={courses.length === 0 ? styles.emptyContainer : styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skeletonContainer: {
    padding: 20,
  },

  // ── Course card ──
  courseCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 10,
  },
  periodBadge: {
    backgroundColor: `${colors.primary}1A`,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    minWidth: 32,
    alignItems: 'center',
    marginTop: 2,
  },
  periodBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardHeaderText: {
    flex: 1,
  },
  courseName: {
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: 2,
  },
  teacherName: {
    color: colors.textSecondary,
  },

  // ── Divider ──
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },

  // ── Semester section ──
  semSection: {
    padding: 12,
  },
  semLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  semLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  semFinalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  semFinalText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Grade row & cell ──
  gradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gradeCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  gradeCellLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  gradeCellValue: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  // ── Credits footer ──
  creditsRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  creditsText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '400',
  },

  // ── List ──
  listContent: {
    paddingTop: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    flexGrow: 1,
  },

  // ── States ──
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyState: {
    paddingTop: 80,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  stateText: {
    textAlign: 'center',
    marginBottom: 8,
  },
  connectButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
    marginTop: 8,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
})
