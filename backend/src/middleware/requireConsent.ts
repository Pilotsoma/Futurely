import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from './auth'
import { logger } from '../common/logger'

/**
 * Enforces that the authenticated user has accepted ToS, Privacy Policy, and
 * confirmed their age before accessing any protected resource.
 *
 * Must be chained AFTER requireAuth so that req.userId is guaranteed to be set.
 *
 * Routes exempt from this guard (must remain reachable regardless of consent):
 *   POST /auth/consent     — the endpoint that records acceptance
 *   GET  /auth/me          — needed by the frontend to seed user state after OAuth
 *   POST /auth/logout      — users must always be able to log out
 *   POST /auth/refresh     — session refresh must never be blocked
 *   DELETE /auth/account   — users must always be able to delete their account
 *
 * Those routes are mounted inside auth.ts which is NOT wrapped with this
 * middleware in app.ts, so they remain exempt automatically.
 */
export async function requireConsent(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.userId

  // Fail closed: requireAuth should have blocked this earlier, but guard anyway.
  if (userId === undefined) {
    res.status(401).json({
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    })
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tosAcceptedAt: true, privacyAcceptedAt: true, ageConfirmedAt: true },
    })

    if (
      !user ||
      user.tosAcceptedAt === null ||
      user.privacyAcceptedAt === null ||
      user.ageConfirmedAt === null
    ) {
      res.status(403).json({
        data: null,
        error: {
          code: 'CONSENT_REQUIRED',
          message:
            'You must accept the Terms of Service, Privacy Policy, and confirm your age to continue.',
        },
      })
      return
    }

    next()
  } catch (e) {
    logger.error('middleware.requireConsent.error', {
      userId,
      error: e instanceof Error ? e.message : String(e),
    })
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  }
}
