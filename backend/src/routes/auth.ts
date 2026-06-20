import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { promises as dnsPromises } from 'dns'
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

// Returns false only when DNS conclusively confirms the domain has no mail handler.
// Fails open on timeouts/SERVFAIL so transient DNS issues don't block real users.
async function hasValidMailDomain(email: string): Promise<boolean> {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain || !domain.includes('.')) return false
  try {
    const records = await dnsPromises.resolveMx(domain)
    return records.length > 0
  } catch (err: unknown) {
    const code = (err as { code?: string }).code
    if (code === 'ENOTFOUND' || code === 'ENODATA') return false
    return true // SERVFAIL, ETIMEOUT, etc. → fail open
  }
}

async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'https://futurely.app'
  const link = `${appUrl}/reset-password?token=${token}`
  await sendEmail({
    to: email,
    subject: 'Reset your Futurely password',
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F4FF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4FF;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:18px;border:1px solid #C0CCE8;box-shadow:0 8px 40px rgba(26,21,14,0.08);overflow:hidden;">
        <tr>
          <td style="padding:36px 40px 28px;text-align:center;border-bottom:1px solid #C0CCE8;">
            <span style="font-size:28px;font-weight:700;color:#050B18;letter-spacing:-0.5px;">Futurely</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px 28px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#050B18;">Reset your password</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#3D4F72;line-height:1.6;">
              We received a request to reset your Futurely password. Click the button below — this link expires in <strong>${RESET_TOKEN_EXPIRY_MINUTES} minutes</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${link}" style="display:inline-block;background:#2979FF;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:10px;letter-spacing:0.1px;">
                    Reset my password
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:28px 0 0;font-size:13px;color:#7B8DB0;line-height:1.6;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${link}" style="color:#2979FF;word-break:break-all;">${link}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #C0CCE8;text-align:center;">
            <p style="margin:0;font-size:12px;color:#7B8DB0;line-height:1.5;">
              If you didn't request a password reset, you can safely ignore this email.<br>
              Your password won't change.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}

// ── POST /auth/register ───────────────────────────────────────────────────────

router.post('/register', registerLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email, password, name, role: roleInput, otp } = req.body as {
    email?: string; password?: string; name?: string; role?: string; otp?: string
  }

  if (!email || !password) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'email and password required' },
    })
    return
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Please enter a valid email address.' },
    })
    return
  }

  const domainValid = await hasValidMailDomain(email)
  if (!domainValid) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'That email domain doesn\'t appear to be valid. Please check for typos.' },
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

  // Display name is optional — only validate if provided
  const displayName = name?.trim() || null
  if (displayName) {
    const nameCheck = filterUsername(displayName)
    if (!nameCheck.ok) {
      res.status(400).json({
        data: null,
        error: { code: 'INAPPROPRIATE_NAME', message: nameCheck.reason },
      })
      return
    }
  }

  try {
    const [emailTaken, nameTaken] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      displayName ? prisma.user.findFirst({ where: { name: displayName } }) : Promise.resolve(null),
    ])
    if (emailTaken) {
      res.status(409).json({
        data: null,
        error: { code: 'CONFLICT', message: 'An account with this email already exists' },
      })
      return
    }
    if (nameTaken) {
      res.status(409).json({
        data: null,
        error: { code: 'NAME_TAKEN', message: 'That display name is already taken. Please choose another.' },
      })
      return
    }

    // Verify OTP
    if (!otp) {
      res.status(400).json({ data: null, error: { code: 'OTP_REQUIRED', message: 'Verification code required.' } })
      return
    }
    const codeHash = crypto.createHash('sha256').update(otp.trim()).digest('hex')
    const otpRecord = await prisma.emailOTP.findFirst({
      where: { email, codeHash, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!otpRecord) {
      res.status(400).json({ data: null, error: { code: 'INVALID_OTP', message: 'Invalid or expired verification code.' } })
      return
    }
    await prisma.emailOTP.update({ where: { id: otpRecord.id }, data: { usedAt: new Date() } })

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
        emailVerified: true,
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

  // Basic format check before DNS lookup
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Please enter a valid email address.' },
    })
    return
  }

  // MX-record check: reject domains that provably cannot receive email.
  // This catches typos like @gmal.com or @fakdomain — not whether an account exists.
  const domainValid = await hasValidMailDomain(email)
  if (!domainValid) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'That email domain doesn\'t appear to be valid. Please check for typos.' },
    })
    return
  }

  // Do all work before responding — on Vercel serverless the function can be
  // killed immediately after res.json(), so fire-and-forget after the response
  // is unreliable. Always return the same generic message to prevent enumeration.
  try {
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user || user.deletedAt) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'No account found with that email address.' } })
      return
    }

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

    await sendPasswordResetEmail(email, rawToken)
  } catch (e) {
    logger.error('auth.error', { event: 'forgot_password', error: e instanceof Error ? e.message : String(e) })
    res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } })
    return
  }

  res.json({ data: { message: 'Reset link sent.' } })
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

// ── OAuth helpers ────────────────────────────────────────────────────────────

const OTP_EXPIRY_MINUTES = 10

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many OTP requests. Try again in 1 hour.' } },
})

async function finishOAuth(res: Response, provider: string, providerId: string, email: string, name?: string): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'https://myfuturely.ai'

  let existing = await prisma.oAuthAccount.findUnique({ where: { provider_providerId: { provider, providerId } } })
  let userId: number
  let isNew = false

  if (existing) {
    userId = existing.userId
  } else {
    // Check if a user with this email already exists — link accounts
    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({
        data: { email, passwordHash: null, name: name ?? null, emailVerified: true },
      })
      isNew = true
    }
    await prisma.oAuthAccount.create({ data: { userId: user.id, provider, providerId, email } })
    userId = user.id
  }

  const accessToken = issueAccessToken(userId)
  const refreshToken = await issueRefreshToken(userId)
  setAuthCookies(res, accessToken, refreshToken)
  res.redirect(`${appUrl}/?oauth=success${isNew ? '&new=1' : ''}`)
}

// ── GET /auth/oauth/google ───────────────────────────────────────────────────
router.get('/oauth/google', (_req: Request, res: Response): void => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) { res.status(500).json({ error: 'Google OAuth not configured' }); return }
  const redirect = encodeURIComponent(`${process.env.APP_URL ?? 'https://myfuturely.ai'}/api/auth/oauth/google/callback`)
  const state = jwt.sign({ ts: Date.now() }, process.env.JWT_SECRET!, { expiresIn: '10m' })
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirect}&response_type=code&scope=openid%20email%20profile&state=${state}`
  res.redirect(url)
})

router.get('/oauth/google/callback', async (req: Request, res: Response): Promise<void> => {
  const appUrl = process.env.APP_URL ?? 'https://myfuturely.ai'
  try {
    const { code, state } = req.query as { code?: string; state?: string }
    if (!code || !state) { res.redirect(`${appUrl}/login?error=oauth_cancelled`); return }
    jwt.verify(state, process.env.JWT_SECRET!)

    const redirect = encodeURIComponent(`${appUrl}/api/auth/oauth/google/callback`)
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: decodeURIComponent(redirect), grant_type: 'authorization_code',
      }),
    })
    const tokens = await tokenRes.json() as { access_token?: string; id_token?: string }
    if (!tokens.access_token) { res.redirect(`${appUrl}/login?error=oauth_failed`); return }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const info = await userRes.json() as { sub?: string; email?: string; name?: string }
    if (!info.sub || !info.email) { res.redirect(`${appUrl}/login?error=oauth_failed`); return }

    await finishOAuth(res, 'google', info.sub, info.email, info.name)
  } catch (e) {
    logger.error('auth.error', { event: 'oauth_google_callback', error: e instanceof Error ? e.message : String(e) })
    res.redirect(`${appUrl}/login?error=oauth_failed`)
  }
})

// ── GET /auth/oauth/microsoft ────────────────────────────────────────────────
router.get('/oauth/microsoft', (_req: Request, res: Response): void => {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  if (!clientId) { res.status(500).json({ error: 'Microsoft OAuth not configured' }); return }
  const redirect = encodeURIComponent(`${process.env.APP_URL ?? 'https://myfuturely.ai'}/api/auth/oauth/microsoft/callback`)
  const state = jwt.sign({ ts: Date.now() }, process.env.JWT_SECRET!, { expiresIn: '10m' })
  const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&redirect_uri=${redirect}&response_type=code&scope=openid%20email%20profile&state=${state}`
  res.redirect(url)
})

router.get('/oauth/microsoft/callback', async (req: Request, res: Response): Promise<void> => {
  const appUrl = process.env.APP_URL ?? 'https://myfuturely.ai'
  try {
    const { code, state } = req.query as { code?: string; state?: string }
    if (!code || !state) { res.redirect(`${appUrl}/login?error=oauth_cancelled`); return }
    jwt.verify(state, process.env.JWT_SECRET!)

    const redirect = encodeURIComponent(`${appUrl}/api/auth/oauth/microsoft/callback`)
    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: process.env.MICROSOFT_CLIENT_ID!, client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        redirect_uri: decodeURIComponent(redirect), grant_type: 'authorization_code',
      }),
    })
    const tokens = await tokenRes.json() as { access_token?: string }
    if (!tokens.access_token) { res.redirect(`${appUrl}/login?error=oauth_failed`); return }

    const userRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,mail,displayName,userPrincipalName', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const info = await userRes.json() as { id?: string; mail?: string; userPrincipalName?: string; displayName?: string }
    const email = info.mail ?? info.userPrincipalName
    if (!info.id || !email) { res.redirect(`${appUrl}/login?error=oauth_failed`); return }

    await finishOAuth(res, 'microsoft', info.id, email, info.displayName)
  } catch (e) {
    logger.error('auth.error', { event: 'oauth_microsoft_callback', error: e instanceof Error ? e.message : String(e) })
    res.redirect(`${appUrl}/login?error=oauth_failed`)
  }
})

// ── POST /auth/send-otp ──────────────────────────────────────────────────────
router.post('/send-otp', otpLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Valid email required.' } })
    return
  }

  const domainValid = await hasValidMailDomain(email)
  if (!domainValid) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'That email domain doesn\'t appear to be valid.' } })
    return
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    res.status(409).json({ data: null, error: { code: 'CONFLICT', message: 'An account with this email already exists.' } })
    return
  }

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const codeHash = crypto.createHash('sha256').update(code).digest('hex')
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

  await prisma.emailOTP.updateMany({ where: { email, usedAt: null }, data: { usedAt: new Date() } })
  await prisma.emailOTP.create({ data: { email, codeHash, expiresAt } })

  await sendEmail({
    to: email,
    subject: 'Your Futurely verification code',
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;background:#F0F4FF;">
        <div style="background:#fff;border-radius:16px;border:1px solid #C0CCE8;padding:36px 40px;text-align:center;">
          <div style="font-size:26px;font-weight:800;color:#050B18;margin-bottom:24px;">Futurely</div>
          <div style="font-size:16px;font-weight:600;color:#050B18;margin-bottom:8px;">Your verification code</div>
          <div style="font-size:42px;font-weight:800;letter-spacing:10px;color:#2979FF;margin:24px 0;">${code}</div>
          <div style="font-size:13px;color:#7B8DB0;">This code expires in ${OTP_EXPIRY_MINUTES} minutes.<br>If you didn't request this, ignore this email.</div>
        </div>
      </div>
    `,
  })

  res.json({ data: { sent: true } })
})

// ── GET /auth/test-email ─────────────────────────────────────────────────────
// Temporary diagnostic endpoint — remove once email delivery is confirmed.
router.get('/test-email', async (req: Request, res: Response): Promise<void> => {
  const to = (req.query.to as string) || 'srikar.vattem@gmail.com'

  const env = {
    RESEND_API_KEY: process.env.RESEND_API_KEY ? '✓ set' : '✗ missing',
    SMTP_HOST: process.env.SMTP_HOST ?? '✗ missing',
    SMTP_PASS: process.env.SMTP_PASS ? `✓ set (starts with ${(process.env.SMTP_PASS ?? '').slice(0, 6)}...)` : '✗ missing',
    SMTP_FROM: process.env.SMTP_FROM ?? '✗ missing',
    APP_URL: process.env.APP_URL ?? '✗ missing',
  }

  // DB diagnostic — find what's breaking login
  let dbResult: string
  try {
    const user = await prisma.user.findFirst({ select: { id: true, email: true, name: true, hacName: true, emailVerified: true, loginStreak: true, lastSeenAt: true, failedLoginAttempts: true, lockedUntil: true } })
    dbResult = user ? `✓ DB query OK (user id=${user.id})` : '✓ DB query OK (no users found)'
  } catch (e) {
    dbResult = `✗ DB error: ${e instanceof Error ? e.message : String(e)}`
  }

  try {
    await sendEmail({ to, subject: 'Futurely email test', html: '<p>If you see this, email delivery works!</p>' })
    res.json({ data: { status: 'sent', to, db: dbResult, env } })
  } catch (e) {
    res.status(500).json({ data: null, error: { message: e instanceof Error ? e.message : String(e) }, db: dbResult, env })
  }
})

export default router
