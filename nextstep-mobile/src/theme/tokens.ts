// Dark theme only — app.json hardcodes "userInterfaceStyle": "dark",
// so a light theme driven by useColorScheme would never activate. Plain constants,
// no provider/context needed.

import { Platform, type ViewStyle } from 'react-native'

// ---------------------------------------------------------------------------
// Color palette — electric blue / teal brand, Futurely v2 design system
// ---------------------------------------------------------------------------

export const colors = {
  // ── Core surface tokens ──────────────────────────────────────────────────
  bg:           '#0A0E1C',
  cardFill:     'rgba(255, 255, 255, 0.05)',
  cardBorder:   'rgba(255, 255, 255, 0.09)',
  cardFallback: '#131A32',  // solid fallback where blur isn't available
  divider:      'rgba(255, 255, 255, 0.07)',

  // ── Text ─────────────────────────────────────────────────────────────────
  text:      '#F3F5FA',
  textDim:   '#8991AE',
  textFaint: '#5A6280',

  // ── Brand accents ─────────────────────────────────────────────────────────
  // accent = electric blue — CTAs, active nav/tab state, focus rings
  accent:    '#4C7CFF',
  accentDim: 'rgba(76, 124, 255, 0.16)',
  // accent2 = teal — progress, sync/trend-positive, auto-generated items
  accent2:    '#22D3B5',
  accent2Dim: 'rgba(34, 211, 181, 0.16)',

  // ── Grade/severity tier colors ────────────────────────────────────────────
  // Used ONLY for performance signals (grade pills, GPA trend, school-tier
  // badges, checklist status). NEVER reuse for subject/category identity tags.
  tierGreen:   '#34D399',
  tierGreenBg: 'rgba(52, 211, 153, 0.16)',   // A-range / complete / "safety"
  tierAmber:   '#FBBF24',
  tierAmberBg: 'rgba(251, 191, 36, 0.16)',   // B-range / in progress / "target"
  tierRed:     '#F87171',
  tierRedBg:   'rgba(248, 113, 113, 0.16)',  // C- and below / not started / "reach" / Required flags

  // ── Special-purpose tokens ────────────────────────────────────────────────
  gold:           '#F0B429',              // achievement/streak chips ONLY
  goldBg:         'rgba(240, 180, 41, 0.16)',
  insetHighlight: 'rgba(255, 255, 255, 0.06)',  // inset top highlight on cards
  shadowBase:     'rgba(0, 0, 0, 0.2)',
  white:          '#FFFFFF',  // pure white — max-contrast text/icons on filled colored surfaces

  // ── Backward-compatible aliases ───────────────────────────────────────────
  // Keep existing screens/components compiling while the redesign migrates
  // forward to the new semantic tokens above.
  // @deprecated — use the semantic tokens above in new code.
  primary:               '#4C7CFF',   // → accent
  primaryDark:           '#2B5CCC',
  primaryDim:            'rgba(76, 124, 255, 0.16)',  // → accentDim
  primaryGlow:           'rgba(76, 124, 255, 0.4)',
  surface:               '#131A32',   // → cardFallback
  surface2:              '#1C2647',   // slightly lighter solid surface
  border:                'rgba(255, 255, 255, 0.09)',  // → cardBorder
  borderHover:           'rgba(255, 255, 255, 0.14)',
  textSecondary:         '#8991AE',   // → textDim
  textMuted:             '#5A6280',   // → textFaint
  success:               '#34D399',   // → tierGreen
  warning:               '#FBBF24',   // → tierAmber
  error:                 '#F87171',   // → tierRed
  orange:                '#F97316',
  info:                  '#22D3B5',   // → accent2
  purple:                '#A78BFA',
  buttonSecondaryBorder: 'rgba(255, 255, 255, 0.09)',  // → cardBorder
} as const

// ---------------------------------------------------------------------------
// Subject / category identity palette
// ---------------------------------------------------------------------------
// Used for icons, calendar tags, dot indicators — arbitrary subject names.
// NEVER reuse tierGreen/Amber/Red here (severity vs. identity are distinct).

export const subjectPalette = [
  '#4C7CFF',
  '#A78BFA',
  '#60A5FA',
  '#818CF8',
  '#F472B6',
  '#FB923C',
  '#22D3B5',
] as const

// Deterministic hash so the same subject string always maps to the same color.
export function getSubjectColor(subjectKey: string): string {
  let hash = 0
  for (let i = 0; i < subjectKey.length; i++) {
    hash = (hash * 31 + subjectKey.charCodeAt(i)) >>> 0
  }
  return subjectPalette[hash % subjectPalette.length]
}

// ---------------------------------------------------------------------------
// Grade tier color mapping
// ---------------------------------------------------------------------------
// A-range → tierGreen, B-range → tierAmber, C+ and below → tierRed.
// Replaces the old 5-color gradeColors map. Blue (accent) is reserved
// exclusively for interactive/brand elements in v2 — never for grade signals.

export function getGradeTierColor(letter: string): { color: string; bg: string } {
  const normalized = letter.trim().charAt(0).toUpperCase()
  if (normalized === 'A') return { color: colors.tierGreen, bg: colors.tierGreenBg }
  if (normalized === 'B') return { color: colors.tierAmber, bg: colors.tierAmberBg }
  return { color: colors.tierRed, bg: colors.tierRedBg }
}

// ---------------------------------------------------------------------------
// Gradients — diagonal fills for hero/quick-action tiles
// (passed to react-native-svg's <LinearGradient>; no expo-linear-gradient dep)
// ---------------------------------------------------------------------------

export const gradients = {
  hero:   ['#1E3A8A', '#0F1F4A'] as const,  // rich blue → deep navy
  accent: ['#4C7CFF', '#22D3B5'] as const,  // electric blue → teal
} as const

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

export const spacing = {
  xs:           4,
  sm:           8,
  ms:           12,
  md:           16,
  lg:           20,
  xl:           24,
  xxl:          32,
  xxxl:         40,
  huge:         48,
  massive:      64,
  cardPadding:  16,
  screenPadding: 20,
  sectionGap:   24,
} as const

// ---------------------------------------------------------------------------
// Border radii
// ---------------------------------------------------------------------------
// Semantic keys (new): card, input, button, pill.
// Legacy keys (kept for backward compat): xs, sm, md, lg, xl.

export const radii = {
  // Legacy keys — retained so existing screen code still resolves
  xs: 8,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 24,
  // Semantic keys — use these in new components
  card:   20,
  input:  14,
  button: 18,
  pill:   999,
} as const

// ---------------------------------------------------------------------------
// Shadow / elevation helpers
// ---------------------------------------------------------------------------

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

export const elevation = {
  sm:   makeShadow(0.22, 6,  3, 1),
  md:   makeShadow(0.34, 12, 6, 3),
  card: makeShadow(0.2,  2,  1, 1),  // matches '0 1px 2px rgba(0,0,0,0.2)'
} as const

// Inset top highlight — apply to glass/card inner views via borderTop
export const cardInsetHighlight: ViewStyle = {
  borderTopWidth: 1,
  borderTopColor: colors.insetHighlight,
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

// Font family names match keys registered via useFonts in App.tsx.
// Space Grotesk → headings/numerals/stats (data-forward contexts)
// Plus Jakarta Sans → body copy and UI labels
// Inter → legacy (kept for backward compat, prefer Jakarta for new body copy)

export const fonts = {
  // Inter (legacy/compat)
  regular:  'Inter_400Regular',
  medium:   'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold:     'Inter_700Bold',
  // Space Grotesk — headings, numerals, GPA figures
  displayMedium:   'SpaceGrotesk_500Medium',
  displaySemiBold: 'SpaceGrotesk_600SemiBold',
  displayBold:     'SpaceGrotesk_700Bold',
  // Plus Jakarta Sans — body copy, UI labels
  bodyRegular:  'PlusJakartaSans_400Regular',
  bodyMedium:   'PlusJakartaSans_500Medium',
  bodySemiBold: 'PlusJakartaSans_600SemiBold',
  bodyBold:     'PlusJakartaSans_700Bold',
} as const

export const typography = {
  display: { fontSize: 32, fontFamily: fonts.displayBold,    fontWeight: '700' as const },
  h1:      { fontSize: 24, fontFamily: fonts.displayBold,    fontWeight: '700' as const },
  h2:      { fontSize: 20, fontFamily: fonts.displaySemiBold, fontWeight: '600' as const },
  h3:      { fontSize: 16, fontFamily: fonts.displaySemiBold, fontWeight: '600' as const },
  body: {
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    fontWeight: '400' as const,
    lineHeight: 15 * 1.6,
  },
  caption: { fontSize: 12, fontFamily: fonts.bodyRegular, fontWeight: '400' as const },
  label: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
} as const

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

export const touchTarget = 44

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

export const animation = {
  navTransitionMs: 250,
  microInteractionMs: 150,
  durFast: 120,
  durBase: 220,
  durSlow: 380,
  spring: { damping: 14, stiffness: 180, mass: 0.9 },
} as const
