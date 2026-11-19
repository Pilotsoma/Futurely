/**
 * StatBlock
 *
 * A pure typographic stat block: a numeric value over a descriptor label.
 * No card background — floats above whatever surface it sits on.
 *
 * Props:
 *   value    string | number          — numeric value (pre-formatted by caller)
 *   label    string                   — descriptor below the number
 *   size?    'hero' | 'lg' | 'md' | 'sm'
 *                                      maps to numericHero(44) / numericLg(34) /
 *                                      numericMd(26) / numericSm(20)
 *   color?   string                   — optional accent color for the value text
 *   style?   StyleProp<ViewStyle>     — outer container override
 */

import React from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { colors, fonts, typography } from '../../theme/tokens'

type StatBlockSize = 'hero' | 'lg' | 'md' | 'sm'

interface StatBlockProps {
  value: string | number
  label: string
  size?: StatBlockSize
  color?: string
  style?: StyleProp<ViewStyle>
  /** Optional testID applied to the value Text element for e2e selectors. */
  testID?: string
}

const valueFontSize: Record<StatBlockSize, number> = {
  hero: typography.numericHero.fontSize,
  lg: typography.numericLg.fontSize,
  md: typography.numericMd.fontSize,
  sm: typography.numericSm.fontSize,
}

const valueLineHeight: Record<StatBlockSize, number> = {
  hero: typography.numericHero.lineHeight,
  lg: typography.numericLg.lineHeight,
  md: typography.numericMd.lineHeight,
  sm: typography.numericSm.lineHeight,
}

const valueLetterSpacing: Record<StatBlockSize, number> = {
  hero: typography.numericHero.letterSpacing,
  lg: typography.numericLg.letterSpacing,
  md: typography.numericMd.letterSpacing,
  sm: typography.numericSm.letterSpacing,
}

export function StatBlock({
  value,
  label,
  size = 'md',
  color,
  style,
  testID,
}: StatBlockProps): React.JSX.Element {
  return (
    <View style={[styles.container, style]}>
      <Text
        testID={testID}
        style={[
          styles.value,
          {
            fontSize: valueFontSize[size],
            lineHeight: valueLineHeight[size],
            letterSpacing: valueLetterSpacing[size],
          },
          color !== undefined ? { color } : undefined,
        ]}
        numberOfLines={1}
      >
        {String(value)}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  value: {
    fontFamily: fonts.jakartaExtraBold,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 12,
    fontFamily: fonts.regular,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
})
