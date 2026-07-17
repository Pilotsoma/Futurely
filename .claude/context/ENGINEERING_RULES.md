# NextStep — Engineering Rules

These rules apply to ALL agents. No exceptions. No negotiation.

---

## Language & Type Safety
- TypeScript only — everywhere, always. `strict: true` in tsconfig.
- No `any` types. Use `unknown` + type guards if type is uncertain.
- No implicit `any`. Compiler must not warn.
- Interfaces over type aliases for object shapes. Types for unions/primitives.

## Code Quality
- No placeholder functions. No `TODO` comments in deliverable code.
- No mock data in production code paths. Seed files go in `prisma/seed.ts` only.
- No unused imports, variables, or dead code.
- Every function has a single, clear responsibility.
- Functions over 40 lines should be decomposed.
- No magic numbers or hardcoded strings — use constants or enums.

## Production Readiness (mandatory for every output)
- All code must compile without errors: `tsc --noEmit` passes.
- All API routes must have input validation via DTOs + class-validator.
- All database queries must use Prisma — no raw SQL unless explicitly approved by Lead Architect.
- All async operations must have error handling (try/catch or Result pattern).
- No `console.log` in production code — use the structured logger (`src/common/logger`).
- No secrets, API keys, or credentials in source code — environment variables only.

## Security (non-negotiable — FERPA/COPPA compliance)
- Never log student PII (names, grades, emails, school IDs).
- Never expose student data without verifying the requesting user owns that data.
- All endpoints that access student data must be auth-guarded.
- School credentials (HAC/Skyward/PS passwords) must never be stored in the database — Secrets Manager only.
- Parental consent must be verified before processing data for users flagged as under 13.
- Every data access that touches student records must write to the compliance audit log.
- **Fail closed on age and identity (non-negotiable).** When a user record cannot be found, date of birth is null, or age computation fails for any reason (decryption error, null field, unexpected exception), the system MUST treat the user as potentially under 13 and deny access. Never return a sentinel age value (e.g. 999) that passes an age gate. Never write a catch block whose purpose is to allow access on an age/identity computation failure. "Fail open on age" is prohibited — it is a COPPA violation. This applies to every service, route handler, and background job in the codebase.
- **Consent revocation must be honored immediately and atomically.** When a user revokes autonomous or data-collection consent, the server-side consent record must be updated and an audit log entry must be written in the same operation before the response is returned to the client. A client-local state change (AsyncStorage, local state) is never sufficient — the server is the source of truth. Any background job or autonomous session must check server-side consent state before each execution cycle.

## API Design
- RESTful conventions: GET (read), POST (create), PUT (full update), PATCH (partial update), DELETE.
- Always return consistent response shapes: `{ data, meta?, error? }`.
- HTTP status codes must be semantically correct (200, 201, 400, 401, 403, 404, 409, 422, 500).
- Pagination required on all list endpoints (cursor-based preferred).
- Rate limit all public and auth endpoints.

## Mobile (React Native)
- Mobile-first always. Every screen must work at 375px width minimum.
- No hardcoded pixel values for layout — use Flexbox and percentage-based sizing.
- All interactive elements must have a minimum touch target of 44×44 points.
- Images must have explicit width/height to prevent layout shift.
- All user-facing text must support dynamic font scaling (accessibility).
- No blocking operations on the main thread — heavy work goes to workers or server.

## Testing
- All business logic must have unit tests (Jest).
- All API routes must have integration tests (Supertest).
- Critical user flows (login, grade sync, GPA calculation) must have E2E tests (Detox or Playwright).
- Minimum 80% coverage on `modules/gpa`, `modules/grades`, `modules/compliance`.
- Tests must pass before any PR is approved.

## Handoff Protocol
Every agent output MUST end with this block:

```
---
FILES CHANGED:
- path/to/file.ts (created|modified|deleted)

DEPENDENCIES ADDED:
- package-name@version (or "none")

MIGRATIONS REQUIRED:
- description (or "none")

ENV VARS REQUIRED:
- VAR_NAME=description (or "none")

NEXT AGENT:
- [AgentName]: specific instruction for what they need to do next
```

If code does not meet these rules, the Lead Architect will BLOCK it.
If a security rule is violated, the QA/Security Agent will BLOCK it and escalate immediately.
