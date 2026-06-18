import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from './auth'

export async function hasDevPowers(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, tag: true, allTags: true },
  })
  if (!user) return false
  if (user.role === 'ADMIN' || user.role === 'DEV' || user.tag === 'DEV') return true
  const tags = (user.allTags as Array<{ tag: string }> | null) ?? []
  return Array.isArray(tags) && tags.some(t => t.tag === 'DEV')
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
