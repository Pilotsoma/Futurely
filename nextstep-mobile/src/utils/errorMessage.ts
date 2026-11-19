import { ApiRequestError, SessionExpiredError } from '../api/client'

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'

const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please sign in again.'
const RATE_LIMITED_MESSAGE = 'Too many requests. Please wait a moment and try again.'

// Anything that smells like a developer/server string: framework words, stack
// frames, URLs and route-like paths ("/sets/123", "GET /feed/posts").
const UNSAFE_PATTERN =
  /unhandled|exception|stack|prisma|sql|econn|undefined|null|\bat .+:\d+|https?:\/\/|\/[a-z-]+\/[a-z-]+/i

/** True when a server-authored message is short and plain enough to show a student. */
export function isUserSafe(message: string): boolean {
  const trimmed = message.trim()
  return trimmed.length >= 1 && trimmed.length <= 160 && !UNSAFE_PATTERN.test(trimmed)
}

/**
 * Maps any thrown value to copy that is safe to render. Server text is only
 * passed through for 4xx validation-style errors that pass `isUserSafe`;
 * 404s, 5xx and unknown errors get `fallback`.
 *
 * Use on load paths and list-level action errors. Do not use where a test or
 * product requirement needs the server's message verbatim.
 */
export function toUserMessage(err: unknown, fallback: string = GENERIC_ERROR_MESSAGE): string {
  if (err instanceof SessionExpiredError) return SESSION_EXPIRED_MESSAGE
  if (!(err instanceof ApiRequestError)) return fallback

  // Written by the API client itself (api/client.ts), never by the server.
  if (err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT') return err.message

  const { status } = err
  if (status === 429) return RATE_LIMITED_MESSAGE
  if (status === 404 || status === 0 || status >= 500) return fallback
  if (status >= 400 && status < 500 && isUserSafe(err.message)) return err.message.trim()
  return fallback
}
