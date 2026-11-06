import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { useAIContext } from '../components/ai/AIContext'
import * as studentsApi from '../api/studentsApi'
import * as gradesApi from '../api/gradesApi'
import { ApiRequestError } from '../api/client'
import { Screen } from '../components/ui/Screen'
import { GpaOverviewCard } from '../components/grades/GpaOverviewCard'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'
import { ErrorRetryBlock } from '../components/ui/ErrorRetryBlock'
import { useDisplayPreferences } from '../preferences/displayPreferences'
import { GpaSparkline } from '../components/today/GpaSparkline'
import { getAssignmentDestination, splitDueTime } from '../features/assignments/dueToday'
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
import { colors, fonts } from '../theme/tokens'

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
  useAIContext('Today', 'Look at what is due and my grades. What should I focus on today?')

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
      setError(
        studentResult.reason instanceof ApiRequestError
          ? studentResult.reason.message
          : 'Could not load your dashboard.',
      )
    }

    if (gpaResult.status === 'fulfilled') {
      setGpa(gpaResult.value)
      const currentGpa = toFiniteNumber(gpaResult.value?.weightedGpa ?? gpaResult.value?.gpa)
      if (userId !== undefined && currentGpa !== null) {
        void recordGpaReading(userId, currentGpa).then(setGpaHistory)
      }
    } else if (!hasCache.current) {
      setGpa(null)
      setGpaError(
        gpaResult.reason instanceof ApiRequestError
          ? gpaResult.reason.message
          : 'Your GPA could not be loaded.',
      )
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
      setGpaError(err instanceof ApiRequestError ? err.message : 'Sync failed. Please try again.')
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

  if (loading) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <LoadingSkeleton rows={4} />
      </Screen>
    )
  }

  if (error && !student) {
    return (
      <Screen edges={['top', 'left', 'right']}>
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

  const displayName = (student?.name ?? user?.name ?? 'there').split(' ')[0]
  const trendValues = gpaHistory.map((reading) => reading.gpa)
  const updatedLabel = lastUpdatedLabel(savedAt)

  function renderAgenda(list: Assignment[], keyPrefix: string) {
    return (
      <View style={styles.agenda}>
        {list.map((assignment, index) => {
          const destination = getAssignmentDestination(assignment.id)
          const { clock, period } = splitDueTime(assignment)
          const high = assignment.priority?.toUpperCase() === 'HIGH'
          const source = assignment.source?.trim()
          const last = index === list.length - 1

          return (
            <Pressable
              key={assignment.id}
              testID={`dashboard-${keyPrefix}-tile-${assignment.id}`}
              accessibilityRole="button"
              accessibilityHint={destination ? 'Opens it in Planner' : 'This assignment has no valid destination'}
              accessibilityState={{ disabled: destination === null }}
              disabled={destination === null}
              onPress={() => {
                if (destination) navigation.navigate('Planner', destination)
              }}
              style={({ pressed }) => [styles.agendaRow, pressed && styles.pressed]}
            >
              <View style={styles.timeCol}>
                <Text style={styles.clock}>{clock}</Text>
                {period ? <Text style={styles.period}>{period}</Text> : null}
              </View>

              <View style={styles.rail}>
                <View style={[styles.railDot, high && styles.railDotHigh]} />
                {!last ? <View style={styles.railLine} /> : null}
              </View>

              <View style={styles.agendaCopy}>
                <Text style={styles.agendaTitle} numberOfLines={2}>
                  {assignment.title}
                </Text>
                <Text style={styles.agendaMeta} numberOfLines={1}>
                  {assignment.subject || 'No subject'}
                  {source ? `, from ${source}` : ''}
                </Text>
                {high ? <Text style={styles.priority}>High priority</Text> : null}
              </View>

              <Feather name="chevron-right" size={18} color="#555970" />
            </Pressable>
          )
        })}
      </View>
    )
  }

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.date}>{formatDate()}</Text>
            <Text style={styles.greeting} numberOfLines={2}>
              Good {getTimeOfDay()}, {displayName}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => navigation.navigate('Settings')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            testID="dashboard-settings-button"
          >
            <Feather name="settings" size={19} color="#B4B7CC" />
          </Pressable>
        </View>

        {alerts.visible.length > 0 ? (
          <View style={styles.alerts} testID="dashboard-alerts">
            <Text style={styles.alertsTitle}>Needs attention</Text>
            {alerts.visible.map((alert) => (
              <Pressable
                key={alert.key}
                accessibilityRole="button"
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
                  color={colors.error}
                />
                <Text style={styles.alertText} numberOfLines={2}>
                  {alert.title}
                  <Text style={styles.alertDetail}>{`  ${alert.detail}`}</Text>
                </Text>
                <Feather name="chevron-right" size={16} color="#6A5560" />
              </Pressable>
            ))}
            {alerts.hiddenCount > 0 ? (
              <Text style={styles.alertMore}>
                {alerts.hiddenCount} more in Planner and Grades
              </Text>
            ) : null}
          </View>
        ) : null}

        <View testID="dashboard-due-today">
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Due today</Text>
            {dueToday.length > 0 ? <Text style={styles.sectionCount}>{dueToday.length}</Text> : null}
          </View>
          {dueToday.length === 0 ? (
            <View style={styles.clear} testID="dashboard-due-empty">
              <Feather name="check-circle" size={18} color={colors.success} />
              <Text style={styles.clearText}>Nothing due today. You’re caught up.</Text>
            </View>
          ) : (
            renderAgenda(dueToday, 'due')
          )}
        </View>

        <View testID="dashboard-due-tomorrow">
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Tomorrow</Text>
            {dueGroups.tomorrow.length > 0 ? (
              <Text style={styles.sectionCount}>{dueGroups.tomorrow.length}</Text>
            ) : null}
          </View>
          {dueGroups.tomorrow.length === 0 ? (
            <Text style={styles.quiet} testID="dashboard-tomorrow-empty">
              Nothing due tomorrow.
            </Text>
          ) : (
            renderAgenda(dueGroups.tomorrow, 'tomorrow')
          )}
        </View>

        <View style={styles.gpaBlock}>
          <GpaOverviewCard
            summary={gpa}
            courses={courses}
            error={gpaError}
            syncing={syncing}
            hidden={hideGpa}
            onPress={() => navigation.navigate('Grades', { screen: 'GpaSimulator' })}
            onSync={() => void handleResync()}
            testID="dashboard-gpa-card"
          />
          {!hideGpa && trendValues.length >= 2 ? (
            <View style={styles.trend} testID="dashboard-gpa-trend">
              <Text style={styles.trendLabel}>Your GPA over your last {trendValues.length} syncs</Text>
              <GpaSparkline values={trendValues} width={96} height={28} color="#A88BFF" />
            </View>
          ) : null}
        </View>

        <View style={styles.ask}>
          <TextInput
            value={aiPrompt}
            onChangeText={setAiPrompt}
            placeholder="Ask about your day…"
            placeholderTextColor="#6B6E86"
            style={styles.askInput}
            returnKeyType="send"
            onSubmitEditing={handleAskAI}
            accessibilityLabel="Ask myFuturely AI"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send question to myFuturely AI"
            onPress={handleAskAI}
            style={({ pressed }) => [styles.askSend, pressed && styles.pressed]}
          >
            <Feather name="arrow-up" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {updatedLabel ? (
          <Text style={styles.updated} accessibilityLiveRegion="polite">
            {updatedLabel}
          </Text>
        ) : null}
        {error ? <Text style={styles.inlineError}>{error}</Text> : null}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: { paddingTop: 12, paddingBottom: 32, gap: 28 },
  pressed: { opacity: 0.7 },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1, minWidth: 0, gap: 4 },
  date: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 14, fontWeight: '500' },
  greeting: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14162A',
  },

  alerts: {
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 100, 103, 0.08)',
  },
  alertsTitle: { color: '#FF9C9E', fontFamily: fonts.semiBold, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  alertRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  alertText: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 14, lineHeight: 19 },
  alertDetail: { color: '#FF9C9E', fontFamily: fonts.regular, fontSize: 13 },
  alertMore: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 12 },

  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 12 },
  sectionTitle: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 18, fontWeight: '600' },
  sectionCount: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 15, fontVariant: ['tabular-nums'] },

  agenda: { gap: 0 },
  agendaRow: { minHeight: 72, flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  timeCol: { width: 56, alignItems: 'flex-end', paddingTop: 1 },
  clock: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  period: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 11, fontWeight: '500' },
  rail: { width: 12, alignItems: 'center', paddingTop: 7 },
  railDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#8B5CF6' },
  railDotHigh: { backgroundColor: '#F5B83D' },
  railLine: { flex: 1, width: 2, marginTop: 4, marginBottom: -3, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  agendaCopy: { flex: 1, minWidth: 0, gap: 3, paddingBottom: 16 },
  agendaTitle: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 16, lineHeight: 21, fontWeight: '600' },
  agendaMeta: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  priority: { color: '#F5B83D', fontFamily: fonts.medium, fontSize: 12, fontWeight: '500' },

  clear: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 212, 146, 0.08)',
  },
  clearText: { flex: 1, color: '#7FE5C4', fontFamily: fonts.medium, fontSize: 14, fontWeight: '500' },
  quiet: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 14 },

  gpaBlock: { gap: 10 },
  trend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 4 },
  trendLabel: { flex: 1, color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 13 },

  ask: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 18,
    paddingRight: 6,
    borderRadius: 26,
    backgroundColor: '#10121E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  askInput: { flex: 1, minHeight: 44, color: colors.text, fontFamily: fonts.regular, fontSize: 15, paddingVertical: 0 },
  askSend: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },

  updated: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 12, marginTop: -16 },
  inlineError: { color: colors.error, fontFamily: fonts.regular, fontSize: 13 },
})
