# CMD 02 — Seed 4000 Students from CSV

Before starting: confirm `data/students.csv` exists at the project root and `backend/prisma/schema.prisma` has the `StudentProfile` model from CMD 01.

## Step 1 — Install csv-parse
Run: `cd backend && npm install csv-parse`

## Step 2 — Create the seed script
Create `backend/prisma/seedStudents.ts` with the following complete implementation:

```typescript
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { parse } from 'csv-parse/sync'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

type CourseType = 'AP' | 'HONORS' | 'STANDARD'
type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F'

function detectCourseType(name: string): CourseType {
  if (name.startsWith('AP ') || name.includes(' AP ')) return 'AP'
  if (name.toLowerCase().includes('honor')) return 'HONORS'
  return 'STANDARD'
}

function percentToLetter(pct: number): LetterGrade {
  if (pct >= 90) return 'A'
  if (pct >= 80) return 'B'
  if (pct >= 70) return 'C'
  if (pct >= 60) return 'D'
  return 'F'
}

function letterToPoints(letter: LetterGrade): number {
  const map: Record<LetterGrade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 }
  return map[letter]
}

function calcGpa(
  courses: { letterGrade: LetterGrade; courseType: CourseType; creditHours: number }[]
): { weighted: number; unweighted: number } {
  if (courses.length === 0) return { weighted: 0, unweighted: 0 }
  let wSum = 0, uSum = 0, credits = 0
  for (const c of courses) {
    const base = letterToPoints(c.letterGrade)
    const bonus = c.courseType === 'AP' ? 1.0 : c.courseType === 'HONORS' ? 0.5 : 0
    wSum += (base + bonus) * c.creditHours
    uSum += base * c.creditHours
    credits += c.creditHours
  }
  return {
    weighted: Math.round((wSum / credits) * 1000) / 1000,
    unweighted: Math.round((uSum / credits) * 1000) / 1000,
  }
}

interface CsvRow {
  ID: string
  'Last Name': string
  'First Name': string
  'Grade Level': string
  'Enrollment Year': string
  'Graduation Year': string
  'Courses as a List': string
  'Course Grades as a List': string
  'Future Decision': string
  SAT: string
  ACT: string
  'Counselor Name': string
}

async function seedStudent(row: CsvRow, passwordHash: string): Promise<void> {
  const studentId = row.ID.trim()
  const email = `${studentId}@slhs.edu`
  const name = `${row['First Name'].trim()} ${row['Last Name'].trim()}`
  const gradeLevel = parseInt(row['Grade Level'], 10)
  const graduationYear = parseInt(row['Graduation Year'], 10)
  const satRaw = parseFloat(row.SAT)
  const actRaw = parseFloat(row.ACT)
  const satScore = isNaN(satRaw) ? null : Math.round(satRaw)
  const actScore = isNaN(actRaw) ? null : actRaw

  let courseNames: string[] = []
  let courseGrades: number[] = []
  try {
    courseNames = JSON.parse(row['Courses as a List']) as string[]
  } catch { courseNames = [] }
  try {
    courseGrades = JSON.parse(row['Course Grades as a List']) as number[]
  } catch { courseGrades = [] }

  const user = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, passwordHash, name, role: 'STUDENT' },
  })

  await prisma.studentProfile.upsert({
    where: { userId: user.id },
    update: {
      gradeLevel,
      graduationYear,
      futureDecision: row['Future Decision'] || null,
      satScore,
      actScore,
      counselorName: row['Counselor Name'] || null,
    },
    create: {
      userId: user.id,
      studentId,
      gradeLevel,
      graduationYear,
      futureDecision: row['Future Decision'] || null,
      satScore,
      actScore,
      counselorName: row['Counselor Name'] || null,
    },
  })

  // Delete and recreate courses
  await prisma.grade.deleteMany({ where: { userId: user.id } })
  await prisma.course.deleteMany({ where: { userId: user.id } })

  const courseData: { letterGrade: LetterGrade; courseType: CourseType; creditHours: number }[] = []

  for (let i = 0; i < courseNames.length; i++) {
    const courseName = courseNames[i] ?? ''
    if (!courseName) continue
    const pct = courseGrades[i] ?? 0
    const courseType = detectCourseType(courseName)
    const letterGrade = percentToLetter(pct)
    const SEMESTER = '2025-FA'

    const course = await prisma.course.create({
      data: {
        userId: user.id,
        name: courseName,
        teacher: 'TBD',
        period: i + 1,
        semester: SEMESTER,
        courseType,
        creditHours: 1.0,
      },
    })

    await prisma.grade.create({
      data: {
        courseId: course.id,
        userId: user.id,
        letterGrade,
        percentage: pct,
        gradingPeriod: 'CURRENT',
      },
    })

    courseData.push({ letterGrade, courseType, creditHours: 1.0 })
  }

  const gpa = calcGpa(courseData)
  await prisma.studentProfile.update({
    where: { userId: user.id },
    data: { weightedGpa: gpa.weighted, unweightedGpa: gpa.unweighted },
  })
}

async function main(): Promise<void> {
  const csvPath = path.resolve(__dirname, '../../data/students.csv')
  if (!fs.existsSync(csvPath)) {
    console.error('ERROR: data/students.csv not found at', csvPath)
    process.exit(1)
  }

  const content = fs.readFileSync(csvPath, 'utf-8')
  const rows = parse(content, { columns: true, skip_empty_lines: true }) as CsvRow[]

  console.log(`Found ${rows.length} students. Starting seed...`)
  const passwordHash = await bcrypt.hash('nextstep123', 8)

  const BATCH = 50
  let seeded = 0
  let failed = 0
  const startTime = Date.now()

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    for (const row of batch) {
      try {
        await seedStudent(row, passwordHash)
        seeded++
      } catch (e) {
        failed++
        console.warn(`  SKIP student ${row.ID}:`, (e as Error).message)
      }
    }
    if (seeded % 100 === 0 || i + BATCH >= rows.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`  Seeded ${seeded}/${rows.length} students... (${elapsed}s)`)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nDone! Seeded: ${seeded}, Failed: ${failed}, Time: ${elapsed}s`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

## Step 3 — Add script to package.json
In `backend/package.json`, add to the `"scripts"` section:
```json
"seed:students": "ts-node --transpile-only prisma/seedStudents.ts"
```

## Step 4 — Run the seed
Run: `cd backend && npm run seed:students`

This will take 5–15 minutes. Let it run to completion. Do not interrupt it.

## Step 5 — Verify
Run:
```
cd backend && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
Promise.all([
  p.user.count(),
  p.studentProfile.count(),
  p.course.count(),
  p.grade.count(),
]).then(([u, sp, c, g]) => {
  console.log('Users:', u, '| Profiles:', sp, '| Courses:', c, '| Grades:', g);
  p.\$disconnect();
});
"
```

Expected: Users ~4001, Profiles ~4000, Courses and Grades in the tens of thousands.

## Done
Report final counts and total time taken.
