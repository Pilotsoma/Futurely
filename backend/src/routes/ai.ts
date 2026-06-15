import { Router, Response } from 'express'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { prisma } from '../lib/prisma'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

router.post('/chat', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.userId === undefined) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    return
  }
  try {
    const { message: userMessage } = req.body as { message: string }

    const profile = await prisma.profile.findUnique({ where: { userId: req.userId } })
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

    const model = genai.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
    })

    const result = await model.generateContent(userMessage)
    const reply = result.response.text()

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

    const model = genai.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            overview: { type: SchemaType.STRING },
            days: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  label: { type: SchemaType.STRING },
                  date:  { type: SchemaType.STRING },
                  sessions: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        assignmentId:   { type: SchemaType.NUMBER },
                        title:          { type: SchemaType.STRING },
                        subject:        { type: SchemaType.STRING },
                        dueDate:        { type: SchemaType.STRING },
                        minutesToSpend: { type: SchemaType.NUMBER },
                        notes:          { type: SchemaType.STRING },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    const prompt = `Today is ${todayStr}. Create a realistic study plan for these assignments:\n\n${JSON.stringify(assignmentList, null, 2)}\n\nRules: max 120 min/day, prioritize soonest due dates, split large tasks across days, only include days with work. Use "Today", "Tomorrow", or the weekday name for the label field. Use ISO date (YYYY-MM-DD) for the date field.`

    const result = await model.generateContent(prompt)
    const data = JSON.parse(result.response.text())

    res.json({ data })
  } catch (err) {
    console.error('[AI STUDY PLAN]', err)
    res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
  }
})

export default router
