# Claude Code — Project Orchestrator

This file is the master configuration for every Claude Code session on this project.
Read it completely before doing any work.

---

## Session Start Protocol

At the start of EVERY new session, before touching any file, ask the user these questions.
Do not skip this — the answers change how you work.

### Question 1 — What are we doing today?
> "What do you want to build, fix, or change today?
> (New feature / bug fix / refactor / review / sprint / something else?)"

Wait for their answer. If it's vague ("work on the app"), ask a clarifying follow-up:
> "Which part — backend, frontend, mobile, AI features, integrations, or infrastructure?"

### Question 1a — Declare task scope (guardrail system)
Immediately after Question 1 is answered, update `.claude/guardrails/task-scope.json`'s
`in_scope` array with glob patterns covering the files/dirs this task will touch. A
`PreToolUse` hook (`.claude/hooks/guard-protected-paths.js`) enforces this: any `Edit`/
`Write` on an existing, git-tracked file that isn't in scope triggers a permission
prompt instead of running silently, and a fixed list of paths (env files, lockfiles,
applied migrations, the guardrail config itself) is always denied outright regardless of
scope. New/untracked files are never blocked. See `.claude/context/GUARDRAILS.md` for
the full policy. Narrow or clear `in_scope` back to `[]` when the task wraps up.

### Question 2 — What MCP tools do you have active?
> "Are any MCP tools connected right now? For example:
> - **Database tool** — I can query your database directly, verify schema, and check live data
> - **GitHub MCP** — I can create PRs, check CI status, read and comment on issues
> - **Playwright / Browser** — I can open the running app and test UI flows live
> - **Filesystem / Shell** — I already have these built-in via Read, Edit, Write, Bash
>
> Type `/mcp list` in the Claude Code terminal to see what's active.
> If none are connected, I'll flag which ones would most help your current task."

### Question 3 — Are your services running? (ask only if task requires it)
If the task involves backend code or testing:
> "Quick check before I write backend code:
> - Is your database running and reachable? (This project's `DATABASE_URL` points at a
>   **live Neon Postgres** — it can be unreachable if it's scaled to zero. Never run
>   `prisma migrate dev` against it; see ARCHITECTURE.md.)
> - Do you have all required env vars set (see `backend/.env.example`)?
> - Is the local dev server running (`npm run dev` at repo root starts web + backend, but
>   NOT the mobile app)?
> I'll need these to verify changes work."

If the task involves the **mobile app** (`nextstep-mobile/`):
> "Quick check before I touch mobile code:
> - Is the Expo dev server running? (`cd nextstep-mobile && npm start`, separate from the
>   root `npm run dev`.)
> - Are you testing on a physical device (Expo Go), iOS Simulator, or Android Emulator?
> - Does `nextstep-mobile/src/constants/api.ts` `API_BASE_URL` currently point at a host your
>   device/simulator can actually reach? (Physical device → your computer's LAN IP; Android
>   emulator → `10.0.2.2`; iOS simulator → `localhost`.) This is hardcoded per-developer and
>   the most common reason the app can't reach the backend.
> - Is the backend server it's pointing at actually running?
> I'll need these to verify mobile changes work."

---

## Tools That Would Accelerate This Project

If the user hasn't mentioned these, proactively recommend them based on what they're working on:

| Tool | What it unlocks | When to recommend |
|------|----------------|-------------------|
| **Database MCP** | I can directly inspect schema, run queries, verify migrations, and check live data — instead of inferring everything from Prisma schema files | Anytime we're changing the database or debugging data issues |
| **GitHub MCP** | I can create PRs, check CI status, read open issues, and post comments without switching to the browser | Anytime we're near shipping or reviewing code |
| **Chrome DevTools MCP** (`claude-in-chrome`) | I can drive the web app (`app/`) directly, and inspect the Expo Metro bundler's web dev-tools page | Web-portal work, or checking Metro/bundler state via its browser UI |
| **Computer-use MCP** | I can screenshot and interact with the iOS Simulator or Android Emulator window on your desktop directly — the closest thing to a live device-testing loop available here | Any mobile screen/navigation work where you want me to actually see and tap through the running app, not just review code |

There is no dedicated "Expo MCP" connected in this environment — mobile verification goes
through the computer-use MCP driving a running Simulator/Emulator window, not a
device-log-streaming tool. If you want real-time device logs beyond what's visible in the
Metro terminal output, that's a manual copy/paste from your terminal into the conversation.

> To add an MCP tool: run `/mcp` in Claude Code or open `.claude/settings.json`.
> I can help you configure any of these if you want to add one.

---

## Mandatory Context: Read Before Every Session

Read these files at the start of every session, in this order:

1. `.claude/context/PROJECT.md` — product vision, current phase, what's in/out of scope
2. `.claude/context/ARCHITECTURE.md` — tech stack, module boundaries, data flows
3. `.claude/context/ENGINEERING_RULES.md` — code standards (apply to all agents, non-negotiable)
4. `.claude/context/COMPLIANCE.md` — regulatory and data-handling requirements (read before any user-data work)
5. `.claude/context/DESIGN_SYSTEM.md` — colors, typography, component standards (frontend/UI work only)
6. `.claude/context/GUARDRAILS.md` — how the protected-file hook works and how to declare task scope (read before any edit)
7. `.claude/context/PLUGINS.md` — which enabled marketplace plugin reinforces which project agent

If any context file is missing or noticeably outdated, tell the user before proceeding:
> "The context file [filename] seems missing / hasn't been updated since [date]. 
> Should I update it to reflect the current state of the project before we continue?"

---

## Agent Routing

Use subagents for all substantial implementation work. A "substantial" task is anything touching more than 2 files or requiring a design decision. For single-file, clearly-scoped fixes, handle inline.

Route tasks as follows:

| Task type | Primary agent | Notes |
|-----------|--------------|-------|
| New feature — design & planning | `architect` | Always invoke first |
| Existing feature — architecture question or scope change | `architect` | Before writing any code |
| API routes, DB schema, business logic, background jobs | `backend-engineer` | — |
| Mobile screens, web pages, navigation, data fetching | `frontend-engineer` | — |
| UI components, animations, accessibility audit | `ui-engineer` | After frontend-engineer |
| Third-party API, OAuth, web scraper, sync worker | `integration-engineer` | — |
| AI prompts, LLM calls, structured outputs, fallback logic | `ai-engineer` | — |
| Tests, security review, compliance audit, verdicts | `qa-engineer` | Always last before shipping |
| CI/CD, deployment config, cloud infra, env vars | `devops-engineer` | When infra changes needed |
| Bug triage, design disagreement, final approval | `architect` | Always last for sign-off |

---

## Standard Feature Workflow

For any new feature, follow this sequence. Do not skip steps.

```
1. architect            → design, task breakdown, compliance check
2. backend-engineer     → API routes + database + business logic
3. integration-engineer → external connectors (skip if no third-party integration)
4. ai-engineer          → prompts + LLM calls + validation (skip if not an AI feature)
5. frontend-engineer    → screens + state management + API wiring
6. ui-engineer          → component polish + skeleton states + accessibility
7. qa-engineer          → test suites + security review + compliance audit + verdict
8. devops-engineer      → CI/CD + deploy config (skip if no new infrastructure)
9. architect            → final approval → SHIP
```

Each agent's output must end with a **Handoff Block** (see format below).
If an agent delivers output without a handoff block, ask for it before routing to the next agent.

---

## Handoff Block Format (enforced across all agents)

Every agent output must end with exactly this:

```
---
FILES CHANGED:
- path/to/file.ts (created|modified|deleted)

DEPENDENCIES ADDED:
- package@version (or "none")

MIGRATIONS REQUIRED:
- [describe what the migration does] (or "none")

ENV VARS REQUIRED:
- VAR_NAME=description (or "none")

NEXT AGENT:
- [agent-name]: [specific instruction for what they need to do next]
```

---

## Escalation Rules

| Situation | What to do |
|-----------|------------|
| QA issues a BLOCK verdict | Stop all work immediately. Invoke `architect`. Do not ship anything. |
| Any compliance question (COMPLIANCE.md) | Invoke `architect` for a ruling before writing any code |
| Two agents produce conflicting designs | Invoke `architect` to decide. Document the decision as an ADR. |
| Requirement is ambiguous or unclear | Ask the user to clarify before dispatching any agent |
| A required env var or external service is missing | Ask the user before proceeding — do not stub around it silently |
| Any secret or credential appears in source code | Invoke `qa-engineer` to BLOCK. Invoke `architect` to review. Do not commit. |
| Feature is outside the current phase scope (PROJECT.md) | Flag it to the user and invoke `architect` to approve scope expansion |

---

## What I Track Between Agent Calls

After each agent produces output, I maintain a running context for this session:
- Which agents have run and what they produced
- Current list of files changed
- Any open blockers or REVISE/BLOCK verdicts
- Environment variables that need to be added

If the session gets long, I'll summarize the current state before routing to the next agent so nothing is lost.

---

## Quick Reference: Slash Commands

These commands are available via the `.claude/commands/` folder:

| Command | What it does |
|---------|-------------|
| `/project:new-feature` | Starts the full 9-step workflow for a new feature |
| `/project:diagnose` | Audits the current codebase state and surfaces issues |
| `/project:fix` | Targeted bug fix: identify root cause → fix → verify |
| `/project:sprint` | Plans and executes a batch of features in priority order |
| `/project:review` | Code, security, and compliance review of recent changes |

---

## Project-Specific Notes

> **Add any project-specific context here that doesn't belong in a context file.**
> Examples: known quirks, temporary workarounds, decisions that surprised you, external service limitations.
> Keep each note short. If it grows long, move it to a context file.

- See `.claude/context/PROJECT.md` for current MVP scope and phase
- See `.claude/context/ARCHITECTURE.md` for full tech stack details (rewritten to match the
  actual Express/Prisma/Expo stack — the old version described a fictional NestJS/Firebase
  stack; if ARCHITECTURE.md ever drifts from the code again, fix it before trusting it)
- See `.claude/DIAGNOSTIC_REPORT.md` for known integration blockers
- `nextstep-mobile/` is the real mobile app. `nextstep-mobile/Futurely/` is an unrelated,
  nested Expo starter template with its own `node_modules`, excluded from `tsconfig.json` —
  don't edit it or treat it as part of this product.
- No `lint` script exists in any package; run `npx eslint app components lib` with the root
  flat config if you need to lint the web app.
- `backend/.env`'s `DATABASE_URL` points at a **live Neon Postgres** — never run
  `prisma migrate dev` locally (can prompt a destructive reset). Hand-author migration SQL
  under `backend/prisma/migrations/` and let `prisma migrate deploy` (part of `npm start`)
  apply it.
- No test runner (Jest/Detox/Playwright) is installed anywhere in this repo yet, despite
  ENGINEERING_RULES.md describing target testing standards — verify before claiming tests ran.
- `nextstep-mobile/AGENTS.md` currently tells every session to fetch Expo's "v56.0.0" versioned
  docs before writing any code — the pinned Expo version in `package.json` is `^54.0.35`, so
  that instruction points at the wrong SDK version. Treat it as unreliable until updated;
  check `package.json` for the real version instead of fetching that URL.
- A `PreToolUse` hook now guards every `Edit`/`Write` against silently touching existing,
  working, git-tracked code — see `.claude/context/GUARDRAILS.md`. Declare task scope in
  `.claude/guardrails/task-scope.json` before editing existing files, or expect an `ask`
  permission prompt. A fixed list in `.claude/guardrails/protected-paths.json` (env files,
  lockfiles, applied Prisma migrations, the guardrail config itself) is denied outright no
  matter what.
- The plugin marketplace catalog described in the user's downloaded `message.txt` maps onto
  the 9 plugins actually enabled in `.claude/settings.json` — see `.claude/context/PLUGINS.md`
  for the mapping and routing table. Don't scaffold a local copy of the marketplace's folder
  tree; it isn't how Claude Code loads plugins and it would drift immediately.
