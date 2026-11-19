import React from 'react'
import { StyleSheet } from 'react-native'
import TestRenderer, { act } from 'react-test-renderer'
import { describe, expect, it, jest } from '@jest/globals'

import AIFab from '../AIFab'
import { AIContextProvider } from '../AIContext'

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
// AIContext registers via useFocusEffect, which needs a navigator; AIFab only reads it.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => undefined,
}))

function render(routeName, openChat = () => undefined) {
  let renderer
  act(() => {
    renderer = TestRenderer.create(
      <AIContextProvider>
        <AIFab routeName={routeName} openChat={openChat} />
      </AIContextProvider>,
    )
  })
  return renderer
}

describe('AIFab', () => {
  it.each(['Dashboard', 'Settings', 'AIChat'])('is absent on %s', (routeName) => {
    expect(render(routeName).toJSON()).toBeNull()
  })

  it.each(['Grades', 'Planner', 'Study', 'Future'])('is present on %s and opens chat once', (routeName) => {
    const openChat = jest.fn()
    const renderer = render(routeName, openChat)
    expect(renderer.toJSON()).not.toBeNull()

    const button = renderer.root
      .findAllByProps({ accessibilityLabel: 'Ask AI' })
      .find((node) => typeof node.props.onPress === 'function')
    expect(button).toBeDefined()
    expect(button.props.accessibilityRole).toBe('button')
    act(() => button.props.onPress())
    expect(openChat).toHaveBeenCalledTimes(1)
  })

  it('sits one FAB_GAP above the floating tab bar, using the shared geometry', () => {
    const wrap = render('Grades').toJSON()
    // No bottom inset (web): max(0, 12) + 8 lift + 64 bar + 12 gap = 96.
    expect(StyleSheet.flatten(wrap.props.style).bottom).toBe(96)
  })
})
