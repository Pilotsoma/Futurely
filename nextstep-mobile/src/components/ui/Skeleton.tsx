/**
 * Unified skeleton loading primitive — replaces the former LoadingSkeleton.tsx
 * (multi-row shimmer sweep) and the old Skeleton.tsx (single-block pulse).
 *
 * Two usage modes:
 *
 * 1. Rows mode (multi-row shimmer list — all existing LoadingSkeleton call sites):
 *    <Skeleton rows={4} rowHeight={64} />
 *    <LoadingSkeleton rows={4} />   ← named alias export, same component
 *
 * 2. Block mode (single-block inline placeholder):
 *    <Skeleton width={120} height={16} radius={6} />
 *    <Skeleton />  ← defaults: width='100%', height=16, radius=6
 *
 * Animation: Reanimated shimmer sweep (~1.1s loop, ease-in-out), disabled when
 * the OS/app reduce-motion flag is active (static dim block shown instead).
 */

import React, { useEffect, useState } from 'react'
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useDisplayPreferences } from '../../preferences/displayPreferences'
import { colors, radii, spacing } from '../../theme/tokens'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SkeletonRowsProps {
  rows: number
  rowHeight?: number
  style?: ViewStyle
  // Discriminant: rows mode has `rows`, block mode does not
  width?: undefined
  height?: undefined
  radius?: undefined
}

interface SkeletonBlockProps {
  width?: DimensionValue
  height?: number
  radius?: number
  style?: StyleProp<ViewStyle>
  rows?: undefined
  rowHeight?: undefined
}

export type SkeletonProps = SkeletonRowsProps | SkeletonBlockProps

// ---------------------------------------------------------------------------
// Internal — single shimmer row
// ---------------------------------------------------------------------------

const BAND_WIDTH = 90

function ShimmerRow({
  height,
  reduceMotion,
}: {
  height: number
  reduceMotion: boolean
}): React.JSX.Element {
  const [rowWidth, setRowWidth] = useState(0)
  const translateX = useSharedValue(-BAND_WIDTH)

  useEffect(() => {
    cancelAnimation(translateX)

    if (reduceMotion || rowWidth === 0) {
      translateX.value = -BAND_WIDTH
      return
    }

    translateX.value = withRepeat(
      withSequence(
        withTiming(-BAND_WIDTH, { duration: 0 }),
        withTiming(rowWidth + BAND_WIDTH, {
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    )

    return () => { cancelAnimation(translateX) }
  }, [reduceMotion, translateX, rowWidth])

  const bandStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  return (
    <View
      style={[styles.row, { height }]}
      onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
    >
      {reduceMotion ? (
        <View style={styles.staticBand} />
      ) : (
        <Animated.View style={[styles.band, bandStyle]} />
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Internal — multi-row skeleton container
// ---------------------------------------------------------------------------

function SkeletonRows({
  rows,
  rowHeight = 64,
  style,
  reduceMotion,
}: {
  rows: number
  rowHeight?: number
  style?: ViewStyle
  reduceMotion: boolean
}): React.JSX.Element {
  return (
    <View
      style={[styles.rowsContainer, style]}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <ShimmerRow key={index} height={rowHeight} reduceMotion={reduceMotion} />
      ))}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Internal — single-block skeleton
// ---------------------------------------------------------------------------

function SkeletonBlock({
  width = '100%',
  height = 16,
  radius = 6,
  style,
  reduceMotion,
}: {
  width?: DimensionValue
  height?: number
  radius?: number
  style?: StyleProp<ViewStyle>
  reduceMotion: boolean
}): React.JSX.Element {
  const opacity = useSharedValue(reduceMotion ? 0.6 : 0.4)

  useEffect(() => {
    cancelAnimation(opacity)
    if (reduceMotion) {
      opacity.value = 0.6
      return
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3,  { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    )
    return () => { cancelAnimation(opacity) }
  }, [opacity, reduceMotion])

  const blockStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.cardFallback,
          width,
          height,
          borderRadius: radius,
        },
        blockStyle,
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  )
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export function Skeleton(props: SkeletonProps): React.JSX.Element {
  const systemReduceMotion = useReducedMotion() ?? false
  const { reduceMotion: preferenceReduceMotion } = useDisplayPreferences()
  const reduceMotion = systemReduceMotion || preferenceReduceMotion

  if (props.rows !== undefined) {
    return (
      <SkeletonRows
        rows={props.rows}
        rowHeight={props.rowHeight}
        style={(props as SkeletonRowsProps).style}
        reduceMotion={reduceMotion}
      />
    )
  }

  const blockProps = props as SkeletonBlockProps
  return (
    <SkeletonBlock
      width={blockProps.width}
      height={blockProps.height}
      radius={blockProps.radius}
      style={blockProps.style}
      reduceMotion={reduceMotion}
    />
  )
}

/**
 * Named alias — retained so all existing `{ LoadingSkeleton }` import sites
 * continue to work after migration to the unified Skeleton path.
 */
export const LoadingSkeleton = Skeleton

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  rowsContainer: {
    gap: spacing.ms,
  },
  row: {
    backgroundColor: colors.cardFallback,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: BAND_WIDTH,
    backgroundColor: colors.surface2,
    opacity: 0.55,
  },
  staticBand: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '32%',
    backgroundColor: colors.surface2,
    opacity: 0.32,
  },
})
