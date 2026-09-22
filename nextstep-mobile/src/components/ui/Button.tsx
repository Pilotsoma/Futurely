import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { animation, colors, elevation, radii, touchTarget, typography } from '../../theme/tokens'

type ButtonVariant = 'primary' | 'secondary' | 'destructive'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  disabled?: boolean
  loading?: boolean
  style?: ViewStyle
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: ButtonProps): React.JSX.Element {
  const isDisabled = disabled === true || loading === true
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    // `style` applied to both layers: the outer Pressable needs it for layout
    // props (flex:1 for equal-width rows) and the inner Animated.View needs it
    // for height/padding overrides that must win over styles.base.
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        if (!isDisabled) scale.value = withSpring(0.96, animation.spring)
      }}
      onPressOut={() => {
        scale.value = withSpring(1, animation.spring)
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={style}
    >
      <Animated.View
        style={[styles.base, variantStyles[variant], isDisabled && styles.disabled, animatedStyle, style]}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'secondary' ? colors.accent : colors.white} size="small" />
        ) : (
          <Text style={[styles.label, textColor[variant]]}>{label}</Text>
        )}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    minWidth: touchTarget,
    minHeight: touchTarget,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  disabled: { opacity: 0.4 },
  label: { ...typography.h3 },
})

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary:     { backgroundColor: colors.accent, ...elevation.sm },
  secondary:   { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.cardBorder },
  destructive: { backgroundColor: colors.tierRed, ...elevation.sm },
}

const textColor: Record<ButtonVariant, { color: string }> = {
  primary:     { color: colors.white },
  secondary:   { color: colors.text },
  destructive: { color: colors.white },
}
