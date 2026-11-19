import React from 'react'
import { Text } from 'react-native'
import TestRenderer, { act } from 'react-test-renderer'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import ScheduleScreen from '../ScheduleScreen'
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
  getSchedule: jest.fn(),
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

// The e2e fixture shape.
const rows = [
  ['1', 'AP Biology', 'Dr. Rivera', 'Rm 214'],
  ['2', 'English III', 'Ms. Brooks', 'Rm 108'],
  ['3', 'AP U.S. History', 'Mr. Williams', 'Rm 121'],
  ['4', 'Pre-Calculus', 'Mrs. Patel', 'Rm 302'],
  ['5', 'Spanish III', 'Sra. Martinez', 'Rm 117'],
  ['6', 'Physical Education', 'Coach Davis', 'Gym'],
]
const fixture = {
  schedule: rows.map(([Period, Course, Teacher, Room]) => ({
    Period,
    Course,
    Teacher,
    Room,
    Days: 'A Day',
    Semester: 'Full Year',
  })),
}

async function renderScreen() {
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(<ScheduleScreen />)
  })
  await act(async () => {
    await Promise.resolve()
  })
  return renderer
}

function texts(renderer) {
  return renderer.root.findAllByType(Text).map((node) => node.props.children)
}

describe('ScheduleScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows one row per class with period, course, teacher and room and no field labels', async () => {
    gradesApi.getSchedule.mockResolvedValue(fixture)
    const renderer = await renderScreen()
    const shown = texts(renderer)

    for (const [index, [period, course, teacher, room]] of rows.entries()) {
      const row = renderer.root.findAll((n) => n.type === 'View' && n.props.testID === `schedule-row-${index}`)[0]
      expect(row).toBeTruthy()
      const inside = row.findAllByType(Text).map((node) => node.props.children)
      expect(inside).toEqual([period, course, `${teacher} · A Day`, room])
      expect(row.findAll((n) => n.props.accessibilityLabel === `Period ${period}`).length).toBeGreaterThan(0)
    }
    expect(renderer.root.findAll((n) => n.type === 'View' && n.props.testID === 'schedule-card')).toHaveLength(1)
    for (const label of ['Period', 'Course', 'Teacher', 'Room', 'Days', 'Semester', 'Full Year']) {
      expect(shown).not.toContain(label)
    }
    expect(renderer.root.findAllByType(PortalFallback)).toHaveLength(0)
  })

  it('reads a live HAC row (course code plus course name) without showing the code', async () => {
    gradesApi.getSchedule.mockResolvedValue({
      schedule: [{ courseCode: 'BIO4001', courseName: 'AP Biology', period: '1', teacher: 'Rivera, M', room: '214' }],
    })
    const shown = texts(await renderScreen())

    expect(shown).toContain('AP Biology')
    expect(shown).toContain('214')
    expect(shown).not.toContain('BIO4001')
  })

  it('renders the generic fallback when the payload is not a recognised schedule', async () => {
    gradesApi.getSchedule.mockResolvedValue({ schedule: { campus: 'North', note: 'See the front office' } })
    const renderer = await renderScreen()

    expect(renderer.root.findAllByType(PortalFallback)).toHaveLength(1)
    expect(texts(renderer)).toContain('See the front office')
    expect(texts(renderer)).not.toContain('No schedule posted')
  })

  it('renders the empty state for an empty payload', async () => {
    gradesApi.getSchedule.mockResolvedValue({})
    const renderer = await renderScreen()
    const shown = texts(renderer)

    expect(shown).toContain('No schedule posted')
    expect(shown).toContain("Your school hasn't published a schedule for this term.")
    expect(renderer.root.findAllByType(PortalFallback)).toHaveLength(0)
  })

  it('renders the empty state for an empty schedule list', async () => {
    gradesApi.getSchedule.mockResolvedValue({ schedule: [] })
    expect(texts(await renderScreen())).toContain('No schedule posted')
  })

  it('renders the empty state, not a raw dump, for an empty list that carries other fields', async () => {
    gradesApi.getSchedule.mockResolvedValue({ schedule: [], term: 'Fall 2026' })
    const renderer = await renderScreen()

    expect(texts(renderer)).toContain('No schedule posted')
    expect(renderer.root.findAllByType(PortalFallback)).toHaveLength(0)
  })
})
