import React, { useState } from 'react'
import { KeyboardTypeOptions, ReturnKeyTypeOptions, StyleSheet, TextInput, View } from 'react-native'
import Text from './Text'
import { shadows } from '../../constants/shadows'

interface InputProps {
  label: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  secureTextEntry?: boolean
  keyboardType?: KeyboardTypeOptions
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoCorrect?: boolean
  editable?: boolean
  error?: string | null
  returnKeyType?: ReturnKeyTypeOptions
  onSubmitEditing?: () => void
  accessibilityLabel?: string
  testID?: string
}

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  editable = true,
  error,
  returnKeyType,
  onSubmitEditing,
  accessibilityLabel,
  testID,
}: InputProps): React.JSX.Element {
  const [isFocused, setIsFocused] = useState(false)

  // Border class: error > focused (brand blue) > default DS border (#273D5E)
  const borderClass = error
    ? 'border-[#EF4444]'
    : isFocused
      ? 'border-[#2979FF]'
      : 'border-[#273D5E]'

  // Inset style: lighter top/left edges simulate the rim-light on a concave well.
  // Only apply when not overridden by error or focus border (those use className).
  const insetStyle = error == null && !isFocused ? styles.inset : undefined

  return (
    <View className="mb-4">
      <Text className="text-[12px] font-semibold tracking-[0.5px] text-[#E8EEFF] mb-1.5">{label}</Text>
      <TextInput
        className={`bg-[#0D1829] border rounded-2xl min-h-[48px] px-3 py-3 text-[#E8EEFF] text-[16px] ${borderClass}`}
        style={insetStyle}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#52698A"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        editable={editable}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        accessibilityLabel={accessibilityLabel ?? label}
        testID={testID}
      />
      {error != null && <Text className="text-[#EF4444] text-[13px] mt-1">{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  inset: shadows.insetBorderStyle,
})
