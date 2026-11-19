import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAIContext } from '../components/ai/AIContext'
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
import { Feather } from '@expo/vector-icons'

import * as gradesApi from '../api/gradesApi'
import { Screen, SCROLL_BOTTOM_CLEARANCE } from '../components/ui/Screen'
import { ScreenHeader } from '../components/ui/ScreenHeader'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'
import { GpaOverviewCard } from '../components/grades/GpaOverviewCard'
import { ProgressRing } from '../components/ui/ProgressRing'
import { WhatIfPanel } from '../components/grades/WhatIfPanel'
import { parseAssignments } from '../lib/whatIf'
import { useAuth } from '../context/AuthContext'
import { toUserMessage } from '../utils/errorMessage'
import { getCache, lastUpdatedLabel, setCache } from '../utils/offlineCache'
import type { CurrentGradeCourse, GpaSummary } from '../types/grades'
import type { GradesStackParamList } from '../navigation/GradesNavigator'
import { averageToLetter } from '../constants/gradeScale'
import {
  colors,
  fonts,
  gradeColors,
  radii,
  spacing,
  typography,
} from '../theme/tokens'

type Nav = NativeStackNavigationProp<GradesStackParamList>
type FeatherName = React.ComponentProps<typeof Feather>['name']

interface AcademicTool {
  label: string
  description?: string
  route: keyof GradesStackParamList
  icon: FeatherName
  color: string
  iconBackground: string
}

const ACADEMIC_TOOLS: AcademicTool[] = [
  {
    label: 'Classwork',
    description: 'Every assignment and its score',
    route: 'Classwork',
    icon: 'bar-chart-2',
    color: '#36D5A5',
    iconBackground: 'rgba(16,185,129,0.14)',
  },
  {
    label: 'What-If',
    description: 'Simulate grade and GPA changes',
    route: 'GpaSimulator',
    icon: 'percent',
    color: colors.violetText,
    iconBackground: colors.violetDim,
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
    route: 'Schedule',
    icon: 'clock',
    color: '#FFC547',
    iconBackground: 'rgba(245,158,11,0.15)',
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
    label: 'Teachers',
    description: 'Email addresses and rooms',
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
    color: '#5FD3E6',
    iconBackground: 'rgba(0,229,255,0.12)',
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

interface CourseRowProps {
  course: CurrentGradeCourse
  avg: number | null
  letter: string | null
  ringColor: string
}

function CourseRow({ course, avg, letter, ringColor }: CourseRowProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  return (
    <View style={courseRowStyles.card}>
      <View style={courseRowStyles.row}>
        {/* 36pt progress ring */}
        <ProgressRing
          progress={avg ?? 0}
          size={36}
          strokeWidth={3}
          color={ringColor}
          trackColor="rgba(255,255,255,0.08)"
        />

        {/* Name + teacher */}
        <View style={courseRowStyles.copy}>
          <Text style={courseRowStyles.name} numberOfLines={1}>{course.name}</Text>
          {course.teacher ? (
            <Text style={courseRowStyles.teacher} numberOfLines={1}>{course.teacher}</Text>
          ) : null}
        </View>

        {/* Score + letter badge + per-assignment what-if toggle */}
        <View style={courseRowStyles.trailing}>
          {avg !== null ? (
            <Text style={courseRowStyles.score}>{avg}%</Text>
          ) : null}
          {letter ? (
            <View style={[courseRowStyles.letterBadge, { borderColor: `${ringColor}66`, backgroundColor: `${ringColor}18` }]}>
              <Text style={[courseRowStyles.letterText, { color: ringColor }]}>{letter}</Text>
            </View>
          ) : null}
          <Pressable
            onPress={() => setExpanded((v) => !v)}
            hitSlop={8}
            style={({ pressed }) => [courseRowStyles.whatIfPill, pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] }]}
            accessibilityRole="button"
            accessibilityLabel={`Toggle What-If for ${course.name}`}
            accessibilityState={{ expanded }}
          >
            <Text style={courseRowStyles.whatIfPillText}>What-If</Text>
          </Pressable>
        </View>
      </View>

      {expanded ? (
        <View style={courseRowStyles.panelWrap}>
          <WhatIfPanel assignments={parseAssignments(course.assignments)} />
        </View>
      ) : null}
    </View>
  )
}

const courseRowStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  teacher: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  score: {
    ...typography.numeric,
    color: colors.text,
    fontSize: 16,
  },
  letterBadge: {
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  letterText: {
    fontFamily: fonts.jakartaExtraBold,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  whatIfPill: {
    height: 28,
    paddingHorizontal: 9,
    borderRadius: 99,
    backgroundColor: colors.violetDim,
    borderWidth: 1,
    borderColor: 'rgba(122, 92, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatIfPillText: {
    color: colors.violetText,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
  },
  panelWrap: {
    marginTop: 10,
  },
})

export default function GradesScreen(): React.JSX.Element {
  useAIContext('My grades', 'Look at my current grades and tell me which class needs attention first and what I should do this week.')
  const navigation = useNavigation<Nav>()
  const { user } = useAuth()
  const userId = user?.id
  const hasCache = useRef(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const [courses, setCourses] = useState<CurrentGradeCourse[]>([])
  const [gpa, setGpa] = useState<GpaSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [gpaError, setGpaError] = useState<string | null>(null)

  useEffect(() => {
    if (userId === undefined) return
    void getCache<{ courses: CurrentGradeCourse[]; gpa: GpaSummary | null }>(userId, 'grades').then((entry) => {
      if (!entry || hasCache.current) return
      hasCache.current = true
      setCourses(entry.data.courses)
      setGpa(entry.data.gpa)
      setSavedAt(entry.savedAt)
      setLoading(false)
    })
  }, [userId])

  const load = useCallback(async () => {
    setInlineError(null)
    setGpaError(null)

    const [currentResult, gpaResult] = await Promise.allSettled([
      gradesApi.getCurrentGrades(),
      gradesApi.getGpa(),
    ])

    if (currentResult.status === 'fulfilled') {
      setCourses(currentResult.value.grades)
    }

    if (currentResult.status === 'fulfilled' && gpaResult.status === 'fulfilled' && userId !== undefined) {
      hasCache.current = true
      setSavedAt(new Date().toISOString())
      void setCache(userId, 'grades', { courses: currentResult.value.grades, gpa: gpaResult.value })
    }

    if (gpaResult.status === 'fulfilled') {
      setGpa(gpaResult.value)
    } else if (!hasCache.current) {
      setGpa(null)
    }

    if (hasCache.current) {
      // Keep showing cached data instead of an error.
    } else if (currentResult.status === 'rejected') {
      setInlineError(
        toUserMessage(currentResult.reason, 'Your course list could not be loaded.'),
      )
    }
    if (gpaResult.status === 'rejected' && !hasCache.current) {
      setGpaError(toUserMessage(gpaResult.reason, 'Your GPA could not be loaded.'))
    }

    setLoading(false)
  }, [userId])

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
      setGpaError(toUserMessage(error, 'Grade sync failed. Please try again.'))
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

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface2}
          />
        }
      >
        <ScreenHeader variant="root" title="Grades" />

        {lastUpdatedLabel(savedAt) ? (
          <Text allowFontScaling={false} style={styles.cacheLabel} accessibilityLiveRegion="polite">
            {lastUpdatedLabel(savedAt)}
          </Text>
        ) : null}

        {/* ── GPA hero (gradient card stays here) ── */}
        <GpaOverviewCard
          summary={gpa}
          courses={courses}
          error={gpaError}
          syncing={syncing}
          onPress={() => navigation.navigate('GpaSimulator')}
          onSync={() => void handleSync()}
          testID="grades-gpa-card"
        />

        {/* ── Course rows ── */}
        {courses.map((course) => {
          const avg = course.average !== null ? Math.round(course.average) : null
          const letter = avg !== null ? averageToLetter(avg) : null
          const ringColor = letter ? (gradeColors[letter as keyof typeof gradeColors] ?? colors.textSecondary) : colors.textSecondary
          return (
            <CourseRow
              key={course.id}
              course={course}
              avg={avg}
              letter={letter}
              ringColor={ringColor}
            />
          )
        })}

        {/* ── Academic tools - iOS Settings-style grouped list ── */}
        <Text style={styles.toolsSectionLabel}>Academic tools</Text>

        <View style={styles.toolsCard}>
          {ACADEMIC_TOOLS.map((tool, index) => (
            <React.Fragment key={tool.route}>
              <Pressable
                testID={`grades-tile-${tool.route}`}
                accessibilityRole="button"
                onPress={() => navigation.navigate(tool.route)}
                style={({ pressed }) => [styles.toolRow, pressed && styles.toolRowPressed]}
              >
                {/* 32pt coloured icon tile */}
                <View style={[styles.toolIcon, { backgroundColor: tool.iconBackground }]}>
                  <Feather name={tool.icon} size={16} color={tool.color} />
                </View>
                {/* Title + subtitle */}
                <View style={styles.toolCopy}>
                  <Text style={styles.toolLabel} numberOfLines={1}>{tool.label}</Text>
                  {tool.description ? (
                    <Text style={styles.toolDescription} numberOfLines={1}>{tool.description}</Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </Pressable>
              {/* Hairline divider inset past the icon */}
              {index < ACADEMIC_TOOLS.length - 1 ? (
                <View style={styles.toolDivider} />
              ) : null}
            </React.Fragment>
          ))}
        </View>

        {inlineError ? (
          <View style={styles.inlineErrorCard}>
            <Feather name="alert-circle" size={15} color={colors.error} />
            <Text style={styles.inlineErrorText}>{inlineError}</Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

const TOOL_ICON_SIZE = 32
const TOOL_ROW_HEIGHT = 52
const DIVIDER_LEFT_INSET = spacing.screenPadding + TOOL_ICON_SIZE + 12 // paddingLeft + iconWidth + gap

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: SCROLL_BOTTOM_CLEARANCE,
    gap: 14,
  },
  cacheLabel: {
    ...typography.bodySm,
    color: colors.textMuted,
    marginTop: -8,
  },
  toolsSectionLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: -6,
  },
  toolsCard: {
    width: '100%',
    borderRadius: radii.lg,
    backgroundColor: colors.surface1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOOL_ROW_HEIGHT,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 10,
    gap: 12,
  },
  toolRowPressed: {
    backgroundColor: colors.surface2,
  },
  toolIcon: {
    width: TOOL_ICON_SIZE,
    height: TOOL_ICON_SIZE,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  toolCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  toolLabel: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 20,
  },
  toolDescription: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  toolDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.055)',
    marginLeft: DIVIDER_LEFT_INSET,
  },
  inlineErrorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: spacing.ms,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,100,103,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,100,103,0.18)',
  },
  inlineErrorText: {
    flex: 1,
    color: colors.error,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
})
