# Futurely — Architecture

This describes the **actual** state of the repo, not an idealized target. If you change the
stack (swap a library, add a service), update this file in the same PR — agents read this
file to decide what patterns to follow, so drift here causes real bugs.

## Monorepo Layout

```
Futurely-main/
├── app/                    # Next.js web app (parent/counselor/educator/admin portal)
├── lib/api.ts              # Web app's API client
├── backend/                # Express API — shared by web AND mobile
│   ├── api/index.ts        # Vercel serverless entrypoint
│   ├── src/routes/*.ts     # One file per resource (flat, not modular — see below)
│   ├── src/integrations/   # classlink/, canvas/, grades/ (HAC) — school system connectors
│   ├── src/lib/            # email.ts, startup.ts, supabaseAdmin.ts, etc.
│   └── prisma/schema.prisma + hand-authored migrations
└── vercel.json             # Single Vercel project serves both app/ and backend/
```

`npm run dev` at the repo root starts the **web** app (`next dev`) + backend concurrently.

## Mobile App — moved to its own repo

The Expo / React Native mobile app no longer lives in this repo. As of 2026-07-17 it was
split out (via `git subtree split`, preserving full commit history) into
**https://github.com/Pilotsoma/Futurely-mobile**. It still talks to this repo's `backend/`
over HTTP — nothing about the backend API contract changed, only where the client code
lives. See that repo's own `.claude/context/ARCHITECTURE.md` for mobile-specific details
(navigation structure, state management, API client behavior, the `API_BASE_URL`
dev-environment gotcha, etc.) — a duplicated copy of the same content that used to live in
this section now lives there, tailored to that repo's layout.

If you're working on the backend and need to reason about what the mobile client expects
from an endpoint, clone the mobile repo separately rather than assuming — this repo no
longer contains that source.

## Backend (`backend/`)

- **Runtime:** Node.js + **Express** (not NestJS — no modules/decorators/DI container).
  Routes are flat files under `src/routes/*.ts` (one per resource: `auth`, `students`,
  `grades`, `assignments`, `ai`, `parent`, `counselor`, `educator`, `colleges`, `roadmap`,
  `schools`, `sets`, `marketplace`, `feed`, `games`, `calls`, `notifications`, `admin`).
- **Validation:** `zod` — not `class-validator`/DTOs. Validate at the route boundary with a
  Zod schema.
- **Auth:** Custom JWT (`jsonwebtoken`) + `bcryptjs` password hashing + refresh token
  rotation. `ENABLE_DEV_INTEGRATION_AUTH_BYPASS` env flag exists for local Expo Go testing
  without a full login flow — dev-only, must be `false` in production.
- **Deployment:** Vercel. `vercel.json` uses `experimentalServices` to run the Next.js app at
  `/` and the Express backend (`backend/api/index.ts`) at `/api` in the same project — not
  separate AWS App Runner/Railway services.
- **Database:** PostgreSQL via **Prisma** + `@prisma/adapter-neon` +
  `@neondatabase/serverless` — a **live Neon cloud Postgres**, not a local or Supabase-hosted
  DB. See [[futurely-db-and-migrations]]: never run `prisma migrate dev` against it; hand-author
  migration SQL and let `prisma migrate deploy` apply it on startup.
- **Supabase:** `@supabase/supabase-js` is present but used narrowly as an admin/service-role
  client (`src/lib/supabaseAdmin.ts`, used from `students.ts` and `counselor.ts`) — it is
  **not** the primary datastore and there is no Supabase Realtime in this codebase.
- **Cache/queue:** none. No Redis, no Upstash, no background job queue — integration syncs
  run as async work within the request process (see `gradesRouter.ts` background sync
  pattern), not isolated worker processes.
- **School system integrations:** `src/integrations/{classlink,canvas,grades}/` — HAC
  (Home Access Center) via server-side scraping (`cheerio` + `axios-cookiejar-support` +
  `tough-cookie` session jar), ClassLink and Canvas via their connectors in the same
  directory. Stored school credentials are encrypted with AES-256-GCM
  (`CREDENTIAL_ENCRYPTION_KEY` env var) and persisted in Postgres.
  **⚠️ Known doc mismatch:** ENGINEERING_RULES.md, COMPLIANCE.md, and the
  backend/integration agent prompts say school credentials "must never be stored in the
  database — Secrets Manager only." The actual implementation stores them encrypted *in* the
  database instead; there is no secrets manager. This is a real policy/architecture gap, not
  just stale docs — surface it to the user/architect before either "fixing" the code to add a
  secrets manager or relaxing the written policy. Don't silently pick a side.
- **Real-time / calls:** `livekit-server-sdk` + `ws` power the "My Counselor" live audio/video
  call feature (`routes/calls.ts`) — this is the only real-time transport in the app.
- **Email:** `nodemailer` over SMTP (`src/lib/email.ts`); with SMTP env vars blank, dev mode
  logs emails to console instead of sending.
- **File storage:** no AWS S3 / cloud storage bucket integration exists in this codebase.

## AI Layer

Four provider SDKs are dependencies, used across `routes/ai.ts` and `routes/parent.ts`:
`@anthropic-ai/sdk` (Claude), `openai` (also used to call **OpenRouter**, which is
OpenAI-API-compatible, via `OPENROUTER_API_KEY`), and `@google/generative-ai` (Gemini). This
is not a single-provider "Claude or OpenAI" choice — check which route/service actually calls
which provider before assuming. AI runs server-side only; no LLM API keys ship to the mobile
app or web bundle.

## Environments & Secrets

- Three logical environments: local dev, Vercel preview deployments, Vercel production.
- Secrets live in **Vercel Environment Variables** per environment — there is no AWS Secrets
  Manager, Doppler, or Vault in this project. `devops-engineer` guidance that assumes a
  dedicated secrets manager should be adapted to "Vercel env vars" for this repo.
- `backend/.env.example` documents every backend env var and how to generate secrets
  (`JWT_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`, SMTP, HAC test account, `OPENROUTER_API_KEY`).
  Mobile has no `.env` — `API_BASE_URL` is a hardcoded constant (see above).

## Security Constraints (actual, enforced today)

- Passwords hashed with bcryptjs; JWTs signed with `JWT_SECRET`.
- School integration credentials encrypted at rest with `CREDENTIAL_ENCRYPTION_KEY`
  (AES-256-GCM) — see the credential-storage gap noted above.
- CORS restricted via `ALLOWED_ORIGINS` in production; mobile-only deployments can leave it
  blank.
- `ComplianceAuditLog` model and COPPA fields (`dateOfBirth`, `coppaConsentStatus`,
  `coppaConsentTimestamp`, `coppaParentEmail`) exist on the `User`/related model in
  `prisma/schema.prisma` — COPPA fields were added via the
  `20260705000000_add_coppa_fields` migration on this branch. Verify current field names and
  which routes actually write to `ComplianceAuditLog` before assuming full coverage —
  COMPLIANCE.md describes the required policy; check the schema/routes for what's actually
  wired up before asserting a specific endpoint is (non-)compliant.
