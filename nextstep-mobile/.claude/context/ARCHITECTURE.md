# Futurely Mobile — Architecture

This describes the **actual** state of this repo, not an idealized target. If you change the
stack (swap a library, add a service), update this file in the same PR — agents read this
file to decide what patterns to follow, so drift here causes real bugs.

> This repo was split out of the `Futurely` monorepo (https://github.com/Pilotsoma/Futurely)
> on 2026-07-17 via `git subtree split`, preserving the mobile app's commit history. This
> file is a duplicate of the "Mobile App" section of the main repo's
> `.claude/context/ARCHITECTURE.md` as of the split date, adapted so the app is the repo
> root instead of `nextstep-mobile/`. If it drifts from the main repo's copy, treat the main
> main repo was the source used to recover the backend API in this standalone
> repository on 2026-07-25. Changes to the shared API contract must now be kept
> synchronized deliberately.

## Standalone mobile application and backend

The Expo/React Native client is at the repository root. The Express + Prisma +
Neon/PostgreSQL API is in `backend/`. The web frontend remains in the main
`Pilotsoma/Futurely` repository and is intentionally not duplicated here.

## Layout

```
Futurely-mobile/
├── App.tsx, index.ts         # Expo entrypoints
├── src/
│   ├── api/                  # Per-domain fetch layer (authApi.ts, gradesApi.ts, ...) + client.ts
│   ├── screens/               # 7 top-level screens + Grades sub-screens
│   ├── navigation/            # RootNavigator / AuthNavigator / ConnectSchoolNavigator / MainNavigator
│   ├── context/                # AuthContext (auth/session + portal-connection status)
│   ├── components/             # UI primitives (src/components/ui/*)
│   ├── theme/                  # tokens.ts (dark-theme-only design tokens)
│   └── constants/               # api.ts (environment/LAN-aware API URL)
└── backend/                     # Express API, Prisma schema/migrations, tests
```

## Mobile App

- **Framework:** Expo managed workflow, SDK `~54` (check `package.json` — `expo` field —
  before assuming any Expo API; don't trust doc links pinned to a different SDK version).
- **Runtime:** React Native `0.81.x`, React `19.1.x`, TypeScript `~5.9`.
- **No EAS config exists yet** (no `eas.json`). This is a pure Expo Go / managed-workflow
  project today — no custom native modules, no dev client. If a feature needs a native
  module Expo Go doesn't support, that's an architecture decision (introduce `expo-dev-client`
  + EAS) — flag it, don't silently add the dependency.
- **Navigation:** React Navigation **v7** (`@react-navigation/native`, `native-stack`,
  `bottom-tabs`; `drawer` is installed but unused). Not v6 — don't use v6-only APIs.
  Structure:
  - `RootNavigator` — 3-state auth gate: unauthenticated → `AuthNavigator`;
    authenticated + no school portal linked → `ConnectSchoolNavigator`;
    authenticated + portal linked → `MainStack`.
  - `MainStack` (`createNativeStackNavigator`) — outer shell, `headerShown: false` by default.
    First screen is `MainTabs`; `Settings`, `Colleges`, and `GpaSimulator` are pushed on top
    (back arrow shown automatically, no tab bar visible).
  - `MainNavigator` / `MainTabs` (`createBottomTabNavigator`) — 5 visible tabs (Dashboard,
    Grades, Planner, Roadmap, AIChat) rendered via the `FloatingTabBar` custom tab bar; `StudyFeed`
    is registered but hidden from the tab bar. `Grades` tab is itself `GradesNavigator`, a
    native-stack with a hub screen + 8 sub-screens (Attendance, Classwork, ContactTeachers,
    ProgressReport, ReportCard, Schedule, Transcript, GradesHub).
  - Tab bar is a floating glass pill (`src/components/ui/FloatingTabBar.tsx`) — a pure
    presentational component wired via a `tabBar` render prop adapter in `MainNavigator.tsx`.
- **Scope note:** this app deliberately covers only the 7 screens in web's visible student
  nav, plus auth/connect-school. Battle, Play, Classroom, Marketplace (full), Study Sets, My
  Counselor, the Canvas LMS integration, and ClassLink are **out of scope** — all are hidden
  from regular students on web itself (DEV-tag-gated, or reachable only via a notification
  deep-link or a typed URL), so mobile has no parity gap for a normal student. Don't assume
  these are accidentally missing; treat adding them as a scope-expansion decision, not a bug fix.
- **Styling:** NativeWind v4 (Tailwind for RN) + `tailwindcss` v3 are dependencies, but screens
  are actually styled with plain RN `StyleSheet.create` + `src/theme/tokens.ts` constants (dark
  theme only — `app.json` hardcodes `"userInterfaceStyle": "dark"`, so no `ThemeContext`/
  provider exists). `react-native-svg` and `expo-blur` **are installed** and load-bearing —
  gradients, the glass Card/FloatingTabBar blur treatment, ProgressRing, and the background
  radial glow all depend on them. Icons come primarily from the app's own custom stroke-icon
  system (`src/components/icons/`, SVG-based); `@expo/vector-icons` is still used in a few
  pre-existing spots but is not the primary icon source. `expo-linear-gradient` remains
  **not installed/approved** — use `react-native-svg`'s gradient primitives instead. See
  DESIGN_SYSTEM.md before adding new gradients/SVG.
- **State management:** No Redux, no RTK Query, no Zustand. State is React Context
  (`src/context/AuthContext.tsx` for auth/session + portal-connection status) + local component
  state + a thin per-domain fetch layer in `src/api/*.ts` (`authApi.ts`, `studentsApi.ts`,
  `gradesApi.ts`, `assignmentsApi.ts`, `collegesApi.ts`, `feedApi.ts`, `aiApi.ts`,
  `marketplaceApi.ts`). Each calls through the single typed wrapper in `src/api/client.ts` —
  there is no generic data-fetching/caching library (no TanStack/SWR/RTK Query). Don't
  introduce one without an architect decision; follow the existing per-domain module pattern.
- **API client (`src/api/client.ts`):** two timeout tiers (10s CRUD, 45s for any
  `/integrations/grades/*` path, matching the backend's own HAC/PowerSchool scrape timeouts),
  and a de-duplicated 401→refresh→retry interceptor — refresh tokens rotate server-side
  (`POST /auth/refresh` revokes the old one and issues a new pair), so concurrent 401s share
  one in-flight refresh via a module-level promise rather than each firing their own. Also
  normalizes the backend's inconsistent error envelopes (`{error:{code,message}}` on
  auth/assignments/grades/ai/marketplace, `{error:{message}}` with no code on colleges, a bare
  `{error:"string"}` on feed) into one `ApiRequestError` shape.
- **Auth/session storage:** JWT access + refresh tokens persisted via
  `@react-native-async-storage/async-storage` (`src/utils/storage.ts`). `AuthContext` restores
  the session on launch via `GET /auth/me` (which itself goes through the refresh interceptor).
  No Firebase Auth anywhere in this repo.
- **API base URL:** `src/constants/api.ts` prefers `EXPO_PUBLIC_API_URL`, uses
  localhost for web, and otherwise derives the computer hostname from Expo's
  `hostUri` while changing the port to 3001. A physical Expo Go device therefore
  follows the QR/Metro LAN address automatically.
- **Push notifications:** not implemented. No FCM, no `expo-notifications` dependency yet.
- **Testing:** mobile tests use Jest 29 with `jest-expo`; the backend uses Jest
  29 with `ts-jest`. `npm run check` also runs strict type checking, Expo lint,
  backend tests, and the backend production build.

## AI features

AI runs server-side only in `backend/src/routes/ai.ts`. No LLM API keys ship to
the app; the AI Chat screen calls the backend like any other endpoint.

## Environments & Secrets

Mobile may use a non-secret `EXPO_PUBLIC_API_URL`; Expo embeds it in the client
bundle. All real secrets (JWT signing, database credentials, OAuth secrets, and
LLM keys) live in ignored `backend/.env` or the deployment secret store.
