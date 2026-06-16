import { Router, Response } from 'express'
import OpenAI from 'openai'
import { prisma } from '../lib/prisma'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

const FREE_MODEL = 'google/gemma-4-26b-a4b-it:free'

const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  baseURL: 'https://openrouter.ai/api/v1',
})

router.post('/chat', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.userId === undefined) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    return
  }
  try {
    const { message: userMessage } = req.body as { message: string }

    const [profile, user, courses, assignments] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: req.userId } }),
      prisma.user.findUnique({ where: { id: req.userId } }),
      prisma.course.findMany({
        where: { userId: req.userId },
        include: { grades: { where: { gradingPeriod: 'CURRENT' }, take: 1 } },
      }),
      prisma.assignment.findMany({
        where: { userId: req.userId, completed: false },
        orderBy: { dueDate: 'asc' },
        take: 3,
      }),
    ])

    const firstName = user?.name?.split(' ')[0] ?? 'Student'
    const wGpa = profile?.weightedGpa?.toFixed(3) ?? 'unknown'
    const uGpa = profile?.unweightedGpa?.toFixed(3) ?? 'unknown'

    const sorted = [...courses].sort((a, b) => {
      const ga = a.grades[0]?.percentage ?? 100
      const gb = b.grades[0]?.percentage ?? 100
      return ga - gb
    })

    const courseList = sorted
      .map(c => `${c.name}: ${c.grades[0]?.percentage ?? 'N/A'}%`)
      .join(', ')

    const assignmentList = assignments
      .map(a => `"${a.title}" (${a.subject}) due ${new Date(a.dueDate).toLocaleDateString()}`)
      .join(', ')

    const systemPrompt = `You are NextStep AI, an academic companion for high school students.
Student: ${firstName}, Grade ${profile?.gradeLevel ?? 'unknown'}
GPA: ${uGpa} unweighted, ${wGpa} weighted
Courses: ${courseList || 'none on record'}
Pending assignments: ${assignmentList || 'none'}
SAT score: ${profile?.satScore ?? 'not entered'}
College goal: ${profile?.futureDecision ?? 'not specified'}

Be encouraging, concise, and specific. Only reference the student data above — never invent numbers or facts. Keep responses under 3 sentences.`

    const response = await openrouter.chat.completions.create({
      model: FREE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 250,
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
      response_format: { type: 'json_object' },
    })

    const raw = response.choices[0]?.message?.content ?? '{}'
    const data = JSON.parse(raw)
    res.json({ data })
  } catch (err) {
    console.error('[AI STUDY PLAN]', err)
    res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
  }
})

export default router
