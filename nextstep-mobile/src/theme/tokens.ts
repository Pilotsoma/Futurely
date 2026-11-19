// Dark theme only — app.json hardcodes "userInterfaceStyle": "dark",
// so a light theme driven by useColorScheme would never activate. Plain constants,
// no provider/context needed.

import { Platform, type ViewStyle } from 'react-native'

// Palette updated to match the web app's dark theme (app/globals.css).
export const colors = {
  primary: '#2979FF',
  primaryDark: '#1B4DB0',
  primaryDim: 'rgba(41,121,255,0.14)',
  primaryGlow: 'rgba(41,121,255,0.35)',
  accent2: '#00E5FF',
  accentLight: '#7FB0FF',
  // Navy-black page base: cards and tiles keep their navy surfaces, so they lift off it.
  bg: '#070C16',
  surface: '#162235',
  surface2: '#1C2D47',
  border: '#273D5E',
  borderHover: '#2F4970',
  text: '#E8EEFF',
  textSecondary: '#96AACC',
  // Cool gray, 4.65:1 on surface2 (the lightest surface) and 6.57:1 on bg.
  textMuted: '#8A96AD',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  orange: '#F97316',
  info: '#00E5FF',
  purple: '#7C3AED',
  // Custom violet touches (chips, one glow). Not the Tailwind violet; never used in a gradient.
  violet: '#7A5CFF',
  violetDim: 'rgba(122, 92, 255, 0.16)',
  violetText: '#B3A1FF',                          // 6.33:1 on the violetDim chip
  buttonSecondaryBorder: 'rgba(255, 255, 255, 0.1)',
  // v2 Layered Glass additions
  surface1: '#131E30',                            // elevated panel (between bg and surface)
  cardHighlight: 'rgba(255, 255, 255, 0.055)',   // top-edge highlight simulating a light source
  borderSubtle: 'rgba(154, 167, 192, 0.18)',     // quiet cool-gray hairline; navy-on-navy vanished
  accentCyan: '#00E5FF',                          // alias for accent2 (clarity)
} as const

// Diagonal fills used by hero/gradient cards and quick-action icon tiles —
// pass to react-native-svg's <LinearGradient> (no expo-linear-gradient dependency).
// Card.tsx accepts readonly [string, string] so accent gradient uses 2 stops.
export const gradients = {
  hero: ['#1B4DB0', colors.bg] as const,
  accent: ['#2979FF', '#7C3AED'] as const,
} as const

export const gradeColors = {
  A: colors.success,
  B: '#2979FF',
  C: colors.warning,
  D: colors.orange,
  F: colors.error,
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  ms: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
  massive: 64,
  cardPadding: 16,
  screenPadding: 20,
  sectionGap: 24,
} as const

// Progressive scale matching what the web app actually ships (app/globals.css,
// app/login/page.tsx inline styles) — DESIGN_SYSTEM.md's flatter 8/12 scale was
// stale relative to the real brand.
export const radii = {
  xs: 8,
  sm: 10,
  md: 18,
  lg: 20,
  xl: 24,
  xxl: 28,  // large hero panels (roadmap card)
} as const

function makeShadow(opacity: number, radius: number, elevationValue: number, offsetY: number): ViewStyle {
  return Platform.select<ViewStyle>({
    android: { elevation: elevationValue },
    default: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
  }) as ViewStyle
}

// Mirrors web's --shadow-sm/--shadow-md (app/globals.css), tuned for RN's
// shadow props (dark-theme opacities carried over from the dark `html[data-theme="dark"]` block).
export const elevation = {
  sm: makeShadow(0.22, 6, 3, 1),
  md: makeShadow(0.34, 12, 6, 3),
} as const

// Font family names — Inter (body/captions) plus Plus Jakarta Sans (headings/labels, and
// in ExtraBold with tabular figures, numeric data). All registered via useFonts in App.tsx.
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  jakartaSemiBold: 'PlusJakartaSans_600SemiBold',
  jakartaBold: 'PlusJakartaSans_700Bold',
  jakartaExtraBold: 'PlusJakartaSans_800ExtraBold',
} as const

export const typography = {
  display: { fontSize: 32, fontFamily: fonts.jakartaBold, fontWeight: '700' as const },
  h1: { fontSize: 24, fontFamily: fonts.jakartaBold, fontWeight: '700' as const },
  h2: { fontSize: 20, fontFamily: fonts.jakartaSemiBold, fontWeight: '600' as const },
  h3: { fontSize: 16, fontFamily: fonts.jakartaBold, fontWeight: '700' as const },
  body: { fontSize: 15, fontFamily: fonts.regular, fontWeight: '400' as const, lineHeight: 15 * 1.6 },
  caption: { fontSize: 12, fontFamily: fonts.regular, fontWeight: '400' as const },
  // Sentence-case field and section label: no caps, no tracking.
  label: {
    fontSize: 12,
    fontFamily: fonts.jakartaSemiBold,
    fontWeight: '600' as const,
  },
  title: { fontSize: 24, fontFamily: fonts.jakartaExtraBold, fontWeight: '800' as const, letterSpacing: -0.4 },
  numeric: { fontFamily: fonts.jakartaExtraBold, fontWeight: '800' as const, letterSpacing: -0.6, fontVariant: ['tabular-nums'] as ['tabular-nums'] },
  // v2 Layered Glass numeric scale
  numericHero: {
    fontFamily: fonts.jakartaExtraBold,
    fontWeight: '800' as const,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1.8,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  numericLg: {
    fontFamily: fonts.jakartaExtraBold,
    fontWeight: '800' as const,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  numericMd: {
    fontFamily: fonts.jakartaExtraBold,
    fontWeight: '800' as const,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.9,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  numericSm: {
    fontFamily: fonts.jakartaExtraBold,
    fontWeight: '800' as const,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  // v2 section / body text scale
  sectionLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    fontWeight: '600' as const,
  },
  bodyMd: {
    fontSize: 13,
    fontFamily: fonts.regular,
    fontWeight: '400' as const,
    lineHeight: 19,
  },
  bodySm: {
    fontSize: 12,
    fontFamily: fonts.regular,
    fontWeight: '400' as const,
    lineHeight: 17,
  },
  // Small sentence-case label (was an uppercase tracked eyebrow): no caps, no tracking.
  eyebrow: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    fontWeight: '600' as const,
  },
} as const

export const touchTarget = 44

// Mirrors web's --dur-fast/base/slow and --ease-spring/out-expo (app/globals.css).
// Reanimated's `Easing` uses bezier control points, not CSS cubic-bezier strings,
// so these are duration/spring-config pairs rather than literal easing curves.
export const animation = {
  navTransitionMs: 250,
  microInteractionMs: 150,
  durFast: 120,
  durBase: 220,
  durSlow: 380,
  spring: { damping: 14, stiffness: 180, mass: 0.9 },
} as const
