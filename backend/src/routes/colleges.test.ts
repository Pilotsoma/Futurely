/**
 * Integration tests for POST /colleges/predict
 *
 * Uses Supertest against the real Express app. Mocks:
 *   - axios (to intercept model server calls)
 *   - prisma (to isolate from the database)
 *   - writeAuditLog (to verify it is called without touching the DB)
 *
 * Style follows assignments.test.ts in this directory.
 *
 * EXECUTION STATUS: CANNOT RUN — jest is not installed in backend/.
 * Install jest + ts-jest + supertest before claiming these pass.
 * See ENGINEERING_RULES.md and the QA verdict in the feature handoff.
 */

import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app'

// ── Mock dependencies ─────────────────────────────────────────────────────────

jest.mock('axios')
jest.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    college: {
      findUnique: jest.fn(),
    },
    collegeListItem: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    complianceAuditLog: {
      create: jest.fn(),
    },
  },
}))
jest.mock('../lib/auditLog', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}))

import axios from 'axios'
import { prisma } from '../lib/prisma'
import { writeAuditLog } from '../lib/auditLog'

const mockedAxios = jest.mocked(axios)
const mockedPrisma = jest.mocked(prisma)
const mockedWriteAuditLog = jest.mocked(writeAuditLog)

// ── JWT helper ─────────────────────────────────────────────────────────────────

const TEST_JWT_SECRET = 'test-secret-for-jest'

function makeToken(userId: number): string {
  return jwt.sign({ sub: userId }, TEST_JWT_SECRET, { expiresIn: '1h' })
}

// Seed process.env so requireAuth uses the test secret
beforeAll(() => {
  process.env.JWT_SECRET = TEST_JWT_SECRET
  process.env.NODE_ENV = 'test'
})

afterAll(() => {
  delete process.env.JWT_SECRET
})

// ── Shared fixtures ────────────────────────────────────────────────────────────

const ADULT_USER = {
  id: 42,
  dateOfBirth: new Date('2000-01-01'), // 26 years old — not under 13
  coppaConsentStatus: 'not_required',
}

const SAMPLE_COLLEGE = {
  id: 7,
  name: 'State University',
  avgSat: 1200,
  avgAct: 26,
  avgGpa: 3.4,
  acceptanceRate: 0.55,
}

const PREDICT_BODY = {
  collegeId: 7,
  studentSat: 1250,
  studentAct: 28,
  studentGpa: 3.6,
}

// ── Authentication ─────────────────────────────────────────────────────────────

describe('POST /colleges/predict — authentication', () => {
  beforeEach(() => jest.resetAllMocks())

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app)
      .post('/colleges/predict')
      .send(PREDICT_BODY)

    expect(res.status).toBe(401)
  })

  it('returns 401 when an expired token is provided', async () => {
    const expiredToken = jwt.sign(
      { sub: 42 },
      TEST_JWT_SECRET,
      { expiresIn: -1 }, // immediately expired
    )

    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send(PREDICT_BODY)

    expect(res.status).toBe(401)
  })

  it('returns 401 when a token is signed with a different secret (tampered)', async () => {
    const tamperedToken = jwt.sign({ sub: 42 }, 'wrong-secret')

    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${tamperedToken}`)
      .send(PREDICT_BODY)

    expect(res.status).toBe(401)
  })

  it('accepts a valid, unexpired token', async () => {
    ;(mockedPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(ADULT_USER)
    ;(mockedPrisma.college.findUnique as jest.Mock).mockResolvedValueOnce(SAMPLE_COLLEGE)
    ;(mockedAxios.post as jest.Mock).mockResolvedValueOnce({ data: { probability: 62.0 } })

    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${makeToken(42)}`)
      .send(PREDICT_BODY)

    expect(res.status).toBe(200)
  })
})

// ── Input validation ───────────────────────────────────────────────────────────

describe('POST /colleges/predict — input validation', () => {
  const token = makeToken(99)

  beforeEach(() => {
    jest.resetAllMocks()
    ;(mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(ADULT_USER)
  })

  it('returns 400 when collegeId is missing', async () => {
    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentSat: 1200, studentGpa: 3.5 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when studentSat is below 400', async () => {
    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...PREDICT_BODY, studentSat: 300 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when studentSat is above 1600', async () => {
    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...PREDICT_BODY, studentSat: 1700 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when studentGpa is above 5', async () => {
    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...PREDICT_BODY, studentGpa: 5.5 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when studentGpa is negative', async () => {
    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...PREDICT_BODY, studentGpa: -0.1 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when studentAct is above 36', async () => {
    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...PREDICT_BODY, studentAct: 37 })

    expect(res.status).toBe(400)
  })

  it('accepts studentAct as null (optional field)', async () => {
    ;(mockedPrisma.college.findUnique as jest.Mock).mockResolvedValueOnce(SAMPLE_COLLEGE)
    ;(mockedAxios.post as jest.Mock).mockResolvedValueOnce({ data: { probability: 50.0 } })

    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...PREDICT_BODY, studentAct: null })

    expect(res.status).toBe(200)
  })

  it('accepts a request body without studentAct (omitted entirely)', async () => {
    ;(mockedPrisma.college.findUnique as jest.Mock).mockResolvedValueOnce(SAMPLE_COLLEGE)
    ;(mockedAxios.post as jest.Mock).mockResolvedValueOnce({ data: { probability: 50.0 } })

    const { studentAct: _, ...bodyWithoutAct } = PREDICT_BODY
    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send(bodyWithoutAct)

    expect(res.status).toBe(200)
  })
})

// ── COPPA gate ─────────────────────────────────────────────────────────────────

describe('POST /colleges/predict — COPPA gate', () => {
  const token = makeToken(5)

  beforeEach(() => jest.resetAllMocks())

  it('returns 403 for a user under 13 without verified parental consent', async () => {
    const under13 = {
      id: 5,
      dateOfBirth: new Date(), // born today — definitely under 13
      coppaConsentStatus: 'pending',
    }
    ;(mockedPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(under13)

    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send(PREDICT_BODY)

    expect(res.status).toBe(403)
    expect(res.body.error.message).toMatch(/parental consent/i)
  })

  it('returns 403 for a user just-under-13 (boundary: one day before 13th birthday)', async () => {
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 13)
    oneYearAgo.setDate(oneYearAgo.getDate() + 1) // 13 years old tomorrow

    const nearlyThirteen = {
      id: 5,
      dateOfBirth: oneYearAgo,
      coppaConsentStatus: 'pending',
    }
    ;(mockedPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(nearlyThirteen)

    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send(PREDICT_BODY)

    expect(res.status).toBe(403)
  })

  it('allows a user exactly 13 today (boundary: born on exact 13th birthday)', async () => {
    // A user who turned 13 exactly today should NOT be blocked.
    // isUnder13 returns true only when dateOfBirth > the cutoff date.
    const exactlyThirteen = new Date()
    exactlyThirteen.setFullYear(exactlyThirteen.getFullYear() - 13)

    const user = {
      id: 5,
      dateOfBirth: exactlyThirteen,
      coppaConsentStatus: 'not_required',
    }
    ;(mockedPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(user)
    ;(mockedPrisma.college.findUnique as jest.Mock).mockResolvedValueOnce(SAMPLE_COLLEGE)
    ;(mockedAxios.post as jest.Mock).mockResolvedValueOnce({ data: { probability: 55 } })

    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send(PREDICT_BODY)

    // Should be 200 (not blocked), because the user is exactly 13 today.
    expect(res.status).toBe(200)
  })

  it('allows a verified under-13 user through the COPPA gate', async () => {
    const under13Verified = {
      id: 5,
      dateOfBirth: new Date(),
      coppaConsentStatus: 'verified',
    }
    ;(mockedPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(under13Verified)
    ;(mockedPrisma.college.findUnique as jest.Mock).mockResolvedValueOnce(SAMPLE_COLLEGE)
    ;(mockedAxios.post as jest.Mock).mockResolvedValueOnce({ data: { probability: 40 } })

    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send(PREDICT_BODY)

    expect(res.status).toBe(200)
  })

  it('allows an adult user (no dateOfBirth set) through without COPPA check', async () => {
    const userNoDob = {
      id: 5,
      dateOfBirth: null,
      coppaConsentStatus: 'not_required',
    }
    ;(mockedPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(userNoDob)
    ;(mockedPrisma.college.findUnique as jest.Mock).mockResolvedValueOnce(SAMPLE_COLLEGE)
    ;(mockedAxios.post as jest.Mock).mockResolvedValueOnce({ data: { probability: 72 } })

    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send(PREDICT_BODY)

    expect(res.status).toBe(200)
  })
})

// ── College not found ──────────────────────────────────────────────────────────

describe('POST /colleges/predict — college not found', () => {
  const token = makeToken(42)

  beforeEach(() => jest.resetAllMocks())

  it('returns 404 when the college does not exist in the catalog', async () => {
    ;(mockedPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(ADULT_USER)
    ;(mockedPrisma.college.findUnique as jest.Mock).mockResolvedValueOnce(null)

    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...PREDICT_BODY, collegeId: 999999 })

    expect(res.status).toBe(404)
  })
})

// ── Model service unavailable ─────────────────────────────────────────────────

describe('POST /colleges/predict — model service errors', () => {
  const token = makeToken(42)

  beforeEach(() => {
    jest.resetAllMocks()
    ;(mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(ADULT_USER)
    ;(mockedPrisma.college.findUnique as jest.Mock).mockResolvedValue(SAMPLE_COLLEGE)
  })

  it('returns 503 when the model server is unreachable (ECONNREFUSED)', async () => {
    const err = Object.assign(new Error('ECONNREFUSED'), {
      isAxiosError: true,
      code: 'ECONNREFUSED',
      response: undefined,
    })
    ;(mockedAxios.post as jest.Mock).mockRejectedValueOnce(err)

    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send(PREDICT_BODY)

    expect(res.status).toBe(503)
    expect(res.body.error.message).toMatch(/temporarily unavailable/i)
  })

  it('returns 503 when the model server times out', async () => {
    const err = Object.assign(new Error('timeout'), {
      isAxiosError: true,
      code: 'ECONNABORTED',
      response: undefined,
    })
    ;(mockedAxios.post as jest.Mock).mockRejectedValueOnce(err)

    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send(PREDICT_BODY)

    expect(res.status).toBe(503)
  })
})

// ── Audit log ─────────────────────────────────────────────────────────────────

describe('POST /colleges/predict — compliance audit log', () => {
  const token = makeToken(42)

  beforeEach(() => {
    jest.resetAllMocks()
    ;(mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(ADULT_USER)
    ;(mockedPrisma.college.findUnique as jest.Mock).mockResolvedValue(SAMPLE_COLLEGE)
    ;(mockedAxios.post as jest.Mock).mockResolvedValue({ data: { probability: 55 } })
  })

  it('writes an audit log entry on every successful prediction', async () => {
    await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send(PREDICT_BODY)

    expect(mockedWriteAuditLog).toHaveBeenCalledTimes(1)
    expect(mockedWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        resourceType: 'college_probability',
        resourceId: String(SAMPLE_COLLEGE.id),
        action: 'predict',
      }),
    )
  })

  it('audit log entry does NOT contain student name, email, or SAT/GPA values', async () => {
    await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send(PREDICT_BODY)

    const auditArg = mockedWriteAuditLog.mock.calls[0][0]
    // FERPA: audit log must contain only the opaque userId (number), never PII
    expect(auditArg).not.toHaveProperty('studentSat')
    expect(auditArg).not.toHaveProperty('studentGpa')
    expect(auditArg).not.toHaveProperty('email')
    expect(auditArg).not.toHaveProperty('name')
    expect(typeof auditArg.userId).toBe('number')
  })

  it('does not crash the request if the audit write itself fails (fire-and-forget)', async () => {
    // writeAuditLog swallows its own errors (uses .catch internally).
    // The handler calls it with await but writeAuditLog already handles failure silently.
    // This verifies no 500 results from an audit failure.
    mockedWriteAuditLog.mockRejectedValueOnce(new Error('DB write failed'))

    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send(PREDICT_BODY)

    // Audit failure must NOT propagate to the caller
    expect(res.status).toBe(200)
  })
})

// ── Happy path response shape ─────────────────────────────────────────────────

describe('POST /colleges/predict — happy path', () => {
  const token = makeToken(42)

  beforeEach(() => {
    jest.resetAllMocks()
    ;(mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(ADULT_USER)
    ;(mockedPrisma.college.findUnique as jest.Mock).mockResolvedValue(SAMPLE_COLLEGE)
  })

  it('returns 200 with collegeName, probability (0-100), and tier', async () => {
    ;(mockedAxios.post as jest.Mock).mockResolvedValueOnce({ data: { probability: 62.5 } })

    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send(PREDICT_BODY)

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      collegeName: 'State University',
      probability: 62.5,
      tier: 'Target',
    })
  })

  it('response does not contain student name, email, SAT, or GPA values', async () => {
    ;(mockedAxios.post as jest.Mock).mockResolvedValueOnce({ data: { probability: 62.5 } })

    const res = await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${token}`)
      .send(PREDICT_BODY)

    const data = res.body.data
    expect(data).not.toHaveProperty('studentSat')
    expect(data).not.toHaveProperty('studentGpa')
    expect(data).not.toHaveProperty('email')
    expect(data).not.toHaveProperty('userId')
  })
})

// ── Data isolation — user A cannot trigger operations for user B ──────────────

describe('POST /colleges/predict — data isolation', () => {
  it('each request uses the authenticated userId, not a user-supplied one', async () => {
    jest.resetAllMocks()
    ;(mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...ADULT_USER,
      id: 100, // user 100
    })
    ;(mockedPrisma.college.findUnique as jest.Mock).mockResolvedValue(SAMPLE_COLLEGE)
    ;(mockedAxios.post as jest.Mock).mockResolvedValue({ data: { probability: 55 } })

    const tokenForUser100 = makeToken(100)
    await request(app)
      .post('/colleges/predict')
      .set('Authorization', `Bearer ${tokenForUser100}`)
      .send(PREDICT_BODY)

    // The user lookup must be scoped to the JWT userId (100), not any body field
    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 100 } }),
    )
    // The audit log must record userId=100
    expect(mockedWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 100 }),
    )
  })
})
