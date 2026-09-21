import React from 'react'
import { Pressable, View, Text, StyleSheet } from 'react-native'
import { colors, radii, spacing, typography } from '../../theme/tokens'

interface SegmentedControlProps<T extends string> {
  segments: readonly T[]
  value: T
  onChange: (value: T) => void
}

// Pill-shaped toggle track — active segment filled with accentDim + accent label,
// inactive transparent + textDim label. Fully generic, no breaking API change.
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: SegmentedControlProps<T>): React.JSX.Element {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {segments.map((segment) => {
        const active = segment === value
        return (
          <Pressable
            key={segment}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(segment)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{segment}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.cardFallback,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.pill,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.accentDim },
  label: { ...typography.h3, fontSize: 13.5, color: colors.textDim },
  labelActive: { color: colors.accent },
})
