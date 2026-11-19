import {
  AI_FAB_HIDDEN_ROUTES,
  FAB_CONTENT_MARGIN,
  FAB_GAP,
  FAB_SIZE,
  FLOATING_TAB_CLEARANCE,
  SCROLL_BOTTOM_CLEARANCE,
  TAB_BAR_HEIGHT,
  TAB_BAR_LIFT,
  TAB_BAR_MIN_INSET,
} from '../tabBarConstants'

// Largest bottom safe-area inset on a shipping iPhone (Face ID models).
const MAX_BOTTOM_INSET = 34

describe('tab bar and FAB geometry', () => {
  it('keeps the plan values other packages depend on', () => {
    expect(TAB_BAR_HEIGHT).toBe(64)
    expect(TAB_BAR_LIFT).toBe(8)
    expect(TAB_BAR_MIN_INSET).toBe(12)
    expect(FAB_SIZE).toBe(52)
    expect(FAB_GAP).toBe(12)
    expect(FLOATING_TAB_CLEARANCE).toBe(112)
    expect(SCROLL_BOTTOM_CLEARANCE).toBe(196)
  })

  it('FLOATING_TAB_CLEARANCE clears the tab bar on the tallest inset', () => {
    const tabBarTop = MAX_BOTTOM_INSET + TAB_BAR_LIFT + TAB_BAR_HEIGHT
    expect(FLOATING_TAB_CLEARANCE).toBeGreaterThanOrEqual(tabBarTop)
  })

  it('SCROLL_BOTTOM_CLEARANCE clears the tab bar and the FAB on the tallest inset', () => {
    const fabTop = MAX_BOTTOM_INSET + TAB_BAR_LIFT + TAB_BAR_HEIGHT + FAB_GAP + FAB_SIZE
    expect(SCROLL_BOTTOM_CLEARANCE).toBeGreaterThanOrEqual(fabTop)
  })

  it('SCROLL_BOTTOM_CLEARANCE leaves at least 16 points of air above the FAB on the tallest inset', () => {
    const fabTop = MAX_BOTTOM_INSET + TAB_BAR_LIFT + TAB_BAR_HEIGHT + FAB_GAP + FAB_SIZE
    expect(FAB_CONTENT_MARGIN).toBeGreaterThanOrEqual(16)
    expect(SCROLL_BOTTOM_CLEARANCE - fabTop).toBeGreaterThanOrEqual(16)
  })

  it('hides the FAB exactly on AI Chat, Dashboard and Settings', () => {
    expect([...AI_FAB_HIDDEN_ROUTES].sort()).toEqual(['AIChat', 'Dashboard', 'Settings'])
  })
})
