import React from 'react'
import { StyleSheet } from 'react-native'
import TestRenderer, { act } from 'react-test-renderer'
import { describe, expect, it, jest } from '@jest/globals'

import { EmptyState } from '../EmptyState'
import { ErrorRetryBlock } from '../ErrorRetryBlock'
import { UnsupportedPortalBlock } from '../UnsupportedPortalBlock'

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}))
// Button animates with reanimated, whose native worklets runtime cannot start under jest.
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

function render(element) {
  let renderer
  act(() => {
    renderer = TestRenderer.create(element)
  })
  return renderer
}

function texts(renderer) {
  return renderer.root.findAllByType('Text').map((node) => node.props.children)
}

function findButton(renderer, label) {
  return renderer.root
    .findAllByProps({ accessibilityLabel: label })
    .find((node) => typeof node.props.onPress === 'function')
}

describe('EmptyState', () => {
  it('shows the title and reason, and no button without a handler', () => {
    const renderer = render(<EmptyState title="No grades yet" message="Check back after sync." />)
    expect(texts(renderer)).toEqual(['No grades yet', 'Check back after sync.'])
    expect(renderer.root.findAllByProps({ accessibilityRole: 'button' })).toHaveLength(0)
  })

  it('needs both a label and a handler before it renders the button', () => {
    expect(
      findButton(render(<EmptyState title="Empty" ctaLabel="Refresh" />), 'Refresh'),
    ).toBeUndefined()
    expect(
      findButton(render(<EmptyState title="Empty" onPressCta={() => undefined} />), 'Refresh'),
    ).toBeUndefined()
  })

  it('forwards one press of the button, whose accessible name is its visible text', () => {
    const onPressCta = jest.fn()
    const renderer = render(<EmptyState title="Empty" ctaLabel="Refresh" onPressCta={onPressCta} />)
    const button = findButton(renderer, 'Refresh')
    expect(button).toBeDefined()
    expect(texts(renderer)).toContain('Refresh')
    act(() => button.props.onPress())
    expect(onPressCta).toHaveBeenCalledTimes(1)
  })

  it('is framed by default and unframed on request', () => {
    const framed = StyleSheet.flatten(render(<EmptyState title="x" testID="e" />).toJSON().props.style)
    expect(framed.borderRadius).toBe(28)
    expect(framed.backgroundColor).toBeDefined()

    const bare = StyleSheet.flatten(
      render(<EmptyState title="x" framed={false} testID="e" />).toJSON().props.style,
    )
    expect(bare.borderRadius).toBeUndefined()
    expect(bare.backgroundColor).toBeUndefined()
  })
})

describe('ErrorRetryBlock', () => {
  it('renders the error copy and a Try again button that retries', () => {
    const onRetry = jest.fn()
    const renderer = render(<ErrorRetryBlock message="Check your connection." onRetry={onRetry} />)
    expect(texts(renderer)).toEqual(["Couldn't load this", 'Check your connection.', 'Try again'])
    act(() => findButton(renderer, 'Try again').props.onPress())
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('accepts a custom title', () => {
    const renderer = render(<ErrorRetryBlock title="Schedule failed" message="m" onRetry={() => undefined} />)
    expect(texts(renderer)[0]).toBe('Schedule failed')
  })

  it('disables the button and shows busy state while retrying', () => {
    const renderer = render(<ErrorRetryBlock message="m" onRetry={() => undefined} retrying />)
    const button = findButton(renderer, 'Try again')
    expect(button.props.disabled).toBe(true)
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true })
  })
})

describe('UnsupportedPortalBlock', () => {
  it('names the feature, offers no action', () => {
    const renderer = render(<UnsupportedPortalBlock feature="Schedule" />)
    expect(texts(renderer)).toEqual([
      'Not available for your school',
      "Schedule isn't offered by your school's portal.",
    ])
    expect(renderer.root.findAllByProps({ accessibilityRole: 'button' })).toHaveLength(0)
  })
})
