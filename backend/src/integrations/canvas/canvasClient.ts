import axios, { AxiosError } from 'axios'
import { logger } from '../../common/logger'

// ── Typed error classes ──────────────────────────────────────────────────────

export class CanvasTokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CanvasTokenError'
  }
}

export class CanvasNetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CanvasNetworkError'
  }
}

export class CanvasApiError extends Error {
  public readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'CanvasApiError'
    this.status = status
  }
}

// ── Response interfaces ──────────────────────────────────────────────────────

export interface CanvasSelf {
  id: number
  name: string
}

export interface CanvasCourse {
  id: number
  name: string
}

export interface CanvasAssignment {
  name: string
  due_at: string | null
  course_id: number
  points_possible: number | null
  html_url: string
}

// ── Network error codes ──────────────────────────────────────────────────────

const NETWORK_ERROR_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'])

// ── Internal helpers ─────────────────────────────────────────────────────────

function buildBaseUrl(instanceUrl: string): string {
  return `https://${instanceUrl}`
}

function buildAuthHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

function handleAxiosError(err: unknown, instanceUrl: string): never {
  if (err instanceof AxiosError) {
    const code = err.code ?? ''
    const status = err.response?.status

    if (NETWORK_ERROR_CODES.has(code)) {
      logger.warn('Canvas network error', { instanceUrl, errorCode: code })
      throw new CanvasNetworkError(`Cannot reach Canvas instance: ${code}`)
    }

    if (status === 401) {
      logger.warn('Canvas token rejected', { instanceUrl, status })
      throw new CanvasTokenError('Canvas access token is invalid or expired')
    }

    if (status !== undefined) {
      logger.error('Canvas API non-2xx response', { instanceUrl, status })
      throw new CanvasApiError(`Canvas API returned HTTP ${status}`, status)
    }

    logger.error('Canvas request failed', { instanceUrl, errorCode: code, message: err.message })
    throw new CanvasNetworkError(`Canvas request failed: ${err.message}`)
  }

  throw err
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Verify the Canvas access token by fetching the authenticated user's profile.
 * Throws CanvasTokenError on 401, CanvasNetworkError on connectivity issues.
 */
export async function verifyCanvasToken(instanceUrl: string, token: string): Promise<CanvasSelf> {
  const url = `${buildBaseUrl(instanceUrl)}/api/v1/users/self`

  logger.info('Verifying Canvas token', { instanceUrl })

  try {
    const response = await axios.get<CanvasSelf>(url, {
      headers: buildAuthHeaders(token),
      timeout: 10_000,
    })

    logger.info('Canvas token verified', { instanceUrl, canvasUserId: response.data.id })
    return response.data
  } catch (err) {
    handleAxiosError(err, instanceUrl)
  }
}

/**
 * Fetch active Canvas courses for the authenticated user.
 */
export async function fetchCanvasCourses(instanceUrl: string, token: string): Promise<CanvasCourse[]> {
  const url = `${buildBaseUrl(instanceUrl)}/api/v1/courses?enrollment_state=active&per_page=50`

  logger.info('Fetching Canvas courses', { instanceUrl })

  try {
    const response = await axios.get<CanvasCourse[]>(url, {
      headers: buildAuthHeaders(token),
      timeout: 15_000,
    })

    logger.info('Canvas courses fetched', { instanceUrl, courseCount: response.data.length })
    return response.data
  } catch (err) {
    handleAxiosError(err, instanceUrl)
  }
}

/**
 * Fetch upcoming Canvas assignments for the authenticated user.
 */
export async function fetchCanvasUpcomingAssignments(instanceUrl: string, token: string): Promise<CanvasAssignment[]> {
  const url = `${buildBaseUrl(instanceUrl)}/api/v1/users/self/upcoming_assignments`

  logger.info('Fetching Canvas upcoming assignments', { instanceUrl })

  try {
    const response = await axios.get<CanvasAssignment[]>(url, {
      headers: buildAuthHeaders(token),
      timeout: 15_000,
    })

    logger.info('Canvas assignments fetched', { instanceUrl, assignmentCount: response.data.length })
    return response.data
  } catch (err) {
    handleAxiosError(err, instanceUrl)
  }
}
