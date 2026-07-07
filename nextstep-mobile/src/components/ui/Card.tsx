import React from 'react'
import { StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native'
import { shadows } from '../../constants/shadows'

interface CardProps {
  children: React.ReactNode
  onPress?: () => void
  testID?: string
  style?: StyleProp<ViewStyle>
}

export default function Card({
  children,
  onPress,
  testID,
  style,
}: CardProps): React.JSX.Element {
  // DS-aligned: surface #162235, border #273D5E, 20px radius (hybrid neo spec)
  const cardClassName = 'bg-[#162235] border border-[#273D5E] rounded-[20px] p-4'

  if (onPress !== undefined) {
    return (
      <TouchableOpacity
        className={cardClassName}
        style={[styles.raised, style]}
        onPress={onPress}
        activeOpacity={0.75}
        testID={testID}
      >
        {children}
      </TouchableOpacity>
    )
  }

  return (
    <View className={cardClassName} style={[styles.raised, style]} testID={testID}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  raised: shadows.raised,
})
