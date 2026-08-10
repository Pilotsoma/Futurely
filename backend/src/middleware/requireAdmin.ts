import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from './auth'

interface DevPowerFields {
  role: string
  tag: string | null
  allTags: unknown
}

// Pure predicate shared by hasDevPowers (single-user, request path) and any
// bulk query that needs to filter a list of already-fetched users (e.g. the
// autonomous job scheduler) without a DB round-trip per user.
export function isDevPowerUser(user: DevPowerFields): boolean {
  if (user.role === 'ADMIN' || user.role === 'DEV' || user.tag === 'DEV') return true
  const tags = (user.allTags as Array<{ tag: string }> | null) ?? []
  return Array.isArray(tags) && tags.some(t => t.tag === 'DEV')
}

export async function hasDevPowers(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, tag: true, allTags: true },
  })
  if (!user) return false
  return isDevPowerUser(user)
}

async function hasModOrDevPowers(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, tag: true, allTags: true },
  })
  if (!user) return false
  if (user.role === 'ADMIN' || user.role === 'DEV' || user.tag === 'DEV') return true
  const tags = (user.allTags as Array<{ tag: string }> | null) ?? []
  return Array.isArray(tags) && tags.some(t => t.tag === 'DEV' || t.tag === 'MOD')
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Missing authentication' } })
    return
  }
  const allowed = await hasDevPowers(req.userId)
  if (!allowed) {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin access required' } })
    return
  }
  next()
}

export async function requireMod(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Missing authentication' } })
    return
  }
  const allowed = await hasModOrDevPowers(req.userId)
  if (!allowed) {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Moderator access required' } })
    return
  }
  next()
}

export async function requireParent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Missing authentication' } })
    return
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } })
  if (!user || user.role !== 'PARENT') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Parent account required' } })
    return
  }
  next()
}

export async function requireTeacher(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Missing authentication' } })
    return
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } })
  if (!user || user.role !== 'TEACHER') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Teacher account required' } })
    return
  }
  next()
}

export async function requireCounselor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Missing authentication' } })
    return
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } })
  if (!user || user.role !== 'COUNSELOR') {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Counselor account required' } })
    return
  }
  next()
}

// Gate for agentic/autonomous AI features (tool-calling agent sessions,
// nightly autonomous check-ins) — these burn far more LLM budget per use than
// a normal chat turn. There is no premium tier yet; DEV/ADMIN access is the
// only path in until one exists. When a premium tier is added, extend this
// check (e.g. `|| user.premiumTier === 'ACTIVE'`) rather than replacing it,
// so DEV/ADMIN access is preserved.
export async function hasPremiumAiAccess(userId: number): Promise<boolean> {
  return hasDevPowers(userId)
}

export async function requirePremiumAiAccess(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Missing authentication' } })
    return
  }
  const allowed = await hasPremiumAiAccess(req.userId)
  if (!allowed) {
    res.status(403).json({
      data: null,
      error: { code: 'PREMIUM_REQUIRED', message: 'This AI feature is not available yet — it will be part of a future premium tier.' },
    })
    return
  }
  next()
}

export async function requireEducator(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Missing authentication' } })
    return
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } })
  if (!user || (user.role !== 'TEACHER' && user.role !== 'COUNSELOR')) {
    res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Educator account required' } })
    return
  }
  next()
}
