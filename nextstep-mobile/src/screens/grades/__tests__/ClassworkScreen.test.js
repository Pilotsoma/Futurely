import React from 'react'
import { StyleSheet } from 'react-native'
import TestRenderer, { act } from 'react-test-renderer'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import ClassworkScreen from '../ClassworkScreen'
import * as gradesApi from '../../../api/gradesApi'
import { PortalFallback, PortalRow } from '../../../components/grades/portal'
import { colors } from '../../../theme/tokens'

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
  getClasswork: jest.fn(),
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

const year = new Date().getFullYear()

// The e2e fixture shape: six classes, two assignments each.
const people = [
  ['AP Biology', '1', 93.5, 'A', 'Dr. Rivera'],
  ['English III', '2', 88, 'B', 'Ms. Brooks'],
  ['AP U.S. History', '3', 91, 'A', 'Mr. Williams'],
  ['Pre-Calculus', '4', 86.5, 'B', 'Mrs. Patel'],
  ['Spanish III', '5', 95, 'A', 'Sra. Martinez'],
  ['Physical Education', '6', 98, 'A', 'Coach Davis'],
]
const fixture = {
  classes: people.map(([name, period, average, letterGrade, teacher]) => ({
    name,
    period,
    teacher,
    room: 'Rm 214',
    average: String(average),
    letterGrade,
    categoryWeights: { Daily: 0.4, Minor: 0.3, Major: 0.3 },
    scores: [
      { name: 'Unit Test', category: 'Major', score: Math.round(average), totalPoints: 100, percentage: String(Math.round(average)), dateDue: `${year}-03-05` },
      { name: 'Homework Set', category: 'Daily', score: Math.round(average * 0.2), totalPoints: 20, percentage: String(Math.round(average)), dateDue: `${year}-03-09` },
    ],
  })),
  availablePeriods: ['1', '2', '3', '4', '5', '6'],
  currentPeriod: '1',
}

function assignmentList(count) {
  return Array.from({ length: count }, (_, index) => ({
    name: `Assignment ${index + 1}`,
    category: 'Daily',
    score: 9,
    totalPoints: 10,
    percentage: '90',
    dateDue: `${year}-03-0${(index % 9) + 1}`,
  }))
}

async function renderScreen() {
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(<ClassworkScreen />)
  })
  await act(async () => {
    await Promise.resolve()
  })
  return renderer
}

function texts(renderer) {
  return renderer.root.findAllByType('Text').map((node) => node.props.children)
}

function card(renderer, index) {
  return renderer.root.findAll((n) => n.type === 'View' && n.props.testID === `classwork-class-${index}`)[0]
}

function textsIn(node) {
  return node.findAllByType('Text').map((n) => n.props.children)
}

function toggle(renderer, index) {
  return card(renderer, index)
    .findAll((n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function')[0]
}

async function press(node) {
  await act(async () => {
    node.props.onPress()
  })
}

describe('ClassworkScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows one card per class with percent, letter chip, teacher, period and one weights line', async () => {
    gradesApi.getClasswork.mockResolvedValue(fixture)
    const renderer = await renderScreen()

    for (const [index, [name, period, average, letter, teacher]] of people.entries()) {
      const found = card(renderer, index)
      expect(found).toBeTruthy()
      expect(textsIn(found).slice(0, 5)).toEqual([
        name,
        `${average}%`,
        letter,
        `${teacher} · Period ${period}`,
        'Daily 40% · Minor 30% · Major 30%',
      ])
      expect(found.findAll((n) => n.props.accessibilityLabel === `Grade ${letter}`).length).toBeGreaterThan(0)
    }
    expect(renderer.root.findAllByType(PortalFallback)).toHaveLength(0)
  })

  it('lists assignments with a category, due date and score pill', async () => {
    gradesApi.getClasswork.mockResolvedValue(fixture)
    const found = card(await renderScreen(), 0)

    const rows = found.findAllByType(PortalRow)
    expect(rows).toHaveLength(2)
    expect(textsIn(rows[0])).toEqual(['Unit Test', 'Major · Due Mar 5', '94/100'])
    expect(textsIn(rows[1])).toEqual(['Homework Set', 'Daily · Due Mar 9', '19/20'])
  })

  it('shows no raw field names, weight fractions or hidden fields', async () => {
    gradesApi.getClasswork.mockResolvedValue(fixture)
    const shown = texts(await renderScreen())

    for (const hidden of ['Room', 'Rm 214', 'Percentage', 'Available periods', 'Current period', 'Category weights', '0.4', '0.3', 'Unknown class']) {
      expect(shown).not.toContain(hidden)
    }
    expect(shown.some((t) => typeof t === 'string' && /DAILY|MINOR|MAJOR/.test(t))).toBe(false)
  })

  it('derives a chip when the portal sends no letter grade (live HAC)', async () => {
    gradesApi.getClasswork.mockResolvedValue({
      classes: [{ name: 'English III', period: '2', teacher: 'Ms. Brooks', average: '88.40', scores: [] }],
    })
    const found = card(await renderScreen(), 0)

    expect(textsIn(found).slice(0, 3)).toEqual(['English III', '88.4%', 'B'])
    expect(found.findAll((n) => n.props.accessibilityLabel === 'Grade B').length).toBeGreaterThan(0)
  })

  it('leaves out the parts a class is missing', async () => {
    gradesApi.getClasswork.mockResolvedValue({ classes: [{ name: 'Choir', teacher: 'Mr. Lee' }] })
    const found = card(await renderScreen(), 0)

    expect(textsIn(found)).toEqual(['Choir', 'Mr. Lee', 'No assignments posted yet.'])
  })

  it('says so inside the card when a class has no assignments', async () => {
    gradesApi.getClasswork.mockResolvedValue({ classes: [{ name: 'Choir', average: '90', scores: [] }] })
    const found = card(await renderScreen(), 0)

    expect(textsIn(found)).toContain('No assignments posted yet.')
    expect(found.findAllByType(PortalRow)).toHaveLength(0)
  })

  it('shows a Not graded pill for an assignment without a score', async () => {
    gradesApi.getClasswork.mockResolvedValue({
      classes: [{ name: 'Art', scores: [{ name: 'Sketch', category: 'Daily', score: null, totalPoints: 25, dateDue: `${year}-03-05` }] }],
    })
    const row = card(await renderScreen(), 0).findAllByType(PortalRow)[0]

    expect(textsIn(row)).toEqual(['Sketch', 'Daily · Due Mar 5', 'Not graded'])
  })

  it('colours the score pill by how well the student did', async () => {
    gradesApi.getClasswork.mockResolvedValue({
      classes: [
        {
          name: 'Art',
          scores: [
            { name: 'High', score: 95, totalPoints: 100 },
            { name: 'Mid', score: 80, totalPoints: 100 },
            { name: 'Low', score: 65, totalPoints: 100 },
            { name: 'Fail', score: 50, totalPoints: 100 },
          ],
        },
      ],
    })
    const found = card(await renderScreen(), 0)
    const colorOf = (label) =>
      StyleSheet.flatten(found.findAllByType('Text').find((n) => n.props.children === label).props.style).color

    expect(colorOf('95/100')).toBe(colors.success)
    expect(colorOf('80/100')).toBe(colors.textSecondary)
    expect(colorOf('65/100')).toBe(colors.warning)
    expect(colorOf('50/100')).toBe(colors.error)
  })

  describe('long assignment lists', () => {
    it('shows five and offers a 44pt "Show all N assignments" button, with no separate accessibility label', async () => {
      gradesApi.getClasswork.mockResolvedValue({ classes: [{ name: 'Art', scores: assignmentList(12) }] })
      const renderer = await renderScreen()
      const button = toggle(renderer, 0)

      expect(card(renderer, 0).findAllByType(PortalRow)).toHaveLength(5)
      expect(textsIn(button)).toEqual(['Show all 12 assignments'])
      expect(button.props.accessibilityLabel).toBeUndefined()
      expect(StyleSheet.flatten(button.props.style({ pressed: false })).minHeight).toBeGreaterThanOrEqual(44)
    })

    it('expands to every assignment and collapses again, per class', async () => {
      gradesApi.getClasswork.mockResolvedValue({
        classes: [
          { name: 'Art', scores: assignmentList(7) },
          { name: 'Music', scores: assignmentList(9) },
        ],
      })
      const renderer = await renderScreen()

      await press(toggle(renderer, 0))
      expect(card(renderer, 0).findAllByType(PortalRow)).toHaveLength(7)
      expect(textsIn(toggle(renderer, 0))).toEqual(['Show fewer'])
      expect(card(renderer, 1).findAllByType(PortalRow)).toHaveLength(5)
      expect(textsIn(toggle(renderer, 1))).toEqual(['Show all 9 assignments'])

      await press(toggle(renderer, 0))
      expect(card(renderer, 0).findAllByType(PortalRow)).toHaveLength(5)
    })

    it('draws a divider under the fifth row only while the button follows it', async () => {
      gradesApi.getClasswork.mockResolvedValue({
        classes: [
          { name: 'Art', scores: assignmentList(7) },
          { name: 'Music', scores: assignmentList(3) },
        ],
      })
      const renderer = await renderScreen()
      const lastDivider = (index) => {
        const rows = card(renderer, index).findAll(
          (n) => n.type === 'View' && n.props.accessible === true && n.props.accessibilityRole !== 'button',
        )
        return StyleSheet.flatten(rows[rows.length - 1].props.style).borderBottomWidth
      }

      expect(lastDivider(0)).toBeGreaterThan(0)
      expect(lastDivider(1)).toBeUndefined()
    })

    it('offers no button for exactly five assignments', async () => {
      gradesApi.getClasswork.mockResolvedValue({ classes: [{ name: 'Art', scores: assignmentList(5) }] })
      const renderer = await renderScreen()

      expect(card(renderer, 0).findAllByType(PortalRow)).toHaveLength(5)
      expect(toggle(renderer, 0)).toBeUndefined()
    })
  })

  it('renders the generic fallback when the payload is not recognised classwork', async () => {
    gradesApi.getClasswork.mockResolvedValue({ note: 'Classwork is posted on paper' })
    const renderer = await renderScreen()

    expect(renderer.root.findAllByType(PortalFallback)).toHaveLength(1)
    expect(texts(renderer)).toContain('Classwork is posted on paper')
  })

  it('renders the empty state for an empty payload or an empty class list', async () => {
    for (const payload of [
      {},
      { classes: [], availablePeriods: [], currentPeriod: '' },
      { classes: [] },
      { classes: [], availablePeriods: ['1'], currentPeriod: '1' },
    ]) {
      gradesApi.getClasswork.mockResolvedValue(payload)
      const shown = texts(await renderScreen())

      expect(shown).toContain('No classwork yet')
      expect(shown).toContain("Your teachers haven't posted assignments for this grading period.")
    }
  })
})
