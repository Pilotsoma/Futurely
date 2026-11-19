/**
 * ScreenHeader
 *
 * The one screen-header pattern.
 *
 * variant="root"  - tab roots (Grades, Planner, Study, My Future). Large title,
 *                   optional subtitle, optional right slot. Applies NO safe-area
 *                   inset: the host Screen keeps its `top` edge.
 * variant="stack" - every pushed screen, plus Settings and AI Chat. 44pt back
 *                   chevron, centred one-line title, right slot (or a spacer).
 *                   Applies insets.top itself, so the host must NOT include the
 *                   `top` edge.
 *
 * Props:
 *   title      string
 *   subtitle?  string              - root only
 *   variant?   'root' | 'stack'    - default 'stack'
 *   onBack?    () => void          - stack only; the chevron renders only when provided
 *   right?     React.ReactNode     - trailing control(s); keep each target >= 44pt
 *   padded?    boolean             - adds spacing.screenPadding; use when the host
 *                                    Screen is padded={false} (or there is no host)
 *   testID?    string
 *
 * `renderStackHeader` adapts it to a native-stack `header` option.
 */

import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackHeaderProps } from '@react-navigation/native-stack'
import { colors, fonts, spacing, touchTarget, typography } from '../../theme/tokens'

interface ScreenHeaderProps {
  title: string
  subtitle?: string
  variant?: 'root' | 'stack'
  onBack?: () => void
  right?: React.ReactNode
  padded?: boolean
  testID?: string
}

const BACK_ICON_SIZE = 24
// Pulls the 44pt back target outward so the chevron glyph, not its hit box,
// sits on the screen gutter.
const BACK_OPTICAL_OFFSET = -(touchTarget - BACK_ICON_SIZE) / 2

export function ScreenHeader({
  title,
  subtitle,
  variant = 'stack',
  onBack,
  right,
  padded = false,
  testID,
}: ScreenHeaderProps): React.JSX.Element {
  const insets = useSafeAreaInsets()

  if (variant === 'root') {
    return (
      <View testID={testID} style={[styles.root, padded && styles.padded]}>
        <View style={styles.rootText}>
          <Text style={styles.rootTitle} accessibilityRole="header" numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.rootSubtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.rootRight}>{right}</View> : null}
      </View>
    )
  }

  return (
    <View
      testID={testID}
      style={[styles.stack, { paddingTop: insets.top + spacing.xs }, padded && styles.padded]}
    >
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Feather name="chevron-left" size={BACK_ICON_SIZE} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.sideSpacer} />
      )}
      <Text style={styles.stackTitle} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      {right ? <View style={styles.stackRight}>{right}</View> : <View style={styles.sideSpacer} />}
    </View>
  )
}

/**
 * `header` renderer for the native-stack navigators:
 *   screenOptions={{ header: (props) => renderStackHeader(props, 'GradesHub') }}
 *
 * Always shows a back chevron. With stack history it goes back; without it
 * (deep link or web reload straight onto a pushed screen) it pops to the
 * stack's root route so the user is never stranded.
 */
export function renderStackHeader(
  props: NativeStackHeaderProps,
  rootRouteName: string,
): React.JSX.Element {
  const { navigation, options, route, back } = props
  return (
    <ScreenHeader
      variant="stack"
      padded
      title={options.title ?? route.name}
      onBack={() => {
        if (back) navigation.goBack()
        else navigation.popTo(rootRouteName)
      }}
    />
  )
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: spacing.screenPadding },
  pressed: { opacity: 0.6, transform: [{ scale: 0.97 }] },

  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingTop: spacing.md,
    paddingBottom: spacing.ms,
  },
  rootText: { flex: 1, minWidth: 0, gap: 2 },
  rootTitle: { ...typography.title, color: colors.text },
  rootSubtitle: { ...typography.bodyMd, color: colors.textSecondary },
  rootRight: { flexDirection: 'row', alignItems: 'center', minHeight: touchTarget },

  stack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.bg,
  },
  backButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: BACK_OPTICAL_OFFSET,
  },
  sideSpacer: { width: touchTarget + BACK_OPTICAL_OFFSET, height: touchTarget },
  stackTitle: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: fonts.jakartaBold,
    fontWeight: '700',
    color: colors.text,
  },
  stackRight: {
    minWidth: touchTarget + BACK_OPTICAL_OFFSET,
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
})
