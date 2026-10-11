# /brag plan v4: myFuturely promo on the original soundtrack

**Soundtrack:** the audio track from `Futurely Promo Video 4K.mp4`, copied losslessly (AAC, 60.3s). It is a voiceover over a produced music bed. The narration wasn't transcribed because speech-model downloads are blocked in this environment.

**Length:** 60.3s, matching the soundtrack and the original edit. Authored at 1920×1080, rendered at 3840×2160, 30fps.

## Beat map (from `hyperframes beats`)
- Eighth-note grid at 0.25426s (about 118 BPM). Bars run every 2.0341s from the drop at **4.564s**, the strongest hit (1.00).
- 8-bar phrases start at 4.56s, 20.84s, 37.11s and 53.39s.
- Breaks at 1.5–2.5s, 3.8–4.4s, 14.7s, 18.8–19.6s, 40.9–41.7s, 43.2–43.7s and 52.6–53.1s.
- Strong accents at 8.9–9.7s, 15.75s, 22.36s, 23.89s, 42.19s, 42.45s, 53.38s and 56.18s.

Every tween in `composition/index.html` is placed on this grid through `b(k) = 0.242 + k × 0.25426`.

## Timeline (mirrors the original edit)
| Time | Section | What happens |
|---|---|---|
| 0.0–2.5 | Title | "Your Future. Figured Out." One word per eighth note, then a light streak |
| 2.5–4.6 | Logo | Lands on the beat, holds through the pause, then docks into the login card's logo on the drop |
| 4.6–6.1 | Login | Real login page. The cursor hovers and clicks **Log In** on the beat |
| 6.1–12.7 | Dashboard | "Good evening, Test". Cards build in on sixteenths, GPA counts to 3.600 / 3.900, the GPA card lifts off in 3D while everything else dims. Three due-soon reminders slide in on consecutive beats |
| 12.7–17.5 | Navigation | The sidebar expands and the cursor walks it one item per beat. It folds away on the break, then the **Grades** card lifts off and flies at the camera |
| 17.5–19.6 | Title | "Track your Grades" |
| 19.6–22.4 | Hero card | The real Grades card (captured at 7.8× detail) floats in. The cursor clicks it on the bar, ripple rings spread, and the camera zooms through into the grades page |
| 22.4–29.0 | Grades | Six real course rows cascade in, averages count up, letter grades pop. The cursor clicks **What-If** on AP Calculus BC and types "Unit 4 Test", 98, Major: 88.00% → **89.50% (+1.50%)**, which lifts off the screen. Then a whip pan |
| 29.0–31.0 | Sidebar | Close-up: the cursor walks down to **My Future** and clicks |
| 31.0–37.1 | Roadmap | The ring draws to 23% and lifts. GPA 3.90 / 3.60, credit chips, credits bar fills to 6/26, timeline items slide in. The cursor clicks **Colleges** |
| 37.1–41.0 | Colleges | Stats, then four college cards whose likelihood bars fill and scores count: Stanford 1, UT Dallas 55, UTSA 93, Texas A&M 49. The stack fans out in 3D on the bar |
| 41.7–43.7 | Title | "Need Guidance Right Now?", with the last words on the two strongest hits and a shockwave ring |
| 43.7–53.1 | AI chat | Real typing frames, one per eighth note. Send, typing dots, then the NYU answer streams in line by line and lifts |
| 53.4–55.4 | Title | "Start your journey today at" |
| 55.4–60.3 | Outro | myFuturely mark and wordmark, "myfuturely.ai", then a fade to dark |

## How the UI is real
- The app ran locally against Postgres with the built-in demo account.
- Captures were taken with Playwright at 3× in the Pacific/Auckland timezone, which produces the "Good evening" greeting.
- For every screen the capture saved a full frame, a "shell" frame (movable pieces hidden) and a "no numbers" frame, plus each element's exact position and computed font style.
- The composition rebuilds each screen from cropped real pieces.
- Counters are re-typeset in the app's own font at the original geometry: Inter 800 at 48px for the GPA, 36px for the ring, 28px for college scores.

Local-only data for the capture:
- 4 colleges, with admissions stats tuned so the app's own scoring gives the original's 1 / 55 / 93 / 49;
- SAT 1200;
- three due-soon reminders;
- the NYU chat session.

The "TEST ACCOUNT" banner, the "What's New" popup and the Next.js dev badge were hidden while capturing.

## Audio mix
**What the composition plays** (`composition/index.html`, tracks 10–13):
- the original soundtrack at full level;
- quiet UI clicks on the 8 cursor clicks;
- soft typing under both typing moments.

Rendering it as-is gives the first mix, normalized to about -14 LUFS.

**What `brag.mp4` carries:** a narration-forward remix, muxed onto the rendered video afterwards. The video stream is unchanged.
- **Voice:** isolated from the centre channel with RNNoise (its bundled model, gated by its own speech probability), high-passed at 90 Hz, with a slight 3 kHz lift.
- **Music:** the original minus the voice, lowered about 11 dB, with a 2.5 kHz dip so it doesn't mask the voice.
- **Result:** between phrases, speech now sits about 13.4 dB above the music (it was 4.5 dB).
- **Sound effects:** the clicks are unchanged; the typing is lowered under the narration.
- **Final level:** -14.4 LUFS, true peak -0.8 dB.
