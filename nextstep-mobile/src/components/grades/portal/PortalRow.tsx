import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '../../../theme/tokens'

interface PortalRowProps {
  leading?: React.ReactNode
  title: string
  subtitle?: string
  /** Optional third line; wraps. */
  caption?: string
  trailing?: React.ReactNode
  /** Extra content under the text lines, e.g. a wrapping row of Pills. */
  children?: React.ReactNode
  /** Suppresses the hairline divider under the row. */
  isLast?: boolean
  testID?: string
}

// A non-interactive list row. It is one accessibility element, so a screen
// reader reads the row's text (and any chip labels inside it) in one go.
export function PortalRow({
  leading,
  title,
  subtitle,
  caption,
  trailing,
  children,
  isLast = false,
  testID,
}: PortalRowProps): React.JSX.Element {
  return (
    <View testID={testID} accessible style={[styles.row, !isLast && styles.divider]}>
      {leading}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.secondary} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {caption ? <Text style={styles.secondary}>{caption}</Text> : null}
        {children}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    gap: spacing.ms,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...typography.h3, fontSize: 15, lineHeight: 20, color: colors.text },
  secondary: { ...typography.bodySm, color: colors.textSecondary },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 0 },
})
