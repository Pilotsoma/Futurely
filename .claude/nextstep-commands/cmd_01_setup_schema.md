# CMD 01 — Setup & Schema

Read CLAUDE.md and every file in .claude/context/ before touching any code.

Complete these tasks in order. Fix any error before moving to the next step.

## Step 1 — Create data directory
Create the directory `data/` at the project root if it does not exist.

## Step 2 — Install backend dependencies
Run: `cd backend && npm install`
If there are peer dependency warnings, ignore them. Fix actual errors only.

## Step 3 — Add StudentProfile to Prisma schema
Edit `backend/prisma/schema.prisma`.

Add this model:
```prisma
model StudentProfile {
  id             Int      @id @default(autoincrement())
  userId         Int      @unique
  studentId      String   @unique
  gradeLevel     Int
  graduationYear Int
  futureDecision String?
  satScore       Int?
  actScore       Float?
  counselorName  String?
  weightedGpa    Float    @default(0.0)
  unweightedGpa  Float    @default(0.0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

On the existing `User` model, add this relation field:
```prisma
profile StudentProfile?
```

## Step 4 — Run migration
Run: `cd backend && npx prisma migrate dev --name add_student_profile`

If it asks for a name interactively, provide: `add_student_profile`

## Step 5 — Verify migration
Run:
```
cd backend && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.studentProfile.count().then(n => {
  console.log('StudentProfile table exists. Row count:', n);
  p.\$disconnect();
}).catch(e => { console.error('FAILED:', e.message); p.\$disconnect(); });
"
```

Expected output: `StudentProfile table exists. Row count: 0`

## Step 6 — TypeScript check
Run: `cd backend && npx tsc --noEmit`
Fix all TypeScript errors before finishing this command.

## Done
Report: which steps completed, migration name, any errors encountered and how they were fixed.
