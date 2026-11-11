import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'

import * as collegesApi from '../../api/collegesApi'
import * as gradesApi from '../../api/gradesApi'
import * as studentsApi from '../../api/studentsApi'
import { ApiRequestError } from '../../api/client'
import { LoadingSkeleton } from '../ui/LoadingSkeleton'
import type {
  CollegeInsights,
  CollegeListItem,
  CollegeSearchResult,
} from '../../types/colleges'
import type { GpaSummary } from '../../types/grades'
import type { StudentMe } from '../../types/student'
import { colors, fonts, spacing } from '../../theme/tokens'
import { FLOATING_TAB_CLEARANCE } from '../ui/tabBarConstants'

type InsightState =
  | { status: 'loading' }
  | { status: 'error'; message: string; retryable: boolean }
  | { status: 'success'; data: CollegeInsights }

type ActionCategory = 'test' | 'gpa' | 'essay' | 'extracurricular' | 'strategy'
type ActionPriority = 'high' | 'medium' | 'low'

interface NormalizedActionStep {
  step: string
  category: ActionCategory
  priority: ActionPriority
}

const CATEGORY_COLORS: Record<ActionCategory, string> = {
  test: colors.primary,
  gpa: colors.success,
  essay: colors.purple,
  extracurricular: colors.orange,
  strategy: colors.info,
}

const PRIORITY_COLORS: Record<ActionPriority, string> = {
  high: colors.error,
  medium: colors.warning,
  low: colors.textMuted,
}

const PRIORITY_LABELS: Record<ActionPriority, string> = {
  high: 'High',
  medium: 'Med',
  low: 'Low',
}

function scoreColor(score: number): string {
  if (score >= 75) return colors.success
  if (score >= 50) return colors.warning
  if (score >= 25) return colors.orange
  return colors.error
}

function fitColor(label: string | null, score: number | null): string {
  if (score !== null) return scoreColor(score)
  const lower = label?.toLowerCase() ?? ''
  if (lower.includes('safety')) return colors.success
  if (lower.includes('target') || lower.includes('match')) return colors.primary
  if (lower.includes('reach')) return colors.error
  return colors.textMuted
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function normalizeCategory(value: unknown): ActionCategory {
  const category = typeof value === 'string' ? value.toLowerCase() : ''
  if (
    category === 'test' ||
    category === 'gpa' ||
    category === 'essay' ||
    category === 'extracurricular' ||
    category === 'strategy'
  ) {
    return category
  }
  return 'strategy'
}

function normalizePriority(value: unknown): ActionPriority {
  const priority = typeof value === 'string' ? value.toLowerCase() : ''
  if (priority === 'high' || priority === 'medium' || priority === 'low') return priority
  return 'medium'
}

function normalizeActionSteps(data: CollegeInsights): NormalizedActionStep[] {
  const raw = (data as unknown as { actionableSteps?: unknown }).actionableSteps
  if (!Array.isArray(raw)) return []
  return raw
    .map((item): NormalizedActionStep | null => {
      if (typeof item === 'string') {
        const step = item.trim()
        return step ? { step, category: 'strategy', priority: 'medium' } : null
      }
      if (!item || typeof item !== 'object') return null
      const object = item as { step?: unknown; text?: unknown; category?: unknown; priority?: unknown }
      const stepValue =
        typeof object.step === 'string'
          ? object.step
          : typeof object.text === 'string'
            ? object.text
            : ''
      const step = stepValue.trim()
      if (!step) return null
      return {
        step,
        category: normalizeCategory(object.category),
        priority: normalizePriority(object.priority),
      }
    })
    .filter((item): item is NormalizedActionStep => item !== null)
}

function formatGeneratedTime(value: string): string {
  const generatedAt = new Date(value)
  if (Number.isNaN(generatedAt.getTime())) return 'recently'
  const difference = Date.now() - generatedAt.getTime()
  const hours = Math.floor(difference / (1000 * 60 * 60))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function collegeLocation(item: { city: string | null; state: string | null }): string {
  return [item.city, item.state].filter(Boolean).join(', ')
}

export function CollegesPanel(): React.JSX.Element {
  const [saved, setSaved] = useState<CollegeListItem[]>([])
  const [student, setStudent] = useState<StudentMe | null>(null)
  const [gpa, setGpa] = useState<GpaSummary | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CollegeSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addingUnitId, setAddingUnitId] = useState<string | null>(null)

  const [removingId, setRemovingId] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [insightStates, setInsightStates] = useState<Record<number, InsightState>>({})

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchSequenceRef = useRef(0)

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    setError(null)
    try {
      const [savedResult, studentResult, gpaResult] = await Promise.all([
        collegesApi.listSavedColleges(),
        studentsApi.getMe().catch(() => null),
        gradesApi.getGpa().catch(() => null),
      ])
      setSaved(savedResult)
      setStudent(studentResult)
      setGpa(gpaResult)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load your college list.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  const stats = useMemo(() => {
    const profile = student?.profile
    const portalUnweighted = finiteNumber(gpa?.unweightedGpa)
    const portalWeighted = finiteNumber(gpa?.weightedGpa)
    const unweighted =
      portalUnweighted !== null && portalUnweighted > 0
        ? portalUnweighted
        : finiteNumber(profile?.unweightedGpa)
    const weighted =
      portalWeighted !== null && portalWeighted > 0
        ? portalWeighted
        : finiteNumber(profile?.weightedGpa)
    return {
      unweighted: unweighted ?? 0,
      weighted: weighted ?? 0,
      sat: finiteNumber(profile?.satScore),
      hasAcademicData:
        (unweighted !== null && unweighted > 0) ||
        (weighted !== null && weighted > 0) ||
        finiteNumber(profile?.satScore) !== null,
    }
  }, [gpa, student])

  const addedNames = useMemo(
    () => new Set(saved.map((college) => college.name.toLowerCase())),
    [saved],
  )

  function handleSearchChange(value: string): void {
    setQuery(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    const trimmed = value.trim()
    if (!trimmed) {
      searchSequenceRef.current += 1
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const sequence = ++searchSequenceRef.current
    searchTimerRef.current = setTimeout(() => {
      void collegesApi
        .searchColleges(trimmed)
        .then((results) => {
          if (searchSequenceRef.current === sequence) setSearchResults(results.slice(0, 8))
        })
        .catch(() => {
          if (searchSequenceRef.current === sequence) setSearchResults([])
        })
        .finally(() => {
          if (searchSequenceRef.current === sequence) setSearching(false)
        })
    }, 300)
  }

  function clearSearch(): void {
    searchSequenceRef.current += 1
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    setQuery('')
    setSearchResults([])
    setSearching(false)
  }

  async function handleAdd(result: CollegeSearchResult): Promise<void> {
    if (addedNames.has(result.name.toLowerCase()) || addingUnitId !== null) return
    setAddingUnitId(result.unitId)
    setError(null)
    try {
      const added = await collegesApi.addCollege({ name: result.name, scorecardUnitId: result.unitId })
      setSaved((current) => [...current, added])
      clearSearch()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not add this college.')
    } finally {
      setAddingUnitId(null)
    }
  }

  function requestRemove(item: CollegeListItem): void {
    Alert.alert(
      'Remove college?',
      `${item.name} will be removed from your college list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => void handleRemove(item) },
      ],
    )
  }

  async function handleRemove(item: CollegeListItem): Promise<void> {
    if (removingId !== null) return
    const previous = saved
    setRemovingId(item.id)
    setSaved((current) => current.filter((college) => college.id !== item.id))
    try {
      await collegesApi.removeCollege(item.id)
      if (expandedId === item.id) setExpandedId(null)
      setInsightStates((current) => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
    } catch {
      setSaved(previous)
      setError('Could not remove this college. Please try again.')
    } finally {
      setRemovingId(null)
    }
  }

  async function fetchInsights(item: CollegeListItem): Promise<void> {
    setInsightStates((current) => ({ ...current, [item.id]: { status: 'loading' } }))
    try {
      const data = await collegesApi.getCollegeInsights(item.id)
      setInsightStates((current) => ({ ...current, [item.id]: { status: 'success', data } }))
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : 'AI insights are unavailable right now.'
      setInsightStates((current) => ({
        ...current,
        [item.id]: {
          status: 'error',
          message,
          retryable:
            !(err instanceof ApiRequestError) ||
            err.status === 408 ||
            err.status === 429 ||
            err.status >= 500,
        },
      }))
    }
  }

  function toggleInsights(item: CollegeListItem): void {
    if (expandedId === item.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(item.id)
    if (!insightStates[item.id]) void fetchInsights(item)
  }

  const renderCollegeCard = useCallback(
    ({ item }: { item: CollegeListItem }) => (
      <CollegeCard
        item={item}
        expanded={expandedId === item.id}
        insightState={insightStates[item.id]}
        removing={removingId === item.id}
        onToggle={() => toggleInsights(item)}
        onRemove={() => requestRemove(item)}
        onRetry={() => void fetchInsights(item)}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expandedId, insightStates, removingId, saved],
  )

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <LoadingSkeleton rows={5} rowHeight={84} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        data={saved}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderCollegeCard}
        ItemSeparatorComponent={() => <View style={styles.cardGap} />}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Feather name="bookmark" size={24} color={colors.accentLight} />
            <Text style={styles.emptyTitle}>No colleges added yet</Text>
            <Text style={styles.emptyDescription}>
              Search above and add schools you want to compare. Your personalized fit scores will appear here.
            </Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            {/* Stats row */}
            <View style={styles.statsCard}>
              <StatItem label="UW GPA" value={stats.unweighted > 0 ? stats.unweighted.toFixed(2) : '—'} />
              <View style={styles.statDivider} />
              <StatItem label="W GPA" value={stats.weighted > 0 ? stats.weighted.toFixed(2) : '—'} />
              <View style={styles.statDivider} />
              <StatItem label="SAT" value={stats.sat?.toString() ?? '—'} />
              <View style={styles.statDivider} />
              <StatItem label="Added" value={String(saved.length)} />
            </View>

            {!stats.hasAcademicData ? (
              <View style={styles.warningCard}>
                <Feather name="info" size={15} color={colors.warning} />
                <Text style={styles.warningText}>
                  Add your GPA and SAT score in Settings to receive more accurate likelihood scores and AI
                  recommendations.
                </Text>
              </View>
            ) : null}

            {/* Search */}
            <View style={styles.searchBar}>
              <Feather name="search" size={18} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={handleSearchChange}
                placeholder="Search colleges..."
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search colleges"
              />
              {searching ? (
                <ActivityIndicator size="small" color={colors.accentLight} />
              ) : query.length > 0 ? (
                <Pressable
                  onPress={clearSearch}
                  hitSlop={7}
                  style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Clear college search"
                >
                  <Feather name="x" size={16} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>

            {query.trim().length > 0 && !searching ? (
              <View style={styles.searchResultsCard}>
                {searchResults.length > 0 ? (
                  searchResults.map((result, index) => {
                    const alreadyAdded = addedNames.has(result.name.toLowerCase())
                    const resultScore = finiteNumber(result.score)
                    const color = resultScore !== null ? scoreColor(resultScore) : fitColor(result.label, null)
                    return (
                      <View
                        key={result.unitId}
                        style={[styles.searchResultRow, index < searchResults.length - 1 && styles.searchResultDivider]}
                      >
                        <View style={[styles.searchSchoolIcon, { borderColor: `${color}55` }]}>
                          <Feather name="book-open" size={17} color={color} />
                        </View>
                        <View style={styles.searchResultCopy}>
                          <Text style={styles.searchResultName} numberOfLines={1}>
                            {result.name}
                          </Text>
                          <Text style={styles.searchResultMeta} numberOfLines={1}>
                            {collegeLocation(result) || 'College'}
                            {result.admissionRate !== null
                              ? ` · ${Math.round(result.admissionRate * 100)}% admit`
                              : ''}
                          </Text>
                        </View>
                        {resultScore !== null ? (
                          <Text style={[styles.searchResultScore, { color }]}>{Math.round(resultScore)}</Text>
                        ) : null}
                        <Pressable
                          disabled={alreadyAdded || addingUnitId !== null}
                          onPress={() => void handleAdd(result)}
                          hitSlop={4}
                          style={({ pressed }) => [
                            styles.addButton,
                            alreadyAdded && styles.addedButton,
                            pressed && !alreadyAdded && styles.addButtonPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={alreadyAdded ? `${result.name} is already added` : `Add ${result.name}`}
                        >
                          {addingUnitId === result.unitId ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : alreadyAdded ? (
                            <Feather name="check" size={16} color={colors.success} />
                          ) : (
                            <Feather name="plus" size={17} color="#FFFFFF" />
                          )}
                        </Pressable>
                      </View>
                    )
                  })
                ) : (
                  <View style={styles.noSearchResults}>
                    <Feather name="search" size={19} color={colors.textMuted} />
                    <Text style={styles.noSearchResultsText}>{'No colleges found for "' + query.trim() + '".'}</Text>
                  </View>
                )}
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorCard}>
                <Feather name="alert-circle" size={16} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
                <Pressable
                  onPress={() => setError(null)}
                  style={styles.errorClose}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss error"
                >
                  <Feather name="x" size={15} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : null}
          </View>
        }
      />
    </KeyboardAvoidingView>
  )
}

interface StatItemProps {
  label: string
  value: string
}

function StatItem({ label, value }: StatItemProps): React.JSX.Element {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  )
}

interface CollegeCardProps {
  item: CollegeListItem
  expanded: boolean
  insightState: InsightState | undefined
  removing: boolean
  onToggle: () => void
  onRemove: () => void
  onRetry: () => void
}

const CollegeCard = React.memo(function CollegeCard({
  item,
  expanded,
  insightState,
  removing,
  onToggle,
  onRemove,
  onRetry,
}: CollegeCardProps): React.JSX.Element {
  const score = finiteNumber(item.score)
  const color = fitColor(item.label, score)
  const location = collegeLocation(item)
  const progressWidth = `${Math.max(0, Math.min(score ?? 0, 100))}%` as const

  return (
    <View style={[styles.collegeCard, expanded && { borderColor: `${colors.primary}77` }]}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.collegeMain, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} AI insights for ${item.name}`}
      >
        <View style={styles.collegeContent}>
          {/* Top row: name + actions */}
          <View style={styles.collegeTopRow}>
            <View style={styles.collegeCopy}>
              <Text style={styles.collegeName} numberOfLines={2}>
                {item.name}
              </Text>
              {location ? (
                <Text style={styles.collegeLocation} numberOfLines={1}>
                  {location}
                </Text>
              ) : null}
            </View>

            <View style={styles.collegeActions}>
              <Pressable
                disabled={removing}
                onPress={(event) => {
                  event.stopPropagation()
                  onRemove()
                }}
                style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.name}`}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                {removing ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Feather name="trash-2" size={15} color={colors.error} />
                )}
              </Pressable>
              <Feather
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={17}
                color={colors.textMuted}
              />
            </View>
          </View>

          {/* Likelihood row */}
          <View style={styles.fitRow}>
            <View style={styles.fitCopy}>
              <Text style={styles.fitEyebrow}>LIKELIHOOD</Text>
              <Text style={[styles.fitLabel, { color }]}>
                {item.label ?? (score !== null ? 'College fit' : 'Add GPA & SAT')}
              </Text>
            </View>

            <View style={styles.scoreBox}>
              {score !== null ? (
                <>
                  <Text style={[styles.scoreValue, { color }]}>{Math.round(score)}</Text>
                  <Text style={styles.scoreOutOf}>/100</Text>
                </>
              ) : (
                <>
                  <Text style={styles.noScoreValue}>—</Text>
                  <Text style={styles.scoreOutOf}>no score</Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressWidth, backgroundColor: color }]} />
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.insightsPanel}>
          <View style={styles.insightsDivider} />
          <InsightContent state={insightState} onRetry={onRetry} />
        </View>
      ) : null}
    </View>
  )
})

interface InsightContentProps {
  state: InsightState | undefined
  onRetry: () => void
}

function InsightContent({ state, onRetry }: InsightContentProps): React.JSX.Element {
  if (!state || state.status === 'loading') {
    return (
      <View style={styles.insightLoading}>
        <ActivityIndicator size="small" color={colors.accentLight} />
        <LoadingSkeleton rows={3} rowHeight={54} />
      </View>
    )
  }

  if (state.status === 'error') {
    return (
      <View style={styles.insightErrorCard}>
        <Feather name="alert-triangle" size={18} color={colors.warning} />
        <View style={styles.insightErrorCopy}>
          <Text style={styles.insightErrorTitle}>{"Couldn't load AI insights"}</Text>
          <Text style={styles.insightErrorMessage}>{state.message}</Text>
        </View>
        {state.retryable ? (
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Retry loading insights"
          >
            <Feather name="refresh-cw" size={14} color={colors.accentLight} />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    )
  }

  const { data } = state
  const steps = normalizeActionSteps(data)

  return (
    <View style={styles.insightContent}>
      <View style={styles.aiInsightHeader}>
        <Feather name="zap" size={15} color={colors.accentLight} />
        <Text style={styles.aiInsightTitle}>Personalized fit analysis</Text>
      </View>

      <Text style={styles.narrative}>{data.narrativeSummary}</Text>

      {steps.length > 0 ? (
        <View style={styles.actionSection}>
          <Text style={styles.actionSectionLabel}>ACTION STEPS</Text>
          <View style={styles.actionList}>
            {steps.map((step, index) => {
              const categoryColor = CATEGORY_COLORS[step.category]
              const priorityColor = PRIORITY_COLORS[step.priority]
              return (
                <View key={`${step.category}-${index}`} style={styles.actionCard}>
                  <View style={styles.actionBadges}>
                    <View
                      style={[
                        styles.categoryBadge,
                        { backgroundColor: `${categoryColor}18`, borderColor: `${categoryColor}55` },
                      ]}
                    >
                      <Text style={[styles.categoryBadgeText, { color: categoryColor }]}>
                        {step.category.toUpperCase()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.priorityBadge,
                        { backgroundColor: `${priorityColor}14`, borderColor: `${priorityColor}55` },
                      ]}
                    >
                      <Text style={[styles.priorityBadgeText, { color: priorityColor }]}>
                        {PRIORITY_LABELS[step.priority]}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.actionText}>{step.step}</Text>
                </View>
              )
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.insightMeta}>
        <Feather name="clock" size={12} color={colors.textMuted} />
        <Text style={styles.insightMetaText}>Generated {formatGeneratedTime(data.generatedAt)}</Text>
        {data.cached ? (
          <View style={styles.cachedBadge}>
            <Text style={styles.cachedBadgeText}>cached</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loadingWrap: { flex: 1, paddingTop: spacing.lg },
  scrollContent: {
    paddingBottom: FLOATING_TAB_CLEARANCE,
  },
  headerWrap: {
    gap: spacing.lg,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  pressed: { opacity: 0.82 },

  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    overflow: 'hidden',
    minHeight: 72,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 12,
  },
  statLabel: {
    fontSize: 9.5,
    fontFamily: fonts.jakartaBold,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 19,
    fontFamily: fonts.groteskBold,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.4,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },

  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: `${colors.warning}14`,
    borderWidth: 1,
    borderColor: `${colors.warning}3D`,
  },
  warningText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 10.5,
    lineHeight: 15.5,
  },

  searchBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  clearButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.surface2,
  },

  searchResultsCard: {
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchResultRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  searchResultDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  searchSchoolIcon: {
    width: 37,
    height: 37,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.surface2,
    borderWidth: 1,
  },
  searchResultCopy: { flex: 1, minWidth: 0, gap: 3 },
  searchResultName: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
  },
  searchResultMeta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9, lineHeight: 12 },
  searchResultScore: {
    minWidth: 25,
    textAlign: 'right',
    fontFamily: fonts.bold,
    fontSize: 15,
    fontWeight: '700',
  },
  addButton: {
    width: 36,
    height: 36,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  addButtonPressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  addedButton: {
    backgroundColor: `${colors.success}21`,
    borderWidth: 1,
    borderColor: `${colors.success}52`,
  },
  noSearchResults: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  noSearchResultsText: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 10.5 },

  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 11,
    borderRadius: 14,
    backgroundColor: `${colors.error}17`,
    borderWidth: 1,
    borderColor: `${colors.error}42`,
  },
  errorText: { flex: 1, color: colors.error, fontFamily: fonts.regular, fontSize: 10.5, lineHeight: 15 },
  errorClose: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  cardGap: { height: 10 },
  collegeCard: {
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.screenPadding,
  },
  collegeMain: { width: '100%' },
  collegeContent: { paddingHorizontal: 15, paddingTop: 14, paddingBottom: 13 },
  collegeTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  collegeCopy: { flex: 1, minWidth: 0, gap: 3 },
  collegeName: {
    color: colors.text,
    fontFamily: fonts.jakartaBold,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: -0.15,
  },
  collegeLocation: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 12, lineHeight: 15 },
  collegeActions: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0, width: 72 },
  removeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fitRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  fitCopy: { flex: 1, minWidth: 0, gap: 4 },
  fitEyebrow: {
    fontSize: 9,
    fontFamily: fonts.jakartaBold,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  fitLabel: { fontFamily: fonts.semiBold, fontSize: 11, fontWeight: '600' },
  scoreBox: { width: 72, alignItems: 'flex-end', flexShrink: 0 },
  scoreValue: {
    fontFamily: fonts.groteskBold,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  noScoreValue: {
    color: colors.textMuted,
    fontFamily: fonts.groteskBold,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
  },
  scoreOutOf: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 8.5, lineHeight: 11 },

  progressTrack: { height: 6, marginTop: 9, overflow: 'hidden', borderRadius: 99, backgroundColor: colors.surface2 },
  progressFill: { height: '100%', borderRadius: 99 },

  insightsPanel: { paddingHorizontal: 15, paddingBottom: 14 },
  insightsDivider: { height: 1, marginBottom: 12, backgroundColor: colors.border },

  insightLoading: { gap: 12, alignItems: 'center' },
  insightErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 11,
    borderRadius: 12,
    backgroundColor: `${colors.warning}12`,
    borderWidth: 1,
    borderColor: `${colors.warning}33`,
  },
  insightErrorCopy: { flex: 1, minWidth: 0, gap: 3 },
  insightErrorTitle: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 10.5, fontWeight: '600' },
  insightErrorMessage: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 8.5, lineHeight: 12 },
  retryButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: { color: colors.accentLight, fontFamily: fonts.semiBold, fontSize: 9, fontWeight: '600' },

  insightContent: { gap: 12 },
  aiInsightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiInsightTitle: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 11.5, fontWeight: '600' },
  narrative: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 10.5, lineHeight: 16.5 },
  actionSection: { gap: 8 },
  actionSectionLabel: {
    fontSize: 9,
    fontFamily: fonts.jakartaBold,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  actionList: { gap: 8 },
  actionCard: {
    gap: 8,
    padding: 11,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBadges: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  categoryBadge: { maxWidth: '70%', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  categoryBadgeText: { fontFamily: fonts.jakartaBold, fontSize: 7.5, fontWeight: '700', letterSpacing: 0.45 },
  priorityBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  priorityBadgeText: { fontFamily: fonts.jakartaBold, fontSize: 7.5, fontWeight: '700' },
  actionText: { color: colors.text, fontFamily: fonts.regular, fontSize: 10, lineHeight: 15.5 },
  insightMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  insightMetaText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 8.5 },
  cachedBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, borderWidth: 1, borderColor: colors.border },
  cachedBadgeText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 7.5, fontWeight: '500' },

  emptyCard: {
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 34,
    gap: 10,
    marginHorizontal: spacing.screenPadding,
  },
  emptyTitle: { color: colors.text, fontFamily: fonts.jakartaBold, fontSize: 15, fontWeight: '700' },
  emptyDescription: {
    maxWidth: 280,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 10.5,
    lineHeight: 15.5,
    textAlign: 'center',
  },
})
