import React, { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg'

import * as roadmapApi from '../../api/roadmapApi'
import { ProgressRing } from '../ui/ProgressRing'
import { LoadingSkeleton } from '../ui/LoadingSkeleton'
import { ErrorRetryBlock } from '../ui/ErrorRetryBlock'
import { formatGpa } from '../../features/grades/academicSummary'
import { toUserMessage } from '../../utils/errorMessage'
import type { Roadmap } from '../../types/roadmap'
import { colors, fonts, radii, spacing, typography } from '../../theme/tokens'
import { SCROLL_BOTTOM_CLEARANCE } from '../ui/tabBarConstants'

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

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
          if (!cancelled) setError(toUserMessage(err, "We couldn't load your roadmap."))
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

function isOnTrack(percentComplete: number, gradeLevel: number): boolean {
  const expected = ((gradeLevel - 9) / 4) * 100
  return percentComplete >= expected
}

const CATEGORY_COLORS = [
  colors.primary,
  colors.accent2,
  colors.purple,
  colors.success,
  colors.warning,
  colors.accentLight,
]

/** Shared surface treatment for all section cards - surface1, xxl radius, top-highlight */
function CardHighlight(): React.JSX.Element {
  return <View style={styles.cardHighlightBar} pointerEvents="none" />
}

export function RoadmapPanel(): React.JSX.Element {
  const { data, loading, error, reload } = useRoadmap()

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <LoadingSkeleton rows={4} />
      </View>
    )
  }

  if (error || !data) {
    return <ErrorRetryBlock message={error ?? "We couldn't load your roadmap."} onRetry={reload} />
  }

  const categories = Object.entries(data.creditsByCategory).filter(([, credits]) => credits > 0)
  const remaining = Math.max(0, data.creditsRequired - data.creditsCompleted)
  // "On track" is a claim about credits: only make it when credit data exists.
  const hasCreditData = categories.length > 0 || data.creditsCompleted > 0
  const onTrack = isOnTrack(data.percentComplete, data.gradeLevel)
  const statusColor = onTrack ? colors.success : colors.warning
  const barTotal = Math.max(1, data.creditsRequired, data.creditsCompleted)

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* ─── Hero KPI card - surface1, xxl radius, no border, top-highlight ─── */}
      <View style={styles.heroCard}>
        <CardHighlight />

        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={styles.cardLabel}>Graduation progress</Text>
            <View style={styles.heroValueRow}>
              <Text style={styles.heroValue}>{data.creditsCompleted}</Text>
              <Text style={styles.heroValueOf}>/{data.creditsRequired}</Text>
            </View>
            <Text style={styles.heroCaption}>
              {remaining > 0 ? `credits earned · ${remaining} to go` : 'All credits earned'}
            </Text>
            {hasCreditData ? (
              <View style={[styles.statusPill, { backgroundColor: `${statusColor}1F` }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {onTrack ? 'On track' : 'Behind pace'}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Radial glow behind ring + gradient-stroke ProgressRing */}
          <View style={styles.ringGlowWrap}>
            <Svg style={StyleSheet.absoluteFill} width={110} height={110} pointerEvents="none">
              <Defs>
                <RadialGradient id="heroGlow" cx="55" cy="55" r="55" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={colors.accent2} stopOpacity="0.22" />
                  <Stop offset="0.5" stopColor={colors.primary} stopOpacity="0.08" />
                  <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="110" height="110" fill="url(#heroGlow)" />
            </Svg>
            <ProgressRing
              progress={data.percentComplete}
              size={96}
              strokeWidth={9}
              color={colors.accent2}
              trackColor="rgba(255,255,255,0.07)"
              gradientColors={[colors.accent2, colors.primary]}
            >
              <Text style={styles.ringPct}>{data.percentComplete}%</Text>
            </ProgressRing>
          </View>
        </View>

        <View style={styles.hDivider} />

        {/* Three-metric row - unweighted first, same order and precision as Grades.
            The API can send null for a GPA that has not been calculated yet. */}
        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{formatGpa(data.unweightedGpa ?? null)}</Text>
            <Text style={styles.metricLabel}>Unweighted</Text>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{formatGpa(data.weightedGpa ?? null)}</Text>
            <Text style={styles.metricLabel}>Weighted</Text>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValueGrade}>{ordinal(data.gradeLevel)}</Text>
            <Text style={styles.metricLabel}>Grade</Text>
          </View>
        </View>
      </View>

      {/* ─── Credits by category - surface1, xxl radius, no border ─── */}
      <View style={styles.sectionCard}>
        <CardHighlight />
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Credits by category</Text>
          <Text style={styles.cardMeta}>
            {data.creditsCompleted} of {data.creditsRequired}
          </Text>
        </View>
        {categories.length > 0 ? (
          <>
            <View style={styles.stackTrack}>
              {categories.map(([cat, credits], i) => (
                <View
                  key={cat}
                  style={{
                    width: `${(credits / barTotal) * 100}%`,
                    backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                  }}
                />
              ))}
            </View>
            <View style={styles.legend}>
              {categories.map(([cat, credits], i) => (
                <View key={cat} style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }]}
                  />
                  <Text style={styles.legendName} numberOfLines={1}>
                    {cat}
                  </Text>
                  <Text style={styles.legendValue}>{credits}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.emptyText}>
            Connect your school account to see your transcript data here.
          </Text>
        )}
      </View>

      {/* ─── 4-year plan - surface1, xxl radius, no border ─── */}
      <View style={styles.sectionCard}>
        <CardHighlight />
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>4-year plan</Text>
          {data.graduationYear ? <Text style={styles.cardMeta}>Class of {data.graduationYear}</Text> : null}
        </View>
        <View>
          {data.milestones.map((milestone, i) => {
            const isCurrent = milestone.grade === data.gradeLevel && !milestone.done
            const isLast = i === data.milestones.length - 1
            return (
              <View key={milestone.grade} style={styles.step}>
                <View style={styles.rail}>
                  <View
                    style={[
                      styles.node,
                      milestone.done && styles.nodeDone,
                      isCurrent && styles.nodeCurrent,
                    ]}
                  >
                    {milestone.done ? (
                      <Feather name="check" size={14} color="#FFFFFF" />
                    ) : (
                      <Text style={[styles.nodeText, isCurrent && styles.nodeTextCurrent]}>
                        {milestone.grade}
                      </Text>
                    )}
                  </View>
                  {!isLast ? (
                    <View style={[styles.connector, milestone.done && styles.connectorDone]} />
                  ) : null}
                </View>

                <View style={[styles.stepBody, !isLast && styles.stepBodySpaced]}>
                  <View style={styles.stepMetaRow}>
                    {/* Sentence-case 12px muted - no uppercase, cleaner than eyebrow */}
                    <Text style={styles.stepGrade}>{ordinal(milestone.grade)} grade</Text>
                    {isCurrent ? (
                      <View style={styles.nowChip}>
                        <Text style={styles.nowChipText}>Now</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[styles.stepLabel, !isCurrent && !milestone.done && styles.stepLabelFuture]}
                    numberOfLines={2}
                  >
                    {milestone.label}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>
      </View>

    </ScrollView>
  )
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, paddingTop: spacing.lg, paddingHorizontal: spacing.screenPadding },
  scroll: {
    gap: spacing.sectionGap,          // 24px between all sections
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: SCROLL_BOTTOM_CLEARANCE,
  },

  // ── Shared surface treatment (all cards) ──────────────────────────────────
  // 1px top-edge highlight inside overflow:hidden - simulates a subtle light source
  cardHighlightBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.cardHighlight,
  },

  // ── Hero card ─────────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: colors.surface1,
    borderRadius: radii.xxl,
    padding: spacing.cardPadding,
    gap: spacing.md,
    overflow: 'hidden',
  },

  cardLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  heroCopy: { flex: 1, alignItems: 'flex-start' },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6 },
  heroValue: { ...typography.numeric, fontSize: 40, lineHeight: 44, color: colors.text },
  heroValueOf: { ...typography.numeric, fontSize: 20, color: colors.textMuted, marginLeft: 2 },
  heroCaption: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11.5, fontFamily: fonts.jakartaBold, fontWeight: '700' },

  // Ring glow wrapper - 110px so the radial glow visually bleeds outside the 96px ring
  ringGlowWrap: {
    width: 110,
    height: 110,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct: { ...typography.numeric, fontSize: 20, color: colors.text },

  hDivider: { height: 1, backgroundColor: colors.borderSubtle },

  // ── Metric row - equal 20px sizes, muted labels ───────────────────────────
  metricRow: { flexDirection: 'row', alignItems: 'center' },
  metric: { flex: 1, alignItems: 'center', gap: 2 },
  // Both GPA values: numericSm (20px), full text color
  metricValue: { ...typography.numericSm, color: colors.text },
  // Grade level: same size, slightly muted (less actionable than GPA)
  metricValueGrade: { ...typography.numericSm, color: colors.textSecondary },
  metricLabel: { fontSize: 11, fontFamily: fonts.medium, color: colors.textSecondary },
  vDivider: { width: 1, height: 32, backgroundColor: colors.borderSubtle },

  // ── Section cards (Credits + 4-year plan) - same surface1 treatment as hero ──
  sectionCard: {
    backgroundColor: colors.surface1,
    borderRadius: radii.xxl,
    padding: spacing.cardPadding,
    gap: spacing.md,
    overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: {
    fontSize: 15,
    fontFamily: fonts.jakartaBold,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  cardMeta: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },

  // Credits stacked bar
  stackTrack: {
    flexDirection: 'row',
    gap: 3,
    height: 10,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  legendItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 16 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendName: { flex: 1, ...typography.bodySm, color: colors.textSecondary },
  legendValue: { ...typography.numeric, fontSize: 13, letterSpacing: 0, color: colors.text },

  emptyText: { ...typography.bodySm, color: colors.textSecondary },

  // ── Stepper ───────────────────────────────────────────────────────────────
  step: { flexDirection: 'row', gap: spacing.ms },
  rail: { alignItems: 'center', width: 32 },
  node: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  nodeDone: { backgroundColor: colors.success, borderColor: colors.success },
  nodeCurrent: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 4,
    backgroundColor: colors.primary,
    borderColor: colors.primaryGlow,
  },
  nodeText: { ...typography.numeric, fontSize: 12, letterSpacing: 0, color: colors.textMuted },
  nodeTextCurrent: { color: '#FFFFFF' },
  connector: { flex: 1, width: 2, marginVertical: 4, borderRadius: 1, backgroundColor: colors.border },
  connectorDone: { backgroundColor: `${colors.success}80` },

  stepBody: { flex: 1, paddingTop: 4 },
  stepBodySpaced: { paddingBottom: 20 },
  stepMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Sentence-case 12px muted - was uppercase eyebrow; this is cleaner for a timeline
  stepGrade: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  stepLabel: {
    marginTop: 2,
    fontSize: 15,
    fontFamily: fonts.jakartaSemiBold,
    fontWeight: '600',
    color: colors.text,
  },
  stepLabelFuture: { color: colors.textSecondary },

  nowChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, backgroundColor: colors.primaryDim },
  nowChipText: { fontSize: 11, fontFamily: fonts.jakartaBold, fontWeight: '700', color: colors.accentLight },
})
