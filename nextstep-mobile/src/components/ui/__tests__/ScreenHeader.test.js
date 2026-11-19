import React from 'react'
import { StyleSheet } from 'react-native'
import TestRenderer, { act } from 'react-test-renderer'
import { describe, expect, it, jest } from '@jest/globals'

import { ScreenHeader, renderStackHeader } from '../ScreenHeader'

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}))

function render(element) {
  let renderer
  act(() => {
    renderer = TestRenderer.create(element)
  })
  return renderer
}

function backButton(renderer) {
  return renderer.root
    .findAllByProps({ accessibilityLabel: 'Go back' })
    .find((node) => typeof node.props.onPress === 'function')
}

function headingText(renderer) {
  return renderer.root
    .findAllByProps({ accessibilityRole: 'header' })
    .find((node) => node.type === 'Text')
}

describe('ScreenHeader root variant', () => {
  it('shows a large header title, subtitle and right slot, and never a back chevron', () => {
    const renderer = render(
      <ScreenHeader
        variant="root"
        title="Grades"
        subtitle="GPA, classes and progress"
        onBack={() => undefined}
        right={<React.Fragment>action</React.Fragment>}
      />,
    )
    expect(headingText(renderer).props.children).toBe('Grades')
    const texts = renderer.root.findAllByType('Text').map((node) => node.props.children)
    expect(texts).toContain('GPA, classes and progress')
    expect(backButton(renderer)).toBeUndefined()
  })

  it('applies no safe-area inset (the host Screen keeps its top edge)', () => {
    const json = render(<ScreenHeader variant="root" title="Planner" testID="h" />).toJSON()
    expect(StyleSheet.flatten(json.props.style).paddingTop).toBe(16)
  })
})

describe('ScreenHeader stack variant', () => {
  it('renders an icon-only 44pt back button that calls onBack', () => {
    const onBack = jest.fn()
    const renderer = render(<ScreenHeader title="Settings" onBack={onBack} />)
    const button = backButton(renderer)
    expect(button).toBeDefined()
    expect(button.props.accessibilityRole).toBe('button')
    act(() => button.props.onPress())
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(headingText(renderer).props.children).toBe('Settings')
    expect(headingText(renderer).props.numberOfLines).toBe(1)
  })

  it('omits the chevron when there is nothing to go back to', () => {
    expect(backButton(render(<ScreenHeader title="Settings" />))).toBeUndefined()
  })

  it('applies the top safe-area inset itself', () => {
    const json = render(<ScreenHeader title="Settings" testID="h" />).toJSON()
    expect(StyleSheet.flatten(json.props.style).paddingTop).toBeGreaterThanOrEqual(47)
  })

  it('adds the screen gutter only when padded', () => {
    const plain = StyleSheet.flatten(render(<ScreenHeader title="x" testID="h" />).toJSON().props.style)
    const padded = StyleSheet.flatten(render(<ScreenHeader title="x" padded testID="h" />).toJSON().props.style)
    expect(plain.paddingHorizontal).toBeUndefined()
    expect(padded.paddingHorizontal).toBe(20)
  })
})

describe('renderStackHeader', () => {
  function headerProps({ back, title }) {
    return {
      navigation: { goBack: jest.fn(), popTo: jest.fn() },
      options: title === undefined ? {} : { title },
      route: { key: 'k', name: 'GpaSimulator' },
      back,
    }
  }

  it('goes back through the stack when there is history', () => {
    const props = headerProps({ back: { title: 'Grades' }, title: 'What-If' })
    const renderer = render(renderStackHeader(props, 'GradesHub'))
    expect(headingText(renderer).props.children).toBe('What-If')
    act(() => backButton(renderer).props.onPress())
    expect(props.navigation.goBack).toHaveBeenCalledTimes(1)
    expect(props.navigation.popTo).not.toHaveBeenCalled()
  })

  it('pops to the stack root when opened by deep link with no history', () => {
    const props = headerProps({ back: undefined, title: 'What-If' })
    const renderer = render(renderStackHeader(props, 'GradesHub'))
    act(() => backButton(renderer).props.onPress())
    expect(props.navigation.popTo).toHaveBeenCalledWith('GradesHub')
    expect(props.navigation.goBack).not.toHaveBeenCalled()
  })

  it('falls back to the route name when the screen sets no title', () => {
    const renderer = render(renderStackHeader(headerProps({ back: undefined }), 'GradesHub'))
    expect(headingText(renderer).props.children).toBe('GpaSimulator')
  })
})
