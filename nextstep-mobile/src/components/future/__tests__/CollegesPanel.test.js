import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import { CollegesPanel } from '../CollegesPanel'
import * as collegesApi from '../../../api/collegesApi'
import * as studentsApi from '../../../api/studentsApi'
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
    Circle: Stub,
    Defs: Stub,
    LinearGradient: Stub,
    Stop: Stub,
    Rect: Stub,
  }
})
jest.mock('../../ui/LoadingSkeleton', () => ({
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
// The panel loads on focus; run the effect on mount instead.
jest.mock('@react-navigation/native', () => {
  const React = require('react')
  return {
    useFocusEffect: (effect) => {
      React.useEffect(effect, [effect])
    },
  }
})
jest.mock('../../../api/collegesApi', () => ({
  listSavedColleges: jest.fn(),
  searchColleges: jest.fn(),
  addCollege: jest.fn(),
  removeCollege: jest.fn(),
  getCollegeInsights: jest.fn(),
}))
jest.mock('../../../api/studentsApi', () => ({ getMe: jest.fn() }))
jest.mock('../../../api/gradesApi', () => ({ getGpa: jest.fn() }))
// The api modules pull in api/client, which pulls in the native token storage.
jest.mock('../../../utils/storage', () => ({
  clearTokens: jest.fn(),
  loadTokens: jest.fn(),
  storeTokens: jest.fn(),
}))

jest.setTimeout(30000)

const college = {
  id: 7,
  name: 'Texas A&M University',
  scorecardUnitId: '228723',
  createdAt: '2026-01-01T00:00:00.000Z',
  unitId: '228723',
  city: 'College Station',
  state: 'TX',
  admissionRate: 0.63,
  sat25th: 1100,
  sat75th: 1330,
  score: 72,
  label: 'Target',
}

async function renderPanel() {
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(<CollegesPanel />)
  })
  await act(async () => {
    await Promise.resolve()
  })
  return renderer
}

function texts(renderer) {
  return renderer.root.findAllByType('Text').map((node) => node.props.children)
}

describe('CollegesPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    studentsApi.getMe.mockResolvedValue(null)
    gradesApi.getGpa.mockResolvedValue({
      gpa: 3.875,
      unweightedGpa: 3.875,
      weightedGpa: 4.125,
      courseCount: 2,
      systemType: 'HAC',
    })
  })

  it('labels the GPAs in full, unweighted first, to three decimals', async () => {
    collegesApi.listSavedColleges.mockResolvedValue([])
    const shown = texts(await renderPanel())

    const stats = shown.filter((value) =>
      ['3.875', '4.125', 'Unweighted', 'Weighted'].includes(value),
    )
    expect(stats).toEqual(['3.875', 'Unweighted', '4.125', 'Weighted'])
    expect(shown).not.toContain('UW GPA')
    expect(shown).not.toContain('W GPA')
  })

  it('gives each fit score a unit', async () => {
    collegesApi.listSavedColleges.mockResolvedValue([college])
    const shown = texts(await renderPanel())

    expect(shown).toContain(72)
    expect(shown).toContain('fit score')
  })

  it('shows the shared empty state for an empty list', async () => {
    collegesApi.listSavedColleges.mockResolvedValue([])
    const shown = texts(await renderPanel())

    expect(shown).toContain('No colleges added yet')
    expect(shown).not.toContain('Try again')
  })

  it('shows one error block, not an error line above "No colleges added yet", when the load fails', async () => {
    collegesApi.listSavedColleges.mockRejectedValue(new Error('Unhandled E2E route: GET /colleges'))
    const shown = texts(await renderPanel())

    expect(shown).toContain('Try again')
    expect(shown).toContain("We couldn't load your college list.")
    expect(shown).not.toContain('No colleges added yet')
    expect(shown.join(' ')).not.toMatch(/Unhandled/)
    // A failed load must not also tell the student to go add a GPA.
    expect(shown.join(' ')).not.toMatch(/Add your GPA and SAT/)
    // The error is the block itself, not also a dismissible line above the search.
    expect(shown.filter((value) => value === "We couldn't load your college list.")).toHaveLength(1)
  })
})
