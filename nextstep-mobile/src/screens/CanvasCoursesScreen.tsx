import React, { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Text from '../components/ui/Text'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import ScreenHeader from '../components/ui/ScreenHeader'
import { colors } from '../constants/colors'
import { getCanvasGrades, type CanvasConnectionGrades, type CanvasCourseWithAssignments } from '../api/canvasApi'
import { BookOpenIcon, ChevronRightIcon, WarningIcon } from '../components/icons'
import type { CanvasNavigatorParamList } from '../navigation/CanvasNavigator'

// ── Types ─────────────────────────────────────────────────────────────────────

type Route = RouteProp<CanvasNavigatorParamList, 'CanvasCourses'>
type Nav = NativeStackNavigationProp<CanvasNavigatorParamList>

// ── Constants ─────────────────────────────────────────────────────────────────

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

function gradeBadge(grade: string | null): GradeBadgeStyle {
  if (grade === null || grade === '') return FALLBACK_BADGE
  return GRADE_BADGE_STYLES[grade.charAt(0).toUpperCase()] ?? FALLBACK_BADGE
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LoadingSkeleton(): React.JSX.Element {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <View key={i} style={styles.courseRowSkeleton}>
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
      <Text variant="h3" color={colors.error} style={styles.stateTitle}>Unable to Load Courses</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.stateMessage}>{message}</Text>
      <Button label="Try Again" onPress={onRetry} />
    </View>
  )
}

function TokenExpiredView(): React.JSX.Element {
  return (
    <View style={styles.centerState}>
      <WarningIcon size={40} color={colors.warning} />
      <Text variant="h3" color={colors.warning} style={styles.stateTitle}>Token Expired</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.stateMessage}>
        Your Canvas access token has expired. Reconnect your Canvas account to continue.
      </Text>
    </View>
  )
}

interface CourseRowProps {
  course: CanvasCourseWithAssignments
  onPress: () => void
}

function CourseRow({ course, onPress }: CourseRowProps): React.JSX.Element {
  const badge = gradeBadge(course.currentGrade)
  const score = course.currentScore !== null ? `${course.currentScore.toFixed(1)}%` : null

  return (
    <TouchableOpacity
      style={styles.courseRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${course.name}${score !== null ? `, ${score}` : ''}${course.currentGrade !== null ? `, ${course.currentGrade}` : ''}`}
    >
      <View style={styles.courseLeft}>
        <Text variant="h3" style={styles.courseName} numberOfLines={2}>{course.name}</Text>
        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: 4 }}>
          {course.assignments.length} assignment{course.assignments.length !== 1 ? 's' : ''}
        </Text>
        {score !== null && (
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>{score}</Text>
        )}
      </View>
      <View style={styles.courseRight}>
        <View style={[styles.gradeBadge, { backgroundColor: badge.bg, borderColor: badge.text }]}>
          <Text style={[styles.gradeBadgeText, { color: badge.text }]}>
            {course.currentGrade ?? '—'}
          </Text>
        </View>
        <View style={{ marginTop: 6 }}>
          <ChevronRightIcon size={14} color={colors.textMuted} />
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CanvasCoursesScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { connectionId, instanceUrl, displayName } = route.params

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionData, setConnectionData] = useState<CanvasConnectionGrades | null>(null)

  const load = useCallback(async (refresh = false): Promise<void> => {
    if (refresh) setIsRefreshing(true)
    else setIsLoading(true)
    setError(null)
    try {
      const grades = await getCanvasGrades()
      const conn = grades[connectionId] ?? null
      setConnectionData(conn)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load courses.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [connectionId])

  useEffect(() => {
    void load()
  }, [load])

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={displayName} />
        <LoadingSkeleton />
      </View>
    )
  }

  if (error !== null) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={displayName} />
        <ErrorView message={error} onRetry={() => void load()} />
      </View>
    )
  }

  if (connectionData?.error === 'TOKEN_EXPIRED') {
    return (
      <View style={styles.container}>
        <ScreenHeader title={displayName} />
        <TokenExpiredView />
      </View>
    )
  }

  if (connectionData?.error === 'FETCH_FAILED') {
    return (
      <View style={styles.container}>
        <ScreenHeader title={displayName} />
        <ErrorView
          message="Failed to sync courses from Canvas. Please try again."
          onRetry={() => void load()}
        />
      </View>
    )
  }

  const courses = connectionData?.courses ?? []

  return (
    <View style={styles.container}>
      <ScreenHeader title={displayName} />
      <FlatList
        data={courses}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <CourseRow
            course={item}
            onPress={() =>
              navigation.navigate('CanvasCourseDetail', {
                courseId: item.id,
                courseName: item.name,
                instanceUrl,
                connectionId,
              })
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 40 }}
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
            <BookOpenIcon size={40} color={colors.textSecondary} />
            <Text variant="h3" style={styles.stateTitle}>No Courses Found</Text>
            <Text variant="body" color={colors.textSecondary} style={styles.stateMessage}>
              No courses were found in this Canvas account. This may be because no active courses are enrolled for the current term.
            </Text>
          </View>
        }
      />
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  courseRowSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  courseLeft: {
    flex: 1,
    marginRight: 12,
  },
  courseName: {
    flexShrink: 1,
  },
  courseRight: {
    alignItems: 'center',
    minWidth: 52,
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
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 18,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 20,
  },
})
