import type { ViewStyle } from 'react-native'

/**
 * Neomorphic shadow presets for React Native.
 *
 * React Native does not support CSS-style dual box-shadows. `raised` uses
 * the platform shadow API (iOS: shadowColor/offset/opacity/radius;
 * Android: elevation) to produce a convex/lifted surface feel.
 *
 * `insetBorderStyle` simulates a concave/pressed surface via directional
 * border color contrast (top-left lighter rim, bottom-right darker). Pair
 * it with a background one stop darker than the surrounding surface
 * (i.e. `colors.background` inside a `colors.surface` container).
 *
 * All values are tuned for the dark base palette:
 *   background: #0D1829   surface: #162235   border: #273D5E
 */

export const shadows = {
  /**
   * Convex (raised) — cards, primary/ghost buttons, tab bar, nav container.
   * The heavy drop shadow reads as a surface floating above the page.
   */
  raised: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 2, height: 4 },
    shadowOpacity: 0.48,
    shadowRadius:  10,
    elevation:     8,
  } as ViewStyle,

  /**
   * Concave (pressed/inset) simulation — for input fields.
   * Use alongside a dark fill (`colors.background`) inside a surface container.
   * The top and left border edges are tinted lighter to simulate rim-light;
   * the bottom and right edges are darker to suggest depth.
   */
  insetBorderStyle: {
    borderTopColor:    '#1E3050',
    borderLeftColor:   '#1E3050',
    borderBottomColor: '#0A1018',
    borderRightColor:  '#0A1018',
    borderWidth:        1,
  } as ViewStyle,
} as const
