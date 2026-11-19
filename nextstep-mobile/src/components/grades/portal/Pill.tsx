import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, fonts, spacing, typography } from '../../../theme/tokens'

type PillTone = 'neutral' | 'success' | 'warning' | 'error' | 'info'

interface PillProps {
  label: string
  tone?: PillTone
}

const TONE_COLOR: Record<Exclude<PillTone, 'neutral'>, string> = {
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
  info: colors.accentLight,
}

// A small status or score chip. The tone never carries meaning alone: the label is always text.
export function Pill({ label, tone = 'neutral' }: PillProps): React.JSX.Element {
  const toneColor = tone === 'neutral' ? colors.textSecondary : TONE_COLOR[tone]
  // 0x24 is 14% alpha, the same tint strength as colors.primaryDim.
  const fill = tone === 'neutral' ? 'rgba(255,255,255,0.06)' : `${toneColor}24`
  return (
    <View style={[styles.pill, { backgroundColor: fill }]}>
      <Text style={[styles.text, { color: toneColor }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    height: 24,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...typography.bodySm,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
})
