import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { filterUsername } from '../lib/contentFilter'

const router = Router()

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
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
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
