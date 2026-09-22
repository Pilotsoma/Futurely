import React, { useCallback, useMemo, useState } from 'react'
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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import * as studentsApi from '../api/studentsApi'
import * as gradesApi from '../api/gradesApi'
import { ApiRequestError } from '../api/client'
import { Screen } from '../components/ui/Screen'
import { Card } from '../components/ui/Card'
import { ActionTile } from '../components/ui/ActionTile'
import { GradeBadge } from '../components/ui/GradeBadge'
import { GpaOverviewCard } from '../components/grades/GpaOverviewCard'
import { LoadingSkeleton } from '../components/ui/Skeleton'
import { ErrorRetryBlock } from '../components/ui/ErrorRetryBlock'
import { useCountUp } from '../hooks/useCountUp'
import { useDisplayPreferences } from '../preferences/displayPreferences'
import {
  formatAssignmentDueTime,
  getAssignmentDestination,
  getDueTodayAssignments,
} from '../features/assignments/dueToday'
import type { StudentMe } from '../types/student'
import type { Assignment } from '../types/assignments'
import type { CurrentGradeCourse, GpaSummary } from '../types/grades'
import type { MainTabParamList } from '../navigation/MainNavigator'
import type { MainStackParamList } from '../navigation/MainStack'
import { colors, fonts, getSubjectColor, spacing, typography } from '../theme/tokens'

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

export default function DashboardScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>()
  const { user } = useAuth()
  const { hideGpa } = useDisplayPreferences()
  const { height, width } = useWindowDimensions()
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

  const load = useCallback(async () => {
    setError(null)
    setGpaError(null)

    const [studentResult, gpaResult, coursesResult] = await Promise.allSettled([
      studentsApi.getMe(),
      gradesApi.getGpa(),
      gradesApi.getCurrentGrades(),
    ])

    if (studentResult.status === 'fulfilled') {
      setStudent(studentResult.value)
    } else {
      setError(
        studentResult.reason instanceof ApiRequestError
          ? studentResult.reason.message
          : 'Could not load your dashboard.',
      )
    }

    if (gpaResult.status === 'fulfilled') {
      setGpa(gpaResult.value)
    } else {
      setGpa(null)
      setGpaError(
        gpaResult.reason instanceof ApiRequestError
          ? gpaResult.reason.message
          : 'Your GPA could not be loaded.',
      )
    }

    if (coursesResult.status === 'fulfilled') {
      setCourses(coursesResult.value.grades)
    } else {
      setCourses([])
    }

    setLoading(false)
  }, [])

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

  const dueToday: Assignment[] = useMemo(() => {
    return getDueTodayAssignments(student?.assignments ?? [])
  }, [student])

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
  const displayInitial = displayName.charAt(0).toUpperCase()
  const dueItemsPerRow = width >= 700 ? 2 : 1
  const dueRows = Array.from(
    { length: Math.ceil(dueToday.length / dueItemsPerRow) },
    (_, index) => dueToday.slice(index * dueItemsPerRow, index * dueItemsPerRow + dueItemsPerRow),
  )

  // Recent-grade pills: courses that have a letter grade (capped at 6)
  const gradedCourses = courses.filter((c) => c.letterGrade !== null).slice(0, 6)

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View pointerEvents="none" style={styles.decorativeLayer}>
        <View style={styles.glowOrbTop} />
        <View style={styles.glowOrbLeft} />
        <View style={styles.decorativeDotOne} />
        <View style={styles.decorativeDotTwo} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.page,
          compact && styles.pageCompact,
          veryCompact && styles.pageVeryCompact,
        ]}
      >
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.greetingLine}>Good {getTimeOfDay()},</Text>
            <Text style={[styles.greetingName, compact && styles.greetingNameCompact]}>
              {displayName}
            </Text>
            {!veryCompact ? (
              <Text style={styles.headerSubtitle}>Your academic command center</Text>
            ) : null}
          </View>

          <View style={styles.headerActions}>
            <View style={styles.dateChip}>
              <Feather name="calendar" size={12} color="#7AB4FF" />
              <Text style={styles.dateChipText} numberOfLines={1}>
                {formatDate()}
              </Text>
            </View>
            {/* Avatar button — navigates to Settings */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              onPress={() =>
                navigation
                  .getParent<NativeStackNavigationProp<MainStackParamList>>()
                  ?.navigate('Settings')
              }
              style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
            >
              <Text style={styles.avatarInitial}>{displayInitial}</Text>
            </Pressable>
          </View>
        </View>

        <GpaOverviewCard
          summary={gpa}
          courses={courses}
          error={gpaError}
          syncing={syncing}
          hidden={hideGpa}
          onPress={() =>
            navigation
              .getParent<NativeStackNavigationProp<MainStackParamList>>()
              ?.navigate('GpaSimulator')
          }
          onSync={() => void handleResync()}
          testID="dashboard-gpa-card"
        />

        {/* Recent grade pills — only shown when at least one graded course exists */}
        {gradedCourses.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gradePillsRow}
            accessibilityLabel="Recent grade overview"
          >
            {gradedCourses.map((course) => {
              const subjectColor = getSubjectColor(course.name)
              return (
                <Pressable
                  key={course.id}
                  style={({ pressed }) => [styles.gradePill, pressed && styles.pressed]}
                  onPress={() => navigation.navigate('Grades')}
                  accessibilityRole="button"
                  accessibilityLabel={`${course.name}: ${course.letterGrade ?? 'no grade'}`}
                >
                  <View style={[styles.pillDot, { backgroundColor: subjectColor }]} />
                  <Text style={styles.pillName} numberOfLines={1}>
                    {course.name.length > 13 ? course.name.slice(0, 12) + '…' : course.name}
                  </Text>
                  <GradeBadge letter={course.letterGrade} size="sm" />
                </Pressable>
              )
            })}
          </ScrollView>
        ) : null}

        {/* Due today — glass Card */}
        <View testID="dashboard-due-today">
        <Card variant="glass" style={styles.dueCardContent}>
          <View style={styles.dueHeadingRow}>
            <View>
              <Text style={styles.sectionEyebrow}>TODAY</Text>
              <Text style={[styles.cardTitle, compact && styles.cardTitleCompact]}>Due today</Text>
            </View>
            <View style={styles.calendarBadge}>
              <Feather name="calendar" size={17} color="#68A9FF" />
            </View>
          </View>

          {dueToday.length === 0 ? (
            <View style={styles.clearState} testID="dashboard-due-empty">
              <View style={styles.clearIcon}>
                <Feather name="check" size={16} color="#20D3A0" />
              </View>
              <View style={styles.clearTextWrap}>
                <Text style={styles.clearTitle}>All clear for today</Text>
                {!veryCompact ? (
                  <Text style={styles.clearSubtitle}>You are fully caught up.</Text>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.dueGrid}>
              {dueRows.map((row, rowIndex) => (
                <View key={`due-row-${rowIndex}`} style={styles.dueTileRow}>
                  {row.map((assignment) => {
                    const destination = getAssignmentDestination(assignment.id)
                    const priority = assignment.priority?.trim()
                    const source = assignment.source?.trim()

                    return (
                      <ActionTile
                        key={assignment.id}
                        title={assignment.title}
                        subtitle={assignment.subject || 'No subject'}
                        meta={`Due ${formatAssignmentDueTime(assignment)}${source ? ` · ${source}` : ''}`}
                        badge={priority || 'Due today'}
                        icon="clipboard"
                        color={priority?.toUpperCase() === 'HIGH' ? '#FF777A' : '#FFC547'}
                        iconBackground="rgba(245,158,11,0.15)"
                        disabled={destination === null}
                        onPress={() => {
                          if (destination) navigation.navigate('Planner', destination)
                        }}
                        accessibilityHint={
                          destination
                            ? `Open ${assignment.title} in Planner`
                            : 'This assignment has no valid destination'
                        }
                        testID={`dashboard-due-tile-${assignment.id}`}
                      />
                    )
                  })}
                </View>
              ))}
            </View>
          )}
        </Card>
        </View>

        {/* Stats row */}
        <View style={[styles.statsRow, compact && styles.statsRowCompact]}>
          <Pressable
            style={({ pressed }) => [
              styles.statCard,
              compact && styles.statCardCompact,
              pressed && styles.pressed,
            ]}
            onPress={() => navigation.navigate('Grades')}
          >
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
              pressed && styles.pressed,
            ]}
            onPress={() => navigation.navigate('Planner')}
          >
            <View style={[styles.statIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
              <Feather name="clock" size={16} color="#9A77FF" />
            </View>
            <Text style={styles.statValue}>{animDueToday}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>Due today</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.statCard,
              compact && styles.statCardCompact,
              pressed && styles.pressed,
            ]}
            onPress={() => navigation.navigate('Planner')}
          >
            <View style={[styles.statIcon, { backgroundColor: 'rgba(245, 158, 11, 0.14)' }]}>
              <Feather name="inbox" size={16} color="#F6AE2D" />
            </View>
            <Text style={styles.statValue}>{animPending}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>Pending</Text>
          </Pressable>
        </View>

        {/* AI composer */}
        <View style={styles.aiSection}>
          {!veryCompact ? (
            <View style={styles.aiLabelRow}>
              <Text style={styles.sectionEyebrow}>YOUR AI COPILOT</Text>
              <Feather name="zap" size={14} color="#9D82FF" />
            </View>
          ) : null}

          <View style={[styles.aiComposer, compact && styles.aiComposerCompact]}>
            <View pointerEvents="none" style={styles.aiComposerGlow} />
            <View style={styles.aiAvatar}>
              <Feather name="message-circle" size={18} color="#FFFFFF" />
            </View>
            <TextInput
              value={aiPrompt}
              onChangeText={setAiPrompt}
              placeholder="Ask myFuturely AI..."
              placeholderTextColor="#71819A"
              style={styles.aiInput}
              returnKeyType="send"
              onSubmitEditing={handleAskAI}
              accessibilityLabel="Ask myFuturely AI"
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
    gap: 14,
    paddingTop: 8,
    paddingBottom: 118,
  },
  pageCompact: {
    gap: 12,
    paddingTop: 5,
  },
  pageVeryCompact: {
    gap: 10,
    paddingTop: 3,
  },
  decorativeLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glowOrbTop: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(84, 49, 255, 0.10)',
    top: -142,
    right: -118,
  },
  glowOrbLeft: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(0, 150, 255, 0.045)',
    top: 340,
    left: -145,
  },
  decorativeDotOne: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(91, 138, 255, 0.46)',
    top: 104,
    right: 39,
  },
  decorativeDotTwo: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(143, 98, 255, 0.45)',
    top: 130,
    right: 76,
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
    ...typography.display,
    color: '#F3F6FF',
    fontSize: 31,
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  greetingNameCompact: {
    fontSize: 28,
    lineHeight: 32,
  },
  headerSubtitle: {
    ...typography.caption,
    color: '#697892',
    marginTop: 1,
    fontSize: 10,
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
    ...typography.caption,
    color: '#7AB4FF',
    flexShrink: 1,
    fontSize: 10,
  },
  // Avatar button — navigates to Settings
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(76, 124, 255, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(76, 124, 255, 0.50)',
  },
  avatarInitial: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Recent-grade pills
  gradePillsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: 2,
  },
  gradePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(19, 37, 64, 0.90)',
    borderWidth: 1,
    borderColor: 'rgba(72, 100, 139, 0.30)',
    minHeight: 32,
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  pillName: {
    ...typography.caption,
    color: '#B9C6DD',
    fontSize: 11,
    maxWidth: 100,
  },

  // Due today — glass card (style goes to inner content view via Card.style prop)
  dueCardContent: {
    gap: 11,
    padding: 14,
  },
  dueHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionEyebrow: {
    ...typography.label,
    color: '#8299BA',
    letterSpacing: 1.05,
    fontSize: 9,
  },
  cardTitle: {
    ...typography.h2,
    color: '#EDF3FF',
    marginTop: 1,
    fontSize: 19,
  },
  cardTitleCompact: {
    fontSize: 17,
  },
  calendarBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 134, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(77, 149, 255, 0.16)',
  },
  clearState: {
    minHeight: 57,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: 'rgba(7, 31, 36, 0.50)',
    borderWidth: 1,
    borderColor: 'rgba(21, 214, 160, 0.12)',
  },
  clearIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21, 214, 160, 0.12)',
  },
  clearTextWrap: {
    flex: 1,
  },
  clearTitle: {
    ...typography.body,
    color: '#67E1BD',
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 13,
  },
  clearSubtitle: {
    ...typography.caption,
    color: '#688083',
    marginTop: 1,
    fontSize: 10,
  },
  dueGrid: {
    width: '100%',
    gap: 10,
  },
  dueTileRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },

  // Stats row
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
    backgroundColor: '#111F34',
    borderWidth: 1,
    borderColor: 'rgba(91, 126, 176, 0.36)',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 9,
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
    ...typography.h2,
    color: '#F4F7FF',
    fontSize: 21,
    lineHeight: 23,
  },
  statLabel: {
    ...typography.caption,
    color: '#95A3B9',
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 12,
  },

  // AI composer
  aiSection: {
    width: '100%',
    gap: 5,
  },
  aiLabelRow: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  aiComposerGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    right: -82,
    top: -77,
    backgroundColor: 'rgba(91, 66, 255, 0.14)',
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
  inlineError: {
    ...typography.caption,
    color: colors.tierRed,
    textAlign: 'center',
    fontSize: 10,
  },
})
