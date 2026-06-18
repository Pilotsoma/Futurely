import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import { prisma } from '../lib/prisma'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { filterUsername } from '../lib/contentFilter'
import { sendEmail } from '../lib/email'
import { logger } from '../common/logger'

const router = Router()

// ── Constants ────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12
const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY_DAYS = 7
const RESET_TOKEN_EXPIRY_MINUTES = 15
const VERIFY_TOKEN_EXPIRY_HOURS = 24
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 2 * 60 * 60 * 1000 // 2 hours

// Stable dummy hash used to normalise timing when user doesn't exist
const DUMMY_HASH = '$2a$12$RhIbHdMHqDGwkVDSMsqmNOE7I1NLSq9k3n7N4wWfpjBYUdpFCt/0G'

// ── Rate limiters ─────────────────────────────────────────────────────────────

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    data: null,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Try again in 15 minutes.' },
  },
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    data: null,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many registration attempts from this IP.' },
  },
})

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    data: null,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many password reset attempts. Try again in 1 hour.' },
  },
})

const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    data: null,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many token refresh attempts. Try again in 15 minutes.' },
  },
})

const verifyEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    data: null,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many email verification attempts. Try again in 1 hour.' },
  },
})

const resendVerifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    data: null,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many resend requests. Try again in 1 hour.' },
  },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter'
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number'
  return null
}

function issueAccessToken(userId: number): string {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_EXPIRY })
}

const IS_PROD = process.env.NODE_ENV === 'production'

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const base = { httpOnly: true, path: '/', sameSite: IS_PROD ? ('none' as const) : ('lax' as const), secure: IS_PROD }
  res.cookie('access_token', accessToken, { ...base, maxAge: 15 * 60 * 1000 })
  res.cookie('refresh_token', refreshToken, { ...base, maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000 })
}

function clearAuthCookies(res: Response): void {
  const base = { httpOnly: true, path: '/', sameSite: IS_PROD ? ('none' as const) : ('lax' as const), secure: IS_PROD }
  res.clearCookie('access_token', base)
  res.clearCookie('refresh_token', base)
}

async function issueRefreshToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(40).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS)
  await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } })
  return token
}

async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'https://futurely.app'
  const link = `${appUrl}/verify-email?token=${token}`
  await sendEmail({
    to: email,
    subject: 'Verify your Futurely email',
    html: `
      <p>Welcome to Futurely!</p>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${link}">Verify Email</a></p>
      <p>This link expires in ${VERIFY_TOKEN_EXPIRY_HOURS} hours.</p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
    `,
  })
}

async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'https://futurely.app'
  const link = `${appUrl}/reset-password?token=${token}`
  await sendEmail({
    to: email,
    subject: 'Reset your Futurely password',
    html: `
      <p>You requested a password reset for your Futurely account.</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${link}">Reset Password</a></p>
      <p>This link expires in ${RESET_TOKEN_EXPIRY_MINUTES} minutes.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  })
}

// ── POST /auth/register ───────────────────────────────────────────────────────

router.post('/register', registerLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email, password, name, role: roleInput } = req.body as {
    email?: string; password?: string; name?: string; role?: string
  }

  if (!email || !password) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'email and password required' },
    })
    return
  }

  const passError = validatePassword(password)
  if (passError) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: passError },
    })
    return
  }

  const displayName = name ?? email.split('@')[0]
  const nameCheck = filterUsername(displayName)
  if (!nameCheck.ok) {
    res.status(400).json({
      data: null,
      error: { code: 'INAPPROPRIATE_NAME', message: nameCheck.reason },
    })
    return
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({
        data: null,
        error: { code: 'CONFLICT', message: 'An account with this email already exists' },
      })
      return
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const userRole = roleInput === 'PARENT' ? 'PARENT' : 'STUDENT'
    const defaultTag = userRole === 'PARENT' ? 'Parent' : 'Student'

    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpiry = new Date()
    verificationExpiry.setHours(verificationExpiry.getHours() + VERIFY_TOKEN_EXPIRY_HOURS)

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: displayName,
        role: userRole,
        tag: defaultTag,
        tagColor: 'grey',
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: verificationExpiry,
      },
    })

    // Fire-and-forget — don't fail registration if email fails
    void sendVerificationEmail(email, verificationToken).catch((err) =>
      console.error('Failed to send verification email:', err),
    )

    const token = issueAccessToken(user.id)
    const refreshToken = await issueRefreshToken(user.id)
    setAuthCookies(res, token, refreshToken)

    logger.info('auth.registered', { userId: user.id })

    res.status(201).json({
      data: {
        token,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: false },
      },
    })
  } catch (e) {
    logger.error('auth.error', { event: 'register', error: e instanceof Error ? e.message : String(e) })
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  }
})

// ── POST /auth/login ──────────────────────────────────────────────────────────

router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'email and password required' },
    })
    return
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    // Always run bcrypt regardless of whether user exists — prevents timing-based
    // user enumeration (attacker can't tell if email is registered from response time)
    const passwordValid = user
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, DUMMY_HASH).then(() => false)

    if (!user) {
      res.status(401).json({
        data: null,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      })
      return
    }

    if (user.deletedAt) {
      res.status(401).json({
        data: null,
        error: { code: 'ACCOUNT_DELETED', message: 'This account has been deleted' },
      })
      return
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      logger.warn('auth.login_rejected_locked', { userId: user.id, ip: req.ip })
      const secondsRemaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000)
      res.status(429).json({
        data: null,
        error: { code: 'ACCOUNT_LOCKED', message: 'Account temporarily locked due to too many failed login attempts' },
        secondsRemaining,
      })
      return
    }

    if (!passwordValid) {
      const newAttempts = (user.failedLoginAttempts ?? 0) + 1
      const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts,
          ...(shouldLock ? { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) } : {}),
        },
      })

      if (shouldLock) {
        logger.warn('auth.account_locked', { userId: user.id, ip: req.ip })
        res.status(429).json({
          data: null,
          error: { code: 'ACCOUNT_LOCKED', message: 'Too many failed login attempts. Account locked for 2 hours.' },
          secondsRemaining: LOCKOUT_DURATION_MS / 1000,
        })
        return
      }

      logger.warn('auth.login_failed', { userId: user.id, ip: req.ip, attempts: newAttempts })
      const attemptsLeft = MAX_FAILED_ATTEMPTS - newAttempts
      res.status(401).json({
        data: null,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: `Invalid email or password. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining before lockout.`,
        },
      })
      return
    }

    // Reset failed attempts on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    })

    const token = issueAccessToken(user.id)
    const refreshToken = await issueRefreshToken(user.id)
    setAuthCookies(res, token, refreshToken)

    logger.info('auth.login_success', { userId: user.id })

    res.json({
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
        },
      },
    })
  } catch (e) {
    logger.error('auth.error', { event: 'login', error: e instanceof Error ? e.message : String(e) })
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  }
})

// ── POST /auth/refresh ────────────────────────────────────────────────────────

router.post('/refresh', refreshTokenLimiter, async (req: Request, res: Response): Promise<void> => {
  // Accept refresh token from body (mobile) or httpOnly cookie (web)
  const refreshToken = (req.body as { refreshToken?: string }).refreshToken
    ?? (req as Request & { cookies?: Record<string, string> }).cookies?.refresh_token

  if (!refreshToken) {
    res.status(401).json({
      data: null,
      error: { code: 'INVALID_TOKEN', message: 'No refresh token provided' },
    })
    return
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } })

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      logger.warn('auth.invalid_refresh_token', { ip: req.ip })
      clearAuthCookies(res)
      res.status(401).json({
        data: null,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' },
      })
      return
    }

    // Rotate: revoke old, issue fresh pair
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    })

    const newAccessToken = issueAccessToken(stored.userId)
    const newRefreshToken = await issueRefreshToken(stored.userId)
    setAuthCookies(res, newAccessToken, newRefreshToken)

    logger.info('auth.token_refreshed', { userId: stored.userId })

    res.json({
      data: { token: newAccessToken, refreshToken: newRefreshToken },
    })
  } catch (e) {
    logger.error('auth.error', { event: 'refresh', error: e instanceof Error ? e.message : String(e) })
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  }
})

// ── POST /auth/logout ─────────────────────────────────────────────────────────

router.post('/logout', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken?: string }

  if (refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    await prisma.refreshToken
      .updateMany({
        where: { tokenHash, userId: req.userId },
        data: { revokedAt: new Date() },
      })
      .catch(() => { /* token not found — fine */ })
  }

  clearAuthCookies(res)
  logger.info('auth.logout', { userId: req.userId })
  res.json({ data: { ok: true } })
})

// ── POST /auth/forgot-password ────────────────────────────────────────────────

router.post('/forgot-password', passwordResetLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string }

  if (!email) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'email required' },
    })
    return
  }

  // Respond 200 immediately — prevents email enumeration
  res.json({ data: { message: 'If an account exists for that email, a reset link has been sent.' } })

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.deletedAt) return

    // Invalidate any existing unused tokens
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    })

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + RESET_TOKEN_EXPIRY_MINUTES)

    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } })
    logger.info('auth.password_reset_requested', { userId: user.id })

    void sendPasswordResetEmail(email, rawToken).catch((err) =>
      console.error('Failed to send password reset email:', err),
    )
  } catch (e) {
    logger.error('auth.error', { event: 'forgot_password', error: e instanceof Error ? e.message : String(e) })
  }
})

// ── POST /auth/reset-password ─────────────────────────────────────────────────

router.post('/reset-password', passwordResetLimiter, async (req: Request, res: Response): Promise<void> => {
  const { token, password } = req.body as { token?: string; password?: string }

  if (!token || !password) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'token and password required' },
    })
    return
  }

  const passError = validatePassword(password)
  if (passError) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: passError },
    })
    return
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    // Atomically claim the token — prevents TOCTOU race where two concurrent requests
    // both pass the usedAt check before either marks it consumed
    const claimed = await prisma.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    })

    if (claimed.count === 0) {
      res.status(400).json({
        data: null,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired reset token' },
      })
      return
    }

    const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })
    if (!resetToken) {
      res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
      return
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      }),
      // Force re-login on all devices after password reset
      prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ])

    clearAuthCookies(res)
    logger.info('auth.password_reset_success', { userId: resetToken.userId })
    res.json({ data: { message: 'Password reset successful. Please log in again.' } })
  } catch (e) {
    logger.error('auth.error', { event: 'reset_password', error: e instanceof Error ? e.message : String(e) })
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  }
})

// ── POST /auth/verify-email ───────────────────────────────────────────────────

router.post('/verify-email', verifyEmailLimiter, async (req: Request, res: Response): Promise<void> => {
  const { token } = req.body as { token?: string }

  if (!token) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'token required' },
    })
    return
  }

  try {
    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: token, emailVerified: false },
    })

    if (!user) {
      res.status(400).json({
        data: null,
        error: { code: 'INVALID_TOKEN', message: 'Invalid verification token' },
      })
      return
    }

    if (user.emailVerificationExpiry && user.emailVerificationExpiry < new Date()) {
      res.status(400).json({
        data: null,
        error: { code: 'TOKEN_EXPIRED', message: 'Verification token expired. Request a new one.' },
      })
      return
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    })

    logger.info('auth.email_verified', { userId: user.id })
    res.json({ data: { message: 'Email verified successfully' } })
  } catch (e) {
    logger.error('auth.error', { event: 'verify_email', error: e instanceof Error ? e.message : String(e) })
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  }
})

// ── POST /auth/resend-verification ────────────────────────────────────────────

router.post('/resend-verification', resendVerifyLimiter, requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } })

    if (!user) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'User not found' } })
      return
    }
    if (user.emailVerified) {
      res.status(400).json({ data: null, error: { code: 'ALREADY_VERIFIED', message: 'Email already verified' } })
      return
    }

    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpiry = new Date()
    verificationExpiry.setHours(verificationExpiry.getHours() + VERIFY_TOKEN_EXPIRY_HOURS)

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken: verificationToken, emailVerificationExpiry: verificationExpiry },
    })

    void sendVerificationEmail(user.email, verificationToken).catch((err) =>
      console.error('Failed to send verification email:', err),
    )

    res.json({ data: { message: 'Verification email sent' } })
  } catch (e) {
    logger.error('auth.error', { event: 'resend_verification', error: e instanceof Error ? e.message : String(e) })
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  }
})

// ── GET /auth/me ──────────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, role: true, emailVerified: true, createdAt: true },
    })
    if (!user) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      })
      return
    }
    res.json({ data: user })
  } catch (e) {
    logger.error('auth.error', { event: 'me', error: e instanceof Error ? e.message : String(e) })
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  }
})

// ── DELETE /auth/account ──────────────────────────────────────────────────────

router.delete('/account', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!
  const { password } = req.body as { password?: string }

  if (!password) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Password required' } })
    return
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'User not found' } })
      return
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      res.status(401).json({ data: null, error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect password' } })
      return
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } }),
      prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ])

    logger.info('auth.account_deleted', { userId })
    res.json({ data: { deleted: true } })
  } catch (e) {
    logger.error('auth.error', { event: 'delete_account', error: e instanceof Error ? e.message : String(e) })
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  }
})

export default router
