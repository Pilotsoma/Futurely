import { Router, Response } from 'express'
import OpenAI from 'openai'
import { prisma } from '../lib/prisma'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

const FREE_MODEL = 'openrouter/free'

// Strip markdown code fences and extract raw JSON
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  return fenced ? fenced[1].trim() : raw.trim()
}

const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  baseURL: 'https://openrouter.ai/api/v1',
})

// Read all available portal data from the HAC/PowerSchool cache
async function getPortalData(userId: number) {
  try {
    const conn = await prisma.schoolConnection.findUnique({
      where: { userId },
      select: { hacDataCache: true, systemType: true },
    })
    if (!conn?.hacDataCache) return null

    const cache = conn.hacDataCache as Record<string, { data: unknown; cachedAt: number }>

    // GPA + transcript history
    let weightedGpa: number | null = null
    let unweightedGpa: number | null = null
    let classRank: string | null = null
    let transcriptSummary = ''

    const transcript = cache['transcript']?.data as {
      weightedGPA?: string; unweightedGPA?: string; classRank?: string; quartile?: string; cumulativeGPA?: string
      semesters?: Array<{ year: string; semester: string; courses: Array<{ name: string; grade: string; credits: string }> }>
    } | undefined
    if (transcript) {
      const w = parseFloat(transcript.weightedGPA ?? '')
      const u = parseFloat(transcript.unweightedGPA ?? '')
      if (!isNaN(w)) weightedGpa = Math.round(w * 1000) / 1000
      if (!isNaN(u)) unweightedGpa = Math.round(u * 1000) / 1000
      if (transcript.classRank) classRank = `${transcript.classRank}${transcript.quartile ? ` (${transcript.quartile} quartile)` : ''}`
      // Only include the most recent semester from transcript to avoid overwhelming the model
      if (transcript.semesters?.length) {
        const recent = transcript.semesters[transcript.semesters.length - 1]
        transcriptSummary = `Most recent semester (${recent.year} ${recent.semester}): ${recent.courses.map(c => `${c.name} ${c.grade}`).join(', ')}`
      }
    }

    // Current course grades
    let courseList: string[] = []
    const classworkKey = Object.keys(cache).find(k => k.startsWith('classwork:'))
    if (classworkKey) {
      const classwork = cache[classworkKey].data as {
        classes?: Array<{ name?: string; average?: string | null; letterGrade?: string | null }>
      } | undefined
      if (classwork?.classes) {
        courseList = classwork.classes
          .filter(c => c.name && (c.average != null || c.letterGrade != null))
          .map(c => {
            const grade = c.letterGrade ? `${c.letterGrade} (${c.average ?? '?'}%)` : `${c.average}%`
            return `${c.name}: ${grade}`
          })
      }
    }

    // Attendance summary (month 0 = current month)
    let attendanceSummary = ''
    const attendance = cache['attendance:0']?.data as {
      month?: string; year?: number
      summary?: { absences: number; excused: number; tardies: number }
    } | undefined
    if (attendance?.summary) {
      const s = attendance.summary
      const month = attendance.month && attendance.year ? `${attendance.month} ${attendance.year}` : 'This month'
      attendanceSummary = `${month}: ${s.absences} absence(s), ${s.excused} excused, ${s.tardies} tardy(ies)`
    }

    return { weightedGpa, unweightedGpa, classRank, courseList, transcriptSummary, attendanceSummary }
  } catch { return null }
}

router.post('/chat', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.userId === undefined) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    return
  }
  try {
    const { message: userMessage } = req.body as { message: string }

    const [profile, user, assignments, portalData] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: req.userId } }),
      prisma.user.findUnique({ where: { id: req.userId } }),
      prisma.assignment.findMany({
        where: { userId: req.userId, completed: false },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
      getPortalData(req.userId),
    ])

    const rawName = user?.name ?? null
    let firstName = 'Student'
    if (rawName) {
      if (rawName.includes(',')) {
        const rest = rawName.split(',')[1]?.trim() ?? ''
        const first = rest.split(' ')[0]
        firstName = first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : 'Student'
      } else {
        firstName = rawName.split(' ')[0]
      }
    }

    const wGpa = (portalData?.weightedGpa ?? profile?.weightedGpa)?.toFixed(3) ?? 'unknown'
    const uGpa = (portalData?.unweightedGpa ?? profile?.unweightedGpa)?.toFixed(3) ?? 'unknown'
    const courseList = portalData?.courseList?.join(', ') || 'none on record'

    const assignmentList = assignments
      .map(a => `"${a.title}" (${a.subject}) due ${new Date(a.dueDate).toLocaleDateString()}`)
      .join(', ')

    const systemPrompt = `You are NextStep AI, an academic companion for high school students. Answer based only on the student data below — never invent numbers or facts. Be encouraging, concise, and specific. Keep responses under 4 sentences.

Student: ${firstName}, Grade ${profile?.gradeLevel ?? 'unknown'}
Current GPA: ${uGpa} unweighted, ${wGpa} weighted${portalData?.classRank ? ` | Class rank: ${portalData.classRank}` : ''}
Current semester courses & grades: ${courseList}
Pending assignments: ${assignmentList || 'none'}${portalData?.attendanceSummary ? `\nAttendance this month: ${portalData.attendanceSummary}` : ''}
SAT score: ${profile?.satScore ?? 'not entered'}
College goal: ${profile?.futureDecision ?? 'not specified'}

When asked about weakest/strongest class, best/worst grade, or any course comparison — always use "Current semester courses & grades" above, never guess.`

    const response = await openrouter.chat.completions.create({
      model: FREE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 300,
    })

    const reply = response.choices[0]?.message?.content ?? 'Sorry, I could not generate a response right now.'
    res.json({ data: { reply } })
  } catch (err) {
    console.error('[AI CHAT]', err)
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
      take: 20,
    })

    if (assignments.length === 0) {
      res.json({ data: { overview: "You're all caught up! No assignments pending.", days: [] } })
      return
    }

    const today = new Date()
    const todayStr = today.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })

    const assignmentList = assignments.map(a => ({
      id: a.id,
      title: a.title,
      subject: a.subject,
      dueDate: new Date(a.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    }))

    const prompt = `Today is ${todayStr}. Create a realistic study plan for these assignments:

${JSON.stringify(assignmentList, null, 2)}

Rules: max 120 min/day, prioritize soonest due dates, split large tasks across days, only include days with work.

Respond with ONLY a JSON object in exactly this shape (no markdown, no extra text):
{
  "overview": "1-2 sentence motivational summary",
  "days": [
    {
      "label": "Today" | "Tomorrow" | "Weekday, Mon DD",
      "date": "YYYY-MM-DD",
      "sessions": [
        {
          "assignmentId": <number>,
          "title": "<string>",
          "subject": "<string>",
          "dueDate": "<string>",
          "minutesToSpend": <number>,
          "notes": "<string>"
        }
      ]
    }
  ]
}`

    const response = await openrouter.chat.completions.create({
      model: FREE_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
    })

    const raw = response.choices[0]?.message?.content ?? '{}'
    const data = JSON.parse(extractJson(raw))
    res.json({ data })
  } catch (err) {
    console.error('[AI STUDY PLAN]', err)
    res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
  }
})

export default router
