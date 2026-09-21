/**
 * StreakCard — displays the user's current study streak in days with a gold
 * treatment and relative "last active" label.
 *
 * No backing data is wired yet. This component is built and exported but not
 * rendered anywhere until the streak/achievement data layer is implemented.
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { FlameIcon } from '../icons'
import { Card } from './Card'
import { colors, fonts, spacing, typography } from '../../theme/tokens'

interface StreakCardProps {
  streakDays: number
  lastActiveAt: Date
}

function formatLastActive(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffHours < 1)   return 'Active just now'
  if (diffHours < 24)  return `Active ${diffHours}h ago`
  if (diffDays === 1)  return 'Active yesterday'
  return `Active ${diffDays} days ago`
}

export function StreakCard({ streakDays, lastActiveAt }: StreakCardProps): React.JSX.Element {
  return (
    <Card variant="glass" style={styles.card}>
      {/* Flame icon in gold badge */}
      <View style={styles.iconBadge}>
        <FlameIcon size={20} color={colors.gold} />
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.count}>{streakDays}</Text>
          <Text style={styles.unit}>day{streakDays !== 1 ? 's' : ''}</Text>
        </View>
        <Text style={styles.label}>Study streak</Text>
        <Text style={styles.meta}>{formatLastActive(lastActiveAt)}</Text>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.goldBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: { flex: 1, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  count: {
    ...typography.h1,
    fontFamily: fonts.displayBold,
    color: colors.gold,
  },
  unit: {
    ...typography.h3,
    fontFamily: fonts.displaySemiBold,
    color: colors.gold,
  },
  label: {
    ...typography.body,
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
  },
  meta: {
    ...typography.caption,
    color: colors.textFaint,
  },
})
