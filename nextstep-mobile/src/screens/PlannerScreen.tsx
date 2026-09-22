import React, { useCallback, useMemo, useState } from 'react'
import { Pressable, SectionList, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import * as assignmentsApi from '../api/assignmentsApi'
import { ApiRequestError } from '../api/client'
import { Screen } from '../components/ui/Screen'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ProgressBar } from '../components/ui/ProgressBar'
import { LoadingSkeleton } from '../components/ui/Skeleton'
import { ErrorRetryBlock } from '../components/ui/ErrorRetryBlock'
import { EmptyState } from '../components/ui/EmptyState'
import type { Assignment } from '../types/assignments'
import type { MainTabParamList } from '../navigation/MainNavigator'
import { colors, fonts, getSubjectColor, radii, spacing, typography } from '../theme/tokens'

type Group = 'Overdue' | 'Today' | 'Tomorrow' | 'This Week' | 'Later' | 'Completed'
type DisplaySection = { title: string; data: Assignment[] }

const GROUP_ORDER: Group[] = ['Overdue', 'Today', 'Tomorrow', 'This Week', 'Later', 'Completed']

// Mirrors web's GROUP_META (app/(app)/planner/page.tsx) — only Overdue/Today get a
// distinct urgency color, everything else reads as neutral.
const GROUP_META: Partial<Record<string, { color: string; bg: string }>> = {
  Overdue: { color: colors.tierRed, bg: colors.tierRedBg },
  Today: { color: colors.tierAmber, bg: colors.tierAmberBg },
}

const DAY_LETTERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDueDate(assignment: Assignment): string {
  const date = new Date(assignment.dueDate)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return assignment.dueTime ? `${dateStr} at ${assignment.dueTime}` : dateStr
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function groupFor(assignment: Assignment): Group {
  if (assignment.completed) return 'Completed'
  const today = startOfDay(new Date())
  const dueDay = startOfDay(new Date(assignment.dueDate))
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000)

  if (diffDays < 0) return 'Overdue'
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays <= 7) return 'This Week'
  return 'Later'
}

// Format a date as "MMM D" (e.g. "Sep 22")
function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function PlannerScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<MainTabParamList, 'Planner'>>()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [cursor, setCursor] = useState<number | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const loadFirstPage = useCallback(async () => {
    setError(null)
    try {
      const result = await assignmentsApi.listAssignments({ status: 'all', limit: 50 })
      setAssignments(result.data)
      setCursor(result.meta.nextCursor)
      setHasNextPage(result.meta.hasNextPage)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load your planner.')
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadFirstPage()
    }, [loadFirstPage]),
  )

  async function loadMore(): Promise<void> {
    if (!hasNextPage || cursor === null || loadingMore) return
    setLoadingMore(true)
    try {
      const result = await assignmentsApi.listAssignments({ status: 'all', cursor, limit: 50 })
      setAssignments((prev) => [...prev, ...result.data])
      setCursor(result.meta.nextCursor)
      setHasNextPage(result.meta.hasNextPage)
    } catch {
      // Silent — a failed next-page fetch shouldn't blank the already-loaded list.
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleToggleComplete(assignment: Assignment): Promise<void> {
    const nextCompleted = !assignment.completed
    setAssignments((prev) => prev.map((a) => (a.id === assignment.id ? { ...a, completed: nextCompleted } : a)))
    try {
      await assignmentsApi.completeAssignment(assignment.id, nextCompleted)
    } catch {
      setAssignments((prev) =>
        prev.map((a) => (a.id === assignment.id ? { ...a, completed: assignment.completed } : a)),
      )
    }
  }

  async function handleDelete(assignment: Assignment): Promise<void> {
    const previous = assignments
    setAssignments((prev) => prev.filter((a) => a.id !== assignment.id))
    try {
      await assignmentsApi.deleteAssignment(assignment.id)
    } catch {
      setAssignments(previous)
    }
  }

  async function handleCreate(): Promise<void> {
    setCreateError(null)
    if (!newTitle.trim() || !newDueDate.trim()) {
      setCreateError('Enter a title and due date.')
      return
    }
    setCreating(true)
    try {
      const created = await assignmentsApi.createAssignment({
        title: newTitle.trim(),
        subject: newSubject.trim() || undefined,
        dueDate: newDueDate.trim(),
      })
      setAssignments((prev) => [...prev, created])
      setNewTitle('')
      setNewSubject('')
      setNewDueDate('')
      setShowCreate(false)
    } catch (err) {
      setCreateError(err instanceof ApiRequestError ? err.message : 'Could not create task.')
    } finally {
      setCreating(false)
    }
  }

  const [showCompleted, setShowCompleted] = useState(false)
  const requestedAssignmentId = route.params?.assignmentId
  const hasValidRequestedId =
    requestedAssignmentId === undefined ||
    (Number.isInteger(requestedAssignmentId) && requestedAssignmentId > 0)
  const selectedAssignment =
    requestedAssignmentId === undefined
      ? null
      : assignments.find((assignment) => assignment.id === requestedAssignmentId) ?? null

  const { activeSections, completedItems } = useMemo(() => {
    const grouped = new Map<Group, Assignment[]>(GROUP_ORDER.map((g) => [g, []]))
    for (const assignment of assignments) grouped.get(groupFor(assignment))?.push(assignment)
    const active = GROUP_ORDER.filter((g) => g !== 'Completed')
      .map((group) => ({ title: group, data: grouped.get(group) ?? [] }))
      .filter((s) => s.data.length > 0)
    return { activeSections: active, completedItems: grouped.get('Completed') ?? [] }
  }, [assignments])

  // Folds the completed-items list into SectionList's own `sections` (instead of a
  // raw .map() in ListFooterComponent) so it's windowed/virtualized like the active
  // groups — only when there's a mix of active + completed, matching the existing
  // "All caught up" banner behavior (below) for the all-completed case exactly.
  const sections = useMemo(() => {
    if (activeSections.length === 0 || completedItems.length === 0) return activeSections
    return [...activeSections, { title: 'Completed' as Group, data: showCompleted ? completedItems : [] }]
  }, [activeSections, completedItems, showCompleted])

  // ---------------------------------------------------------------------------
  // 7-day strip data
  // NOTE: weekDays is computed once at mount. The screen uses useFocusEffect to
  // refresh assignments on each visit, so data stays fresh. The day strip itself
  // won't rotate past midnight unless the component remounts — acceptable for
  // this sprint scope.
  // ---------------------------------------------------------------------------
  const weekDays = useMemo<Date[]>(() => {
    const today = startOfDay(new Date())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [])

  const weekRange = useMemo<string>(() => {
    const first = weekDays[0]
    const last = weekDays[weekDays.length - 1]
    return `${shortDate(first)} – ${shortDate(last)}`
  }, [weekDays])

  // Dot map: which days in the strip have at least one incomplete assignment
  const dayHasDueAssignment = useMemo<Map<string, boolean>>(() => {
    const map = new Map<string, boolean>()
    for (const a of assignments) {
      if (!a.completed) {
        const dueDay = startOfDay(new Date(a.dueDate))
        map.set(dueDay.toISOString(), true)
      }
    }
    return map
  }, [assignments])

  // Weekly workload progress (completed / total within the 7-day window)
  const workloadProgress = useMemo<number>(() => {
    const weekEnd = new Date(weekDays[weekDays.length - 1])
    weekEnd.setDate(weekEnd.getDate() + 1) // exclusive upper bound
    const weekAssignments = assignments.filter((a) => {
      const due = startOfDay(new Date(a.dueDate))
      return due >= weekDays[0] && due < weekEnd
    })
    if (weekAssignments.length === 0) return 0
    const done = weekAssignments.filter((a) => a.completed).length
    return done / weekAssignments.length
  }, [assignments, weekDays])

  // The sections displayed in the SectionList — filtered by selected day when one is active
  const displaySections = useMemo<DisplaySection[]>(() => {
    if (!selectedDay) return sections as DisplaySection[]
    const dayAssignments = assignments.filter(
      (a) => !a.completed && isSameDay(startOfDay(new Date(a.dueDate)), selectedDay),
    )
    if (dayAssignments.length === 0) return []
    return [{ title: shortDate(selectedDay), data: dayAssignments }]
  }, [selectedDay, assignments, sections])

  // assignments is a dep because handleDelete reads it from closure for its
  // rollback snapshot — everything else these handlers touch goes through a
  // functional setState updater, so no other closure state can go stale here.
  const renderAssignment = useCallback(
    ({ item }: { item: Assignment }) => (
      <AssignmentRow
        item={item}
        selected={item.id === requestedAssignmentId}
        onToggle={() => void handleToggleComplete(item)}
        onDelete={() => void handleDelete(item)}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assignments, requestedAssignmentId],
  )

  if (loading) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <LoadingSkeleton rows={4} />
      </Screen>
    )
  }

  if (error && assignments.length === 0) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <ErrorRetryBlock
          message={error}
          onRetry={() => {
            setLoading(true)
            void loadFirstPage()
          }}
        />
      </Screen>
    )
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      {/* Static header area — not part of SectionList so it stays pinned */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Planner</Text>
        <Pressable
          onPress={() => setShowCreate((v) => !v)}
          style={styles.addButton}
          accessibilityRole="button"
          accessibilityLabel={showCreate ? 'Cancel new task' : 'New task'}
        >
          <Feather name={showCreate ? 'x' : 'plus'} size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* Week-range header + workload ProgressBar */}
      <View style={styles.weekHeaderCard}>
        <View style={styles.weekHeaderRow}>
          <Text style={styles.weekRangeText}>{weekRange}</Text>
          <Text style={styles.workloadLabel}>
            {Math.round(workloadProgress * 100)}% done
          </Text>
        </View>
        <ProgressBar value={workloadProgress} color={colors.accent2} height={5} />
      </View>

      {/* 7-day selector strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayStrip}
      >
        {weekDays.map((day) => {
          const dayKey = day.toISOString()
          const isSelected = selectedDay !== null && isSameDay(day, selectedDay)
          const hasDot = dayHasDueAssignment.has(dayKey)
          const isToday = isSameDay(day, startOfDay(new Date()))
          return (
            <Pressable
              key={dayKey}
              onPress={() => setSelectedDay(isSelected ? null : day)}
              style={[styles.dayPill, isSelected && styles.dayPillSelected]}
              accessibilityRole="button"
              accessibilityLabel={`${DAY_LETTERS[day.getDay()]} ${day.getDate()}${hasDot ? ', has assignments' : ''}`}
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.dayLetter, isSelected && styles.dayTextSelected, isToday && !isSelected && styles.dayLetterToday]}>
                {DAY_LETTERS[day.getDay()]}
              </Text>
              <Text style={[styles.dayNumber, isSelected && styles.dayTextSelected, isToday && !isSelected && styles.dayNumberToday]}>
                {day.getDate()}
              </Text>
              {hasDot ? (
                <View style={[styles.dayDot, isSelected && styles.dayDotSelected]} />
              ) : (
                <View style={styles.dayDotPlaceholder} />
              )}
            </Pressable>
          )
        })}
      </ScrollView>

      {showCreate ? (
        <Card style={styles.createCard}>
          <Input label="Title" value={newTitle} onChangeText={setNewTitle} />
          <Input label="Subject (optional)" value={newSubject} onChangeText={setNewSubject} />
          <Input
            label="Due date (YYYY-MM-DD)"
            value={newDueDate}
            onChangeText={setNewDueDate}
            placeholder="2026-07-15"
          />
          {createError ? <Text style={styles.error}>{createError}</Text> : null}
          <Button label="Create" onPress={() => void handleCreate()} loading={creating} />
        </Card>
      ) : null}

      {requestedAssignmentId !== undefined ? (
        selectedAssignment ? (
          <Card style={styles.selectedAssignment}>
            <View style={styles.selectedAssignmentHeading}>
              <View style={styles.selectedAssignmentIcon}>
                <Feather name="clipboard" size={17} color={colors.tierAmber} />
              </View>
              <View style={styles.selectedAssignmentCopy}>
                <Text style={styles.selectedAssignmentEyebrow}>OPENED ASSIGNMENT</Text>
                <Text style={styles.selectedAssignmentTitle}>{selectedAssignment.title}</Text>
              </View>
            </View>
            <Text style={styles.selectedAssignmentMeta}>
              {selectedAssignment.subject || 'No subject'} · Due {formatDueDate(selectedAssignment)}
            </Text>
            <Text style={styles.selectedAssignmentMeta}>
              {selectedAssignment.completed ? 'Completed' : 'Incomplete'}
              {selectedAssignment.priority ? ` · ${selectedAssignment.priority} priority` : ''}
            </Text>
          </Card>
        ) : (
          <View style={styles.routeError} accessibilityRole="alert">
            <Feather name="alert-circle" size={16} color={colors.tierRed} />
            <Text style={styles.routeErrorText}>
              {hasValidRequestedId
                ? 'That assignment is no longer available.'
                : 'The assignment link is invalid.'}
            </Text>
          </View>
        )
      ) : null}

      {displaySections.length === 0 && !selectedDay && activeSections.length === 0 && completedItems.length === 0 ? (
        <EmptyState icon="check-circle" title="Nothing due" message="You're all caught up." />
      ) : displaySections.length === 0 && selectedDay ? (
        <View style={styles.emptyDay}>
          <Text style={styles.emptyDayText}>Nothing due on {shortDate(selectedDay)}.</Text>
        </View>
      ) : (
        <SectionList<Assignment, DisplaySection>
          sections={displaySections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.4}
          renderSectionHeader={({ section }) => {
            if (section.title === 'Completed') {
              return (
                <Pressable
                  style={styles.completedToggle}
                  onPress={() => setShowCompleted((v) => !v)}
                  accessibilityRole="button"
                >
                  <Feather
                    name="chevron-right"
                    size={13}
                    color={colors.textDim}
                    style={showCompleted ? styles.chevronOpen : undefined}
                  />
                  <Text style={styles.completedToggleText}>
                    {showCompleted ? 'Hide completed assignments' : `Show completed assignments (${completedItems.length})`}
                  </Text>
                </Pressable>
              )
            }
            const meta = GROUP_META[section.title]
            return (
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, meta && { color: meta.color }]}>{section.title}</Text>
                <View style={[styles.countPill, meta && { backgroundColor: meta.bg }]}>
                  <Text style={[styles.countPillText, meta && { color: meta.color }]}>{section.data.length}</Text>
                </View>
              </View>
            )
          }}
          renderItem={renderAssignment}
          ListFooterComponent={
            activeSections.length === 0 && completedItems.length > 0 && !selectedDay ? (
              <View style={styles.allCaughtUp}>
                <View style={styles.allCaughtUpIcon}>
                  <Feather name="check" size={22} color={colors.tierGreen} />
                </View>
                <Text style={styles.allCaughtUpTitle}>All caught up!</Text>
                <Text style={styles.allCaughtUpSubtitle}>Every assignment is completed.</Text>
              </View>
            ) : null
          }
        />
      )}
    </Screen>
  )
}

// ---------------------------------------------------------------------------
// AssignmentRow
// ---------------------------------------------------------------------------

interface AssignmentRowProps {
  item: Assignment
  selected: boolean
  onToggle: () => void
  onDelete: () => void
}

const AssignmentRow = React.memo(function AssignmentRow({
  item,
  selected,
  onToggle,
  onDelete,
}: AssignmentRowProps): React.JSX.Element {
  const subjectColor = item.subject ? getSubjectColor(item.subject) : null
  return (
    <Card
      style={[
        styles.assignmentCard,
        item.completed && styles.assignmentCardCompleted,
        selected && styles.assignmentCardSelected,
      ]}
    >
      <Pressable
        testID={`planner-assignment-${item.id}`}
        style={styles.assignmentMain}
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.completed, selected }}
      >
        <View style={[styles.checkbox, item.completed && styles.checkboxChecked]}>
          {item.completed ? <Feather name="check" size={11} color={colors.bg} /> : null}
        </View>
        <View style={styles.assignmentInfo}>
          <Text style={[styles.assignmentTitle, item.completed && styles.completedText]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.assignmentMetaRow}>
            {subjectColor ? (
              <View style={[styles.subjectDot, { backgroundColor: subjectColor }]} />
            ) : null}
            {item.subject ? <Text style={styles.assignmentSubject}>{item.subject}</Text> : null}
            <Text style={styles.assignmentSubject}>Due {formatDueDate(item)}</Text>
          </View>
        </View>
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteButton} accessibilityLabel="Delete task">
        <Feather name="x" size={16} color={colors.textFaint} />
      </Pressable>
    </Card>
  )
})

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: { ...typography.h1, color: colors.text },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radii.button,
    backgroundColor: colors.cardFallback,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Week header
  weekHeaderCard: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekRangeText: {
    ...typography.h3,
    fontSize: 14,
    color: colors.text,
  },
  workloadLabel: {
    ...typography.caption,
    color: colors.accent2,
    fontFamily: fonts.bodyMedium,
  },

  // 7-day strip
  dayStrip: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  dayPill: {
    width: 44,
    height: 68,
    borderRadius: radii.input,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.cardFallback,
    paddingVertical: spacing.sm,
  },
  dayPillSelected: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  dayLetter: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.textDim,
  },
  dayLetterToday: {
    color: colors.accent,
  },
  dayNumber: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 15,
    color: colors.text,
  },
  dayNumberToday: {
    color: colors.accent,
  },
  dayTextSelected: {
    color: colors.accent,
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent2,
  },
  dayDotSelected: {
    backgroundColor: colors.accent,
  },
  dayDotPlaceholder: {
    width: 5,
    height: 5,
  },

  // Create form
  createCard: { gap: spacing.sm, marginBottom: spacing.md },
  selectedAssignment: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
    borderColor: 'rgba(251,191,36,0.42)',
    backgroundColor: 'rgba(251,191,36,0.06)',
  },
  selectedAssignmentHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectedAssignmentIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: 'rgba(251,191,36,0.14)',
  },
  selectedAssignmentCopy: { flex: 1, minWidth: 0 },
  selectedAssignmentEyebrow: {
    ...typography.label,
    color: colors.tierAmber,
    fontSize: 9,
  },
  selectedAssignmentTitle: { ...typography.h3, color: colors.text },
  selectedAssignmentMeta: { ...typography.caption, color: colors.textDim },
  routeError: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.ms,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.28)',
    borderRadius: radii.sm,
    backgroundColor: 'rgba(248,113,113,0.08)',
  },
  routeErrorText: { ...typography.caption, flex: 1, color: colors.tierRed },
  error: { ...typography.caption, color: colors.tierRed },

  // Section list
  listContent: { paddingBottom: 100 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...typography.label, color: colors.textDim },
  countPill: {
    backgroundColor: colors.cardFallback,
    borderRadius: 100,
    paddingHorizontal: spacing.sm,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillText: {
    ...typography.caption,
    fontSize: 11,
    fontFamily: fonts.bold,
    fontWeight: '700',
    color: colors.textDim,
  },

  // Assignment card
  assignmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.ms,
  },
  assignmentCardCompleted: { opacity: 0.6 },
  assignmentCardSelected: {
    borderColor: colors.tierAmber,
    backgroundColor: 'rgba(251,191,36,0.06)',
  },
  assignmentMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radii.xs / 2,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  assignmentInfo: { flex: 1, gap: 3, marginRight: spacing.sm },
  assignmentTitle: { ...typography.h3, fontSize: 14.5, color: colors.text },
  completedText: { textDecorationLine: 'line-through', color: colors.textFaint },
  assignmentMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  subjectDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  assignmentSubject: { ...typography.caption, color: colors.textDim },
  deleteButton: { padding: spacing.xs },

  // Completed toggle
  completedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.ms,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  completedToggleText: {
    ...typography.caption,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    color: colors.textDim,
  },

  // All caught up
  allCaughtUp: { alignItems: 'center', paddingVertical: spacing.xxl },
  allCaughtUpIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.tierGreenBg,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.ms,
  },
  allCaughtUpTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  allCaughtUpSubtitle: { ...typography.caption, color: colors.textDim },

  // Empty day filter state
  emptyDay: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyDayText: {
    ...typography.body,
    color: colors.textDim,
    textAlign: 'center',
  },
})
