import { z } from 'zod'

/**
 * DTO for POST /auth/send-otp.
 *
 * Validates the email field only.
 * This DTO intentionally imports NO password or OTP validators —
 * the OTP has not been generated at this stage and password is irrelevant.
 */
export const SendOtpDto = z.object({
  email: z.string().email('Valid email required.'),
})

export type SendOtpInput = z.infer<typeof SendOtpDto>
