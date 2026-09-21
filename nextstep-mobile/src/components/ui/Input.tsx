import React, { useState } from 'react'
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native'
import { colors, radii, spacing, typography } from '../../theme/tokens'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
}

export function Input({ label, error, style, onFocus, onBlur, multiline, ...rest }: InputProps): React.JSX.Element {
  const [focused, setFocused] = useState(false)

  const borderColor = error ? colors.tierRed : focused ? colors.accent : colors.cardBorder

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, { borderColor }, multiline && styles.inputMultiline, style]}
        placeholderTextColor={colors.textDim}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        accessibilityLabel={label}
        multiline={multiline}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { ...typography.label, color: colors.textDim },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface2,
    color: colors.text,
    fontSize: typography.body.fontSize,
  },
  inputMultiline: {
    height: undefined,
    minHeight: 76,
    paddingVertical: spacing.sm,
    textAlignVertical: 'top',
  },
  error: { ...typography.caption, color: colors.tierRed },
})
