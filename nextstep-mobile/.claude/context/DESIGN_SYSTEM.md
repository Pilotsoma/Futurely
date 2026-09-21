# Futurely — Mobile Design System (v2)

`src/theme/tokens.ts` is the single source of truth for all tokens.
Update this doc whenever tokens.ts changes.

---

## Brand Identity
- **Product:** Futurely — AI-powered academic companion for high schoolers
- **Tone:** Confident, encouraging, clear. Not corporate. Not childish.
- **Visual language:** Dark navy base, frosted glass cards, electric blue + teal accents.
  Numerals and data read bold via Space Grotesk; body copy uses Plus Jakarta Sans.

---

## Color Palette

### Core surface tokens
| Token | Value | Usage |
|---|---|---|
| `colors.bg` | `#0A0E1C` | Screen background |
| `colors.cardFill` | `rgba(255,255,255,0.05)` | Glass card fill overlay |
| `colors.cardBorder` | `rgba(255,255,255,0.09)` | Card borders, input borders |
| `colors.cardFallback` | `#131A32` | Solid card bg where blur unavailable |
| `colors.divider` | `rgba(255,255,255,0.07)` | Hairline dividers |
| `colors.insetHighlight` | `rgba(255,255,255,0.06)` | 1px top border on glass cards |
| `colors.shadowBase` | `rgba(0,0,0,0.2)` | Drop shadow base |

### Text tokens
| Token | Value | Usage |
|---|---|---|
| `colors.text` | `#F3F5FA` | Primary text |
| `colors.textDim` | `#8991AE` | Secondary/supporting text |
| `colors.textFaint` | `#5A6280` | Muted/placeholder text |

### Brand accents
| Token | Value | Usage |
|---|---|---|
| `colors.accent` | `#4C7CFF` | CTAs, active tab/nav state, focus rings, interactive elements |
| `colors.accentDim` | `rgba(76,124,255,0.16)` | Active tab tile background, highlight fills |
| `colors.accent2` | `#22D3B5` | Progress bars, sync/positive-trend signals, auto-generated items |
| `colors.accent2Dim` | `rgba(34,211,181,0.16)` | accent2 fill backgrounds |

### Grade/severity tier colors
Used **only** for performance signals (grade pills, GPA trend, school-tier badges, checklist status).
**Never reuse for subject/category identity tags** — those use `subjectPalette`.

| Token | Value | Meaning |
|---|---|---|
| `colors.tierGreen` / `tierGreenBg` | `#34D399` / `rgba(52,211,153,0.16)` | A-range / complete / "safety" |
| `colors.tierAmber` / `tierAmberBg` | `#FBBF24` / `rgba(251,191,36,0.16)` | B-range / in-progress / "target" |
| `colors.tierRed` / `tierRedBg` | `#F87171` / `rgba(248,113,113,0.16)` | C- and below / not started / "reach" / Required flags |

### Special-purpose tokens
| Token | Value | Usage |
|---|---|---|
| `colors.gold` | `#F0B429` | Achievement chips and streak cards **only** |
| `colors.goldBg` | `rgba(240,180,41,0.16)` | Gold-treatment fill background |

### Backward-compatible aliases
The following aliases exist in `tokens.ts` so existing screens compile unchanged.
Do **not** use these in new code — use the semantic tokens above.

`primary → accent`, `primaryDim → accentDim`, `surface → cardFallback`,
`border → cardBorder`, `textSecondary → textDim`, `textMuted → textFaint`,
`success → tierGreen`, `warning → tierAmber`, `error → tierRed`.

---

## Subject / Category Identity Palette

```typescript
export const subjectPalette = ['#4C7CFF', '#A78BFA', '#60A5FA', '#818CF8', '#F472B6', '#FB923C', '#22D3B5']
export function getSubjectColor(subjectKey: string): string { /* deterministic hash */ }
```

Use `getSubjectColor(subject)` for subject color dots, calendar tags, and icon tints.
Assign consistently across the app via the hash function — never hardcode per subject name.

---

## Grade Tier Colors

```typescript
export function getGradeTierColor(letter: string): { color: string; bg: string }
// A → tierGreen, B → tierAmber, C+ and below → tierRed
```

The old 5-color `gradeColors` export (A/B/C/D/F with blue for B) is removed.
Blue (`accent`) is reserved exclusively for interactive/brand elements.

---

## Typography

| Role | Font | Weight key | Usage |
|---|---|---|---|
| `display` | Space Grotesk | `displayBold` (700) | 32px hero numbers, large stats |
| `h1` | Space Grotesk | `displayBold` (700) | 24px screen headings |
| `h2` | Space Grotesk | `displaySemiBold` (600) | 20px section headings |
| `h3` | Space Grotesk | `displaySemiBold` (600) | 16px card headings |
| `body` | Plus Jakarta Sans | `bodyRegular` (400) | 15px / lh 1.6 body copy |
| `caption` | Plus Jakarta Sans | `bodyRegular` (400) | 12px supporting text |
| `label` | Plus Jakarta Sans | `bodyMedium` (500) | 12px uppercase + tracking |

Font keys available on `fonts.*`:
- `displayMedium/SemiBold/Bold` → Space Grotesk 500/600/700
- `bodyRegular/Medium/SemiBold/Bold` → Plus Jakarta Sans 400/500/600/700
- `regular/medium/semiBold/bold` → Inter 400/500/600/700 (legacy, prefer Jakarta for new body)

**Space Grotesk max weight is 700 Bold — there is no 800 weight.**

---

## Spacing
Base unit: 4px. Common scale: `xs:4, sm:8, ms:12, md:16, lg:20, xl:24, xxl:32, xxxl:40, huge:48, massive:64`.
Card padding: 16. Screen horizontal padding: 20. Section gap: 24.

---

## Border Radii (`radii.*`)

| Key | Value | Use |
|---|---|---|
| `card` | 20 | Cards (default) |
| `input` | 14 | Text inputs |
| `button` | 18 | Buttons |
| `pill` | 999 | SegmentedControl, ProgressBar, FloatingTabBar, chips |
| `sm` | 10 | Legacy (kept for backward compat) |
| `md` | 16 | Legacy |
| `lg` | 20 | Legacy |

---

## Components

### Cards

Three variants on `<Card variant="..." ...>`:

- **`default`** — `cardFallback` solid background, `cardBorder` border, `radii.card` radius, `spacing.cardPadding`.
- **`gradient`** — diagonal fill via react-native-svg `LinearGradient`. Pass `gradientColors` (defaults to `gradients.hero`). Border has blue tint.
- **`glass`** — expo-blur `BlurView` (intensity 18, tint dark) + `cardFill` overlay + `insetHighlight` top border. Pass `disableBlur` to fall back to `cardFallback`. Default radius `radii.card`.

Card treatment constants exported: `cardInsetHighlight` (ViewStyle for top highlight border), `elevation.card` (shadow matching `0 1px 2px rgba(0,0,0,0.2)`).

### Buttons

- **`primary`** — `accent` fill, white text, `radii.button` (18), `elevation.sm`.
- **`secondary`** — transparent + `cardBorder` border, `text` color.
- **`destructive`** — `tierRed` fill, white text.
- `loading` state: spinner in component, dimension preserved. `disabled`: opacity 0.4, interaction blocked. Scale spring animation on press (0.96).

### Inputs

- `radii.input` (14px) radius. Border: `cardBorder` default → `accent` focused → `tierRed` error.
- Placeholder: `textDim`. Background: `surface2`. Label above, error below.

### SegmentedControl

Pill-shaped track (`radii.pill`). Active: `accentDim` background + `accent` text. Inactive: transparent + `textDim`. Generic `<SegmentedControl<T> segments value onChange>`.

### ProgressBar (new)

`<ProgressBar value={0-1} color? trackColor? height? />`. Defaults: `accent2`, `cardBorder`, 6pt. Fully rounded (pill) ends.

### ProgressRing

SVG stroke circle. Defaults: `accent` stroke, `accentDim` track. Props: `progress (0-100)`, `size`, `strokeWidth`, `color`, `trackColor`.

### FloatingTabBar (new)

Pure presentational glass pill tab bar. Zero React Navigation imports.

```typescript
interface FloatingTabBarItem {
  key: string; label: string
  icon: (props: { color: string; size: number }) => React.ReactNode
  active: boolean; onPress: () => void; accessibilityLabel?: string
}
interface FloatingTabBarProps {
  items: FloatingTabBarItem[]  // exactly 5 route items
  settingsItem: { icon, onPress, accessibilityLabel? }
  style?: StyleProp<ViewStyle>
}
```

Absolute positioned, inset 20pt left/right, bottom = max(20, safeArea.bottom + 8). Height 64. Glass pill background. 5 route items + 1 settings item. Active: `accentDim` tile + `accent` icon. Settings: never active. Each Pressable is 44×44 (min touch target), visual tile 42×42.

### GradeBadge

```typescript
<GradeBadge letter="A+" />
<GradeBadge letter="A" tier="safety" />  // tier prop overrides color mode
<GradeBadge tier="reach" />              // no letter — shows first char of tier
```

`tier?: 'reach' | 'target' | 'safety'` — maps to tierRed/tierAmber/tierGreen. Backed by `getGradeTierColor`.

### Skeleton (unified)

```typescript
<Skeleton rows={4} rowHeight={64} />      // rows mode — shimmer list
<Skeleton width="100%" height={16} radius={6} />  // block mode
<LoadingSkeleton rows={4} />             // alias, same component
```

Reanimated shimmer sweep (~1.1s loop, ease-in-out). Static dim block when reduce-motion is active.
Old `LoadingSkeleton.tsx` deleted — all screens now import `{ LoadingSkeleton }` from `./Skeleton`.

### StreakCard / AchievementChip (new, not yet wired)

Gold treatment (`colors.gold`/`goldBg`). Built and exported but not rendered anywhere — no backing data yet.

---

## Icon System

`src/components/icons/index.tsx` — 103 stroke icons, 24×24 viewBox, strokeWidth 2.

```typescript
<FlameIcon size={20} color={colors.gold} />
<HomeIcon size={22} gradient />  // gradient prop → accent→accent2 linear gradient
```

The `gradient` prop uses the two-stop brand gradient `[colors.accent, colors.accent2]` (electric blue → teal). Old three-stop cyan→blue→purple gradient is removed.

`getSubjectColor(subject)` to pick a subject-palette color from `subjectPalette`.

---

## Screen Background

`Screen` renders a subtle radial glow: accent blue bloom top-left, accent2 teal bloom top-right, 11–14% opacity, implemented via `react-native-svg` `RadialGradient` (no `expo-linear-gradient` dependency).

---

## Accessibility
- Minimum contrast: 4.5:1 body text, 3:1 large text (> 18px bold).
- All interactive elements: minimum 44×44pt touch target.
- All non-text interactive and image elements: `accessibilityLabel`.
- Font sizes support dynamic scaling.
- Color never the only indicator of meaning — always pair with text or icon.
- All animations check `useReducedMotion()` / `preferenceReduceMotion` and skip animation when set.

## Animation
- Entry transitions: ≤ 300ms, never block interaction.
- Press feedback: scale 0.97 (100–150ms, ease-out).
- Skeleton shimmer: ~1.1s loop, ease-in-out.
- Number transitions: 300–400ms ease-out (when implemented).
- Reduced motion: instant state changes, no animation.

## Rules
- Dark theme is the primary target (`app.json` hardcodes `"userInterfaceStyle": "dark"`).
- No `expo-linear-gradient` — use `react-native-svg` `LinearGradient`/`RadialGradient`.
- `expo-blur` for glass effects only — always provide `disableBlur` fallback.
- No lorem ipsum in any deliverable.
- All screens must have empty states, error states, and loading skeleton states.
- `src/constants/colors.ts` is deprecated — migrate importers to `src/theme/tokens.ts`.
