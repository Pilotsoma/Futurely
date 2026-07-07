import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRoute, type RouteProp } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import Text from '../components/ui/Text'
import Skeleton from '../components/ui/Skeleton'
import { colors } from '../constants/colors'
import {
  fetchCollegeInsights,
  type CollegeInsights,
  type CollegeInsightsStep,
  type InsightsFetchResult,
} from '../api/collegeInsightsApi'
import type { CollegeHelpParamList } from '../navigation/CollegeHelpNavigator'

// ── Constants matching the web implementation ──────────────────────────────────

const CATEGORY_COLORS: Record<CollegeInsightsStep['category'], string> = {
  test:            '#2979FF',
  gpa:             '#10B981',
  essay:           '#7C3AED',
  extracurricular: '#F97316',
  strategy:        '#00BCD4',
}

const PRIORITY_COLORS: Record<CollegeInsightsStep['priority'], string> = {
  high:   '#EF4444',
  medium: '#F59E0B',
  low:    '#52698A',
}

const PRIORITY_LABELS: Record<CollegeInsightsStep['priority'], string> = {
  high:   'High',
  medium: 'Med',
  low:    'Low',
}

type InsightsRouteParam = RouteProp<CollegeHelpParamList, 'CollegeInsights'>

// ── Helper: score → color ──────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return colors.success
  if (score >= 50) return colors.warning
  if (score >= 25) return colors.orange
  return colors.error
}

// ── Helper: label → color ──────────────────────────────────────────────────────

function labelColor(label: CollegeInsights['label']): string {
  switch (label) {
    case 'Likely':    return colors.success
    case 'Possible':  return colors.warning
    case 'Reach':     return colors.orange
    case 'Far Reach': return colors.error
    default:          return colors.textMuted
  }
}

// ── Helper: generatedAt → relative time label ──────────────────────────────────

function relativeTimeLabel(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) return 'just now'
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InsightsSkeleton(): React.JSX.Element {
  return (
    <View style={styles.skeletonContainer}>
      {/* Score badge skeleton */}
      <Skeleton width={80} height={32} radius={8} style={{ marginBottom: 16 }} />
      {/* Narrative lines */}
      <Skeleton width="100%" height={13} style={{ marginBottom: 8 }} />
      <Skeleton width="88%" height={13} style={{ marginBottom: 8 }} />
      <Skeleton width="72%" height={13} style={{ marginBottom: 24 }} />
      {/* Action steps */}
      {([80, 90, 65] as number[]).map((w, i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={52} height={22} radius={6} style={{ flexShrink: 0 }} />
          <Skeleton width={`${w}%`} height={13} style={{ flex: 1 }} />
        </View>
      ))}
    </View>
  )
}

interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

function InsightsErrorState({ message, onRetry }: ErrorStateProps): React.JSX.Element {
  return (
    <View style={styles.errorContainer}>
      <View style={styles.errorRow}>
        <Ionicons name="warning-outline" size={18} color={colors.warning} style={styles.errorIcon} />
        <Text variant="body" color={colors.textSecondary} style={styles.errorText}>
          {message}
        </Text>
      </View>
      {onRetry !== undefined && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={onRetry}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text variant="body" color={colors.primary}>Try again</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

interface CategoryBadgeProps {
  category: CollegeInsightsStep['category']
}

function CategoryBadge({ category }: CategoryBadgeProps): React.JSX.Element {
  const color = CATEGORY_COLORS[category]
  return (
    <View style={[
      styles.badge,
      { backgroundColor: `${color}22`, borderColor: `${color}55` },
    ]}>
      <Text style={[styles.badgeText, { color }]}>{category}</Text>
    </View>
  )
}

interface PriorityChipProps {
  priority: CollegeInsightsStep['priority']
}

function PriorityChip({ priority }: PriorityChipProps): React.JSX.Element {
  const color = PRIORITY_COLORS[priority]
  return (
    <View style={[
      styles.priorityChip,
      { backgroundColor: `${color}18`, borderColor: `${color}55` },
    ]}>
      <Text style={[styles.priorityChipText, { color }]}>
        {PRIORITY_LABELS[priority]}
      </Text>
    </View>
  )
}

interface InsightsContentProps {
  data: CollegeInsights
}

function InsightsContent({ data }: InsightsContentProps): React.JSX.Element {
  const timeLabel = relativeTimeLabel(data.generatedAt)

  return (
    <View>
      {/* Score + label badge */}
      {(data.score !== null || data.label !== null) && (
        <View style={styles.scoreBadgeRow}>
          {data.score !== null && (
            <View style={[styles.scoreBadge, { borderColor: scoreColor(data.score) }]}>
              <Text style={[styles.scoreNumber, { color: scoreColor(data.score) }]}>
                {data.score}
              </Text>
            </View>
          )}
          {data.label !== null && (
            <View style={[
              styles.labelBadge,
              { backgroundColor: `${labelColor(data.label)}22`, borderColor: `${labelColor(data.label)}55` },
            ]}>
              <Text style={[styles.labelText, { color: labelColor(data.label) }]}>
                {data.label}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Narrative summary */}
      <Text variant="body" style={styles.narrative}>{data.narrativeSummary}</Text>

      {/* Actionable steps */}
      {data.actionableSteps.length > 0 && (
        <View style={styles.stepsSection}>
          <Text variant="label" color={colors.textMuted} style={styles.stepsLabel}>
            Action Steps
          </Text>
          {data.actionableSteps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <CategoryBadge category={step.category} />
              <Text variant="body" style={styles.stepText}>{step.step}</Text>
              <PriorityChip priority={step.priority} />
            </View>
          ))}
        </View>
      )}

      {/* Metadata footer */}
      <View style={styles.metaRow}>
        <Text variant="caption" color={colors.textMuted}>Generated {timeLabel}</Text>
        {data.cached && (
          <View style={styles.cachedBadge}>
            <Text style={styles.cachedText}>cached</Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function CollegeInsightsScreen(): React.JSX.Element {
  const navigation = useNavigation()
  const route = useRoute<InsightsRouteParam>()
  const insets = useSafeAreaInsets()
  const { id, name, score: initialScore, label: initialLabel } = route.params

  const [result, setResult] = useState<InsightsFetchResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    const fetchResult = await fetchCollegeInsights(id)
    setResult(fetchResult)
    setIsLoading(false)
  }, [id])

  React.useEffect(() => {
    void load()
  }, [load])

  // Use fetched data for score/label if available, otherwise fall back to params
  const displayScore =
    result?.status === 'success' ? result.data.score : initialScore
  const displayLabel =
    result?.status === 'success' ? result.data.label : initialLabel

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text variant="h3" style={styles.headerTitle} numberOfLines={1}>{name}</Text>
          {/* Show score/label in header immediately from params while loading */}
          {(displayScore !== null || displayLabel !== null) && (
            <View style={styles.headerBadgeRow}>
              {displayScore !== null && (
                <Text variant="caption" color={scoreColor(displayScore)}>
                  {displayScore}
                </Text>
              )}
              {displayLabel !== null && (
                <Text variant="caption" color={labelColor(displayLabel)}>
                  {displayLabel}
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="analytics-outline" size={18} color={colors.primary} />
            <Text variant="h3" style={styles.cardTitle}>Admission Insights</Text>
            {isLoading && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
            )}
          </View>

          {isLoading && <InsightsSkeleton />}

          {!isLoading && result?.status === 'error-404' && (
            <InsightsErrorState
              message="We don't have enough admissions data for this college yet."
            />
          )}

          {!isLoading && result?.status === 'error-503' && (
            <InsightsErrorState
              message="Insights are temporarily unavailable — try again in a bit."
              onRetry={() => { void load() }}
            />
          )}

          {!isLoading && result?.status === 'success' && (
            <InsightsContent data={result.data} />
          )}
        </View>
      </ScrollView>
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 56,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    textAlign: 'center',
  },
  headerBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  headerSpacer: {
    width: 44,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    marginLeft: 8,
    flex: 1,
  },

  // Skeleton
  skeletonContainer: {
    gap: 0,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },

  // Error state
  errorContainer: {
    gap: 12,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  errorText: {
    flex: 1,
    lineHeight: 22,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 44,
    justifyContent: 'center',
  },

  // Score + label
  scoreBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  scoreBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
  labelBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Narrative
  narrative: {
    lineHeight: 24,
    color: colors.textPrimary,
  },

  // Steps
  stepsSection: {
    marginTop: 20,
  },
  stepsLabel: {
    marginBottom: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
    minHeight: 44,
  },
  stepText: {
    flex: 1,
    lineHeight: 22,
    color: colors.textPrimary,
    fontSize: 14,
  },

  // Category badge
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    flexShrink: 0,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Priority chip
  priorityChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    flexShrink: 0,
    marginTop: 2,
  },
  priorityChipText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Meta footer
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  cachedBadge: {
    backgroundColor: colors.surface2,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cachedText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
})
