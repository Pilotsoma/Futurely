import { z } from 'zod'
import { passwordSchema } from '../validators/password.validator'
import { otpSchema } from '../validators/otp.validator'

const CONSENT_MESSAGE =
  'You must agree to the Terms of Service, Privacy Policy, and confirm your age to register.'

/**
 * DTO for POST /auth/register.
 *
 * Imports password and OTP validators for field-level rules.
 * Consent fields use literal-true assertions with a combined error message.
 * DOB and display name receive loose typing here because they are further
 * validated downstream by domain-specific helpers (validateDobInput,
 * filterUsername) that are not pure string checks.
 *
 * This DTO must NOT be used in the OTP or consent endpoints — each of those
 * has its own scoped DTO.
 */
export const RegisterDto = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: passwordSchema,
  otp: otpSchema,
  name: z.string().optional(),
  role: z.string().optional(),
  dateOfBirth: z.string().optional(),
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

export type RegisterInput = z.infer<typeof RegisterDto>
