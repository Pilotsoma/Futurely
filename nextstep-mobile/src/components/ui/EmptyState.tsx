/**
 * EmptyState
 *
 * The one empty / error / unavailable block for the app. A screen shows
 * exactly one of loading, error, empty or content; never an error together
 * with an empty state.
 *
 * Props:
 *   icon?        Feather icon name                - default 'inbox'
 *   title        string                           - short, context-aware heading
 *   message?     string                           - one sentence: why, or what to do next
 *   ctaLabel?    string                           - secondary button label (needs onPressCta)
 *   onPressCta?  () => void
 *   ctaLoading?  boolean                          - spinner in the button, dimensions preserved
 *   tone?        'neutral' | 'error'              - default 'neutral'; tints the icon tile
 *   framed?      boolean                          - default true; pass false when already inside a card
 *   testID?      string
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors, radii, spacing, typography } from '../../theme/tokens'
import { Button } from './Button'

interface EmptyStateProps {
  icon?: React.ComponentProps<typeof Feather>['name']
  title: string
  message?: string
  ctaLabel?: string
  onPressCta?: () => void
  ctaLoading?: boolean
  tone?: 'neutral' | 'error'
  framed?: boolean
  testID?: string
}

// colors.error at the same 14% alpha as colors.primaryDim.
const ERROR_DIM = 'rgba(239,68,68,0.14)'

export function EmptyState({
  icon = 'inbox',
  title,
  message,
  ctaLabel,
  onPressCta,
  ctaLoading,
  tone = 'neutral',
  framed = true,
  testID,
}: EmptyStateProps): React.JSX.Element {
  const isError = tone === 'error'

  return (
    <View testID={testID} style={[styles.container, framed && styles.framed]}>
      <View
        style={[styles.iconTile, isError && styles.iconTileError]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Feather name={icon} size={22} color={isError ? colors.error : colors.accentLight} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {ctaLabel && onPressCta ? (
        // Margin lives on a wrapper: Button applies its `style` to both its
        // Pressable and its inner view, which would double any margin.
        <View style={styles.ctaWrap}>
          <Button
            label={ctaLabel}
            onPress={onPressCta}
            loading={ctaLoading}
            variant="secondary"
            style={styles.cta}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  framed: {
    backgroundColor: colors.surface1,
    borderRadius: radii.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.cardHighlight,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryDim,
    marginBottom: spacing.xs,
  },
  iconTileError: { backgroundColor: ERROR_DIM },
  title: { ...typography.h3, color: colors.text, textAlign: 'center' },
  message: { ...typography.bodyMd, color: colors.textSecondary, textAlign: 'center', maxWidth: 280 },
  ctaWrap: { marginTop: spacing.xs },
  cta: { minWidth: 132 },
})
