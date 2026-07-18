# Signup/Login Flow Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the reproducible defects found while debugging the web signup/login flow (`app/login/page.tsx` + `backend/src/routes/auth.ts`) — a hydration-mismatch console error, an unguarded SMTP hang risk in OTP delivery, a design-token drift on the login card, and a mobile/web URL conflation that breaks Google OAuth completion, email verification links, and password-reset links for web users — without touching the COPPA age-gate, which stays exactly as-is.

**Architecture:** This is a bug-fix pass across three existing files (`app/layout.tsx`, `app/login/page.tsx`, `backend/src/lib/email.ts`) plus one new backend fix (`backend/src/routes/auth.ts`) that splits a single overloaded `APP_URL` env var into a mobile-deep-link var and a new web-origin var. No new services, no new database tables, no new dependencies.

**Tech Stack:** Next.js 16 (Turbopack, App Router) for `app/`, Express + Prisma (Neon Postgres) for `backend/`, `nodemailer`/Resend for email, Playwright MCP for interactive verification (no test runner is installed in this repo — see Global Constraints).

## Global Constraints

- **COPPA age-gate is non-negotiable.** `.claude/context/COMPLIANCE.md` mandates collecting date of birth and blocking under-13 signups; `backend/src/routes/auth.ts:262-290` enforces it server-side independent of the frontend. No task in this plan may remove, weaken, or bypass this check.
- **No test runner is installed** (`jest`, `supertest`, `@playwright/test` are not dependencies in `backend/` or the root web app — confirmed in `ARCHITECTURE.md` / `ENGINEERING_RULES.md`). Every "test" step in this plan is a live, interactive Playwright MCP reproduction against the running dev servers, not an automated suite. Do not claim a test "passed" without actually running the Playwright step and reading its output.
- **Never run `prisma migrate dev`** against `DATABASE_URL` — it points at a live Neon Postgres. This plan requires **no schema changes** (verified: `backend/prisma/schema.prisma`'s `User.dateOfBirth`/`coppaConsentStatus`/`coppaConsentTimestamp`/`coppaParentEmail` and the `EmailOTP` model already exist and already support every fix below).
- **`backend/.env` is hard-protected** — the guardrail hook denies agent edits to it outright, regardless of task scope. Any env var change in this plan is a manual step for a human to run, called out explicitly.
- **Declare task scope before editing.** `.claude/guardrails/task-scope.json` must list every file a task touches before that task's `Edit`/`Write` steps run, or the edit will hit an `ask` permission prompt. `app/layout.tsx`, `app/login/page.tsx`, and `backend/src/lib/email.ts` are already in scope from the prior debugging session; `backend/src/routes/auth.ts` and `backend/.env.example` are **not yet** in scope and must be added before Task 4.
- **Dark theme only, tokens from `.claude/context/DESIGN_SYSTEM.md`** govern any visual change: Cards `border-radius: 12px`; Buttons/Inputs `border-radius: 8px`, `height: 48px`.

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `app/layout.tsx` | Root layout; inline theme-flash-prevention script sets `data-theme` on `<html>` client-side only | Modified (Task 1, done) |
| `app/login/page.tsx` | Login/register (student/parent/teacher)/OTP/forgot-password UI, all client-side | Modified (Tasks 1 & 3, done) |
| `backend/src/lib/email.ts` | `sendEmail()` — routes to Resend HTTP API, SMTP, or console-log fallback | Modified (Task 2, done) |
| `backend/src/routes/auth.ts` | `/auth/*` routes: login, register (+ COPPA gate), send-otp, oauth/google(+callback), oauth/microsoft(+callback), verify-email, forgot/reset-password | To modify (Task 4, open) |
| `backend/.env.example` | Documents every backend env var | To modify (Task 4, open) — currently missing `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`WEB_APP_URL` entirely |
| `backend/.env` | Actual local secrets/config (hard-protected, human-edited only) | Manual step (Tasks 4 & 5) |

No new files are created. No files are split — `auth.ts` is already a large flat route file per this codebase's established pattern (`ARCHITECTURE.md`: "flat, not modular") and this plan doesn't restructure it.

---

## Task 1: Fix SSR/client hydration mismatch on `<html data-theme>` — ALREADY DONE

**Files:**
- Modify: `app/layout.tsx:26`

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new — this is a pure attribute-warning suppression, no behavior change

- [x] **Step 1: Reproduce the broken state**

Ran (dev server up on `:3000`, backend on `:3001`):
```
mcp__playwright__browser_navigate → http://localhost:3000/login
mcp__playwright__browser_console_messages (level: error)
```
Observed: `[ERROR] A tree hydrated but some attributes of the server rendered HTML didn't match the client properties... data-theme="dark"` on every load, and the Next.js Dev Tools overlay showing a persistent "1 Issue" badge.

- [x] **Step 2: Root cause**

`app/layout.tsx:30` has an inline `<script dangerouslySetInnerHTML>` that runs `document.documentElement.setAttribute('data-theme', t)` — imperative DOM mutation outside React's render, done for the standard no-flash-of-wrong-theme pattern. Because `<html>` (line 26) had no `suppressHydrationWarning`, React treated the resulting attribute mismatch as an error.

- [x] **Step 3: Apply the fix**

```tsx
// app/layout.tsx:26 — before
<html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>

// app/layout.tsx:26 — after
<html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
```

- [x] **Step 4: Verify the fix**

Ran:
```
mcp__playwright__browser_navigate → http://localhost:3000/login
mcp__playwright__browser_console_messages (level: warning)
```
Result: `Console: 0 errors, 1 warnings` (the remaining warning is the unrelated, pre-existing LCP image-loading hint). Next.js Dev Tools "1 Issue" badge is gone.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx
git commit -m "fix: suppress hydration warning for client-only theme attribute"
```

---

## Task 2: Add timeout guards to the SMTP transport — ALREADY DONE

**Files:**
- Modify: `backend/src/lib/email.ts:30-43`

**Interfaces:**
- Consumes: `MailOptions` (existing interface, unchanged: `{ to: string; subject: string; html: string }`)
- Produces: `sendEmail(opts: MailOptions): Promise<void>` — same signature, now fails fast instead of hanging when `sendViaSMTP` is the active path

- [x] **Step 1: Reproduce the mechanism (not the symptom — see note)**

Confirmed via code inspection, not live reproduction: `backend/src/routes/auth.ts:1089` calls `await sendEmail(...)` synchronously inside the `POST /auth/send-otp` handler, blocking the HTTP response on mail delivery. `sendViaSMTP()` in `backend/src/lib/email.ts` built its `nodemailer.createTransport()` with no `connectionTimeout`/`greetingTimeout`/`socketTimeout`, so an unreachable/slow `SMTP_HOST` can hang toward `nodemailer`'s own long defaults, exceeding the frontend's 30s abort (`lib/api.ts` `DEFAULT_TIMEOUT_MS = 30000`).

**Note:** this does not currently reproduce in this environment — `backend/.env` has `SMTP_HOST=""` and no `RESEND_API_KEY`, so `sendEmail()` takes the instant console-log fallback branch (confirmed: a live `POST /api/auth/send-otp` during this debugging session returned `200 OK` promptly). This task closes the latent gap so it can't bite the moment someone points `SMTP_HOST` at a real server.

- [x] **Step 2: Apply the fix**

```ts
// backend/src/lib/email.ts:30-43 — before
async function sendViaSMTP(opts: MailOptions): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? '"Futurely" <noreply@futurely.app>',
    ...opts,
  })
}

// backend/src/lib/email.ts:30-46 — after
async function sendViaSMTP(opts: MailOptions): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    // Fail fast instead of hanging toward the frontend's request timeout when
    // SMTP_HOST is misconfigured or unreachable.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  })
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? '"Futurely" <noreply@futurely.app>',
    ...opts,
  })
}
```

- [x] **Step 3: Verify**

Backend process (`ts-node-dev --respawn`) auto-restarted on file save. Confirmed still listening:
```bash
netstat -ano | grep ":3001 " | grep LISTENING
```
Result: listener present on a new PID (respawned cleanly, no crash on startup).

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/email.ts
git commit -m "fix: add explicit timeouts to SMTP transport to prevent OTP send hangs"
```

---

## Task 3: Align login page card/button/input tokens to DESIGN_SYSTEM.md — ALREADY DONE

**Files:**
- Modify: `app/login/page.tsx` (the `styles` object, lines ~831-847 pre-fix)

**Interfaces:**
- Consumes: nothing new — this is CSS-in-JS values only, no prop/type changes
- Produces: nothing new

- [x] **Step 1: Reproduce / identify the drift**

Compared `app/login/page.tsx`'s inline `styles` object against `.claude/context/DESIGN_SYSTEM.md`'s "Components — Standards" section:

| Token | Login page (before) | DESIGN_SYSTEM.md spec |
|---|---|---|
| Card border-radius | `22px` | `12px` |
| Button border-radius | `10px` | `8px` |
| Input border-radius | `9px` | `8px` |
| Input height | `46px` | `48px` |
| OAuth button height/radius | `46px` / `10px` | `48px` / `8px` |

Also confirmed there is no shared `Button`/`Input`/`Card` primitive in `components/ui/` (only feature-specific widgets exist there), so every page — including this one — hand-rolls its own inline styles; this page's specific values happened to drift furthest from the documented spec, which reads as "inconsistent with the rest of the website."

- [x] **Step 2: Apply the fix**

```tsx
// app/login/page.tsx — card, before
card: { width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 22, padding: '48px 42px', ... },
// after
card: { width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 42px', ... },

// input, before
input: { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '12px 14px', color: 'var(--text)', height: 46, ... },
// after
input: { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', color: 'var(--text)', height: 48, ... },

// btn / btnSecondary / oauthBtn, before
btn: { ..., borderRadius: 10, height: 48, ... },
btnSecondary: { ..., borderRadius: 10, height: 48, ... },
oauthBtn: { ..., height: 46, borderRadius: 10, ... },
// after
btn: { ..., borderRadius: 8, height: 48, ... },
btnSecondary: { ..., borderRadius: 8, height: 48, ... },
oauthBtn: { ..., height: 48, borderRadius: 8, ... },
```

Note: the DOB (age) field uses the shared `styles.input`, so this fix restyles it identically to every other field — addressing "restyle the age field" without touching the COPPA logic that requires it.

- [x] **Step 3: Verify**

```
mcp__playwright__browser_navigate → http://localhost:3000/login
mcp__playwright__browser_take_screenshot (fullPage: true)
```
Confirmed visually: card corners now match the documented 12px radius; buttons/inputs are visibly more rectangular (8px) and consistent height (48px) across the form.

- [ ] **Step 4: Commit**

```bash
git add app/login/page.tsx
git commit -m "fix: align login page card/button/input tokens to DESIGN_SYSTEM.md"
```

---

## Task 4: Split `APP_URL` into mobile-deep-link vs web-origin vars (authentication changes) — OPEN

**Why this is needed:** `backend/src/routes/auth.ts` uses a single `process.env.APP_URL` for two incompatible purposes:
1. The **mobile** OAuth deep-link redirect (correct use — mobile registers a `futurely://` custom scheme).
2. Every **web-facing** redirect/link: the Google/Microsoft OAuth *web* completion redirect (`res.redirect(`${appUrl}/dashboard...`)`), the email-verification link, and the password-reset link.

`backend/.env` currently has `APP_URL="futurely://"` (confirmed by reading the file). That value is correct for #1 and **broken for #2** — a desktop browser has no handler for `futurely://`, so: clicking "Continue with Google" on the *web* login page, after completing Google's consent screen, redirects the browser to `futurely://dashboard` (or `futurely://login?oauth=new` for new accounts) and goes nowhere. The same broken `futurely://...` link is what gets emailed for "verify your email" and "reset your password" today. This is a real, currently-live authentication bug distinct from the missing `GOOGLE_CLIENT_ID` (Task 5) — it would still be broken even after Task 5 is done.

**Files:**
- Modify: `backend/src/routes/auth.ts:156, 187, 914, 970, 980, 1023, 1030`
- Modify: `backend/.env.example` (document the new var)
- Manual: `backend/.env` (human adds the new var — hard-protected, no agent edit)

**Interfaces:**
- Consumes: new env var `WEB_APP_URL` (falls back to each call site's existing hardcoded default if unset, same pattern as today)
- Produces: nothing new for other tasks to consume — this task is self-contained

- [ ] **Step 1: Add `WEB_APP_URL` to task scope**

```json
// .claude/guardrails/task-scope.json — add to "in_scope"
"backend/src/routes/auth.ts",
"backend/.env.example"
```

- [ ] **Step 2: Reproduce the break**

With `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` temporarily set (see Task 5) and `APP_URL="futurely://"` as it is today, complete a real Google sign-in on `http://localhost:3000/login` via Playwright and observe the final redirect:
```
mcp__playwright__browser_navigate → http://localhost:3000/login
mcp__playwright__browser_click → "Continue with Google" link
... complete Google's consent screen ...
mcp__playwright__browser_navigate (implicit, after callback)
```
Expected (broken): final URL is `futurely://dashboard` or `futurely://login?oauth=new` — Playwright/Chromium will report a navigation error (no registered handler) instead of landing on the app.

- [ ] **Step 3: Apply the fix**

```ts
// backend/src/routes/auth.ts:156 — before
const appUrl = process.env.APP_URL ?? 'https://futurely.app'
// after
const appUrl = process.env.WEB_APP_URL ?? 'https://futurely.app'

// backend/src/routes/auth.ts:187 — before
const appUrl = process.env.APP_URL ?? 'https://futurely.app'
// after
const appUrl = process.env.WEB_APP_URL ?? 'https://futurely.app'

// backend/src/routes/auth.ts:914 — before
const appUrl = process.env.APP_URL ?? 'https://myfuturely.ai'
// after
const appUrl = process.env.WEB_APP_URL ?? 'https://myfuturely.ai'

// backend/src/routes/auth.ts:970 — before
const redirect = encodeURIComponent(`${process.env.APP_URL ?? 'https://myfuturely.ai'}/api/auth/oauth/google/callback`)
// after
const redirect = encodeURIComponent(`${process.env.WEB_APP_URL ?? 'https://myfuturely.ai'}/api/auth/oauth/google/callback`)

// backend/src/routes/auth.ts:980 — before
const appUrl = process.env.APP_URL ?? 'https://myfuturely.ai'
// after
const appUrl = process.env.WEB_APP_URL ?? 'https://myfuturely.ai'

// backend/src/routes/auth.ts:1023 — before
const redirect = encodeURIComponent(`${process.env.APP_URL ?? 'https://myfuturely.ai'}/api/auth/oauth/microsoft/callback`)
// after
const redirect = encodeURIComponent(`${process.env.WEB_APP_URL ?? 'https://myfuturely.ai'}/api/auth/oauth/microsoft/callback`)

// backend/src/routes/auth.ts:1030 — before
const appUrl = process.env.APP_URL ?? 'https://myfuturely.ai'
// after
const appUrl = process.env.WEB_APP_URL ?? 'https://myfuturely.ai'
```

Leave line 1125's diagnostic env-report (`APP_URL: process.env.APP_URL ?? '✗ missing'`) as-is for `APP_URL` itself, and add a matching line right after it:
```ts
// backend/src/routes/auth.ts:1125 — after (insert new line below the existing APP_URL line)
WEB_APP_URL: process.env.WEB_APP_URL ?? '✗ missing',
```

Update the documentation file:
```
# backend/.env.example — add near the existing APP_URL="futurely://" line
WEB_APP_URL="http://localhost:3000"
# ^ Web-facing redirect base for OAuth completion, email verification, and
#   password-reset links. Distinct from APP_URL, which is the mobile app's
#   futurely:// deep-link scheme — do not conflate the two.
```

- [ ] **Step 4: Manual step — add the var locally**

Tell the human partner to add this line to `backend/.env` (agents cannot edit this file):
```
WEB_APP_URL="http://localhost:3000"
```

- [ ] **Step 5: Verify the fix**

Re-run the same Google sign-in flow from Step 2:
```
mcp__playwright__browser_navigate → http://localhost:3000/login
mcp__playwright__browser_click → "Continue with Google" link
... complete Google's consent screen ...
```
Expected (fixed): final URL is `http://localhost:3000/dashboard` (existing user) or `http://localhost:3000/login?oauth=new` (new account, triggers the Terms/Privacy modal per `app/login/page.tsx:97-120`) — a real page loads, not a broken custom-scheme navigation.

Also manually trigger "Forgot password?" on `/login` and confirm (via the backend's dev console-log fallback, since `SMTP_HOST` is blank) that the logged email body now contains an `http://localhost:3000/reset-password?token=...` link instead of `futurely://reset-password?token=...`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/auth.ts backend/.env.example
git commit -m "fix: separate WEB_APP_URL from mobile APP_URL for OAuth/email redirects"
```

---

## Task 5: Configure real Google OAuth credentials for local verification — OPEN

**Files:**
- Manual: `backend/.env` (human-edited only, hard-protected from agent edits)

**Interfaces:**
- Consumes: none
- Produces: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env vars that `backend/src/routes/auth.ts:967-969`'s existing guard (`if (!clientId) { res.status(500)... }`) already checks for — no code change needed, this task is purely configuration + verification

- [ ] **Step 1: Reproduce the current failure**

```
mcp__playwright__browser_navigate → http://localhost:3000/api/auth/oauth/google
```
Expected (current state): `HTTP status: 500`, body `{"error":"Google OAuth not configured"}` — confirmed already during the debugging session.

- [ ] **Step 2: Obtain credentials**

In Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID (type: Web application):
- Authorized redirect URI: `http://localhost:3000/api/auth/oauth/google/callback` (matches the `WEB_APP_URL` from Task 4 + the fixed callback path at `backend/src/routes/auth.ts:979`)

Add to `backend/.env` (manual — human only):
```
GOOGLE_CLIENT_ID="<client id from console>"
GOOGLE_CLIENT_SECRET="<client secret from console>"
```

- [ ] **Step 3: Document in `.env.example`**

```
# backend/.env.example — add
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```
(This file currently documents neither var — a real gap in "documents every backend env var" per `ARCHITECTURE.md`.)

- [ ] **Step 4: Verify**

```
mcp__playwright__browser_navigate → http://localhost:3000/api/auth/oauth/google
```
Expected (fixed): a `302` redirect to `accounts.google.com`'s consent screen, not a 500.

- [ ] **Step 5: Commit**

```bash
git add backend/.env.example
git commit -m "docs: document GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET in .env.example"
```
(Nothing from `backend/.env` itself is ever committed.)

---

## Task 6: Full manual regression pass across the signup/login flow — OPEN

**Files:** none modified — verification only, ties Tasks 1-5 together

**Interfaces:**
- Consumes: the running dev servers (`next dev` on `:3000`, backend on `:3001`) with all of Tasks 1-5 applied
- Produces: a pass/fail readout for this plan as a whole

- [ ] **Step 1: Desktop viewport pass**

```
mcp__playwright__browser_resize → 1280x900
mcp__playwright__browser_navigate → http://localhost:3000/login
mcp__playwright__browser_take_screenshot (fullPage: true)
```
Check: Google button visible and correctly positioned; card corners at 12px radius; no console errors.

- [ ] **Step 2: Mobile viewport pass**

```
mcp__playwright__browser_resize → 375x812
mcp__playwright__browser_navigate → http://localhost:3000/login
mcp__playwright__browser_take_screenshot (fullPage: true)
```
Check: same as Step 1, no overflow/clipping at 375px.

- [ ] **Step 3: Student signup + OTP round trip**

Click "Create one" → fill Display Name/Email/DOB/Password/Confirm/District (Other)/HAC fields → click "Send verification code" → confirm the OTP screen renders "← Back" and "Verify code" buttons → check network log for `POST /api/auth/send-otp` returning `200` within a few seconds (not hanging toward 30s).

- [ ] **Step 4: COPPA gate still enforced**

Repeat Step 3 with a DOB less than 13 years before today. Expected: `403 COPPA_BLOCK` with the existing message, confirming Task 3's restyling didn't touch the age-gate's behavior.

- [ ] **Step 5: Google OAuth end-to-end**

Click "Continue with Google" → complete consent → land on `http://localhost:3000/dashboard` (or the Terms/Privacy modal for a new account) — confirms Tasks 4 and 5 together.

- [ ] **Step 6: Record the outcome**

If every check in Steps 1-5 passes, this plan is complete. If any check fails, stop, do not layer another fix on top — return to that task's Phase 1 (per `superpowers:systematic-debugging`) with the new evidence.

---

## Rollback Considerations

- **Nothing in this plan has been committed yet** (confirmed via `git status --porcelain` showing Tasks 1-3's files as modified-but-unstaged). Until commits happen, rollback for any task is simply:
  ```bash
  git checkout -- app/layout.tsx app/login/page.tsx backend/src/lib/email.ts backend/src/routes/auth.ts backend/.env.example
  ```
- **Once a task is committed** (per its own Commit step), roll it back independently with `git revert <that task's commit sha>` — each task's commit is scoped to exactly the files listed in that task, so reverting one doesn't touch the others.
- **No database migrations are part of this plan** — there is nothing to roll back at the schema level, and no `prisma migrate` command is ever run by this plan.
- **`backend/.env` changes (Tasks 4 & 5) are manual and local** — rollback is just removing the added lines (`WEB_APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) from the human's own `.env` file; nothing agent-side to revert since agents never write to it.
- **Task-scope guardrail changes** (`.claude/guardrails/task-scope.json`) should be narrowed back once this plan ships, per `.claude/context/GUARDRAILS.md`'s guidance to not let scope accumulate across tasks.
- **Risk if Task 4 ships without Task 5:** `WEB_APP_URL` alone doesn't fix the 500 from a missing `GOOGLE_CLIENT_ID` — the two are independent and both are needed for a working "Continue with Google" locally. Task 4 alone still correctly fixes the email verification/password-reset links, so it's safe to ship independently.

---

## Execution Log (subagent-driven-development, 2026-07-17)

All 6 tasks executed and reviewed. Final commits on `mobile-rebuild`: `379de99`, `8ae446b`, `b64158d`, `5323c12`, `5fd53b7`, `7e65fa0`, plus two unplanned reconciliation commits below.

**Deviations from the plan as written:**
- Task 5 reduced to docs-only per user decision — no real Google OAuth credentials were obtained or live-verified this pass; Task 6 Step 5 (Google end-to-end) was skipped for the same reason.
- `.claude/guardrails/protected-paths.json`'s `backend/.env.*` glob turned out to also hard-block `backend/.env.example` (a secret-free template). The user manually narrowed it to explicit variants (`backend/.env.local`, `.production`, `.development`) so Tasks 4/5's `.env.example` edits could proceed.
- **Unplanned commit `cfaf4b5`:** the final whole-branch review (dispatched per this skill's process) found that Task 3's commit (`b64158d`) had unintentionally bundled in pre-existing, unrelated, previously-uncommitted work in `app/login/page.tsx` — the DOB field already being scoped to `register-student` only, plus an OTP/Privacy-modal Back-button rework — because that file wasn't stash-isolated the way `auth.ts` was for Task 4. This left the committed backend (unconditional DOB requirement for every role) inconsistent with the now-committed frontend (DOB sent only for students), breaking parent/teacher signup at `HEAD`. Per the user's decision, the matching pending backend change (COPPA gate scoped to `STUDENT` role only, already sitting uncommitted in the working tree, unrelated to this plan) was committed as `cfaf4b5` to restore consistency. Verified directly via `curl` against `:3001`: parent registration with no DOB now passes the gate; student COPPA block (age < 13) and the missing-DOB 400 both still fire correctly.
- **Unplanned commit `032d606`:** narrowed `task-scope.json` back to mobile-only now that this plan is complete, per the reviewer's Minor finding and `GUARDRAILS.md`.

**Outstanding, not fixed by this plan (explicitly out of scope or requires the user's own action):**
- Real `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` values, and `WEB_APP_URL`, still need to be added to the real `backend/.env` (local) and the production Vercel environment for these fixes to take effect anywhere beyond a machine with them manually set.
- Fallback-domain inconsistency (`https://futurely.app` vs `https://myfuturely.ai`) across different `WEB_APP_URL ??` call sites — pre-existing, not introduced by this plan.
- Incidental finding: frontend password validation requires ≥6 chars, backend requires ≥8 — a 6-7 char password passes the client, then fails at the API with a confusing error. Not one of the original symptoms; flagged only.
