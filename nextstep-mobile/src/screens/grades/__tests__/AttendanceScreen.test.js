import React from 'react'
import { StyleSheet } from 'react-native'
import TestRenderer, { act } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

import AttendanceScreen from '../AttendanceScreen'
import * as gradesApi from '../../../api/gradesApi'
import { PortalRow } from '../../../components/grades/portal/PortalRow'
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
  getAttendance: jest.fn(),
}))
// usePortalFetch imports api/client for its error class, which pulls in the native token storage.
jest.mock('../../../utils/storage', () => ({
  clearTokens: jest.fn(),
  loadTokens: jest.fn(),
  storeTokens: jest.fn(),
}))

jest.setTimeout(30000)

function monthName(offset) {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + offset, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

async function renderScreen() {
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(<AttendanceScreen />)
  })
  await act(async () => {
    await Promise.resolve()
  })
  return renderer
}

function texts(renderer) {
  return renderer.root.findAllByType('Text').map((node) => node.props.children)
}

function button(renderer, label) {
  return renderer.root
    .findAllByProps({ accessibilityLabel: label })
    .find((node) => typeof node.props.onPress === 'function')
}

describe('AttendanceScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    gradesApi.getAttendance.mockResolvedValue({})
  })

  it('names the month it is showing and offers both chevrons at 44pt', async () => {
    const renderer = await renderScreen()

    expect(texts(renderer)).toContain(monthName(0))
    for (const label of ['Previous month', 'Next month']) {
      const style = StyleSheet.flatten(button(renderer, label).props.style({ pressed: false }))
      expect(style.width).toBeGreaterThanOrEqual(44)
      expect(style.height).toBeGreaterThanOrEqual(44)
    }
  })

  it('disables Next for the current month and steps back and forward by month', async () => {
    const renderer = await renderScreen()
    expect(button(renderer, 'Next month').props.disabled).toBe(true)
    expect(gradesApi.getAttendance).toHaveBeenLastCalledWith(0)

    await act(async () => {
      button(renderer, 'Previous month').props.onPress()
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(texts(renderer)).toContain(monthName(-1))
    expect(gradesApi.getAttendance).toHaveBeenLastCalledWith(-1)
    expect(button(renderer, 'Next month').props.disabled).toBe(false)

    await act(async () => {
      button(renderer, 'Next month').props.onPress()
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(texts(renderer)).toContain(monthName(0))
    expect(button(renderer, 'Next month').props.disabled).toBe(true)
  })

  it('explains an empty month with a reason and a Refresh, not "No data available."', async () => {
    const renderer = await renderScreen()
    const shown = texts(renderer)

    expect(shown).toContain('No attendance records')
    expect(shown).toContain(`Nothing has been posted for ${monthName(0)}.`)
    expect(shown).toContain('Refresh')
    expect(shown).not.toContain('No data available.')
  })

  it('shows the records when the portal returned some', async () => {
    gradesApi.getAttendance.mockResolvedValue({ absences: 2 })
    const shown = texts(await renderScreen())

    expect(shown).not.toContain('No attendance records')
    expect(shown).not.toContain('Refresh')
  })
})

// ---- Purpose-built layout ----

const DAYS_IN_GRID_ROW = 7

/** The first weekday (Mon to Fri) on or after `day`, as the e2e mock does. */
function weekdayOnOrAfter(year, monthIndex, day) {
  let current = day
  while ([0, 6].includes(new Date(year, monthIndex, current).getDay())) current += 1
  return current
}

function dayEntry(year, monthIndex, day, description, periods = []) {
  const date = new Date(year, monthIndex, day)
  const pad = (value) => String(value).padStart(2, '0')
  return {
    date: `${year}-${pad(monthIndex + 1)}-${pad(day)}`,
    dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
    dayNum: day,
    bgColor: description ? '#FBBF24' : '',
    description,
    isSchoolClosed: false,
    periods,
  }
}

// The same payload the e2e mock serves for the current month.
function stockMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const monthIndex = now.getMonth()
  const tardyDay = weekdayOnOrAfter(year, monthIndex, 4)
  const excusedDay = weekdayOnOrAfter(year, monthIndex, 9)
  const presentDay = weekdayOnOrAfter(year, monthIndex, 12)
  return {
    tardyDay,
    excusedDay,
    payload: {
      month: now.toLocaleDateString('en-US', { month: 'long' }),
      year,
      monthIndex,
      days: [
        dayEntry(year, monthIndex, tardyDay, 'Tardy', [{ period: '1', status: 'Tardy' }]),
        dayEntry(year, monthIndex, excusedDay, 'Excused absence', [
          { period: '1', status: 'Excused' },
          { period: '2', status: 'Excused' },
        ]),
        dayEntry(year, monthIndex, presentDay, 'Present'),
      ],
      summary: { absences: 0, excused: 1, tardies: 1, multiple: 0 },
    },
  }
}

function view(renderer, testID) {
  return renderer.root.findAll((n) => n.type === 'View' && n.props.testID === testID)[0]
}

function textsIn(node) {
  return node.findAllByType('Text').map((n) => n.props.children)
}

function markedCells(renderer) {
  return view(renderer, 'attendance-calendar').findAll(
    (n) => n.type === 'View' && typeof n.props.accessibilityLabel === 'string',
  )
}

/** The week rows of the calendar grid as day numbers, null for a blank cell. */
function gridWeeks(renderer) {
  // A grid row is a bare flex row of seven cells (the card and the legend have more style or other counts).
  const isRow = (n) => {
    const style = n.type === 'View' ? StyleSheet.flatten(n.props.style) : null
    return style !== null && Object.keys(style).length === 1 && style.flexDirection === 'row' && n.children.length === DAYS_IN_GRID_ROW
  }
  const rows = view(renderer, 'attendance-calendar').findAll(isRow)
  // The first row is the weekday header.
  return rows.slice(1).map((row) => row.children.map((cell) => cell.findAllByType('Text')[0]?.props.children ?? null))
}

function legendLabels(renderer) {
  return textsIn(view(renderer, 'attendance-calendar')).filter((t) => typeof t === 'string' && t.length > 1)
}

describe('AttendanceScreen layout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('summarises the month as Absences 0, Excused 1, Tardies 1', async () => {
    gradesApi.getAttendance.mockResolvedValue(stockMonth().payload)
    const renderer = await renderScreen()

    expect(textsIn(view(renderer, 'attendance-summary'))).toEqual(['0', 'Absences', '1', 'Excused', '1', 'Tardies'])
  })

  it('draws the whole month with a dot cell for each of the three marked days', async () => {
    const { payload, tardyDay, excusedDay } = stockMonth()
    gradesApi.getAttendance.mockResolvedValue(payload)
    const renderer = await renderScreen()

    const now = new Date()
    const weeks = gridWeeks(renderer)
    const monthLength = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    expect(weeks.flat().filter((day) => day !== null)).toHaveLength(monthLength)
    expect(weeks.every((week) => week.length === DAYS_IN_GRID_ROW)).toBe(true)

    const long = now.toLocaleDateString('en-US', { month: 'long' })
    const labels = markedCells(renderer).map((n) => n.props.accessibilityLabel)
    expect(labels).toHaveLength(3)
    expect(labels).toContain(`${long} ${tardyDay}, Tardy`)
    expect(labels).toContain(`${long} ${excusedDay}, Excused absence`)
  })

  it('colours a count only when it is above zero', async () => {
    gradesApi.getAttendance.mockResolvedValue(stockMonth().payload)
    const renderer = await renderScreen()
    const valueColor = (label) => {
      const cells = view(renderer, 'attendance-summary').findAllByType('Text')
      const value = cells[cells.findIndex((n) => n.props.children === label) - 1]
      return StyleSheet.flatten(value.props.style).color
    }

    expect(valueColor('Absences')).toBe(colors.text)
    expect(valueColor('Excused')).toBe(colors.accentLight)
    expect(valueColor('Tardies')).toBe(colors.warning)
  })

  it('colours the absences count red once there is one', async () => {
    gradesApi.getAttendance.mockResolvedValue({ days: [], summary: { absences: 2, excused: 0, tardies: 0 } })
    const cells = view(await renderScreen(), 'attendance-summary').findAllByType('Text')

    expect(StyleSheet.flatten(cells[0].props.style).color).toBe(colors.error)
    expect(StyleSheet.flatten(cells[2].props.style).color).toBe(colors.text)
  })

  it('lists a kind once in the legend however many days carry it', async () => {
    const now = new Date()
    gradesApi.getAttendance.mockResolvedValue({
      days: [
        dayEntry(now.getFullYear(), now.getMonth(), 2, 'Tardy', [{ period: '1', status: 'Tardy' }]),
        dayEntry(now.getFullYear(), now.getMonth(), 3, 'Tardy', [{ period: '2', status: 'Tardy' }]),
      ],
    })
    const renderer = await renderScreen()

    expect(legendLabels(renderer)).toEqual(['Tardy'])
    expect(markedCells(renderer)).toHaveLength(2)
  })

  it('lists in the legend only the kinds present, in the order the days appear', async () => {
    gradesApi.getAttendance.mockResolvedValue(stockMonth().payload)
    const renderer = await renderScreen()

    expect(legendLabels(renderer)).toEqual(['Tardy', 'Excused', 'Present'])
  })

  it('lists the tardy and the excused day with their periods under "This month", and not the present day', async () => {
    const { payload, tardyDay, excusedDay } = stockMonth()
    gradesApi.getAttendance.mockResolvedValue(payload)
    const renderer = await renderScreen()

    expect(texts(renderer)).toContain('This month')
    const rows = renderer.root.findAllByType(PortalRow)
    expect(rows).toHaveLength(2)
    expect(textsIn(rows[0]).slice(1)).toEqual([tardyDay, 'Tardy', 'Period 1'])
    expect(textsIn(rows[1]).slice(1)).toEqual([excusedDay, 'Excused absence', 'Periods 1, 2'])
  })

  it('shows none of the raw field names or values', async () => {
    gradesApi.getAttendance.mockResolvedValue(stockMonth().payload)
    const shown = texts(await renderScreen())

    for (const raw of ['MONTH INDEX', 'Month index', 'BG COLOR', 'Bg color', '#FBBF24', 'IS SCHOOL CLOSED', 'Is school closed', 'false']) {
      expect(shown).not.toContain(raw)
    }
    const squashed = shown.filter((t) => typeof t === 'string').map((t) => t.replace(/\s/g, '').toLowerCase())
    expect(squashed.some((t) => /monthindex|bgcolor|#fbbf24|isschoolclosed/.test(t))).toBe(false)
  })

  it('shows the calendar and a no-absences line when every day of a live HAC month is plain', async () => {
    const now = new Date()
    const days = Array.from({ length: 20 }, (_, index) => dayEntry(now.getFullYear(), now.getMonth(), index + 1, ''))
    gradesApi.getAttendance.mockResolvedValue({
      month: monthName(0),
      year: now.getFullYear(),
      monthIndex: now.getMonth(),
      days,
      summary: { absences: 0, excused: 0, tardies: 0, multiple: 0 },
    })
    const renderer = await renderScreen()
    const shown = texts(renderer)

    expect(view(renderer, 'attendance-calendar')).toBeTruthy()
    expect(markedCells(renderer)).toHaveLength(0)
    expect(legendLabels(renderer)).toEqual([])
    expect(shown).toContain('No absences or tardies this month.')
    expect(shown).not.toContain('No attendance records')
  })

  it('names a school-closed day in the details and the legend', async () => {
    const now = new Date()
    gradesApi.getAttendance.mockResolvedValue({
      days: [
        {
          ...dayEntry(now.getFullYear(), now.getMonth(), 2, 'School Closed', [{ period: 'all', status: 'School Closed' }]),
          isSchoolClosed: true,
        },
      ],
    })
    const renderer = await renderScreen()

    expect(legendLabels(renderer)).toEqual(['School closed'])
    expect(textsIn(renderer.root.findAllByType(PortalRow)[0]).slice(1)).toEqual([2, 'School Closed', 'All day'])
  })

  it('shows the empty state when the portal sent a month with no days and no summary', async () => {
    gradesApi.getAttendance.mockResolvedValue({ month: 'November', days: [] })
    const shown = texts(await renderScreen())

    expect(shown).toContain('No attendance records')
    expect(shown).toContain(`Nothing has been posted for ${monthName(0)}.`)
  })

  it('falls back to the generic view for a payload that is not attendance', async () => {
    gradesApi.getAttendance.mockResolvedValue({ note: 'Attendance is kept on paper' })
    const renderer = await renderScreen()

    expect(texts(renderer)).toContain('Attendance is kept on paper')
    expect(renderer.root.findAll((n) => n.type === 'View' && n.props.testID === 'attendance-calendar')).toHaveLength(0)
  })

  describe('stepping between months', () => {
    beforeEach(() => {
      // Only Date is faked, so promises and timers behave normally.
      jest.useFakeTimers({
        now: new Date(2026, 4, 15),
        doNotFake: [
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'setImmediate',
          'clearImmediate',
          'nextTick',
          'queueMicrotask',
          'performance',
          'requestAnimationFrame',
          'cancelAnimationFrame',
          'requestIdleCallback',
          'cancelIdleCallback',
          'hrtime',
        ],
      })
      gradesApi.getAttendance.mockResolvedValue({ days: [], summary: { absences: 0, excused: 0, tardies: 0, multiple: 0 } })
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    async function stepBack(renderer) {
      await act(async () => {
        button(renderer, 'Previous month').props.onPress()
      })
      await act(async () => {
        await Promise.resolve()
      })
    }

    const blank = Array.from({ length: 5 }, () => null)

    it('redraws the grid for each month: weekday of the 1st and length', async () => {
      const renderer = await renderScreen()

      // May 2026: a Friday start, 31 days over six weeks.
      expect(texts(renderer)).toContain('May 2026')
      let weeks = gridWeeks(renderer)
      expect(weeks).toHaveLength(6)
      expect(weeks[0]).toEqual([...blank, 1, 2])
      expect(weeks[5]).toEqual([31, null, null, null, null, null, null])

      // April 2026: a Wednesday start, 30 days.
      await stepBack(renderer)
      expect(texts(renderer)).toContain('April 2026')
      weeks = gridWeeks(renderer)
      expect(weeks[0]).toEqual([null, null, null, 1, 2, 3, 4])
      expect(weeks.flat().filter((day) => day !== null)).toHaveLength(30)

      // March 2026: starts on a Sunday, 31 days.
      await stepBack(renderer)
      weeks = gridWeeks(renderer)
      expect(weeks[0]).toEqual([1, 2, 3, 4, 5, 6, 7])
      expect(weeks[4]).toEqual([29, 30, 31, null, null, null, null])

      // February 2026: starts on a Sunday and fits four weeks exactly.
      await stepBack(renderer)
      expect(texts(renderer)).toContain('February 2026')
      weeks = gridWeeks(renderer)
      expect(weeks).toHaveLength(4)
      expect(weeks[3]).toEqual([22, 23, 24, 25, 26, 27, 28])
    })

    it('rings today only on the current month', async () => {
      const renderer = await renderScreen()
      const ringed = () =>
        view(renderer, 'attendance-calendar').findAll(
          (n) => n.type === 'View' && StyleSheet.flatten(n.props.style)?.borderColor === 'rgba(41,121,255,0.35)',
        )

      expect(ringed()).toHaveLength(1)
      expect(textsIn(ringed()[0])).toEqual([15])
      await stepBack(renderer)
      expect(ringed()).toHaveLength(0)
    })

    it('does not draw another month on the month it asked for when the portal answers with a different one', async () => {
      gradesApi.getAttendance.mockResolvedValue({
        month: 'March',
        year: 2026,
        monthIndex: 2,
        days: [{ date: '2026-03-04', dayNum: 4, description: 'Tardy', periods: [{ period: '1', status: 'Tardy' }] }],
      })
      const renderer = await renderScreen()

      // The screen is on May 2026 and the portal sent March: no May calendar, and no March day drawn in May.
      expect(view(renderer, 'attendance-calendar')).toBeUndefined()
      expect(renderer.root.findAll((n) => n.props.accessibilityLabel === 'May 4, Tardy')).toHaveLength(0)
      expect(texts(renderer)).not.toContain('No absences or tardies this month.')
    })
  })
})
