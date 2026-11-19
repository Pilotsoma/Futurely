import React from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { colors, radii, spacing, typography } from '../../../theme/tokens'

interface PortalCardProps {
  title?: string
  /** Right-aligned secondary text in the header, e.g. "As of Nov 6". Shown only with a title. */
  meta?: string
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
}

// The Layered Glass panel used by every purpose-built grades portal screen:
// surface1 fill, 28pt radius, a top-edge highlight and no other border.
export function PortalCard({ title, meta, children, style, testID }: PortalCardProps): React.JSX.Element {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
            {title}
          </Text>
          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface1,
    borderRadius: radii.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.cardHighlight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: { ...typography.h3, color: colors.text, flex: 1, minWidth: 0 },
  meta: { ...typography.bodySm, color: colors.textSecondary, textAlign: 'right', flexShrink: 0 },
})
