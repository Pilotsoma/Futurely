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
import collegeCatalogRouter from './routes/collegeCatalog'
import marketplaceRouter from './routes/marketplace'
import educatorRouter from './routes/educator'
import counselorRouter from './routes/counselor'
import adminRouter from './routes/admin'
import schoolsRouter from './routes/schools'
import setsRouter from './routes/sets'
import gamesRouter from './routes/games'

import { requireAuth } from './middleware/auth'
import gradesIntegrationRouter from './integrations/grades/gradesRouter'
import canvasRouter from './integrations/canvas/canvasRouter'
// DISABLED: ClassLink integration paused, pending completion — router left in place, not mounted.
// import classlinkRouter from './integrations/classlink/classlinkRouter'
import { logger } from './common/logger'

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

const CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
const CORS_ALLOWED_HEADERS = ['Content-Type', 'Authorization']
// Expose rate-limit headers so clients can read their quota without guessing.
const CORS_EXPOSED_HEADERS = ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'RateLimit-Policy']

app.use(cors({
  origin: (origin, cb) => {
    // No Origin header = native mobile / server-to-server — allow.
    if (!origin) return cb(null, true)

    if (ACTIVE_ORIGINS.includes(origin)) return cb(null, true)

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

// Portal credential + scrape endpoints: each request triggers a live login or
// scrape against a school portal, so throttle harder than the global limiter.
const portalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many portal requests, please wait before retrying.' } },
  handler: (req, res, _next, options) => {
    logger.warn('rate_limit_hit', { type: 'portal', ip: req.ip, path: req.originalUrl })
    res.status(options.statusCode).json(options.message)
  },
})

// Each prediction triggers a call to the external ML model server — throttle
// harder than the global limiter, same rationale as aiLimiter.
const collegePredictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many prediction requests, please wait before retrying.' } },
  handler: (req, res, _next, options) => {
    logger.warn('rate_limit_hit', { type: 'college_predict', ip: req.ip, path: req.originalUrl })
    res.status(options.statusCode).json(options.message)
  },
})

// Path calls the model server twice AND Anthropic per request — tighter limit
// than /predict (10/min vs 30/min) to reflect the materially higher cost.
const collegePathLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many path requests, please wait before retrying.' } },
  handler: (req, res, _next, options) => {
    logger.warn('rate_limit_hit', { type: 'college_path', ip: req.ip, path: req.originalUrl })
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

// Portal login + forced re-sync hit the school portal directly — strict limit.
app.use('/integrations/grades/hac/login', portalLimiter)
app.use('/integrations/grades/powerschool/login', portalLimiter)
app.use('/integrations/grades/sync-profile', portalLimiter)
app.use('/schools', schoolsRouter)
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

// College catalog — no auth required (shared reference data, no FERPA/COPPA implications).
// Must be registered BEFORE the auth-gated /colleges mount so Express matches this first.
app.use('/colleges/catalog', collegeCatalogRouter)

// Predict calls the ML model server per request — stricter limit than the rest of /colleges.
app.use('/colleges/predict', collegePredictLimiter)
// Path calls model server twice + Anthropic — tighter limit than /predict.
app.use('/colleges/path', collegePathLimiter)

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
  // DISABLED: ClassLink integration paused, pending completion
  // app.use('/integrations/classlink', devBypass, classlinkRouter)
  app.use('/colleges', devBypass, collegesRouter)
  app.use('/marketplace', devBypass, marketplaceRouter)
  app.use('/educator', devBypass, educatorRouter)
  app.use('/counselor', devBypass, counselorRouter)
  app.use('/admin', devBypass, adminRouter)
  app.use('/sets', devBypass, setsRouter)
  app.use('/games', devBypass, gamesRouter)

} else {
  app.use('/assignments', requireAuth, assignmentsRouter)
  app.use('/students', requireAuth, studentsRouter)
  app.use('/roadmap', requireAuth, roadmapRouter)
  app.use('/ai', aiLimiter, requireAuth, aiRouter)
  app.use('/feed', requireAuth, feedRouter)
  app.use('/notifications', requireAuth, notificationsRouter)
  app.use('/integrations/grades', requireAuth, gradesIntegrationRouter)
  app.use('/integrations/canvas', requireAuth, canvasRouter)
  // DISABLED: ClassLink integration paused, pending completion
  // app.use('/integrations/classlink', requireAuth, classlinkRouter)
  app.use('/colleges', requireAuth, collegesRouter)
  app.use('/marketplace', requireAuth, marketplaceRouter)
  app.use('/educator', requireAuth, educatorRouter)
  app.use('/counselor', requireAuth, counselorRouter)
  app.use('/admin', requireAuth, adminRouter)
  app.use('/sets', requireAuth, setsRouter)
  app.use('/games', requireAuth, gamesRouter)

}

app.use('/parent', authLimiter, parentRouter)

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