import { Response, NextFunction } from 'express'
import { AccountStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { liftExpiredBanIfNeeded } from '../lib/dobVerification'
import { AuthRequest } from './auth'
import { logger } from '../common/logger'

/**
 * Paths that bypass the ACTIVE-only account status check even when a user's
 * account is DOB_MISMATCH_LOCKED or UNDER_13_BANNED.
 *
 * These are matched against req.path as Express strips the mount prefix, so
 * a request to POST /integrations/grades/hac/login arrives here with
 * req.path === '/hac/login' when requireActiveAccount is mounted via
 * app.use('/integrations/grades', ..., requireActiveAccount, gradesRouter).
 *
 * WHY THIS EXISTS — the deadlock: requireActiveAccount is applied ahead of
 * the grades and classlink integration routers, which means a locked account
 * cannot call POST /hac/login, POST /powerschool/login, or POST /connect to
 * link their school portal. But for OAuth-created accounts that landed in
 * DOB_MISMATCH_LOCKED without ever completing school-portal setup, connecting
 * the portal is the ONLY way to obtain a hacDateOfBirth value to compare
 * against for DOB verification — there is no other path out of the lock.
 * Blocking those endpoints for locked accounts creates an unresolvable loop.
 *
 * Only the specific connect/login routes are exempted. All data-reading
 * endpoints (transcript, gpa, schedule, classwork, etc.) remain fully blocked
 * for locked/banned accounts; the intent is "you may connect your school
 * portal to attempt to resolve your lock, but you may not use the rest of the
 * app." Do not expand this list without an explicit architecture review.
 *
 * baseUrl is included (not just path) so this stays scoped to the exact
 * router each entry belongs to — matching on path alone would silently
 * exempt any future unrelated `POST /connect` route added to some other
 * router this middleware also guards (e.g. a hypothetical Canvas "connect"
 * endpoint), which would be a real access-control regression for locked or
 * banned accounts, not just a naming accident.
 */
const SCHOOL_CONNECT_ALLOWLIST: ReadonlyArray<{ method: string; baseUrl: string; path: string }> = [
  { method: 'POST', baseUrl: '/integrations/grades', path: '/hac/login' },
  { method: 'POST', baseUrl: '/integrations/grades', path: '/powerschool/login' },
  { method: 'POST', baseUrl: '/integrations/classlink', path: '/connect' },
]

/**
 * Enforces that the authenticated user's accountStatus is ACTIVE before
 * accessing any protected data route.
 *
 * Must be chained AFTER requireAuth (needs req.userId) — chain it AFTER
 * requireConsent too, since a DOB-locked/banned account should never even
 * reach the consent check's success path in a way that implies it's usable.
 *
 * accountStatus is always read live from the DB rather than trusted from the
 * JWT — an account can be locked or auto-unbanned mid-session, well within
 * the 15-minute access token lifetime, and a stale claim must never grant
 * (or wrongly deny) access.
 *
 * Statuses:
 *   ACTIVE               -> pass through
 *   DOB_MISMATCH_LOCKED  -> 403 DOB_VERIFICATION_REQUIRED; the frontend should
 *                           route the user to correct their DOB via PATCH /auth/dob
 *   UNDER_13_BANNED      -> 403 ACCOUNT_BANNED, unless bannedUntilDate has
 *                           passed, in which case the account transitions to
 *                           DOB_MISMATCH_LOCKED here (the COPPA ban is lifted,
 *                           but the self-reported DOB that triggered it was
 *                           still false — they still owe a correction via
 *                           PATCH /auth/dob) and this request is denied with
 *                           DOB_VERIFICATION_REQUIRED, same as any other
 *                           DOB_MISMATCH_LOCKED account
 *
 * Routes exempt from this guard (must remain reachable regardless of status):
 *   GET   /auth/me             — needed to read accountStatus in the first place
 *   GET   /auth/account-status — lightweight status poll
 *   PATCH /auth/dob            — the DOB correction endpoint
 *   POST  /auth/logout, /auth/refresh, DELETE /auth/account — same rationale
 *   as requireConsent's exemptions
 * Those routes are mounted outside this middleware in app.ts, so they remain
 * exempt automatically.
 *
 * Additionally, the paths in SCHOOL_CONNECT_ALLOWLIST bypass this check so
 * a locked account can connect a school portal. See that constant for details.
 */
export async function requireActiveAccount(
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

  // Allow school-portal connect/login endpoints regardless of account status
  // so a locked account can reach the school portal to resolve the lock.
  // req.baseUrl is the mount path (e.g. '/integrations/grades'), req.path is
  // relative to it (e.g. '/hac/login') — both must match so this stays scoped
  // to the exact router each allowlist entry belongs to. See SCHOOL_CONNECT_ALLOWLIST.
  const isAllowlisted = SCHOOL_CONNECT_ALLOWLIST.some(
    (entry) => req.method === entry.method && req.baseUrl === entry.baseUrl && req.path === entry.path,
  )
  if (isAllowlisted) {
    next()
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { accountStatus: true, bannedUntilDate: true },
    })

    if (!user) {
      res.status(401).json({
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      })
      return
    }

    if (user.accountStatus === AccountStatus.ACTIVE) {
      next()
      return
    }

    if (user.accountStatus === AccountStatus.UNDER_13_BANNED) {
      const lifted = await liftExpiredBanIfNeeded(userId, user.accountStatus, user.bannedUntilDate, req.ip ?? 'unknown')
      if (lifted.accountStatus === AccountStatus.DOB_MISMATCH_LOCKED) {
        // Ban period had elapsed. The COPPA ban is lifted, but the
        // self-reported DOB that caused it is still wrong, so this request is
        // still denied — same as any other locked account — until the
        // student corrects their DOB via PATCH /auth/dob.
        res.status(403).json({
          data: null,
          error: {
            code: 'DOB_VERIFICATION_REQUIRED',
            message: 'We could not verify your date of birth against your school record. Please confirm your date of birth to continue.',
          },
        })
        return
      }

      res.status(403).json({
        data: null,
        error: {
          code: 'ACCOUNT_BANNED',
          message: 'This account is temporarily restricted until the account holder turns 13.',
        },
        bannedUntilDate: user.bannedUntilDate,
      })
      return
    }

    // DOB_MISMATCH_LOCKED
    res.status(403).json({
      data: null,
      error: {
        code: 'DOB_VERIFICATION_REQUIRED',
        message: 'We could not verify your date of birth against your school record. Please confirm your date of birth to continue.',
      },
    })
  } catch (e) {
    logger.error('middleware.requireActiveAccount.error', {
      userId,
      error: e instanceof Error ? e.message : String(e),
    })
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  }
}
