import 'dotenv/config'

// Crash fast in production if JWT_SECRET is missing or is the default dev value
const DEFAULT_JWT_SECRET = 'nextstep-dev-secret-change-in-production'
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET is not set or is the default insecure value.')
    process.exit(1)
  } else {
    console.warn('⚠️  [SECURITY] JWT_SECRET is missing or is the default dev value. Set a strong secret before deploying.')
  }
}

if (!process.env.CREDENTIAL_ENCRYPTION_KEY) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: CREDENTIAL_ENCRYPTION_KEY is not set.')
    process.exit(1)
  } else {
    console.warn('⚠️  [SECURITY] CREDENTIAL_ENCRYPTION_KEY is missing. HAC/Canvas credential encryption will fail.')
  }
}

import express from 'express'
import cors from 'cors'
import compression from 'compression'
import cookieParser from 'cookie-parser'
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
import educatorRouter from './routes/educator'
import counselorRouter from './routes/counselor'
import adminRouter from './routes/admin'
import schoolsRouter from './routes/schools'
import setsRouter from './routes/sets'
import gamesRouter from './routes/games'
import agentSessionsRouter from './routes/agentSessions'
import usersRouter from './routes/users'

import { requireAuth } from './middleware/auth'
import { requireConsent } from './middleware/requireConsent'
import gradesIntegrationRouter from './integrations/grades/gradesRouter'
import canvasRouter from './integrations/canvas/canvasRouter'
import classlinkRouter from './integrations/classlink/classlinkRouter'
import { logger } from './common/logger'
import { runWithAiRequestContext } from './lib/aiRequestContext'

const app = express()
const isProd = process.env.NODE_ENV === 'production'

// Always behind a reverse proxy (Vercel, Render, Railway) — trust one hop so
// req.ip resolves to the real client IP from X-Forwarded-For.
app.set('trust proxy', 1)

// ── Gzip compression — dramatically reduces Neon egress / bandwidth ──────────
app.use(compression())

// ── Security headers ────────────────────────────────────────────────────────
// crossOriginResourcePolicy is 'same-site': this is a pure JSON API with no
// public embeddable assets, so there is no reason for cross-origin pages to
// load resources from it directly.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
}))

// ── CORS ─────────────────────────────────────────────────────────────────────
// Explicit allowlist — never a wildcard, never `origin: true`.
//
// Why !origin passes: native mobile clients (Expo Go, React Native fetch) and
// server-to-server calls omit the Origin header entirely. Allowing these is
// intentional and safe — browsers always send Origin on cross-site requests.
//
// Production: set ALLOWED_ORIGINS=https://app.futurely.app,https://... in .env
// Development: a small fixed allowlist covers Next.js (3000) and Expo web (19006).

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

const DEV_ORIGINS = [
  'http://localhost:3000',  // Next.js web dev server
  'http://localhost:19006', // Expo web
  'http://localhost:8081',  // Expo bundler / Metro
]

// Use ALLOWED_ORIGINS if explicitly set (works regardless of NODE_ENV),
// otherwise fall back to DEV_ORIGINS. This handles Vercel's experimental
// backend where NODE_ENV may not be 'production'.
const ACTIVE_ORIGINS = ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : DEV_ORIGINS
console.log(`[CORS] Active origins:`, ACTIVE_ORIGINS.join(', ') || '(none — all non-browser requests allowed)')

// Dev-only convenience: when testing the Expo web preview from a phone on the
// same WiFi (e.g. Safari at http://192.168.x.x:8081), the Origin header is the
// LAN IP, not localhost — which the fixed DEV_ORIGINS list above can't predict
// since it changes per network. This pattern only applies when ALLOWED_ORIGINS
// isn't explicitly set (i.e. never in production, where it's always set).
const isDevFallback = ALLOWED_ORIGINS.length === 0
const LAN_ORIGIN_PATTERN = /^http:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}):(3000|8081|19006)$/

const CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
const CORS_ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Client-Platform', 'X-AI-Skip-Primary']
// Expose rate-limit headers so clients can read their quota without guessing,
// and X-AI-Used-Fallback so the client can remember to skip the primary AI
// model for the rest of this session once it's seen a fallback happen.
const CORS_EXPOSED_HEADERS = ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'RateLimit-Policy', 'X-AI-Used-Fallback']

app.use(cors({
  origin: (origin, cb) => {
    // No Origin header = native mobile / server-to-server — allow.
    if (!origin) return cb(null, true)

    if (ACTIVE_ORIGINS.includes(origin)) return cb(null, true)

    if (isDevFallback && LAN_ORIGIN_PATTERN.test(origin)) return cb(null, true)

    const allowedStr = ACTIVE_ORIGINS.length > 0 ? ACTIVE_ORIGINS.join(', ') : '(none)'
    cb(new Error(`CORS: origin '${origin}' is not allowed. Allowed origins: ${allowedStr}`))
  },
  credentials: true,
  methods: CORS_METHODS,
  allowedHeaders: CORS_ALLOWED_HEADERS,
  exposedHeaders: CORS_EXPOSED_HEADERS,
  maxAge: 86400, // cache preflight for 24 h — reduces OPTIONS round-trips
}))

// ── Cookie parser — required for httpOnly cookie auth (web clients) ───────────
app.use(cookieParser())

// ── Body size limit — prevent large-payload DoS ──────────────────────────────
app.use(express.json({ limit: '50kb' }))
app.use(express.urlencoded({ extended: true, limit: '50kb' }))


// ── Global rate limiter — 1000 req / 15 min per IP ───────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down.' } },
  handler: (req, res, _next, options) => {
    logger.warn('rate_limit_hit', { type: 'global', ip: req.ip, path: req.originalUrl })
    res.status(options.statusCode).json(options.message)
  },
})
app.use(globalLimiter)

// ── Strict limiters for expensive / sensitive endpoints ──────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many auth attempts, try again later.' } },
  handler: (req, res, _next, options) => {
    logger.warn('rate_limit_hit', { type: 'auth', ip: req.ip, path: req.originalUrl })
    res.status(options.statusCode).json(options.message)
  },
})

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'AI rate limit reached, wait a moment.' } },
  handler: (req, res, _next, options) => {
    logger.warn('rate_limit_hit', { type: 'ai', ip: req.ip, path: req.originalUrl })
    res.status(options.statusCode).json(options.message)
  },
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many accounts created from this IP.' } },
  handler: (req, res, _next, options) => {
    logger.warn('rate_limit_hit', { type: 'register', ip: req.ip })
    res.status(options.statusCode).json(options.message)
  },
})


// ── Request logger — never log sensitive fields ──────────────────────────────
const SENSITIVE_FIELDS = new Set(['password', 'token', 'refreshToken', 'newPassword', 'currentPassword'])

app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    logger.info('http_request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ip: req.ip,
      duration_ms: Date.now() - start,
    })
  })
  if (!isProd) {
    console.log('[REQ] content-type:', req.headers['content-type'])
    console.log('[REQ] auth header exists:', Boolean(req.headers.authorization))
    if (req.method !== 'GET' && req.body) {
      const sanitized: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(req.body as Record<string, unknown>)) {
        sanitized[k] = SENSITIVE_FIELDS.has(k) && v ? '[hidden]' : v
      }
      console.log('[REQ] body:', sanitized)
    }
  }
  next()
})

// Lets the client tell us (once it's seen a fallback happen this session)
// to skip straight to the reliable AI model on every subsequent request,
// instead of paying for a doomed primary-model attempt each time. See
// lib/aiRequestContext.ts and lib/aiClient.ts's createChatCompletion().
app.use((req, res, next) => {
  const skipPrimary = req.headers['x-ai-skip-primary'] === '1'
  runWithAiRequestContext(res, skipPrimary, next)
})

app.get('/health', async (_req, res) => {
  const dbUrl = process.env.DATABASE_URL ?? ''
  const dbHost = dbUrl.match(/@([^/]+)\//)?.[1] ?? 'unknown'
  try {
    const { prisma } = await import('./lib/prisma')
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', db: 'connected', dbHost })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(503).json({ status: 'error', db: 'unreachable', dbHost, error: msg })
  }
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
app.use('/schools', schoolsRouter)
app.use('/grades', requireAuth, requireConsent, gradesRoutes)

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

// Hard safety net: this flag defaults every protected route (including /admin)
// to userId=1 with zero authentication. It must never be reachable in
// production — crash immediately rather than silently exposing everything.
if (ENABLE_DEV_INTEGRATION_AUTH_BYPASS && isProd) {
  console.error('FATAL: ENABLE_DEV_INTEGRATION_AUTH_BYPASS=true with NODE_ENV=production. Refusing to start — this would disable authentication on every protected route.')
  process.exit(1)
}

function devBypass(req: any, _res: any, next: any): void {
  const authHeader = req.headers?.authorization as string | undefined
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7)
      const secret = process.env.JWT_SECRET!
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as { sub?: number | string }
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
  app.use('/assignments', devBypass, requireConsent, assignmentsRouter)
  app.use('/students', devBypass, requireConsent, studentsRouter)
  app.use('/roadmap', devBypass, requireConsent, roadmapRouter)
  app.use('/ai', aiLimiter, devBypass, requireConsent, aiRouter)
  app.use('/ai/agent', aiLimiter, devBypass, requireConsent, agentSessionsRouter)
  app.use('/users', devBypass, requireConsent, usersRouter)
  app.use('/feed', devBypass, requireConsent, feedRouter)
  app.use('/notifications', devBypass, requireConsent, notificationsRouter)
  app.use('/integrations/grades', devBypass, requireConsent, gradesIntegrationRouter)
  app.use('/integrations/canvas', devBypass, requireConsent, canvasRouter)
  app.use('/integrations/classlink', devBypass, requireConsent, classlinkRouter)
  app.use('/colleges', devBypass, requireConsent, collegesRouter)
  app.use('/marketplace', devBypass, requireConsent, marketplaceRouter)
  app.use('/educator', devBypass, requireConsent, educatorRouter)
  app.use('/counselor', devBypass, requireConsent, counselorRouter)
  app.use('/admin', devBypass, requireConsent, adminRouter)
  app.use('/sets', devBypass, requireConsent, setsRouter)
  app.use('/games', devBypass, requireConsent, gamesRouter)

} else {
  app.use('/assignments', requireAuth, requireConsent, assignmentsRouter)
  app.use('/students', requireAuth, requireConsent, studentsRouter)
  app.use('/roadmap', requireAuth, requireConsent, roadmapRouter)
  app.use('/ai', aiLimiter, requireAuth, requireConsent, aiRouter)
  // Agent session routes — mounted before the generic /ai handler so
  // express-rate-limit and requireConsent are applied consistently.
  app.use('/ai/agent', aiLimiter, requireAuth, requireConsent, agentSessionsRouter)
  app.use('/users', requireAuth, requireConsent, usersRouter)
  app.use('/feed', requireAuth, requireConsent, feedRouter)
  app.use('/notifications', requireAuth, requireConsent, notificationsRouter)
  app.use('/integrations/grades', requireAuth, requireConsent, gradesIntegrationRouter)
  app.use('/integrations/canvas', requireAuth, requireConsent, canvasRouter)
  app.use('/integrations/classlink', requireAuth, requireConsent, classlinkRouter)
  app.use('/colleges', requireAuth, requireConsent, collegesRouter)
  app.use('/marketplace', requireAuth, requireConsent, marketplaceRouter)
  app.use('/educator', requireAuth, requireConsent, educatorRouter)
  app.use('/counselor', requireAuth, requireConsent, counselorRouter)
  app.use('/admin', requireAuth, requireConsent, adminRouter)
  app.use('/sets', requireAuth, requireConsent, setsRouter)
  app.use('/games', requireAuth, requireConsent, gamesRouter)

}

app.use('/parent', authLimiter, requireAuth, requireConsent, parentRouter)

// ── Global error handler ─────────────────────────────────────────────────────
// Catches any error passed to next(err) or thrown inside non-async route handlers.
// Must be registered AFTER all routes and have exactly four parameters.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : String(err)
  const stack   = err instanceof Error ? err.stack   : undefined

  // Full error logged server-side.
  console.error('[GLOBAL ERROR HANDLER]', { message, stack })

  if (!res.headersSent) {
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
    })
  }
})

export default app