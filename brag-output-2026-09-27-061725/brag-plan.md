# /brag plan v3: myFuturely promo with the real app screens

Same 47s structure, title cards, camera work, music and outro as v2 (`brag-output-2026-09-27-040917/`). The difference is that **every app screen is now a real capture of the myFuturely web app**, not a hand-built HTML recreation.

## How the screens were captured
- Ran the app locally: Next.js frontend, Express backend and a local Postgres.
- Logged in as the built-in demo account `test@myfuturely.ai`, which the backend creates on startup.
- Captured each page with Playwright at 1532×932 and 3× pixel density, so screens stay sharp in 4K even at 1.9× push-ins.
- Added to the local DB only, to match the reference video: 4 colleges on the list, SAT 1200, and 5 AI chat sessions including the NYU conversation from the reference.
- College likelihood scores are the app's own output from its scoring code: Stanford 1 (Far Reach), UT Dallas 67 (Possible), UTSA 95 (Likely), Texas A&M 54 (Possible).
- Hidden while capturing: the "TEST ACCOUNT, sample data" banner, the Next.js dev badge and the "What's New" popup.

## Real interactions shown
| Scene | Screens |
|---|---|
| Dashboard | Dashboard → sidebar expands on hover → Grade Portal highlighted → click |
| Grades | Grades table → click What-If on AP Calculus BC → type "Unit 4 Test", 98, Major (30%) → + Add → Current 88.00% → Simulated 89.50%, +1.50% |
| My Future | Roadmap (23% toward graduation, 3.90 / 3.60, 6/26 credits, 4-year timeline) → click Colleges tab → college list |
| AI Chat | Empty state → question typed (8 real frames captured while typing) → send → saved NYU answer |

## Audio
Same synthesized 120 BPM bed and SFX as v2, mixed hotter (music at full level, SFX raised). The final file is loudness-normalized to -14 LUFS, the usual target for social video.
