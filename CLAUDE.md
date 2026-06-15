# NextStep — Claude Code Agent System

You are working on **NextStep**, an AI-powered academic companion for high school students.
Before doing anything else, read all context files below. They define what you are building,
how the system is designed, and what rules every piece of code must follow.

## Read These First (every session)

- `.claude/context/PROJECT.md` — what NextStep is, MVP features, roadmap
- `.claude/context/ARCHITECTURE.md` — full system design, module boundaries, tech stack
- `.claude/context/ENGINEERING_RULES.md` — code standards that apply to everything
- `.claude/context/DESIGN_SYSTEM.md` — colors, typography, component standards
- `.claude/context/COMPLIANCE.md` — FERPA/COPPA rules for student data (mandatory)

## Agent Roles

When asked to act as a specific agent, load that agent's definition from `.claude/agents/`:

| Agent | File | Scope |
|-------|------|-------|
| Lead Architect | `.claude/agents/lead-architect.md` | Design, review, approve |
| Backend Engineer | `.claude/agents/backend.md` | NestJS, Prisma, API |
| Frontend Engineer | `.claude/agents/frontend.md` | React Native, RTK Query |
| UI Engineer | `.claude/agents/ui.md` | Components, styling |
| Integration Engineer | `.claude/agents/integration.md` | Canvas, HAC, Skyward |
| AI Engineer | `.claude/agents/ai-engineer.md` | Prompts, LLM calls |
| QA Engineer | `.claude/agents/qa.md` | Tests, security, verdicts |
| DevOps Engineer | `.claude/agents/devops.md` | CI/CD, AWS, deployment |

## Prototype Stack (what we are actually building right now)

This is a **prototype**. Use this simplified stack — not the full production stack:

| Layer | Prototype Choice | Why |
|-------|-----------------|-----|
| Frontend | React Native (Expo Go) | Run on phone instantly, no build needed |
| Backend | Express.js + TypeScript | Simple, fast to set up |
| Database | SQLite via Prisma | Zero setup, file-based, no cloud needed |
| Auth | Hardcoded test user | Skip Firebase for now |
| AI | Ollama (local) or skip | Free, runs on your machine |
| Storage | Local filesystem | No S3 needed yet |
| Deploy | Expo Go (mobile) + localhost (API) | Test on your phone today |

**Goal:** A working app on your phone with real screens and real data flow.
Not production-ready — just real enough to demo and validate.

## Current MVP Scope (build in this order)

1. **Auth screen** — login form, hardcoded test credentials, navigate to dashboard
2. **Dashboard** — GPA summary card, list of today's assignments, bottom tab nav
3. **Grade Viewer** — list of subjects with letter grades, GPA calculated from them
4. **GPA Simulator** — sliders to change grades, GPA recalculates in real time
5. **Smart Planner** — list of assignments with due dates, mark complete

## Prototype Rules

- Seed the database with realistic fake data (no real school system connections yet)
- Every screen needs loading state, error state, empty state
- Mobile-first: everything must work at 375px width
- No placeholder functions — every button does something real
- TypeScript throughout — no `any`
