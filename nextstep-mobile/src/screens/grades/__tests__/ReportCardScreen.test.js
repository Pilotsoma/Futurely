import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import ReportCardScreen from '../ReportCardScreen'
import * as gradesApi from '../../../api/gradesApi'
import { PortalFallback } from '../../../components/grades/portal'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'

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
  getReportCard: jest.fn(),
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

const DASH = String.fromCharCode(0x2014)

// Shape A: the e2e fixture (six courses, 5.5 credits).
const people = [
  ['AP Biology', '1', 93.5, 'A', '1.0', 'Dr. Rivera'],
  ['English III', '2', 88, 'B', '1.0', 'Ms. Brooks'],
  ['AP U.S. History', '3', 91, 'A', '1.0', 'Mr. Williams'],
  ['Pre-Calculus', '4', 86.5, 'B', '1.0', 'Mrs. Patel'],
  ['Spanish III', '5', 95, 'A', '1.0', 'Sra. Martinez'],
  ['Physical Education', '6', 98, 'A', '0.5', 'Coach Davis'],
]
const shapeA = {
  reportingPeriods: ['1st Semester', '2nd Semester'],
  currentPeriod: '1st Semester',
  semesters: {
    sem1: people.map(([name, period, average, letterGrade, credits, teacher]) => ({
      name,
      period,
      numericGrade: String(average),
      letterGrade,
      credits,
      teacher,
    })),
    sem2: people.map(([name, period, average, letterGrade, credits, teacher]) => ({
      name,
      period,
      numericGrade: String(Math.min(100, average + 1)),
      letterGrade,
      credits,
      teacher,
    })),
  },
}

// Shape B: live HAC. Only the first semester has grades.
function hacRow(code, description, period, teacher, marks) {
  return {
    name: `${code} ${DASH} ${description}`,
    period,
    teacher,
    attemptedCredit: '1.0',
    earnedCredit: '1.0',
    sixWeeks1: marks[0],
    sixWeeks2: marks[1],
    sixWeeks3: marks[2],
    exam1: marks[3],
    semester1: marks[4],
    sixWeeks4: '',
    sixWeeks5: '',
    sixWeeks6: '',
    exam2: '',
    semester2: '',
  }
}
const shapeB = {
  reportingPeriods: ['2026-2027 Report Card'],
  currentPeriod: '2026-2027 Report Card',
  courses: [
    hacRow('BIO1', 'AP Biology', '1', 'Dr. Rivera', ['92', '90', '94', '88', '91']),
    hacRow('ENG3', 'English III', '2', 'Ms. Brooks', ['81', '84', '80', '', '82']),
  ],
}

async function renderScreen() {
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(<ReportCardScreen />)
  })
  await act(async () => {
    await Promise.resolve()
  })
  return renderer
}

function texts(renderer) {
  return renderer.root.findAllByType('Text').map((node) => node.props.children)
}

function textsIn(node) {
  return node.findAllByType('Text').map((n) => n.props.children)
}

function row(renderer, index) {
  return renderer.root.findAll((n) => n.type === 'View' && n.props.testID === `report-card-course-${index}`)[0]
}

function sections(renderer) {
  return renderer.root.findAll((n) => n.type === 'View' && n.props.testID === 'report-card-section')
}

function switcher(renderer) {
  return renderer.root.findAllByType(SegmentedControl)[0]
}

async function choose(renderer, label) {
  await act(async () => {
    switcher(renderer).props.onChange(label)
  })
}

describe('ReportCardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('with the e2e fixture shape', () => {
    it('offers a two-segment switcher with 1st Semester selected', async () => {
      gradesApi.getReportCard.mockResolvedValue(shapeA)
      const renderer = await renderScreen()

      expect(switcher(renderer).props.segments).toEqual(['1st Semester', '2nd Semester'])
      expect(switcher(renderer).props.value).toBe('1st Semester')
    })

    it('shows six rows with percent, letter chip and credits, and a 5.5 credits total', async () => {
      gradesApi.getReportCard.mockResolvedValue(shapeA)
      const renderer = await renderScreen()

      expect(sections(renderer)).toHaveLength(1)
      expect(textsIn(sections(renderer)[0]).slice(0, 2)).toEqual(['1st Semester', '5.5 credits'])
      for (const [index, [name, period, average, letter, credits, teacher]] of people.entries()) {
        const found = row(renderer, index)
        expect(found).toBeTruthy()
        expect(textsIn(found)).toEqual([
          name,
          `${teacher} · Period ${period}`,
          `${average}%`,
          letter,
          credits === '1.0' ? '1 credit' : '0.5 credits',
        ])
        expect(found.findAll((n) => n.props.accessibilityLabel === `Grade ${letter}`).length).toBeGreaterThan(0)
      }
      expect(renderer.root.findAllByType(PortalFallback)).toHaveLength(0)
    })

    it('switches to the second semester', async () => {
      gradesApi.getReportCard.mockResolvedValue(shapeA)
      const renderer = await renderScreen()
      await choose(renderer, '2nd Semester')

      expect(switcher(renderer).props.value).toBe('2nd Semester')
      expect(textsIn(sections(renderer)[0]).slice(0, 2)).toEqual(['2nd Semester', '5.5 credits'])
      expect(textsIn(row(renderer, 0))[2]).toBe('94.5%')
    })

    it('shows no raw field names or keys', async () => {
      gradesApi.getReportCard.mockResolvedValue(shapeA)
      const shown = texts(await renderScreen())

      for (const hidden of ['Reporting periods', 'Current period', 'Semesters', 'Sem1', 'Sem2', 'Numeric grade', 'Letter grade', 'Credits']) {
        expect(shown).not.toContain(hidden)
      }
    })
  })

  describe('with the live HAC shape', () => {
    it('offers Semester 1 and Semester 2 and opens on the one with grades', async () => {
      gradesApi.getReportCard.mockResolvedValue(shapeB)
      const renderer = await renderScreen()

      expect(switcher(renderer).props.segments).toEqual(['Semester 1', 'Semester 2'])
      expect(switcher(renderer).props.value).toBe('Semester 1')
    })

    it('shows the course without its code, a derived letter, credits and the six-weeks breakdown', async () => {
      gradesApi.getReportCard.mockResolvedValue(shapeB)
      const renderer = await renderScreen()

      expect(textsIn(row(renderer, 0))).toEqual([
        'AP Biology',
        'Dr. Rivera · Period 1',
        '1st 92 · 2nd 90 · 3rd 94 · Exam 88',
        '91%',
        'A',
        '1 credit',
      ])
      // A blank exam is left out of the breakdown; 82 derives a B.
      expect(textsIn(row(renderer, 1))).toEqual([
        'English III',
        'Ms. Brooks · Period 2',
        '1st 81 · 2nd 84 · 3rd 80',
        '82%',
        'B',
        '1 credit',
      ])
      expect(texts(renderer).some((t) => typeof t === 'string' && t.includes('BIO1'))).toBe(false)
    })

    it('opens on the second semester when only it has grades', async () => {
      gradesApi.getReportCard.mockResolvedValue({
        courses: [{ ...shapeB.courses[0], sixWeeks1: '', sixWeeks2: '', sixWeeks3: '', exam1: '', semester1: '', sixWeeks4: '85', semester2: '85' }],
      })
      const renderer = await renderScreen()

      expect(switcher(renderer).props.value).toBe('Semester 2')
      expect(textsIn(sections(renderer)[0])).toContain('4th 85')
    })

    it('says the second semester has not been posted yet', async () => {
      gradesApi.getReportCard.mockResolvedValue(shapeB)
      const renderer = await renderScreen()
      await choose(renderer, 'Semester 2')

      expect(textsIn(sections(renderer)[0])).toEqual(['Semester 2', 'Grades for Semester 2 have not been posted yet.'])
      expect(row(renderer, 0)).toBeUndefined()
    })
  })

  it('has no switcher for a single section', async () => {
    gradesApi.getReportCard.mockResolvedValue({
      reportingPeriods: ['Final'],
      semesters: { final: [{ name: 'Art', numericGrade: '90', letterGrade: 'A', credits: '1.0' }] },
    })
    const renderer = await renderScreen()

    expect(renderer.root.findAllByType(SegmentedControl)).toHaveLength(0)
    expect(sections(renderer)).toHaveLength(1)
  })

  it('stacks every section and shows no switcher for four or more', async () => {
    const rows = [{ name: 'Art', numericGrade: '90', letterGrade: 'A', credits: '1.0' }]
    gradesApi.getReportCard.mockResolvedValue({
      reportingPeriods: ['Q1', 'Q2', 'Q3', 'Q4'],
      semesters: { q1: rows, q2: rows, q3: rows, q4: rows },
    })
    const renderer = await renderScreen()

    expect(renderer.root.findAllByType(SegmentedControl)).toHaveLength(0)
    expect(sections(renderer).map((s) => textsIn(s)[0])).toEqual(['Q1', 'Q2', 'Q3', 'Q4'])
  })

  it('shows the portal message in the empty state when there are no courses', async () => {
    const message = 'This student does not have any Report Cards for this school year.'
    gradesApi.getReportCard.mockResolvedValue({
      reportingPeriods: ['2026-2027 Report Card'],
      currentPeriod: '2026-2027 Report Card',
      message,
      courses: [],
    })
    const shown = texts(await renderScreen())

    expect(shown).toContain('No report card yet')
    expect(shown).toContain(message)
    expect(shown).not.toContain('Report cards appear here after each grading period closes.')
    expect(shown).not.toContain('Reporting periods')
  })

  it('uses the default empty copy for an empty payload and for empty courses without a message', async () => {
    for (const payload of [{}, { reportingPeriods: ['2026'], courses: [] }]) {
      gradesApi.getReportCard.mockResolvedValue(payload)
      const shown = texts(await renderScreen())

      expect(shown).toContain('No report card yet')
      expect(shown).toContain('Report cards appear here after each grading period closes.')
    }
  })

  it('renders the generic fallback when the payload is not a recognised report card', async () => {
    gradesApi.getReportCard.mockResolvedValue({ note: 'Report cards are mailed home' })
    const renderer = await renderScreen()

    expect(renderer.root.findAllByType(PortalFallback)).toHaveLength(1)
    expect(texts(renderer)).toContain('Report cards are mailed home')
  })
})
