import React from 'react'
import { Text } from 'react-native'
import TestRenderer, { act } from 'react-test-renderer'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import TranscriptScreen from '../TranscriptScreen'
import * as gradesApi from '../../../api/gradesApi'
import { PortalFallback } from '../../../components/grades/portal'

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}))
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
jest.mock('@react-navigation/native', () => {
  const React = require('react')
  return {
    useFocusEffect: (effect) => {
      React.useEffect(effect, [effect])
    },
  }
})
jest.mock('../../../api/gradesApi', () => ({
  getTranscript: jest.fn(),
}))
jest.mock('../../../utils/storage', () => ({
  clearTokens: jest.fn(),
  loadTokens: jest.fn(),
  storeTokens: jest.fn(),
}))
// The real hook needs the auth and storage providers; the screen only reads hideGpa and grade colours.
const mockPreferences = {
  hideGpa: false,
  gradeColors: { A: '#22C55E', B: '#10B981', C: '#F59E0B', D: '#F97316', F: '#EF4444' },
}
jest.mock('../../../preferences/displayPreferences', () => ({
  useDisplayPreferences: () => mockPreferences,
}))

jest.setTimeout(30000)

const sophomore = [
  { name: 'Biology', grade: 'A', credits: '1.0' },
  { name: 'English II', grade: 'A', credits: '1.0' },
  { name: 'Geometry', grade: 'B', credits: '1.0' },
  { name: 'World History', grade: 'A', credits: '1.0' },
  { name: 'Spanish II', grade: 'A', credits: '1.0' },
  { name: 'Health', grade: 'A', credits: '0.5' },
]
const freshman = [
  { name: 'Algebra I', grade: 'B', credits: '1.0' },
  { name: 'English I', grade: 'A', credits: '1.0' },
  { name: 'Earth Science', grade: 'A', credits: '1.0' },
  { name: 'Geography', grade: 'B', credits: '1.0' },
  { name: 'Spanish I', grade: 'A', credits: '1.0' },
  { name: 'Physical Education', grade: 'A', credits: '0.5' },
]
// The e2e fixture shape.
const fixture = {
  systemType: 'HAC',
  transcript: {
    semesters: [
      { year: '2025-2026', semester: 'Spring', courses: sophomore },
      { year: '2025-2026', semester: 'Fall', courses: sophomore },
      { year: '2024-2025', semester: 'Spring', courses: freshman },
      { year: '2024-2025', semester: 'Fall', courses: freshman },
    ],
    cumulativeGPA: '3.875',
    weightedGPA: '4.125',
    unweightedGPA: '3.875',
    classRank: '58/412',
    quartile: '1',
  },
}

async function renderScreen() {
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(<TranscriptScreen />)
  })
  await act(async () => {
    await Promise.resolve()
  })
  return renderer
}

function texts(renderer) {
  return renderer.root.findAllByType(Text).map((node) => node.props.children)
}

function node(renderer, testID) {
  return renderer.root.findAll((n) => n.type === 'View' && n.props.testID === testID)[0]
}

describe('TranscriptScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPreferences.hideGpa = false
    gradesApi.getTranscript.mockResolvedValue(fixture)
  })

  it('shows unweighted GPA first, then weighted and class rank, plus the quartile', async () => {
    const renderer = await renderScreen()
    const summary = node(renderer, 'transcript-summary')

    expect(summary.findAllByType(Text).map((n) => n.props.children)).toEqual([
      '3.875',
      'Unweighted',
      '4.125',
      'Weighted',
      '58/412',
      'Class rank',
    ])
    expect(texts(renderer)).toContain('Quartile 1')
    expect(texts(renderer)).not.toContain('Cumulative')
  })

  it('shows one card per semester with letter chips, credits and a credit total', async () => {
    const renderer = await renderScreen()

    for (const [index, [title, meta, total]] of [
      ['Spring', '2025-2026', '5.5 credits'],
      ['Fall', '2025-2026', '5.5 credits'],
      ['Spring', '2024-2025', '5.5 credits'],
      ['Fall', '2024-2025', '5.5 credits'],
    ].entries()) {
      const card = node(renderer, `transcript-section-${index}`)
      expect(card).toBeTruthy()
      const inside = card.findAllByType(Text).map((n) => n.props.children)
      expect(inside.slice(0, 2)).toEqual([title, meta])
      expect(inside[inside.length - 1]).toBe(total)
      expect(card.findAll((n) => n.props.accessibilityLabel === 'Grade A').length).toBeGreaterThan(0)
      expect(inside).toContain('1 credit')
      expect(inside).toContain('0.5 credits')
    }
    expect(node(renderer, 'transcript-section-4')).toBeUndefined()
    expect(renderer.root.findAllByType(PortalFallback)).toHaveLength(0)
  })

  it('masks the GPA strip, the rank and the quartile when Hide GPA is on', async () => {
    mockPreferences.hideGpa = true
    const renderer = await renderScreen()
    const shown = texts(renderer)

    expect(node(renderer, 'transcript-summary').findAllByType(Text).map((n) => n.props.children)).toEqual([
      '••••',
      'Unweighted',
      '••••',
      'Weighted',
    ])
    expect(shown).not.toContain('3.875')
    expect(shown).not.toContain('4.125')
    expect(shown).not.toContain('58/412')
    expect(shown).not.toContain('Quartile 1')
    // Course grades and credits are not GPA figures and stay visible.
    expect(shown).toContain('Biology')
  })

  it('omits the strip entirely when the portal sent no GPA, rank or quartile', async () => {
    gradesApi.getTranscript.mockResolvedValue({
      transcript: { semesters: fixture.transcript.semesters, cumulativeGPA: null, weightedGPA: null, unweightedGPA: null, classRank: null, quartile: null },
    })
    const renderer = await renderScreen()

    expect(node(renderer, 'transcript-summary')).toBeUndefined()
    expect(texts(renderer)).toContain('Biology')
  })

  it('falls back to the cumulative GPA only when unweighted and weighted are both missing', async () => {
    gradesApi.getTranscript.mockResolvedValue({
      transcript: { semesters: fixture.transcript.semesters, cumulativeGPA: '3.5', weightedGPA: null, unweightedGPA: '' },
    })
    const renderer = await renderScreen()

    expect(node(renderer, 'transcript-summary').findAllByType(Text).map((n) => n.props.children)).toEqual([
      '3.500',
      'Cumulative',
    ])
  })

  it('renders a PowerSchool header-keyed transcript as one card of term pills', async () => {
    gradesApi.getTranscript.mockResolvedValue({
      systemType: 'POWERSCHOOL',
      transcript: {
        terms: ['Exp', 'Course', 'Last Week', 'This Week', 'Q1', 'Q2', 'S1', 'Absences', 'Tardies'],
        courses: [
          { Exp: '1(A)', Course: 'AP Biology', 'Last Week': '93', 'This Week': '94', Q1: '92', Q2: '', S1: 'A', Absences: '0', Tardies: '1' },
        ],
      },
    })
    const renderer = await renderScreen()
    const card = node(renderer, 'transcript-section-0')

    expect(card.findAllByType(Text).map((n) => n.props.children)).toEqual(['Courses', 'AP Biology', 'Q1 92', 'S1 A'])
    expect(node(renderer, 'transcript-summary')).toBeUndefined()
    expect(texts(renderer)).not.toContain('1(A)')
  })

  it('renders the generic fallback when the payload is not a recognised transcript', async () => {
    gradesApi.getTranscript.mockResolvedValue({ transcript: { notice: 'Request a copy from the registrar' } })
    const renderer = await renderScreen()

    expect(renderer.root.findAllByType(PortalFallback)).toHaveLength(1)
    expect(texts(renderer)).toContain('Request a copy from the registrar')
  })

  it('renders the empty state when there is no transcript', async () => {
    gradesApi.getTranscript.mockResolvedValue({ transcript: {} })
    const shown = texts(await renderScreen())

    expect(shown).toContain('No transcript yet')
    expect(shown).toContain('Your transcript appears after your first completed semester.')
  })
})
