import { z } from 'zod'

export const MIN_PASSWORD_LENGTH = 8

/**
 * Single-rule password schema: minimum 8 characters.
 *
 * This is the canonical password rule for the entire application.
 * Import this schema anywhere password strength is validated —
 * do NOT define an independent password check in a route handler.
 */
export const passwordSchema = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
  )
