import React from 'react'
import { Text } from 'react-native'
import TestRenderer, { act } from 'react-test-renderer'
import { describe, expect, it, jest } from '@jest/globals'

import { PortalDataState } from '../PortalDataState'

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}))
// LoadingSkeleton shimmers with reanimated, whose native worklets runtime cannot start under jest.
jest.mock('../../ui/LoadingSkeleton', () => ({
  LoadingSkeleton: () => 'loading-skeleton',
}))
// Button animates with reanimated too.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (value) => ({ value, set: () => undefined }),
    useAnimatedStyle: () => ({}),
    withSpring: (value) => value,
  }
})

const base = {
  loading: false,
  unsupported: false,
  error: null,
  onRetry: () => undefined,
  feature: 'Schedule',
  isEmpty: false,
  emptyIcon: 'clock',
  emptyTitle: 'No schedule posted',
  emptyMessage: "Your school hasn't published a schedule for this term.",
}

function render(props) {
  let renderer
  act(() => {
    renderer = TestRenderer.create(
      <PortalDataState {...base} {...props}>
        <Text>the content</Text>
      </PortalDataState>,
    )
  })
  return renderer
}

function texts(renderer) {
  return renderer.root.findAllByType('Text').map((node) => node.props.children)
}

describe('PortalDataState', () => {
  it('shows the content when loaded and non-empty', () => {
    expect(texts(render({}))).toEqual(['the content'])
  })

  it('shows only the loading skeleton while loading, even if the other flags are set', () => {
    const renderer = render({ loading: true, error: 'boom', isEmpty: true, unsupported: true })
    expect(JSON.stringify(renderer.toJSON())).toBe('"loading-skeleton"')
  })

  it('shows only the unsupported block for a portal that lacks the feature', () => {
    const renderer = render({ unsupported: true, error: 'boom', isEmpty: true })
    expect(texts(renderer)).toEqual([
      'Not available for your school',
      "Schedule isn't offered by your school's portal.",
    ])
  })

  it('shows the error and a retry, never the empty state next to it', () => {
    const onRetry = jest.fn()
    const renderer = render({ error: 'Check your connection.', isEmpty: true, onRetry })
    const shown = texts(renderer)
    expect(shown).toContain('Check your connection.')
    expect(shown).toContain('Try again')
    expect(shown).not.toContain('No schedule posted')
    const retry = renderer.root
      .findAllByProps({ accessibilityLabel: 'Try again' })
      .find((node) => typeof node.props.onPress === 'function')
    act(() => retry.props.onPress())
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows a titled, explained empty state with a Refresh that reloads', () => {
    const onRetry = jest.fn()
    const renderer = render({ isEmpty: true, onRetry })
    const shown = texts(renderer)
    expect(shown).toEqual([
      'No schedule posted',
      "Your school hasn't published a schedule for this term.",
      'Refresh',
    ])
    expect(shown).not.toContain('No data available.')
    expect(shown).not.toContain('the content')
    const refresh = renderer.root
      .findAllByProps({ accessibilityLabel: 'Refresh' })
      .find((node) => typeof node.props.onPress === 'function')
    act(() => refresh.props.onPress())
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
