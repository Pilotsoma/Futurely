import React from 'react'
import { Text } from 'react-native'
import TestRenderer, { act } from 'react-test-renderer'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import ProgressReportScreen from '../ProgressReportScreen'
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
  getProgressReport: jest.fn(),
}))
jest.mock('../../../utils/storage', () => ({
  clearTokens: jest.fn(),
  loadTokens: jest.fn(),
  storeTokens: jest.fn(),
}))
jest.mock('../../../preferences/displayPreferences', () => ({
  useDisplayPreferences: () => ({
    hideGpa: false,
    gradeColors: { A: '#22C55E', B: '#10B981', C: '#F59E0B', D: '#F97316', F: '#EF4444' },
  }),
}))

jest.setTimeout(30000)

const now = new Date()
const usDate = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`
const asOf = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

// The e2e fixture shape.
const people = [
  ['AP Biology', '1', '93.5', 'A', 'Dr. Rivera'],
  ['English III', '2', '88', 'B', 'Ms. Brooks'],
  ['AP U.S. History', '3', '91', 'A', 'Mr. Williams'],
  ['Pre-Calculus', '4', '86.5', 'B', 'Mrs. Patel'],
  ['Spanish III', '5', '95', 'A', 'Sra. Martinez'],
  ['Physical Education', '6', '98', 'A', 'Coach Davis'],
]
const fixture = {
  availableDates: [usDate, '10/09/2026'],
  currentDate: usDate,
  courses: people.map(([name, period, average, letterGrade, teacher]) => ({ name, period, average, letterGrade, teacher })),
}

async function renderScreen() {
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(<ProgressReportScreen />)
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

describe('ProgressReportScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows one row per course with teacher and period, percent and a letter chip', async () => {
    gradesApi.getProgressReport.mockResolvedValue(fixture)
    const renderer = await renderScreen()

    for (const [index, [name, period, average, letter, teacher]] of people.entries()) {
      const row = node(renderer, `progress-course-${index}`)
      expect(row).toBeTruthy()
      expect(row.findAllByType(Text).map((n) => n.props.children)).toEqual([
        name,
        `${teacher} · Period ${period}`,
        `${average}%`,
        letter,
      ])
      expect(row.findAll((n) => n.props.accessibilityLabel === `Grade ${letter}`).length).toBeGreaterThan(0)
    }
    expect(renderer.root.findAllByType(PortalFallback)).toHaveLength(0)
  })

  it('puts the report date in the card header', async () => {
    gradesApi.getProgressReport.mockResolvedValue(fixture)
    const renderer = await renderScreen()

    expect(node(renderer, 'progress-report-card')).toBeTruthy()
    const shown = texts(renderer)
    expect(shown).toContain('Current grades')
    expect(shown).toContain(`As of ${asOf}`)
  })

  it('shows no raw field names or the list of available dates', async () => {
    gradesApi.getProgressReport.mockResolvedValue(fixture)
    const shown = texts(await renderScreen())

    for (const label of ['Available dates', 'Current date', 'Courses', 'Average', 'Letter grade', 'Teacher', 'Period', 'Name']) {
      expect(shown).not.toContain(label)
    }
    expect(shown).not.toContain('10/09/2026')
  })

  it('derives the letter when live HAC repeats the average in the letter field', async () => {
    gradesApi.getProgressReport.mockResolvedValue({
      courses: [{ name: 'Biology', period: '1', average: '93', letterGrade: '93', teacher: 'R' }],
    })
    const renderer = await renderScreen()
    const row = node(renderer, 'progress-course-0')

    expect(row.findAllByType(Text).map((n) => n.props.children)).toEqual(['Biology', 'R · Period 1', '93%', 'A'])
    expect(texts(renderer)).not.toContain('As of')
    expect(texts(renderer).some((t) => typeof t === 'string' && t.startsWith('As of'))).toBe(false)
  })

  it('prints a code such as EX where the percent would be', async () => {
    gradesApi.getProgressReport.mockResolvedValue({ courses: [{ name: 'Choir', average: 'EX', letterGrade: '' }] })
    const row = node(await renderScreen(), 'progress-course-0')

    expect(row.findAllByType(Text).map((n) => n.props.children)).toEqual(['Choir', 'EX'])
  })

  it('renders the generic fallback when the payload is not a recognised progress report', async () => {
    gradesApi.getProgressReport.mockResolvedValue({ note: 'Interim reports are printed' })
    const renderer = await renderScreen()

    expect(renderer.root.findAllByType(PortalFallback)).toHaveLength(1)
    expect(texts(renderer)).toContain('Interim reports are printed')
  })

  it('renders the empty state for an empty payload', async () => {
    gradesApi.getProgressReport.mockResolvedValue({})
    const shown = texts(await renderScreen())

    expect(shown).toContain('No progress report yet')
    expect(shown).toContain('Progress reports appear here once your school posts interim grades.')
  })

  it('renders the empty state, not a raw dump, for an empty course list that carries report dates', async () => {
    gradesApi.getProgressReport.mockResolvedValue({
      availableDates: ['11/06/2026'],
      currentDate: '11/06/2026',
      courses: [],
    })
    const renderer = await renderScreen()

    expect(texts(renderer)).toContain('No progress report yet')
    expect(renderer.root.findAllByType(PortalFallback)).toHaveLength(0)
    expect(texts(renderer)).not.toContain('11/06/2026')
  })
})
