import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Text from '../components/ui/Text'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import ScreenHeader from '../components/ui/ScreenHeader'
import { colors } from '../constants/colors'
import {
  getPortalStatus,
  getProgressReport,
  type PortalStatus,
  type PortalProgressReportResult,
  type ProgressReportCourse,
} from '../api/portalApi'
import { BarChartIcon, LinkIcon } from '../components/icons'
import type { GradePortalParamList } from '../navigation/GradePortalNavigator'

// ── Constants ─────────────────────────────────────────────────────────────────

const SKELETON_COURSE_COUNT = 5

interface GradeBadgeStyle {
  text: string
  bg: string
}

const GRADE_BADGE_STYLES: Record<string, GradeBadgeStyle> = {
  A: { text: colors.success, bg: colors.success + '26' },
  B: { text: colors.primary, bg: colors.primary + '26' },
  C: { text: colors.warning, bg: colors.warning + '26' },
  D: { text: colors.orange, bg: colors.orange + '26' },
  F: { text: colors.error, bg: colors.error + '26' },
}

const FALLBACK_BADGE: GradeBadgeStyle = { text: colors.textMuted, bg: colors.surface }

// ── Helpers ───────────────────────────────────────────────────────────────────

function gradeBadge(letterGrade: string): GradeBadgeStyle {
  return GRADE_BADGE_STYLES[letterGrade.charAt(0).toUpperCase()] ?? FALLBACK_BADGE
}

function formatDate(dateStr: string): string {
  // Try parsing MM/DD/YYYY or ISO date
  const parts = dateStr.split('/')
  if (parts.length === 3) {
    const [month, day, year] = parts
    const d = new Date(Number(year), Number(month) - 1, Number(day))
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }
  const d = new Date(dateStr)
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return dateStr
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LoadingSkeleton(): React.JSX.Element {
  return (
    <View>
      {/* Date pills skeleton */}
      <View style={styles.datePillsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.datePillsScroll} scrollEnabled={false}>
          {[0, 1, 2].map(i => (
            <Skeleton key={i} width={80} height={36} radius={18} style={{ marginRight: 8 }} />
          ))}
        </ScrollView>
      </View>
      {/* Course list skeleton */}
      <View style={{ paddingHorizontal: 20 }}>
        {Array.from({ length: SKELETON_COURSE_COUNT }, (_, i) => (
          <View key={i} style={styles.courseCardSkeleton}>
            <View style={{ flex: 1 }}>
              <Skeleton width="70%" height={16} style={{ marginBottom: 8 }} />
              <Skeleton width="45%" height={12} />
            </View>
            <Skeleton width={52} height={52} radius={10} />
          </View>
        ))}
      </View>
    </View>
  )
}

function CourseListSkeleton(): React.JSX.Element {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      {Array.from({ length: SKELETON_COURSE_COUNT }, (_, i) => (
        <View key={i} style={styles.courseCardSkeleton}>
          <View style={{ flex: 1 }}>
            <Skeleton width="70%" height={16} style={{ marginBottom: 8 }} />
            <Skeleton width="45%" height={12} />
          </View>
          <Skeleton width={52} height={52} radius={10} />
        </View>
      ))}
    </View>
  )
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }): React.JSX.Element {
  return (
    <View style={styles.centerState}>
      <Text variant="h3" color={colors.error} style={styles.stateTitle}>Unable to Load Progress Report</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.stateMessage}>{message}</Text>
      <Button label="Try Again" onPress={onRetry} />
    </View>
  )
}

function ConnectPortalPrompt({ onConnect }: { onConnect: () => void }): React.JSX.Element {
  return (
    <View style={styles.centerState}>
      <LinkIcon size={40} color={colors.textSecondary} />
      <Text variant="h3" style={styles.stateTitle}>Connect Your School Portal</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.stateMessage}>
        Link your HAC account to view your progress reports here.
      </Text>
      <Button label="Connect School Portal" onPress={onConnect} />
    </View>
  )
}

function HacOnlyView(): React.JSX.Element {
  return (
    <View style={styles.centerState}>
      <BarChartIcon size={40} color={colors.textSecondary} />
      <Text variant="h3" style={styles.stateTitle}>HAC Accounts Only</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.stateMessage}>
        Progress reports are only available for HAC-connected schools.
      </Text>
    </View>
  )
}

function CourseCard({ course }: { course: ProgressReportCourse }): React.JSX.Element {
  const badge = gradeBadge(course.letterGrade)
  return (
    <View style={styles.courseCard}>
      <View style={styles.courseCardLeft}>
        <Text variant="h3" style={styles.courseName} numberOfLines={2}>{course.name}</Text>
        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: 4 }}>
          {course.teacher !== '' ? `${course.teacher} · ` : ''}Period {course.period}
        </Text>
        {course.average !== '' && (
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
            {course.average}%
          </Text>
        )}
      </View>
      <View style={styles.courseCardRight}>
        <View style={[styles.gradeBadge, { backgroundColor: badge.bg, borderColor: badge.text }]}>
          <Text style={[styles.gradeBadgeText, { color: badge.text }]}>
            {course.letterGrade !== '' ? course.letterGrade : '—'}
          </Text>
        </View>
      </View>
    </View>
  )
}

function DatePill({
  date,
  isSelected,
  onPress,
}: {
  date: string
  isSelected: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[styles.datePill, isSelected && styles.datePillActive]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`View progress report for ${date}`}
      accessibilityState={{ selected: isSelected }}
    >
      <Text style={[styles.datePillText, isSelected && styles.datePillTextActive]}>
        {formatDate(date)}
      </Text>
    </TouchableOpacity>
  )
}

function Separator(): React.JSX.Element {
  return <View style={styles.separator} />
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProgressReportScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<GradePortalParamList>>()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDateLoading, setIsDateLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [portalStatus, setPortalStatus] = useState<PortalStatus | null>(null)
  const [reportData, setReportData] = useState<PortalProgressReportResult | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const load = useCallback(async (refresh = false): Promise<void> => {
    if (refresh) setIsRefreshing(true)
    else setIsLoading(true)
    setError(null)
    try {
      const status = await getPortalStatus()
      setPortalStatus(status)
      if (status.connected && status.systemType === 'HAC') {
        const data = await getProgressReport()
        setReportData(data)
        setSelectedDate(data.currentDate)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load progress report.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  const handleDateSelect = useCallback(async (date: string): Promise<void> => {
    if (date === selectedDate || isDateLoading) return
    setIsDateLoading(true)
    setError(null)
    try {
      const data = await getProgressReport(date)
      setReportData(data)
      setSelectedDate(date)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load progress report for this date.')
    } finally {
      setIsDateLoading(false)
    }
  }, [selectedDate, isDateLoading])

  useEffect(() => {
    void load()
  }, [load])

  const courses = useMemo<ProgressReportCourse[]>(
    () => reportData?.courses ?? [],
    [reportData],
  )

  const availableDates = useMemo<string[]>(
    () => reportData?.availableDates ?? [],
    [reportData],
  )

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Progress Report" />
        <LoadingSkeleton />
      </View>
    )
  }

  if (error !== null && reportData === null) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Progress Report" />
        <ErrorView message={error} onRetry={() => void load()} />
      </View>
    )
  }

  if (portalStatus === null || !portalStatus.connected) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Progress Report" />
        <ConnectPortalPrompt onConnect={() => navigation.navigate('PortalConnect')} />
      </View>
    )
  }

  if (portalStatus.systemType !== 'HAC') {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Progress Report" />
        <HacOnlyView />
      </View>
    )
  }

  if (reportData !== null && availableDates.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Progress Report" />
        <View style={styles.centerState}>
          <BarChartIcon size={40} color={colors.textSecondary} />
          <Text variant="h3" style={styles.stateTitle}>No Reports Available</Text>
          <Text variant="body" color={colors.textSecondary} style={styles.stateMessage}>
            No progress reports are available yet for this period.
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Progress Report" />

      {/* Date pill selector (always visible above list) */}
      {availableDates.length > 0 && (
        <View style={styles.datePillsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.datePillsScroll}
          >
            {availableDates.map(date => (
              <DatePill
                key={date}
                date={date}
                isSelected={date === selectedDate}
                onPress={() => void handleDateSelect(date)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Inline date error */}
      {error !== null && (
        <View style={styles.inlineErrorBanner}>
          <Text variant="caption" color={colors.error}>{error}</Text>
        </View>
      )}

      {/* Course list */}
      {isDateLoading ? (
        <CourseListSkeleton />
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item, i) => `${item.name}-${i}`}
          renderItem={({ item }) => <CourseCard course={item} />}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void load(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <BarChartIcon size={36} color={colors.textSecondary} />
              <Text variant="h3" style={styles.stateTitle}>No Courses Found</Text>
              <Text variant="body" color={colors.textSecondary} style={styles.stateMessage}>
                No course data is available for this reporting period.
              </Text>
            </View>
          }
        />
      )}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: 40,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  stateTitle: {
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  stateMessage: {
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyState: {
    paddingTop: 60,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  // Date pills
  datePillsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 12,
  },
  datePillsScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  datePill: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePillActive: {
    backgroundColor: colors.primary + '26',
    borderColor: colors.primary,
  },
  datePillText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  datePillTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  inlineErrorBanner: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: 10,
    backgroundColor: colors.error + '18',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  // Course card
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  courseCardSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  courseCardLeft: {
    flex: 1,
    marginRight: 12,
  },
  courseName: {
    flexShrink: 1,
  },
  courseCardRight: {
    alignItems: 'center',
  },
  gradeBadge: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeBadgeText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 20,
  },
})
