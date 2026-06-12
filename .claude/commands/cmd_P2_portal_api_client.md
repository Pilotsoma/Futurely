# CMD P2 — Mobile: Create Portal API Client

## Context
The mobile app has no way to talk to the backend's HAC scraping routes. The existing
`nextstep-mobile/src/api/gradesApi.ts` only calls `/api/grades` which returns seeded
database data. The backend already has fully working routes under
`/api/integrations/grades/` for HAC login, grade fetching, status checking, and
session management — but nothing in the mobile app calls them.

This task creates `portalApi.ts`, a new typed API client that maps to those backend routes.

## Step 1 — Read existing files before writing anything

Read these files completely:
- `nextstep-mobile/src/api/gradesApi.ts` — understand the existing API pattern (how
  AUTH_TOKEN is attached, what API_BASE looks like, how errors are handled)
- `nextstep-mobile/src/constants/api.ts` — get the exact API_BASE export and any
  helper functions used for making requests
- `nextstep-mobile/src/utils/auth.ts` OR `nextstep-mobile/src/lib/auth.ts` (whichever
  exists) — understand how the JWT token is retrieved for the Authorization header

Print the first 40 lines of gradesApi.ts so the pattern is visible in the log.

## Step 2 — Identify the auth token pattern

The backend requires a JWT Bearer token on every `/api/integrations/grades/*` route
(same middleware as `/api/grades`). Figure out exactly how `gradesApi.ts` attaches
this token — it may use AsyncStorage, a global variable, or a utility function.

You will use the EXACT same approach in portalApi.ts. Do not invent a new auth pattern.

## Step 3 — Create nextstep-mobile/src/api/portalApi.ts

Create this file. Adapt the auth header pattern to match whatever you found in Step 2.
Do not use a different pattern than gradesApi.ts uses.

```typescript
/**
 * portalApi.ts
 * Mobile API client for the live school portal integration.
 * Maps to backend routes under /api/integrations/grades/
 *
 * SECURITY NOTE: This file never stores passwords. Passwords are passed
 * directly to connectHac / connectPowerSchool and discarded after the
 * single HTTP request. They are never written to AsyncStorage, state,
 * or any persistent location.
 */

import { API_BASE } from '../constants/api'
// Import the auth token retrieval in the same way as gradesApi.ts does it.
// Example (adapt to match your actual pattern):
// import { getAuthToken } from '../utils/auth'
// OR: import AsyncStorage from '@react-native-async-storage/async-storage'

// ── Shared types ──────────────────────────────────────────────────────────────

export interface NormalizedAssignment {
  name: string
  category: string
  score: number | null
  totalPoints: number | null
  percentage: string
  dateDue: string
}

export interface NormalizedCourse {
  id: string
  name: string
  teacher: string
  period: string
  average: number | null
  letterGrade: string | null
  assignments: NormalizedAssignment[]
}

export interface PortalStatus {
  connected: boolean
  systemType: 'HAC' | 'PowerSchool' | null
  districtUrl: string | null
  lastSynced: string | null   // ISO date string or null
  sessionExpiresIn: number    // seconds remaining, 0 if not connected
}

export interface ConnectResult {
  connected: boolean
  systemType: 'HAC' | 'PowerSchool'
}

export interface PortalGpa {
  gpa: number | null
  courseCount: number
  systemType: 'HAC' | 'PowerSchool'
}

// ── Internal helper ───────────────────────────────────────────────────────────

/**
 * Build auth headers using the same token retrieval method as gradesApi.ts.
 * Adapt the token source to match the rest of the app.
 */
async function authHeaders(): Promise<Record<string, string>> {
  // TODO: Replace this block with the EXACT same pattern used in gradesApi.ts
  // Common patterns:
  //   const token = await AsyncStorage.getItem('authToken')
  //   const token = await getAuthToken()
  //   const token = store.getState().auth.token
  const token = '' // REPLACE THIS — match gradesApi.ts auth pattern exactly
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/**
 * Generic fetch wrapper. Throws an Error with a human-readable message on failure.
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await authHeaders()
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string> | undefined),
    },
  })

  const json = await response.json() as { data: T; error?: { message: string } }

  if (!response.ok) {
    const message = json.error?.message ?? `Request failed with status ${response.status}`
    throw new Error(message)
  }

  return json.data
}

// ── Portal connection ─────────────────────────────────────────────────────────

/**
 * Connect to a HAC (Home Access Center) school portal.
 *
 * @param baseUrl   Full URL to the district HAC portal, e.g. "https://hac.katyisd.org"
 * @param username  Student's HAC username
 * @param password  Student's HAC password — NOT stored after this call returns
 *
 * Calls: POST /api/integrations/grades/hac/login
 */
export async function connectHac(
  baseUrl: string,
  username: string,
  password: string
): Promise<ConnectResult> {
  const data = await apiFetch<{ token: string; systemType: string }>(
    '/api/integrations/grades/hac/login',
    {
      method: 'POST',
      body: JSON.stringify({ baseUrl, username, password }),
    }
  )
  return {
    connected: !!data.token,
    systemType: 'HAC',
  }
}

/**
 * Connect to a PowerSchool portal.
 *
 * @param baseUrl   Full URL to the district PowerSchool portal
 * @param username  Student's PowerSchool username
 * @param password  Student's PowerSchool password — NOT stored after this call returns
 *
 * Calls: POST /api/integrations/grades/powerschool/login
 */
export async function connectPowerSchool(
  baseUrl: string,
  username: string,
  password: string
): Promise<ConnectResult> {
  const data = await apiFetch<{ token: string; systemType: string }>(
    '/api/integrations/grades/powerschool/login',
    {
      method: 'POST',
      body: JSON.stringify({ baseUrl, username, password }),
    }
  )
  return {
    connected: !!data.token,
    systemType: 'PowerSchool',
  }
}

// ── Status ────────────────────────────────────────────────────────────────────

/**
 * Check whether there is an active school portal session for this user.
 * Call this on app launch and when returning to the Grade Portal screen.
 *
 * Calls: GET /api/integrations/grades/status
 */
export async function getPortalStatus(): Promise<PortalStatus> {
  return apiFetch<PortalStatus>('/api/integrations/grades/status')
}

// ── Grade data ────────────────────────────────────────────────────────────────

/**
 * Fetch current normalized grades from the connected school portal.
 * Only call this after confirming getPortalStatus().connected === true.
 *
 * Calls: GET /api/integrations/grades/current
 * Returns: NormalizedCourse[] (same shape regardless of HAC or PowerSchool)
 */
export async function getCurrentPortalGrades(): Promise<NormalizedCourse[]> {
  const data = await apiFetch<{ systemType: string; grades: NormalizedCourse[] }>(
    '/api/integrations/grades/current'
  )
  return data.grades ?? []
}

/**
 * Fetch the computed GPA from the connected portal's current grades.
 * Only call after confirming getPortalStatus().connected === true.
 *
 * Calls: GET /api/integrations/grades/gpa
 */
export async function getPortalGpa(): Promise<PortalGpa> {
  return apiFetch<PortalGpa>('/api/integrations/grades/gpa')
}

// ── Disconnect ────────────────────────────────────────────────────────────────

/**
 * Disconnect from the school portal and clear the server-side session.
 * After calling this, getPortalStatus() will return connected: false.
 *
 * Calls: DELETE /api/integrations/grades/session
 */
export async function disconnectPortal(): Promise<{ disconnected: boolean }> {
  return apiFetch<{ disconnected: boolean }>(
    '/api/integrations/grades/session',
    { method: 'DELETE' }
  )
}
```

## Step 4 — Fix the auth token placeholder

After creating the file, you MUST replace the placeholder `authHeaders` function with the
real implementation. Look at `gradesApi.ts` and copy the exact same token retrieval logic.

The placeholder says:
```typescript
const token = '' // REPLACE THIS — match gradesApi.ts auth pattern exactly
```

Replace this with the real token retrieval. For example, if gradesApi.ts uses:
```typescript
const token = await AsyncStorage.getItem('nextstep_token')
```
Then use that exact call. Add any needed imports at the top of the file.

## Step 5 — TypeScript check

```bash
cd nextstep-mobile && npx tsc --noEmit 2>&1 | head -60
```

Fix every TypeScript error. Common issues:
- Missing import for AsyncStorage or auth utility
- `API_BASE` not exported from constants/api.ts — add the export if missing
- Type mismatch on the response shapes — adjust the generic type parameter in apiFetch

## Step 6 — Verify the file structure is correct

```bash
cat nextstep-mobile/src/api/portalApi.ts | grep "^export " | head -20
```

Expected output should show all exported functions and types:
- `export interface NormalizedAssignment`
- `export interface NormalizedCourse`
- `export interface PortalStatus`
- `export interface ConnectResult`
- `export interface PortalGpa`
- `export async function connectHac`
- `export async function connectPowerSchool`
- `export async function getPortalStatus`
- `export async function getCurrentPortalGrades`
- `export async function getPortalGpa`
- `export async function disconnectPortal`

## Done

Report:
- Auth token pattern found in gradesApi.ts (copy the exact lines used)
- Auth pattern correctly replicated in portalApi.ts: yes/no
- TypeScript errors before fix (list them)
- TypeScript errors after fix: 0
- All 6 functions exported: yes/no
- All 5 interfaces exported: yes/no
