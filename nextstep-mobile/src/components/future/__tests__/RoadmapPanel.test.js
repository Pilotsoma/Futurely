import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import { RoadmapPanel } from '../RoadmapPanel'
import * as roadmapApi from '../../../api/roadmapApi'

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
    RadialGradient: Stub,
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
jest.mock('../../../api/roadmapApi', () => ({
  getRoadmap: jest.fn(),
}))
// roadmapApi pulls in api/client, which pulls in the native token storage.
jest.mock('../../../utils/storage', () => ({
  clearTokens: jest.fn(),
  loadTokens: jest.fn(),
  storeTokens: jest.fn(),
}))

jest.setTimeout(30000)

// The app's placeholder for a value that has not been calculated (formatGpa(null)).
const EMPTY_VALUE = String.fromCharCode(0x2014)

const roadmap = {
  gradeLevel: 11,
  graduationYear: 2028,
  creditsCompleted: 18,
  creditsRequired: 24,
  percentComplete: 75,
  creditsByCategory: { English: 4, Math: 4 },
  milestones: [
    { grade: 9, label: 'Build strong foundations', done: true },
    { grade: 10, label: 'Explore academic interests', done: true },
    { grade: 11, label: 'Prepare for college applications', done: false },
    { grade: 12, label: 'Complete graduation requirements', done: false },
  ],
  weightedGpa: 4.125,
  unweightedGpa: 3.875,
  futureDecision: null,
}

async function renderPanel() {
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(<RoadmapPanel />)
  })
  await act(async () => {
    await Promise.resolve()
  })
  return renderer
}

function texts(renderer) {
  return renderer.root.findAllByType('Text').map((node) => node.props.children)
}

describe('RoadmapPanel GPA row', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows unweighted first, then weighted, both to three decimals', async () => {
    roadmapApi.getRoadmap.mockResolvedValue(roadmap)
    const shown = texts(await renderPanel())

    const metrics = shown.filter((value) => ['3.875', '4.125', 'Unweighted', 'Weighted'].includes(value))
    expect(metrics).toEqual(['3.875', 'Unweighted', '4.125', 'Weighted'])
    // The old two-decimal rendering must be gone.
    expect(shown).not.toContain('3.88')
    expect(shown).not.toContain('4.13')
  })

  it('shows a placeholder, and does not throw, when the API sends a null GPA', async () => {
    roadmapApi.getRoadmap.mockResolvedValue({ ...roadmap, unweightedGpa: null, weightedGpa: null })
    const shown = texts(await renderPanel())

    expect(shown).toContain('Unweighted')
    expect(shown.filter((value) => value === EMPTY_VALUE)).toHaveLength(2)
    expect(shown).toContain('11th')
  })

  it('shows the pace pill only when credit data exists', async () => {
    roadmapApi.getRoadmap.mockResolvedValue(roadmap)
    const withCredits = texts(await renderPanel())
    expect(withCredits.some((value) => value === 'On track' || value === 'Behind pace')).toBe(true)

    // 0 of 24 credits and no category breakdown: nothing to be on track about.
    roadmapApi.getRoadmap.mockResolvedValue({
      ...roadmap,
      creditsCompleted: 0,
      percentComplete: 0,
      creditsByCategory: {},
    })
    const noCredits = texts(await renderPanel())
    expect(noCredits).not.toContain('On track')
    expect(noCredits).not.toContain('Behind pace')
  })

  it('shows a friendly error with a retry when the load fails', async () => {
    roadmapApi.getRoadmap.mockRejectedValue(new Error('Unhandled E2E route: GET /roadmap'))
    const shown = texts(await renderPanel())

    expect(shown).toContain('Try again')
    expect(shown.join(' ')).not.toMatch(/Unhandled/)
    expect(shown).not.toContain('Unweighted')
  })
})
