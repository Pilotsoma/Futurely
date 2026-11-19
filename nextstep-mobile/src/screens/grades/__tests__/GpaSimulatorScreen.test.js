import React from 'react'
import { StyleSheet } from 'react-native'
import TestRenderer, { act } from 'react-test-renderer'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import GpaSimulatorScreen from '../GpaSimulatorScreen'
import * as gradesApi from '../../../api/gradesApi'

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}))
jest.mock('react-native-svg', () => {
  const React = require('react')
  const Stub = ({ children }) => React.createElement('svg-stub', null, children)
  return {
    __esModule: true,
    default: Stub,
    Defs: Stub,
    LinearGradient: Stub,
    Stop: Stub,
    Rect: Stub,
  }
})
// Screen animates its entrance with reanimated, whose native worklets runtime cannot start under jest.
jest.mock('../../../components/ui/Screen', () => {
  const { View } = require('react-native')
  return {
    Screen: ({ children }) => <View>{children}</View>,
    SCROLL_BOTTOM_CLEARANCE: 176,
  }
})
jest.mock('../../../components/ui/LoadingSkeleton', () => ({
  LoadingSkeleton: () => null,
}))
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
// usePortalFetch loads on focus; run the effect on mount instead.
jest.mock('@react-navigation/native', () => {
  const React = require('react')
  return {
    useFocusEffect: (effect) => {
      React.useEffect(effect, [effect])
    },
  }
})
jest.mock('../../../api/gradesApi', () => ({
  getCurrentGrades: jest.fn(),
  getClasswork: jest.fn(),
}))
// usePortalFetch imports api/client for its error class, which pulls in the native token storage.
jest.mock('../../../utils/storage', () => ({
  clearTokens: jest.fn(),
  loadTokens: jest.fn(),
  storeTokens: jest.fn(),
}))

const course = (id, name, average) => ({
  id,
  name,
  teacher: 'Teacher',
  period: '1',
  average,
  letterGrade: null,
  assignments: [],
  upcomingAssignments: [],
})

async function renderScreen() {
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(<GpaSimulatorScreen />)
  })
  await act(async () => {
    await Promise.resolve()
  })
  return renderer
}

function texts(renderer) {
  return renderer.root.findAllByType('Text').map((node) => node.props.children)
}

jest.setTimeout(30000)

describe('GpaSimulatorScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lists the same courses as the Grades hub, read from the current grades endpoint', async () => {
    gradesApi.getCurrentGrades.mockResolvedValue({
      systemType: 'PowerSchool',
      grades: [course('a', 'AP Biology', 93.5), course('b', 'English III', 88)],
    })
    const renderer = await renderScreen()
    const shown = texts(renderer)

    expect(shown).toContain('AP Biology')
    expect(shown).toContain('English III')
    expect(gradesApi.getCurrentGrades).toHaveBeenCalledTimes(1)
    // The classwork endpoint is HAC-only and can be empty while Grades has courses.
    expect(gradesApi.getClasswork).not.toHaveBeenCalled()
  })

  it('shows numeric Current and Projected GPA to three decimals, unweighted first', async () => {
    gradesApi.getCurrentGrades.mockResolvedValue({
      systemType: 'HAC',
      grades: [course('a', 'AP Biology', 93.5), course('b', 'English III', 88)],
    })
    const renderer = await renderScreen()
    const shown = texts(renderer)

    const gpaValues = shown.filter((value) => typeof value === 'string' && /^\d\.\d{3}$/.test(value))
    expect(gpaValues).toHaveLength(2)
    expect(gpaValues[0]).toBe(gpaValues[1])
    expect(shown).not.toContain(String.fromCharCode(0x2014))

    const tabs = renderer.root.findAll(
      (node) => node.props.accessibilityRole === 'tab' && typeof node.props.onPress === 'function',
    )
    expect(tabs.map((tab) => tab.findByType('Text').props.children)).toEqual(['Unweighted', 'Weighted'])
    expect(tabs[0].props.accessibilityState.selected).toBe(true)
    expect(tabs[1].props.accessibilityState.selected).toBe(false)
  })

  it('does not simulate courses that have no posted average', async () => {
    gradesApi.getCurrentGrades.mockResolvedValue({
      systemType: 'HAC',
      grades: [course('a', 'AP Biology', 93.5), course('b', 'Art', null)],
    })
    const shown = texts(await renderScreen())

    expect(shown).toContain('AP Biology')
    expect(shown).not.toContain('Art')
  })

  it('explains an empty course list instead of offering a fake Connect portal button', async () => {
    gradesApi.getCurrentGrades.mockResolvedValue({ systemType: 'HAC', grades: [] })
    const renderer = await renderScreen()
    const shown = texts(renderer)

    expect(shown).toContain('No grades to simulate yet')
    expect(shown).toContain(
      'Once your portal posts grades for this term you can try out changes here.',
    )
    expect(shown).not.toContain('Connect portal')
    // No hero card full of dashes.
    expect(shown).not.toContain('Current')
    expect(shown).not.toContain('Projected')
    expect(renderer.root.findAllByProps({ accessibilityRole: 'button' })).toHaveLength(0)
  })

  it('keeps every grade chip and stepper button at least 44pt', async () => {
    gradesApi.getCurrentGrades.mockResolvedValue({
      systemType: 'HAC',
      grades: [course('a', 'AP Biology', 93.5)],
    })
    const renderer = await renderScreen()

    const chip = renderer.root
      .findAllByProps({ accessibilityLabel: 'Set AP Biology to grade A' })
      .find((node) => typeof node.props.onPress === 'function')
    const chipStyle = StyleSheet.flatten(chip.props.style({ pressed: false }))
    expect(chipStyle.minWidth).toBeGreaterThanOrEqual(44)
    expect(chipStyle.height).toBeGreaterThanOrEqual(44)

    for (const label of ['-', '+']) {
      const button = renderer.root
        .findAllByProps({ accessibilityLabel: label })
        .find((node) => typeof node.props.onPress === 'function')
      const style = StyleSheet.flatten(button.props.style)
      expect(style.width).toBeGreaterThanOrEqual(44)
      expect(style.height).toBeGreaterThanOrEqual(44)
    }
    // Level chips are named by their visible text and mark the selected level.
    for (const label of ['Regular', 'KAP', 'AP', 'Dual Credit']) {
      const chip = renderer.root.find(
        (node) =>
          node.props.accessibilityRole === 'button' &&
          typeof node.props.onPress === 'function' &&
          node.findAllByType('Text').some((text) => text.props.children === label),
      )
      expect(chip.props.accessibilityLabel).toBeUndefined()
      expect(StyleSheet.flatten(chip.props.style({ pressed: false })).height).toBeGreaterThanOrEqual(44)
    }
  })
})
