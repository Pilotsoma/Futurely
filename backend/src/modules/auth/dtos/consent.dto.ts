import { z } from 'zod'

const CONSENT_MESSAGE = 'agreedTos, agreedPrivacy, and agreedAge must all be true'

/**
 * DTO for POST /auth/consent.
 *
 * Validates consent acknowledgement fields only.
 * This DTO intentionally imports NO password or OTP validators —
 * those belong to the registration flow, not the standalone consent endpoint.
 */
export const ConsentDto = z.object({
  agreedTos: z.literal(true, {
    errorMap: () => ({ message: CONSENT_MESSAGE }),
  }),
  agreedPrivacy: z.literal(true, {
    errorMap: () => ({ message: CONSENT_MESSAGE }),
  }),
  agreedAge: z.literal(true, {
    errorMap: () => ({ message: CONSENT_MESSAGE }),
  }),
})

export type ConsentInput = z.infer<typeof ConsentDto>
