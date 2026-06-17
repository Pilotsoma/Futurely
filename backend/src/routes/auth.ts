import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { filterUsername } from '../lib/contentFilter'
import { sendToUser } from '../lib/websocket'

const router = Router()

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 2 * 60 * 60 * 1000 // 2 hours

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, password, name, role: roleInput } = req.body as { email?: string; password?: string; name?: string; role?: string }

  if (!email || !password) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'email and password required' },
    })
    return
  }

  if (password.length < 6) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 6 characters' },
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

    const passwordHash = await bcrypt.hash(password, 10)
    const userRole = roleInput === 'PARENT' ? 'PARENT' : 'STUDENT'
    const defaultTag = userRole === 'PARENT' ? 'Parent' : 'Student'
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: displayName,
        role: userRole,
        tag: defaultTag,
        tagColor: 'grey',
      },
    })

    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })

    res.status(201).json({
      data: {
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
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

router.post('/login', async (req: Request, res: Response): Promise<void> => {
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
      const secondsRemaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000)
      res.status(429).json({
        data: null,
        error: { code: 'ACCOUNT_LOCKED', message: 'Account temporarily locked due to too many failed login attempts' },
        secondsRemaining,
      })
      return
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash)

    if (!passwordValid) {
      const newAttempts = user.failedLoginAttempts + 1
      const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts,
          ...(shouldLock ? { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) } : {}),
        },
      })

      if (shouldLock) {
        res.status(429).json({
          data: null,
          error: { code: 'ACCOUNT_LOCKED', message: 'Too many failed login attempts. Account locked for 2 hours.' },
          secondsRemaining: LOCKOUT_DURATION_MS / 1000,
        })
        return
      }

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

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    })

    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })

    res.json({
      data: {
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
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

router.post('/logout', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  sendToUser(req.userId!, 'FORCE_LOGOUT', {})
  res.json({ data: { ok: true } })
})

router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
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
    console.error('LOGIN ERROR:', e)
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  }
})

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

    await prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } })

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
