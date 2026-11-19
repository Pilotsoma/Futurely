import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { Feather } from '@expo/vector-icons'
import Svg, { RadialGradient, Defs, Rect, Stop } from 'react-native-svg'
import { useAuth } from '../context/AuthContext'
import { useAIContext } from '../components/ai/AIContext'
import * as studentsApi from '../api/studentsApi'
import * as gradesApi from '../api/gradesApi'
import { toUserMessage } from '../utils/errorMessage'
import { Screen, FLOATING_TAB_CLEARANCE } from '../components/ui/Screen'
import { InlineGpaStat } from '../components/ui/InlineGpaStat'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'
import { ErrorRetryBlock } from '../components/ui/ErrorRetryBlock'
import { useCountUp } from '../hooks/useCountUp'
import { useDisplayPreferences } from '../preferences/displayPreferences'
import {
  formatAssignmentDueTime,
  formatPriorityLabel,
  getAssignmentDestination,
} from '../features/assignments/dueToday'
import { buildAlerts, groupDueAssignments } from '../features/today/todayModel'
import {
  loadGpaHistory,
  recordGpaReading,
  type GpaReading,
} from '../features/today/gpaHistory'
import { toFiniteNumber } from '../features/grades/academicSummary'
import type { StudentMe } from '../types/student'
import type { Assignment } from '../types/assignments'
import type { CurrentGradeCourse, GpaSummary } from '../types/grades'
import { getCache, lastUpdatedLabel, setCache } from '../utils/offlineCache'
import type { MainTabParamList } from '../navigation/MainNavigator'
import { colors, fonts, radii, spacing, typography } from '../theme/tokens'

type Nav = BottomTabNavigationProp<MainTabParamList>

function getTimeOfDay(): string {
  const hour = new Date().getHours()
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

interface DashboardCache {
  student: StudentMe
  gpa: GpaSummary | null
  courses: CurrentGradeCourse[]
}

export default function DashboardScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>()
  const { user } = useAuth()
  const { hideGpa } = useDisplayPreferences()
  const { height } = useWindowDimensions()
  useAIContext('Today', 'Look at what is due and my grades. What should I focus on today?')
  const compact = height < 810
  const veryCompact = height < 710

  const [student, setStudent] = useState<StudentMe | null>(null)
  const [gpa, setGpa] = useState<GpaSummary | null>(null)
  const [courses, setCourses] = useState<CurrentGradeCourse[]>([])
  const [gpaError, setGpaError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [gpaHistory, setGpaHistory] = useState<GpaReading[]>([])
  const userId = user?.id
  const hasCache = useRef(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    if (userId === undefined) return
    void getCache<DashboardCache>(userId, 'dashboard').then((entry) => {
      if (!entry || hasCache.current) return
      hasCache.current = true
      setStudent(entry.data.student)
      setGpa(entry.data.gpa)
      setCourses(entry.data.courses)
      setSavedAt(entry.savedAt)
      setLoading(false)
    })
  }, [userId])

  const load = useCallback(async () => {
    setError(null)
    setGpaError(null)

    const [studentResult, gpaResult, coursesResult] = await Promise.allSettled([
      studentsApi.getMe(),
      gradesApi.getGpa(),
      gradesApi.getCurrentGrades(),
    ])

    if (
      userId !== undefined &&
      studentResult.status === 'fulfilled' &&
      gpaResult.status === 'fulfilled' &&
      coursesResult.status === 'fulfilled'
    ) {
      hasCache.current = true
      setSavedAt(new Date().toISOString())
      void setCache<DashboardCache>(userId, 'dashboard', {
        student: studentResult.value,
        gpa: gpaResult.value,
        courses: coursesResult.value.grades,
      })
    }

    if (studentResult.status === 'fulfilled') {
      setStudent(studentResult.value)
    } else if (!hasCache.current) {
      setError(toUserMessage(studentResult.reason, 'Could not load your dashboard.'))
    }

    if (gpaResult.status === 'fulfilled') {
      setGpa(gpaResult.value)
      const currentGpa = toFiniteNumber(gpaResult.value?.weightedGpa ?? gpaResult.value?.gpa)
      if (userId !== undefined && currentGpa !== null) {
        void recordGpaReading(userId, currentGpa).then(setGpaHistory)
      }
    } else if (!hasCache.current) {
      setGpa(null)
      setGpaError(toUserMessage(gpaResult.reason, 'Your GPA could not be loaded.'))
      if (userId !== undefined) void loadGpaHistory(userId).then(setGpaHistory)
    }

    if (coursesResult.status === 'fulfilled') {
      setCourses(coursesResult.value.grades)
    } else if (!hasCache.current) {
      setCourses([])
    }

    setLoading(false)
  }, [userId])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  async function handleResync(): Promise<void> {
    setSyncing(true)
    setGpaError(null)

    try {
      await gradesApi.syncProfile()
      await load()
    } catch (err) {
      setGpaError(toUserMessage(err, 'Sync failed. Please try again.'))
    } finally {
      setSyncing(false)
    }
  }

  function handleAskAI(): void {
    const prompt = aiPrompt.trim()
    navigation.navigate(
      'AIChat',
      prompt ? { initialPrompt: prompt, requestId: Date.now() } : undefined,
    )
    setAiPrompt('')
  }

  const dueGroups = useMemo(
    () => groupDueAssignments(student?.assignments ?? [], new Date()),
    [student],
  )
  const dueToday: Assignment[] = dueGroups.today
  const alerts = useMemo(
    () => buildAlerts(student?.assignments ?? [], courses, new Date()),
    [student, courses],
  )

  const animCourses = useCountUp(student?.stats.totalCourses ?? 0)
  const animDueToday = useCountUp(dueToday.length)
  const animPending = useCountUp(student?.stats.pendingAssignments ?? 0)

  if (loading) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <LoadingSkeleton rows={4} />
      </Screen>
    )
  }

  if (error && !student) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <ErrorRetryBlock
          message={error}
          onRetry={() => {
            setLoading(true)
            void load()
          }}
        />
      </Screen>
    )
  }

  const displayName = (student?.name ?? user?.name ?? 'Student').split(' ')[0]
  const trendValues = gpaHistory.map((reading) => reading.gpa)

  function renderAssignmentRow(assignment: Assignment, keyPrefix: string, fallbackBadge: string) {
    const destination = getAssignmentDestination(assignment.id)
    const priority = assignment.priority?.trim()
    const source = assignment.source?.trim()
    const isHigh = priority?.toUpperCase() === 'HIGH'
    const chipLabel = formatPriorityLabel(priority) ?? fallbackBadge

    return (
      <Pressable
        key={assignment.id}
        testID={`dashboard-${keyPrefix}-tile-${assignment.id}`}
        accessibilityRole="button"
        accessibilityHint={
          destination
            ? `Open ${assignment.title} in Planner`
            : 'This assignment has no valid destination'
        }
        disabled={destination === null}
        onPress={() => {
          if (destination) navigation.navigate('Planner', destination)
        }}
        style={({ pressed }) => [styles.assignmentRow, pressed && styles.assignmentRowPressed]}
      >
        {/* Icon tile */}
        <View style={[styles.assignmentIcon, { backgroundColor: isHigh ? 'rgba(255,119,122,0.14)' : 'rgba(245,158,11,0.13)' }]}>
          <Feather name="clipboard" size={15} color={isHigh ? '#FF777A' : '#FFC547'} />
        </View>
        {/* Copy */}
        <View style={styles.assignmentCopy}>
          <Text style={styles.assignmentTitle} numberOfLines={1}>{assignment.title}</Text>
          <Text style={styles.assignmentMeta} numberOfLines={1}>
            {assignment.subject ? `${assignment.subject} · ` : ''}{`Due ${formatAssignmentDueTime(assignment)}`}{source ? ` · ${source}` : ''}
          </Text>
        </View>
        {/* Priority chip */}
        <View style={[styles.priorityChip, { backgroundColor: isHigh ? 'rgba(255,119,122,0.14)' : 'rgba(245,158,11,0.13)' }]}>
          <Text style={[styles.priorityChipText, { color: isHigh ? '#FF777A' : '#FFC547' }]} numberOfLines={1}>{chipLabel}</Text>
        </View>
        <Feather name="chevron-right" size={15} color={colors.textMuted} />
      </Pressable>
    )
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View pointerEvents="none" style={styles.decorativeLayer}>
        <View style={styles.glowOrbTop} />
        <View style={styles.glowOrbLeft} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.page,
          compact && styles.pageCompact,
          veryCompact && styles.pageVeryCompact,
        ]}
      >
        {/* ── Greeting header ── */}
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.greetingLine}>Good {getTimeOfDay()},</Text>
            <Text style={[styles.greetingName, compact && styles.greetingNameCompact]}>
              {displayName}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <View style={styles.dateChip}>
              <Feather name="calendar" size={12} color="#7AB4FF" />
              <Text style={styles.dateChipText} numberOfLines={1}>
                {formatDate()}
              </Text>
            </View>
            <View style={styles.headerButtons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Settings"
                onPress={() => navigation.navigate('Settings')}
                style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}
                testID="dashboard-settings-button"
              >
                <Feather name="settings" size={17} color="#B9C6DD" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Needs attention alerts ── */}
        {alerts.visible.length > 0 ? (
          <View style={styles.alertsSection} testID="dashboard-alerts">
            <Text style={styles.alertsLabel}>Needs attention</Text>
            {alerts.visible.map((alert) => (
              <Pressable
                key={alert.key}
                accessibilityRole="button"
                accessibilityLabel={`${alert.title}. ${alert.detail}`}
                style={({ pressed }) => [styles.alertRow, pressed && styles.pressed]}
                onPress={() => {
                  if (alert.kind === 'assignment') {
                    const destination = getAssignmentDestination(alert.assignmentId)
                    if (destination) navigation.navigate('Planner', destination)
                  } else {
                    navigation.navigate('Grades')
                  }
                }}
              >
                <Feather
                  name={alert.kind === 'assignment' ? 'alert-circle' : 'trending-down'}
                  size={16}
                  color="#FF777A"
                />
                <View style={styles.alertCopy}>
                  <Text style={styles.alertTitle} numberOfLines={1}>
                    {alert.title}
                  </Text>
                  <Text style={styles.alertDetail}>{alert.detail}</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#697892" />
              </Pressable>
            ))}
            {alerts.hiddenCount > 0 ? (
              <Text style={styles.alertMore}>+{alerts.hiddenCount} more</Text>
            ) : null}
          </View>
        ) : null}

        {/* ── GPA hero card ── */}
        <View style={styles.gpaHero} testID="dashboard-gpa-card-container">
          {/* Subtle radial glow behind the numbers */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Defs>
                <RadialGradient id="glow" cx="30%" cy="50%" r="60%">
                  <Stop offset="0%" stopColor="#2979FF" stopOpacity="0.13" />
                  <Stop offset="100%" stopColor="#2979FF" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
            </Svg>
          </View>
          {/* Top highlight */}
          <View style={styles.topHighlight} pointerEvents="none" />

          {/* Header: "GPA" label + Simulate pill */}
          <View style={styles.gpaHeroHeader}>
            <Text style={styles.gpaHeroLabel}>GPA</Text>
            <Pressable
              onPress={() => navigation.navigate('Grades', { screen: 'GpaSimulator' })}
              accessibilityRole="button"
              accessibilityLabel="Simulate GPA"
              hitSlop={8}
              style={({ pressed }) => [styles.simulatePill, pressed && styles.simulatePillPressed]}
            >
              <Text style={styles.simulatePillText}>Simulate</Text>
              <Feather name="chevron-right" size={12} color={colors.violetText} />
            </Pressable>
          </View>

          {gpaError ? (
            <Text style={styles.gpaInlineError}>{gpaError}</Text>
          ) : null}

          <InlineGpaStat
            unweighted={gpa?.unweightedGpa ?? gpa?.gpa ?? null}
            weighted={gpa?.weightedGpa ?? null}
            hidden={hideGpa}
            sparklineValues={trendValues}
            testID="dashboard-gpa-card"
          />

          {/* Footer: sync status */}
          <View style={styles.gpaHeroFooter}>
            <Text style={styles.gpaHeroSync} numberOfLines={1}>
              {syncing ? 'Syncing…' : lastUpdatedLabel(savedAt) ?? 'Synced just now'}
            </Text>
            <Pressable
              onPress={() => void handleResync()}
              accessibilityRole="button"
              accessibilityLabel="Re-sync grades"
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              style={({ pressed }) => [styles.resyncBtn, pressed && { opacity: 0.65 }]}
              disabled={syncing}
            >
              <Text style={styles.resyncBtnText}>{syncing ? '…' : 'Re-sync'}</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Stats row ── */}
        <View style={[styles.statsRow, compact && styles.statsRowCompact]}>
          <Pressable
            style={({ pressed }) => [
              styles.statCard,
              compact && styles.statCardCompact,
              pressed && styles.statPressed,
            ]}
            onPress={() => navigation.navigate('Grades')}
          >
            <View style={styles.topHighlight} />
            <View style={[styles.statIcon, { backgroundColor: 'rgba(59, 130, 246, 0.14)' }]}>
              <Feather name="book-open" size={16} color="#65A5FF" />
            </View>
            <Text style={styles.statValue}>{animCourses}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>Courses</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.statCard,
              compact && styles.statCardCompact,
              pressed && styles.statPressed,
            ]}
            onPress={() => navigation.navigate('Planner')}
          >
            <View style={styles.topHighlight} />
            <View style={[styles.statIcon, { backgroundColor: colors.violetDim }]}>
              <Feather name="clock" size={16} color={colors.violetText} />
            </View>
            <Text style={styles.statValue}>{animDueToday}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>Due today</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.statCard,
              compact && styles.statCardCompact,
              pressed && styles.statPressed,
            ]}
            onPress={() => navigation.navigate('Planner')}
          >
            <View style={styles.topHighlight} />
            <View style={[styles.statIcon, { backgroundColor: 'rgba(245, 158, 11, 0.14)' }]}>
              <Feather name="inbox" size={16} color="#F6AE2D" />
            </View>
            <Text style={styles.statValue}>{animPending}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>To do</Text>
          </Pressable>
        </View>

        {/* ── Due today ── */}
        <View style={styles.dueSectionHeader}>
          <Text style={styles.dueSectionLabel}>Due today</Text>
        </View>
        {dueToday.length === 0 ? (
          <View style={styles.clearRow} testID="dashboard-due-empty">
            <Feather name="check-circle" size={16} color="#20D3A0" />
            <Text style={styles.clearRowText}>All clear, nothing due today</Text>
          </View>
        ) : (
          <View style={styles.assignmentList} testID="dashboard-due-today">
            {dueToday.map((a, idx) => (
              <React.Fragment key={a.id}>
                {renderAssignmentRow(a, 'due', 'Due today')}
                {idx < dueToday.length - 1 ? <View style={styles.rowDivider} /> : null}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* ── Due tomorrow ── */}
        <View style={styles.dueSectionHeader}>
          <Text style={styles.dueSectionLabel}>Due tomorrow</Text>
        </View>
        {dueGroups.tomorrow.length === 0 ? (
          <View style={styles.clearRow} testID="dashboard-tomorrow-empty">
            <Feather name="check-circle" size={16} color="#20D3A0" />
            <Text style={styles.clearRowText}>Nothing due tomorrow</Text>
          </View>
        ) : (
          <View style={styles.assignmentList} testID="dashboard-due-tomorrow">
            {dueGroups.tomorrow.map((a, idx) => (
              <React.Fragment key={a.id}>
                {renderAssignmentRow(a, 'tomorrow', 'Due tomorrow')}
                {idx < dueGroups.tomorrow.length - 1 ? <View style={styles.rowDivider} /> : null}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* ── AI composer ── */}
        <View style={styles.aiSection}>
          <View style={[styles.aiComposer, compact && styles.aiComposerCompact]}>
            <View style={styles.aiAvatar}>
              <Feather name="message-circle" size={18} color="#FFFFFF" />
            </View>
            <TextInput
              value={aiPrompt}
              onChangeText={setAiPrompt}
              placeholder="Ask about your grades or your week"
              placeholderTextColor={colors.textMuted}
              style={styles.aiInput}
              returnKeyType="send"
              onSubmitEditing={handleAskAI}
              accessibilityLabel="Ask about your grades or your week"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send question to myFuturely AI"
              onPress={handleAskAI}
              style={({ pressed }) => [styles.sendButton, pressed && styles.sendButtonPressed]}
            >
              <Feather name="send" size={17} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.inlineError}>{error}</Text> : null}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    width: '100%',
    gap: 12,
    paddingTop: spacing.md,
    // The AI FAB is hidden on this screen, so only the tab bar needs clearing.
    paddingBottom: FLOATING_TAB_CLEARANCE + spacing.md,
  },
  pageCompact: {
    gap: 10,
  },
  pageVeryCompact: {
    gap: 8,
  },
  decorativeLayer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  glowOrbTop: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(122, 92, 255, 0.13)',
    top: -142,
    right: -118,
  },
  glowOrbLeft: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(41, 121, 255, 0.09)',
    top: 340,
    left: -145,
  },
  headerRow: {
    minHeight: 76,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
  },
  greetingLine: {
    ...typography.body,
    color: '#8FB5EA',
    fontSize: 14,
  },
  greetingName: {
    color: '#F3F6FF',
    fontFamily: fonts.jakartaBold,
    fontWeight: '700',
    fontSize: 31,
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  greetingNameCompact: {
    fontSize: 28,
    lineHeight: 32,
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 6,
    maxWidth: '54%',
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(19, 37, 64, 0.90)',
    borderWidth: 1,
    borderColor: 'rgba(47, 112, 203, 0.36)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  dateChipText: {
    ...typography.bodySm,
    color: '#7AB4FF',
    flexShrink: 1,
    fontSize: 11,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  alertsSection: {
    width: '100%',
    gap: 8,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(40, 20, 28, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 119, 122, 0.22)',
  },
  alertsLabel: {
    ...typography.sectionLabel,
    color: '#FF9C9E',
    fontSize: 13,
  },
  alertRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertCopy: {
    flex: 1,
  },
  alertTitle: {
    ...typography.bodyMd,
    color: '#EDF3FF',
    fontSize: 13,
  },
  alertDetail: {
    ...typography.bodySm,
    color: '#FF9C9E',
    fontSize: 11,
  },
  alertMore: {
    ...typography.bodySm,
    color: '#8299BA',
    fontSize: 11,
  },
  // ── GPA hero card ──
  gpaHero: {
    width: '100%',
    borderRadius: radii.xxl,
    backgroundColor: colors.surface1,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.20,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  gpaHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gpaHeroLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  simulatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: colors.violetDim,
    minHeight: 28,
  },
  simulatePillPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  simulatePillText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    color: colors.violetText,
  },
  gpaInlineError: {
    ...typography.bodySm,
    color: colors.error,
    fontSize: 11,
  },
  gpaHeroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  gpaHeroSync: {
    flex: 1,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  resyncBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.055)',
  },
  resyncBtnText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.cardHighlight,
  },
  // ── Stats row ──
  statsRow: {
    width: '100%',
    minHeight: 98,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  statsRowCompact: {
    minHeight: 88,
  },
  statCard: {
    width: '31.5%',
    minHeight: 98,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 10,
    borderRadius: 17,
    backgroundColor: colors.surface1,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: 'hidden',
  },
  statCardCompact: {
    minHeight: 88,
    paddingVertical: 8,
  },
  statIcon: {
    width: 33,
    height: 33,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    ...typography.numericMd,
    color: '#F4F7FF',
  },
  statLabel: {
    ...typography.bodySm,
    color: '#95A3B9',
    textAlign: 'center',
    fontSize: 12,
  },
  statPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.975 }],
  },
  // ── Due sections ──
  dueSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 24,
    marginBottom: -4,
  },
  dueSectionLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  assignmentList: {
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
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 11,
  },
  assignmentRowPressed: {
    backgroundColor: colors.surface2,
    opacity: 0.9,
  },
  assignmentIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  assignmentCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  assignmentTitle: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 18,
  },
  assignmentMeta: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  priorityChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  priorityChipText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    lineHeight: 15,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    marginLeft: 14 + 34 + 11, // paddingLeft + iconWidth + gap
  },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  clearRowText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  // ── AI composer ──
  aiSection: {
    width: '100%',
    gap: 5,
  },
  aiComposer: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 7,
    borderRadius: 19,
    backgroundColor: 'rgba(20, 38, 64, 0.98)',
    borderWidth: 1,
    borderColor: 'rgba(87, 129, 189, 0.34)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  aiComposerCompact: {
    minHeight: 52,
    padding: 6,
  },
  aiAvatar: {
    width: 39,
    height: 39,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6347F5',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.13)',
  },
  aiInput: {
    flex: 1,
    minHeight: 40,
    color: '#F4F6FC',
    fontSize: 13,
    paddingHorizontal: 3,
    paddingVertical: 0,
  },
  sendButton: {
    width: 39,
    height: 39,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2769CF',
    borderWidth: 1,
    borderColor: 'rgba(116, 173, 255, 0.30)',
  },
  sendButtonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  pressed: {
    opacity: 0.80,
    transform: [{ scale: 0.987 }],
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 27, 47, 0.84)',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },

  inlineError: {
    ...typography.bodySm,
    color: colors.error,
    textAlign: 'center',
    fontSize: 11,
  },
})
