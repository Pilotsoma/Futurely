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
  bg: '#0D1829',
  surface: '#162235',
  surface2: '#1C2D47',
  border: '#273D5E',
  borderHover: '#2F4970',
  text: '#E8EEFF',
  textSecondary: '#96AACC',
  textMuted: '#52698A',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  orange: '#F97316',
  info: '#00E5FF',
  purple: '#7C3AED',
  buttonSecondaryBorder: 'rgba(255, 255, 255, 0.1)',
} as const

// Diagonal fills used by hero/gradient cards and quick-action icon tiles —
// pass to react-native-svg's <LinearGradient> (no expo-linear-gradient dependency).
// Card.tsx accepts readonly [string, string] so accent gradient uses 2 stops.
export const gradients = {
  hero: ['#1B4DB0', '#0D1829'] as const,
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

// Font family names — Inter (body/captions) plus Plus Jakarta Sans (headings/labels)
// and Space Grotesk (numeric data). All registered via useFonts in App.tsx.
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  jakartaSemiBold: 'PlusJakartaSans_600SemiBold',
  jakartaBold: 'PlusJakartaSans_700Bold',
  jakartaExtraBold: 'PlusJakartaSans_800ExtraBold',
  groteskBold: 'SpaceGrotesk_700Bold',
} as const

export const typography = {
  display: { fontSize: 32, fontFamily: fonts.jakartaBold, fontWeight: '700' as const },
  h1: { fontSize: 24, fontFamily: fonts.jakartaBold, fontWeight: '700' as const },
  h2: { fontSize: 20, fontFamily: fonts.jakartaSemiBold, fontWeight: '600' as const },
  h3: { fontSize: 16, fontFamily: fonts.jakartaBold, fontWeight: '700' as const },
  body: { fontSize: 15, fontFamily: fonts.regular, fontWeight: '400' as const, lineHeight: 15 * 1.6 },
  caption: { fontSize: 12, fontFamily: fonts.regular, fontWeight: '400' as const },
  label: {
    fontSize: 11,
    fontFamily: fonts.jakartaBold,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.9,
  },
  title: { fontSize: 24, fontFamily: fonts.jakartaExtraBold, fontWeight: '800' as const, letterSpacing: -0.4 },
  numeric: { fontFamily: fonts.groteskBold, fontWeight: '700' as const, letterSpacing: -0.5 },
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
