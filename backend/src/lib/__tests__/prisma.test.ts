// Regression coverage for the transient-connection-error classifier used by
// the retry-once wrapper in prisma.ts. The wrapper itself (a $extends query
// extension around a real Neon-backed PrismaClient) isn't exercised here —
// that behavior was verified directly against production (an 8.2s cold-start
// timeout followed immediately by a successful retry). This locks in the
// classification logic that decides what's safe to retry.

jest.mock('@neondatabase/serverless', () => ({
  Pool: jest.fn().mockImplementation(() => ({ on: jest.fn() })),
  neonConfig: {},
}))
jest.mock('@prisma/adapter-neon', () => ({
  PrismaNeon: jest.fn().mockImplementation(() => ({})),
}))
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $extends: jest.fn().mockReturnValue({}),
  })),
}))
jest.mock('ws', () => ({}))
jest.mock('../../common/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { isTransientConnectionError } from '../prisma'

describe('isTransientConnectionError', () => {
  it('classifies a Neon cold-start connection timeout as transient', () => {
    expect(isTransientConnectionError(new Error('timeout exceeded when trying to connect'))).toBe(true)
  })

  it('classifies a dropped connection as transient', () => {
    expect(isTransientConnectionError(new Error('Connection terminated unexpectedly'))).toBe(true)
  })

  it('classifies "can\'t reach database server" as transient', () => {
    expect(isTransientConnectionError(new Error("Can't reach database server at `ep-example.neon.tech`"))).toBe(true)
  })

  it('classifies ECONNRESET/ECONNREFUSED as transient', () => {
    expect(isTransientConnectionError(new Error('read ECONNRESET'))).toBe(true)
    expect(isTransientConnectionError(new Error('connect ECONNREFUSED 127.0.0.1:5432'))).toBe(true)
  })

  it('does NOT classify a real query error as transient (must not be retried)', () => {
    expect(isTransientConnectionError(new Error('Unique constraint failed on the fields: (`email`)'))).toBe(false)
    expect(isTransientConnectionError(new Error('Invalid `prisma.user.findUnique()` invocation'))).toBe(false)
  })

  it('returns false for non-Error values', () => {
    expect(isTransientConnectionError('some string')).toBe(false)
    expect(isTransientConnectionError(null)).toBe(false)
    expect(isTransientConnectionError(undefined)).toBe(false)
  })
})
