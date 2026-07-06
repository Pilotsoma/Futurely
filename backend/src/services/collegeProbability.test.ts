/**
 * Unit tests for backend/src/services/collegeProbability.ts
 *
 * Tests tier-mapping boundary conditions and ModelServiceUnavailableError
 * wrapping without a real model server — axios is mocked throughout.
 *
 * EXECUTION STATUS: CANNOT RUN — jest is not installed in backend/.
 * Install jest + ts-jest + supertest before claiming these pass.
 * See ENGINEERING_RULES.md and the QA verdict in the feature handoff.
 */

import axios from 'axios'

// Mock axios BEFORE importing the module under test so the module picks up
// the mock when it imports axios at module load time.
jest.mock('axios')
const mockedAxios = jest.mocked(axios)

import {
  predictAdmission,
  ModelServiceUnavailableError,
  type PredictAdmissionInput,
} from './collegeProbability'

// ---------------------------------------------------------------------------
// Shared fixture — a typical mid-selectivity college
// ---------------------------------------------------------------------------

const SAMPLE_COLLEGE: PredictAdmissionInput['college'] = {
  name: 'State University',
  avgSat: 1200,
  avgAct: 26,
  avgGpa: 3.4,
  acceptanceRate: 0.55,
}

function makeInput(overrides: Partial<PredictAdmissionInput> = {}): PredictAdmissionInput {
  return {
    studentSat: 1250,
    studentAct: 28,
    studentGpa: 3.6,
    college: SAMPLE_COLLEGE,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tier mapping — boundary values
// ---------------------------------------------------------------------------

describe('computeTier boundary conditions', () => {
  beforeEach(() => jest.resetAllMocks())

  it('returns Safety when probability is above 70 (e.g. 70.1)', async () => {
    ;(mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { probability: 70.1 },
    })
    const result = await predictAdmission(makeInput())
    expect(result.tier).toBe('Safety')
  })

  it('returns Target when probability is exactly 70', async () => {
    // Boundary: >70 is Safety, so exactly 70 falls into Target (>=30)
    ;(mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { probability: 70 },
    })
    const result = await predictAdmission(makeInput())
    expect(result.tier).toBe('Target')
  })

  it('returns Target when probability is exactly 30', async () => {
    // Boundary: >=30 is Target, so exactly 30 is still Target
    ;(mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { probability: 30 },
    })
    const result = await predictAdmission(makeInput())
    expect(result.tier).toBe('Target')
  })

  it('returns Reach when probability is below 30 (e.g. 29.9)', async () => {
    ;(mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { probability: 29.9 },
    })
    const result = await predictAdmission(makeInput())
    expect(result.tier).toBe('Reach')
  })

  it('returns Reach when probability is 0 (extreme low)', async () => {
    ;(mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { probability: 0 },
    })
    const result = await predictAdmission(makeInput())
    expect(result.tier).toBe('Reach')
  })

  it('returns Safety when probability is 100 (extreme high)', async () => {
    ;(mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { probability: 100 },
    })
    const result = await predictAdmission(makeInput())
    expect(result.tier).toBe('Safety')
  })
})

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

describe('predictAdmission response shape', () => {
  beforeEach(() => jest.resetAllMocks())

  it('returns collegeName, probability, and tier', async () => {
    ;(mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { probability: 55 },
    })
    const result = await predictAdmission(makeInput())
    expect(result).toMatchObject({
      collegeName: 'State University',
      probability: 55,
      tier: 'Target',
    })
  })

  it('passes studentAct=null to axios without crashing', async () => {
    ;(mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { probability: 42 },
    })
    await expect(predictAdmission(makeInput({ studentAct: null }))).resolves.toBeDefined()

    const callBody = (mockedAxios.post as jest.Mock).mock.calls[0][1]
    expect(callBody.studentAct).toBeNull()
  })

  it('never sends the college name in the request body', async () => {
    // FERPA: the model server should receive only numeric score fields,
    // never free-text data that could identify a student or institution.
    ;(mockedAxios.post as jest.Mock).mockResolvedValueOnce({
      data: { probability: 50 },
    })
    await predictAdmission(makeInput())
    const callBody = (mockedAxios.post as jest.Mock).mock.calls[0][1]
    // college name is used only for the response label, never sent upstream
    expect(callBody).not.toHaveProperty('collegeName')
    expect(callBody).not.toHaveProperty('name')
  })
})

// ---------------------------------------------------------------------------
// Error handling — ModelServiceUnavailableError
// ---------------------------------------------------------------------------

describe('ModelServiceUnavailableError wrapping', () => {
  beforeEach(() => jest.resetAllMocks())

  it('throws ModelServiceUnavailableError on ECONNREFUSED', async () => {
    const err = Object.assign(new Error('connect ECONNREFUSED'), {
      isAxiosError: true,
      code: 'ECONNREFUSED',
      response: undefined,
    })
    ;(mockedAxios.post as jest.Mock).mockRejectedValueOnce(err)

    await expect(predictAdmission(makeInput())).rejects.toThrow(ModelServiceUnavailableError)
  })

  it('throws ModelServiceUnavailableError on ECONNABORTED (timeout)', async () => {
    const err = Object.assign(new Error('timeout of 5000ms exceeded'), {
      isAxiosError: true,
      code: 'ECONNABORTED',
      response: undefined,
    })
    ;(mockedAxios.post as jest.Mock).mockRejectedValueOnce(err)

    await expect(predictAdmission(makeInput())).rejects.toThrow(ModelServiceUnavailableError)
  })

  it('throws ModelServiceUnavailableError on non-2xx HTTP status (e.g. 500)', async () => {
    const err = Object.assign(new Error('Request failed with status code 500'), {
      isAxiosError: true,
      code: undefined,
      response: { status: 500, data: {} },
    })
    ;(mockedAxios.post as jest.Mock).mockRejectedValueOnce(err)

    await expect(predictAdmission(makeInput())).rejects.toThrow(ModelServiceUnavailableError)
  })

  it('wraps a non-axios error as ModelServiceUnavailableError too', async () => {
    ;(mockedAxios.post as jest.Mock).mockRejectedValueOnce(new Error('unexpected internal error'))

    await expect(predictAdmission(makeInput())).rejects.toThrow(ModelServiceUnavailableError)
  })

  it('does not allow a raw axios error to escape unwrapped', async () => {
    const err = Object.assign(new Error('raw axios error'), { isAxiosError: true })
    ;(mockedAxios.post as jest.Mock).mockRejectedValueOnce(err)

    const thrownError = await predictAdmission(makeInput()).catch((e: unknown) => e)
    expect(thrownError).toBeInstanceOf(ModelServiceUnavailableError)
    expect(thrownError).not.toBeInstanceOf(Error && !ModelServiceUnavailableError)
  })
})
