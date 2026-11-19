import React from 'react'
import { Pressable, View, Text, StyleSheet } from 'react-native'
import { colors, fonts, touchTarget, typography } from '../../theme/tokens'

interface SegmentedControlProps<T extends string> {
  segments: readonly T[]
  value: T
  onChange: (value: T) => void
}

// Pill-shaped toggle track matching the redesign spec:
// track: low-opacity white bg + border, radius 14, padding 4;
// active segment: frosted-glass white bg, radius 10, bold text in colors.text;
// inactive: colors.textSecondary.
// Each segment is 44pt tall, so no hitSlop is needed.
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
            // react-native-web does not turn accessibilityState into aria-selected
            // for role=tab, so set it explicitly (native reads accessibilityState).
            aria-selected={active}
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    height: touchTarget,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  label: {
    ...typography.h3,
    fontSize: 13.5,
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
  },
})
