import React, { useEffect, useRef, useState } from 'react'
import { Keyboard, Pressable, StyleSheet, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '../../theme/tokens'
import { useCurrentAIContext } from './AIContext'
import { buildChatParams, type AIChatParams } from './aiContextState'

type Props = {
  routeName: string
  openChat: (params: AIChatParams) => void
}

const FAB_ICON_COLOR = '#FFFFFF' // max contrast on the primary-blue FAB

export default function AIFab({ routeName, openChat }: Props): React.JSX.Element | null {
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

  // Position FAB so it clears the floating pill tab bar.
  // Tab bar: bottom = max(insets.bottom, 12) + 8, height = 64.
  // FAB bottom = tab bar's top + 12 gap.
  const tabBarBottom = Math.max(insets.bottom, 12) + 8
  const fabBottom = tabBarBottom + 64 + 12

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          bottom: fabBottom,
          right: Math.max(insets.right, 0) + 16,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ctx?.label ? `Ask AI about ${ctx.label}` : 'Ask AI'}
        accessibilityHint={ctx?.label ? `Opens AI chat in context of ${ctx.label}` : 'Opens AI chat'}
        onPress={onPress}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
      >
        <MaterialCommunityIcons name="brain" size={26} color={FAB_ICON_COLOR} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  // Column layout: chip stacks above the FAB, both right-aligned.
  // This prevents the chip from overlapping scroll content to the left of the FAB.
  wrap: {
    position: 'absolute',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
  },
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
})
