import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { describe, expect, it, jest } from '@jest/globals'

import { SegmentedControl } from '../SegmentedControl'

function render(element) {
  let renderer
  act(() => {
    renderer = TestRenderer.create(element)
  })
  return renderer
}

// The Pressable elements the control renders, one per segment.
function segmentPressables(renderer) {
  return renderer.root.findAll(
    (node) => typeof node.type !== 'string' && (node.type.displayName || node.type.name) === 'Pressable',
  )
}

describe('SegmentedControl', () => {
  it('sets aria-selected on every segment, so web assistive tech can read the selection', () => {
    const renderer = render(
      <SegmentedControl segments={['Unweighted', 'Weighted']} value="Weighted" onChange={() => undefined} />,
    )
    const segments = segmentPressables(renderer)
    expect(segments).toHaveLength(2)
    expect(segments.map((node) => node.props['aria-selected'])).toEqual([false, true])
  })

  it('keeps accessibilityState.selected in sync with aria-selected', () => {
    const renderer = render(
      <SegmentedControl segments={['A', 'B', 'C']} value="C" onChange={() => undefined} />,
    )
    const segments = segmentPressables(renderer)
    expect(segments.map((node) => node.props.accessibilityState.selected)).toEqual([false, false, true])
    expect(segments.map((node) => node.props['aria-selected'])).toEqual([false, false, true])
  })

  it('calls onChange with the pressed segment', () => {
    const onChange = jest.fn()
    const renderer = render(<SegmentedControl segments={['A', 'B']} value="A" onChange={onChange} />)
    act(() => {
      segmentPressables(renderer)[1].props.onPress()
    })
    expect(onChange).toHaveBeenCalledWith('B')
  })
})
