# CMD P7 — End-to-End Verification & Smoke Test

## Context
All individual pieces have been built. This task verifies the entire live portal
connection flow works together: backend compiles and runs, mobile compiles, all
the integration points connect correctly.

This is not about adding features. It is about proving the sprint is complete and
finding any integration seams that broke.

## Step 1 — Final TypeScript check on backend

```bash
cd backend && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

If there are errors, fix them now. Do not proceed until TypeScript is clean.
Print the error list and the fix applied for each one.

## Step 2 — Start backend and run smoke tests

Start the backend:
```bash
cd backend && npm run dev &
sleep 5
echo "Backend started"
```

Run health check:
```bash
curl -s http://localhost:3001/health
```
Expected: JSON with status ok.

Test auth (get a JWT token for testing):
```bash
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@nextstep.com","password":"nextstep123"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); t=d.get('token') or d.get('data',{}).get('token',''); print('TOKEN:', t[:40]+'...' if t else 'NO TOKEN FOUND'); print('Full response:', json.dumps(d, indent=2)[:500])"
```

Save the token for subsequent requests. If the token key is different, adapt accordingly.

## Step 3 — Test portal status endpoint

```bash
TOKEN="PASTE_TOKEN_HERE"
curl -s http://localhost:3001/api/integrations/grades/status \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2))"
```

Expected response shape:
```json
{
  "data": {
    "connected": false,
    "systemType": null,
    "districtUrl": null,
    "lastSynced": null,
    "sessionExpiresIn": 0
  }
}
```

If the response shape is different, note the actual shape. The mobile `PortalStatus`
interface in `portalApi.ts` must match whatever the backend actually returns.
If there is a mismatch, fix `portalApi.ts` to match the actual backend response.

## Step 4 — Test HAC login endpoint (with fake data to check it doesn't crash)

This test sends a HAC login request to a fake URL. It should return a 502 or 500
error (because the URL is fake), but it must NOT return a 500 "unhandled error" or
crash the server.

```bash
TOKEN="PASTE_TOKEN_HERE"
curl -s -X POST http://localhost:3001/api/integrations/grades/hac/login \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"baseUrl":"https://fake-hac.example.com","username":"testuser","password":"testpass"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Status field:', d.get('error',{}).get('code','no error code')); print(json.dumps(d, indent=2)[:400])"
```

Expected: A structured error response like:
```json
{
  "data": null,
  "error": {
    "code": "LOGIN_FAILED",
    "message": "Could not reach HAC at https://fake-hac.example.com — check the district URL"
  }
}
```

NOT expected: Server crash, unhandled exception, or empty response.

If the server crashes on this request, read `gradesRouter.ts` and fix the error
handling in the HAC login route.

## Step 5 — Test /current and /gpa endpoints return proper "no session" error

```bash
TOKEN="PASTE_TOKEN_HERE"

echo "Testing /current without active session:"
curl -s http://localhost:3001/api/integrations/grades/current \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2)[:300])"

echo ""
echo "Testing /gpa without active session:"
curl -s http://localhost:3001/api/integrations/grades/gpa \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2)[:300])"
```

Expected for both: A 401 or 404 error response, NOT a 500 crash:
```json
{
  "data": null,
  "error": { "code": "NO_SESSION", "message": "..." }
}
```

## Step 6 — Final TypeScript check on mobile

```bash
cd nextstep-mobile && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

Fix any remaining errors. Print the error list and the fix for each one.

## Step 7 — Verify all new files exist

```bash
echo "=== Backend new files ==="
ls -la backend/src/integrations/grades/normalizeGrades.ts 2>&1

echo ""
echo "=== Mobile new files ==="
ls -la nextstep-mobile/src/api/portalApi.ts 2>&1
ls -la nextstep-mobile/src/screens/PortalConnectScreen.tsx 2>&1

echo ""
echo "=== Modified files ==="
ls -la backend/prisma/schema.prisma 2>&1
ls -la nextstep-mobile/src/navigation/GradePortalNavigator.tsx 2>&1
ls -la nextstep-mobile/src/screens/GradePortalDashboard.tsx 2>&1
ls -la nextstep-mobile/src/screens/GradeViewerScreen.tsx 2>&1
```

All 7 files must exist. If any are missing, create or fix them now.

## Step 8 — Verify navigator registration

```bash
grep -n "PortalConnect" nextstep-mobile/src/navigation/GradePortalNavigator.tsx
```

Expected: at least 3 lines — the type entry, the import, and the Stack.Screen registration.

## Step 9 — Verify password never persisted

Search the entire mobile app for any code that stores the password:

```bash
grep -rn "password" nextstep-mobile/src/ --include="*.ts" --include="*.tsx" | \
  grep -i "asyncstorage\|setitem\|store\|save\|persist" | \
  grep -v "// " | grep -v "^\s*//"
```

Expected: no results. If any results appear, they are security bugs — fix them immediately.

## Step 10 — Verify the disclaimer text is in PortalConnectScreen

```bash
grep -c "independent student tool\|not affiliated" nextstep-mobile/src/screens/PortalConnectScreen.tsx
```

Expected: 1 or more (the disclaimer text).

## Step 11 — Verify SQLite provider everywhere

```bash
echo "schema.prisma provider:"
grep "provider" backend/prisma/schema.prisma

echo ""
echo "migration_lock.toml provider:"
grep "provider" backend/prisma/migrations/migration_lock.toml

echo ""
echo ".env DATABASE_URL:"
grep "DATABASE_URL" backend/.env
```

Expected:
- schema.prisma: `provider = "sqlite"`
- migration_lock.toml: `provider = "sqlite"`
- .env: `DATABASE_URL="file:./dev.db"` (not a postgres URL)

## Step 12 — Kill background backend

```bash
pkill -f "ts-node\|nodemon\|node.*backend" 2>/dev/null || true
echo "Backend stopped"
```

## Step 13 — Print final sprint summary

Print this summary block with actual values filled in:

```
═══════════════════════════════════════════════════
  NextStep Live Portal Sprint — COMPLETE
═══════════════════════════════════════════════════

DATABASE
  Provider:          sqlite ✓
  DATABASE_URL:      file:./dev.db ✓
  User count:        [actual count]
  Course count:      [actual count]

BACKEND
  TypeScript errors: 0 ✓
  New files:
    ✓ backend/src/integrations/grades/normalizeGrades.ts
  Modified files:
    ✓ backend/prisma/schema.prisma (provider: sqlite)
    ✓ backend/src/integrations/grades/gradesRouter.ts (/current uses normalizeHacGrades)
  Health endpoint:   200 OK ✓
  HAC login (fake):  Structured error, no crash ✓
  /status (no session): Structured 401/404, no crash ✓

MOBILE
  TypeScript errors: 0 ✓
  New files:
    ✓ nextstep-mobile/src/api/portalApi.ts
    ✓ nextstep-mobile/src/screens/PortalConnectScreen.tsx
  Modified files:
    ✓ nextstep-mobile/src/navigation/GradePortalNavigator.tsx
    ✓ nextstep-mobile/src/screens/GradePortalDashboard.tsx
    ✓ nextstep-mobile/src/screens/GradeViewerScreen.tsx
  PortalConnect registered in navigator: ✓
  Password never stored to AsyncStorage: ✓
  Disclaimer text present: ✓

DEMO FLOW ENABLED
  "Connect to HAC → Enter URL + credentials → Grades appear in Grade Viewer"
  All pieces are wired. Ready for live HAC URL test.

═══════════════════════════════════════════════════
HOW TO TEST WITH A REAL HAC ACCOUNT:
  1. cd backend && npm run dev
  2. cd nextstep-mobile && npx expo start
  3. Open app → Grade Portal → Connect School Portal
  4. Select HAC, enter your district URL (e.g. https://hac.katyisd.org)
  5. Enter credentials → tap Connect
  6. Return to Grade Portal → tap Report Card
  7. Live grades appear ✓
═══════════════════════════════════════════════════
```

## Done

This command completes the V1 Live Portal Connection sprint.
Report any items from the summary block that are NOT ✓ and the reason why.
