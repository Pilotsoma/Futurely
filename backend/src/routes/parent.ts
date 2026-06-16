import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { loginHAC, getGrades, getStudentInfo, getTranscript } from '../integrations/grades/hacClient'
import { normalizeHacGrades } from '../integrations/grades/normalizeGrades'
import { encryptPassword, decryptPassword } from '../integrations/grades/credentialCrypto'
import { deleteSessionByUserId } from '../integrations/grades/sessionStore'

const router = Router()
router.use(requireAuth)

const connectSchema = z.object({
  districtUrl: z.string().url('districtUrl must be a valid URL'),
  username: z.string().min(1, 'username required'),
  password: z.string().min(1, 'password required'),
})

// Offset parent IDs to avoid colliding with real user session IDs in the session store
function tempSessionId(parentId: number): number {
  return parentId + 1_000_000_000
}

type CachedStudentData = {
  studentName: string | null
  gradeLevel: number | null
  graduationYear: number | null
  weightedGpa: number | null
  unweightedGpa: number | null
  courses: Array<{
    id: string
    name: string
    teacher: string
    period: string
    average: number | null
    letterGrade: string | null
    upcomingAssignments: Array<{
      name: string
      category: string
      score: number | null
      totalPoints: number | null
      percentage: string
      dateDue: string
    }>
  }>
}

async function scrapeStudentData(
  districtUrl: string,
  username: string,
  password: string,
  tempId: number,
): Promise<{ sessionToken: string; data: CachedStudentData }> {
  const sessionToken = await loginHAC(districtUrl, username, password, tempId)

  let studentName: string | null = null
  let gradeLevel: number | null = null
  let graduationYear: number | null = null
  let weightedGpa: number | null = null
  let unweightedGpa: number | null = null
  let courses: CachedStudentData['courses'] = []

  try {
    const info = await getStudentInfo(sessionToken)
    studentName = info.name?.trim() || null
    const gradeNum = parseInt(info.grade ?? '', 10)
    if (!isNaN(gradeNum) && gradeNum >= 6 && gradeNum <= 12) gradeLevel = gradeNum
    const cohort = parseInt((info.cohortYear ?? '').replace(/\D/g, ''), 10)
    if (!isNaN(cohort) && cohort > 2020 && cohort < 2040) graduationYear = cohort
  } catch { /* non-fatal */ }

  try {
    const transcript = await getTranscript(sessionToken)
    const w = parseFloat(transcript.weightedGPA ?? '')
    const uw = parseFloat(transcript.unweightedGPA ?? '')
    if (!isNaN(w)) weightedGpa = Math.round(w * 1000) / 1000
    if (!isNaN(uw)) unweightedGpa = Math.round(uw * 1000) / 1000
  } catch { /* non-fatal */ }

  try {
    const rawGrades = await getGrades(sessionToken)
    const normalized = normalizeHacGrades(rawGrades.classes ?? [])
    console.log('[PARENT] HAC grades scraped:', normalized.length, 'courses')
    courses = normalized.map(c => ({
      id: c.id,
      name: c.name,
      teacher: c.teacher,
      period: c.period,
      average: c.average,
      letterGrade: c.letterGrade,
      upcomingAssignments: c.upcomingAssignments,
    }))
  } catch (e) {
    console.warn('[PARENT] HAC grades fetch failed (non-fatal):', e instanceof Error ? e.message : String(e))
  }

  return {
    sessionToken,
    data: { studentName, gradeLevel, graduationYear, weightedGpa, unweightedGpa, courses },
  }
}

// ── Connect child via HAC portal credentials ───────────────────────────────────

router.post('/link-student', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parentId = req.userId!
    const parent = await prisma.user.findUnique({ where: { id: parentId } })
    if (!parent || parent.role !== 'PARENT') {
      res.status(403).json({ error: { message: 'Only parent accounts can link students' } })
      return
    }

    const parse = connectSchema.safeParse(req.body)
    if (!parse.success) {
      res.status(400).json({ error: { message: parse.error.errors[0]?.message ?? 'Invalid request' } })
      return
    }

    const { districtUrl, username, password } = parse.data

    const existing = await prisma.parentPortalConnection.findUnique({
      where: { parentId_hacUsername_districtUrl: { parentId, hacUsername: username, districtUrl } },
    })
    if (existing) {
      res.status(409).json({ error: { message: 'This student portal is already linked to your account' } })
      return
    }

    const tempId = tempSessionId(parentId)
    let scraped: CachedStudentData
    try {
      const result = await scrapeStudentData(districtUrl, username, password, tempId)
      scraped = result.data
    } catch {
      deleteSessionByUserId(tempId)
      res.status(401).json({ error: { message: 'Invalid portal credentials. Please check your district, username, and password.' } })
      return
    }
    deleteSessionByUserId(tempId)

    let encryptedPassword: string | null = null
    try { encryptedPassword = encryptPassword(password) } catch { /* non-fatal */ }

    const conn = await prisma.parentPortalConnection.create({
      data: {
        parentId,
        systemType: 'HAC',
        districtUrl,
        hacUsername: username,
        ...(encryptedPassword ? { hacPasswordEncrypted: encryptedPassword } : {}),
        studentName: scraped.studentName,
        gradeLevel: scraped.gradeLevel,
        graduationYear: scraped.graduationYear,
        cachedData: JSON.stringify(scraped),
        lastSynced: new Date(),
      },
    })

    res.json({
      data: {
        linked: true,
        student: { id: conn.id, name: scraped.studentName, email: username },
      },
    })
  } catch (e) {
    console.error('[PARENT] link-student error:', e)
    res.status(500).json({ error: { message: 'Failed to link student' } })
  }
})

// ── List all portal-connected children (from cache) ────────────────────────────

router.get('/students', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parentId = req.userId!
    const connections = await prisma.parentPortalConnection.findMany({
      where: { parentId },
      orderBy: { createdAt: 'asc' },
    })

    const students = await Promise.all(connections.map(async conn => {
      let cached: CachedStudentData | null = null
      try { if (conn.cachedData) cached = JSON.parse(conn.cachedData) } catch { /* skip */ }

      let hacCourses = cached?.courses ?? []
      let pendingAssignments = hacCourses.reduce((sum, c) => sum + (c.upcomingAssignments?.length ?? 0), 0)
      let weightedGpa = cached?.weightedGpa ?? cached?.unweightedGpa ?? 0
      let unweightedGpa = cached?.unweightedGpa ?? 0

      // If cached data has no courses, fall back to Futurely student data via SchoolConnection
      if (hacCourses.length === 0) {
        try {
          const schoolConn = await prisma.schoolConnection.findFirst({
            where: { hacUsername: conn.hacUsername },
            include: {
              user: {
                include: {
                  courses: { include: { grades: { orderBy: { createdAt: 'desc' }, take: 1 } } },
                  assignments: { where: { completed: false } },
                  profile: true,
                },
              },
            },
          })
          if (schoolConn) {
            const futurleyStudent = schoolConn.user
            const hacCache = schoolConn.hacDataCache as Record<string, { data: unknown; cachedAt: number }> | null
            const classworkEntry = hacCache?.['classwork:__default__']?.data as { classes?: unknown[] } | undefined
            if (Array.isArray(classworkEntry?.classes) && classworkEntry.classes.length > 0) {
              const normalized = normalizeHacGrades(classworkEntry.classes as Parameters<typeof normalizeHacGrades>[0])
              hacCourses = normalized.map(c => ({ ...c, upcomingAssignments: c.upcomingAssignments }))
            } else if (futurleyStudent.courses.length > 0) {
              hacCourses = futurleyStudent.courses.map(c => ({
                id: String(c.id), name: c.name, teacher: c.teacher, period: String(c.period),
                average: c.grades[0]?.percentage ?? null, letterGrade: c.grades[0]?.letterGrade ?? null, upcomingAssignments: [],
              }))
            }
            pendingAssignments = futurleyStudent.assignments.length
            if (futurleyStudent.profile && weightedGpa === 0 && unweightedGpa === 0) {
              weightedGpa = futurleyStudent.profile.weightedGpa ?? 0
              unweightedGpa = futurleyStudent.profile.unweightedGpa ?? 0
            }
          }
        } catch { /* non-fatal */ }
      }

      const courses = hacCourses.map(c => ({
        name: c.name,
        letterGrade: c.letterGrade,
        percentage: c.average,
      }))

      return {
        id: conn.id,
        name: conn.studentName,
        email: conn.hacUsername,
        gradeLevel: conn.gradeLevel,
        graduationYear: conn.graduationYear,
        weightedGpa,
        unweightedGpa,
        pendingAssignments,
        totalCourses: courses.length,
        courses,
      }
    }))

    res.json({ data: students })
  } catch (e) {
    console.error('[PARENT] get students error:', e)
    res.status(500).json({ error: { message: 'Failed to fetch students' } })
  }
})

// ── Full data for one linked child (live re-fetch from HAC) ───────────────────

router.get('/students/:studentId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parentId = req.userId!
    const connId = parseInt(req.params.studentId)

    const conn = await prisma.parentPortalConnection.findFirst({
      where: { id: connId, parentId },
    })
    if (!conn) {
      res.status(403).json({ error: { message: 'Student not linked to your account' } })
      return
    }

    let cached: CachedStudentData | null = null
    try { if (conn.cachedData) cached = JSON.parse(conn.cachedData) } catch { /* skip */ }

    // Try to re-fetch live data if we have stored credentials
    if (conn.hacPasswordEncrypted) {
      const tempId = tempSessionId(parentId)
      try {
        const decrypted = decryptPassword(conn.hacPasswordEncrypted)
        const result = await scrapeStudentData(conn.districtUrl, conn.hacUsername, decrypted, tempId)
        const fresh = result.data
        // Preserve existing cached courses if the live re-fetch returned none — grades
        // scraping can fail silently while login succeeds, and we must not overwrite good data.
        if (fresh.courses.length === 0 && (cached?.courses.length ?? 0) > 0) {
          fresh.courses = cached!.courses
        }
        cached = fresh
        await prisma.parentPortalConnection.update({
          where: { id: connId },
          data: {
            cachedData: JSON.stringify(cached),
            studentName: cached.studentName ?? conn.studentName,
            gradeLevel: cached.gradeLevel ?? conn.gradeLevel,
            graduationYear: cached.graduationYear ?? conn.graduationYear,
            lastSynced: new Date(),
          },
        })
      } catch (e) {
        console.warn('[PARENT] Live HAC re-fetch failed, using cached data:', e instanceof Error ? e.message : String(e))
      }
      deleteSessionByUserId(tempId)
    }

    let courses = cached?.courses ?? []
    let gpaW = cached?.weightedGpa ?? cached?.unweightedGpa ?? 0
    let gpaUW = cached?.unweightedGpa ?? 0
    const studentName = cached?.studentName ?? conn.studentName

    // Always try to find the Futurely student by HAC username via SchoolConnection,
    // which stores the exact HAC username (e.g. "K2008105") separate from the email.
    let futurleyAssignments: Array<{
      id: number; title: string; subject: string; dueDate: string;
      estimatedMinutes: number; completed: boolean; completedAt: string | null; priority: string | null
    }> = []

    try {
      const schoolConn = await prisma.schoolConnection.findFirst({
        where: { hacUsername: conn.hacUsername },
        include: {
          user: {
            include: {
              courses: { include: { grades: { orderBy: { createdAt: 'desc' }, take: 1 } } },
              assignments: {
                where: { completed: false },
                orderBy: { dueDate: 'asc' },
                take: 100,
              },
              profile: true,
            },
          },
        },
      })

      if (schoolConn) {
        const futurleyStudent = schoolConn.user
        console.log('[PARENT] Matched Futurely student id:', futurleyStudent.id, 'via HAC username:', conn.hacUsername)

        // Pull assignments from Futurely Assignment table
        futurleyAssignments = futurleyStudent.assignments.map((a, i) => ({
          id: i + 1,
          title: a.title,
          subject: a.subject,
          dueDate: a.dueDate.toISOString(),
          estimatedMinutes: 0,
          completed: false,
          completedAt: null,
          priority: null,
        }))

        // Pull courses from HAC cache or Futurely Course/Grade tables if HAC scrape is empty
        if (courses.length === 0) {
          const hacCache = schoolConn.hacDataCache as Record<string, { data: unknown; cachedAt: number }> | null
          const classworkEntry = hacCache?.['classwork:__default__']?.data as { classes?: unknown[] } | undefined
          if (Array.isArray(classworkEntry?.classes) && classworkEntry.classes.length > 0) {
            console.log('[PARENT] Using student HAC cache:', classworkEntry.classes.length, 'classes')
            const normalized = normalizeHacGrades(classworkEntry.classes as Parameters<typeof normalizeHacGrades>[0])
            courses = normalized.map(c => ({
              id: c.id,
              name: c.name,
              teacher: c.teacher,
              period: c.period,
              average: c.average,
              letterGrade: c.letterGrade,
              upcomingAssignments: c.upcomingAssignments,
            }))
          } else if (futurleyStudent.courses.length > 0) {
            console.log('[PARENT] Using Futurely Course table:', futurleyStudent.courses.length, 'courses')
            courses = futurleyStudent.courses.map(c => ({
              id: String(c.id),
              name: c.name,
              teacher: c.teacher,
              period: String(c.period),
              average: c.grades[0]?.percentage ?? null,
              letterGrade: c.grades[0]?.letterGrade ?? null,
              upcomingAssignments: [],
            }))
          }
        }

        // Pull GPA from Futurely Profile if HAC has none
        if (futurleyStudent.profile && gpaW === 0 && gpaUW === 0) {
          gpaW = futurleyStudent.profile.weightedGpa ?? 0
          gpaUW = futurleyStudent.profile.unweightedGpa ?? 0
        }
      } else {
        console.log('[PARENT] No Futurely SchoolConnection found for HAC username:', conn.hacUsername)
      }
    } catch (fallbackErr) {
      console.warn('[PARENT] Futurely lookup failed:', fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr))
    }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 86_400_000)
    const weekEnd = new Date(todayStart.getTime() + 7 * 86_400_000)

    // Build assignment list: Futurely assignments take priority; supplement with HAC upcoming if any
    let assignmentId = futurleyAssignments.length
    const hacUpcomingAssignments = courses.flatMap(c =>
      (c.upcomingAssignments ?? []).map(a => {
        const dueDate = a.dateDue ? new Date(a.dateDue) : null
        return {
          id: ++assignmentId,
          title: a.name,
          subject: c.name,
          dueDate: (dueDate && !isNaN(dueDate.getTime()) ? dueDate : now).toISOString(),
          estimatedMinutes: 0,
          completed: false,
          completedAt: null as string | null,
          priority: null as string | null,
        }
      }),
    )
    // Merge: Futurely assignments first, then HAC upcoming not already present by title
    const futurleyTitles = new Set(futurleyAssignments.map(a => a.title.toLowerCase()))
    const assignments = [
      ...futurleyAssignments,
      ...hacUpcomingAssignments.filter(a => !futurleyTitles.has(a.title.toLowerCase())),
    ]

    const pendingAssignments = assignments.filter(a => !a.completed).length
    const assignmentsDueToday = assignments.filter(a => {
      const d = new Date(a.dueDate)
      return d >= todayStart && d < todayEnd
    }).length
    const assignmentsDueThisWeek = assignments.filter(a => {
      const d = new Date(a.dueDate)
      return d >= todayStart && d < weekEnd
    }).length

    const mappedCourses = courses.map((c, i) => ({
      id: i + 1,
      name: c.name,
      teacher: c.teacher,
      period: parseInt(c.period) || (i + 1),
      courseType: 'REGULAR',
      semester: 'FALL',
      creditHours: 1,
      grade: c.average !== null ? { letterGrade: c.letterGrade ?? '—', percentage: c.average } : null,
    }))

    res.json({
      data: {
        id: conn.id,
        name: studentName,
        email: conn.hacUsername,
        role: 'STUDENT',
        profile: {
          weightedGpa: gpaW,
          unweightedGpa: gpaUW,
          gradeLevel: cached?.gradeLevel ?? conn.gradeLevel ?? 0,
          graduationYear: cached?.graduationYear ?? conn.graduationYear ?? 0,
          futureDecision: null,
          satScore: null,
          actScore: null,
          counselorName: null,
        },
        courses: mappedCourses,
        assignments,
        stats: {
          totalCourses: courses.length,
          pendingAssignments,
          assignmentsDueToday,
          assignmentsDueThisWeek,
        },
      },
    })
  } catch (e) {
    console.error('[PARENT] get student detail error:', e)
    res.status(500).json({ error: { message: 'Failed to fetch student data' } })
  }
})

// ── Disconnect child portal ────────────────────────────────────────────────────

router.delete('/students/:studentId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parentId = req.userId!
    const connId = parseInt(req.params.studentId)
    await prisma.parentPortalConnection.deleteMany({ where: { id: connId, parentId } })
    res.json({ data: { unlinked: true } })
  } catch (e) {
    console.error('[PARENT] unlink student error:', e)
    res.status(500).json({ error: { message: 'Failed to remove student' } })
  }
})

// ── AI chat in context of a linked child ──────────────────────────────────────

router.post('/students/:studentId/chat', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parentId = req.userId!
    const connId = parseInt(req.params.studentId)
    const { message } = req.body as { message?: string }

    if (!message?.trim()) {
      res.status(400).json({ error: { message: 'message is required' } })
      return
    }

    const conn = await prisma.parentPortalConnection.findFirst({
      where: { id: connId, parentId },
    })
    if (!conn) {
      res.status(403).json({ error: { message: 'Student not linked to your account' } })
      return
    }

    let cached: CachedStudentData | null = null
    try { if (conn.cachedData) cached = JSON.parse(conn.cachedData) } catch { /* ignore */ }

    const courses = cached?.courses ?? []
    const coursesSummary = courses
      .map(c => `${c.name}: ${c.letterGrade ?? '?'} (${c.average?.toFixed(1) ?? 'N/A'}%)`)
      .join(', ')
    const pendingCount = courses.reduce((sum, c) => sum + (c.upcomingAssignments?.length ?? 0), 0)

    const OpenAI = (await import('openai')).default
    const openrouter = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY ?? '',
      baseURL: 'https://openrouter.ai/api/v1',
    })

    const systemPrompt = `You are NextStep AI, an academic advisor assistant for parents.
You are helping a parent review their student's academic performance.
Student: ${conn.studentName ?? 'Unknown'}
Grade level: ${conn.gradeLevel ?? 'unknown'}
Weighted GPA: ${cached?.weightedGpa?.toFixed(3) ?? 'unknown'}
Unweighted GPA: ${cached?.unweightedGpa?.toFixed(3) ?? 'unknown'}
Current courses: ${coursesSummary || 'none on file'}
Pending assignments: ${pendingCount}
Answer the parent's question clearly and helpfully. Be concise.`

    const response = await openrouter.chat.completions.create({
      model: 'openrouter/free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message.trim() },
      ],
      max_tokens: 512,
    })
    const reply = response.choices[0]?.message?.content ?? 'No response.'
    res.json({ data: { reply } })
  } catch (e) {
    console.error('[PARENT] chat error:', e)
    res.status(500).json({ error: { message: 'AI chat failed' } })
  }
})

export default router
