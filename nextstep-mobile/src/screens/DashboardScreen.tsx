import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Text from '../components/ui/Text'
import Skeleton from '../components/ui/Skeleton'
import Button from '../components/ui/Button'
import { colors } from '../constants/colors'
import { fetchStudentData, type StudentData, type Assignment } from '../api/studentApi'
import {
  getSyncStatus,
  getPortalStatus,
  getPortalGpa,
  type SyncStatus,
  type PortalGpa,
} from '../api/portalApi'
import {
  ArrowRightIcon,
  FlameIcon,
} from '../components/icons'
import type { AppParamList } from '../navigation/AppNavigator'
import type { MainTabParamList } from '../navigation/MainTabNavigator'
import { shadows } from '../constants/shadows'
import { useAuth } from '../context/AuthContext'

// ─── Navigation ───────────────────────────────────────────────────────────────

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<AppParamList>
>

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SUBJECT_PALETTE = [
  colors.purple,
  colors.info,
  colors.warning,
  colors.orange,
  colors.success,
  colors.error,
  colors.lavender,
]

function subjectColor(subject: string): string {
  let hash = 0
  for (const ch of subject) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff
  return SUBJECT_PALETTE[hash % SUBJECT_PALETTE.length] ?? colors.textMuted
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning,'
  if (h < 17) return 'Good afternoon,'
  return 'Good evening,'
}

function formatToday(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function isYesterday(candidate: Date, reference: Date): boolean {
  const prev = new Date(reference)
  prev.setDate(prev.getDate() - 1)
  return isSameDay(candidate, prev)
}

// ─── Streak helpers (mirrors web dashboard logic) ─────────────────────────────

async function computeStreak(uid: number): Promise<number> {
  const streakKey = `ns_streak_${uid}`
  const visitKey = `ns_lastVisit_${uid}`

  const [streakRaw, visitRaw] = await AsyncStorage.multiGet([streakKey, visitKey])
  const storedStreak = parseInt(streakRaw[1] ?? '0', 10) || 0
  const storedVisit = visitRaw[1] ? new Date(visitRaw[1]) : null

  const now = new Date()

  if (storedVisit === null) {
    // First visit ever
    await AsyncStorage.multiSet([[streakKey, '1'], [visitKey, now.toISOString()]])
    return 1
  }

  if (isSameDay(storedVisit, now)) {
    // Already counted today
    return storedStreak
  }

  if (isYesterday(storedVisit, now)) {
    // Consecutive day — extend streak
    const next = storedStreak + 1
    await AsyncStorage.multiSet([[streakKey, String(next)], [visitKey, now.toISOString()]])
    return next
  }

  // Missed a day — reset
  await AsyncStorage.multiSet([[streakKey, '1'], [visitKey, now.toISOString()]])
  return 1
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton(): React.JSX.Element {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} scrollEnabled={false}>
      {/* Header */}
      <Skeleton width={120} height={14} style={{ marginBottom: 6, marginTop: 24 }} />
      <Skeleton width={200} height={28} style={{ marginBottom: 6 }} />
      <Skeleton width={100} height={12} style={{ marginBottom: 16 }} />
      {/* GPA card */}
      <View style={[styles.card, { marginBottom: 0 }]}>
        <Skeleton width="60%" height={11} style={{ marginBottom: 16 }} />
        <Skeleton width="90%" height={44} />
      </View>
      {/* Today card */}
      <View style={[styles.card, { marginTop: 12 }]}>
        <Skeleton width="50%" height={15} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={40} style={{ marginBottom: 8 }} />
        <Skeleton width="100%" height={40} />
      </View>
    </ScrollView>
  )
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }): React.JSX.Element {
  const isAuthError = message.startsWith('401') || message.toLowerCase().includes('unauthorized')
  return (
    <View style={styles.centerState}>
      <Text variant="h3" color={colors.error} style={{ marginBottom: 8, textAlign: 'center' }}>
        Unable to Load Dashboard
      </Text>
      <Text variant="body" color={colors.textSecondary} style={{ marginBottom: 24, textAlign: 'center' }}>
        {isAuthError
          ? 'Sign in to your myFuturely account to view your dashboard.'
          : message}
      </Text>
      <Button label="Try Again" onPress={onRetry} />
    </View>
  )
}

// ─── Sync banner ──────────────────────────────────────────────────────────────

function SyncBanner({ syncStatus }: { syncStatus: SyncStatus | null }): React.JSX.Element | null {
  if (!syncStatus || syncStatus.status === 'complete' || syncStatus.status === 'idle') return null
  if (syncStatus.status === 'syncing') {
    return (
      <View style={styles.syncBanner}>
        <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
        <Text variant="caption" color={colors.primary}>Syncing your grades…</Text>
      </View>
    )
  }
  if (syncStatus.status === 'error') {
    return (
      <View style={[styles.syncBanner, { backgroundColor: colors.error + '18', borderColor: colors.error + '44' }]}>
        <Text variant="caption" color={colors.error}>
          Grade sync failed: {syncStatus.errorMessage ?? 'Unknown error'}
        </Text>
      </View>
    )
  }
  return null
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen(): React.JSX.Element {
  const navigation = useNavigation<NavProp>()
  const { user } = useAuth()

  const [data, setData] = useState<StudentData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [streak, setStreak] = useState(0)
  const [portalGpa, setPortalGpa] = useState<PortalGpa | null>(null)
  const syncPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopSyncPoll = useCallback((): void => {
    if (syncPollRef.current !== null) {
      clearInterval(syncPollRef.current)
      syncPollRef.current = null
    }
  }, [])

  const checkSyncStatus = useCallback(async (): Promise<void> => {
    try {
      const s = await getSyncStatus()
      setSyncStatus(s)
      if (s.status === 'complete' || s.status === 'error' || s.status === 'idle') {
        stopSyncPoll()
        if (s.status === 'complete') {
          const d = await fetchStudentData().catch(() => null)
          if (d) setData(d)
        }
      }
    } catch {
      stopSyncPoll()
    }
  }, [stopSyncPoll])

  const startSyncPoll = useCallback((): void => {
    stopSyncPoll()
    void checkSyncStatus()
    syncPollRef.current = setInterval(() => { void checkSyncStatus() }, 3000)
    setTimeout(stopSyncPoll, 5 * 60 * 1000)
  }, [checkSyncStatus, stopSyncPoll])

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      if (user) {
        void computeStreak(user.id).then(setStreak).catch(() => undefined)
      }
      const [d, status] = await Promise.all([
        fetchStudentData(),
        getPortalStatus().catch((): null => null),
      ])
      setData(d)
      if (status?.connected === true) {
        const pg = await getPortalGpa().catch((): null => null)
        setPortalGpa(pg)
      } else {
        setPortalGpa(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard.')
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    startSyncPoll()
    return stopSyncPoll
  }, [startSyncPoll, stopSyncPoll])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  if (isLoading) return <LoadingSkeleton />
  if (error !== null) return <ErrorScreen message={error} onRetry={() => void load()} />

  const profile = data?.profile ?? null
  const assignments = data?.assignments ?? []
  const stats = data?.stats ?? {
    totalCourses: 0,
    completedAssignments: 0,
    pendingAssignments: 0,
    assignmentsDueToday: 0,
    assignmentsDueThisWeek: 0,
  }

  const now = new Date()
  const dueToday = assignments.filter(a => {
    if (a.completed) return false
    return isSameDay(new Date(a.dueDate), now)
  })

  const firstName = data?.name?.split(' ')[0] ?? 'Student'
  const gradeLevel = profile?.gradeLevel ?? null
  const uGpa = (portalGpa?.unweightedGpa ?? portalGpa?.gpa ?? profile?.unweightedGpa ?? 0).toFixed(2)
  const wGpa = (portalGpa?.weightedGpa ?? portalGpa?.gpa ?? profile?.weightedGpa ?? 0).toFixed(2)
  const courseCount = portalGpa?.courseCount ?? stats.totalCourses

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <SyncBanner syncStatus={syncStatus} />

      {/* Header */}
      <View style={styles.header}>
        <Text variant="body" color={colors.textSecondary}>{greeting()}</Text>
        <Text style={styles.nameText}>{firstName}</Text>
        <Text style={styles.dateText}>{formatToday()}</Text>
        {gradeLevel !== null && (
          <View style={styles.gradeBadge}>
            <Text style={styles.gradeBadgeText}>{ordinal(gradeLevel)} Grade</Text>
          </View>
        )}
      </View>

      {/* GPA Card */}
      <TouchableOpacity
        style={[styles.card, styles.gpaCard]}
        onPress={() => navigation.navigate('MainTabs', { screen: 'Grades' })}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="View grade portal"
      >
        <Text variant="label" color={colors.textSecondary} style={{ marginBottom: 12 }}>
          Current GPA
        </Text>
        <View style={styles.gpaRow}>
          <View style={styles.gpaCol}>
            <Text style={styles.gpaValue}>{uGpa}</Text>
            <Text variant="caption">Unweighted</Text>
          </View>
          <View style={styles.gpaDivider} />
          <View style={styles.gpaCol}>
            <Text style={[styles.gpaValue, { color: colors.primary }]}>{wGpa}</Text>
            <Text variant="caption">Weighted</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Today Card — merges due-today items with a courses/streak summary line */}
      <View style={[styles.card, { marginTop: 12 }]}>
        <View style={styles.cardHeaderRow}>
          <Text variant="h3">Today</Text>
          {dueToday.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{dueToday.length}</Text>
            </View>
          )}
        </View>
        {dueToday.length === 0 ? (
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', paddingVertical: 16 }}>
            Nothing due today!
          </Text>
        ) : (
          dueToday.slice(0, 3).map((a) => <DueTodayRow key={a.id} assignment={a} />)
        )}
        <TouchableOpacity
          style={styles.viewAllRow}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Planner' })}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="View all assignments in Planner"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={styles.viewAllText}>View all</Text>
            <ArrowRightIcon size={12} color={colors.primary} />
          </View>
        </TouchableOpacity>

        <View style={styles.todayFooter}>
          <Text variant="caption" color={colors.textSecondary}>
            {courseCount} {courseCount === 1 ? 'course' : 'courses'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <FlameIcon size={12} color={colors.warning} />
            <Text variant="caption" color={colors.textSecondary}>
              {streak} day{streak === 1 ? '' : 's'} streak
            </Text>
          </View>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DueTodayRow({ assignment }: { assignment: Assignment }): React.JSX.Element {
  return (
    <View style={styles.dueTodayRow}>
      <View style={[styles.dot, { backgroundColor: subjectColor(assignment.subject) }]} />
      <View style={{ flex: 1 }}>
        <Text variant="body">{assignment.title}</Text>
        <Text variant="caption">{assignment.subject}</Text>
      </View>
      <Text variant="caption">{assignment.estimatedMinutes}m</Text>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20 },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '18',
    borderWidth: 1,
    borderColor: colors.primary + '44',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  // Header
  header: { paddingTop: 24, paddingBottom: 16 },
  nameText: { fontSize: 26, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  dateText: { fontSize: 13, color: colors.textMuted, marginBottom: 10 },
  gradeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  gradeBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  // Cards
  card: {
    ...shadows.raised,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  gpaCard: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  gpaRow: { flexDirection: 'row', alignItems: 'center' },
  gpaCol: { flex: 1, alignItems: 'center' },
  gpaValue: { fontSize: 40, fontWeight: '700', color: colors.textPrimary },
  gpaDivider: { width: 1, height: 40, backgroundColor: colors.border },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  countBadge: {
    backgroundColor: colors.error,
    borderRadius: 100,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  viewAllRow: { alignItems: 'flex-end', marginTop: 8 },
  viewAllText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  // Due today
  dueTodayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  // Today card footer — courses count + streak, replaces the old 4-tile stats row
  todayFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
})
