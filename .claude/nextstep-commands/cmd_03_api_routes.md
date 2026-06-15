# CMD 03 — Add All API Routes

Read `backend/src/routes/grades.ts` carefully. Every new route must follow the exact same pattern: typed interfaces, `requireAuth` middleware, Prisma queries, structured `{ data: ..., error: null }` JSON response.

## Route 1 — students.ts

Create `backend/src/routes/students.ts`:

```typescript
import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.userId === undefined) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    return
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        profile: true,
        courses: {
          include: {
            grades: { where: { gradingPeriod: 'CURRENT' }, take: 1 },
          },
          orderBy: { period: 'asc' },
        },
        assignments: {
          orderBy: { dueDate: 'asc' },
        },
      },
    })

    if (!user) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'User not found' } })
      return
    }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 86400000)
    const weekEnd = new Date(todayStart.getTime() + 7 * 86400000)

    const stats = {
      totalCourses: user.courses.length,
      completedAssignments: user.assignments.filter(a => a.completed).length,
      pendingAssignments: user.assignments.filter(a => !a.completed).length,
      assignmentsDueToday: user.assignments.filter(
        a => !a.completed && a.dueDate >= todayStart && a.dueDate < todayEnd
      ).length,
      assignmentsDueThisWeek: user.assignments.filter(
        a => !a.completed && a.dueDate >= todayStart && a.dueDate < weekEnd
      ).length,
    }

    const courses = user.courses.map(c => {
      const g = c.grades[0] ?? null
      return {
        id: c.id,
        name: c.name,
        teacher: c.teacher,
        period: c.period,
        courseType: c.courseType,
        creditHours: c.creditHours,
        semester: c.semester,
        grade: g ? { letterGrade: g.letterGrade, percentage: g.percentage } : null,
      }
    })

    res.json({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        profile: user.profile,
        courses,
        assignments: user.assignments,
        stats,
      },
    })
  } catch {
    res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
  }
})

export default router
```

## Route 2 — roadmap.ts

Create `backend/src/routes/roadmap.ts`:

```typescript
import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

function categorize(name: string): string {
  const n = name.toLowerCase()
  if (/english|literature|writing|composition|oral interp|reading/.test(n)) return 'English'
  if (/math|calculus|geometry|algebra|statistics|precalculus|reasoning/.test(n)) return 'Math'
  if (/biology|chemistry|physics|science|integrated physics/.test(n)) return 'Science'
  if (/history|government|economics|geography|social/.test(n)) return 'Social Studies'
  if (/spanish|french|chinese|latin|german|japanese/.test(n)) return 'Language'
  if (/art|music|theater|floral|design|photography|fine/.test(n)) return 'Fine Arts'
  if (/pe |physical|health|athletics|tennis|swimming|gym/.test(n)) return 'PE / Health'
  return 'Electives'
}

router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.userId === undefined) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    return
  }
  try {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: req.userId } })
    const courses = await prisma.course.findMany({
      where: { userId: req.userId },
      include: { grades: { where: { gradingPeriod: 'CURRENT' }, take: 1 } },
    })

    const creditsByCategory: Record<string, number> = {
      English: 0, Math: 0, Science: 0, 'Social Studies': 0,
      Language: 0, 'Fine Arts': 0, 'PE / Health': 0, Electives: 0,
    }

    let creditsCompleted = 0
    for (const c of courses) {
      const grade = c.grades[0]
      const passed = grade && grade.letterGrade !== 'F'
      if (passed) {
        creditsCompleted += c.creditHours
        const cat = categorize(c.name)
        creditsByCategory[cat] = (creditsByCategory[cat] ?? 0) + c.creditHours
      }
    }

    const gradeLevel = profile?.gradeLevel ?? 9
    const creditsRequired = 26

    const milestones = [
      { grade: 9,  label: 'Explore interests, build strong foundations', done: gradeLevel > 9 },
      { grade: 10, label: 'Challenge yourself — consider AP or Honors courses', done: gradeLevel > 10 },
      { grade: 11, label: 'SAT/ACT prep, start college research', done: gradeLevel > 11 },
      { grade: 12, label: 'Apply to colleges, finalize your plans', done: false },
    ]

    res.json({
      data: {
        gradeLevel,
        graduationYear: profile?.graduationYear ?? null,
        creditsCompleted,
        creditsRequired,
        percentComplete: Math.round((creditsCompleted / creditsRequired) * 100),
        creditsByCategory,
        milestones,
        weightedGpa: profile?.weightedGpa ?? 0,
        unweightedGpa: profile?.unweightedGpa ?? 0,
        futureDecision: profile?.futureDecision ?? null,
      },
    })
  } catch {
    res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
  }
})

export default router
```

## Route 3 — ai.ts

Create `backend/src/routes/ai.ts`:

```typescript
import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// TODO: Replace stub logic with Anthropic API call when API key is available:
// import Anthropic from '@anthropic-ai/sdk'
// const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

router.post('/chat', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.userId === undefined) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    return
  }
  try {
    const { message } = req.body as { message: string }
    const msg = (message ?? '').toLowerCase()

    const profile = await prisma.studentProfile.findUnique({ where: { userId: req.userId } })
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    const courses = await prisma.course.findMany({
      where: { userId: req.userId },
      include: { grades: { where: { gradingPeriod: 'CURRENT' }, take: 1 } },
    })
    const assignments = await prisma.assignment.findMany({
      where: { userId: req.userId, completed: false },
      orderBy: { dueDate: 'asc' },
      take: 3,
    })

    const firstName = user?.name?.split(' ')[0] ?? 'Student'
    const wGpa = profile?.weightedGpa?.toFixed(2) ?? '—'
    const uGpa = profile?.unweightedGpa?.toFixed(2) ?? '—'

    const sorted = [...courses].sort((a, b) => {
      const ga = a.grades[0]?.percentage ?? 100
      const gb = b.grades[0]?.percentage ?? 100
      return ga - gb
    })
    const weakest = sorted[0]
    const strongest = sorted[sorted.length - 1]

    let reply = `Hi ${firstName}! I'm NextStep AI. Ask me about your grades, GPA, assignments, or college plans.`

    if (msg.includes('gpa')) {
      reply = `Your current GPA is ${uGpa} unweighted and ${wGpa} weighted. ${weakest ? `To boost it, focus on ${weakest.name} — that's your lowest course right now.` : ''}`
    } else if (msg.includes('college') || msg.includes('university')) {
      reply = `Based on your ${uGpa} GPA and your goal of "${profile?.futureDecision ?? 'continuing education'}", you're on a solid path. ${profile?.satScore ? `Your SAT score of ${profile.satScore} is a great start.` : 'Consider taking the SAT or ACT if you haven\'t yet.'}`
    } else if (msg.includes('assignment') || msg.includes('homework') || msg.includes('due')) {
      const next = assignments[0]
      reply = next
        ? `Your most urgent assignment is "${next.title}" for ${next.subject}, due ${new Date(next.dueDate).toLocaleDateString()}. Estimated time: ${next.estimatedMinutes} minutes.`
        : `You're all caught up — no pending assignments right now! 🎉`
    } else if (msg.includes('grade') || msg.includes('class') || msg.includes('course')) {
      reply = `${strongest ? `Your strongest class is ${strongest.name} at ${strongest.grades[0]?.percentage ?? '—'}%.` : ''} ${weakest ? `You might want to put extra effort into ${weakest.name}.` : ''}`
    } else if (msg.includes('sat') || msg.includes('act') || msg.includes('test')) {
      reply = profile?.satScore
        ? `Your SAT score is ${profile.satScore}. Keep practicing with Khan Academy for free prep resources!`
        : `You haven't entered your SAT/ACT score yet. Head to Settings to add it and get personalized college advice.`
    } else if (msg.includes('study') || msg.includes('help') || msg.includes('advice')) {
      reply = `Here's my advice for you, ${firstName}: prioritize ${weakest?.name ?? 'your weakest subject'}, complete your pending assignments on time, and aim to raise your GPA to ${Math.min(4.0, (profile?.unweightedGpa ?? 3.0) + 0.2).toFixed(1)} by end of semester.`
    }

    res.json({ data: { reply } })
  } catch {
    res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
  }
})

router.get('/study-plan', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.userId === undefined) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    return
  }
  try {
    const assignments = await prisma.assignment.findMany({
      where: { userId: req.userId, completed: false },
      orderBy: { dueDate: 'asc' },
      take: 5,
    })

    const now = new Date()
    const plan = assignments.map(a => {
      const daysUntil = (a.dueDate.getTime() - now.getTime()) / 86400000
      const priority = daysUntil <= 1 ? 'HIGH' : daysUntil <= 3 ? 'MEDIUM' : 'LOW'
      return {
        id: a.id,
        title: a.title,
        subject: a.subject,
        dueDate: a.dueDate,
        estimatedMinutes: a.estimatedMinutes,
        priority,
      }
    })

    res.json({ data: { plan } })
  } catch {
    res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
  }
})

export default router
```

## Register routes in app.ts

Edit `backend/src/app.ts`. Add these imports and route registrations after the existing routes:

```typescript
import studentsRouter from './routes/students'
import roadmapRouter from './routes/roadmap'
import aiRouter from './routes/ai'
```

And in the route registration section:
```typescript
app.use('/api/students', studentsRouter)
app.use('/api/roadmap', roadmapRouter)
app.use('/api/ai', aiRouter)
```

## Verify

Run: `cd backend && npx tsc --noEmit`

Fix all TypeScript errors.

Then start the server and test:
```
cd backend && npm run dev &
sleep 3

# Get a token first
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@nextstep.com","password":"nextstep123"}' | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data?.token??'FAILED'))")

echo "Token: $TOKEN"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/students/me | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log('name:',r.data?.name,'courses:',r.data?.courses?.length,'stats:',JSON.stringify(r.data?.stats))})"
```

Kill the dev server after testing: `pkill -f "ts-node src/index"`

## Done
Report all routes created and test results.
