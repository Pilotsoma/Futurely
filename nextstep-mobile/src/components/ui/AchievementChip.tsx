/**
 * AchievementChip — inline badge for a named achievement or milestone.
 *
 * All chips use the gold color regardless of which badge/icon is passed —
 * the icon itself conveys what the achievement is, color just marks it as
 * a gold-tier recognition signal. See DESIGN_SYSTEM.md: gold is reserved
 * exclusively for achievement/streak contexts.
 *
 * No backing data is wired yet. This component is built and exported but not
 * rendered anywhere until the achievement data layer is implemented.
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, fonts, radii, spacing, typography } from '../../theme/tokens'

interface AchievementChipProps {
  label: string
  icon: (props: { color: string; size: number }) => React.ReactNode
}

export function AchievementChip({ label, icon }: AchievementChipProps): React.JSX.Element {
  return (
    <View
      style={styles.chip}
      accessibilityLabel={`Achievement: ${label}`}
    >
      <View style={styles.iconWrap}>
        {icon({ color: colors.gold, size: 14 })}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    backgroundColor: colors.goldBg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: `${colors.gold}40`,  // gold at 25% opacity
    alignSelf: 'flex-start',
  },
  iconWrap: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.caption,
    fontFamily: fonts.bodyMedium,
    fontWeight: '500',
    color: colors.gold,
  },
})
