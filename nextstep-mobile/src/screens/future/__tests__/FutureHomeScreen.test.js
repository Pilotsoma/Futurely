import React from 'react'
import { StyleSheet } from 'react-native'
import TestRenderer, { act } from 'react-test-renderer'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import FutureHomeScreen from '../FutureHomeScreen'
import { useAIContext } from '../../../components/ai/AIContext'

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('../../../components/ui/Screen', () => {
  const { View } = require('react-native')
  return {
    Screen: ({ children }) => <View>{children}</View>,
    SCROLL_BOTTOM_CLEARANCE: 176,
  }
})
jest.mock('../../../components/future/RoadmapPanel', () => ({ RoadmapPanel: () => null }))
jest.mock('../../../components/future/CollegesPanel', () => ({ CollegesPanel: () => null }))
jest.mock('../../../components/ai/AIContext', () => ({ useAIContext: jest.fn() }))
jest.mock('../../../api/counselorApi', () => ({
  listActiveCounselorLinks: jest.fn(() => Promise.resolve([])),
  getCounselorChat: jest.fn(),
}))
jest.mock('../../../components/future/chatSeen', () => ({
  loadLastSeenId: jest.fn(() => Promise.resolve(null)),
}))
const mockNavigate = jest.fn()
jest.mock('@react-navigation/native', () => {
  const React = require('react')
  return {
    useFocusEffect: (effect) => {
      React.useEffect(effect, [effect])
    },
    useNavigation: () => ({ navigate: mockNavigate }),
    useRoute: () => ({ params: undefined }),
  }
})

jest.setTimeout(30000)

async function renderScreen() {
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(<FutureHomeScreen />)
  })
  await act(async () => {
    await Promise.resolve()
  })
  return renderer
}

describe('FutureHomeScreen header', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('has no Ask AI pill: the floating button is the one AI entry point', async () => {
    const renderer = await renderScreen()
    const labels = renderer.root
      .findAll((node) => typeof node.props.onPress === 'function')
      .map((node) => node.props.accessibilityLabel)
    expect(labels.some((label) => typeof label === 'string' && /ask ai/i.test(label))).toBe(false)
    const texts = renderer.root.findAllByType('Text').map((node) => node.props.children)
    expect(texts).not.toContain('Ask AI')
    expect(texts).toContain('My Future')
  })

  it('gives the floating AI button the college and career prompt for this tab', async () => {
    await renderScreen()
    expect(useAIContext).toHaveBeenCalledWith(
      'My Future',
      'Based on my grades and college list, what should I focus on to reach my college and career goals?',
    )
  })

  it('keeps a 44pt counselor chat button that opens the chat', async () => {
    const renderer = await renderScreen()
    const chat = renderer.root
      .findAllByProps({ accessibilityLabel: 'Counselor chat' })
      .find((node) => typeof node.props.onPress === 'function')
    const style = StyleSheet.flatten(chat.props.style({ pressed: false }))
    expect(style.width).toBeGreaterThanOrEqual(44)
    expect(style.height).toBeGreaterThanOrEqual(44)
    act(() => chat.props.onPress())
    expect(mockNavigate).toHaveBeenCalledWith('CounselorChat')
  })
})
