import {
  OTP_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
  displayNameRequired,
  isSignupField,
  normalizeEmail,
  normalizeOtp,
  validateConfirmPassword,
  validateDisplayName,
  validateEmail,
  validateOtp,
  validatePassword,
} from '../signupValidation'

describe('validatePassword', () => {
  it('rejects empty and non-string input', () => {
    expect(validatePassword('')).toBe('Enter a password.')
    expect(validatePassword(undefined)).toBe('Enter a password.')
    expect(validatePassword(12345678)).toBe('Enter a password.')
  })

  it.each(['Abcde1', 'Abcdef1'])('rejects %s (shorter than the minimum)', (pw) => {
    expect(validatePassword(pw)).toBe(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  })

  it('requires an uppercase letter', () => {
    expect(validatePassword('password1')).toBe('Password must contain at least one uppercase letter.')
  })

  it('requires a number', () => {
    expect(validatePassword('Password')).toBe('Password must contain at least one number.')
  })

  it('accepts a password meeting every rule at exactly the minimum length', () => {
    expect(validatePassword('Passwor1')).toBeNull()
  })

  it('enforces the maximum length', () => {
    expect(validatePassword('A1' + 'a'.repeat(PASSWORD_MAX_LENGTH - 2))).toBeNull()
    expect(validatePassword('A1' + 'a'.repeat(PASSWORD_MAX_LENGTH - 1))).toBe(
      `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`,
    )
  })

  it('exposes requirements whose labels read from the shared constant', () => {
    expect(PASSWORD_REQUIREMENTS[0].label).toBe(`At least ${PASSWORD_MIN_LENGTH} characters`)
    expect(PASSWORD_MIN_LENGTH).toBe(8)
  })
})

describe('validateConfirmPassword', () => {
  it('requires a value and a match', () => {
    expect(validateConfirmPassword('Passwor1', '')).toBe('Re-enter your password.')
    expect(validateConfirmPassword('Passwor1', 'Passwor2')).toBe('Passwords do not match.')
    expect(validateConfirmPassword('Passwor1', 'Passwor1')).toBeNull()
  })
})

describe('email', () => {
  it('normalizes by trimming and lowercasing', () => {
    expect(normalizeEmail('  Me@Example.COM ')).toBe('me@example.com')
  })

  it.each(['', '   ', 'plainaddress', 'a@b', 'a b@c.com', '@c.com'])('rejects %p', (email) => {
    expect(validateEmail(email)).not.toBeNull()
  })

  it('accepts a valid address with surrounding whitespace', () => {
    expect(validateEmail('  student@school.org ')).toBeNull()
  })

  it('rejects addresses over 254 characters', () => {
    expect(validateEmail(`${'a'.repeat(250)}@x.com`)).toBe('Please enter a valid email address.')
  })
})

describe('verification code', () => {
  it('normalizes pasted input to digits only, capped at the code length', () => {
    expect(normalizeOtp('123 456')).toBe('123456')
    expect(normalizeOtp('12-34-56-78')).toBe('123456')
    expect(normalizeOtp('abc')).toBe('')
  })

  it.each(['', '12345', '1234567', '12a456'])('rejects %p', (code) => {
    expect(validateOtp(code)).not.toBeNull()
  })

  it(`accepts exactly ${OTP_LENGTH} digits`, () => {
    expect(validateOtp('042317')).toBeNull()
  })
})

describe('display name', () => {
  it('is optional for students but required for parents and educators', () => {
    expect(displayNameRequired(undefined)).toBe(false)
    expect(displayNameRequired('STUDENT')).toBe(false)
    expect(displayNameRequired('PARENT')).toBe(true)
    expect(displayNameRequired('TEACHER')).toBe(true)
    expect(validateDisplayName('', false)).toBeNull()
    expect(validateDisplayName(undefined, false)).toBeNull()
    expect(validateDisplayName('', true)).toBe('Enter your name.')
  })

  it('rejects whitespace-only even when optional', () => {
    expect(validateDisplayName('   ', false)).toBe('Name can’t be only spaces.')
  })

  it('enforces length after trimming', () => {
    expect(validateDisplayName(' a ', false)).toBe('Name must be at least 2 characters.')
    expect(validateDisplayName('a'.repeat(31), false)).toBe('Name must be 30 characters or fewer.')
    expect(validateDisplayName('a'.repeat(30), false)).toBeNull()
  })

  it.each(['Jane<script>', 'Jane 😀', 'jane@doe', 'Tab\there'])('rejects invalid characters in %p', (name) => {
    expect(validateDisplayName(name, false)).toBe('Name can only use letters, numbers, spaces, and . _ - \'')
  })

  it.each(["Jane Doe", "O'Brien", 'José', 'jane_doe-2.0'])('accepts %p', (name) => {
    expect(validateDisplayName(name, false)).toBeNull()
  })
})

describe('isSignupField', () => {
  it('recognises only known fields', () => {
    expect(isSignupField('password')).toBe(true)
    expect(isSignupField('hacPassword')).toBe(false)
    expect(isSignupField(undefined)).toBe(false)
  })
})
