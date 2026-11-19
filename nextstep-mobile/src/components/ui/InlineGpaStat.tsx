/**
 * InlineGpaStat
 *
 * A no-background GPA stat block for the Dashboard - the GPA numbers float
 * directly above the page background, replacing the gradient GpaOverviewCard
 * on that screen (gradient card stays on Grades as hero).
 *
 * Props:
 *   unweighted       number | null       - unweighted GPA value
 *   weighted         number | null       - weighted GPA value
 *   hidden?          boolean             - replace values with placeholder dots
 *   sparklineValues? number[]            - if length >= 2, renders GpaSparkline inline
 *   onPress?         () => void          - navigate to Grades / GPA Simulator
 */

import React from 'react'
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { formatGpa } from '../../features/grades/academicSummary'
import { colors, spacing, touchTarget } from '../../theme/tokens'
import { GpaSparkline } from '../today/GpaSparkline'
import { StatBlock } from './StatBlock'

interface InlineGpaStatProps {
  unweighted: number | null
  weighted: number | null
  hidden?: boolean
  sparklineValues?: number[]
  onPress?: () => void
  testID?: string
  style?: StyleProp<ViewStyle>
}

export function InlineGpaStat({
  unweighted,
  weighted,
  hidden = false,
  sparklineValues = [],
  onPress,
  testID,
  style,
}: InlineGpaStatProps): React.JSX.Element {
  const showSparkline = sparklineValues.length >= 2

  const content = (
    <View testID={testID} style={[styles.container, style]}>
      <View style={styles.statRow}>
        {/* Unweighted GPA */}
        <StatBlock
          value={formatGpa(unweighted, hidden)}
          label="Unweighted"
          size="hero"
          style={styles.statBlock}
          testID={testID ? `${testID}-unweighted` : undefined}
        />

        {/* Divider */}
        <View style={styles.divider} />

        {/* Weighted GPA */}
        <StatBlock
          value={formatGpa(weighted, hidden)}
          label="Weighted"
          size="hero"
          style={styles.statBlock}
          testID={testID ? `${testID}-weighted` : undefined}
        />

        {/* Sparkline - only when enough data */}
        {showSparkline ? (
          <View style={styles.sparklineContainer}>
            <GpaSparkline
              values={sparklineValues}
              width={100}
              height={36}
              color={colors.accentCyan}
            />
          </View>
        ) : null}
      </View>
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [pressed && styles.pressed]}
        hitSlop={{ top: 8, bottom: 8, left: spacing.screenPadding, right: spacing.screenPadding }}
      >
        {content}
      </Pressable>
    )
  }

  return content
}

const styles = StyleSheet.create({
  container: {
    minHeight: 72,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statBlock: {
    flex: 1,
  },
  divider: {
    width: 1,
    height: 44,
    backgroundColor: colors.border,
  },
  sparklineContainer: {
    justifyContent: 'center',
    minWidth: touchTarget,
    minHeight: touchTarget,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.975 }],
  },
})
