import React from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Text from './Text'
import { ChevronLeftIcon } from '../icons'
import { colors } from '../../constants/colors'

interface ScreenHeaderProps {
  title: string
  /** Set false for tab-root screens with no stack history to return to. */
  showBack?: boolean
}

export default function ScreenHeader({ title, showBack = true }: ScreenHeaderProps): React.JSX.Element {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()

  if (!showBack) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        <Text variant="heading">{title}</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
      >
        <ChevronLeftIcon size={24} color={colors.primary} />
      </TouchableOpacity>
      <Text variant="h3" style={styles.title}>{title}</Text>
      <View style={styles.spacer} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center' as const,
  },
  spacer: {
    width: 44,
  },
})
