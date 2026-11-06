import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs'

import { colors, fonts } from '../../theme/tokens'
import { useCurrentAIContext } from './AIContext'
import type { AIContextEntry } from './aiContextState'

type Props = BottomTabBarButtonProps & {
  openChat: (context: AIContextEntry | null) => void
}

// The AI entry point lives in the tab bar instead of floating over content,
// so it can never cover a screen's controls. It still carries what the
// student is looking at, which AIChat offers as a one-tap suggestion.
export function AskTabButton({ openChat, accessibilityState, testID }: Props): React.JSX.Element {
  const ctx = useCurrentAIContext()
  const selected = accessibilityState?.selected ?? false

  return (
    <Pressable
      testID={testID}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={ctx?.label ? `Ask AI, about ${ctx.label}` : 'Ask AI'}
      onPress={() => openChat(ctx)}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <View style={[styles.orb, selected && styles.orbSelected]}>
        <MaterialCommunityIcons name="creation" size={20} color="#FFFFFF" />
      </View>
      <Text style={[styles.label, selected && styles.labelSelected]}>Ask</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  item: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 3 },
  pressed: { opacity: 0.8 },
  orb: {
    width: 40,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  orbSelected: { backgroundColor: '#9A5CFF' },
  label: { fontFamily: fonts.semiBold, fontWeight: '600', fontSize: 10, lineHeight: 12, color: '#8190A7' },
  labelSelected: { color: '#C5AEFF' },
})
