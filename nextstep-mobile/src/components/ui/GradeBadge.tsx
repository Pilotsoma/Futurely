import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, fonts, getGradeTierColor } from '../../theme/tokens'

type TierVariant = 'reach' | 'target' | 'safety'

interface GradeBadgeProps {
  /** Letter grade string (e.g. 'A', 'B+', 'C-'). Ignored when `tier` is provided. */
  letter?: string | null
  size?: 'sm' | 'lg'
  /** Optional direct color override — takes precedence over both `letter` and `tier`. */
  color?: string
  /**
   * School-tier fit mode — maps directly to the tier traffic-light colors.
   * reach → tierRed, target → tierAmber, safety → tierGreen.
   * When provided, `letter` is used only as the display label (not for color).
   */
  tier?: TierVariant
}

function getTierColor(tier: TierVariant): { color: string; bg: string } {
  switch (tier) {
    case 'safety': return { color: colors.tierGreen, bg: colors.tierGreenBg }
    case 'target': return { color: colors.tierAmber, bg: colors.tierAmberBg }
    case 'reach':  return { color: colors.tierRed,   bg: colors.tierRedBg }
  }
}

function resolveColor(
  letter: string | null | undefined,
  tier: TierVariant | undefined,
  colorOverride: string | undefined,
): { color: string; bg: string } {
  if (colorOverride !== undefined) {
    return { color: colorOverride, bg: `${colorOverride}29` }
  }
  if (tier !== undefined) {
    return getTierColor(tier)
  }
  if (letter && letter.trim().length > 0) {
    return getGradeTierColor(letter)
  }
  return { color: colors.textFaint, bg: colors.cardBorder }
}

export function GradeBadge({
  letter,
  size = 'sm',
  color: colorOverride,
  tier,
}: GradeBadgeProps): React.JSX.Element {
  const { color, bg } = resolveColor(letter, tier, colorOverride)
  const dimension = size === 'lg' ? 40 : 28
  const displayLabel = letter ?? (tier !== undefined ? tier.charAt(0).toUpperCase() : '—')

  return (
    <View
      style={[
        styles.badge,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          borderColor: color,
          backgroundColor: bg,
        },
      ]}
      accessibilityLabel={
        tier !== undefined
          ? `${tier} school tier`
          : letter
          ? `Grade ${letter}`
          : 'No grade available'
      }
    >
      <Text style={[styles.text, { color, fontSize: size === 'lg' ? 18 : 13 }]}>
        {displayLabel}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontFamily: fonts.displayBold, fontWeight: '700' },
})
