import React, { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'

import * as roadmapApi from '../../api/roadmapApi'
import { ApiRequestError } from '../../api/client'
import { Card } from '../ui/Card'
import { ProgressRing } from '../ui/ProgressRing'
import { LoadingSkeleton } from '../ui/LoadingSkeleton'
import { ErrorRetryBlock } from '../ui/ErrorRetryBlock'
import type { Roadmap } from '../../types/roadmap'
import { colors, fonts, spacing, typography } from '../../theme/tokens'
import { FLOATING_TAB_CLEARANCE } from '../ui/tabBarConstants'

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

function isOnTrack(percentComplete: number, gradeLevel: number): boolean {
  const expected = ((gradeLevel - 9) / 4) * 100
  return percentComplete >= expected
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
    return <ErrorRetryBlock message={error ?? 'Could not load your roadmap.'} onRetry={reload} />
  }

  const categories = Object.entries(data.creditsByCategory).filter(([, credits]) => credits > 0)
  const remaining = data.creditsRequired - data.creditsCompleted
  const onTrack = isOnTrack(data.percentComplete, data.gradeLevel)

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Progress card */}
      <Card style={styles.progressCard}>
        <ProgressRing
          progress={data.percentComplete}
          size={112}
          strokeWidth={10}
          color={colors.accent2}
          trackColor="rgba(255,255,255,0.08)"
        >
          <View style={styles.ringCenter}>
            <Text style={styles.ringPct}>{data.percentComplete}%</Text>
            <Text style={styles.ringLabel}>to graduation</Text>
          </View>
        </ProgressRing>

        <View style={styles.progressInfo}>
          <Text style={styles.progressEyebrow}>GRADUATION PROGRESS</Text>
          <Text style={[styles.progressStatus, onTrack ? styles.statusOnTrack : styles.statusBehind]}>
            {onTrack ? 'On track' : 'Behind pace'}
          </Text>
          <Text style={styles.progressCaption}>
            {data.creditsCompleted} of {data.creditsRequired} credits complete.{' '}
            {remaining > 0 ? `${remaining} to go.` : 'Goal reached!'}
          </Text>
        </View>
      </Card>

      {/* GPA tiles */}
      <View style={styles.gpaRow}>
        <Card style={styles.gpaCard}>
          <Text style={styles.gpaLabel}>WEIGHTED GPA</Text>
          <Text style={styles.gpaValue}>{data.weightedGpa.toFixed(2)}</Text>
        </Card>
        <Card style={styles.gpaCard}>
          <Text style={styles.gpaLabel}>UNWEIGHTED GPA</Text>
          <Text style={styles.gpaValue}>{data.unweightedGpa.toFixed(2)}</Text>
        </Card>
      </View>

      {/* Credits by category */}
      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>CREDITS BY CATEGORY</Text>
        {categories.length > 0 ? (
          <>
            <View style={styles.pillWrap}>
              {categories.map(([cat, credits]) => (
                <View key={cat} style={styles.pill}>
                  <Text style={styles.pillName}>{cat}</Text>
                  <Text style={styles.pillCredits}> {credits} cr</Text>
                </View>
              ))}
            </View>
            <Card style={styles.totalCreditsCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total credits</Text>
                <Text style={styles.totalValue}>
                  {data.creditsCompleted} / {data.creditsRequired}
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.min(100, (data.creditsCompleted / Math.max(1, data.creditsRequired)) * 100)}%`,
                    },
                  ]}
                />
              </View>
            </Card>
          </>
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Connect your school account to see your transcript data here.
            </Text>
          </Card>
        )}
      </View>

      {/* 4-Year Timeline */}
      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>4-YEAR TIMELINE</Text>
        <View style={styles.timeline}>
          {data.milestones.map((milestone) => {
            const isCurrent = milestone.grade === data.gradeLevel && !milestone.done

            const squareBg = milestone.done
              ? 'rgba(16,185,129,0.16)'
              : isCurrent
                ? colors.primary
                : 'rgba(255,255,255,0.06)'

            const numberColor = milestone.done
              ? colors.success
              : isCurrent
                ? '#FFFFFF'
                : colors.textSecondary

            const cardBg = isCurrent
              ? 'rgba(41,121,255,0.10)'
              : 'rgba(255,255,255,0.03)'

            const cardBorder = isCurrent ? 'rgba(41,121,255,0.40)' : colors.border

            return (
              <View
                key={milestone.grade}
                style={[styles.milestoneCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
              >
                <View style={[styles.milestoneSquare, { backgroundColor: squareBg }]}>
                  <Text style={[styles.milestoneNum, { color: numberColor }]}>{milestone.grade}</Text>
                </View>

                <View style={styles.milestoneBody}>
                  <Text
                    style={[
                      styles.milestoneLabel,
                      isCurrent && styles.milestoneLabelCurrent,
                      !isCurrent && !milestone.done && styles.milestoneLabelFuture,
                    ]}
                    numberOfLines={2}
                  >
                    {milestone.label}
                  </Text>
                  <Text style={styles.milestoneGradeCaption}>
                    {ordinal(milestone.grade)} grade
                  </Text>
                </View>

                {milestone.done ? (
                  <Feather name="check" size={16} color={colors.success} />
                ) : isCurrent ? (
                  <View style={styles.nowChip}>
                    <Text style={styles.nowChipText}>Now</Text>
                  </View>
                ) : null}

              </View>
            )
          })}
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, paddingTop: spacing.lg },
  scroll: {
    gap: spacing.lg,
    paddingBottom: FLOATING_TAB_CLEARANCE,
  },

  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ringCenter: { alignItems: 'center' },
  ringPct: {
    ...typography.numeric,
    fontSize: 30,
    color: colors.text,
  },
  ringLabel: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  progressInfo: { flex: 1, gap: 4 },
  progressEyebrow: {
    ...typography.label,
    color: colors.textSecondary,
  },
  progressStatus: {
    fontSize: 15,
    fontFamily: fonts.jakartaBold,
    fontWeight: '700',
  },
  statusOnTrack: { color: colors.accent2 },
  statusBehind: { color: colors.warning },
  progressCaption: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 17,
  },

  gpaRow: { flexDirection: 'row', gap: spacing.sm },
  gpaCard: { flex: 1, gap: 4 },
  gpaLabel: { ...typography.label, color: colors.textSecondary },
  gpaValue: {
    ...typography.numeric,
    fontSize: 28,
    color: colors.text,
  },

  section: { gap: spacing.sm },
  sectionEyebrow: { ...typography.label, color: colors.textSecondary },

  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillName: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    color: colors.text,
  },
  pillCredits: {
    fontSize: 11,
    fontFamily: fonts.bold,
    fontWeight: '700',
    color: colors.accentLight,
  },

  totalCreditsCard: { gap: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13, fontFamily: fonts.medium, color: colors.text },
  totalValue: { fontSize: 13, fontFamily: fonts.bold, fontWeight: '700', color: colors.text },
  barTrack: {
    height: 8,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: colors.accent2,
  },

  emptyCard: {},
  emptyText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 19,
    textAlign: 'center',
  },

  timeline: { gap: spacing.sm },
  milestoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    padding: spacing.ms,
    borderRadius: 14,
    borderWidth: 1,
  },
  milestoneSquare: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  milestoneNum: {
    fontSize: 14,
    fontFamily: fonts.groteskBold,
    fontWeight: '700',
  },
  milestoneBody: { flex: 1 },
  milestoneLabel: {
    fontSize: 13,
    fontFamily: fonts.jakartaBold,
    fontWeight: '700',
    color: colors.text,
  },
  milestoneLabelCurrent: { color: colors.text },
  milestoneLabelFuture: { color: colors.textSecondary, fontFamily: fonts.regular, fontWeight: '400' },
  milestoneGradeCaption: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: 1,
  },

  nowChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  nowChipText: {
    fontSize: 10,
    fontFamily: fonts.jakartaBold,
    fontWeight: '700',
    color: colors.accentLight,
  },
})
