# Icon Inventory — Emoji-to-Icon Migration

**Scope:** All `.tsx` / `.ts` frontend files excluding `node_modules`, `dist`, `.next`, `backend`  
**Task:** Discovery only. No code has been changed.  
**Date:** 2026-07-06  
**Grep ranges:** `U+1F300–U+1FAFF` (emoji), `U+2600–U+27BF` (misc symbols/dingbats), `U+2190–U+21FF` (arrows)

---

## How to read this table

| Column | Notes |
|--------|-------|
| **File** | Path relative to repo root |
| **Line** | Line number from grep |
| **Emoji** | Raw character(s) matched |
| **Semantic meaning** | What the emoji represents in its UI context — read from surrounding JSX |
| **Proposed icon name** | Shared icon name; identical meanings across files map to ONE name |
| **Flag** | `REPLACE` = migrate in a later phase · `PROTECTED_SKIP` = never touch · `AMBIGUOUS — confirm` = may be prose/copy, architect must decide before replacement |

---

## Notes on protected-file scan

No grep hits landed in files matching the PROTECTED_SKIP patterns below. All protected logic lives in the `backend/` directory, which was excluded from the scan.

| Pattern checked | Files excluded from grep | Result |
|-----------------|--------------------------|--------|
| `hac`, `sso`, `schoolAuth` in path/name | `backend/src/modules/grades/` | No frontend hits |
| `gpa-calculator`, `weighted-gpa` | `backend/src/modules/gpa/` | No frontend hits |
| `encrypt`, `crypto`, AES logic | `backend/src/modules/` | No frontend hits |
| Canvas sync worker | `backend/src/integrations/` | No frontend hits |
| JWT signing/verification | `backend/src/modules/auth/` | No frontend hits |
| ClassLink backend connector | `backend/src/integrations/classlink/` | No frontend hits |

`app/(app)/grades/classlink/page.tsx` is the **frontend** ClassLink OAuth success UI — not the backend connector — and is safe to modify.

---

## Shared icon name reference

Multiple files that use the same semantic concept map to a single shared icon. This table defines those mappings.

| Proposed icon name | Visual concept | Emoji(s) covered |
|--------------------|---------------|------------------|
| `BarChartIcon` | Grades / analytics bar chart | 📊 |
| `ClipboardIcon` | Report card / clipboard list | 📋 |
| `ClockIcon` | Time / schedule / clock | 🕐 |
| `CalculatorIcon` | Calculator / what-if | 🧮 |
| `EnvelopeIcon` | Email / contact / send mail | ✉️ |
| `TrendingUpIcon` | Progress / upward trend | 📈 |
| `DocumentIcon` | File / document / transcript / PDF | 📄 📃 |
| `CalendarIcon` | Attendance / calendar / date | 📅 |
| `MoonIcon` | Dark mode | 🌙 |
| `SunIcon` | Light mode | ☀️ |
| `BanIcon` | Blocked / deleted / access denied | 🚫 |
| `LightningBoltIcon` | Live sync / energy / achievement tier | ⚡ |
| `LockIcon` | Locked / secure / encrypted | 🔒 |
| `LockOpenIcon` | Unlocked / grant access | 🔓 |
| `RobotIcon` | AI / bot | 🤖 |
| `GraduationCapIcon` | College / student / academic | 🎓 |
| `SkullIcon` | Game over / danger / the-curse item | 💀 |
| `TrophyIcon` | Win / leaderboard / achievement | 🏆 |
| `GamepadIcon` | Game lobby / play | 🎮 |
| `TargetIcon` | Targeting / quiz trigger | 🎯 |
| `PencilIcon` | Edit / assignment / write | ✏️ 📝 |
| `ImageIcon` | Image / avatar effect / picture | 🖼️ |
| `VideoIcon` | Video file | 🎬 |
| `AudioIcon` | Audio file | 🎵 |
| `ArchiveIcon` | Zip / compressed file | 🗜️ |
| `FolderIcon` | Generic file / folder | 📁 |
| `QuestionMarkIcon` | Quiz / question | ❓ |
| `ChatBubbleIcon` | Discussion / comment / chat | 💬 |
| `LinkIcon` | External URL / reconnect link | 🔗 |
| `WrenchIcon` | External tool / dev panel | 🔧 |
| `WarningIcon` | Warning / overdue / caution | ⚠️ ⚠ |
| `CheckCircleIcon` | Trade accepted / success circle | ✅ |
| `GiftIcon` | Giveaway / prize / cosmetics | 🎁 |
| `TagIcon` | Item tag / listing sold notification | 🏷️ |
| `PackageIcon` | Generic marketplace item | 📦 |
| `UsersIcon` | Owners / group | 👥 |
| `MedalIcon` | Achievement medal / Veteran / rank | 🏅 |
| `GoldMedalIcon` | Rank #1 | 🥇 |
| `SilverMedalIcon` | Rank #2 | 🥈 |
| `BronzeMedalIcon` | Rank #3 | 🥉 |
| `CoinIcon` | Currency / coins (existing component) | 💰 🪙 |
| `FlameIcon` | Day streak / fire | 🔥 |
| `PartyPopperIcon` | Celebration / giveaway win | 🎉 |
| `CrownIcon` | GOAT tag / Mythic rarity / top rank | 👑 |
| `DiamondIcon` | Legend tag / gem | 💎 |
| `StarIcon` | Legendary rarity / star rating | 🌟 |
| `BooksIcon` | Assignments / study / library | 📚 |
| `RefreshIcon` | Refresh / resync data | 🔄 ↻ |
| `TradeArrowsIcon` | Trade / exchange items | 🔄 ⇄ (trade context) |
| `InboxIcon` | Email OTP / incoming email | 📨 |
| `MailboxIcon` | Magic link sent / mail delivered | 📬 |
| `UserIcon` | Follow / person | 👤 |
| `HeartOutlineIcon` | Like (not yet liked) | ♡ |
| `HeartFilledIcon` | Like (liked) / love | ♥ ❤️ |
| `ErrorCircleIcon` | Trade declined / error | ❌ |
| `SchoolBuildingIcon` | ISD network / classroom | 🏫 |
| `HandshakeIcon` | Counselor linked / partnership | 🤝 |
| `GlobeIcon` | Global feed / network | 🌐 |
| `MuteIcon` | Muted / silenced user | 🔇 |
| `WizardIcon` | Trader NPC / the wizard | 🧙 |
| `BackpackIcon` | Inventory | 🎒 |
| `ShopIcon` | Shop / store | 🏪 |
| `SlotMachineIcon` | Spin / loot box | 🎰 |
| `BookOpenIcon` | Catalog / open book | 📖 |
| `BellIcon` | Notification / bell | 🔔 |
| `RocketIcon` | Launch / go (trailing button emoji) | 🚀 |
| `PaperclipIcon` | File attachment / upload | 📎 |
| `ArcheryBowIcon` | Host battle / battle royale | 🏹 |
| `XMarkIcon` | Close / dismiss / wrong answer | ✕ ✗ |
| `CheckIcon` | Correct / confirmed / done | ✓ |
| `SparklesIcon` | AI feature / sparkle / effects | ✨ |
| `TrendUpIcon` | GPA trending up / positive delta | ↑ |
| `TrendDownIcon` | GPA trending down / negative delta | ↓ |
| `TrendNeutralIcon` | GPA stable / neutral delta | → (trend context) |
| `ArrowRightIcon` | View all / see all / next step CTA | → (CTA context) |
| `ArrowLeftIcon` | Back navigation | ← |
| `ChevronRightIcon` | Next page / forward | → (pagination) |
| `ChevronLeftIcon` | Prev page | ← (pagination) |
| `ResetIcon` | Reset / undo / rotate | ↺ ↻ |
| `ReplyIcon` | Reply to message | ↩ |
| `SwitchArrowsIcon` | Swap / trade separator | ⇄ |
| `StatusDotGreenIcon` | Live data / connected status | 🟢 |
| `StatusDotYellowIcon` | Demo/seed data / warning status | 🟡 |
| `PaintPaletteIcon` | Name colors / color customization | 🎨 |
| `SparkleStarIcon` | Decorative sparkle / ✦ | ✦ |
| `TrashIcon` | Delete / remove | 🗑 |
| `IncomingArrowIcon` | Incoming trades | 📥 |
| `OutgoingArrowIcon` | Sent trades | 📤 |
| `MagnifyingGlassIcon` | Search / look up | 🔍 |
| `StreamingStarIcon` | Streak milestone star badge (Early Bird, 3d) | ⭐ (not in grep range — informational) |

---

## Full inventory by file

> Lines that are pure code comments (`// text → text`) or JSDoc (`* text → text`) containing arrows are omitted — they are not rendered UI.

---

### `app/Particles.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/Particles.tsx` | 30 | `→` | Code comment `// 0 → 1 (dead)` — not rendered UI | — | **OMIT** (code comment) |

---

### `app/page.tsx` (marketing / landing page)

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/page.tsx` | 200 | `→` | "Open app →" CTA span in hero button | `ArrowRightIcon` | REPLACE |
| `app/page.tsx` | 311 | `⚡` | Landing trust badge: icon slot for "Live grade sync" feature | `LightningBoltIcon` | REPLACE |
| `app/page.tsx` | 312 | `🔒` | Landing trust badge: icon slot for "Credentials encrypted" feature | `LockIcon` | REPLACE |
| `app/page.tsx` | 313 | `🤖` | Landing trust badge: icon slot for "AI knows your data" feature | `RobotIcon` | REPLACE |
| `app/page.tsx` | 314 | `🎓` | Landing trust badge: icon slot for "Free for students" feature | `GraduationCapIcon` | REPLACE |
| `app/page.tsx` | 663 | `🔥` | Feature benefit chip: "🔥 Streak bonus coins" — emoji is fused into chip label text | `FlameIcon` | **AMBIGUOUS — confirm** (marketing copy chip, emoji is part of the string) |
| `app/page.tsx` | 663 | `🎁` | Feature benefit chip: "🎁 Random item drops" — same pattern | `GiftIcon` | **AMBIGUOUS — confirm** |
| `app/page.tsx` | 663 | `🏆` | Feature benefit chip: "🏆 Streak milestones" — same pattern | `TrophyIcon` | **AMBIGUOUS — confirm** |
| `app/page.tsx` | 684 | `💰` | Feature benefit chip: "💰 Daily login coins" | `CoinIcon` | **AMBIGUOUS — confirm** |
| `app/page.tsx` | 684 | `🤝` | Feature benefit chip: "🤝 Trade rewards" | `HandshakeIcon` | **AMBIGUOUS — confirm** |
| `app/page.tsx` | 684 | `🎉` | Feature benefit chip: "🎉 Giveaway winnings" | `PartyPopperIcon` | **AMBIGUOUS — confirm** |
| `app/page.tsx` | 705 | `✨` | Feature benefit chip: "✨ Avatar effects" | `SparklesIcon` | **AMBIGUOUS — confirm** |
| `app/page.tsx` | 705 | `🏷️` | Feature benefit chip: "🏷️ Rare name colors" | `TagIcon` | **AMBIGUOUS — confirm** |
| `app/page.tsx` | 705 | `🎴` | Feature benefit chip: "🎴 Exclusive tags" — playing-card emoji used for exclusive collectible tags | `TagIcon` | **AMBIGUOUS — confirm** |
| `app/page.tsx` | 819 | `✓` | Marketing bullet copy: "✓ No setup required" — checkmark in a list of selling points | `CheckIcon` | **AMBIGUOUS — confirm** (may be intentional prose style) |
| `app/page.tsx` | 820 | `✓` | Marketing bullet copy: "✓ Works with HAC & PowerSchool" | `CheckIcon` | **AMBIGUOUS — confirm** |
| `app/page.tsx` | 821 | `✓` | Marketing bullet copy: "✓ AI advisor included" | `CheckIcon` | **AMBIGUOUS — confirm** |
| `app/page.tsx` | 822 | `✓` | Marketing bullet copy: "✓ Cancel anytime" | `CheckIcon` | **AMBIGUOUS — confirm** |

---

### `app/(app)/layout.tsx` (web app shell / sidebar)

> Note: The main sidebar NAV array already uses inline SVG icons — no emoji in nav items.

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/layout.tsx` | 191 | `🚫` | Full-screen error state icon: "Your account has been deleted" | `BanIcon` | REPLACE |

---

### `app/(app)/grades/page.tsx` (Grade Portal hub)

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/grades/page.tsx` | 11 | `📊` | Section card icon: Grades (classwork & averages) | `BarChartIcon` | REPLACE |
| `app/(app)/grades/page.tsx` | 18 | `📋` | Section card icon: Report Card | `ClipboardIcon` | REPLACE |
| `app/(app)/grades/page.tsx` | 25 | `🕐` | Section card icon: Class Schedule | `ClockIcon` | REPLACE |
| `app/(app)/grades/page.tsx` | 32 | `🧮` | Section card icon: What-If Calculator | `CalculatorIcon` | REPLACE |
| `app/(app)/grades/page.tsx` | 39 | `✉️` | Section card icon: Contact Teachers | `EnvelopeIcon` | REPLACE |
| `app/(app)/grades/page.tsx` | 46 | `📈` | Section card icon: Progress Report | `TrendingUpIcon` | REPLACE |
| `app/(app)/grades/page.tsx` | 53 | `📄` | Section card icon: Transcript | `DocumentIcon` | REPLACE |
| `app/(app)/grades/page.tsx` | 60 | `📅` | Section card icon: Attendance | `CalendarIcon` | REPLACE |

---

### `app/(app)/grades/attendance/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/grades/attendance/page.tsx` | 148 | `←` | Back button label: "← Grade Portal" | `ArrowLeftIcon` | REPLACE |
| `app/(app)/grades/attendance/page.tsx` | 179 | `←` | Pagination button: "← Prev" month | `ChevronLeftIcon` | REPLACE |
| `app/(app)/grades/attendance/page.tsx` | 186 | `→` | Pagination button: "Next →" month | `ChevronRightIcon` | REPLACE |

---

### `app/(app)/grades/progress/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/grades/progress/page.tsx` | 66 | `←` | Back button label: "← Grade Portal" | `ArrowLeftIcon` | REPLACE |

---

### `app/(app)/grades/schedule/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/grades/schedule/page.tsx` | 21–23 | `→` | JSDoc comments only (`// Course code → 1`) — not rendered | — | **OMIT** (code comments) |
| `app/(app)/grades/schedule/page.tsx` | 143 | `←` | Back button label: "← Grade Portal" | `ArrowLeftIcon` | REPLACE |

---

### `app/(app)/grades/contact/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/grades/contact/page.tsx` | 59 | `←` | Back button label: "← Grade Portal" | `ArrowLeftIcon` | REPLACE |

---

### `app/(app)/grades/what-if/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/grades/what-if/page.tsx` | 223 | `←` | Back button label: "← Grade Portal" | `ArrowLeftIcon` | REPLACE |
| `app/(app)/grades/what-if/page.tsx` | 373 | `→` | Inline data string: `${avg}% → ${gradePoints} pts` — shows grade-to-points calculation | `TrendNeutralIcon` | **AMBIGUOUS — confirm** (inline in a data display string) |

---

### `app/(app)/grades/transcript/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/grades/transcript/page.tsx` | 42 | `←` | Back button label: "← Grade Portal" | `ArrowLeftIcon` | REPLACE |

---

### `app/(app)/grades/report-card/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/grades/report-card/page.tsx` | 116 | `←` | Back button label: "← Grade Portal" | `ArrowLeftIcon` | REPLACE |

---

### `app/(app)/grades/classwork/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/grades/classwork/page.tsx` | 32, 34 | `→` | Code comment logic (`// "(All Runs)" → "All Periods"`) — not rendered | — | **OMIT** (code comments) |
| `app/(app)/grades/classwork/page.tsx` | 113 | `←` | Back button label: "← Grade Portal" | `ArrowLeftIcon` | REPLACE |

---

### `app/(app)/grades/classlink/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/grades/classlink/page.tsx` | 207 | `✓` | Success state icon inside a styled box: "Connected to {districtName}" | `CheckIcon` | REPLACE |

---

### `app/(app)/grades/canvas/page.tsx` (Canvas LMS integration page)

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/grades/canvas/page.tsx` | 70 | `📄` | `fileIcon()` helper — file type: PDF | `DocumentIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 71 | `🖼️` | `fileIcon()` helper — file type: image | `ImageIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 72 | `🎬` | `fileIcon()` helper — file type: video | `VideoIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 73 | `🎵` | `fileIcon()` helper — file type: audio | `AudioIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 74 | `🗜️` | `fileIcon()` helper — file type: zip/compressed | `ArchiveIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 75 | `📝` | `fileIcon()` helper — file type: Word/document | `PencilIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 76 | `📊` | `fileIcon()` helper — file type: spreadsheet/Excel | `BarChartIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 77 | `📊` | `fileIcon()` helper — file type: presentation/PowerPoint | `BarChartIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 78 | `📁` | `fileIcon()` helper — file type: generic fallback | `FolderIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 83 | `✏️` | `moduleItemIcon()` — module item type: Assignment | `PencilIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 84 | `❓` | `moduleItemIcon()` — module item type: Quiz | `QuestionMarkIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 85 | `💬` | `moduleItemIcon()` — module item type: Discussion | `ChatBubbleIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 86 | `📄` | `moduleItemIcon()` — module item type: File | `DocumentIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 87 | `📃` | `moduleItemIcon()` — module item type: Page | `DocumentIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 88 | `🔗` | `moduleItemIcon()` — module item type: ExternalUrl | `LinkIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 89 | `🔧` | `moduleItemIcon()` — module item type: ExternalTool | `WrenchIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 278 | `↩` | Button label: "↩ Reply" toggle in discussion thread | `ReplyIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 399 | `✏️` | Button label: "✏️ Post Reply" action in discussion | `PencilIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 705 | `📝` | Empty state icon (large): no submission / write assignment prompt | `PencilIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 729 | `⚠️` | Error/warning state icon: Canvas content load error | `WarningIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 739 | `✅` | Success state icon: submission completed successfully | `CheckCircleIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 805 | `✓` / `✗` | Quiz answer result indicators: "✓ +N pts" or "✗ 0" | `CheckIcon` / `XMarkIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 891 | `🔒` | Locked content state icon: quiz/assignment locked | `LockIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 1048 | `✓` | Toast feedback string: "✓ Submitted successfully!" | `CheckIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 1240 | `✏️` | Button label: "✏️ Submit Assignment" | `PencilIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 1246 | `📎` | Button label: "📎 Upload File in Canvas" | `PaperclipIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 1594 | `🔒` | File list item: locked file indicator (conditionally shown) | `LockIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 1748 | `🎓` | Section decorative icon: GPA / student profile section | `GraduationCapIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 1907 | `🎓` | Empty state icon (large): Canvas not connected — "Go to Settings → Connect Canvas" | `GraduationCapIcon` | REPLACE |
| `app/(app)/grades/canvas/page.tsx` | 1913 | `→` | Instructional text: "Go to Settings → Connect Canvas" | — | **AMBIGUOUS — confirm** (navigation instruction copy) |

---

### `app/(app)/settings/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/settings/page.tsx` | 667 | `→` | Instructional text: "Canvas → Profile → Settings → Approved Integrations" | — | **AMBIGUOUS — confirm** (step-by-step guide copy) |
| `app/(app)/settings/page.tsx` | 752 | `✓` | Inline confirmation text: "✓ Canvas connected" | `CheckIcon` | REPLACE |
| `app/(app)/settings/page.tsx` | 842 | `🌙` | Theme toggle button label: dark mode active | `MoonIcon` | REPLACE |
| `app/(app)/settings/page.tsx` | 842 | `☀️` | Theme toggle button label: light mode active | `SunIcon` | REPLACE |

---

### `app/(app)/planner/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/planner/page.tsx` | 336 | `→` | Instructional text: "Canvas → Profile → Settings → Approved Integrations" | — | **AMBIGUOUS — confirm** (guide copy) |
| `app/(app)/planner/page.tsx` | 440 | `✓` | Completed task indicator span: green checkmark next to task | `CheckIcon` | REPLACE |
| `app/(app)/planner/page.tsx` | 558 | `✨` | Button icon: AI Study Plan feature button leading icon | `SparklesIcon` | REPLACE |
| `app/(app)/planner/page.tsx` | 635 | `✕` | Error message dismiss button (close × button) | `XMarkIcon` | REPLACE |
| `app/(app)/planner/page.tsx` | 701 | `✓` | Empty state icon (styled div): all tasks complete | `CheckIcon` | REPLACE |
| `app/(app)/planner/page.tsx` | 709 | `✓` | Empty state icon (circle div): all done confirmation | `CheckIcon` | REPLACE |

---

### `app/(app)/colleges/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/colleges/page.tsx` | 372 | `🎓` | Empty state icon: college search empty / connect prompt | `GraduationCapIcon` | REPLACE |

---

### `app/(app)/dashboard/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/dashboard/page.tsx` | 15 | `📊` | Quick access link icon: Grades | `BarChartIcon` | REPLACE |
| `app/(app)/dashboard/page.tsx` | 16 | `📄` | Quick access link icon: Transcript | `DocumentIcon` | REPLACE |
| `app/(app)/dashboard/page.tsx` | 17 | `📅` | Quick access link icon: Attendance | `CalendarIcon` | REPLACE |
| `app/(app)/dashboard/page.tsx` | 18 | `📋` | Quick access link icon: Report Card | `ClipboardIcon` | REPLACE |
| `app/(app)/dashboard/page.tsx` | 73 | `✅` | `STREAK_MILESTONES` data: emoji icon for "Novice" (7-day) streak tier | `CheckCircleIcon` | REPLACE |
| `app/(app)/dashboard/page.tsx` | 74 | `⚡` | `STREAK_MILESTONES` data: emoji icon for "Pro" (14-day) streak tier | `LightningBoltIcon` | REPLACE |
| `app/(app)/dashboard/page.tsx` | 75 | `🏅` | `STREAK_MILESTONES` data: emoji icon for "Veteran" (30-day) streak tier | `MedalIcon` | REPLACE |
| `app/(app)/dashboard/page.tsx` | 76 | `💎` | `STREAK_MILESTONES` data: emoji icon for "Legend" (50-day) streak tier | `DiamondIcon` | REPLACE |
| `app/(app)/dashboard/page.tsx` | 77 | `👑` | `STREAK_MILESTONES` data: emoji icon for "GOAT" (100-day) streak tier | `CrownIcon` | REPLACE |
| `app/(app)/dashboard/page.tsx` | 239 | `🚀` | Button trailing text: "Let's go! 🚀" in streak milestone popup | `RocketIcon` | **AMBIGUOUS — confirm** (trailing emoji in button copy) |
| `app/(app)/dashboard/page.tsx` | 403 | `✓` | Inline text: "All clear for today ✓" in planner section | `CheckIcon` | **AMBIGUOUS — confirm** (trailing confirmation in body text) |
| `app/(app)/dashboard/page.tsx` | 435 | `🔥` | Stat card label: "Day Streak 🔥" — trailing decorative emoji in label string | `FlameIcon` | **AMBIGUOUS — confirm** (inline in label string) |
| `app/(app)/dashboard/page.tsx` | 436 | `✦` | Conditional suffix in coin display: `+N today ✦` (when GPA bonus active) — decorative sparkle | `SparkleStarIcon` | **AMBIGUOUS — confirm** (inline in formatted text string) |
| `app/(app)/dashboard/page.tsx` | 439 | `👑` | "All streak rewards earned" display: GOAT crown | `CrownIcon` | REPLACE |
| `app/(app)/dashboard/page.tsx` | 440 | `→` | Inline data string: "Next: Nd → {tag}" showing next streak milestone | `ArrowRightIcon` | **AMBIGUOUS — confirm** (inline in data label) |
| `app/(app)/dashboard/page.tsx` | 501 | `🚀` | Button trailing text: "Let's go! 🚀" | `RocketIcon` | **AMBIGUOUS — confirm** |
| `app/(app)/dashboard/page.tsx` | 513 | `🔥` | Streak popup header icon (large, 40px, standalone div) | `FlameIcon` | REPLACE |
| `app/(app)/dashboard/page.tsx` | 534 | `📚` | Inline text in notification panel: "📚 Raise your GPA to unlock..." | `BooksIcon` | **AMBIGUOUS — confirm** (lead icon in inline body text) |
| `app/(app)/dashboard/page.tsx` | 544 | `🎉` | Inline text in tag-earned notification: "🎉 You just earned: {tag}!" | `PartyPopperIcon` | **AMBIGUOUS — confirm** (lead icon in inline body text) |
| `app/(app)/dashboard/page.tsx` | 561 | `🔒` | Locked milestone icon: `{earned ? m.emoji : '🔒'}` — shown when milestone not yet earned | `LockIcon` | REPLACE |
| `app/(app)/dashboard/page.tsx` | 603 | `🎓` | GPA Rank popup header icon (large, 48px, standalone div) | `GraduationCapIcon` | REPLACE |
| `app/(app)/dashboard/page.tsx` | 634 | `→` | Instructional text in GPA popup: "Perfect GPA (4.0/5.0) → +50% on daily coins" | — | **AMBIGUOUS — confirm** (mathematical/explanatory prose) |
| `app/(app)/dashboard/page.tsx` | 640 | `🚀` | Button trailing text: "Got it! 🚀" | `RocketIcon` | **AMBIGUOUS — confirm** |
| `app/(app)/dashboard/page.tsx` | 652 | `🔗` | Resync popup icon: needs-reconnect state | `LinkIcon` | REPLACE |
| `app/(app)/dashboard/page.tsx` | 652 | `🔄` | Resync popup icon: data-reload state (HAC session expired) | `RefreshIcon` | REPLACE |
| `app/(app)/dashboard/page.tsx` | 695 | `🎓` | GPA card section icon (large, 40px, standalone div) | `GraduationCapIcon` | REPLACE |

---

### `app/(app)/battle/[code]/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/battle/[code]/page.tsx` | 235 | `→` | Code comment: `// phase → battle` — not rendered | — | **OMIT** (code comment) |
| `app/(app)/battle/[code]/page.tsx` | 298 | `💀` | Game-over state icon (large, 56px): player lost | `SkullIcon` | REPLACE |
| `app/(app)/battle/[code]/page.tsx` | 309 | `🏆` | Win state icon (large, 56px): player won | `TrophyIcon` | REPLACE |
| `app/(app)/battle/[code]/page.tsx` | 320 | `🎮` | Lobby/waiting state icon (40px): game starting | `GamepadIcon` | REPLACE |
| `app/(app)/battle/[code]/page.tsx` | 404 | `⚡` | In-game prompt label: "⚡ ANSWER FOR +5 AMMO" — action incentive indicator | `LightningBoltIcon` | REPLACE |
| `app/(app)/battle/[code]/page.tsx` | 408 | `✓` / `✗` | Quiz feedback: "✓ Correct! +5 ammo" or "✗ Wrong!" | `CheckIcon` / `XMarkIcon` | REPLACE |
| `app/(app)/battle/[code]/page.tsx` | 436 | `🎯` | Game targeting phase icon (32px): aim/shooting mechanic | `TargetIcon` | REPLACE |
| `app/(app)/battle/[code]/page.tsx` | 899 | `→` | Code comment: `// 0→0.3, 0.3→1.0` — not rendered | — | **OMIT** (code comment) |

---

### `app/(app)/marketplace/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/marketplace/page.tsx` | 121 | `💀` | Dev/loading error fallback (38px): item data failed to load | `SkullIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 191 | `🎁` | Loot box type label: "Cosmetics Spin" icon field in box definition | `GiftIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 202 | `💀` | Loot box type label: "The Curse" box icon | `SkullIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 238 | `✓` | Item rarity label: "Verified ✓ Yellow (Mythic)" — checkmark is part of item display name | — | **AMBIGUOUS — confirm** (part of a cosmetic item's own name, not a UI indicator) |
| `app/(app)/marketplace/page.tsx` | 239 | `✓` | Item rarity label: "Partner ✓ Blue (Mythic)" — same | — | **AMBIGUOUS — confirm** |
| `app/(app)/marketplace/page.tsx` | 268 | `✨` | Item label: "Rainbow RGB ✨ (Mythic)" — sparkle is part of item display name | — | **AMBIGUOUS — confirm** (part of cosmetic item's own name) |
| `app/(app)/marketplace/page.tsx` | 296 | `✨` | Item label: "Rainbow Animated ✨ (Mythic)" — same | — | **AMBIGUOUS — confirm** |
| `app/(app)/marketplace/page.tsx` | 373 | `✓` | Item rarity label: "Verified ✓ Yellow" — same as above | — | **AMBIGUOUS — confirm** |
| `app/(app)/marketplace/page.tsx` | 374 | `✨` | Item label: "Rainbow RGB ✨ (Mythic)" — same | — | **AMBIGUOUS — confirm** |
| `app/(app)/marketplace/page.tsx` | 375 | `✨` | Item label: "Rainbow Animated ✨ (Mythic)" — same | — | **AMBIGUOUS — confirm** |
| `app/(app)/marketplace/page.tsx` | 489 | `✨` | Item name field: "Rainbow RGB ✨" — same | — | **AMBIGUOUS — confirm** |
| `app/(app)/marketplace/page.tsx` | 516 | `✨` | Item name field: "Rainbow Animated ✨" — same | — | **AMBIGUOUS — confirm** |
| `app/(app)/marketplace/page.tsx` | 623 | `🏷️` | Item type icon function: type === 'tag' → tag icon | `TagIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 634 | `📦` | Item type icon function: generic fallback | `PackageIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 745 | `✕` | Modal close button (×) | `XMarkIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 752 | `📈` | Item detail tab label: "📈 Price History" — inline in tab string | `TrendingUpIcon` | **AMBIGUOUS — confirm** (inline tab label with fused emoji+text) |
| `app/(app)/marketplace/page.tsx` | 752 | `👥` | Item detail tab label: "👥 Owners (N)" — inline in tab string | `UsersIcon` | **AMBIGUOUS — confirm** |
| `app/(app)/marketplace/page.tsx` | 777 | `🥇` | Leaderboard rank badge: rank === 1 shows 🥇 else `#N` | `GoldMedalIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 866 | `✨` | Spin result summary prefix text: "✨ N of M highlights · X coins left" | `SparklesIcon` | **AMBIGUOUS — confirm** (lead emoji in inline summary text) |
| `app/(app)/marketplace/page.tsx` | 867 | `✨` | Spin result summary prefix text: "✨ Best result · X coins left" | `SparklesIcon` | **AMBIGUOUS — confirm** |
| `app/(app)/marketplace/page.tsx` | 884 | `✦` | Avatar preview card decoration (standalone div): sparkle/shine effect | `SparkleStarIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 895 | `←` | Carousel prev button: "← Prev" | `ChevronLeftIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 899 | `→` | Carousel next button: "Next →" | `ChevronRightIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 912 | `🎰` | Spin summary dialog header: "🎰 N Spins — Summary" inline string | `SlotMachineIcon` | **AMBIGUOUS — confirm** (inline in header string) |
| `app/(app)/marketplace/page.tsx` | 919 | `✨` | Spin highlight count prefix in summary: inline string | `SparklesIcon` | **AMBIGUOUS — confirm** |
| `app/(app)/marketplace/page.tsx` | 1023 | `🎰` | Spin dialog header: "🎰 Free Spin" | `SlotMachineIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 1232 | `✦` | Avatar preview default: standalone ✦ character in avatar circle div | `SparkleStarIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 1293 | `👑` | Unbox celebration emoji: Mythic rarity | `CrownIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 1293 | `🌟` | Unbox celebration emoji: Legendary rarity | `StarIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 1293 | `🎉` | Unbox celebration emoji: other rarity | `PartyPopperIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2112 | `✓` | Dev panel feedback string: "✓ Granted N coins" | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2117 | `✓` | Dev panel feedback string: "✓ Granted tag: ..." | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2119 | `✓` | Dev panel feedback string: "✓ Granted: ..." | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2133 | `✓` | Toast message: "✓ Purchased!" | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2154 | `✓` | Toast message: "✓ Listed!" | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2226 | `🪙` | Toast warning string: "Need 🪙 5 to send a trade" — coin icon inline in message text | `CoinIcon` | **AMBIGUOUS — confirm** (inline in error message string) |
| `app/(app)/marketplace/page.tsx` | 2236 | `✓` | Toast message: "✓ Trade sent!" | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2250 | `✓` | Toast message: "✓ Trade accepted!" | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2263 | `✓` | Toast message: "✓ Declined, items returned to sender" | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2275 | `✓` | Toast message: "✓ Cancelled, items returned to you" | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2433 | `✕` | Item selection remove button (×) | `XMarkIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2454 | `🏷️` | Item type inline indicator: tag | `TagIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2454 | `🎨` | Item type inline indicator: name-color | `PaintPaletteIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2454 | `🖼️` | Item type inline indicator: avatar effect | `ImageIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2493 | `🚫` | Access gate state (52px): marketplace access blocked | `BanIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2513 | `🔒` | Locked state (52px): marketplace streak gate not yet unlocked | `LockIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2520 | `🔥` | Streak display: "🔥 Current streak: N / 3 days" | `FlameIcon` | **AMBIGUOUS — confirm** (lead emoji in inline text) |
| `app/(app)/marketplace/page.tsx` | 2554 | `✓` | Confirmation div icon | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2587 | `🎰` | Free spin button label when not on cooldown: "🎰 Free Spin" | `SlotMachineIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2599 | `📊` | Spin Stats button label: "📊 Spin Stats" | `BarChartIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2617 | `🎰` | Tab label: "🎰 Spins" | `SlotMachineIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2618 | `🏪` | Tab label: "🏪 Shop" | `ShopIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2620 | `🔄` | Tab label: "🔄 Trade" | `TradeArrowsIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2624 | `🧙` | Tab label: "🧙 Trader" | `WizardIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2625 | `🎒` | Tab label: "🎒 Inventory" | `BackpackIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2626 | `🏆` | Tab label: "🏆 Leaderboard" | `TrophyIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2627 | `📖` | Tab label: "📖 Catalog" | `BookOpenIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2640 | `👑` | Rarity indicator: Mythic item celebration | `CrownIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2640 | `🌟` | Rarity indicator: Legendary item celebration | `StarIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2658 | `✦` | Avatar preview card decoration (standalone div) | `SparkleStarIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2708 | `✨` | Description suffix: "Here's a preview of your new item ✨" | `SparklesIcon` | **AMBIGUOUS — confirm** (trailing emoji in descriptive copy) |
| `app/(app)/marketplace/page.tsx` | 2803 | `🏪` | Sub-tab label: "🏪 Browse" | `ShopIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2803 | `📋` | Sub-tab label: "📋 My Listings (N)" | `ClipboardIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2816 | `↻` | Refresh button label: "↻ Refresh" | `RefreshIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2860 | `✓` | Toast indicator: message starts with ✓ = success color | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2888 | `↻` | Refresh button: "↻ Refresh" | `RefreshIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2939 | `📥` | Trade sub-tab label: "📥 Incoming (N)" | `IncomingArrowIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2940 | `📤` | Trade sub-tab label: "📤 Sent" | `OutgoingArrowIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 2941 | `📋` | Trade sub-tab label: "📋 History" | `ClipboardIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3062 | `✕` | Selected item count remove button: "Nselect count ✕" | `XMarkIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3130 | `🏷️` | Trade offer section label: "🏷️ Tags" | `TagIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3132 | `🎨` | Trade offer section label: "🎨 Colors" | `PaintPaletteIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3134 | `🖼️` | Trade offer section label: "🖼️ Avatar" | `ImageIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3161 | `🏷️` | My trade offer section label: "🏷️ Tags" | `TagIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3163 | `🎨` | My trade offer section label: "🎨 Colors" | `PaintPaletteIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3165 | `🖼️` | My trade offer section label: "🖼️ Avatar" | `ImageIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3187 | `⇄` | Trade card separator icon (standalone span, 18px) | `SwitchArrowsIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3211 | `⚠️` | Trade warning text: "⚠️ You're offering nothing — this is a gift request" | `WarningIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3216 | `⚠️` | Trade warning text: "⚠️ You're asking for nothing — this is a free gift" | `WarningIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3256 | `⇄` | Trade history card separator icon (standalone div, 16px) | `SwitchArrowsIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3264 | `💬` | Trade message/note indicator (span, opacity 0.6) | `ChatBubbleIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3274 | `✓` | Accept trade button label: "✓ Accept" | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3278 | `✕` | Decline trade button label: "✕ Decline" | `XMarkIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3319 | `⇄` | Sent trade card separator icon (div, 16px) | `SwitchArrowsIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3327 | `💬` | Sent trade message indicator | `ChatBubbleIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3332 | `✓` | Toast message start (success colour trigger) | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3365 | `✅` | Completed trade badge: `isTraderTrade ? '🏕️' : '✅'` — standard accepted trade | `CheckCircleIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3368 | `⇄` | History trade card separator (span) | `SwitchArrowsIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3380 | `⇄` | History trade card separator (div, 16px) | `SwitchArrowsIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3388 | `💬` | Trade history message indicator | `ChatBubbleIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3406 | `✓` | Listing feedback indicator (success/error colour trigger) | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3426 | `💰` | Wallet balance section header icon (28px) | `CoinIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3453 | `🏅` | Inventory section header: "🏅 Badges" | `MedalIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3471 | `🏷️` | Inventory section header: "🏷️ Tags" | `TagIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3485 | `🎨` | Inventory section header: "🎨 Name Colors" | `PaintPaletteIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3499 | `🖼️` | Inventory section header: "🖼️ Avatar Effects" | `ImageIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3521 | `🧙` | Trader NPC section icon (48px, standalone div) | `WizardIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3550 | `💰` | Trader mode tab label: "💰 Sell" | `CoinIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3550 | `🛒` | Trader mode tab label: "🛒 Buy" | `ShopIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3550 | `🔄` | Trader mode tab label: "🔄 Trade" | `TradeArrowsIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3556 | `✓` | Trader feedback (success colour trigger) | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3639 | `✕` | Remove item from offer button (10px, opacity 0.7) | `XMarkIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3682 | `✕` | Remove item from want list button | `XMarkIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3718 | `✓` | Deal confirmation indicator: "✓ Deal accepted" | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3718 | `↑` | Offer shortfall hint: "↑ Need N more coins value" | `TrendUpIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3739 | `✓` | Toast: "✓ Trade complete! N trades left today." | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3749 | `🔄` | Confirm trade button label: "🔄 Confirm Trade" | `TradeArrowsIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3763 | `💰` | Leaderboard sub-tab: "💰 Richest" | `CoinIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3763 | `🔥` | Leaderboard sub-tab: "🔥 Streak" | `FlameIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3763 | `💼` | Leaderboard sub-tab: "💼 Inventory" — briefcase icon for inventory value | `BackpackIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3783 | `🥇` | Leaderboard rank badge: position 1 | `GoldMedalIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3783 | `🥈` | Leaderboard rank badge: position 2 | `SilverMedalIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3783 | `🥉` | Leaderboard rank badge: position 3 | `BronzeMedalIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3809 | `🔥` | Streak leaderboard entry value: "🔥 N" | `FlameIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3825 | `🏅` | Catalog filter tab: "🏅 Badges" | `MedalIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3826 | `🏷️` | Catalog filter tab: "🏷️ Tags" | `TagIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3827 | `🎨` | Catalog filter tab: "🎨 Name Colors" | `PaintPaletteIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3828 | `🖼️` | Catalog filter tab: "🖼️ Avatar Effects" | `ImageIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 3882 | `→` | Catalog item row chevron (standalone span, 11px, muted) | `ChevronRightIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4016 | `🪙` | "Send Coins" section label: "🪙 Send Coins" | `CoinIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4035 | `✓` | Toast: "✓ Sent N coins (−N tax)" | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4094 | `♡` | Post like count: "♡ N" (heart outline) | `HeartOutlineIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4109 | `🔧` | DEV panel header: "🔧 DEV Panel — Grant to Self" | `WrenchIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4114 | `🔍` | DEV user lookup section: "🔍 Look Up User by ID" | `MagnifyingGlassIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4159 | `✓` | Dev user lookup result: "Market Access: ✓ Yes" | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4160 | `🚫` | Dev user data: "Market Banned: 🚫 Yes" | `BanIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4161 | `🚫` | Dev user data: "Chat Banned: 🚫 Yes" | `BanIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4161 | `✓` | Dev user data: "Chat Banned: ✓ No" (positive state) | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4220 | `✓` | Dev feedback indicator (colour trigger) | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4224 | `🔓` | DEV panel section: "🔓 Grant Market Access" | `LockOpenIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4241 | `✓` | Toast: "✓ Market access granted to user N" | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4255 | `🚫` | DEV panel section: "🚫 Revoke / Restore Market Access" | `BanIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4272 | `✓` | Toast: "✓ Market access revoked" | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4288 | `✓` | Toast: "✓ Market access restored" | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4302 | `🎰` | DEV panel section: "🎰 Simulate Unlock" | `SlotMachineIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4345 | `🧙` | Trader empty state icon (36px): NPC wizard | `WizardIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4363 | `✓` | Toast: "✓ Sold! You received N coins." | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4388 | `🧙` | Trader buy confirmation icon (36px) | `WizardIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4409 | `✓` | Toast: "✓ Purchased {name} for N coins!" | `CheckIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4467 | `⚠️` | Warning dialog header icon (36px): duplicate items | `WarningIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4522 | `⚠️` | Warning text: "⚠️ Some duplicates are Legendary or Mythic" | `WarningIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4532 | `🏷️` | Duplicate item type inline indicator: tag | `TagIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4532 | `🎨` | Duplicate item type inline indicator: name-color | `PaintPaletteIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4532 | `🖼️` | Duplicate item type inline indicator: avatar | `ImageIcon` | REPLACE |
| `app/(app)/marketplace/page.tsx` | 4600 | `📊` | Spin Stats dialog header: "📊 Spin Stats" | `BarChartIcon` | REPLACE |

---

### `app/(app)/classroom/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/classroom/page.tsx` | 80 | `✓` / `✗` | Join classroom feedback: "✓ " or "✗ " prefix on result message | `CheckIcon` / `XMarkIcon` | REPLACE |

---

### `app/(app)/classroom/[classroomId]/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/classroom/[classroomId]/page.tsx` | 90 | `←` | Back link: "← Back" | `ArrowLeftIcon` | REPLACE |

---

### `app/(app)/feed/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/feed/page.tsx` | 185 | `👤` | Notification type icon: FOLLOW | `UserIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 186 | `❤️` | Notification type icon: LIKE | `HeartFilledIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 187 | `🎉` | Notification type icon: GIVEAWAY_WIN | `PartyPopperIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 188 | `🏷️` | Notification type icon: LISTING_SOLD | `TagIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 189 | `🔄` | Notification type icon: TRADE_OFFER / TRADE_ACCEPTED / TRADE_DECLINED | `TradeArrowsIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 190 | `📚` | Notification type icon: ASSIGNMENT_CREATED | `BooksIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 191 | `💬` | Notification type icon: fallback / comment | `ChatBubbleIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 325 | `🪙` | "Send Coins" section label: "🪙 Send Coins" | `CoinIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 344 | `✓` | Toast: "✓ Sent N coins (−N tax)" | `CheckIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 358 | `✓` | Toast feedback colour trigger | `CheckIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 396 | `♥` / `♡` | Post like toggle button: filled ♥ if liked, outline ♡ if not | `HeartFilledIcon` / `HeartOutlineIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 399 | `→` | Post preview link: "View full post & comments →" | `ArrowRightIcon` | **AMBIGUOUS — confirm** (inline in link text) |
| `app/(app)/feed/page.tsx` | 508 | `🏫` | ISD network badge: "🏫 ISD" label chip | `SchoolBuildingIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 528 | `👑` | Unbox announcement: Mythic rarity (span, 20px) | `CrownIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 528 | `🌟` | Unbox announcement: Legendary rarity (span, 20px) | `StarIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 576 | `💰` | Coins transfer post icon (span, 13px) | `CoinIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 590 | `🎁` | Giveaway post type icon (span, 16px) | `GiftIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 629 | `✨` | Description suffix: "Preview of the ... ✨" | `SparklesIcon` | **AMBIGUOUS — confirm** (trailing emoji in descriptive text) |
| `app/(app)/feed/page.tsx` | 643 | `🏆` | Giveaway leaderboard/winner section icon (span, 18px) | `TrophyIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 682 | `✓` | Giveaway entry confirmation: "✓ Entered" badge | `CheckIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 697 | `♥` | Giveaway requirement text: "♥ You must like this post to enter" | `HeartFilledIcon` | **AMBIGUOUS — confirm** (inline in instructional copy) |
| `app/(app)/feed/page.tsx` | 702 | `🚫` | Giveaway blocked state icon (36px) | `BanIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 843 | `♥` / `♡` | Post like button in feed card | `HeartFilledIcon` / `HeartOutlineIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 872 | `♥` / `♡` | Comment like button | `HeartFilledIcon` / `HeartOutlineIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 1021 | `♥` / `♡` | Comment like count in expanded view | `HeartFilledIcon` / `HeartOutlineIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 1029 | `🔇` | Muted user content section icon (span, 18px) | `MuteIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 1041 | `🚫` | Blocked user content section icon (span, 16px) | `BanIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 1431 | `🚫` | Feed access blocked full-screen icon (48px) | `BanIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 1493 | `🌐` | Network toggle: "🌐 Global" | `GlobeIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 1493 | `🏫` | Network toggle: "🏫 ISD" | `SchoolBuildingIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 1502 | `🔇` | Muted section header icon (span, 22px) | `MuteIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 1522 | `🚫` | Blocked section icon (span, 18px) | `BanIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 1539 | `🎁` | Create giveaway button label: "🎁 Giveaway" | `GiftIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 1553 | `🎁` | Create giveaway label: "🎁 Create Giveaway" (span) | `GiftIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 1558 | `🏷️` | Giveaway type picker: tag option label | `TagIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 1558 | `🎨` | Giveaway type picker: name-color option label | `PaintPaletteIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 1558 | `🖼️` | Giveaway type picker: avatar option label | `ImageIcon` | REPLACE |
| `app/(app)/feed/page.tsx` | 1673 | `🏫` | School/ISD modal state icon (40px) | `SchoolBuildingIcon` | REPLACE |

---

### `app/(app)/sets/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/sets/page.tsx` | 109 | `🏹` | "Host battle royale" action button icon (standalone, no text) | `ArcheryBowIcon` | REPLACE |

---

### `app/(app)/sets/[id]/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/sets/[id]/page.tsx` | 162 | `←` | Back link: "← Back" | `ArrowLeftIcon` | REPLACE |
| `app/(app)/sets/[id]/page.tsx` | 187 | `🏹` | Host battle button label: "🏹 Host Battle" / "🏹 Starting…" | `ArcheryBowIcon` | REPLACE |

---

### `app/(app)/play/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/play/page.tsx` | 73 | `→` | Browse sets CTA: "Browse Study Sets →" | `ArrowRightIcon` | REPLACE |

---

### `app/(app)/play/[code]/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/play/[code]/page.tsx` | 68 | `🥇` / `🥈` / `🥉` | Player rank badges: positions 1, 2, 3 | `GoldMedalIcon` / `SilverMedalIcon` / `BronzeMedalIcon` | REPLACE |
| `app/(app)/play/[code]/page.tsx` | 307 | `←` | Back link: "← Back to Play" | `ArrowLeftIcon` | REPLACE |
| `app/(app)/play/[code]/page.tsx` | 397 | `✓` / `✗` | Quiz answer feedback: "✓ Correct!" or "✗ Wrong" | `CheckIcon` / `XMarkIcon` | REPLACE |
| `app/(app)/play/[code]/page.tsx` | 458 | `→` | Next question button label: "Next Question →" | `ChevronRightIcon` | REPLACE |
| `app/(app)/play/[code]/page.tsx` | 477 | `🏆` | Game results screen icon (48px, standalone div) | `TrophyIcon` | REPLACE |

---

### `app/(app)/my-counselor/[counselorId]/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/my-counselor/[counselorId]/page.tsx` | 215 | `⚠` | Overdue action item indicator inline: `{overdue ? '⚠ Overdue · ' : ''}Due {date}` | `WarningIcon` | REPLACE |

---

### `app/(app)/ai/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/(app)/ai/page.tsx` | 74 | `→` | Code comment only: `// mount→unmount→remount` — not rendered | — | **OMIT** (code comment) |

---

### `app/counselor/dashboard/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/counselor/dashboard/page.tsx` | 225 | `✓` | Inline confirmation: "✓ {student name} — HAC: {username}" after student selection | `CheckIcon` | REPLACE |

---

### `app/reset-password/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/reset-password/page.tsx` | 37 | `🔗` | Reset password link-sent state icon (44px) | `LinkIcon` | REPLACE |
| `app/reset-password/page.tsx` | 52 | `✅` | Reset password success state icon (44px) | `CheckCircleIcon` | REPLACE |
| `app/reset-password/page.tsx` | 109 | `✓` / `○` | Password requirement row: met (✓) or not yet met (○) | `CheckIcon` / — | REPLACE |

---

### `app/login/page.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/login/page.tsx` | 328 | `📨` | Email OTP entry state icon (36px): "Check your email" | `InboxIcon` | REPLACE |
| `app/login/page.tsx` | 346 | `←` | Back button: "← Back / change email" | `ArrowLeftIcon` | REPLACE |
| `app/login/page.tsx` | 454 | `⚠` | Inline error message: "⚠ {hacError} — you can reconnect later in Settings." | `WarningIcon` | REPLACE |
| `app/login/page.tsx` | 573 | `✕` | Modal close button: forgot-password modal | `XMarkIcon` | REPLACE |
| `app/login/page.tsx` | 578 | `📬` | Magic link sent state icon (44px) | `MailboxIcon` | REPLACE |
| `app/login/page.tsx` | 621 | `✕` | Modal close button: privacy policy modal | `XMarkIcon` | REPLACE |
| `app/login/page.tsx` | 677 | `→` | Instructional text: "Settings → Account" navigation guidance | — | **AMBIGUOUS — confirm** (instructional copy) |
| `app/login/page.tsx` | 755 | `→` | Instructional text: "Settings → Account or contacting us" | — | **AMBIGUOUS — confirm** (instructional copy) |

---

### `app/teacher/layout.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `app/teacher/layout.tsx` | 83 | `✓` | Feature checklist item: styled checkmark before each item in a list | `CheckIcon` | REPLACE |

---

### `components/ui/UserProfileModal.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `components/ui/UserProfileModal.tsx` | 232 | `♥` / `♡` | Post like count: "♥ N" if liked, "♡ N" if not | `HeartFilledIcon` / `HeartOutlineIcon` | REPLACE |
| `components/ui/UserProfileModal.tsx` | 235 | `→` | Profile link text: "View full post & comments →" | `ArrowRightIcon` | **AMBIGUOUS — confirm** (inline in link text) |

---

### `components/ui/LagDetector.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `components/ui/LagDetector.tsx` | 74 | `⚡` | Lag warning banner header: "⚡ Experiencing lag?" — lead icon in heading | `LightningBoltIcon` | REPLACE |
| `components/ui/LagDetector.tsx` | 77 | `→` | Instructional text: "turn them off in Settings → Appearance" | — | **AMBIGUOUS — confirm** (instructional copy) |

---

### `components/ui/UpdateBanner.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `components/ui/UpdateBanner.tsx` | 55 | `✕` | Banner dismiss button (×) | `XMarkIcon` | REPLACE |

---

### `components/ui/NotificationBell.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `components/ui/NotificationBell.tsx` | 193 | `👤` | Notification icon mapper: FOLLOW | `UserIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 193 | `❤️` | Notification icon mapper: LIKE | `HeartFilledIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 193 | `🎉` | Notification icon mapper: GIVEAWAY_WIN | `PartyPopperIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 193 | `🏷️` | Notification icon mapper: LISTING_SOLD | `TagIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 193 | `🔄` | Notification icon mapper: TRADE_* | `TradeArrowsIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 193 | `📚` | Notification icon mapper: ASSIGNMENT_CREATED | `BooksIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 193 | `📋` | Notification icon mapper: TEACHER_ASSIGNMENT | `ClipboardIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 193 | `🏫` | Notification icon mapper: CLASSROOM_JOINED | `SchoolBuildingIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 193 | `🤝` | Notification icon mapper: COUNSELOR_LINKED | `HandshakeIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 193 | `📝` | Notification icon mapper: COUNSELOR_NOTE_ADDED | `PencilIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 193 | `✨` | Notification icon mapper: COUNSELOR_RECOMMENDATION_ADDED | `SparklesIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 193 | `✅` | Notification icon mapper: ACTION_ITEM_CREATED | `CheckCircleIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 193 | `🪙` | Notification icon mapper: COIN_RECEIVED | `CoinIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 193 | `💬` | Notification icon mapper: default / comment | `ChatBubbleIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 263 | `❤️` | Notification object builder: LIKE type | `HeartFilledIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 264 | `💬` | Notification object builder: COMMENT type | `ChatBubbleIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 265 | `👤` | Notification object builder: FOLLOW type | `UserIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 266 | `🎉` | Notification object builder: GIVEAWAY_WIN type | `PartyPopperIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 267 | `🔄` | Notification object builder: TRADE_OFFER type | `TradeArrowsIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 268 | `✅` | Notification object builder: TRADE_ACCEPTED type | `CheckCircleIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 269 | `❌` | Notification object builder: TRADE_DECLINED type | `ErrorCircleIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 270 | `💰` | Notification object builder: LISTING_SOLD type | `CoinIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 271 | `🪙` | Notification object builder: COIN_RECEIVED type | `CoinIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 272 | `📚` | Notification object builder: ASSIGNMENT_CREATED type | `BooksIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 273 | `📋` | Notification object builder: TEACHER_ASSIGNMENT type | `ClipboardIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 274 | `🏫` | Notification object builder: CLASSROOM_JOINED type | `SchoolBuildingIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 275 | `🤝` | Notification object builder: COUNSELOR_LINKED type | `HandshakeIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 276 | `📝` | Notification object builder: COUNSELOR_NOTE_ADDED type | `PencilIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 277 | `✨` | Notification object builder: COUNSELOR_RECOMMENDATION_ADDED type | `SparklesIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 278 | `✅` | Notification object builder: ACTION_ITEM_CREATED type | `CheckCircleIcon` | REPLACE |
| `components/ui/NotificationBell.tsx` | 279 | `🔔` | Notification object builder: default fallback | `BellIcon` | REPLACE |

---

### `components/ui/ExternalLinkGuard.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `components/ui/ExternalLinkGuard.tsx` | 43 | `🔗` | External link warning dialog icon (30px) | `LinkIcon` | REPLACE |

---

### `components/ui/CanvasTokenExpiredBanner.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `components/ui/CanvasTokenExpiredBanner.tsx` | 117 | `→` | Instructional text: "Canvas → Profile → Settings → Approved Integrations → New Access Token" | — | **AMBIGUOUS — confirm** (step-by-step guide copy) |

---

### `components/ui/WhatIfScorer.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `components/ui/WhatIfScorer.tsx` | 119 | `✕` | Close button: "✕ Close" | `XMarkIcon` | REPLACE |
| `components/ui/WhatIfScorer.tsx` | 127 | `→` | Visual separator arrow (standalone span, 14px, muted color) between two GPA values | `ChevronRightIcon` | REPLACE |
| `components/ui/WhatIfScorer.tsx` | 182 | `✕` | Remove subject button (×) | `XMarkIcon` | REPLACE |

---

### `components/ui/UpdatePopup.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `components/ui/UpdatePopup.tsx` | 57 | `→` | Instructional text: "Full changelog available in Settings → Changelog" | — | **AMBIGUOUS — confirm** (instructional copy) |

---

### `components/ui/DevAdminPanel.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `components/ui/DevAdminPanel.tsx` | 182 | `🪙` | Dev stats display: `{totalCoins} 🪙` inline after number | `CoinIcon` | REPLACE |
| `components/ui/DevAdminPanel.tsx` | 187 | `🪙` | Dev stats display: `{inventoryValue} 🪙` inline after number | `CoinIcon` | REPLACE |
| `components/ui/DevAdminPanel.tsx` | 320 | `🗑` | Delete account button: "🗑 Delete Account Permanently" | `TrashIcon` | REPLACE |
| `components/ui/DevAdminPanel.tsx` | 326 | `🪙` | Coins balance display: `{targetCoins} 🪙` inline after number | `CoinIcon` | REPLACE |
| `components/ui/DevAdminPanel.tsx` | 342 | `🪙` | Coins balance display inline | `CoinIcon` | REPLACE |
| `components/ui/DevAdminPanel.tsx` | 352 | `✓` | Toast: "✓ Granted" | `CheckIcon` | REPLACE |
| `components/ui/DevAdminPanel.tsx` | 357 | `🔓` | Button label: "🔓 Grant Market Access" | `LockOpenIcon` | REPLACE |
| `components/ui/DevAdminPanel.tsx` | 358 | `✓` | Toast feedback (colour trigger) | `CheckIcon` | REPLACE |

---

### `nextstep-mobile/src/screens/CalendarScreen.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `nextstep-mobile/src/screens/CalendarScreen.tsx` | 169 | `✓` | Completed assignment indicator: `{a.completed && <Text>✓ </Text>}` | `CheckIcon` | REPLACE |

---

### `nextstep-mobile/src/screens/GradeViewerScreen.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `nextstep-mobile/src/screens/GradeViewerScreen.tsx` | 440 | `🟢` | DEV-only data source label: "🟢 Live portal data" (only shown in `__DEV__` builds) | `StatusDotGreenIcon` | REPLACE |
| `nextstep-mobile/src/screens/GradeViewerScreen.tsx` | 440 | `🟡` | DEV-only data source label: "🟡 Demo/seeded data" | `StatusDotYellowIcon` | REPLACE |

---

### `nextstep-mobile/src/screens/RoadmapScreen.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `nextstep-mobile/src/screens/RoadmapScreen.tsx` | 53 | `✓` | Roadmap step completed indicator (Text component, 14px) | `CheckIcon` | REPLACE |

---

### `nextstep-mobile/src/screens/CollegeInsightsScreen.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `nextstep-mobile/src/screens/CollegeInsightsScreen.tsx` | 48, 57, 69 | `→` | Code comments only (`// Helper: score → color`) — not rendered | — | **OMIT** (code comments) |

---

### `nextstep-mobile/src/screens/PortalConnectScreen.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `nextstep-mobile/src/screens/PortalConnectScreen.tsx` | 358 | `→` | Section label: "Common districts →" (Text caption, points user toward chip list) | `ArrowRightIcon` | REPLACE |
| `nextstep-mobile/src/screens/PortalConnectScreen.tsx` | 494 | `✓` | Connection success button label: "✓ Connected" | `CheckIcon` | REPLACE |

---

### `nextstep-mobile/src/screens/GpaSimulatorScreen.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `nextstep-mobile/src/screens/GpaSimulatorScreen.tsx` | 223 | `↺` | Reset simulator button text label: "↺ Reset" | `ResetIcon` | REPLACE |

---

### `nextstep-mobile/src/screens/DashboardScreen.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `nextstep-mobile/src/screens/DashboardScreen.tsx` | 260 | `→` | View all link: "View all →" (navigates to Planner) | `ArrowRightIcon` | REPLACE |
| `nextstep-mobile/src/screens/DashboardScreen.tsx` | 268 | `🔥` | Stat card label: "Day Streak 🔥" — trailing decorative emoji in label string | `FlameIcon` | **AMBIGUOUS — confirm** |
| `nextstep-mobile/src/screens/DashboardScreen.tsx` | 276 | `→` | See all link: "See all →" (navigates to GradePortal) | `ArrowRightIcon` | REPLACE |

---

### `nextstep-mobile/src/screens/CourseDetailScreen.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `nextstep-mobile/src/screens/CourseDetailScreen.tsx` | 26–28 | `→` | JSDoc comments only — not rendered | — | **OMIT** (code comments) |

---

### `nextstep-mobile/src/components/ui/ResetButton.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `nextstep-mobile/src/components/ui/ResetButton.tsx` | 29 | `↺` | Reset button icon character (Text component, 18px) | `ResetIcon` | REPLACE |

---

### `nextstep-mobile/src/components/grades/GPASummaryCard.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `nextstep-mobile/src/components/grades/GPASummaryCard.tsx` | 16 | `↑` | GPA trend indicator: going up | `TrendUpIcon` | REPLACE |
| `nextstep-mobile/src/components/grades/GPASummaryCard.tsx` | 17 | `↓` | GPA trend indicator: going down | `TrendDownIcon` | REPLACE |
| `nextstep-mobile/src/components/grades/GPASummaryCard.tsx` | 18 | `→` | GPA trend indicator: stable / no change | `TrendNeutralIcon` | REPLACE |

---

### `nextstep-mobile/src/components/simulator/GradePickerRow.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `nextstep-mobile/src/components/simulator/GradePickerRow.tsx` | 88 | `→` | Inline grade-change display: `"B+ → A-"` — shows original → selected grade | `ArrowRightIcon` | **AMBIGUOUS — confirm** (inline in data display string, but may benefit from icon for accessibility) |

---

### `nextstep-mobile/src/components/simulator/GradeAdjustRow.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `nextstep-mobile/src/components/simulator/GradeAdjustRow.tsx` | 92 | `→` | Inline grade selection display: `" → A"` appended when modified | `ArrowRightIcon` | **AMBIGUOUS — confirm** (inline in data display string) |

---

### `nextstep-mobile/src/components/simulator/DeltaCard.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `nextstep-mobile/src/components/simulator/DeltaCard.tsx` | 21 | `↑` | Delta direction: positive / GPA increased | `TrendUpIcon` | REPLACE |
| `nextstep-mobile/src/components/simulator/DeltaCard.tsx` | 22 | `↓` | Delta direction: negative / GPA decreased | `TrendDownIcon` | REPLACE |
| `nextstep-mobile/src/components/simulator/DeltaCard.tsx` | 23 | `→` | Delta direction: neutral / no change | `TrendNeutralIcon` | REPLACE |

---

### `nextstep-mobile/src/components/simulator/GPAComparisonCard.tsx`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `nextstep-mobile/src/components/simulator/GPAComparisonCard.tsx` | 29 | `↑` | Delta: positive | `TrendUpIcon` | REPLACE |
| `nextstep-mobile/src/components/simulator/GPAComparisonCard.tsx` | 30 | `↓` | Delta: negative | `TrendDownIcon` | REPLACE |
| `nextstep-mobile/src/components/simulator/GPAComparisonCard.tsx` | 31 | `→` | Delta: neutral | `TrendNeutralIcon` | REPLACE |

---

### `nextstep-mobile/src/utils/__tests__/assignmentGrouper.test.ts`

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `nextstep-mobile/src/utils/__tests__/assignmentGrouper.test.ts` | 91 | `→` | Test description string: "overdue → today → …" — not rendered UI | — | **OMIT** (test description string) |

---

### `lib/changelog.ts`

> All entries below are `emoji` fields in changelog data objects rendered in the UpdatePopup / changelog UI. They function as leading icons for each changelog entry. Flagged AMBIGUOUS because they are authored as content data, not as a discrete icon slot assignment, and the architect may choose to keep them as emoji (appropriate for a changelog) rather than migrating to the icon system.

| File | Line | Emoji | Semantic meaning | Proposed icon name | Flag |
|------|------|-------|------------------|--------------------|------|
| `lib/changelog.ts` | 19 | `🎰` | Changelog entry icon: Spin Wheel feature | `SlotMachineIcon` | **AMBIGUOUS — confirm** |
| `lib/changelog.ts` | 24 | `📖` | Changelog entry icon: Item Catalog feature | `BookOpenIcon` | **AMBIGUOUS — confirm** |
| `lib/changelog.ts` | 29 | `🏆` | Changelog entry icon: Leaderboards feature | `TrophyIcon` | **AMBIGUOUS — confirm** |
| `lib/changelog.ts` | 34 | `🐐` | Changelog entry icon: GOAT Tag feature — goat shape | `CrownIcon` | **AMBIGUOUS — confirm** |
| `lib/changelog.ts` | 39 | `🏷️` | Changelog entry icon: Tag Rebalance | `TagIcon` | **AMBIGUOUS — confirm** |
| `lib/changelog.ts` | 44 | `🎨` | Changelog entry icon: Rarity Borders feature | `PaintPaletteIcon` | **AMBIGUOUS — confirm** |
| `lib/changelog.ts` | 56 | `🔒` | Changelog entry icon: Account Lockout feature | `LockIcon` | **AMBIGUOUS — confirm** |
| `lib/changelog.ts` | 61 | `🙈` | Changelog entry icon: Email Privacy feature — see-no-evil monkey | — (no equivalent) | **AMBIGUOUS — confirm** |
| `lib/changelog.ts` | 66 | `🎓` | Changelog entry icon: Full Canvas Dashboard feature | `GraduationCapIcon` | **AMBIGUOUS — confirm** |
| `lib/changelog.ts` | 71 | `🧹` | Changelog entry icon: Cleaner Planner & AI feature — broom | — (no equivalent) | **AMBIGUOUS — confirm** |
| `lib/changelog.ts` | 76 | `🔔` | Changelog entry icon: Notifications improvement | `BellIcon` | **AMBIGUOUS — confirm** |
| `lib/changelog.ts` | 81 | `💬` | Changelog entry icon: View Full Posts feature | `ChatBubbleIcon` | **AMBIGUOUS — confirm** |
| `lib/changelog.ts` | 93 | `✨` | Changelog entry icon: Animated Profile Effects | `SparklesIcon` | **AMBIGUOUS — confirm** |
| `lib/changelog.ts` | 98 | `🪙` | Changelog entry icon: Daily Streak Coin Cap | `CoinIcon` | **AMBIGUOUS — confirm** |
| `lib/changelog.ts` | 103 | `🤖` | Changelog entry icon: Faster AI Responses | `RobotIcon` | **AMBIGUOUS — confirm** |
| `lib/changelog.ts` | 115 | `🚀` | Changelog entry icon: Initial Launch | `RocketIcon` | **AMBIGUOUS — confirm** |

---

## Summary statistics

| Category | Count |
|----------|-------|
| **REPLACE** | 263 |
| **AMBIGUOUS — confirm** | 61 |
| **PROTECTED_SKIP** | 0 |
| **OMIT** (code comments / non-rendered) | 12 |
| **Total grep hits processed** | 336 |

## Top files by REPLACE count

| File | REPLACE entries |
|------|----------------|
| `app/(app)/marketplace/page.tsx` | ~100 |
| `components/ui/NotificationBell.tsx` | 31 |
| `app/(app)/feed/page.tsx` | 30 |
| `app/(app)/grades/canvas/page.tsx` | 22 |
| `app/(app)/dashboard/page.tsx` | 16 |
| `app/(app)/grades/page.tsx` | 8 |

## Top icons by recurrence (consolidation targets)

| Icon name | Occurrences across codebase |
|-----------|----------------------------|
| `CheckIcon` | ~45 |
| `XMarkIcon` | ~12 |
| `ArrowLeftIcon` | ~10 |
| `TradeArrowsIcon` | ~8 |
| `TagIcon` | ~15 |
| `ImageIcon` | ~8 |
| `PaintPaletteIcon` | ~8 |
| `BanIcon` | ~8 |
| `LockIcon` | ~7 |
| `CoinIcon` | ~14 |
| `TrophyIcon` | ~7 |
| `CheckCircleIcon` | ~8 |
| `ChatBubbleIcon` | ~8 |
| `GraduationCapIcon` | ~7 |
| `FlameIcon` | ~5 |
| `SwitchArrowsIcon` | ~6 |
| `WizardIcon` | ~4 |
| `SlotMachineIcon` | ~7 |
| `BarChartIcon` | ~6 |
| `SparklesIcon` | ~7 |

---

*End of inventory. No files were created or modified other than this document.*

---

## Resolution Log

**Migration completed:** 2026-07-07  
**Agent:** frontend-engineer (Task 3 of 4)

### Web files resolved

| File | REPLACE count | Resolution notes |
|------|--------------|-----------------|
| `app/(app)/marketplace/page.tsx` | ~100 | BOX_DEFS `icon: React.ReactNode`; toast sentinel pattern; CoinIcon collision kept image-based |
| `components/ui/NotificationBell.tsx` | 31 | icon map `string` → `React.ReactNode` ternary |
| `app/(app)/feed/page.tsx` | 30 | Notification icon map, heart buttons, giveaway type picker, ISD badges |
| `app/(app)/grades/canvas/page.tsx` | ~20 | `fileIcon()` / `moduleItemIcon()` return `React.ReactNode`; submitMsg sentinel |
| `app/(app)/dashboard/page.tsx` | ~15 | QUICK_ACCESS_LINKS + STREAK_MILESTONES `icon: React.ReactNode`; `emoji` → `icon` rename |
| `app/(app)/grades/page.tsx` | 8 | CARDS `icon: React.ReactNode` |
| `app/(app)/grades/contact/page.tsx` | 1 | ArrowLeftIcon back button |
| `app/(app)/grades/attendance/page.tsx` | 3 | ArrowLeftIcon + ChevronLeft/RightIcon pagination |
| `app/(app)/grades/progress/page.tsx` | 1 | ArrowLeftIcon back button |
| `app/(app)/grades/schedule/page.tsx` | 1 | ArrowLeftIcon back button |
| `app/(app)/grades/classwork/page.tsx` | 1 | ArrowLeftIcon back button |
| `app/(app)/grades/transcript/page.tsx` | 1 | ArrowLeftIcon back button |
| `app/(app)/grades/report-card/page.tsx` | 1 | ArrowLeftIcon back button |
| `app/(app)/grades/what-if/page.tsx` | 1 | ArrowLeftIcon back button |
| `app/(app)/layout.tsx` | 1 | BanIcon banned-user screen |
| `app/(app)/grades/classlink/page.tsx` | 1 | CheckIcon success state |
| `app/page.tsx` | 4 | Badge icons (⚡🔒🤖🎓) + CTA ArrowRightIcon |
| `app/(app)/settings/page.tsx` | 2 | CheckIcon canvas status; Moon/SunIcon theme toggle |
| `app/(app)/planner/page.tsx` | 4 | CheckIcon, SparklesIcon, XMarkIcon |
| `app/(app)/colleges/page.tsx` | 1 | GraduationCapIcon empty state |
| `app/(app)/battle/[code]/page.tsx` | 6 | SkullIcon, TrophyIcon, GamepadIcon, LightningBoltIcon, CheckIcon, XMarkIcon, TargetIcon |
| `app/(app)/classroom/page.tsx` | 2 | CheckIcon + XMarkIcon join feedback |
| `app/(app)/classroom/[classroomId]/page.tsx` | 1 | ArrowLeftIcon back button |
| `app/(app)/sets/page.tsx` | 1 | ArcheryBowIcon |
| `app/(app)/sets/[id]/page.tsx` | 2 | ArrowLeftIcon + ArcheryBowIcon |
| `app/(app)/play/page.tsx` | 1 | ArrowRightIcon CTA |
| `app/(app)/play/[code]/page.tsx` | 8 | GoldMedalIcon, SilverMedalIcon, BronzeMedalIcon, CheckIcon, XMarkIcon, ChevronRightIcon, TrophyIcon |
| `app/(app)/my-counselor/[counselorId]/page.tsx` | 1 | WarningIcon overdue badge |
| `app/reset-password/page.tsx` | 4 | LinkIcon, CheckCircleIcon, CheckIcon |
| `app/login/page.tsx` | 5 | InboxIcon, ArrowLeftIcon, WarningIcon, XMarkIcon, MailboxIcon |
| `app/teacher/layout.tsx` | 1 | CheckIcon |
| `components/ui/UserProfileModal.tsx` | 2 | HeartFilledIcon, HeartOutlineIcon, ArrowRightIcon |
| `components/ui/LagDetector.tsx` | 1 | LightningBoltIcon |
| `components/ui/UpdateBanner.tsx` | 1 | XMarkIcon |
| `components/ui/ExternalLinkGuard.tsx` | 1 | LinkIcon |
| `components/ui/WhatIfScorer.tsx` | 3 | XMarkIcon, ChevronRightIcon |
| `components/ui/DevAdminPanel.tsx` | 5 | CoinIcon (image-based), TrashIcon, LockOpenIcon, CheckIcon; toast sentinel |
| `app/counselor/dashboard/page.tsx` | 1 | CheckIcon inline confirmation |

### Mobile files resolved

| File | REPLACE count | Resolution notes |
|------|--------------|-----------------|
| `nextstep-mobile/src/components/grades/GPASummaryCard.tsx` | 3 | `TrendConfig.symbol` → `icon: React.ReactNode`; TrendUpIcon, TrendDownIcon, TrendNeutralIcon |
| `nextstep-mobile/src/components/simulator/DeltaCard.tsx` | 3 | `deltaConfig` returns `icon: React.ReactNode`; render site restructured to View+Text+icon |
| `nextstep-mobile/src/components/simulator/GPAComparisonCard.tsx` | 3 | Same as DeltaCard; DeltaCfg interface updated |
| `nextstep-mobile/src/components/ui/ResetButton.tsx` | 1 | `<Text>↺</Text>` → `<ResetIcon size={18}/>` |
| `nextstep-mobile/src/screens/CalendarScreen.tsx` | 1 | `<Text>✓</Text>` → `<CheckIcon size={14}/>` |
| `nextstep-mobile/src/screens/RoadmapScreen.tsx` | 1 | `<Text>✓</Text>` → `<CheckIcon size={14}/>` in milestone circle |
| `nextstep-mobile/src/screens/PortalConnectScreen.tsx` | 2 | "Common districts →" → View+Text+ArrowRightIcon; "✓ Connected" → CheckIcon+Text |
| `nextstep-mobile/src/screens/GpaSimulatorScreen.tsx` | 1 | `↺ Reset` → View+ResetIcon+Text |
| `nextstep-mobile/src/screens/DashboardScreen.tsx` | 2 | "View all →" and "See all →" → View+Text+ArrowRightIcon |
| `nextstep-mobile/src/screens/GradeViewerScreen.tsx` | 2 | DEV-only 🟢/🟡 → View+StatusDotGreenIcon/StatusDotYellowIcon+Text |

### Phase 3 fused-copy fixes (Task 3b — follow-up pass)

| File | Fix |
|------|-----|
| `app/page.tsx` | Chip arrays (🔥🎁🏆, 💰🤝🎉, ✨🏷️🎴) → structured `{Icon, text}` arrays; `✓` marketing bullets → `<CheckIcon/>` + text |
| `app/(app)/dashboard/page.tsx` | `All clear ✓`, `Day Streak 🔥`, ` ✦`, `Let's go! 🚀`, `📚 Raise...`, `🎉 You just earned`, `Got it! 🚀` all split into icon+text |
| `app/(app)/marketplace/page.tsx` | `🏕️` (Wandering Trader) → `<TentIcon size={16}/>` |
| `nextstep-mobile/src/screens/DashboardScreen.tsx` | `Day Streak 🔥` StatCard label → `labelNode` prop with `<FlameIcon/>` |
| `components/icons/paths.ts` + `nextstep-mobile/src/components/icons/paths.ts` | `TentIcon` path added (tent outline, 24×24 viewBox, 2 path elements) |
| `components/icons/index.tsx` + `nextstep-mobile/src/components/icons/index.tsx` | `TentIcon` export added |

### LEAVE UNTOUCHED decisions

- `lib/changelog.ts` — Rule 3d: entire file untouched (changelog copy strings)
- All prose arrow strings in data/guide text — Rule 3c: left as plain text
- Item display-name emoji in chat posts / marketplace names — Rule 3b: left as-is
- Fused emoji in post copy rendered as `<Text>` — Rule 3a: split into icon+label where possible

### TypeScript status (final)

- **Web (`npx tsc --noEmit`):** PASS — 0 errors
- **Mobile (`cd nextstep-mobile && npx tsc --noEmit`):** PASS — 0 errors
