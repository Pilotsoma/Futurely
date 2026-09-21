import React from 'react'
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg'
import { BlurView } from 'expo-blur'
import {
  cardInsetHighlight,
  colors,
  elevation,
  gradients,
  radii,
  spacing,
} from '../../theme/tokens'

interface CardProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  /**
   * 'default'  — solid surface card (backward-compatible default)
   * 'gradient' — diagonal hero fill via react-native-svg (no expo-linear-gradient dep)
   * 'glass'    — frosted glass via expo-blur + semi-transparent overlay
   */
  variant?: 'default' | 'gradient' | 'glass'
  /** Gradient stop colors for `variant="gradient"`. Defaults to tokens.gradients.hero. */
  gradientColors?: readonly [string, string]
  /** Corner radius — must match `style`'s borderRadius if overridden. */
  radius?: number
  /**
   * Glass variant only: disable BlurView and fall back to a solid `cardFallback`
   * background. Useful for Android contexts where blur has a meaningful perf cost.
   */
  disableBlur?: boolean
}

export function Card({
  children,
  style,
  variant = 'default',
  gradientColors = gradients.hero,
  radius = radii.card,
  disableBlur = false,
}: CardProps): React.JSX.Element {
  if (variant === 'gradient') {
    // `style` goes on the content layer (gap/padding/alignItems, etc.) so that
    // caller overrides apply to layout, not the gradient clip wrapper.
    return (
      <View style={[styles.gradientCard, { borderRadius: radius }]}>
        <Svg style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Defs>
            <LinearGradient id="cardGradient" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={gradientColors[0]} stopOpacity={1} />
              <Stop offset="1" stopColor={gradientColors[1]} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#cardGradient)" />
        </Svg>
        <View style={[styles.gradientContent, style]}>{children}</View>
      </View>
    )
  }

  if (variant === 'glass') {
    return (
      <View style={[styles.glassOuter, { borderRadius: radius }, elevation.card]}>
        {/* Blur layer — absolute fill, clipped to the outer border radius */}
        {!disableBlur && (
          <BlurView
            intensity={18}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
          />
        )}
        {/* Content + frosted overlay */}
        <View
          style={[
            styles.glassInner,
            {
              borderRadius: radius,
              backgroundColor: disableBlur ? colors.cardFallback : colors.cardFill,
            },
            cardInsetHighlight,
            style,
          ]}
        >
          {children}
        </View>
      </View>
    )
  }

  return <View style={[styles.card, { borderRadius: radius }, style]}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardFallback,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.card,
    padding: spacing.cardPadding,
  },
  gradientCard: {
    overflow: 'hidden',
    borderWidth: 0.8,
    borderColor: 'rgba(76, 124, 255, 0.25)',
  },
  gradientContent: {
    padding: spacing.cardPadding,
  },
  glassOuter: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  glassInner: {
    padding: spacing.cardPadding,
  },
})
