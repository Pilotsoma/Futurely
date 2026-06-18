import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'

export interface AuthRequest extends Request {
  userId?: number
}

// Defined independently — JwtPayload types sub as string, but we sign with a numeric userId
interface AccessTokenPayload {
  sub: number
  iat: number
  exp: number
}

function touchLastSeen(userId: number) {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
  prisma.user.updateMany({
    where: { id: userId, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: fiveMinAgo } }] },
    data: { lastSeenAt: new Date() },
  }).catch(() => {})
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  // Dev bypass already injected userId — skip JWT verification
  if (req.userId !== undefined) {
    touchLastSeen(req.userId)
    next()
    return
  }

  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'Missing token' },
    })
    return
  }
  try {
    const secret = process.env.JWT_SECRET ?? 'nextstep-dev-secret-change-in-production'
    const payload = jwt.verify(header.slice(7), secret) as unknown as AccessTokenPayload
    req.userId = payload.sub
    touchLastSeen(payload.sub)
    next()
  } catch {
    res.status(401).json({
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
    })
  }
}
