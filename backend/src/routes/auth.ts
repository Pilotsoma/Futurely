import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import { prisma } from '../lib/prisma'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { filterUsername } from '../lib/contentFilter'
import { sendEmail } from '../lib/email'

const router = Router()

// ── Constants ────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12
const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY_DAYS = 7
const RESET_TOKEN_EXPIRY_MINUTES = 30
const VERIFY_TOKEN_EXPIRY_HOURS = 24

// ── Rate limiters ─────────────────────────────────────────────────────────────

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    data: null,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Try again in 15 minutes.' },
  },
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter'
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number'
  return null
}

function issueAccessToken(userId: number): string {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_EXPIRY })
}

async function issueRefreshToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(40).toString('hex')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS)
  await prisma.refreshToken.create({ data: { userId, token, expiresAt } })
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

    res.status(201).json({
      data: {
        token,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: false },
      },
    })
  } catch (e) {
    console.error('REGISTER ERROR:', e)
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

    // Always run bcrypt to prevent timing-based user enumeration.
    // The dummy hash is a valid bcrypt hash that will never match any real password.
    const DUMMY_HASH = '$2a$12$RhIbHdMHqDGwkVDSMsqmNOE7I1NLSq9k3n7N4wWfpjBYUdpFCt/0G'
    const passwordValid = user
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, DUMMY_HASH).then(() => false)

    if (!user || !passwordValid) {
      res.status(401).json({
        data: null,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
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

    const token = issueAccessToken(user.id)
    const refreshToken = await issueRefreshToken(user.id)

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
    console.error('LOGIN ERROR:', e)
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  }
})

// ── POST /auth/refresh ────────────────────────────────────────────────────────

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken?: string }

  if (!refreshToken) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'refreshToken required' },
    })
    return
  }

  try {
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } })

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      res.status(401).json({
        data: null,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' },
      })
      return
    }

    // Rotate: revoke old token and issue a fresh pair
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    })

    const newAccessToken = issueAccessToken(stored.userId)
    const newRefreshToken = await issueRefreshToken(stored.userId)

    res.json({
      data: { token: newAccessToken, refreshToken: newRefreshToken },
    })
  } catch (e) {
    console.error('REFRESH ERROR:', e)
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
    await prisma.refreshToken
      .updateMany({
        where: { token: refreshToken, userId: req.userId },
        data: { revokedAt: new Date() },
      })
      .catch(() => { /* token not found — fine */ })
  }

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

  // Always respond 200 immediately to prevent email enumeration
  res.json({ data: { message: 'If an account exists for that email, a reset link has been sent.' } })

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.deletedAt) return

    // Invalidate any existing unused tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    })

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + RESET_TOKEN_EXPIRY_MINUTES)

    await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } })

    void sendPasswordResetEmail(email, token).catch((err) =>
      console.error('Failed to send password reset email:', err),
    )
  } catch (e) {
    console.error('FORGOT PASSWORD ERROR:', e)
  }
})

// ── POST /auth/reset-password ─────────────────────────────────────────────────

router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
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
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } })

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      res.status(400).json({
        data: null,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired reset token' },
      })
      return
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      // Revoke all active refresh tokens — forces re-login after password reset
      prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ])

    res.json({ data: { message: 'Password reset successful. Please log in again.' } })
  } catch (e) {
    console.error('RESET PASSWORD ERROR:', e)
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  }
})

// ── POST /auth/verify-email ───────────────────────────────────────────────────

router.post('/verify-email', async (req: Request, res: Response): Promise<void> => {
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

    res.json({ data: { message: 'Email verified successfully' } })
  } catch (e) {
    console.error('VERIFY EMAIL ERROR:', e)
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  }
})

// ── POST /auth/resend-verification ────────────────────────────────────────────

router.post('/resend-verification', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
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
    console.error('RESEND VERIFICATION ERROR:', e)
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
    console.error('ME ERROR:', e)
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

    res.json({ data: { deleted: true } })
  } catch (e) {
    console.error('DELETE ACCOUNT ERROR:', e)
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  }
})

export default router
