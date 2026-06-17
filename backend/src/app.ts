import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import axios from 'axios'
import jwt from 'jsonwebtoken'
import authRoutes from './routes/auth'
import gradesRoutes from './routes/grades'
import assignmentsRouter from './routes/assignments'
import studentsRouter from './routes/students'
import roadmapRouter from './routes/roadmap'
import aiRouter from './routes/ai'
import feedRouter from './routes/feed'
import parentRouter from './routes/parent'
import notificationsRouter from './routes/notifications'
import collegesRouter from './routes/colleges'
import marketplaceRouter from './routes/marketplace'
import { requireAuth } from './middleware/auth'
import gradesIntegrationRouter from './integrations/grades/gradesRouter'
import canvasRouter from './integrations/canvas/canvasRouter'

const app = express()
const isProd = process.env.NODE_ENV === 'production'

// ── Security headers ────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow image/asset loading
}))

// ── CORS — lock to known origins in production ───────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

app.use(cors({
  origin: isProd
    ? (origin, cb) => {
        // Allow server-to-server (no origin) or whitelisted origins
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
        cb(new Error(`CORS: origin ${origin} not allowed`))
      }
    : true,
  credentials: true,
}))

// ── Body size limit — prevent large-payload DoS ──────────────────────────────
app.use(express.json({ limit: '50kb' }))
app.use(express.urlencoded({ extended: true, limit: '50kb' }))

// ── Global rate limiter — 300 req / 15 min per IP ────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down.' } },
})
app.use(globalLimiter)

// ── Strict limiters for expensive / sensitive endpoints ──────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many auth attempts, try again later.' } },
})

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'AI rate limit reached, wait a moment.' } },
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many accounts created from this IP.' } },
})

// ── Request logger — prod omits body to avoid leaking PII ───────────────────
app.use((req, _res, next) => {
  if (isProd) {
    console.log(`[REQ] ${req.method} ${req.originalUrl}`)
  } else {
    console.log(`[REQ] ${req.method} ${req.originalUrl}`)
    console.log('[REQ] content-type:', req.headers['content-type'])
    console.log('[REQ] auth header exists:', Boolean(req.headers.authorization))
    if (req.method !== 'GET') {
      console.log('[REQ] body:', {
        ...req.body,
        password: req.body?.password ? '[hidden]' : undefined,
      })
    }
  }
  next()
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/health/connectivity', async (_req, res) => {
  const testUrl = 'https://homeaccess.katyisd.org/HomeAccess/Account/LogOn'

  try {
    const result = await axios.get<string>(testUrl, {
      timeout: 10_000,
      validateStatus: () => true,
    })

    res.json({
      status: 'reachable',
      hacStatusCode: result.status,
      url: testUrl,
      message: 'Backend can reach HAC portal',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const code = (err as { code?: string }).code

    res.json({
      status: 'unreachable',
      error: message,
      code,
      url: testUrl,
      message: 'Backend CANNOT reach HAC — this is the root cause of login failures',
    })
  }
})

// Auth routes get their own tight limiter; register gets an even stricter one
app.use('/auth/register', registerLimiter)
app.use('/auth', authLimiter, authRoutes)
app.use('/grades', gradesRoutes)

/**
 * TEMPORARY LOCAL DEV ONLY:
 * When ENABLE_DEV_INTEGRATION_AUTH_BYPASS=true (set in .env), all protected
 * routes inject userId=1 so the app works without a JWT.  This lets you test
 * on-device via Expo Go without going through the full auth flow first.
 *
 * Before production, set ENABLE_DEV_INTEGRATION_AUTH_BYPASS=false.
 */
const ENABLE_DEV_INTEGRATION_AUTH_BYPASS =
  process.env.ENABLE_DEV_INTEGRATION_AUTH_BYPASS === 'true'

function devBypass(req: any, _res: any, next: any): void {
  const authHeader = req.headers?.authorization as string | undefined
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7)
      const secret = process.env.JWT_SECRET!
      const payload = jwt.verify(token, secret) as { sub?: number | string }
      const id = typeof payload.sub === 'number'
        ? payload.sub
        : parseInt(String(payload.sub), 10)
      if (!isNaN(id)) {
        req.userId = id
        next()
        return
      }
    } catch {
      // Token invalid — fall through to default
    }
  }
  req.userId = 1
  next()
}

if (ENABLE_DEV_INTEGRATION_AUTH_BYPASS) {
  console.warn('⚠️  [DEV] Auth bypass active — requests will use real JWT userId or fall back to userId=1')
  console.warn('⚠️  [DEV] Set ENABLE_DEV_INTEGRATION_AUTH_BYPASS=false before any real testing')
  app.use('/assignments', devBypass, assignmentsRouter)
  app.use('/students', devBypass, studentsRouter)
  app.use('/roadmap', devBypass, roadmapRouter)
  app.use('/ai', aiLimiter, devBypass, aiRouter)
  app.use('/feed', devBypass, feedRouter)
  app.use('/notifications', devBypass, notificationsRouter)
  app.use('/integrations/grades', devBypass, gradesIntegrationRouter)
  app.use('/integrations/canvas', devBypass, canvasRouter)
  app.use('/colleges', devBypass, collegesRouter)
  app.use('/marketplace', devBypass, marketplaceRouter)
} else {
  app.use('/assignments', requireAuth, assignmentsRouter)
  app.use('/students', requireAuth, studentsRouter)
  app.use('/roadmap', requireAuth, roadmapRouter)
  app.use('/ai', aiLimiter, requireAuth, aiRouter)
  app.use('/feed', requireAuth, feedRouter)
  app.use('/notifications', requireAuth, notificationsRouter)
  app.use('/integrations/grades', requireAuth, gradesIntegrationRouter)
  app.use('/integrations/canvas', requireAuth, canvasRouter)
  app.use('/colleges', requireAuth, collegesRouter)
  app.use('/marketplace', requireAuth, marketplaceRouter)
}

app.use('/parent', parentRouter)

export default app
