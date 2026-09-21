import React from 'react'
import { View, StyleSheet } from 'react-native'
import { colors, radii } from '../../theme/tokens'

interface ProgressBarProps {
  /** Progress value from 0 to 1 (clamped automatically). */
  value: number
  /** Fill color. Default: accent2 (teal — progress/positive signal). */
  color?: string
  /** Track background color. Default: cardBorder. */
  trackColor?: string
  /** Bar height in points. Default: 6. */
  height?: number
}

export function ProgressBar({
  value,
  color = colors.accent2,
  trackColor = colors.cardBorder,
  height = 6,
}: ProgressBarProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(1, value))

  return (
    <View
      style={[styles.track, { backgroundColor: trackColor, height, borderRadius: radii.pill }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            width: `${clamped * 100}%`,
            height,
            borderRadius: radii.pill,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    // width / height / borderRadius applied inline from props
  },
})
