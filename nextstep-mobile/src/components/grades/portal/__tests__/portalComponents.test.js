import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import TestRenderer, { act } from 'react-test-renderer'
import { describe, expect, it, jest } from '@jest/globals'

import {
  GradeChip,
  PeriodTile,
  Pill,
  PortalCard,
  PortalFallback,
  PortalRow,
  StatStrip,
} from '../index'
import { colors, radii, spacing } from '../../../../theme/tokens'

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}))
// RawDataView's empty state uses Button, which animates with reanimated (no native worklets under jest).
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
jest.mock('../../../../preferences/displayPreferences', () => ({
  useDisplayPreferences: () => ({
    hideGpa: false,
    gradeColors: { A: '#22C55E', B: '#10B981', C: '#F59E0B', D: '#F97316', F: '#EF4444' },
  }),
}))

function render(element) {
  let renderer
  act(() => {
    renderer = TestRenderer.create(element)
  })
  return renderer
}

function texts(renderer) {
  return renderer.root.findAllByType(Text).map((node) => node.props.children)
}

// findByProps returns the outermost match (the component, not its host View), so look for the host node.
function host(renderer, type, testID) {
  return renderer.root.findAll((node) => node.type === type && node.props.testID === testID)[0]
}

function styleOf(node) {
  return StyleSheet.flatten(node.props.style)
}

describe('PortalCard', () => {
  it('renders the layered glass panel with a titled header and right-aligned meta', () => {
    const renderer = render(
      <PortalCard title="Current grades" meta="As of Nov 6" testID="card">
        <Text>body</Text>
      </PortalCard>,
    )
    const card = host(renderer, 'View', 'card')
    expect(styleOf(card)).toMatchObject({
      backgroundColor: colors.surface1,
      borderRadius: radii.xxl,
      borderTopWidth: 1,
      borderTopColor: colors.cardHighlight,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    })
    expect(styleOf(card).borderWidth).toBeUndefined()
    expect(texts(renderer)).toEqual(['Current grades', 'As of Nov 6', 'body'])
  })

  it('has no header without a title, even when meta is passed', () => {
    const renderer = render(
      <PortalCard meta="ignored">
        <Text>only body</Text>
      </PortalCard>,
    )
    expect(texts(renderer)).toEqual(['only body'])
  })

  it('omits the meta text when it is not given', () => {
    const renderer = render(
      <PortalCard title="Courses">
        <Text>x</Text>
      </PortalCard>,
    )
    expect(texts(renderer)).toEqual(['Courses', 'x'])
  })
})

describe('PortalRow', () => {
  it('shows title, subtitle and caption, leading and trailing content', () => {
    const renderer = render(
      <PortalRow
        testID="row"
        leading={<Text>L</Text>}
        title="AP Biology"
        subtitle="Dr. Rivera · Period 1"
        caption="1st 92 · 2nd 90"
        trailing={<Text>T</Text>}
      />,
    )
    expect(texts(renderer)).toEqual(['L', 'AP Biology', 'Dr. Rivera · Period 1', '1st 92 · 2nd 90', 'T'])
  })

  it('is one accessibility element with no custom label and a 56pt minimum height', () => {
    const row = host(render(<PortalRow testID="row" title="x" />), 'View', 'row')
    expect(row.props.accessible).toBe(true)
    expect(row.props.accessibilityLabel).toBeUndefined()
    expect(styleOf(row).minHeight).toBe(56)
  })

  it('draws a hairline divider unless it is the last row', () => {
    const middle = host(render(<PortalRow testID="row" title="x" />), 'View', 'row')
    const last = host(render(<PortalRow testID="row" title="x" isLast />), 'View', 'row')
    expect(styleOf(middle).borderBottomWidth).toBe(StyleSheet.hairlineWidth)
    expect(styleOf(middle).borderBottomColor).toBe(colors.borderSubtle)
    expect(styleOf(last).borderBottomWidth).toBeUndefined()
  })

  it('limits the title to two lines and the subtitle to one', () => {
    const renderer = render(<PortalRow title="Long title" subtitle="Sub" caption="Caption" />)
    const [title, subtitle, caption] = renderer.root.findAllByType(Text)
    expect(title.props.numberOfLines).toBe(2)
    expect(subtitle.props.numberOfLines).toBe(1)
    expect(caption.props.numberOfLines).toBeUndefined()
  })

  it('renders extra children under the text and skips an absent trailing slot', () => {
    const renderer = render(
      <PortalRow title="Course">
        <Text>pills</Text>
      </PortalRow>,
    )
    expect(texts(renderer)).toEqual(['Course', 'pills'])
  })
})

describe('GradeChip', () => {
  it('prints the label, colours it by base letter and names itself "Grade A-"', () => {
    const renderer = render(<GradeChip grade={{ label: 'A-', letter: 'A', percent: null }} />)
    const chip = renderer.root.findByProps({ accessibilityLabel: 'Grade A-' })
    expect(texts(renderer)).toEqual(['A-'])
    expect(styleOf(chip)).toMatchObject({ borderColor: '#22C55E66', backgroundColor: '#22C55E18', borderRadius: 8 })
    expect(styleOf(renderer.root.findByType(Text)).color).toBe('#22C55E')
  })

  it('is at least 28pt square and grows to 32pt for the md size', () => {
    const sm = render(<GradeChip grade={{ label: 'B', letter: 'B', percent: null }} />).root.findByProps({
      accessibilityLabel: 'Grade B',
    })
    const md = render(<GradeChip size="md" grade={{ label: 'B', letter: 'B', percent: null }} />).root.findByProps({
      accessibilityLabel: 'Grade B',
    })
    expect(styleOf(sm)).toMatchObject({ minWidth: 28, height: 28 })
    expect(styleOf(md)).toMatchObject({ minWidth: 32, height: 32 })
  })

  it('stays neutral for a label with no base letter', () => {
    const renderer = render(<GradeChip grade={{ label: 'P', letter: null, percent: null }} />)
    expect(styleOf(renderer.root.findByType(Text)).color).toBe(colors.textSecondary)
  })

  it('renders nothing when there is no label', () => {
    const renderer = render(<GradeChip grade={{ label: null, letter: null, percent: '90' }} />)
    expect(renderer.toJSON()).toBeNull()
  })
})

describe('Pill', () => {
  it('is a 24pt pill with a neutral fill by default', () => {
    const renderer = render(<Pill label="94/100" />)
    const pill = renderer.root.findAllByType(View)[0]
    expect(styleOf(pill)).toMatchObject({ height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' })
    const text = styleOf(renderer.root.findByType(Text))
    expect(text.color).toBe(colors.textSecondary)
    expect(text.fontVariant).toEqual(['tabular-nums'])
    expect(text.fontSize).toBeGreaterThanOrEqual(11)
  })

  it.each([
    ['success', colors.success],
    ['warning', colors.warning],
    ['error', colors.error],
    ['info', colors.accentLight],
  ])('tints the %s tone at 14%% with matching text', (tone, color) => {
    const renderer = render(<Pill label="x" tone={tone} />)
    expect(styleOf(renderer.root.findAllByType(View)[0]).backgroundColor).toBe(`${color}24`)
    expect(styleOf(renderer.root.findByType(Text)).color).toBe(color)
  })
})

describe('StatStrip', () => {
  const items = [
    { value: '3.875', label: 'Unweighted', testID: 'unweighted' },
    { value: '4.125', label: 'Weighted' },
    { value: '58/412', label: 'Class rank', color: colors.accentLight },
  ]

  it('shows every value over its label and puts a divider between cells only', () => {
    const renderer = render(<StatStrip items={items} testID="strip" />)
    expect(texts(renderer)).toEqual(['3.875', 'Unweighted', '4.125', 'Weighted', '58/412', 'Class rank'])
    const dividers = renderer.root
      .findAllByType(View)
      .filter((node) => styleOf(node)?.width === 1 && styleOf(node)?.height === 32)
    expect(dividers).toHaveLength(2)
    expect(host(renderer, 'View', 'strip')).toBeTruthy()
    expect(host(renderer, 'Text', 'unweighted').props.children).toBe('3.875')
  })

  it('has no divider for a single item and applies the item colour', () => {
    const renderer = render(<StatStrip items={[items[2]]} />)
    const dividers = renderer.root.findAllByType(View).filter((node) => styleOf(node)?.width === 1)
    expect(dividers).toHaveLength(0)
    const value = renderer.root.findAllByType(Text)[0]
    expect(styleOf(value).color).toBe(colors.accentLight)
  })
})

describe('PeriodTile', () => {
  it('is a 36pt tile named "Period 2A"', () => {
    const renderer = render(<PeriodTile label="2A" />)
    const tile = renderer.root.findByProps({ accessibilityLabel: 'Period 2A' })
    expect(styleOf(tile)).toMatchObject({ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primaryDim })
    expect(texts(renderer)).toEqual(['2A'])
    expect(styleOf(renderer.root.findByType(Text))).toMatchObject({ fontSize: 15, color: colors.accentLight })
  })

  it('truncates the printed text to 3 characters but keeps the full name for screen readers', () => {
    const renderer = render(<PeriodTile label="Flex1" />)
    expect(texts(renderer)).toEqual(['Fle'])
    expect(renderer.root.findByProps({ accessibilityLabel: 'Period Flex1' })).toBeTruthy()
  })
})

describe('PortalFallback', () => {
  it('shows the generic key/value view of the data', () => {
    const renderer = render(<PortalFallback data={{ foo: 'bar' }} />)
    expect(texts(renderer)).toEqual(['Foo', 'bar'])
  })
})
