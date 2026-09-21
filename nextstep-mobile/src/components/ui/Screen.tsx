import React, { useEffect } from 'react'
import { StyleSheet, ViewStyle } from 'react-native'
import { Edge, SafeAreaView } from 'react-native-safe-area-context'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg'
import { animation, colors, spacing } from '../../theme/tokens'
import { useDisplayPreferences } from '../../preferences/displayPreferences'

interface ScreenProps {
  children: React.ReactNode
  padded?: boolean
  /** Screens rendered under a navigator header already get top-inset handling from the header itself. */
  edges?: readonly Edge[]
  style?: ViewStyle
}

export function Screen({
  children,
  padded = true,
  edges = ['left', 'right', 'bottom'],
  style,
}: ScreenProps): React.JSX.Element {
  const systemReduceMotion = useReducedMotion()
  const { reduceMotion: preferenceReduceMotion } = useDisplayPreferences()
  const reduceMotion = systemReduceMotion || preferenceReduceMotion
  const progress = useSharedValue(reduceMotion ? 1 : 0)

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1
      return
    }
    // One-shot mount entrance, mirroring web's `.fade-up` page-entrance animation.
    progress.value = withTiming(1, { duration: animation.durSlow, easing: Easing.out(Easing.cubic) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 12 }],
  }))

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {/* Background glow — two soft radial blooms anchored top-left (accent blue)
          and top-right (accent2 teal) at 10-14% opacity, fading into the navy base.
          viewBox 0 0 400 800 with xMidYMid slice scales correctly to any screen size.
          Gradient IDs are scoped per-SVG in react-native-svg, no cross-instance conflict. */}
      <Svg
        style={StyleSheet.absoluteFillObject}
        viewBox="0 0 400 800"
        preserveAspectRatio="xMidYMid slice"
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient
            id="bgGlow1"
            cx="60"
            cy="30"
            r="220"
            gradientUnits="userSpaceOnUse"
            fx="60"
            fy="30"
          >
            <Stop offset="0" stopColor={colors.accent}  stopOpacity={0.14} />
            <Stop offset="1" stopColor={colors.accent}  stopOpacity={0}    />
          </RadialGradient>
          <RadialGradient
            id="bgGlow2"
            cx="340"
            cy="30"
            r="220"
            gradientUnits="userSpaceOnUse"
            fx="340"
            fy="30"
          >
            <Stop offset="0" stopColor={colors.accent2} stopOpacity={0.11} />
            <Stop offset="1" stopColor={colors.accent2} stopOpacity={0}    />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="400" height="800" fill="url(#bgGlow1)" />
        <Rect x="0" y="0" width="400" height="800" fill="url(#bgGlow2)" />
      </Svg>

      <Animated.View role="main" style={[styles.container, padded && styles.padded, animatedStyle, style]}>
        {children}
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  padded: { paddingHorizontal: spacing.screenPadding },
})
