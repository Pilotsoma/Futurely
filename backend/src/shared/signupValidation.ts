// Signup field rules — the single source of truth for the backend
// (routes/auth.ts), the web app (app/login/LoginForm.tsx via `@/backend/...`)
// and the mobile app (nextstep-mobile, via Metro watchFolders).
//
// Must stay dependency-free: web and mobile bundle this file directly and
// cannot resolve backend's node_modules (zod etc. are backend-only).
//
// Login must NOT use validatePassword — existing accounts may predate the
// current policy. Login only checks "not empty".

export type SignupField = 'email' | 'password' | 'confirmPassword' | 'name' | 'otp' | 'dateOfBirth'

export const SIGNUP_FIELDS: readonly SignupField[] = ['email', 'password', 'confirmPassword', 'name', 'otp', 'dateOfBirth']

export function isSignupField(value: unknown): value is SignupField {
  return typeof value === 'string' && (SIGNUP_FIELDS as readonly string[]).includes(value)
}

// ── Password ────────────────────────────────────────────────────────────────

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

export interface PasswordRequirement {
  id: 'length' | 'uppercase' | 'number'
  label: string
  message: string
  test: (password: string) => boolean
}

export const PASSWORD_REQUIREMENTS: readonly PasswordRequirement[] = [
  {
    id: 'length',
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: 'uppercase',
    label: 'At least one uppercase letter',
    message: 'Password must contain at least one uppercase letter.',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: 'number',
    label: 'At least one number',
    message: 'Password must contain at least one number.',
    test: (password) => /[0-9]/.test(password),
  },
]

export const PASSWORD_PLACEHOLDER = `At least ${PASSWORD_MIN_LENGTH} characters`

export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length === 0) return 'Enter a password.'
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`
  }
  const failed = PASSWORD_REQUIREMENTS.find((requirement) => !requirement.test(password))
  return failed ? failed.message : null
}

export function validateConfirmPassword(password: string, confirmPassword: string): string | null {
  if (confirmPassword.length === 0) return 'Re-enter your password.'
  return password === confirmPassword ? null : 'Passwords do not match.'
}

// ── Email ───────────────────────────────────────────────────────────────────

export const EMAIL_MAX_LENGTH = 254
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export function validateEmail(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return 'Enter your email address.'
  const email = normalizeEmail(raw)
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    return 'Please enter a valid email address.'
  }
  return null
}

// ── Verification code ───────────────────────────────────────────────────────
// Matches the generator in routes/auth.ts (POST /auth/send-otp).

export const OTP_LENGTH = 6
export const OTP_EXPIRY_MINUTES = 10
export const OTP_RESEND_COOLDOWN_SECONDS = 30
const OTP_PATTERN = new RegExp(`^\\d{${OTP_LENGTH}}$`)

/** Strips everything but digits and caps the length — use on every keystroke/paste. */
export function normalizeOtp(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, OTP_LENGTH)
}

export function validateOtp(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return 'Enter the verification code we emailed you.'
  if (!OTP_PATTERN.test(raw.trim())) return `Enter the ${OTP_LENGTH}-digit code we emailed you.`
  return null
}

// ── Display name ────────────────────────────────────────────────────────────
// Server additionally runs the reserved-name + profanity filter
// (lib/contentFilter.ts filterUsername) and the uniqueness check.

export const DISPLAY_NAME_MIN_LENGTH = 2
export const DISPLAY_NAME_MAX_LENGTH = 30
// Letters (incl. accented Latin), digits, spaces and . _ - '
const DISPLAY_NAME_PATTERN = /^[A-Za-z0-9À-ÖØ-öø-ɏ _.'-]+$/

/** Students may skip the display name; parent/educator accounts must give one. */
export function displayNameRequired(role: string | undefined): boolean {
  return role === 'PARENT' || role === 'TEACHER' || role === 'COUNSELOR'
}

export function validateDisplayName(raw: unknown, required: boolean): string | null {
  if (raw === undefined || raw === null || raw === '') {
    return required ? 'Enter your name.' : null
  }
  if (typeof raw !== 'string') return 'Enter a valid name.'
  const name = raw.trim()
  if (name.length === 0) return 'Name can’t be only spaces.'
  if (name.length < DISPLAY_NAME_MIN_LENGTH) {
    return `Name must be at least ${DISPLAY_NAME_MIN_LENGTH} characters.`
  }
  if (name.length > DISPLAY_NAME_MAX_LENGTH) {
    return `Name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`
  }
  if (!DISPLAY_NAME_PATTERN.test(name)) {
    return 'Name can only use letters, numbers, spaces, and . _ - \''
  }
  return null
}

// ── API error contract ──────────────────────────────────────────────────────
// Every signup endpoint returns { data: null, error: { code, field?, message } }.

export const SIGNUP_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  EMAIL_TAKEN: 'CONFLICT',
  NAME_TAKEN: 'NAME_TAKEN',
  INAPPROPRIATE_NAME: 'INAPPROPRIATE_NAME',
  OTP_REQUIRED: 'OTP_REQUIRED',
  INVALID_OTP: 'INVALID_OTP',
  OTP_EXPIRED: 'OTP_EXPIRED',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
} as const
