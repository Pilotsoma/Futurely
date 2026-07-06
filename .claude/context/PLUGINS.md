# Plugin Reference & Routing

This maps the plugin catalog described in your `message.txt` onto what's actually
enabled in this project, and tells agents which plugin/agent to reach for per task type.

## Two different things, same naming family

`message.txt` is a folder-tree listing for a plugin marketplace repo (a "claude-agents"
style catalog, 88 plugins total — `python-development/`, `backend-development/`,
`security-scanning/`, `c4-architecture/`, etc., each with its own `agents/`, `commands/`,
`skills/`). That tree is the *source repository* for a marketplace, not files that live
inside this project.

This project's `.claude/settings.json` has 9 plugins **enabled** from a marketplace
registered as `claude-code-workflows`:

| Enabled plugin | Covers |
|---|---|
| `full-stack-orchestration` | cross-cutting feature orchestration |
| `backend-development` | API routes, DB schema, business logic |
| `frontend-mobile-development` | mobile screens, web pages, navigation, data fetching |
| `javascript-typescript` | JS/TS language-specific patterns |
| `ui-design` | component polish, accessibility, design system adherence |
| `unit-testing` | test suites (note: no test runner is installed yet — see `CLAUDE.md`) |
| `debugging-toolkit` | bug triage, root-cause analysis |
| `git-pr-workflows` | commits, PRs, review workflow |
| `security-scanning` | security audits, SAST |

The plugin names match closely enough (`backend-development`, `security-scanning`, and
message.txt's naming conventions like `backend-architect.md`, `security-auditor.md`) that
these are very likely the same catalog family — but this can't be confirmed from inside
this session, since the actual plugin source files (the marketplace cache) live outside
this project directory and outside what this sandbox can see. To confirm the exact
source repo and see all 88 available plugins (not just the 9 enabled here), run
`/plugin marketplace list` and `/plugin list` in your real Claude Code terminal.

**Practical consequence:** don't scaffold a duplicate `claude-agents/plugins/...` folder
tree inside this repo. It would just be a static mirror with no connection to how Claude
Code actually loads plugins, and it'd drift from the real marketplace immediately. If you
want additional plugins from the other 79 in the catalog (e.g. `python-development`,
`c4-architecture`), enable them the normal way — `/plugin install <name>@claude-code-workflows`
(or whatever marketplace they resolve to) — and then add a row to the table above and to
`CLAUDE.md`'s Agent Routing table so future sessions know to route to them.

## Routing

This project's own agent roster (`.claude/agents/*.md`) is the primary router — see
`CLAUDE.md`'s **Agent Routing** table for `architect`, `backend-engineer`,
`frontend-engineer`, `ui-engineer`, `integration-engineer`, `ai-engineer`, `qa-engineer`,
`devops-engineer`. Treat the enabled marketplace plugins above as *reinforcement* for
those roles, not a replacement:

| Task type | Project agent (primary) | Reinforcing plugin |
|---|---|---|
| API routes, DB schema, business logic | `backend-engineer` | `backend-development` |
| Mobile screens, web pages, navigation | `frontend-engineer` | `frontend-mobile-development` |
| UI polish, accessibility | `ui-engineer` | `ui-design` |
| Tests | `qa-engineer` | `unit-testing` (no runner installed — flag this before claiming tests ran) |
| Security / compliance review | `qa-engineer` | `security-scanning` |
| Bug triage | `architect` / inline | `debugging-toolkit` |
| Git commits, PRs | whichever agent is active | `git-pr-workflows` |
| Multi-step feature spanning several of the above | `architect` orchestrates | `full-stack-orchestration` |
| JS/TS-specific idioms | whichever agent is active | `javascript-typescript` |

If a task needs a plugin that isn't enabled (e.g. Python-specific work needing
`python-development`, or architecture-diagramming needing `c4-architecture`), say so
explicitly rather than working around it — per `CLAUDE.md`'s escalation rule for missing
tools/services, ask the user before proceeding.
