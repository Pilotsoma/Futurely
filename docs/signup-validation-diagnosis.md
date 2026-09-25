# Signup / Onboarding Validation — Diagnosis

Date: 2026-09-25. Scope: email/password signup on web (`app/login/LoginForm.tsx`) and
mobile (`nextstep-mobile/src/screens/LoginScreen.tsx`), backed by `backend/src/routes/auth.ts`.
Line numbers refer to the code **before** the fixes below.

## 1. Flow map

Both clients keep every signup step as component state inside a single screen. There are
no per-step URLs (web) or per-step navigator routes (mobile), so a user cannot deep-link
into a later step; the only way to skip a step is the client's own advance logic.

### Web (`app/login/LoginForm.tsx`)

| # | Step | UI | API call | Server validates |
|---|------|----|----------|------------------|
| 1 | Form: name, email, password, confirm, DOB (student), school portal (student) | `registerStep === 'form'` (L390–592) | `POST /auth/send-otp` `{ email }` (L190) | email format, MX, email taken **only** |
| 2 | Code: 6-digit code | `registerStep === 'otp'` (L364–388) | **none**: only checks `length === 6` then opens Terms (L200–211) | nothing |
| 3 | Terms modal: ToS, privacy, age | `showPrivacyModal` (L680–772) | `POST /auth/register` (L220–224) | password, name, consent, DOB, email/name taken, code |

### Mobile (`nextstep-mobile/src/screens/LoginScreen.tsx`)

| # | Step | UI | API call | Server validates |
|---|------|----|----------|------------------|
| 1 | Age: DOB | `registerStep === 'dob'` (L802–846) | none | client-only 13+ check |
| 2 | Account: name, email, password, code | `registerStep === 'account'` (L848–972) | `POST /auth/send-otp` `{ email }` (L400) | email only |
| 3 | Finish: ToS, privacy | `registerStep === 'terms'` (L974–1023) | `POST /auth/register` via `AuthContext.register` (L435) | everything |

### When the user row is created

Only inside `POST /auth/register`, in the `prisma.$transaction` at `auth.ts:372–412`,
after every check (password, name, consent, DOB, uniqueness, code) has passed. **No
account is created early.** The "account appears to get created before the password is
validated" symptom is really that the server checks the password for the **first** time
on the final step, so the user fills in every step before learning that step 1 was invalid.

## 2. Rules table (before)

| Rule | Location | Value | Mismatch |
|------|----------|-------|----------|
| Password min length | `backend/src/routes/auth.ts:106` | 8 | — (source of truth) |
| Password uppercase | `backend/src/routes/auth.ts:107` | ≥1 `[A-Z]` | — |
| Password number | `backend/src/routes/auth.ts:108` | ≥1 `[0-9]` | — |
| Password max length | none | unbounded | no cap anywhere |
| Password min (web) | `app/login/LoginForm.tsx:180` | **6** | ❌ 6 vs 8; no uppercase/number check |
| Password placeholder (web) | `app/login/LoginForm.tsx:412` | "At least **6** characters" | ❌ |
| Password `minLength` (web) | `app/login/LoginForm.tsx:413` | **6** | ❌ |
| Password min (mobile) | `nextstep-mobile/src/screens/LoginScreen.tsx:391` | 8 | ❌ no uppercase/number check |
| Password hint (mobile) | `LoginScreen.tsx:883, 916, 920` | hardcoded 8 | ⚠ hardcoded |
| Password (web reset page) | `app/reset-password/page.tsx:27–31` | 8 + upper + number | ⚠ duplicated copy |
| Confirm password | `LoginForm.tsx:179` (web only) | must match | — |
| Email format | `auth.ts:260, 644, 1301` | `^[^\s@]+@[^\s@]+\.[^\s@]+$` | ⚠ copied 3×; not trimmed or lowercased anywhere |
| Email format (web) | `LoginForm.tsx:405` | browser `type=email` | ⚠ different rule |
| Email format (mobile) | none | only non-empty (L386) | ❌ |
| Code generator | `auth.ts:1318` | 6 digits, `Math.random` | — |
| Code expiry | `auth.ts:1084` | 10 min | — |
| Code (web) | `LoginForm.tsx:203` | length 6 | ⚠ never checked against the server |
| Code (mobile) | `LoginScreen.tsx:414` | non-empty | ❌ |
| Display name | `backend/src/lib/contentFilter.ts:214–221` | trimmed 2–30, reserved names, profanity | — (source of truth); no character-set rule |
| Display name unique | `auth.ts:335` + `schema.prisma` `name @unique` | case-sensitive | — |
| Display name required | `auth.ts:286` | optional for everyone | ⚠ web requires it for parent/teacher via HTML `required` only (L399) |
| Display name (web/mobile) | none | none | ❌ |

## 3. Advance logic (before)

| Step | Code that advances | Gated on client validation? | Gated on server success? |
|------|--------------------|-----------------------------|--------------------------|
| Web form → code | `setRegisterStep('otp')` after `await api.sendOtp(...)` (L190–192) | Partly (6-char password, stale) | Yes, but the server only checked the email |
| Web code → Terms | `setShowPrivacyModal(true)` (L210) | length 6 only | **No: there's no server call** |
| Web Terms → app | `router.push(...)` after `await api.register(...)` (L220–269) | checkboxes | Yes |
| Mobile DOB → account | `setRegisterStep('account')` (L380) | 13+ | No server call (DOB checked at register) |
| Mobile account → Finish | `setRegisterStep('terms')` (L420) | code non-empty only | **No: there's no server call** |
| Mobile Finish → app | `AuthContext.register` sets `status='authenticated'` (L435) | checkboxes | Yes |

No step advances from a `finally` block, and every existing `await` is honoured. The bug is
missing server checks, not a race.

## 4. Error handling (before)

| Call | Catch | Where shown |
|------|-------|-------------|
| Web `sendOtp` | `LoginForm.tsx:193` → `setError(msg)` | one generic banner above the button. No field mapping |
| Web `register` | `LoginForm.tsx:270–287` → `setError(msg)` | modal footer (L740). Password/code/name errors appear on the **Terms modal**. If the modal is closed, the code step is showing, and it doesn't render `error`, so the message is lost |
| Mobile `sendOtp` | `LoginScreen.tsx:402` → `setRegisterError` | banner on the account step |
| Mobile `register` | `LoginScreen.tsx:445–463` | banner on the **Finish** step, whichever field was wrong |
| Web `ApiError` (`lib/api.ts:20`) | parses `code`, `message` | drops any `field` |
| Mobile `ApiRequestError` (`nextstep-mobile/src/api/client.ts:13, 48`) | parses `code`, `message` | drops any `field` |

## 5. Root causes

1. **Web password rule is stale (6 vs 8 + uppercase + number):** `app/login/LoginForm.tsx:180, 412, 413`.
2. **Mobile password rule is incomplete (length only):** `nextstep-mobile/src/screens/LoginScreen.tsx:391`. `Password1` passes but `password1` also passes client-side and is rejected on Finish.
3. **No server validation of password, display name, or DOB before the final step:** `POST /auth/send-otp` (`backend/src/routes/auth.ts:1299–1341`) checks the email only, so `/auth/register` (`auth.ts:277, 288, 317`) is the first place these rules run.
4. **The verification code is never checked on the code step:** no verify endpoint exists. Web `handleVerifyOtp` (`LoginForm.tsx:200–211`) and mobile `handleAccountContinue` (`LoginScreen.tsx:413–421`) advance without a server call.
5. **Wrong and expired codes are indistinguishable:** `auth.ts:357–365` returns one `INVALID_OTP` "Invalid or expired" message. There's no attempt limit specific to code guessing.
6. **Display name has no client rules and no character-set rule:** `contentFilter.ts:214`. Nothing on web/mobile.
7. **Server errors carry no `field`, and clients can't route them back:** `lib/api.ts:112–120`, `nextstep-mobile/src/api/client.ts:48–56`, `LoginForm.tsx:270–287`, `LoginScreen.tsx:445–463`.
8. **Pasting a code is truncated:** `maxLength={6}` runs before non-digits are stripped, so a pasted `123 456` becomes `12345` (`LoginForm.tsx:376–377`, `LoginScreen.tsx:934`).
9. **Email isn't normalised:** `auth.ts:260, 334, 1312, 1322` use the raw string, so `Me@X.com` and `me@x.com` are different accounts and different code records.
10. **The rules are duplicated in 3+ places** (see the table), with no shared module.

Not a root cause: account creation timing (see §1). Also noted: the code generator used
`Math.random` (`auth.ts:1318`).

## 6. Fix approach

- **Account creation:** keep **Option A**, which is what the code already does. The user
  is still created only in `/auth/register`. Every rule now also runs on the step that
  collects it, so register is never the first place a rule is enforced. Register keeps
  re-checking everything, because the server can't trust that a client ran the earlier
  steps. That check is now a backstop, not the first line. The code is consumed inside
  the same transaction that creates the user, so a failed create no longer burns the code.
- **Shared module:** `backend/src/shared/signupValidation.ts`. It is dependency-free
  TypeScript: `zod` is installed only in `backend/`, and neither the Next.js build nor
  Metro can resolve backend's `node_modules`. Placing it inside `backend/src` keeps
  backend's `rootDir`/`dist` layout and the Render (`rootDir: backend`) build unchanged.
  - Web imports it via the existing `@/*` path alias (`@/backend/src/shared/...`).
  - Mobile imports it by relative path. `nextstep-mobile/metro.config.js` adds that one
    folder to `watchFolders`.
- **No Prisma schema change.** "Too many attempts" uses an `express-rate-limit` limiter on
  the new verify endpoint, the same mechanism every other auth limiter uses. The resend
  cooldown is derived from the existing `EmailOTP.createdAt`.

## 7. Fixes applied

| # | Root cause | Fix | Files |
|---|-----------|-----|-------|
| 1, 2, 10 | Stale or incomplete password rules on each client; rules duplicated in several places | One dependency-free rules module. Every client, the reset page, and the backend import it. The UI hint text comes from `PASSWORD_REQUIREMENTS` / `PASSWORD_PLACEHOLDER` | `backend/src/shared/signupValidation.ts` (new), `app/login/LoginForm.tsx`, `app/reset-password/page.tsx`, `nextstep-mobile/src/screens/LoginScreen.tsx`, `backend/src/lib/contentFilter.ts` |
| 3 | The server first checked password, name, and DOB at `/register` | `POST /auth/send-otp` now runs every account-step rule it receives (password, name format + profanity/reserved + uniqueness, DOB) **before** emailing a code. `/register` re-runs all of them as a backstop | `backend/src/routes/auth.ts` |
| 4 | The code was never checked on the code step | New `POST /auth/verify-otp` checks the code without consuming it. Both clients await it before advancing | `backend/src/routes/auth.ts`, `lib/api.ts`, `nextstep-mobile/src/api/authApi.ts`, both screens |
| 5 | Wrong and expired codes were indistinguishable; no attempt limit | `checkSignupOtp` compares against the newest active code: wrong → `400 INVALID_OTP`, expired → `410 OTP_EXPIRED`. A failed-guess limiter returns `429 TOO_MANY_ATTEMPTS`. Resend cooldown is 30 s, from `EmailOTP.createdAt` | `backend/src/routes/auth.ts` |
| 6 | No client display-name rules; no character-set rule | Shared `validateDisplayName`: trimmed, 2–30 chars, not whitespace-only, letters (incl. accented)/digits/space/`. _ - '`. The server adds the reserved-name/profanity filter and uniqueness | shared module, `auth.ts` |
| 7 | Errors had no `field`, and clients couldn't route them | Signup endpoints return `{ data: null, error: { code, field, message } }`. `ApiError` / `ApiRequestError` carry `field`. `applySignupError` sends the user back to the step that owns the field and shows the error under that field | `auth.ts`, `lib/api.ts`, `nextstep-mobile/src/api/client.ts`, both screens |
| 8 | Paste truncation | `maxLength` removed from code inputs. `normalizeOtp` strips non-digits, then caps at 6 | both screens |
| 9 | Email not normalised | Emails are trimmed and lowercased on send-otp, verify-otp, and register. Login and forgot-password use `findUserByEmail`, which prefers an exact match and falls back to the normalised form in one query, so older mixed-case accounts still sign in | `auth.ts`, both screens |
| — | Race conditions | The code is claimed inside the user-creation transaction (`updateMany … usedAt: null`). A `P2002` unique violation maps to `409` on `email`/`name` instead of `500`. Both clients guard against double-submits with an in-flight ref | `auth.ts`, both screens |

Also: the code generator now uses `crypto.randomInt` instead of `Math.random`.

Continue buttons are disabled while their step is invalid or a request is in flight. Every
advance happens only after an awaited successful response; none happens in a `finally`.

### Deliberately unchanged

- **Login validation:** "not empty" only; the new password policy is not applied.
- **Register still re-validates everything.** It's no longer the *first* check, but the
  server can't trust that a client ran the earlier steps.
- **Student display name stays optional.** That's current backend and product behavior.
  Empty is allowed; whitespace-only is rejected. Parent/teacher names are required, now
  enforced server-side too.
- **No per-step routes to guard.** Both platforms keep steps in component state, and the
  mobile deep-link config has only `login`, so there's no URL or deep link to a later step.
- **OAuth account linking (`finishOAuth`)** still matches email exactly. It's a follow-up
  candidate to use `findUserByEmail` there as well.
- **"Too many attempts" is per instance.** It's limited per IP by the in-memory
  `express-rate-limit`, like every other auth limiter here. There's no per-code attempt
  counter, because that would need a Prisma schema change.
