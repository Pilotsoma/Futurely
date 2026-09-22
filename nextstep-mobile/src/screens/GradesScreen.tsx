import React, { useCallback, useState } from 'react'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { Feather } from '@expo/vector-icons'

import * as gradesApi from '../api/gradesApi'
import { ApiRequestError } from '../api/client'
import { Screen } from '../components/ui/Screen'
import { Card } from '../components/ui/Card'
import { LoadingSkeleton } from '../components/ui/Skeleton'
import { ActionTile } from '../components/ui/ActionTile'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { GradeBadge } from '../components/ui/GradeBadge'
import { GpaOverviewCard } from '../components/grades/GpaOverviewCard'
import type { CurrentGradeCourse, GpaSummary, PortalStatus } from '../types/grades'
import type { GradesStackParamList } from '../navigation/GradesNavigator'
import type { MainTabParamList } from '../navigation/MainNavigator'
import type { MainStackParamList } from '../navigation/MainStack'
import {
  colors,
  fonts,
  getSubjectColor,
  radii,
  spacing,
  typography,
} from '../theme/tokens'

type Nav = NativeStackNavigationProp<GradesStackParamList>
type FeatherName = React.ComponentProps<typeof Feather>['name']

// ---------------------------------------------------------------------------
// Academic tools config (unchanged)
// ---------------------------------------------------------------------------

interface AcademicTool {
  label: string
  description: string
  route: string
  icon: FeatherName
  color: string
  iconBackground: string
}

const ACADEMIC_TOOLS: AcademicTool[] = [
  {
    label: 'Classwork',
    description: 'Assignments and current averages',
    route: 'Classwork',
    icon: 'bar-chart-2',
    color: '#36D5A5',
    iconBackground: 'rgba(16,185,129,0.14)',
  },
  {
    label: 'Report Card',
    description: 'Official grades by reporting period',
    route: 'ReportCard',
    icon: 'clipboard',
    color: '#6CB6FF',
    iconBackground: 'rgba(59,130,246,0.16)',
  },
  {
    label: 'Schedule',
    description: 'Your classes and periods',
    route: 'Schedule',
    icon: 'clock',
    color: '#FFC547',
    iconBackground: 'rgba(245,158,11,0.15)',
  },
  {
    label: 'What-If',
    description: 'Simulate grade and GPA changes',
    route: 'GpaSimulator',
    icon: 'percent',
    color: '#B49AFF',
    iconBackground: 'rgba(127,34,254,0.18)',
  },
  {
    label: 'Teachers',
    description: 'Quickly contact your teachers',
    route: 'ContactTeachers',
    icon: 'mail',
    color: '#FF9A56',
    iconBackground: 'rgba(249,115,22,0.15)',
  },
  {
    label: 'Progress',
    description: 'Review interim grade reports',
    route: 'ProgressReport',
    icon: 'trending-up',
    color: '#C0A7FF',
    iconBackground: 'rgba(167,139,250,0.16)',
  },
  {
    label: 'Transcript',
    description: 'Credits and GPA history',
    route: 'Transcript',
    icon: 'file-text',
    color: '#8794FF',
    iconBackground: 'rgba(99,102,241,0.16)',
  },
  {
    label: 'Attendance',
    description: 'Absences, tardies and calendar',
    route: 'Attendance',
    icon: 'calendar',
    color: '#FF777A',
    iconBackground: 'rgba(239,68,68,0.15)',
  },
  {
    label: 'Roadmap',
    description: 'Graduation progress and milestones',
    route: 'Roadmap',
    icon: 'flag',
    color: '#5FD0C4',
    iconBackground: 'rgba(16,185,129,0.14)',
  },
]

const ACADEMIC_TOOL_ROWS: AcademicTool[][] = Array.from(
  { length: Math.ceil(ACADEMIC_TOOLS.length / 2) },
  (_, index) => ACADEMIC_TOOLS.slice(index * 2, index * 2 + 2),
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resultMessage(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback
}

function formatLastSynced(isoString: string): string {
  const date = new Date(isoString)
  const minutesAgo = Math.round((Date.now() - date.getTime()) / 60_000)
  if (minutesAgo < 1) return 'Synced just now'
  if (minutesAgo < 60) return `Synced ${minutesAgo}m ago`
  const hoursAgo = Math.round(minutesAgo / 60)
  if (hoursAgo < 24) return `Synced ${hoursAgo}h ago`
  return `Synced ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

// Labels for the GPA type SegmentedControl
const GPA_SEGMENTS = ['Weighted', 'Unweighted'] as const
type GpaSegmentLabel = (typeof GPA_SEGMENTS)[number]

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function GradesScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>()

  // Cross-navigator navigation helper.
  // GradesHub lives inside GradesNavigator (native-stack) → MainTabs (bottom-tab) → MainStack (native-stack).
  // GpaSimulator and Roadmap are no longer registered in GradesNavigator:
  //   • GpaSimulator is a pushed screen in MainStack → two getParent() hops
  //   • Roadmap is a tab in MainTabs → one getParent() hop
  const handleToolPress = useCallback((route: string): void => {
    if (route === 'GpaSimulator') {
      navigation
        .getParent<BottomTabNavigationProp<MainTabParamList>>()
        ?.getParent<NativeStackNavigationProp<MainStackParamList>>()
        ?.navigate('GpaSimulator')
    } else if (route === 'Roadmap') {
      navigation
        .getParent<BottomTabNavigationProp<MainTabParamList>>()
        ?.navigate('Roadmap')
    } else {
      navigation.navigate(route as keyof GradesStackParamList)
    }
  }, [navigation])

  const [courses, setCourses] = useState<CurrentGradeCourse[]>([])
  const [gpa, setGpa] = useState<GpaSummary | null>(null)
  const [portalStatus, setPortalStatus] = useState<PortalStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [gpaError, setGpaError] = useState<string | null>(null)

  // GPA toggle and course accordion state
  const [gpaSegment, setGpaSegment] = useState<GpaSegmentLabel>('Weighted')
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setInlineError(null)
    setGpaError(null)

    const [currentResult, gpaResult, statusResult] = await Promise.allSettled([
      gradesApi.getCurrentGrades(),
      gradesApi.getGpa(),
      gradesApi.getPortalStatus(),
    ])

    if (currentResult.status === 'fulfilled') {
      setCourses(currentResult.value.grades)
    }

    if (gpaResult.status === 'fulfilled') {
      setGpa(gpaResult.value)
    } else {
      setGpa(null)
    }

    if (statusResult.status === 'fulfilled') {
      setPortalStatus(statusResult.value)
    }

    if (currentResult.status === 'rejected') {
      setInlineError(
        resultMessage(currentResult.reason, 'Your course list could not be loaded.'),
      )
    }
    if (gpaResult.status === 'rejected') {
      setGpaError(resultMessage(gpaResult.reason, 'Your GPA could not be loaded.'))
    }

    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }, [load])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    setInlineError(null)

    try {
      await gradesApi.syncProfile()
      await load()
    } catch (error) {
      setGpaError(resultMessage(error, 'Grade sync failed. Please try again.'))
    } finally {
      setSyncing(false)
    }
  }, [load])

  if (loading) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <LoadingSkeleton rows={5} />
      </Screen>
    )
  }

  // Derived GPA display value
  const highlightedGpa: number | null =
    gpaSegment === 'Weighted'
      ? (gpa?.weightedGpa ?? null)
      : (gpa?.unweightedGpa ?? null)

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.cardFallback}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text allowFontScaling={false} style={styles.eyebrow}>
              ACADEMIC CENTER
            </Text>
            <Text allowFontScaling={false} style={styles.pageTitle}>
              Grades
            </Text>
            <Text allowFontScaling={false} style={styles.pageSubtitle}>
              Your GPA, classes and academic progress in one place.
            </Text>
          </View>
          {/* Last-synced indicator */}
          {portalStatus?.lastSynced ? (
            <View style={styles.syncChip}>
              <Feather name="refresh-cw" size={10} color="#7AB4FF" />
              <Text style={styles.syncChipText}>
                {formatLastSynced(portalStatus.lastSynced)}
              </Text>
            </View>
          ) : null}
        </View>

        <GpaOverviewCard
          summary={gpa}
          courses={courses}
          error={gpaError}
          syncing={syncing}
          onPress={() => handleToolPress('GpaSimulator')}
          onSync={() => void handleSync()}
          testID="grades-gpa-card"
        />

        {/* Weighted / Unweighted GPA toggle */}
        {gpa ? (
          <View style={styles.gpaToggleSection}>
            <SegmentedControl<GpaSegmentLabel>
              segments={GPA_SEGMENTS}
              value={gpaSegment}
              onChange={setGpaSegment}
            />
            {highlightedGpa !== null ? (
              <View style={styles.highlightedGpaRow}>
                <Text style={styles.highlightedGpaValue}>{highlightedGpa.toFixed(2)}</Text>
                <Text style={styles.highlightedGpaLabel}>
                  {gpaSegment === 'Weighted' ? 'Weighted GPA' : 'Unweighted GPA'}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Course list with expandable accordion */}
        {courses.length > 0 ? (
          <View style={styles.courseSection}>
            <View style={styles.courseSectionHeader}>
              <Text style={styles.courseSectionTitle}>COURSE GRADES</Text>
              <Text style={styles.courseSectionCount}>{courses.length} courses</Text>
            </View>
            {courses.map((course) => {
              const isExpanded = expandedCourseId === course.id
              const subjectColor = getSubjectColor(course.name)
              return (
                <View key={course.id}>
                  <Pressable
                    onPress={() =>
                      setExpandedCourseId(isExpanded ? null : course.id)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${course.name}, ${course.letterGrade ?? 'no grade'}${isExpanded ? ', expanded' : ', collapsed'}`}
                    accessibilityState={{ expanded: isExpanded }}
                    style={({ pressed }) => [
                      styles.courseRow,
                      pressed && styles.courseRowPressed,
                    ]}
                  >
                    {/* Subject-colored icon square */}
                    <View
                      style={[styles.subjectIcon, { backgroundColor: subjectColor }]}
                      accessibilityElementsHidden
                    >
                      <Text style={styles.subjectIconLetter}>
                        {course.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    {/* Course info */}
                    <View style={styles.courseInfo}>
                      <Text style={styles.courseName} numberOfLines={1}>{course.name}</Text>
                      <Text style={styles.courseMeta} numberOfLines={1}>
                        {[course.teacher, course.period ? `Period ${course.period}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>

                    {/* Grade badge + chevron */}
                    <View style={styles.courseTrailing}>
                      <GradeBadge letter={course.letterGrade} size="sm" />
                      <Feather
                        name="chevron-right"
                        size={14}
                        color={colors.textFaint}
                        style={isExpanded ? styles.chevronOpen : undefined}
                      />
                    </View>
                  </Pressable>

                  {/* Expanded accordion: assignment breakdown */}
                  {isExpanded && course.assignments.length > 0 ? (
                    <Card style={styles.assignmentsAccordion}>
                      <Text style={styles.assignmentsLabel}>Recent assignments</Text>
                      {course.assignments.map((a, idx) => (
                        <View
                          key={`${course.id}-assignment-${idx}`}
                          style={[
                            styles.assignmentAccordionRow,
                            idx < course.assignments.length - 1 && styles.assignmentAccordionRowBorder,
                          ]}
                        >
                          <View style={styles.assignmentAccordionInfo}>
                            <Text style={styles.assignmentAccordionName} numberOfLines={2}>
                              {a.name}
                            </Text>
                            <Text style={styles.assignmentAccordionCategory}>{a.category}</Text>
                          </View>
                          <Text style={styles.assignmentAccordionScore}>
                            {a.score !== null && a.totalPoints !== null
                              ? `${a.score}/${a.totalPoints}`
                              : a.percentage || '—'}
                          </Text>
                        </View>
                      ))}
                      {course.assignments.length === 0 ? (
                        <Text style={styles.noAssignmentsText}>No assignments recorded.</Text>
                      ) : null}
                    </Card>
                  ) : null}

                  {isExpanded && course.assignments.length === 0 ? (
                    <Card style={styles.assignmentsAccordion}>
                      <Text style={styles.noAssignmentsText}>No assignments recorded for this course.</Text>
                    </Card>
                  ) : null}
                </View>
              )
            })}
          </View>
        ) : null}

        {/* Academic Tools grid (unchanged) */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text allowFontScaling={false} style={styles.sectionEyebrow}>
              ACADEMIC TOOLS
            </Text>
            <Text allowFontScaling={false} style={styles.sectionTitle}>
              Everything you need
            </Text>
            <Text allowFontScaling={false} style={styles.sectionSubtitle}>
              Open your gradebook, reports, schedule and planning tools.
            </Text>
          </View>

          <View style={styles.toolsCountBadge}>
            <Feather name="grid" size={14} color="#A990FF" />
            <Text allowFontScaling={false} style={styles.toolsCountText}>
              {ACADEMIC_TOOLS.length}
            </Text>
          </View>
        </View>

        <View style={styles.toolsGrid}>
          {ACADEMIC_TOOL_ROWS.map((row, rowIndex) => (
            <View key={`academic-tool-row-${rowIndex}`} style={styles.toolRow}>
              {row.map((item) => (
                <ActionTile
                  key={item.route}
                  title={item.label}
                  subtitle={item.description}
                  icon={item.icon}
                  color={item.color}
                  iconBackground={item.iconBackground}
                  onPress={() => handleToolPress(item.route)}
                  accessibilityHint={`Open ${item.description.toLowerCase()}`}
                  testID={`grades-tile-${item.route}`}
                />
              ))}
            </View>
          ))}
        </View>

        {inlineError ? (
          <View style={styles.inlineErrorCard}>
            <Feather name="alert-circle" size={15} color={colors.tierRed} />
            <Text style={styles.inlineErrorText}>{inlineError}</Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 118,
    gap: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: '#7896C2',
    fontFamily: fonts.semiBold,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.35,
  },
  pageTitle: {
    color: '#F7F9FF',
    fontFamily: fonts.bold,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginTop: 2,
  },
  pageSubtitle: {
    color: '#77859A',
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
    maxWidth: 270,
  },
  syncChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(19, 37, 64, 0.90)',
    borderWidth: 1,
    borderColor: 'rgba(47, 112, 203, 0.36)',
    maxWidth: 120,
    flexShrink: 0,
  },
  syncChipText: {
    ...typography.caption,
    color: '#7AB4FF',
    fontSize: 9.5,
    flexShrink: 1,
  },

  // GPA toggle section
  gpaToggleSection: {
    gap: spacing.sm,
  },
  highlightedGpaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  highlightedGpaValue: {
    fontFamily: fonts.displayBold,
    fontSize: 32,
    color: colors.text,
    letterSpacing: -1,
  },
  highlightedGpaLabel: {
    ...typography.caption,
    color: colors.textDim,
    fontFamily: fonts.bodyMedium,
  },

  // Course list
  courseSection: {
    gap: spacing.sm,
  },
  courseSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  courseSectionTitle: {
    ...typography.label,
    color: colors.textDim,
  },
  courseSectionCount: {
    ...typography.caption,
    color: colors.textFaint,
    fontSize: 11,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.ms,
    borderRadius: radii.input,
    backgroundColor: colors.cardFallback,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.xs,
    minHeight: 60,
  },
  courseRowPressed: {
    opacity: 0.82,
  },

  // Subject-colored icon
  subjectIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  subjectIconLetter: {
    fontFamily: fonts.displayBold,
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.95,
  },

  // Course info
  courseInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  courseName: {
    ...typography.h3,
    fontSize: 14,
    color: colors.text,
  },
  courseMeta: {
    ...typography.caption,
    color: colors.textDim,
    fontSize: 11,
  },

  // Course trailing
  courseTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  chevronOpen: { transform: [{ rotate: '90deg' }] },

  // Assignments accordion
  assignmentsAccordion: {
    gap: spacing.xs,
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  assignmentsLabel: {
    ...typography.label,
    color: colors.textFaint,
    marginBottom: spacing.xs,
  },
  assignmentAccordionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  assignmentAccordionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  assignmentAccordionInfo: {
    flex: 1,
    minWidth: 0,
  },
  assignmentAccordionName: {
    ...typography.caption,
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    lineHeight: 16,
  },
  assignmentAccordionCategory: {
    ...typography.caption,
    color: colors.textFaint,
    fontSize: 10,
    marginTop: 1,
  },
  assignmentAccordionScore: {
    ...typography.caption,
    color: colors.textDim,
    fontFamily: fonts.displaySemiBold,
    fontSize: 13,
    flexShrink: 0,
  },
  noAssignmentsText: {
    ...typography.caption,
    color: colors.textFaint,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },

  // Academic tools section (unchanged styles)
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  sectionHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionEyebrow: {
    color: '#6E91C0',
    fontFamily: fonts.semiBold,
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 1.25,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionSubtitle: {
    color: '#708098',
    fontFamily: fonts.regular,
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 2,
    maxWidth: 265,
  },
  toolsCountBadge: {
    minWidth: 48,
    height: 31,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: '#121729',
    borderWidth: 1,
    borderColor: 'rgba(151,119,255,0.24)',
  },
  toolsCountText: {
    color: '#C5B5FF',
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: '700',
  },
  toolsGrid: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 11,
  },
  toolRow: {
    width: '100%',
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 11,
  },
  inlineErrorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: spacing.ms,
    borderRadius: radii.md,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.18)',
  },
  inlineErrorText: {
    flex: 1,
    color: colors.tierRed,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
})
