import React from 'react'
import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native'
import Text from './Text'
import { shadows } from '../../constants/shadows'

interface ButtonProps {
  label: string
  onPress: () => void
  isLoading?: boolean
  disabled?: boolean
  accessibilityLabel?: string
  testID?: string
}

export default function Button({
  label,
  onPress,
  isLoading = false,
  disabled = false,
  accessibilityLabel,
  testID,
}: ButtonProps): React.JSX.Element {
  const isInert = isLoading || disabled

  return (
    <TouchableOpacity
      className={`rounded-2xl min-h-[48px] px-4 items-center justify-center bg-[#2979FF] ${isInert ? 'opacity-40' : ''}`}
      style={isInert ? undefined : styles.raised}
      onPress={onPress}
      disabled={isInert}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInert, busy: isLoading }}
      testID={testID}
    >
      {isLoading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text className="text-white text-[16px] font-semibold">{label}</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  raised: shadows.raised,
})
