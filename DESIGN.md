---
name: Futurely
description: AI academic planner for high schoolers — grades, roadmap, and what-if GPA scenarios.
colors:
  bg: "#F0F4FF"
  surface: "#FFFFFF"
  surface-2: "#E8EEFF"
  surface-3: "#D4DBFF"
  border: "#C0CCE8"
  border-hover: "#A0B0D8"
  primary: "#2979FF"
  primary-dark: "#1B4DB0"
  accent-blue: "#00BCD4"
  text: "#050B18"
  text-secondary: "#3D4F72"
  text-muted: "#7B8DB0"
  success: "#10B981"
  warning: "#F59E0B"
  orange: "#F97316"
  error: "#EF4444"
  info: "#00E5FF"
  purple: "#7C3AED"
typography:
  display:
    fontFamily: "Clash Grotesk, Inter, -apple-system, Segoe UI, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.5px"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    letterSpacing: "0.1px"
rounded:
  sm: "10px"
  md: "12px"
  lg: "18px"
  pill: "100px"
spacing:
  gutter-desktop: "44px"
  gutter-tablet: "24px"
  gutter-phone: "16px"
  sidebar-expanded: "260px"
  sidebar-collapsed: "68px"
  grid-gap: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "9px 18px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    height: "42px"
    padding: "10px 14px"
  badge:
    rounded: "{rounded.pill}"
    padding: "2px 8px"
---

# Design System: Futurely

## Overview

**Creative North Star: "The Study Command Center"**

Futurely is a calm, focused control surface for a student's academic life: grades, a four-year roadmap, planner, and an AI advisor, read at a glance and acted on fast. The core UI is crisp and efficient — dense data, minimal flourish, no wasted motion — because the people using it (students, parents, counselors, teachers) are scanning real numbers under time pressure, not browsing a marketing site. Every interactive surface is gently pressable: a soft neomorphic lift at rest, a soft inset press on activation. Signal Blue is the one color that means "act here"; everything else stays neutral until grade-color or gamification semantics say otherwise.

A separate, deliberately loud layer exists for gamification and prestige (rainbow/mythic/curse badge effects, gold/void/white avatar frames, box-opening reveals). That layer is allowed to be as expressive as a reward deserves — it is explicitly **not** part of the core UI's restraint, and it must never leak into navigation, buttons, forms, or data display.

**Key Characteristics:**
- Crisp and efficient first; playful only inside the gamification reward layer.
- Neomorphic tactility — raised at rest, inset on press — on every interactive control, not just a hero few.
- Signal Blue is spent rarely and meaningfully: primary actions, active nav state, focus rings.
- No generic SaaS-template look (flat purple-gradient dashboard clichés) and no childish/toy styling in the core UI, even though the audience is teenagers.

## Colors

A cool blue-gray base (paper-blue in light mode, night-blue in dark) with one confident action blue and a narrow semantic set for grades, status, and alerts.

### Primary
- **Signal Blue** (`#2979FF`): the only color that means "do this." Primary buttons, active nav item, focus rings, links, primary chart series. Used sparingly — if more than one element per view uses it, something else should have been neutral.
- **Signal Blue Deep** (`#1B4DB0`): hover/active state for Signal Blue surfaces, never a standalone brand color.

### Secondary
- **Accent Cyan** (`#00BCD4` light / `#00E5FF` dark): secondary data series and the "info" semantic; a cooler, quieter companion to Signal Blue, never substituted for it on primary actions.

### Neutral
- **Paper Blue** (`#F0F4FF` light bg / `#0D1829` dark bg): page background.
- **Surface** (`#FFFFFF` light / `#162235` dark): card and control background, one step up from the page.
- **Surface Raised** (`#E8EEFF` light / `#1C2D47` dark) and **Surface Deep** (`#D4DBFF` light / `#233456` dark): secondary surfaces — table header rows, hover fills, nested panels.
- **Border** (`#C0CCE8` light / `#273D5E` dark) and **Border Hover** (`#A0B0D8` light / `#2F4970` dark).
- **Ink** (`#050B18` light / `#E8EEFF` dark): primary text.
- **Ink Secondary** (`#3D4F72` light / `#96AACC` dark): supporting text, labels, metadata.
- **Ink Muted** (`#7B8DB0` light / `#52698A` dark): placeholders, disabled text, the least important line on a card.

### Semantic
- **Success** (`#10B981`), **Warning** (`#F59E0B`), **Orange** (`#F97316`), **Error** (`#EF4444`), **Info** (`#00E5FF`), **Purple** (`#7C3AED`): fixed meanings — grade bands (A–F map to success → primary → warning → orange → error), status pills, and alert banners. Never reused decoratively.

### Named Rules
**The One Signal Rule.** Signal Blue marks the one actionable or currently-active thing on a view. A screen with three blue buttons has a hierarchy problem, not a branding opportunity.

**The Reward-Layer Containment Rule.** Rainbow/mythic/curse/gold/void animated color effects belong exclusively to earned gamification cosmetics (avatar frames, prestige tags, box reveals). They never apply to navigation, buttons, inputs, tables, or any element whose job is reading real data.

## Typography

**Display Font:** Clash Grotesk Medium (with Inter, system sans fallback)
**Body Font:** Inter (with system sans fallback)

**Character:** Clash Grotesk is reserved for a handful of large numbers and names that anchor a screen (dashboard GPA, student name, section headlines) — everything else, including every control and every table, runs on Inter at efficient, legible sizes.

### Hierarchy
- **Display** (500, 34–48px desktop / 24–28px phone, 1.1 line-height, -0.5px tracking): dashboard GPA number, student name, top-of-page headline. Clamps down at each breakpoint; never the font that overflows.
- **Title** (500–600, 26–34px desktop / 20–24px phone): section headings (`.ns-heading-xl`).
- **Body** (400, 16px, 1.55 line-height): paragraph and default UI text.
- **Label** (500, 12.5–15px, 0.1px tracking): nav items, chips, badges, table headers — small text that still needs to be read quickly, not shrunk arbitrarily.

### Named Rules
**The Display-Is-Rare Rule.** Clash Grotesk appears on one or two elements per screen — the number or name the screen exists to show. Every other heading is Inter at a weight step, not a font-family change.

## Layout

A collapsible icon/label sidebar (260px expanded, 68px collapsed, pinned or hover-expanded) plus a fluid main column. Desktop gutter is 44px, dropping additively to 24px at tablet (768–1023px) and 16px at phone (≤767px) — the desktop layout above 1024px is the frozen reference; narrower rules only add, never restyle it. Stat and quick-action rows are 4-column grids at desktop, collapsing to 2 columns at tablet and 1 at phone (12–20px gap). On Windows displays ≥1600px logical width, the authenticated app shell (`.ns-scale-shell`) zooms up to 1.08–1.25× so fixed-px density still reads right on wider monitors at 100% OS scale — the login screen is explicitly excluded from this scaling.

## Elevation & Depth

Depth is neomorphic, not flat-with-dropshadow: every interactive surface (cards, buttons, chips, inputs) carries a soft dual-direction shadow — a light highlight from the top-left plus a darker shadow from the bottom-right — simulating a raised physical surface pressed out of the background. The light source and exact rgba values are explicitly derived per-theme in `globals.css` and must stay paired that way; copying only one side flattens the effect. A secondary flat `shadow-sm/md/lg/xl` scale layers on top for hover lift (cards translate up 2px and gain `shadow-md` on hover) — it is additive, never a replacement for the neomorphic base.

### Shadow Vocabulary
- **`--neo-raised`** (light: `-4px -4px 10px rgba(255,255,255,.90), 5px 5px 14px rgba(174,190,214,.60)`): resting state for every card, button, input, chip, and the sidebar.
- **`--neo-inset`** (light: `inset 3px 3px 8px rgba(174,190,214,.50), inset -3px -3px 6px rgba(255,255,255,.90)`): pressed/active state. Buttons and chips switch to this on `:active`.
- **`--neo-sidebar`**: the sidebar's own directional variant (shadow projects rightward, not symmetric).
- **`--shadow-sm/md/lg/xl`**: flat ambient shadows, used additively on hover to lift a card or button slightly above its resting neomorphic state.

### Named Rules
**The Pressable Surface Rule.** Any element a user clicks or taps shows `--neo-raised` at rest and `--neo-inset` on press. A flat, shadowless button or input is an unfinished one.

## Shapes

Three radius steps cover everything: 10px for small chrome (the mobile hamburger), 12px for the everyday control size (buttons, inputs, chips, nav pills), and 18px for cards and containers. Badges and pills use full `100px` radius. No sharp corners anywhere in the core UI; no radius outside this scale.

## Components

### Buttons
- **Shape:** 12px radius, never square.
- **Primary (`.ns-btn-primary`):** Signal Blue fill, white text, `--neo-raised` at rest; hover darkens to Signal Blue Deep and adds `--shadow-md`; active switches to `--neo-inset` with a quick scale-down (0.97); disabled drops to 45% opacity with no shadow.
- **Ghost (`.ns-btn-ghost`):** surface-colored fill with a border, same neomorphic rest/press behavior, text promotes from secondary to primary ink on hover.
- **Chip (`.ns-chip`):** full-width left-aligned option row, Signal Blue border/text/tint on hover — the selection-list variant of ghost.

### Badges
- **Style:** pill radius, 11px bold label text, 2px/8px padding. Color comes from the semantic palette (grade, status) or, for prestige cosmetics only, the animated rainbow/mythic/curse/legendary keyframes defined in `globals.css`.

### Cards / Containers
- **Corner Style:** 18px.
- **Background:** Surface, 1px Border.
- **Shadow Strategy:** `--neo-raised` at rest; hover adds `--shadow-md` and lifts 2px (translateY(-2px)); border brightens to Border Hover on hover.
- **Internal Padding:** follows the grid-gap scale (12–20px between grouped cards); content padding varies by card but should not go below ~16px.

### Inputs / Fields
- **Style:** 12px radius, Border stroke, `--neo-inset` at rest (the one inverted case — fields read as a pressed-in slot, not a raised button), 42px height, Body-size text.
- **Focus:** border shifts to Signal Blue and gains a 3px Signal-Blue-dim ring, stacked with the existing inset shadow — never replacing it.
- **Placeholder:** Ink Muted.

### Navigation
- **Style:** icon (20px, 2px stroke, round caps/joins — one consistent outline icon family) + label pill, 12px radius, 11px/16px padding. Default text is Ink Secondary; active item promotes to Signal Blue + semibold; hover adds a faint white-tint background. Collapses to icon-only at 68px; expands to 260px with labels on pin or hover. Below 1024px it becomes a slide-in drawer with a backdrop and a fixed hamburger trigger.

## Do's and Don'ts

### Do:
- **Do** keep Signal Blue to the one actionable/active element per view (The One Signal Rule).
- **Do** give every clickable surface both a `--neo-raised` rest state and a `--neo-inset` press state.
- **Do** reserve Clash Grotesk for the one or two numbers/names a screen exists to show; everything else is Inter.
- **Do** let gamification cosmetics (rainbow/mythic/curse/gold/void, box reveals) be as loud as they like — but only on avatar frames, prestige tags, and reward boxes.
- **Do** theme scrollbars, selection, focus rings, and tabular numerals from the token palette rather than leaving browser defaults.

### Don't:
- **Don't** let a reward-layer animated effect (rainbow/mythic/curse/gold/void) apply to navigation, buttons, inputs, tables, or any data-bearing element.
- **Don't** add gradient text, kickers/eyebrows above headings, or hard-offset neobrutalist shadows anywhere — this system's depth language is neomorphic soft shadow, not a flat block shadow.
- **Don't** reach for a generic flat-card SaaS-dashboard look (purple gradients, same-size icon+heading+text cards as page scaffolding) — this is a dense command-center surface, not a marketing template.
- **Don't** style the core UI (grades, planner, dashboard, settings) as childish or toy-like for the sake of the teen audience — credibility matters more than cuteness here; save the fun for the reward layer.
- **Don't** modify the frozen ≥1024px desktop layout rules in `globals.css` with anything but additive `max-width` rules below it.
