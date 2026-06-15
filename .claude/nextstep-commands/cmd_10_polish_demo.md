# CMD 10 — Final Polish, TypeScript Audit & Demo Prep

This is the final command. It fixes, polishes, and verifies the entire project.

## Step 1 — Full TypeScript audit

Run both:
```
cd backend && npx tsc --noEmit
cd nextstep-mobile && npx tsc --noEmit
cd .. && npm run build
```

Fix EVERY TypeScript error in all three. Do not skip any.

## Step 2 — Verify backend starts clean

```
cd backend && npm run dev &
sleep 4

TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@nextstep.com","password":"nextstep123"}' \
  | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data?.token??'FAILED'))")

echo "=== /api/students/me ==="
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/students/me \
  | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log('name:',r.data?.name,'courses:',r.data?.courses?.length,'pending:',r.data?.stats?.pendingAssignments)})"

echo "=== /api/roadmap ==="
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/roadmap \
  | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log('gradeLevel:',r.data?.gradeLevel,'credits:',r.data?.creditsCompleted)})"

echo "=== /api/ai/chat ==="
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"message":"what is my gpa"}' http://localhost:3001/api/ai/chat \
  | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data?.reply))"

pkill -f "ts-node src/index" 2>/dev/null || true
```

All three responses must return valid data.

## Step 3 — Create a demo student selector script

Create `backend/scripts/listDemoStudents.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  const students = await prisma.studentProfile.findMany({
    take: 20,
    orderBy: { weightedGpa: 'desc' },
    include: { user: true },
  })

  console.log('\n=== TOP 20 DEMO STUDENTS (by weighted GPA) ===\n')
  console.log('Email                    | Name                  | Grade | W.GPA | U.GPA')
  console.log('-------------------------|----------------------|-------|-------|------')
  for (const s of students) {
    const email = s.user.email.padEnd(24)
    const name = (s.user.name ?? '').padEnd(21)
    console.log(`${email} | ${name} | ${s.gradeLevel}     | ${s.weightedGpa.toFixed(2)}  | ${s.unweightedGpa.toFixed(2)}`)
  }
  console.log('\nPassword for all: nextstep123')
  console.log('Test account: test@nextstep.com / nextstep123\n')
}

main().finally(() => prisma.$disconnect())
```

Add to `backend/package.json` scripts:
```
"demo:students": "ts-node --transpile-only scripts/listDemoStudents.ts"
```

Run it: `cd backend && npm run demo:students`

## Step 4 — Create project-wide README

Replace the root `README.md` with a complete guide:

```markdown
# NextStep MVP

AI-powered academic companion for high school students.

## Quick Start

### Prerequisites
- Node.js 18+
- Expo Go app on your phone

### 1. Start the backend
```bash
cd backend
npm install
npm run dev
```
Server runs at http://localhost:3001

### 2. Seed student data (first time only)
```bash
cd backend
npm run seed         # seeds test user
npm run seed:students  # seeds 4000 SLHS students (takes ~10 min)
```

### 3. Start the mobile app
```bash
cd nextstep-mobile
npm install
npx expo start
```
Scan the QR code with Expo Go on your phone.

### 4. Start the web app
```bash
# From project root
npm install
npm run dev
```
Web app: http://localhost:3000

## Demo Credentials
- Test account: `test@nextstep.com` / `nextstep123`
- Any SLHS student: `{studentId}@slhs.edu` / `nextstep123`
- List top students: `cd backend && npm run demo:students`

## Features
- Grade Viewer (Report Card, Transcript, Schedule, Contact Teachers)
- GPA Simulator (what-if grade changes)
- Smart Planner (assignments by priority)
- NextStep AI Chat (stub — drop in API key to activate)
- College Help (Roadmap, GPA Planner, Colleges placeholder)
- Calendar view
- Settings

## Adding AI
When you have an Anthropic API key:
1. Add `ANTHROPIC_API_KEY=your_key` to `backend/.env`
2. Replace the stub in `backend/src/routes/ai.ts` with the real Anthropic SDK call
3. No other changes needed
```

## Step 5 — Final file count check

Run:
```
echo "=== Backend routes ==="
ls backend/src/routes/
echo "=== Mobile screens ==="
ls nextstep-mobile/src/screens/
echo "=== Mobile navigators ==="
ls nextstep-mobile/src/navigation/
echo "=== Web pages ==="
find app -name "*.tsx" | sort
```

## Step 6 — Seed the test user if not already done
```
cd backend && npm run seed
```

## Done
Report the complete final file inventory and confirm:
- Backend compiles with zero TypeScript errors
- Mobile compiles with zero TypeScript errors
- Web builds successfully
- All API routes return valid responses
- Demo student list shows 20 students
