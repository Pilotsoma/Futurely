import React, { useCallback, useEffect, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { Circle, Svg } from 'react-native-svg'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import Text from '../components/ui/Text'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import ScreenHeader from '../components/ui/ScreenHeader'
import { colors } from '../constants/colors'
import { fetchRoadmap, type RoadmapData, type RoadmapMilestone } from '../api/roadmapApi'
import { CheckIcon, CircleIcon } from '../components/icons'
import { shadows } from '../constants/shadows'
import { useAuth } from '../context/AuthContext'

// ─── Circular progress ring ───────────────────────────────────────────────────

interface CircularRingProps {
  percent: number
}

function CircularRing({ percent }: CircularRingProps): React.JSX.Element {
  const SIZE = 120
  const STROKE = 10
  const RADIUS = (SIZE - STROKE) / 2
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  const clampedPercent = Math.min(100, Math.max(0, percent))
  const dashOffset = CIRCUMFERENCE * (1 - clampedPercent / 100)

  return (
    <View style={styles.ringContainer} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: clampedPercent }}>
      <Svg width={SIZE} height={SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
        {/* Track */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.border}
          strokeWidth={STROKE}
          fill="none"
        />
        {/* Fill */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.primary}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </Svg>
      {/* Center label */}
      <View style={styles.ringLabel}>
        <Text style={styles.ringPercent}>{clampedPercent.toFixed(0)}%</Text>
        <Text variant="caption" color={colors.textMuted}>done</Text>
      </View>
    </View>
  )
}

// ─── College-prep checklist ───────────────────────────────────────────────────

interface CheckItem {
  id: string
  label: string
}

const PREP_CHECKLIST: CheckItem[] = [
  { id: 'gpa',        label: 'Maintain 3.5+ GPA' },
  { id: 'sat',        label: 'Take the SAT / ACT' },
  { id: 'ap',         label: 'Complete at least 2 AP courses' },
  { id: 'volunteer',  label: 'Log 50+ volunteer hours' },
  { id: 'clubs',      label: 'Join 2 extracurricular clubs' },
  { id: 'tour',       label: 'Tour at least 3 colleges' },
  { id: 'fafsa',      label: 'Submit FAFSA by deadline' },
  { id: 'essays',     label: 'Draft college application essays' },
  { id: 'recs',       label: 'Request letters of recommendation' },
  { id: 'apply',      label: 'Submit college applications' },
]

function PrepChecklist({ userId }: { userId: number | null }): React.JSX.Element {
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const storageKey = `roadmap_checklist_${userId ?? 'anon'}`

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then(raw => {
        if (raw !== null) {
          const arr = JSON.parse(raw) as string[]
          setChecked(new Set(arr))
        }
      })
      .catch(err => {
        console.warn('[PrepChecklist] Failed to load checklist from storage:', err)
      })
  }, [storageKey])

  const toggle = useCallback((id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      AsyncStorage.setItem(storageKey, JSON.stringify([...next])).catch(err => {
        console.warn('[PrepChecklist] Failed to save checklist to storage:', err)
      })
      return next
    })
  }, [storageKey])

  const doneCount = checked.size
  const totalCount = PREP_CHECKLIST.length

  return (
    <View style={[styles.card, { marginTop: 12 }]}>
      <View style={styles.checklistHeader}>
        <Text variant="h3">College Prep Checklist</Text>
        <Text variant="caption" color={colors.textSecondary}>{doneCount}/{totalCount}</Text>
      </View>
      {PREP_CHECKLIST.map(item => {
        const isDone = checked.has(item.id)
        return (
          <TouchableOpacity
            key={item.id}
            style={styles.checkRow}
            onPress={() => toggle(item.id)}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isDone }}
            accessibilityLabel={item.label}
          >
            {isDone
              ? <CheckIcon size={20} color={colors.primary} />
              : <CircleIcon size={20} color={colors.border} />
            }
            <Text
              variant="body"
              style={[styles.checkLabel, isDone && styles.checkLabelDone]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton(): React.JSX.Element {
  return (
    <View style={{ padding: 20 }}>
      {[1, 2, 3].map(i => (
        <View key={i} style={[styles.card, { marginBottom: 12 }]}>
          <Skeleton width="50%" height={15} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={12} style={{ marginBottom: 8 }} />
          <Skeleton width="70%" height={11} />
        </View>
      ))}
    </View>
  )
}

// ─── Error view ───────────────────────────────────────────────────────────────

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }): React.JSX.Element {
  return (
    <View style={styles.centerState}>
      <Text variant="h3" color={colors.error} style={styles.stateText}>Unable to Load Roadmap</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.stateText}>{message}</Text>
      <Button label="Try Again" onPress={onRetry} />
    </View>
  )
}

// ─── Milestone row ────────────────────────────────────────────────────────────

function MilestoneRow({ milestone, isLast }: { milestone: RoadmapMilestone; isLast: boolean }): React.JSX.Element {
  const isCurrent = !milestone.done && !isLast
  return (
    <View style={styles.milestoneRow}>
      <View style={styles.milestoneLeft}>
        <View style={[
          styles.gradeCircle,
          milestone.done
            ? { backgroundColor: colors.primary }
            : isCurrent
              ? { borderWidth: 2, borderColor: colors.primary, backgroundColor: 'transparent' }
              : { backgroundColor: colors.border },
        ]}>
          {milestone.done && (
            <CheckIcon size={14} color={colors.background} />
          )}
          {!milestone.done && (
            <Text style={{ fontSize: 12, fontWeight: '700', color: isCurrent ? colors.primary : colors.textMuted }}>
              {milestone.grade}
            </Text>
          )}
        </View>
        {!isLast && <View style={styles.milestoneLine} />}
      </View>
      <View style={styles.milestoneContent}>
        <Text variant="h3" style={{ marginBottom: 4 }}>Grade {milestone.grade}</Text>
        <Text variant="caption">{milestone.label}</Text>
      </View>
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RoadmapScreen(): React.JSX.Element {
  const { user } = useAuth()
  const [data, setData] = useState<RoadmapData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      setData(await fetchRoadmap())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roadmap.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  const creditsCompleted = data?.creditsCompleted ?? 0
  const creditsRequired = data?.creditsRequired ?? 26
  const percentComplete = data?.percentComplete ?? 0
  const creditsByCategory = data?.creditsByCategory ?? {}
  const milestones = data?.milestones ?? []
  const activeCats = Object.entries(creditsByCategory).filter(([, v]) => v > 0)
  const maxCredits = Math.max(...Object.values(creditsByCategory), 1)

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Roadmap" />
      {isLoading ? (
        <LoadingSkeleton />
      ) : error !== null ? (
        <ErrorView message={error} onRetry={() => void load()} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ── Circular Credits Progress ── */}
          <View style={styles.card}>
            <Text variant="h3" style={{ marginBottom: 16 }}>Credits to Graduation</Text>
            <View style={styles.progressSection}>
              <CircularRing percent={percentComplete} />
              <View style={styles.progressDetails}>
                <Text variant="label" color={colors.textSecondary}>Completed</Text>
                <Text style={styles.creditValue}>{creditsCompleted}</Text>
                <Text variant="caption" color={colors.textMuted}>of {creditsRequired} credits</Text>
              </View>
            </View>
          </View>

          {/* ── Credits by Category ── */}
          <View style={[styles.card, { marginTop: 12 }]}>
            <Text variant="h3" style={{ marginBottom: 12 }}>Credits by Subject Area</Text>
            {activeCats.map(([cat, count]) => (
              <View key={cat} style={styles.catRow}>
                <Text variant="body" style={{ flex: 1 }}>{cat}</Text>
                <View style={styles.miniTrack}>
                  <View style={[styles.miniFill, { width: `${(count / maxCredits) * 100}%` as `${number}%` }]} />
                </View>
                <Text variant="caption" style={{ minWidth: 28, textAlign: 'right' }}>{count.toFixed(1)}</Text>
              </View>
            ))}
            {activeCats.length === 0 && (
              <Text variant="caption" color={colors.textMuted}>No credits completed yet</Text>
            )}
          </View>

          {/* ── College Prep Checklist ── */}
          <PrepChecklist userId={user?.id ?? null} />

          {/* ── Milestones ── */}
          <View style={[styles.card, { marginTop: 12 }]}>
            <Text variant="h3" style={{ marginBottom: 16 }}>High School Timeline</Text>
            {milestones.map((m, i) => (
              <MilestoneRow key={m.grade} milestone={m} isLast={i === milestones.length - 1} />
            ))}
          </View>

          {/* ── Goal ── */}
          <View style={[styles.card, { marginTop: 12, marginBottom: 40 }]}>
            <Text variant="h3" style={{ marginBottom: 12 }}>Your Plan</Text>
            <Text variant="body" style={{ marginBottom: 6 }}>
              Future goal:{' '}
              <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                {data?.futureDecision ?? 'Not set'}
              </Text>
            </Text>
            <Text variant="body" style={{ marginBottom: 6 }}>
              Expected graduation:{' '}
              <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                {data?.graduationYear ?? '—'}
              </Text>
            </Text>
            <Text variant="body">
              GPA: Unweighted {(data?.unweightedGpa ?? 0).toFixed(3)} | Weighted{' '}
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                {(data?.weightedGpa ?? 0).toFixed(3)}
              </Text>
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  stateText: { textAlign: 'center', marginBottom: 8 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  card: {
    ...shadows.raised,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  // Circular ring
  progressSection: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  ringContainer: { width: 120, height: 120, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  ringLabel: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringPercent: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  progressDetails: { flex: 1 },
  creditValue: { fontSize: 36, fontWeight: '700', color: colors.primary, marginVertical: 2 },
  // Credits by category
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  miniTrack: { flex: 2, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  miniFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  // Checklist
  checklistHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    minHeight: 44,
  },
  checkLabel: { flex: 1, fontSize: 14, color: colors.textPrimary },
  checkLabelDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  // Milestones
  milestoneRow: { flexDirection: 'row', marginBottom: 4 },
  milestoneLeft: { alignItems: 'center', marginRight: 14 },
  gradeCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  milestoneLine: { width: 2, flex: 1, backgroundColor: colors.border, minHeight: 16, marginVertical: 4 },
  milestoneContent: { flex: 1, paddingBottom: 20 },
})
