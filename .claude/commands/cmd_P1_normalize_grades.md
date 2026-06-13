# CMD P1 — Backend: Create Grade Normalization Helper

## Context
The backend's HAC scraping client (`backend/src/integrations/grades/hacClient.ts`) returns
data as `HACClass[]` objects. The mobile app needs grades in a clean, consistent shape
regardless of whether they came from HAC or PowerSchool.

Right now the `/api/integrations/grades/current` route returns the raw HAC output directly,
which has different field names, string-typed averages, and inconsistent structures compared
to what the mobile Grade Viewer expects.

This task creates a normalization layer so all portal types output the same format, and
updates the existing route to use it.

## Step 1 — Read existing files before writing anything

Read these files completely. Do not skip any of them:
- `backend/src/integrations/grades/hacClient.ts` — understand HACClass and HACScore shapes
- `backend/src/integrations/grades/gradesRouter.ts` — understand the /current route structure
- `backend/src/integrations/grades/sessionStore.ts` — understand StoredSession shape

Print the `HACClass` and `HACScore` interface definitions so they are visible in the log.

## Step 2 — Create normalizeGrades.ts

Create the file `backend/src/integrations/grades/normalizeGrades.ts` with this exact content:

```typescript
/**
 * Grade normalization layer.
 * Converts raw HAC and PowerSchool outputs into a single NormalizedCourse shape
 * that the NextStep mobile app consumes from /api/integrations/grades/current.
 */

import type { HACClass, HACScore } from './hacClient'

// ── Normalized output shape ────────────────────────────────────────────────────

export interface NormalizedAssignment {
  name: string
  category: string
  score: number | null
  totalPoints: number | null
  percentage: string
  dateDue: string
}

export interface NormalizedCourse {
  /** Stable string ID. HAC has no IDs so we generate from index + name. */
  id: string
  name: string
  teacher: string
  period: string
  average: number | null
  letterGrade: string | null
  assignments: NormalizedAssignment[]
}

// ── GPA helpers ────────────────────────────────────────────────────────────────

/**
 * Parse a grade average string like "92.4" or "N/A" to a float or null.
 */
function parseAverage(raw: string | null | undefined): number | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === 'N/A' || trimmed === '--' || trimmed === '-') return null
  const parsed = parseFloat(trimmed)
  return isNaN(parsed) ? null : parsed
}

/**
 * Derive a letter grade from a numeric average using standard US high school scale.
 * Returns null if average is null.
 */
function deriveLetterGrade(average: number | null): string | null {
  if (average === null) return null
  if (average >= 90) return 'A'
  if (average >= 80) return 'B'
  if (average >= 70) return 'C'
  if (average >= 60) return 'D'
  return 'F'
}

/**
 * Generate a stable course ID from index and course name.
 * HAC does not provide IDs, so we build a deterministic one.
 */
function makeCourseId(index: number, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 20)
  return `hac-${index}-${slug}`
}

// ── HAC normalization ──────────────────────────────────────────────────────────

/**
 * Convert a HACScore (raw assignment) to a NormalizedAssignment.
 */
function normalizeHacScore(score: HACScore): NormalizedAssignment {
  return {
    name: score.name?.trim() ?? 'Unnamed Assignment',
    category: score.category?.trim() ?? 'Uncategorized',
    score: score.score,
    totalPoints: score.totalPoints,
    percentage: score.percentage?.trim() ?? '',
    dateDue: score.dateDue?.trim() ?? '',
  }
}

/**
 * Convert an array of HACClass objects into NormalizedCourse[].
 * Safe to call with an empty array.
 */
export function normalizeHacGrades(classes: HACClass[]): NormalizedCourse[] {
  if (!Array.isArray(classes)) return []

  return classes.map((cls, index): NormalizedCourse => {
    const average = parseAverage(cls.average)
    const letterGrade = deriveLetterGrade(average)

    return {
      id: makeCourseId(index, cls.name ?? ''),
      name: cls.name?.trim() ?? 'Unknown Course',
      teacher: cls.teacher?.trim() ?? 'Unknown Teacher',
      period: cls.period?.trim() ?? String(index + 1),
      average,
      letterGrade,
      assignments: Array.isArray(cls.scores)
        ? cls.scores.map(normalizeHacScore)
        : [],
    }
  })
}

// ── PowerSchool normalization (stub) ───────────────────────────────────────────

/**
 * PowerSchool normalization stub.
 * Returns empty array — PowerSchool implementation is deferred to a later sprint.
 * The type signature is stable so the router can call it safely.
 */
export function normalizePsGrades(_rawClasses: unknown[]): NormalizedCourse[] {
  // TODO: Implement PowerSchool normalization in PS sprint
  return []
}

// ── GPA computation ────────────────────────────────────────────────────────────

/**
 * Compute unweighted GPA from normalized courses.
 * Uses 4.0 scale: A=4.0, B=3.0, C=2.0, D=1.0, F=0.0
 * Only includes courses that have a numeric average.
 */
export function computeGpaFromNormalized(courses: NormalizedCourse[]): number | null {
  const graded = courses.filter(c => c.average !== null)
  if (graded.length === 0) return null

  const pointMap: Record<string, number> = { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0.0 }

  const total = graded.reduce((sum, c) => {
    const letter = c.letterGrade ?? 'F'
    return sum + (pointMap[letter] ?? 0)
  }, 0)

  const gpa = total / graded.length
  return Math.round(gpa * 100) / 100
}
```

## Step 3 — Update the /current route in gradesRouter.ts

Read `backend/src/integrations/grades/gradesRouter.ts` again carefully.

Find the `GET /current` route handler. It currently returns raw HAC grades directly.

Make these changes to that handler ONLY (do not touch any other route):

1. Add this import at the top of gradesRouter.ts (after the existing imports):
```typescript
import { normalizeHacGrades, normalizePsGrades } from './normalizeGrades'
```

2. In the `GET /current` handler, find where it does:
```typescript
grades = await hacGrades(entry.token)
```
(or similar — the exact variable name might differ, adapt as needed)

After fetching the raw grades, add normalization before the response:
```typescript
// For HAC:
const rawHacGrades = await hacGrades(entry.token)
const normalizedGrades = normalizeHacGrades(rawHacGrades)
res.json({ data: { systemType: entry.session.systemType, grades: normalizedGrades } })

// For PowerSchool:
const rawPsGrades = await psGrades(entry.token)
const normalizedGrades = normalizePsGrades(rawPsGrades)
res.json({ data: { systemType: entry.session.systemType, grades: normalizedGrades } })
```

Make sure the response always returns `grades` as a `NormalizedCourse[]` array, never the
raw HACClass[] array. Import the NormalizedCourse type in gradesRouter.ts if needed for
type annotations.

## Step 4 — TypeScript check

```bash
cd backend && npx tsc --noEmit
```

There must be zero errors. Common issues to fix:
- If `HACClass` or `HACScore` are not exported from hacClient.ts, add `export` to them
- If there are any implicit `any` types, add explicit annotations
- If the grades variable is typed as `object[]`, update the type to match

## Step 5 — Unit test the normalization logic inline

```bash
cd backend && node -e "
const { normalizeHacGrades, computeGpaFromNormalized } = require('./dist/integrations/grades/normalizeGrades');
// If dist doesn't exist, compile first: npx tsc

const fakeHacData = [
  {
    name: 'AP English IV',
    period: '1',
    teacher: 'Mrs. Smith',
    room: '101',
    average: '92.4',
    scores: [
      { name: 'Essay 1', category: 'Major', score: 92, totalPoints: 100, percentage: '92%', dateDue: '2025-09-15' }
    ]
  },
  {
    name: 'AP Calculus BC',
    period: '2',
    teacher: 'Mr. Johnson',
    room: '205',
    average: 'N/A',
    scores: []
  },
  {
    name: 'US History',
    period: '3',
    teacher: 'Ms. Davis',
    room: '302',
    average: '85.0',
    scores: []
  }
];

// Try require from src with ts-node, or from dist
let normalizeHacGrades, computeGpaFromNormalized;
try {
  const m = require('./src/integrations/grades/normalizeGrades');
  normalizeHacGrades = m.normalizeHacGrades;
  computeGpaFromNormalized = m.computeGpaFromNormalized;
} catch(e) {
  console.log('Cannot require directly, testing via tsc output check...');
  console.log('TypeScript compilation must pass — run: npx tsc --noEmit');
  process.exit(0);
}

const normalized = normalizeHacGrades(fakeHacData);
console.log('Normalized courses:', JSON.stringify(normalized, null, 2));
console.log('GPA:', computeGpaFromNormalized(normalized));

// Assertions
if (normalized[0].average !== 92.4) throw new Error('average should be 92.4');
if (normalized[0].letterGrade !== 'A') throw new Error('letterGrade should be A');
if (normalized[1].average !== null) throw new Error('N/A should normalize to null');
if (normalized[1].letterGrade !== null) throw new Error('null average should give null letterGrade');
if (normalized[0].assignments.length !== 1) throw new Error('should have 1 assignment');
console.log('ALL ASSERTIONS PASSED');
" 2>&1 || echo "Node test skipped (compile with tsc first), TypeScript check is the source of truth"
```

## Step 6 — Verify the /gpa route still works

The `/gpa` route in gradesRouter.ts also processes grades. Read it and verify it either:
a) Now uses `normalizeHacGrades` and `computeGpaFromNormalized`, OR
b) Still uses its own existing `computeGPA` helper (which is fine — leave it)

Do not break the /gpa route. It must still return `{ data: { gpa: number, courseCount: number, systemType: string } }`.

## Done

Report:
- normalizeGrades.ts created: yes/no
- gradesRouter.ts /current route updated: yes/no
- TypeScript errors before fix (list them)
- TypeScript errors after fix: 0
- Inline test result
- /gpa route still intact: yes/no
