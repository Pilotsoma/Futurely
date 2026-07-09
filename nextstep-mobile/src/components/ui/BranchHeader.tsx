/**
 * BranchHeader — top-left Futurely logo shown on tab-root screens (Grades, Colleges).
 * In the bottom-tab navigation model the logo is decorative; users switch tabs
 * via the tab bar below. No navigation action is attached.
 */
import React from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import FuturelyLogo from './FuturelyLogo'

export default function BranchHeader(): React.JSX.Element {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <FuturelyLogo size={40} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
})
