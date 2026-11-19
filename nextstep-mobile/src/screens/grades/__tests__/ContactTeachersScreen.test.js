import React from 'react'
import { Alert, Linking, StyleSheet, Text } from 'react-native'
import TestRenderer, { act } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

import ContactTeachersScreen from '../ContactTeachersScreen'
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
  getContactTeachers: jest.fn(),
}))
jest.mock('../../../utils/storage', () => ({
  clearTokens: jest.fn(),
  loadTokens: jest.fn(),
  storeTokens: jest.fn(),
}))
// The portal component barrel pulls in GradeChip, whose preferences hook needs native storage.
jest.mock('../../../preferences/displayPreferences', () => ({
  useDisplayPreferences: () => ({ hideGpa: false, gradeColors: {} }),
}))

jest.setTimeout(30000)

// The e2e fixture shape.
const people = [
  ['Dr. Rivera', 'rivera', 'Rm 214', 'AP Biology', '1'],
  ['Ms. Brooks', 'brooks', 'Rm 108', 'English III', '2'],
  ['Mr. Williams', 'williams', 'Rm 121', 'AP U.S. History', '3'],
  ['Mrs. Patel', 'patel', 'Rm 302', 'Pre-Calculus', '4'],
  ['Sra. Martinez', 'martinez', 'Rm 117', 'Spanish III', '5'],
  ['Coach Davis', 'davis', 'Gym', 'Physical Education', '6'],
]
const fixture = {
  teachers: people.map(([name, handle, room, courseName, period]) => ({
    name,
    email: `${handle}@school.example.test`,
    room,
    building: 'Main Building',
    courses: [{ courseName, period }],
  })),
}

async function renderScreen() {
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(<ContactTeachersScreen />)
  })
  await act(async () => {
    await Promise.resolve()
  })
  return renderer
}

function texts(renderer) {
  return renderer.root.findAllByType(Text).map((node) => node.props.children)
}

function emailRow(renderer, index) {
  return renderer.root.findAll((n) => typeof n.props.onPress === 'function' && n.props.testID === `teacher-email-${index}`)[0]
}

describe('ContactTeachersScreen', () => {
  let openURL
  let alertSpy

  beforeEach(() => {
    jest.clearAllMocks()
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  })

  afterEach(() => {
    openURL.mockRestore()
    alertSpy.mockRestore()
  })

  it('shows one card per teacher with courses, place and a tappable email', async () => {
    gradesApi.getContactTeachers.mockResolvedValue(fixture)
    const renderer = await renderScreen()

    for (const [index, [name, handle, room, courseName, period]] of people.entries()) {
      const card = renderer.root.findAll((n) => n.type === 'View' && n.props.testID === `teacher-card-${index}`)[0]
      expect(card).toBeTruthy()
      const inside = card.findAllByType(Text).map((node) => node.props.children)
      expect(inside).toEqual([
        name.split(' ').pop().charAt(0),
        name,
        `${courseName} · Period ${period}`,
        `${room} · Main Building`,
        `${handle}@school.example.test`,
      ])
    }
    expect(renderer.root.findAllByType(PortalFallback)).toHaveLength(0)
  })

  it('names each email row by its visible address and keeps it at least 44pt tall', async () => {
    gradesApi.getContactTeachers.mockResolvedValue(fixture)
    const renderer = await renderScreen()

    for (const [index, [, handle]] of people.entries()) {
      const row = emailRow(renderer, index)
      expect(row.props.accessibilityLabel).toBeUndefined()
      expect(row.props.accessibilityRole).toBe('link')
      expect(row.props.accessibilityHint).toBe('Opens your email app')
      const style = StyleSheet.flatten(row.props.style({ pressed: false }))
      expect(style.minHeight).toBeGreaterThanOrEqual(44)
      expect(row.findAllByType(Text).map((node) => node.props.children)).toEqual([`${handle}@school.example.test`])
      expect(StyleSheet.flatten(row.props.style({ pressed: true })).opacity).toBe(0.75)
    }
  })

  it('hides the icon glyphs from the accessibility tree so the link name is just the address', async () => {
    gradesApi.getContactTeachers.mockResolvedValue(fixture)
    const renderer = await renderScreen()

    const hidden = emailRow(renderer, 0).findAll((n) => n.type === 'View' && n.props['aria-hidden'] === true)
    expect(hidden).toHaveLength(2)
  })

  it('opens a mailto link with only the address when the email row is pressed', async () => {
    gradesApi.getContactTeachers.mockResolvedValue(fixture)
    const renderer = await renderScreen()

    await act(async () => {
      emailRow(renderer, 1).props.onPress()
    })

    expect(openURL).toHaveBeenCalledTimes(1)
    expect(openURL).toHaveBeenCalledWith('mailto:brooks@school.example.test')
    expect(alertSpy).not.toHaveBeenCalled()
  })

  it('explains when no email app can open the link', async () => {
    openURL.mockRejectedValue(new Error('no handler'))
    gradesApi.getContactTeachers.mockResolvedValue(fixture)
    const renderer = await renderScreen()

    await act(async () => {
      emailRow(renderer, 0).props.onPress()
    })

    expect(alertSpy).toHaveBeenCalledTimes(1)
    expect(alertSpy).toHaveBeenCalledWith(
      'No email app found',
      'Set up an email app on this device to contact your teacher.',
    )
  })

  it('shows no email row for a teacher without a valid address', async () => {
    gradesApi.getContactTeachers.mockResolvedValue({
      teachers: [
        { name: 'Ms. Okafor', email: 'not-an-address', courses: [{ courseName: 'Chemistry', period: '2' }] },
        { name: 'Mr. Lee', email: 'lee@school.example.test' },
      ],
    })
    const renderer = await renderScreen()

    expect(emailRow(renderer, 0)).toBeUndefined()
    expect(emailRow(renderer, 1)).toBeTruthy()
    expect(texts(renderer)).not.toContain('not-an-address')
  })

  it('shows the name but no tappable email row when the address would add a hidden recipient', async () => {
    gradesApi.getContactTeachers.mockResolvedValue({
      teachers: [
        { name: 'Ms. Rao', email: 'ms.r@school.org,attacker%40evil.com' },
        { name: 'Mr. Kim', email: 'a@b.com%0D%0ABcc:x%40y.com' },
      ],
    })
    const renderer = await renderScreen()

    expect(texts(renderer)).toContain('Ms. Rao')
    expect(texts(renderer)).toContain('Mr. Kim')
    expect(emailRow(renderer, 0)).toBeUndefined()
    expect(emailRow(renderer, 1)).toBeUndefined()
    expect(texts(renderer).some((t) => typeof t === 'string' && t.includes('evil.com'))).toBe(false)
    expect(openURL).not.toHaveBeenCalled()
  })

  it('renders the generic fallback when the payload is not a recognised list of teachers', async () => {
    gradesApi.getContactTeachers.mockResolvedValue({ office: 'Room 12', hours: '8 to 4' })
    const renderer = await renderScreen()

    expect(renderer.root.findAllByType(PortalFallback)).toHaveLength(1)
    expect(texts(renderer)).toContain('Room 12')
  })

  it('renders the empty state for an empty payload', async () => {
    gradesApi.getContactTeachers.mockResolvedValue({})
    const shown = texts(await renderScreen())

    expect(shown).toContain('No teacher contacts')
    expect(shown).toContain("Your portal didn't list contact details for your teachers.")
  })

  it('renders the empty state, not a raw dump, for an empty list that carries other fields', async () => {
    gradesApi.getContactTeachers.mockResolvedValue({ teachers: [], school: 'North High' })
    const renderer = await renderScreen()

    expect(texts(renderer)).toContain('No teacher contacts')
    expect(renderer.root.findAllByType(PortalFallback)).toHaveLength(0)
  })
})
