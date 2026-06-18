# NextStep — Design System

## Brand Identity
- **Product:** NextStep — AI-powered academic companion for high schoolers
- **Tone:** Confident, encouraging, clear. Not corporate. Not childish.
- **Users are teenagers** — UI must feel modern, fast, and trustworthy.

## Color Palette
```
Primary:      #7B61FF  (electric violet — brand accent)
Primary Dark: #5B3FDB
Background:   #07080F  (deep near-black, blue-violet tint)
Surface:      #0D0E1C
Border:       #1C1F3C
Text Primary:   #EDEEFF
Text Secondary: #8B8FB5
Text Muted:     #40435E
Success:    #34D399
Warning:    #FBBF24
Error:      #F87171
Info:       #38BDF8
Orange:     #FB923C
```

## Typography
- **Font:** System font stack (SF Pro on iOS, Roboto on Android via React Native defaults)
- **Scale:**
  - Display: 32px / weight 700
  - H1: 24px / weight 700
  - H2: 20px / weight 600
  - H3: 16px / weight 600
  - Body: 15px / weight 400 / line-height 1.6
  - Caption: 12px / weight 400
  - Label: 12px / weight 500 / uppercase + letter-spacing

## Spacing
- Base unit: 4px
- Common: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
- Card padding: 16px
- Screen horizontal padding: 20px
- Section gap: 24px

## Components — Standards
### Cards
- Background: Surface (`#161B22`)
- Border: 1px solid Border (`#30363D`)
- Border-radius: 12px
- Shadow: none (flat design — dark mode)
- Padding: 16px

### Buttons
- Primary: bg `#7B61FF`, text `#FFFFFF`, radius 8px, height 48px, weight 600
- Secondary: bg transparent, border `#1C1F3C`, text `#EDEEFF`
- Destructive: bg `#F85149`, text white
- Disabled: opacity 0.4, no interaction
- Loading state: show spinner, disable interaction, preserve width

### Inputs
- Background: `#0D1117`
- Border: `#30363D` (default), `#00C896` (focused), `#F85149` (error)
- Radius: 8px
- Height: 48px
- Label above input, error message below

### Navigation
- Tab bar: 5 items max
- Active tab: Primary teal icon + label
- Inactive: muted gray
- Stack headers: minimal — title centered, back arrow left, optional action right

## Feature-Specific UI Standards

### Grade Viewer
- Subject cards with letter grade badge (large, colored by grade: A=green, B=blue, C=yellow, D=orange, F=red)
- GPA displayed prominently at top — large number, color-coded
- Trend indicator (↑↓→) with delta from last sync

### GPA Simulator
- Slider or input per class to adjust hypothetical grade
- Real-time GPA recalculation (debounced, no submit button)
- College readiness indicator: progress bar toward target GPA
- Visual diff: current vs projected (side-by-side or overlay)

### Smart Planner
- Calendar view (week default) + list view toggle
- Assignment cards: subject color coding, due date, estimated time, AI priority badge
- Overdue = red accent, due today = yellow, upcoming = muted

### High School Roadmap
- Timeline visualization by grade (9th → 12th)
- Course completion badges
- Graduation progress: circular progress ring
- College prep checklist with checkable items

## Accessibility
- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text
- All interactive elements: minimum 44×44pt touch target
- All images: accessibility labels
- Support system font size scaling (no fixed font sizes in pixels)
- No color-only information conveying — always pair color with text/icon

## Animation
- Navigation transitions: 250ms ease-in-out
- Data loading: skeleton screens (not spinners for content)
- Micro-interactions: 150ms
- No animations that cannot be disabled (respect `prefers-reduced-motion`)

## Rules
- No gradient backgrounds on content screens (only on marketing/onboarding)
- Dark mode is the default and primary design target
- No lorem ipsum in any deliverable
- All screens must have empty states and error states designed
- Loading states required on every async action
