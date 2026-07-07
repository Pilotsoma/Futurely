import React from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import Text from './Text'
import { ResetIcon } from '../icons'
import { shadows } from '../../constants/shadows'

export interface ResetButtonProps {
  onPress: () => void
  disabled?: boolean
  label?: string
  testID?: string
}

export default function ResetButton({
  onPress,
  disabled = false,
  label = 'Reset',
  testID,
}: ResetButtonProps): React.JSX.Element {
  return (
    <TouchableOpacity
      // DS-aligned border (#273D5E), rounded-2xl kept, raised shadow when enabled
      className={`flex-row items-center justify-center gap-2 h-12 rounded-2xl border border-[#273D5E] px-5 ${disabled ? 'opacity-40' : ''}`}
      style={disabled ? undefined : styles.raised}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${label} grades to original`}
      accessibilityState={{ disabled }}
      testID={testID}
    >
      <ResetIcon size={18} color={disabled ? '#52698A' : '#E8EEFF'}/>
      <Text className={`text-[15px] font-semibold ${disabled ? 'text-[#52698A]' : 'text-[#E8EEFF]'}`}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  raised: shadows.raised,
})
