/**
 * Signup validation contract for POST /auth/send-otp, /auth/verify-otp and
 * /auth/register.
 *
 * Every signup endpoint must reject bad input with
 *   { data: null, error: { code, field, message } }
 * on the step that collects that field, and /register must never create a
 * user when any field (or the code) is invalid.
 *
 * Mocked: prisma, email sending, DNS MX lookup, DOB encryption, and
 * express-rate-limit (passthrough — the in-memory limiters would otherwise
 * throttle this suite; the verify-otp limiter's response shape is asserted
 * from its captured options instead).
 */

import crypto from 'crypto'

const limiterOptions: Array<Record<string, unknown>> = []
jest.mock('express-rate-limit', () => ({
  __esModule: true,
  default: (opts: Record<string, unknown>) => {
    limiterOptions.push(opts)
    return (_req: unknown, _res: unknown, next: () => void) => next()
  },
}))

jest.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    emailOTP: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    complianceAuditLog: { create: jest.fn() },
    refreshToken: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../lib/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }))

jest.mock('dns', () => ({
  promises: { resolveMx: jest.fn().mockResolvedValue([{ exchange: 'mx.example.com', priority: 10 }]) },
}))

jest.mock('../../lib/dobVerification', () => ({
  ...jest.requireActual('../../lib/dobVerification'),
  encryptDob: jest.fn(() => 'encrypted-dob'),
}))

import express from 'express'
import request from 'supertest'
import authRouter from '../auth'
import { prisma } from '../../lib/prisma'
import { sendEmail } from '../../lib/email'

const db = prisma as unknown as {
  user: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock }
  emailOTP: { findFirst: jest.Mock; create: jest.Mock; updateMany: jest.Mock }
  complianceAuditLog: { create: jest.Mock }
  refreshToken: { create: jest.Mock }
  $transaction: jest.Mock
}

const app = express()
app.use(express.json())
app.use('/auth', authRouter)

const VALID = {
  email: 'New.Student@Example.com',
  password: 'Passwor1',
  name: 'Jane Doe',
  dateOfBirth: '2008-01-15',
}
const CODE = '123456'
const hash = (code: string) => crypto.createHash('sha256').update(code).digest('hex')

function activeOtp(overrides: Partial<{ id: number; codeHash: string; expiresAt: Date; createdAt: Date }> = {}) {
  return {
    id: 7,
    email: 'new.student@example.com',
    codeHash: hash(CODE),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    createdAt: new Date(Date.now() - 60 * 1000),
    usedAt: null,
    ...overrides,
  }
}

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret'
})

beforeEach(() => {
  jest.clearAllMocks()
  db.user.findMany.mockResolvedValue([])
  db.user.findFirst.mockResolvedValue(null)
  db.emailOTP.findFirst.mockResolvedValue(null)
  db.emailOTP.updateMany.mockResolvedValue({ count: 1 })
  db.emailOTP.create.mockResolvedValue({})
  db.refreshToken.create.mockResolvedValue({})
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma))
  db.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 1, ...data }))
})

function expectFieldError(res: request.Response, status: number, field: string, code?: string) {
  expect(res.status).toBe(status)
  expect(res.body.data).toBeNull()
  expect(res.body.error.field).toBe(field)
  expect(typeof res.body.error.message).toBe('string')
  if (code) expect(res.body.error.code).toBe(code)
}

describe('POST /auth/send-otp — validates the account step before sending a code', () => {
  it.each([
    ['6-char password', { password: 'Abcde1' }, 'password'],
    ['7-char password', { password: 'Abcdef1' }, 'password'],
    ['password without uppercase', { password: 'password1' }, 'password'],
    ['malformed email', { email: 'not-an-email' }, 'email'],
    ['whitespace-only name', { name: '   ' }, 'name'],
    ['one-char name', { name: 'J' }, 'name'],
    ['name with invalid characters', { name: 'Jane<3' }, 'name'],
    ['reserved name', { name: 'Admin' }, 'name'],
    ['under-13 date of birth', { dateOfBirth: new Date().toISOString().slice(0, 10) }, 'dateOfBirth'],
  ])('rejects a %s with 400 on the right field and sends nothing', async (_label, override, field) => {
    const res = await request(app).post('/auth/send-otp').send({ ...VALID, ...override })
    expectFieldError(res, 400, field)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('returns 409 on the email field when the email is registered (any case)', async () => {
    db.user.findMany.mockResolvedValue([{ id: 3, email: 'New.Student@Example.com' }])
    const res = await request(app).post('/auth/send-otp').send(VALID)
    expectFieldError(res, 409, 'email', 'CONFLICT')
  })

  it('returns 409 on the name field when the display name is taken', async () => {
    db.user.findFirst.mockResolvedValue({ id: 4 })
    const res = await request(app).post('/auth/send-otp').send(VALID)
    expectFieldError(res, 409, 'name', 'NAME_TAKEN')
  })

  it('sends a 6-digit code to the normalised email when everything is valid', async () => {
    const res = await request(app).post('/auth/send-otp').send(VALID)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ sent: true, resendAvailableInSeconds: 30 })
    expect(db.emailOTP.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: 'new.student@example.com' }),
    })
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'new.student@example.com' }))
    expect((sendEmail as jest.Mock).mock.calls[0][0].html).toMatch(/>\d{6}</)
  })

  it('keeps the existing code during the resend cooldown instead of sending another', async () => {
    db.emailOTP.findFirst.mockResolvedValue(activeOtp({ createdAt: new Date(Date.now() - 10 * 1000) }))
    const res = await request(app).post('/auth/send-otp').send({ email: VALID.email })
    expect(res.status).toBe(200)
    expect(res.body.data.sent).toBe(false)
    expect(res.body.data.resendAvailableInSeconds).toBeGreaterThan(0)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('still accepts the legacy { email }-only body', async () => {
    const res = await request(app).post('/auth/send-otp').send({ email: VALID.email })
    expect(res.status).toBe(200)
    expect(res.body.data.sent).toBe(true)
  })
})

describe('POST /auth/verify-otp — checks the code on the code step', () => {
  it('rejects an incomplete code without hitting the database', async () => {
    const res = await request(app).post('/auth/verify-otp').send({ email: VALID.email, otp: '123' })
    expectFieldError(res, 400, 'otp', 'VALIDATION_ERROR')
    expect(db.emailOTP.findFirst).not.toHaveBeenCalled()
  })

  it('distinguishes a wrong code (400 INVALID_OTP)', async () => {
    db.emailOTP.findFirst.mockResolvedValue(activeOtp())
    const res = await request(app).post('/auth/verify-otp').send({ email: VALID.email, otp: '654321' })
    expectFieldError(res, 400, 'otp', 'INVALID_OTP')
  })

  it('distinguishes an expired code (410 OTP_EXPIRED)', async () => {
    db.emailOTP.findFirst.mockResolvedValue(activeOtp({ expiresAt: new Date(Date.now() - 1000) }))
    const res = await request(app).post('/auth/verify-otp').send({ email: VALID.email, otp: CODE })
    expectFieldError(res, 410, 'otp', 'OTP_EXPIRED')
  })

  it('accepts the right code without consuming it', async () => {
    db.emailOTP.findFirst.mockResolvedValue(activeOtp())
    const res = await request(app).post('/auth/verify-otp').send({ email: VALID.email, otp: CODE })
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ verified: true })
    expect(db.emailOTP.updateMany).not.toHaveBeenCalled()
  })

  it('re-validates account fields sent alongside the code', async () => {
    db.emailOTP.findFirst.mockResolvedValue(activeOtp())
    const res = await request(app).post('/auth/verify-otp').send({ ...VALID, name: '  ', otp: CODE })
    expectFieldError(res, 400, 'name')
  })

  it('rate-limits failed guesses with a 429-style TOO_MANY_ATTEMPTS error on the otp field', () => {
    const verifyLimiter = limiterOptions.find(
      (o) => (o.message as { error?: { code?: string } })?.error?.code === 'TOO_MANY_ATTEMPTS',
    )
    expect(verifyLimiter).toBeDefined()
    expect(verifyLimiter?.skipSuccessfulRequests).toBe(true)
    expect((verifyLimiter?.message as { error: { field: string } }).error.field).toBe('otp')
  })
})

describe('POST /auth/register — authoritative backstop', () => {
  const full = { ...VALID, otp: CODE, agreedTos: true, agreedPrivacy: true, agreedAge: true }

  it.each([
    ['6-char password', { password: 'Abcde1' }, 'password'],
    ['invalid name', { name: 'J' }, 'name'],
    ['missing code', { otp: undefined }, 'otp'],
  ])('rejects a %s and never creates a user', async (_label, override, field) => {
    db.emailOTP.findFirst.mockResolvedValue(activeOtp())
    const res = await request(app).post('/auth/register').send({ ...full, ...override })
    expectFieldError(res, 400, field)
    expect(db.user.create).not.toHaveBeenCalled()
  })

  it('rejects a wrong code and never creates a user', async () => {
    db.emailOTP.findFirst.mockResolvedValue(activeOtp())
    const res = await request(app).post('/auth/register').send({ ...full, otp: '000000' })
    expectFieldError(res, 400, 'otp', 'INVALID_OTP')
    expect(db.user.create).not.toHaveBeenCalled()
  })

  it('creates exactly one user with a normalised email when everything is valid', async () => {
    db.emailOTP.findFirst.mockResolvedValue(activeOtp())
    const res = await request(app).post('/auth/register').send(full)
    expect(res.status).toBe(201)
    expect(db.user.create).toHaveBeenCalledTimes(1)
    expect(db.user.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ email: 'new.student@example.com', name: 'Jane Doe', emailVerified: true }),
    )
    expect(db.emailOTP.updateMany).toHaveBeenCalledWith({ where: { id: 7, usedAt: null }, data: { usedAt: expect.any(Date) } })
  })

  it('does not create a user when the code was consumed by a concurrent request', async () => {
    db.emailOTP.findFirst.mockResolvedValue(activeOtp())
    db.emailOTP.updateMany.mockResolvedValue({ count: 0 })
    const res = await request(app).post('/auth/register').send(full)
    expectFieldError(res, 410, 'otp', 'OTP_EXPIRED')
    expect(db.user.create).not.toHaveBeenCalled()
  })
})
