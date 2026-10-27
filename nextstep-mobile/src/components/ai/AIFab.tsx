import React, { useEffect, useRef, useState } from 'react'
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors, fonts } from '../../theme/tokens'
import { useCurrentAIContext } from './AIContext'
import { buildChatParams, type AIChatParams } from './aiContextState'

type Props = {
  routeName: string
  tabBarHeight: number
  openChat: (params: AIChatParams) => void
}

export default function AIFab({ routeName, tabBarHeight, openChat }: Props): React.JSX.Element | null {
  const insets = useSafeAreaInsets()
  const ctx = useCurrentAIContext()
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  if (routeName === 'AIChat' || keyboardOpen) return null

  function onPress(): void {
    requestIdRef.current = Math.max(Date.now(), requestIdRef.current + 1)
    openChat(buildChatParams(ctx, requestIdRef.current))
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: tabBarHeight + 12, right: Math.max(insets.right, 0) + 16 }]}
    >
      {ctx?.label ? (
        <View style={styles.chip}>
          <Text style={styles.chipText} numberOfLines={1}>
            {ctx.label}
          </Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ctx?.label ? `Ask AI about ${ctx.label}` : 'Ask AI'}
        onPress={onPress}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
      >
        <MaterialCommunityIcons name="brain" size={26} color="#FFFFFF" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8 },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  chip: {
    maxWidth: 180,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#071522',
    borderWidth: 1,
    borderColor: 'rgba(197, 174, 255, 0.28)',
  },
  chipText: { color: '#C5AEFF', fontSize: 12, fontFamily: fonts.semiBold },
})
