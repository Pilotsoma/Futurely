import { ApiRequestError, SessionExpiredError } from '../../api/client'
import { GENERIC_ERROR_MESSAGE, isUserSafe, toUserMessage } from '../errorMessage'

// api/client pulls in token storage (AsyncStorage / SecureStore native modules),
// which is irrelevant here: only its error classes are used.
jest.mock('../storage', () => ({
  clearTokens: jest.fn(),
  loadTokens: jest.fn(),
  storeTokens: jest.fn(),
}))

const FALLBACK = 'x'

describe('toUserMessage', () => {
  it('never shows the raw mock or server 404 text', () => {
    const err = new ApiRequestError('Unhandled E2E route: GET /sets', 404, 'E2E_UNHANDLED')
    expect(toUserMessage(err, FALLBACK)).toBe(FALLBACK)
  })

  it('maps an expired session to a sign-in prompt', () => {
    expect(toUserMessage(new SessionExpiredError(), FALLBACK)).toBe(
      'Your session expired. Please sign in again.',
    )
  })

  it('keeps the client-authored network and timeout messages', () => {
    const network = new ApiRequestError('Network error. Please check your connection.', 0, 'NETWORK_ERROR')
    const timeout = new ApiRequestError('Request timed out. Please try again.', 0, 'TIMEOUT')
    expect(toUserMessage(network, FALLBACK)).toBe('Network error. Please check your connection.')
    expect(toUserMessage(timeout, FALLBACK)).toBe('Request timed out. Please try again.')
  })

  it('maps 429 to a rate-limit message', () => {
    expect(toUserMessage(new ApiRequestError('Rate limit exceeded', 429), FALLBACK)).toBe(
      'Too many requests. Please wait a moment and try again.',
    )
  })

  it.each([404, 0, 500, 502, 503])('uses the fallback for status %i', (status) => {
    expect(toUserMessage(new ApiRequestError('Title is required', status), FALLBACK)).toBe(FALLBACK)
  })

  it('passes through a user-safe message on other 4xx statuses', () => {
    expect(toUserMessage(new ApiRequestError('Title is required', 400), FALLBACK)).toBe('Title is required')
    expect(toUserMessage(new ApiRequestError('You already follow this student.', 409), FALLBACK)).toBe(
      'You already follow this student.',
    )
  })

  it('uses the fallback for unsafe messages on other 4xx statuses', () => {
    const unsafe = [
      'PrismaClientKnownRequestError: invalid invocation',
      "Cannot read properties of undefined (reading 'id')",
      'Validation failed at /app/src/routes/sets.ts:42',
      'See https://internal.example.com/docs',
      'Route GET /feed/posts rejected',
      '',
      'a'.repeat(161),
    ]
    for (const message of unsafe) {
      expect(toUserMessage(new ApiRequestError(message, 400), FALLBACK)).toBe(FALLBACK)
    }
  })

  it('uses the fallback for anything that is not an API error', () => {
    expect(toUserMessage(new Error('TypeError: x is not a function'), FALLBACK)).toBe(FALLBACK)
    expect(toUserMessage('boom', FALLBACK)).toBe(FALLBACK)
    expect(toUserMessage(null, FALLBACK)).toBe(FALLBACK)
  })

  it('defaults the fallback to the generic message', () => {
    expect(toUserMessage(new Error('boom'))).toBe(GENERIC_ERROR_MESSAGE)
    expect(GENERIC_ERROR_MESSAGE).toBe('Something went wrong. Please try again.')
  })
})

describe('isUserSafe', () => {
  it('accepts short plain sentences and rejects developer text', () => {
    expect(isUserSafe('Title is required')).toBe(true)
    expect(isUserSafe('Unhandled E2E route: GET /sets')).toBe(false)
    expect(isUserSafe('SQL syntax error')).toBe(false)
    expect(isUserSafe('   ')).toBe(false)
  })
})
