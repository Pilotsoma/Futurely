# CMD P0 — Fix Database Provider Mismatch

## Context
The backend has a critical inconsistency that will cause crashes:
- `backend/README.md` says SQLite
- `backend/prisma/migrations/migration_lock.toml` was generated with PostgreSQL
- `backend/prisma/schema.prisma` currently declares `provider = "postgresql"`
- The actual running database is SQLite (`dev.db`)

This must be fixed before any other task. A mismatched provider causes Prisma Client to
generate incorrect SQL and will break all database operations.

## Step 1 — Read current schema state

Read these three files completely before making any changes:
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/migration_lock.toml`
- `backend/.env` (if it exists; if not, note that it is missing)

Print the current `datasource db` block from schema.prisma and the current provider
line from migration_lock.toml so the change is visible in the log.

## Step 2 — Fix schema.prisma

Edit `backend/prisma/schema.prisma`.

Find the datasource block (it currently says postgresql):
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Replace it with:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

Do not change anything else in the file. Leave all models exactly as they are.

## Step 3 — Fix migration_lock.toml

Edit `backend/prisma/migrations/migration_lock.toml`.

Find the line:
```
provider = "postgresql"
```

Replace it with:
```
provider = "sqlite"
```

## Step 4 — Create or verify backend/.env

Check if `backend/.env` exists. If it does NOT exist, create it with:
```
DATABASE_URL="file:./dev.db"
JWT_SECRET="nextstep-dev-secret-change-later"
PORT=3001
```

If it DOES exist, check that the DATABASE_URL line uses the SQLite file format.
If it currently says a PostgreSQL connection string (starts with `postgresql://` or `postgres://`),
replace only that line with:
```
DATABASE_URL="file:./dev.db"
```

Leave all other existing .env lines unchanged.

## Step 5 — Reset and regenerate Prisma client

Run these commands in order. Wait for each to complete before running the next.

```bash
cd backend
npx prisma migrate reset --force --skip-seed
```

If that fails with a migration history error, try:
```bash
cd backend
rm -f prisma/dev.db
npx prisma migrate dev --name init_sqlite
```

Then re-seed:
```bash
cd backend
npm run db:seed
```

If `npm run db:seed` is not defined in package.json, run:
```bash
cd backend
npx prisma db seed
```

## Step 6 — Regenerate Prisma client

```bash
cd backend
npx prisma generate
```

Expected output: mentions "Generated Prisma Client" and does NOT mention PostgreSQL.

## Step 7 — Verify the database is working

Run:
```bash
cd backend && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function check() {
  const userCount = await p.user.count();
  const courseCount = await p.course.count();
  const connCount = await p.schoolConnection.count();
  console.log('Users:', userCount);
  console.log('Courses:', courseCount);
  console.log('SchoolConnections:', connCount);
  console.log('DB CHECK PASSED');
  await p.\$disconnect();
}
check().catch(e => { console.error('DB CHECK FAILED:', e.message); process.exit(1); });
"
```

Expected: prints Users, Courses, SchoolConnections counts and "DB CHECK PASSED".
If it says "no such table", the migration did not run — go back to Step 5.

## Step 8 — TypeScript check

```bash
cd backend && npx tsc --noEmit
```

Fix every TypeScript error before proceeding. Do not move on while errors remain.

## Step 9 — Start backend and verify health

```bash
cd backend && npm run dev &
sleep 4
curl -s http://localhost:3001/health
```

Expected: JSON response with `{"status":"ok"}` or similar. If you get "connection refused",
the server did not start — check the error output from `npm run dev`.

Kill the background server after verifying:
```bash
pkill -f "ts-node\|nodemon\|node.*backend" 2>/dev/null || true
```

## Done

Report:
- Old provider value
- New provider value  
- Whether .env was created or already existed
- Migration result (reset or fresh init)
- User/Course/SchoolConnection counts from Step 7
- TypeScript check result
- Health endpoint response
