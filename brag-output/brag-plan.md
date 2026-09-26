# /brag plan: myFuturely

Format: landscape 1920×1080 · 30fps · 21.5s · tone: `default` (playful, clean, postable) · music on · sfx on · no voice

## Planning rubric

1. **What is it?** myFuturely: a free AI academic advisor plus planner for high schoolers. It covers grades, a weekly plan, what-if scenarios, and a 4-year roadmap.
2. **Who's it for?** High school students in grades 9–12 (parents and counselors come second).
3. **The pain it kills:** grades are spread across HAC, Skyward, PowerSchool and Canvas, and one counselor looks after 500+ students.
4. **The one-line claim (site copy):** "This is your future." / "your progress." / "your plan."
5. **Best visual proof:** the advisor chat, the "This week" priority planner, the what-if bar chart and the Grade 9→12 roadmap, all from `app/FeatureShowcase.tsx`.
6. **Brand:** dark navy `#0D1829`, surface `#162235`, primary `#2979FF`, cyan `#22d3ee`, purple `#7C3AED` / `#A78BFA`, amber `#F59E0B`. Display font is Clash Grotesk Medium (shipped in `public/fonts`) and body is Inter. The logo is a graduation-cap "F".
7. **What's funny/absurd?** One counselor for 500 kids. The joke is the ratio, and the product answers it: now every student gets an advisor.
8. **Punchline:** the site's own closer, "You don't need to wait for senior year."
9. **CTA:** "Start for free" (site CTA).

## Creative angle

**"500 students. 1 counselor. Now everyone gets an advisor."** Open on a counter that spins up to 500, show the fragmented-portal mess, then snap everything into the hero's rotating headline, then move through three real UI cards at speed.

## Storyboard

| # | Time | Scene | On-screen text | Motion / transition | SFX |
|---|------|-------|----------------|---------------------|-----|
| 1 | 0.0–2.8 | **Hook**: one counselor icon on the left, a grid of 500 dots filling in fast on the right | "1 counselor." → "500+ students." (counter ticks 0→500) | Dots ripple in on a stagger and the counter eases up | riser under the fill, pop at 500 |
| 2 | 2.8–5.0 | **The mess**: portal cards (HAC, Skyward, PowerSchool, Canvas, Google Classroom) pile in at odd angles | "Your grades live in 5 different places." | Cards drop with rotation and slight jitter, then a glitch shake | glitch |
| 3 | 5.0–8.2 | **Reveal**: cards whoosh away and the logo lands | "This is" + a rotating word: "your future." (cyan) → "your progress." (blue) → "your plan." (purple) | Blur/skew word swap copied from the site's hero | whoosh + bass impact on the logo |
| 4 | 8.2–12.0 | **Advisor**: chat UI card, label "01 · Your Academic Advisor" | User: "What should I focus on this week?" / AI: "Your chemistry report is due Monday — start it tonight." | Bubbles pop in with a typing indicator before the reply | pop, key-press, notification |
| 5 | 12.0–15.2 | **Smart Planner**: "This week" list for Mon–Fri with "High" tags | "02 · Smart Planner" · "Sorted by priority — automatically." | Card pushes in from the right, rows stagger in, tags stamp | whoosh-short, clicks |
| 6 | 15.2–18.2 | **What-If Simulator**: 4 bars grow, the +26% counter climbs | "03 · What-If Simulator" · "+3 study sessions / wk → +26%" | Bars scale up on the Y axis in sequence and the number counts up | sparkle at +26% |
| 7 | 18.2–21.5 | **Outro**: roadmap dots 9→10→11→12 draw across, then the logo and punchline | "You don't need to wait for senior year." · "myFuturely · Start for free" | A line draws through the grade nodes, the headline rises and the CTA pops | chime |

Durations: 2.8 + 2.2 + 3.2 + 3.8 + 3.2 + 3.0 + 3.3 = **21.5s**

## Readability holds
- Scene 1: each label holds at least 1.0s after it settles.
- Scene 3: the rotating words change every ~0.9s (short labels).
- Scene 4: the reply (10 words) is fully visible from about 10.0s to 12.0s.
- Scene 7: the punchline (7 words) holds from about 19.4s to the end.

## Music cue guidance
No bundled brag music is installed in this environment, and the HeyGen BGM catalog needs an account. I'll synthesize a simple 120 BPM bed with FFmpeg (kick on quarters, soft pad, hat on eighths; beat = 0.5s). The scene cuts at 2.8/5.0/8.2/12.0/15.2/18.2 already sit near beat boundaries. The big impact (logo, 5.0s) lands on a downbeat. The music ducks under nothing (no voice) and fades out over the last 1.2s.
