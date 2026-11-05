import { z } from 'zod'

export const OTP_DIGITS = 6

/**
 * Validates a numeric one-time-password of exactly 6 digits.
 *
 * This is the canonical OTP format for the entire application.
 * Import this schema anywhere an OTP field is validated —
 * do NOT define an independent OTP check in a route handler.
 */
export const otpSchema = z
  .string()
  .regex(
    /^\d{6}$/,
    `Verification code must be exactly ${OTP_DIGITS} digits`,
  )
