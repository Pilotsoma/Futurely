import { prisma } from './prisma'
import { logger } from '../common/logger'

const UNDER_13_AGE_YEARS = 13

function isUnder13(dateOfBirth: Date): boolean {
  const today = new Date()
  const age13Cutoff = new Date(
    today.getFullYear() - UNDER_13_AGE_YEARS,
    today.getMonth(),
    today.getDate()
  )
  return dateOfBirth > age13Cutoff
}

export interface CoppaGateResult {
  blocked: boolean
  message?: string
}

/**
 * Checks whether a user is under 13 and, if so, whether they have verified
 * parental consent. Returns `{ blocked: true, message }` when the request
 * must be rejected, or `{ blocked: false }` when it may proceed.
 *
 * Callers are responsible for sending the 403 response when blocked === true.
 */
export async function checkCoppaGate(userId: number): Promise<CoppaGateResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { dateOfBirth: true, coppaConsentStatus: true },
    })

    if (user?.dateOfBirth && isUnder13(user.dateOfBirth)) {
      if (user.coppaConsentStatus !== 'verified') {
        return {
          blocked: true,
          message:
            'Parental consent is required before using this feature for users under 13. ' +
            'Please complete the consent verification process.',
        }
      }
    }

    return { blocked: false }
  } catch (err: unknown) {
    logger.error('coppa_gate_check_failed', {
      error: err instanceof Error ? err.message : String(err),
      userId,
    })
    // Fail closed: if we cannot verify COPPA status, block the request.
    return {
      blocked: true,
      message: 'Unable to verify account eligibility. Please try again shortly.',
    }
  }
}
