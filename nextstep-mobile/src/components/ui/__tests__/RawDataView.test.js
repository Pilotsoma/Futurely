import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { describe, expect, it, jest } from '@jest/globals'

import { RawDataView, isEmptyPortalData } from '../RawDataView'

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

function textsOf(data) {
  let renderer
  act(() => {
    renderer = TestRenderer.create(<RawDataView data={data} />)
  })
  return renderer.root.findAllByType('Text').map((node) => node.props.children)
}

describe('isEmptyPortalData', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['blank string', '   '],
    ['empty array', []],
    ['empty object', {}],
    ['object of empty values', { rows: [], summary: {}, note: null, text: ' ' }],
    ['nested empties', [[], {}, { a: { b: [] } }]],
  ])('treats %s as empty', (_name, value) => {
    expect(isEmptyPortalData(value)).toBe(true)
  })

  it.each([
    ['a number', 0],
    ['false', false],
    ['text', 'A+'],
    ['an array holding zero', [0]],
    ['an object with a value', { count: 0 }],
    ['one populated branch', { rows: [], summary: { gpa: 'A' } }],
  ])('treats %s as content', (_name, value) => {
    expect(isEmptyPortalData(value)).toBe(false)
  })
})

describe('RawDataView', () => {
  it('never prints "No data available."; an empty payload gets the safety-net empty state', () => {
    for (const value of [null, {}, [], { rows: [] }]) {
      const texts = textsOf(value)
      expect(texts).toContain('Nothing to show yet')
      expect(texts).not.toContain('No data available.')
    }
  })

  it('renders keys and values, and a dash for empty values inside a populated payload', () => {
    const texts = textsOf({ student: 'Avery', absences: 2, tardies: null, notes: [] })
    expect(texts).toEqual(
      expect.arrayContaining(['Student', 'Avery', 'Absences', '2', 'Tardies', 'Notes']),
    )
    expect(texts.filter((text) => text === '—')).toHaveLength(2)
    expect(texts).not.toContain('Nothing to show yet')
  })
})
