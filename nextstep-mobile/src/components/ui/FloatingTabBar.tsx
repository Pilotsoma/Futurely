/**
 * FloatingTabBar — pure presentational floating glass pill tab bar.
 *
 * ZERO React Navigation imports or types — this component only handles visuals.
 * A separate wiring agent connects it to the navigator by passing `onPress`
 * callbacks and `active` state through the `items` prop.
 *
 * Layout: absolute pill, 20pt inset from left/right, 20pt above safe-area bottom.
 * Height: 64pt. 5 route items + 1 settings item in a horizontal row.
 * Active item: accentDim tile background + accent icon color.
 * Settings item: never shows an active/highlighted state.
 * Touch targets: every Pressable is 44×44; visual tile inside is 42×42.
 */

import React from 'react'
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radii } from '../../theme/tokens'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FloatingTabBarItem {
  key: string
  label: string
  icon: (props: { color: string; size: number }) => React.ReactNode
  active: boolean
  onPress: () => void
  accessibilityLabel?: string
}

export interface FloatingTabBarProps {
  /** Exactly 5 real tab route items, in display order. */
  items: FloatingTabBarItem[]
  settingsItem: {
    icon: (props: { color: string; size: number }) => React.ReactNode
    onPress: () => void
    accessibilityLabel?: string
  }
  style?: StyleProp<ViewStyle>
}

// ---------------------------------------------------------------------------
// Internal — animated tab button
// ---------------------------------------------------------------------------

function TabButton({
  item,
  reduceMotion,
}: {
  item: FloatingTabBarItem
  reduceMotion: boolean
}): React.JSX.Element {
  const scale = useSharedValue(1)

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  function handlePressIn(): void {
    if (!reduceMotion) {
      scale.value = withTiming(0.97, { duration: 120, easing: Easing.out(Easing.ease) })
    }
  }

  function handlePressOut(): void {
    if (!reduceMotion) {
      scale.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.ease) })
    }
  }

  const iconColor = item.active ? colors.accent : colors.textDim

  return (
    <Pressable
      onPress={item.onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.pressable}
      accessibilityRole="tab"
      accessibilityLabel={item.accessibilityLabel ?? item.label}
      accessibilityState={{ selected: item.active }}
    >
      <Animated.View style={[styles.iconTile, item.active && styles.iconTileActive, animStyle]}>
        {item.icon({ color: iconColor, size: 22 })}
      </Animated.View>
    </Pressable>
  )
}

function SettingsButton({
  settingsItem,
  reduceMotion,
}: {
  settingsItem: FloatingTabBarProps['settingsItem']
  reduceMotion: boolean
}): React.JSX.Element {
  const scale = useSharedValue(1)

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  function handlePressIn(): void {
    if (!reduceMotion) {
      scale.value = withTiming(0.97, { duration: 120, easing: Easing.out(Easing.ease) })
    }
  }

  function handlePressOut(): void {
    if (!reduceMotion) {
      scale.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.ease) })
    }
  }

  return (
    <Pressable
      onPress={settingsItem.onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.pressable}
      accessibilityRole="button"
      accessibilityLabel={settingsItem.accessibilityLabel ?? 'Settings'}
    >
      {/* Settings never shows active highlight — intentionally not a route tab */}
      <Animated.View style={[styles.iconTile, animStyle]}>
        {settingsItem.icon({ color: colors.textDim, size: 22 })}
      </Animated.View>
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FloatingTabBar({
  items,
  settingsItem,
  style,
}: FloatingTabBarProps): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion() ?? false

  const bottomInset = Math.max(20, insets.bottom + 8)

  return (
    <View
      style={[
        styles.container,
        { bottom: bottomInset },
        style,
      ]}
      // pointerEvents default is 'auto' — the absolute overlay must receive touches
    >
      {/* Blur layer — frosted glass background */}
      <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFillObject} />

      {/* Frosted overlay + border */}
      <View style={styles.overlay} />

      {/* Tab items */}
      <View style={styles.row}>
        {items.map((item) => (
          <TabButton key={item.key} item={item} reduceMotion={reduceMotion} />
        ))}
        <SettingsButton settingsItem={settingsItem} reduceMotion={reduceMotion} />
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const PILL_HEIGHT = 64

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: PILL_HEIGHT,
    borderRadius: radii.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.cardFill,
    borderTopWidth: 1,
    borderTopColor: colors.insetHighlight,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  // 44×44 touch target (minimum per ENGINEERING_RULES.md)
  pressable: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 42×42 visual tile — 1pt transparent padding inside the 44pt pressable
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconTileActive: {
    backgroundColor: colors.accentDim,
  },
})
