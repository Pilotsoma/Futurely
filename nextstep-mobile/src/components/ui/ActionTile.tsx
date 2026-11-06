import React, { useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Feather } from '@expo/vector-icons'

import { fonts, touchTarget } from '../../theme/tokens'

type FeatherName = React.ComponentProps<typeof Feather>['name']

interface ActionTileProps {
  title: string
  subtitle?: string
  meta?: string
  badge?: string
  icon: FeatherName
  color: string
  iconBackground: string
  onPress: () => void
  disabled?: boolean
  accessibilityHint?: string
  testID?: string
  style?: StyleProp<ViewStyle>
  /** `stacked` puts the icon above the text so labels fit in narrow grid columns. */
  variant?: 'row' | 'stacked'
}

export function ActionTile({
  title,
  subtitle,
  meta,
  badge,
  icon,
  color,
  iconBackground,
  onPress,
  disabled = false,
  accessibilityHint,
  testID,
  style,
  variant = 'row',
}: ActionTileProps): React.JSX.Element {
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const stacked = variant === 'stacked'

  return (
    <View
      style={[
        styles.shell,
        hovered && !disabled && styles.hovered,
        focused && !disabled && styles.focused,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityHint={accessibilityHint ?? subtitle}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPress={onPress}
        style={({ pressed }) => [
          styles.pressable,
          stacked && styles.pressableStacked,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <View
          pointerEvents="none"
          style={[styles.icon, stacked && styles.iconStacked, { backgroundColor: iconBackground }]}
        >
          <Feather name={icon} size={18} color={color} />
        </View>

        <View pointerEvents="none" style={[styles.copy, stacked && styles.copyStacked]}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
              {title}
            </Text>
            {badge ? (
              <View style={[styles.badge, { backgroundColor: `${color}1F` }]}>
                <Text style={[styles.badgeText, { color }]} numberOfLines={1}>
                  {badge}
                </Text>
              </View>
            ) : null}
          </View>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2} ellipsizeMode="tail">
              {subtitle}
            </Text>
          ) : null}
          {meta ? (
            <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
              {meta}
            </Text>
          ) : null}
        </View>

        {stacked ? null : (
          <Feather name="chevron-right" size={16} color="#6B7D98" style={styles.chevron} />
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 88,
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: 'rgba(22, 36, 58, 0.72)',
  },
  pressable: {
    flex: 1,
    minHeight: 88,
    width: '100%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pressableStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 10,
    paddingVertical: 14,
  },
  iconStacked: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  copyStacked: {
    flex: 0,
    alignSelf: 'stretch',
  },
  hovered: {
    backgroundColor: 'rgba(25, 42, 67, 0.9)',
  },
  focused: {
    borderWidth: 2,
    borderColor: '#A990FF',
  },
  pressed: {
    opacity: 0.88,
    backgroundColor: 'rgba(29, 48, 75, 0.9)',
  },
  disabled: {
    opacity: 0.45,
  },
  icon: {
    flexShrink: 0,
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: touchTarget / 2,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titleRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    flexShrink: 1,
    color: '#F5F7FF',
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: '#8494AB',
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 14,
  },
  meta: {
    color: '#A9B7CC',
    fontFamily: fonts.medium,
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: '500',
  },
  badge: {
    maxWidth: 64,
    flexShrink: 0,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  chevron: {
    flexShrink: 0,
  },
})
