import axios, { AxiosError } from 'axios'
import { logger } from '../common/logger'

// Default to localhost:8001 if MODEL_SERVER_URL is unset — see backend/.env.example
const MODEL_SERVER_URL = process.env.MODEL_SERVER_URL ?? 'http://localhost:8001'

const MODEL_REQUEST_TIMEOUT_MS = 5_000

export type AdmissionTier = 'Reach' | 'Target' | 'Safety'

export interface PredictAdmissionInput {
  studentSat: number
  studentAct: number | null
  studentGpa: number
  college: {
    name: string
    avgSat: number
    avgAct: number
    avgGpa: number
    /** 0-1 decimal (e.g. 0.06 = 6%) — never convert to percentage before sending */
    acceptanceRate: number
  }
}

export interface AdmissionPrediction {
  collegeName: string
  /** 0-100 as returned by the model server */
  probability: number
  tier: AdmissionTier
}

interface ModelServerResponse {
  probability: number
}

export class ModelServiceUnavailableError extends Error {
  constructor(cause: string) {
    super(`Model service unavailable: ${cause}`)
    this.name = 'ModelServiceUnavailableError'
  }
}

function computeTier(probability: number): AdmissionTier {
  if (probability > 70) return 'Safety'
  if (probability >= 30) return 'Target'
  return 'Reach'
}

export async function predictAdmission(input: PredictAdmissionInput): Promise<AdmissionPrediction> {
  const { studentSat, studentAct, studentGpa, college } = input

  const requestBody = {
    studentSat,
    studentAct: studentAct ?? null,
    studentGpa,
    avgSat: college.avgSat,
    avgAct: college.avgAct,
    avgGpa: college.avgGpa,
    acceptanceRate: college.acceptanceRate,
  }

  let probability: number
  try {
    const response = await axios.post<ModelServerResponse>(
      `${MODEL_SERVER_URL}/predict`,
      requestBody,
      { timeout: MODEL_REQUEST_TIMEOUT_MS }
    )
    probability = response.data.probability
  } catch (err: unknown) {
    const axiosErr = err as AxiosError
    if (axiosErr.isAxiosError) {
      const status = axiosErr.response?.status
      const cause = axiosErr.code === 'ECONNABORTED'
        ? 'request timed out'
        : axiosErr.code === 'ECONNREFUSED'
          ? 'connection refused'
          : status !== undefined
            ? `model server returned HTTP ${status}`
            : axiosErr.message
      logger.error('model_server_request_failed', {
        cause,
        code: axiosErr.code,
        status,
        collegeName: college.name,
      })
      throw new ModelServiceUnavailableError(cause)
    }
    // Non-axios error — unexpected, still wrap it
    const message = err instanceof Error ? err.message : String(err)
    logger.error('model_server_unexpected_error', { message, collegeName: college.name })
    throw new ModelServiceUnavailableError(message)
  }

  return {
    collegeName: college.name,
    probability,
    tier: computeTier(probability),
  }
}

// ── predictBatch ──────────────────────────────────────────────────────────────

export type AdjustableField = 'studentSat' | 'studentAct' | 'studentGpa'

export interface BatchAdjustment {
  field: AdjustableField
  newValue: number
}

export interface PredictBatchInput {
  studentSat: number
  studentAct: number | null
  studentGpa: number
  avgSat: number
  avgAct: number
  avgGpa: number
  /** 0-1 decimal (e.g. 0.06 = 6%) */
  acceptanceRate: number
  adjustments: BatchAdjustment[]
}

export interface BatchAdjustmentResult {
  field: AdjustableField
  newValue: number
  probability: number
}

export interface PredictBatchOutput {
  /** Baseline probability (0-100) without any adjustments */
  baseline: number
  results: BatchAdjustmentResult[]
}

interface ModelBatchServerResponse {
  baseline: number
  results: Array<{ field: AdjustableField; newValue: number; probability: number }>
}

/**
 * Calls POST {MODEL_SERVER_URL}/predict-batch with a set of hypothetical
 * stat adjustments and returns the baseline probability plus per-adjustment
 * probabilities (all 0-100 scale).
 *
 * Throws ModelServiceUnavailableError on any network or server failure.
 */
export async function predictBatch(input: PredictBatchInput): Promise<PredictBatchOutput> {
  const requestBody = {
    studentSat: input.studentSat,
    studentAct: input.studentAct,
    studentGpa: input.studentGpa,
    avgSat: input.avgSat,
    avgAct: input.avgAct,
    avgGpa: input.avgGpa,
    acceptanceRate: input.acceptanceRate,
    adjustments: input.adjustments,
  }

  try {
    const response = await axios.post<ModelBatchServerResponse>(
      `${MODEL_SERVER_URL}/predict-batch`,
      requestBody,
      { timeout: MODEL_REQUEST_TIMEOUT_MS }
    )
    return {
      baseline: response.data.baseline,
      results: response.data.results,
    }
  } catch (err: unknown) {
    const axiosErr = err as AxiosError
    if (axiosErr.isAxiosError) {
      const status = axiosErr.response?.status
      const cause = axiosErr.code === 'ECONNABORTED'
        ? 'request timed out'
        : axiosErr.code === 'ECONNREFUSED'
          ? 'connection refused'
          : status !== undefined
            ? `model server returned HTTP ${status}`
            : axiosErr.message
      logger.error('model_server_batch_request_failed', {
        cause,
        code: axiosErr.code,
        status,
        adjustmentCount: input.adjustments.length,
      })
      throw new ModelServiceUnavailableError(cause)
    }
    const message = err instanceof Error ? err.message : String(err)
    logger.error('model_server_batch_unexpected_error', {
      message,
      adjustmentCount: input.adjustments.length,
    })
    throw new ModelServiceUnavailableError(message)
  }
}

// Re-export computeTier so downstream services can apply the same tier thresholds
// without duplicating the logic.
export { computeTier }
