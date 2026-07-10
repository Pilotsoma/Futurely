import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRoute, type RouteProp } from '@react-navigation/native'
import Text from '../components/ui/Text'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import ScreenHeader from '../components/ui/ScreenHeader'
import { colors } from '../constants/colors'
import {
  getCanvasGrades,
  getCanvasModules,
  type CanvasConnectionGrades,
  type CanvasModule,
  type CanvasCourseWithAssignments,
  type CanvasAssignmentWithSubmission,
} from '../api/canvasApi'
import { BookOpenIcon, CheckCircleIcon, WarningIcon } from '../components/icons'
import type { CanvasNavigatorParamList } from '../navigation/CanvasNavigator'

// ── Types ─────────────────────────────────────────────────────────────────────

type Route = RouteProp<CanvasNavigatorParamList, 'CanvasCourseDetail'>
type Tab = 'Modules' | 'Assignments' | 'Grades'

const TABS: Tab[] = ['Modules', 'Assignments', 'Grades']

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function gradeBadge(grade: string | null): GradeBadgeStyle {
  if (grade === null || grade === '') return FALLBACK_BADGE
  return GRADE_BADGE_STYLES[grade.charAt(0).toUpperCase()] ?? FALLBACK_BADGE
}

function formatDueDate(dateStr: string | null): string {
  if (dateStr === null || dateStr === '') return 'No due date'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 'No due date'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatScore(score: number | null, pointsPossible: number | null): string {
  if (score === null) return '—'
  if (pointsPossible !== null) return `${score} / ${pointsPossible}`
  return String(score)
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TabContentSkeleton(): React.JSX.Element {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width="70%" height={15} style={{ marginBottom: 6 }} />
          <Skeleton width="45%" height={12} />
        </View>
      ))}
    </View>
  )
}

// ── Error ─────────────────────────────────────────────────────────────────────

function TabErrorView({ message, onRetry }: { message: string; onRetry: () => void }): React.JSX.Element {
  return (
    <View style={styles.tabCenter}>
      <Text variant="h3" color={colors.error} style={styles.stateTitle}>Failed to Load</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.stateMessage}>{message}</Text>
      <Button label="Try Again" onPress={onRetry} />
    </View>
  )
}

function TokenExpiredView(): React.JSX.Element {
  return (
    <View style={styles.tabCenter}>
      <WarningIcon size={36} color={colors.warning} />
      <Text variant="h3" color={colors.warning} style={styles.stateTitle}>Token Expired</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.stateMessage}>
        Your Canvas access token has expired. Reconnect your Canvas account to view grades.
      </Text>
    </View>
  )
}

function EmptyTabView({ message }: { message: string }): React.JSX.Element {
  return (
    <View style={styles.tabCenter}>
      <BookOpenIcon size={36} color={colors.textMuted} />
      <Text variant="body" color={colors.textMuted} style={styles.stateMessage}>{message}</Text>
    </View>
  )
}

// ── Segmented Control ─────────────────────────────────────────────────────────

interface SegmentedControlProps {
  activeTab: Tab
  onSelect: (tab: Tab) => void
}

function SegmentedControl({ activeTab, onSelect }: SegmentedControlProps): React.JSX.Element {
  return (
    <View style={styles.segmentedControl}>
      {TABS.map(tab => (
        <TouchableOpacity
          key={tab}
          style={[styles.segmentBtn, activeTab === tab && styles.segmentBtnActive]}
          onPress={() => onSelect(tab)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${tab} tab`}
          accessibilityState={{ selected: activeTab === tab }}
        >
          <Text style={[styles.segmentBtnText, activeTab === tab && styles.segmentBtnTextActive]}>
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ── Modules Tab ───────────────────────────────────────────────────────────────

function ModulesTab({
  modules,
  isLoading,
  error,
  onRetry,
}: {
  modules: CanvasModule[] | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
}): React.JSX.Element {
  if (isLoading) return <TabContentSkeleton />
  if (error !== null) return <TabErrorView message={error} onRetry={onRetry} />
  if (modules === null || modules.length === 0) {
    return <EmptyTabView message="No modules found for this course." />
  }

  return (
    <FlatList
      data={modules}
      keyExtractor={item => item.id.toString()}
      renderItem={({ item }) => (
        <View style={styles.moduleRow}>
          <View style={styles.moduleIconWrap}>
            <CheckCircleIcon size={18} color={item.state === 'completed' ? colors.success : colors.textMuted} />
          </View>
          <View style={styles.moduleInfo}>
            <Text variant="h3" style={styles.moduleName}>{item.name}</Text>
            <Text variant="caption" color={colors.textMuted}>
              {item.items_count} item{item.items_count !== 1 ? 's' : ''}
              {item.state !== null ? ` · ${item.state}` : ''}
            </Text>
          </View>
        </View>
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    />
  )
}

// ── Assignments Tab ───────────────────────────────────────────────────────────

interface AssignmentRowProps {
  assignment: CanvasAssignmentWithSubmission
}

function AssignmentRow({ assignment }: AssignmentRowProps): React.JSX.Element {
  const sub = assignment.submission
  const isMissing = sub?.missing === true
  const isLate = sub?.late === true && !isMissing
  const score = sub !== null ? formatScore(sub.score, assignment.points_possible) : '—'

  return (
    <View style={styles.assignmentRow}>
      <View style={styles.assignmentLeft}>
        <Text variant="h3" style={styles.assignmentName} numberOfLines={2}>{assignment.name}</Text>
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
          Due: {formatDueDate(assignment.due_at)}
        </Text>
        <View style={styles.assignmentBadges}>
          {isMissing && (
            <View style={[styles.statusBadge, { backgroundColor: colors.error + '20', borderColor: colors.error + '50' }]}>
              <Text style={[styles.statusBadgeText, { color: colors.error }]}>Missing</Text>
            </View>
          )}
          {isLate && (
            <View style={[styles.statusBadge, { backgroundColor: colors.warning + '20', borderColor: colors.warning + '50' }]}>
              <Text style={[styles.statusBadgeText, { color: colors.warning }]}>Late</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.assignmentRight}>
        <Text variant="h3" color={sub !== null ? colors.textPrimary : colors.textMuted}>{score}</Text>
        {assignment.points_possible !== null && (
          <Text variant="caption" color={colors.textMuted}>pts</Text>
        )}
      </View>
    </View>
  )
}

function AssignmentsTab({
  course,
  isLoading,
  error,
  errorType,
  onRetry,
}: {
  course: CanvasCourseWithAssignments | null
  isLoading: boolean
  error: string | null
  errorType: 'TOKEN_EXPIRED' | 'FETCH_FAILED' | null
  onRetry: () => void
}): React.JSX.Element {
  if (isLoading) return <TabContentSkeleton />
  if (errorType === 'TOKEN_EXPIRED') return <TokenExpiredView />
  if (error !== null) return <TabErrorView message={error} onRetry={onRetry} />

  const assignments = course?.assignments ?? []
  if (assignments.length === 0) {
    return <EmptyTabView message="No assignments found for this course." />
  }

  return (
    <FlatList
      data={assignments}
      keyExtractor={item => item.id.toString()}
      renderItem={({ item }) => <AssignmentRow assignment={item} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    />
  )
}

// ── Grades Tab ────────────────────────────────────────────────────────────────

function GradeScoreRow({ assignment }: { assignment: CanvasAssignmentWithSubmission }): React.JSX.Element {
  const sub = assignment.submission
  const score = sub !== null ? formatScore(sub.score, assignment.points_possible) : '—'
  const isMissing = sub?.missing === true
  const scoreColor = isMissing ? colors.error : sub !== null ? colors.textPrimary : colors.textMuted

  return (
    <View style={styles.gradeScoreRow}>
      <Text variant="body" style={styles.gradeAssignmentName} numberOfLines={1}>{assignment.name}</Text>
      <View style={styles.gradeScoreRight}>
        <Text variant="body" color={scoreColor} style={styles.gradeScoreText}>{score}</Text>
        {isMissing && (
          <Text style={styles.gradeScoreMissingLabel}>Missing</Text>
        )}
      </View>
    </View>
  )
}

function GradesTab({
  course,
  isLoading,
  error,
  errorType,
  onRetry,
}: {
  course: CanvasCourseWithAssignments | null
  isLoading: boolean
  error: string | null
  errorType: 'TOKEN_EXPIRED' | 'FETCH_FAILED' | null
  onRetry: () => void
}): React.JSX.Element {
  if (isLoading) return <TabContentSkeleton />
  if (errorType === 'TOKEN_EXPIRED') return <TokenExpiredView />
  if (error !== null) return <TabErrorView message={error} onRetry={onRetry} />

  const badge = gradeBadge(course?.currentGrade ?? null)
  const assignments = course?.assignments ?? []

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {/* Overall grade hero */}
      <View style={styles.gradeHero}>
        <View style={[styles.gradeHeroBadge, { backgroundColor: badge.bg, borderColor: badge.text }]}>
          <Text style={[styles.gradeHeroBadgeText, { color: badge.text }]}>
            {course?.currentGrade ?? '—'}
          </Text>
        </View>
        <View style={{ marginLeft: 20 }}>
          <Text variant="label" color={colors.textSecondary}>Current Grade</Text>
          <Text variant="display" color={badge.text} style={{ marginTop: 4 }}>
            {course?.currentScore !== null && course?.currentScore !== undefined
              ? `${course.currentScore.toFixed(1)}%`
              : '—'}
          </Text>
        </View>
      </View>

      {/* Per-assignment scores */}
      {assignments.length === 0 ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <Text variant="body" color={colors.textMuted} style={{ textAlign: 'center' }}>
            No assignment scores available.
          </Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 20 }}>
          <Text variant="label" color={colors.textSecondary} style={styles.sectionLabel}>
            Assignment Scores
          </Text>
          {assignments.map((assignment, i) => (
            <React.Fragment key={assignment.id}>
              <GradeScoreRow assignment={assignment} />
              {i < assignments.length - 1 && <View style={styles.separator} />}
            </React.Fragment>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CanvasCourseDetailScreen(): React.JSX.Element {
  const route = useRoute<Route>()
  const { courseId, courseName, connectionId } = route.params

  const [activeTab, setActiveTab] = useState<Tab>('Modules')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [modules, setModules] = useState<CanvasModule[] | null>(null)
  const [modulesError, setModulesError] = useState<string | null>(null)

  const [connectionData, setConnectionData] = useState<CanvasConnectionGrades | null>(null)
  const [gradesError, setGradesError] = useState<string | null>(null)
  const [gradesErrorType, setGradesErrorType] = useState<'TOKEN_EXPIRED' | 'FETCH_FAILED' | null>(null)

  const load = useCallback(async (refresh = false): Promise<void> => {
    if (refresh) setIsRefreshing(true)
    else setIsLoading(true)

    const [modulesResult, gradesResult] = await Promise.allSettled([
      getCanvasModules(courseId),
      getCanvasGrades(),
    ])

    if (modulesResult.status === 'fulfilled') {
      setModules(modulesResult.value)
      setModulesError(null)
    } else {
      setModulesError(
        modulesResult.reason instanceof Error
          ? modulesResult.reason.message
          : 'Failed to load modules.',
      )
      setModules(null)
    }

    if (gradesResult.status === 'fulfilled') {
      const conn = gradesResult.value[connectionId] ?? null
      setConnectionData(conn)
      if (conn?.error === 'TOKEN_EXPIRED') {
        setGradesErrorType('TOKEN_EXPIRED')
        setGradesError(null)
      } else if (conn?.error === 'FETCH_FAILED') {
        setGradesErrorType('FETCH_FAILED')
        setGradesError(null)
      } else {
        setGradesErrorType(null)
        setGradesError(null)
      }
    } else {
      setGradesError(
        gradesResult.reason instanceof Error
          ? gradesResult.reason.message
          : 'Failed to load grades.',
      )
      setGradesErrorType(null)
      setConnectionData(null)
    }

    setIsLoading(false)
    setIsRefreshing(false)
  }, [courseId, connectionId])

  useEffect(() => {
    void load()
  }, [load])

  const course = useMemo<CanvasCourseWithAssignments | null>(() => {
    if (connectionData === null) return null
    return connectionData.courses.find(c => c.id === courseId) ?? null
  }, [connectionData, courseId])

  return (
    <View style={styles.container}>
      <ScreenHeader title={courseName} />
      <SegmentedControl activeTab={activeTab} onSelect={setActiveTab} />
      {isLoading ? (
        <TabContentSkeleton />
      ) : (
        <View style={styles.tabContent}>
          {activeTab === 'Modules' && (
            <ModulesTab
              modules={modules}
              isLoading={false}
              error={modulesError}
              onRetry={() => void load()}
            />
          )}
          {activeTab === 'Assignments' && (
            <AssignmentsTab
              course={course}
              isLoading={false}
              error={gradesError}
              errorType={gradesErrorType}
              onRetry={() => void load()}
            />
          )}
          {activeTab === 'Grades' && (
            <GradesTab
              course={course}
              isLoading={false}
              error={gradesError}
              errorType={gradesErrorType}
              onRetry={() => void load()}
            />
          )}
        </View>
      )}

      {/* Pull-to-refresh on the outer view when fully loaded */}
      {!isLoading && isRefreshing && (
        <View style={styles.refreshOverlay}>
          <Text variant="caption" color={colors.textMuted}>Refreshing...</Text>
        </View>
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
  // Segmented control
  segmentedControl: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  segmentBtnTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  tabContent: {
    flex: 1,
  },
  // States
  tabCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  stateTitle: {
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  stateMessage: {
    textAlign: 'center',
    marginBottom: 24,
  },
  skeletonRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 20,
  },
  // Module rows
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  moduleIconWrap: {
    marginRight: 14,
    marginTop: 2,
    flexShrink: 0,
  },
  moduleInfo: {
    flex: 1,
  },
  moduleName: {
    marginBottom: 4,
  },
  // Assignment rows
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  assignmentLeft: {
    flex: 1,
    marginRight: 12,
  },
  assignmentName: {
    flexShrink: 1,
  },
  assignmentBadges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  assignmentRight: {
    alignItems: 'flex-end',
    minWidth: 56,
  },
  // Grades tab
  gradeHero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  gradeHeroBadge: {
    width: 72,
    height: 72,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeHeroBadgeText: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 12,
  },
  gradeScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  gradeAssignmentName: {
    flex: 1,
    marginRight: 12,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  gradeScoreRight: {
    alignItems: 'flex-end',
  },
  gradeScoreText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  gradeScoreMissingLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.error,
    lineHeight: 13,
    marginTop: 1,
  },
  refreshOverlay: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
})
