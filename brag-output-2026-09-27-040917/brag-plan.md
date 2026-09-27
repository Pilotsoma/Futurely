# /brag plan v2: myFuturely, matching the reference promo and improving on it

Reference: `Futurely Promo Video 4K.mp4` (60.3s, 3840×2160). It shows tilted glowing device frames on a blue gradient, real app screens (Dashboard → Grades → My Future → AI Chat), a cursor driving the sidebar, white title cards between sections ("Your Future. Figured Out.", "Track your Grades", "Need Guidance Right Now?"), and a logo and wordmark outro.

Format: landscape, authored at 1920×1080 and rendered at 3840×2160 (`--resolution 4k`), 30fps, **47s**, tone `polished`, music + SFX, no voice.

## What we keep from the reference
- The look: deep-blue radial gradient, a device frame with a cyan rim light, and 3D tilts and drifts
- The story order: tagline → logo → Dashboard → Grades → My Future (Roadmap + Colleges) → AI Chat → logo
- Its title-card copy and the "Your Future. Figured Out." tagline
- A cursor that navigates by clicking the sidebar
- Its demo data: GPA 3.596 / 3.896, the course list and teachers, 23% to graduation, 3.90/3.60, college likelihoods 1/55/93/49, and the NYU chat

## What we make better
| Reference problem | v2 fix |
|---|---|
| 60s with slow stretches, a dark gap at 0:28, an empty frame at 0:52 and black at 0:58 | 47s cut on 2-second musical bars. Every beat has something moving. |
| UI is often too small and too far away to read | UI rebuilt as crisp HTML, with camera push-ins onto the number that matters |
| "TEST ACCOUNT, you're viewing sample data" banner on every screen | Removed |
| Static screen recordings | Live UI: GPA counters roll, grade rows cascade, the 23% ring fills, likelihood bars fill, chat types and streams |
| Plain title cards | Word-by-word title reveals with one accent word, and the music breaks down under each card |
| Grades scene just scrolls a table | Cursor clicks **What-If** on AP Calculus BC and a what-if card shows 88 → 91, B → A |
| Outro is just the wordmark | Wordmark + tagline + "Start for free · myfuturely.ai" |

## Storyboard (bars = 2s at 120 BPM)
| # | Time | Scene | Beats |
|---|------|-------|-------|
| 1 | 0–3 | Title | "Your Future." / "Figured Out." words rise out of a blur |
| 2 | 3–6 | Logo | The cap-F mark lands with a light sweep and glow, then flies at the camera (riser → drop at 6.0) |
| 3 | 6–14 | Dashboard | The device flies up into its tilt. "Good evening, Maya". GPA 3.596 / 3.896 roll up. Stats and due-soon toasts slide in. Push-in on the GPA card. Cursor clicks **Grade Portal** |
| 4 | 14–16 | Title | "Track your **grades.**" |
| 5 | 16–24 | Grades | Six course rows cascade in, averages count up, letter grades pop. Push-in on Avg/Grade. Cursor clicks What-If on AP Calculus BC and the card shows Unit 4 Test 95 → avg 88→91, B→A |
| 6 | 24–26 | Title | "Plan your **future.**" |
| 7 | 26–34 | My Future | The Roadmap ring fills to 23%, GPA cards, credits bar 6/26, 4-year timeline checks. Cursor clicks **Colleges**: stats row, then four college cards whose likelihood bars fill (Stanford 1 Far Reach, UT Dallas 55 Possible, UTSA 93 Likely, Texas A&M 49 Reach) |
| 8 | 34–36 | Title | "Need guidance **right now?**" |
| 9 | 36–42 | AI Chat | Empty state and chips. "How can I improve my chances for NYU?" types into the input and sends. Typing dots, then the reply streams in with bold key phrases. Push-in on the reply |
| 10 | 42–47 | Outro | The device falls away. Mark + gradient wordmark, "Your future. Figured out.", "Start for free · myfuturely.ai" |

## Audio
Synthesized 120 BPM bed with an Am–F–C–G progression, one chord per bar:
- Intro swell with a riser into the **drop at 6.0**
- Drums cut out under each title card (14–16, 24–26, 34–36), with a riser back in
- Impact at 42 into a pad-only outro that fades over the last 2s

SFX come from the Hyperframes library: whooshes on transitions, soft clicks on cursor clicks, typing, a pop on the what-if card, a notification on the toasts, a sparkle when the ring completes, and bass impacts at 6.0 and 42.0.
