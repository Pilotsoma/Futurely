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
import { EmptyState } from '../ui/EmptyState'
import { ErrorRetryBlock } from '../ui/ErrorRetryBlock'
import { LoadingSkeleton } from '../ui/LoadingSkeleton'
import { formatGpa } from '../../features/grades/academicSummary'
import { toUserMessage } from '../../utils/errorMessage'
import type {
  CollegeInsights,
  CollegeListItem,
  CollegeSearchResult,
} from '../../types/colleges'
import type { GpaSummary } from '../../types/grades'
import type { StudentMe } from '../../types/student'
import { colors, fonts, radii, spacing, typography } from '../../theme/tokens'
import { ProgressRing } from '../ui/ProgressRing'
import { SCROLL_BOTTOM_CLEARANCE } from '../ui/tabBarConstants'

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

const CATEGORY_LABELS: Record<ActionCategory, string> = {
  test: 'Test',
  gpa: 'GPA',
  essay: 'Essay',
  extracurricular: 'Extracurricular',
  strategy: 'Strategy',
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
  // `error` is for actions (add, remove); `loadError` is for loading the list, so a failed
  // load shows one error block instead of an error line above a false "no colleges" state.
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

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
    setLoadError(null)
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
      setLoadError(toUserMessage(err, "We couldn't load your college list."))
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
      setError(toUserMessage(err, "We couldn't add this college. Please try again."))
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
      const message = toUserMessage(err, 'AI insights are unavailable right now.')
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

  // A failed refresh over an existing list is a dismissible banner; a failed first load
  // (nothing to show) is the full error block in the list's empty slot instead.
  const bannerError = error ?? (saved.length > 0 ? loadError : null)

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
          <View style={styles.emptyWrap}>
            {loadError ? (
              <ErrorRetryBlock
                message={loadError}
                onRetry={() => void load(true)}
                retrying={refreshing}
              />
            ) : (
              <EmptyState
                icon="bookmark"
                title="No colleges added yet"
                message="Search above to add a school. Its fit score shows here."
              />
            )}
          </View>
        }
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            {/* Stats row - numericSm (20px) values, 11px labels */}
            <View style={styles.statsCard}>
              <StatItem label="Unweighted" value={formatGpa(stats.unweighted > 0 ? stats.unweighted : null)} />
              <View style={styles.statDivider} />
              <StatItem label="Weighted" value={formatGpa(stats.weighted > 0 ? stats.weighted : null)} />
              <View style={styles.statDivider} />
              <StatItem label="SAT" value={stats.sat?.toString() ?? '—'} />
              <View style={styles.statDivider} />
              <StatItem label="Added" value={String(saved.length)} />
            </View>

            {!stats.hasAcademicData && !loadError ? (
              <View style={styles.warningCard}>
                <Feather name="info" size={15} color={colors.warning} />
                <Text style={styles.warningText}>
                  Add your GPA and SAT score in Settings to receive more accurate likelihood scores and AI
                  recommendations.
                </Text>
              </View>
            ) : null}

            {/* Search bar - 14px input text minimum */}
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

            {bannerError ? (
              <View style={styles.errorCard}>
                <Feather name="alert-circle" size={16} color={colors.error} />
                <Text style={styles.errorText}>{bannerError}</Text>
                <Pressable
                  onPress={() => {
                    setError(null)
                    setLoadError(null)
                  }}
                  hitSlop={8}
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
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
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

  return (
    <View style={styles.collegeCard}>
      {/* 1px top-edge highlight - same surface treatment as roadmap cards */}
      <View style={styles.cardTopHighlight} pointerEvents="none" />

      {/* Single clean row: score ring | name + meta | chevron */}
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.collegeMain, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} AI insights for ${item.name}`}
      >
        <View style={styles.collegeContent}>
          {/* Left: 52px score ring with number inside, captioned so the number has a unit */}
          <View style={styles.scoreColumn}>
            <ProgressRing
              progress={score ?? 0}
              size={52}
              strokeWidth={5}
              color={color}
              trackColor="rgba(255,255,255,0.08)"
            >
              {score !== null ? (
                <Text style={[styles.scoreRingValue, { color }]}>{Math.round(score)}</Text>
              ) : (
                <Text style={styles.scoreRingEmpty}>—</Text>
              )}
            </ProgressRing>
            {score !== null ? <Text style={styles.scoreCaption}>fit score</Text> : null}
          </View>

          {/* Center: name + location + fit chip */}
          <View style={styles.collegeInfo}>
            <Text style={styles.collegeName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.collegeMeta}>
              {location ? (
                <Text style={styles.collegeLocation} numberOfLines={1}>{location}</Text>
              ) : null}
              <View style={[styles.fitChip, { backgroundColor: `${color}1F`, flexShrink: 0 }]}>
                <View style={[styles.fitDot, { backgroundColor: color }]} />
                <Text style={[styles.fitLabel, { color }]}>
                  {item.label ?? (score !== null ? 'College fit' : 'Add GPA & SAT')}
                </Text>
              </View>
            </View>
          </View>

          {/* Right: chevron - 44pt touch area via the parent Pressable */}
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={17}
            color={colors.textMuted}
          />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.insightsPanel}>
          <View style={styles.insightsDivider} />
          <InsightContent state={insightState} onRetry={onRetry} />
          {/* Remove from list - quiet destructive action in expanded view only */}
          <Pressable
            disabled={removing}
            onPress={onRemove}
            style={({ pressed }) => [styles.removeListBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={removing ? 'Removing from list' : undefined}
            accessibilityState={{ disabled: removing, busy: removing }}
          >
            {removing ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Text style={styles.removeListText}>Remove from list</Text>
            )}
          </Pressable>
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
            hitSlop={6}
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
        <Text style={styles.aiInsightTitle}>Why this score</Text>
      </View>

      <Text style={styles.narrative}>{data.narrativeSummary}</Text>

      {steps.length > 0 ? (
        <View style={styles.actionSection}>
          <Text style={styles.actionSectionLabel}>Action steps</Text>
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
                        {CATEGORY_LABELS[step.category]}
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
    paddingBottom: SCROLL_BOTTOM_CLEARANCE,
  },
  headerWrap: {
    gap: spacing.lg,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  pressed: { opacity: 0.86, transform: [{ scale: 0.975 }] },

  // Stats card - surface1, no border, numericSm values, 11px labels
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    minHeight: 72,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 14,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statValue: {
    // numericSm: 20px Jakarta ExtraBold, tabular-nums
    ...typography.numericSm,
    color: colors.text,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderSubtle,
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
  // 11px minimum - was 10.5
  warningText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },

  // Search bar - 14px input text minimum
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
    fontSize: 14,
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  // 11px minimum - was 9
  searchResultMeta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11, lineHeight: 15 },
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
  // 11px minimum - was 10.5
  noSearchResultsText: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 11 },

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
  // 11px minimum - was 10.5
  errorText: { flex: 1, color: colors.error, fontFamily: fonts.regular, fontSize: 11, lineHeight: 16 },
  errorClose: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  cardGap: { height: 10 },
  // Single-row card - surface1, no border, top-highlight consistent with roadmap cards
  collegeCard: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    backgroundColor: colors.surface1,
    marginHorizontal: spacing.screenPadding,
  },
  cardTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.cardHighlight,
  },
  collegeMain: { width: '100%', minHeight: 44 },
  // Single-row layout: ring | info | chevron
  collegeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  // Score ring label (inside the 52px ring)
  scoreRingValue: {
    fontFamily: fonts.jakartaExtraBold,
    fontWeight: '800',
    fontSize: 13,
    lineHeight: 15,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums' as const],
  },
  scoreColumn: { alignItems: 'center', gap: 3, flexShrink: 0 },
  scoreCaption: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: colors.textSecondary },
  scoreRingEmpty: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  // Info column: name on top, location + fit chip below
  collegeInfo: { flex: 1, minWidth: 0, gap: 4 },
  collegeMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  collegeName: {
    color: colors.text,
    fontFamily: fonts.jakartaBold,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: -0.15,
  },
  collegeLocation: {
    flexShrink: 1,
    minWidth: 0,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  fitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
  },
  fitDot: { width: 5, height: 5, borderRadius: 3 },
  fitLabel: { fontFamily: fonts.jakartaBold, fontSize: 11, fontWeight: '700' },

  // Remove from list - quiet destructive text button in expanded panel
  removeListBtn: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  removeListText: {
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 13,
    color: `${colors.error}CC`,
  },

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
  // 11px minimum - was 10.5
  insightErrorTitle: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 11, fontWeight: '600' },
  // 11px minimum - was 8.5
  insightErrorMessage: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 11, lineHeight: 16 },
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
  // 11px minimum - was 9
  retryText: { color: colors.accentLight, fontFamily: fonts.semiBold, fontSize: 11, fontWeight: '600' },

  insightContent: { gap: 12 },
  aiInsightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // 12px - was 11.5
  aiInsightTitle: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 12, fontWeight: '600' },
  // 12px (bodySm) - was 10.5
  narrative: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  actionSection: { gap: 8 },
  // 11px minimum - was 9
  actionSectionLabel: {
    fontSize: 11,
    fontFamily: fonts.jakartaBold,
    fontWeight: '700',
    color: colors.textMuted,
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
  // 11px minimum - was 7.5
  categoryBadgeText: { fontFamily: fonts.jakartaBold, fontSize: 11, fontWeight: '700' },
  priorityBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  // 11px minimum - was 7.5
  priorityBadgeText: { fontFamily: fonts.jakartaBold, fontSize: 11, fontWeight: '700' },
  // 11px minimum - was 10
  actionText: { color: colors.text, fontFamily: fonts.regular, fontSize: 11, lineHeight: 17 },
  insightMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  // 11px minimum - was 8.5
  insightMetaText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11 },
  cachedBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, borderWidth: 1, borderColor: colors.border },
  // 11px minimum - was 7.5
  cachedBadgeText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11, fontWeight: '500' },

  emptyWrap: { paddingHorizontal: spacing.screenPadding },
})
