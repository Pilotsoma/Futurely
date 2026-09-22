import React, { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Feather } from '@expo/vector-icons'

import * as roadmapApi from '../../api/roadmapApi'
import * as collegesApi from '../../api/collegesApi'
import { ApiRequestError } from '../../api/client'
import { Screen } from '../../components/ui/Screen'
import { Card } from '../../components/ui/Card'
import { ListRow } from '../../components/ui/ListRow'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { GradeBadge } from '../../components/ui/GradeBadge'
import { LoadingSkeleton } from '../../components/ui/Skeleton'
import { ErrorRetryBlock } from '../../components/ui/ErrorRetryBlock'
import type { Roadmap } from '../../types/roadmap'
import type { CollegeListItem } from '../../types/colleges'
import type { MainTabParamList } from '../../navigation/MainNavigator'
import type { MainStackParamList } from '../../navigation/MainStack'
import { colors, fonts, gradients, radii, spacing, typography } from '../../theme/tokens'

type FeatherName = React.ComponentProps<typeof Feather>['name']

type CollegeTier = 'reach' | 'target' | 'safety'

const CATEGORY_ICON: Record<string, FeatherName> = {
  English: 'book-open',
  Math: 'percent',
  Science: 'activity',
  'Social Studies': 'globe',
  Language: 'message-circle',
  'Fine Arts': 'image',
  'PE / Health': 'heart',
  Electives: 'star',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

function classifyCollegeTier(label: string | null): CollegeTier | null {
  const lower = (label ?? '').toLowerCase()
  if (lower.includes('safety')) return 'safety'
  if (lower.includes('target') || lower.includes('match')) return 'target'
  if (lower.includes('reach')) return 'reach'
  return null
}

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------

// Endpoint is a plain DB-backed read (not a HAC/PowerSchool portal scrape), so this
// intentionally doesn't reuse usePortalFetch — that hook's UNSUPPORTED-portal branch
// doesn't apply here. Mirrors the same cancellation-guard pattern it demonstrates.
function useRoadmap(): { data: Roadmap | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<Roadmap | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      setLoading(true)
      setError(null)

      roadmapApi
        .getRoadmap()
        .then((result) => {
          if (!cancelled) setData(result)
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof ApiRequestError ? err.message : 'Something went wrong.')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })

      return () => {
        cancelled = true
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadKey]),
  )

  return { data, loading, error, reload: () => setReloadKey((k) => k + 1) }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RoadmapScreen(): React.JSX.Element {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>()
  const { data, loading, error, reload } = useRoadmap()

  // Saved colleges — for the suggested-colleges section at the bottom
  const [savedColleges, setSavedColleges] = useState<CollegeListItem[]>([])
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      collegesApi
        .listSavedColleges()
        .then((result) => { if (!cancelled) setSavedColleges(result) })
        .catch(() => { /* non-critical; colleges section is omitted when unavailable */ })
      return () => { cancelled = true }
    }, []),
  )

  // Group saved colleges by tier (only those with parseable labels)
  const tieredColleges: { tier: CollegeTier; item: CollegeListItem }[] = savedColleges
    .map((item) => {
      const tier = classifyCollegeTier(item.label)
      return tier ? { tier, item } : null
    })
    .filter((x): x is { tier: CollegeTier; item: CollegeListItem } => x !== null)

  // Sort: reach first, then target, then safety (shows most competitive first)
  const TIER_ORDER: Record<CollegeTier, number> = { reach: 0, target: 1, safety: 2 }
  const sortedColleges = [...tieredColleges].sort(
    (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier],
  )
  const previewColleges = sortedColleges.slice(0, 3)

  if (loading) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <LoadingSkeleton rows={4} />
      </Screen>
    )
  }

  if (error || !data) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <ErrorRetryBlock message={error ?? 'Could not load your roadmap.'} onRetry={reload} />
      </Screen>
    )
  }

  const categories = Object.entries(data.creditsByCategory).filter(([, credits]) => credits > 0)
  const classOfYear = data.graduationYear

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero gradient card */}
        <Card variant="gradient" gradientColors={gradients.hero} style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroEyebrow}>GRADUATION PROGRESS</Text>
              <Text style={styles.heroTitle}>
                {ordinal(data.gradeLevel)} Grade
                {classOfYear ? ` · Class of ${classOfYear}` : ''}
              </Text>
              <Text style={styles.heroSubtitle}>Your academic roadmap</Text>
            </View>
            <ProgressRing progress={data.percentComplete} size={76} strokeWidth={7}>
              <Text style={styles.ringText}>{data.percentComplete}%</Text>
            </ProgressRing>
          </View>
          <View style={styles.heroCreditsRow}>
            <Feather name="award" size={14} color="rgba(255,255,255,0.86)" />
            <Text style={styles.heroCreditsText}>
              {data.creditsCompleted} of {data.creditsRequired} credits completed
            </Text>
          </View>
        </Card>

        {/* GPA pair */}
        <View style={styles.gpaRow}>
          <Card style={styles.gpaCard}>
            <Text style={styles.gpaLabel}>Unweighted GPA</Text>
            <Text style={styles.gpaValue}>{data.unweightedGpa.toFixed(3)}</Text>
          </Card>
          <Card style={styles.gpaCard}>
            <Text style={styles.gpaLabel}>Weighted GPA</Text>
            <Text style={[styles.gpaValue, styles.gpaValueAccent]}>{data.weightedGpa.toFixed(3)}</Text>
          </Card>
        </View>

        {/* Credits by subject */}
        {categories.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Credits by subject</Text>
            {categories.map(([category, credits]) => (
              <ListRow
                key={category}
                leading={
                  <View style={styles.categoryIcon}>
                    <Feather name={CATEGORY_ICON[category] ?? 'book'} size={16} color={colors.accent} />
                  </View>
                }
                title={category}
                trailingValue={`${credits} cr`}
              />
            ))}
          </View>
        ) : null}

        {/* Milestones timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Milestones</Text>
          <View style={styles.timeline}>
            {data.milestones.map((milestone, index) => {
              const isLast = index === data.milestones.length - 1
              const isCurrent = milestone.grade === data.gradeLevel
              return (
                <View key={milestone.grade} style={styles.timelineRow}>
                  <View style={styles.timelineMarkerCol}>
                    <View
                      style={[
                        styles.timelineMarker,
                        milestone.done && styles.timelineMarkerDone,
                        isCurrent && !milestone.done && styles.timelineMarkerCurrent,
                      ]}
                    >
                      {milestone.done ? <Feather name="check" size={11} color={colors.bg} /> : null}
                    </View>
                    {!isLast ? (
                      <View style={[styles.timelineLine, milestone.done && styles.timelineLineDone]} />
                    ) : null}
                  </View>
                  <View style={styles.timelineBody}>
                    <Text style={styles.timelineGrade}>{ordinal(milestone.grade)} Grade</Text>
                    <Text style={styles.timelineLabel}>{milestone.label}</Text>
                  </View>
                </View>
              )
            })}
          </View>
        </View>

        {/* Suggested colleges — only shown when the student has saved colleges with tier labels */}
        {previewColleges.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Your college list</Text>
              {savedColleges.length > 3 ? (
                <Pressable
                  onPress={() =>
                    navigation
                      .getParent<NativeStackNavigationProp<MainStackParamList>>()
                      ?.navigate('Colleges')
                  }
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="See all colleges"
                >
                  <Text style={styles.seeAllText}>See all {savedColleges.length} →</Text>
                </Pressable>
              ) : null}
            </View>
            {previewColleges.map(({ tier, item }) => (
              <View key={item.id} style={styles.collegeRow}>
                <GradeBadge tier={tier} size="sm" />
                <View style={styles.collegeInfo}>
                  <Text style={styles.collegeName} numberOfLines={1}>{item.name}</Text>
                  {item.city && item.state ? (
                    <Text style={styles.collegeMeta}>{item.city}, {item.state}</Text>
                  ) : null}
                </View>
              </View>
            ))}
            {previewColleges.length === sortedColleges.length && previewColleges.length > 0 ? (
              <Pressable
                style={styles.seeAllRow}
                onPress={() =>
                  navigation
                    .getParent<NativeStackNavigationProp<MainStackParamList>>()
                    ?.navigate('Colleges')
                }
                accessibilityRole="button"
                accessibilityLabel="View your full college list"
              >
                <Text style={styles.seeAllRowText}>Manage college list</Text>
                <Feather name="arrow-right" size={13} color={colors.accent} />
              </Pressable>
            ) : null}
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
  scroll: {
    paddingVertical: spacing.lg,
    paddingBottom: 104,
    gap: spacing.lg,
  },

  // Hero card
  heroCard: { gap: spacing.md },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroEyebrow: { ...typography.label, color: 'rgba(255,255,255,0.72)' },
  heroTitle: { ...typography.h1, color: '#FFFFFF', marginTop: 4, flexShrink: 1, flexWrap: 'wrap' },
  heroSubtitle: { ...typography.caption, color: 'rgba(255,255,255,0.72)', marginTop: 2 },
  ringText: { ...typography.h3, fontSize: 15, color: '#FFFFFF' },
  heroCreditsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  heroCreditsText: { ...typography.caption, color: 'rgba(255,255,255,0.86)' },

  // GPA row
  gpaRow: { flexDirection: 'row', gap: spacing.sm },
  gpaCard: { flex: 1, gap: 4 },
  gpaLabel: { ...typography.caption, color: colors.textDim },
  gpaValue: { ...typography.h2, color: colors.text },
  gpaValueAccent: { color: colors.accent },

  // Sections
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.label, color: colors.textDim },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seeAllText: {
    ...typography.caption,
    color: colors.accent,
    fontFamily: fonts.bodyMedium,
  },

  // Category icon
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Timeline
  timeline: { paddingTop: spacing.xs },
  timelineRow: { flexDirection: 'row', gap: spacing.ms },
  timelineMarkerCol: { alignItems: 'center', width: 22 },
  timelineMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardFallback,
  },
  timelineMarkerDone: { backgroundColor: colors.tierGreen, borderColor: colors.tierGreen },
  timelineMarkerCurrent: { borderColor: colors.accent },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
    backgroundColor: colors.cardBorder,
    marginVertical: 2,
  },
  timelineLineDone: { backgroundColor: colors.tierGreen },
  timelineBody: { flex: 1, paddingBottom: spacing.lg },
  timelineGrade: {
    ...typography.h3,
    fontSize: 14.5,
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
  },
  timelineLabel: { ...typography.caption, color: colors.textDim, marginTop: 2 },

  // Colleges section
  collegeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.ms,
    borderRadius: radii.input,
    backgroundColor: colors.cardFallback,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  collegeInfo: { flex: 1, minWidth: 0 },
  collegeName: { ...typography.h3, fontSize: 14, color: colors.text },
  collegeMeta: { ...typography.caption, color: colors.textDim, marginTop: 2 },
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  seeAllRowText: {
    ...typography.caption,
    fontFamily: fonts.bodyMedium,
    color: colors.accent,
  },
})
