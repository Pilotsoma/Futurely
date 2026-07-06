import Anthropic from '@anthropic-ai/sdk'
import { logger } from '../common/logger'

// Use claude-sonnet-4-5 — a current, cost-efficient model valid in SDK 0.102.x.
// Do NOT upgrade to a newer model ID without updating this constant.
const COLLEGE_PATH_MODEL = 'claude-sonnet-4-5'

const ANTHROPIC_REQUEST_TIMEOUT_MS = 20_000

export class AnthropicServiceUnavailableError extends Error {
  constructor(cause: string) {
    super(`Anthropic service unavailable: ${cause}`)
    this.name = 'AnthropicServiceUnavailableError'
  }
}

export interface CollegePathStepInput {
  studentSat: number
  studentAct: number | null
  studentGpa: number
  collegeName: string
  avgSat: number
  avgAct: number
  avgGpa: number
  /** 0-1 decimal, e.g. 0.06 = 6% acceptance rate */
  acceptanceRate: number
}

/**
 * Calls the Anthropic Messages API and asks for 3–5 concrete, non-numeric
 * action steps the student can take to improve their admission chances at the
 * target college.
 *
 * Returns the raw text response from the model. The caller is responsible for
 * parsing and validating the JSON array within.
 *
 * The API key is read at call time so the app starts cleanly when
 * ANTHROPIC_API_KEY is not yet configured.
 *
 * Throws AnthropicServiceUnavailableError on missing key or any API failure.
 */
export async function generateCollegePathSteps(
  input: CollegePathStepInput
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new AnthropicServiceUnavailableError('ANTHROPIC_API_KEY is not configured')
  }

  const client = new Anthropic({ apiKey })

  const acceptancePct = (input.acceptanceRate * 100).toFixed(1)
  const actLine = input.studentAct !== null
    ? `ACT: ${input.studentAct} (college avg: ${input.avgAct})`
    : 'ACT: not taken'

  const prompt = `You are a college admissions expert. A high school student is targeting admission to ${input.collegeName}.

Student profile:
- SAT: ${input.studentSat} (college avg: ${input.avgSat})
- ${actLine}
- GPA: ${input.studentGpa.toFixed(2)} (college avg: ${input.avgGpa.toFixed(2)})

Target college stats:
- Name: ${input.collegeName}
- Acceptance rate: ${acceptancePct}%
- Average SAT: ${input.avgSat}
- Average ACT: ${input.avgAct}
- Average GPA: ${input.avgGpa.toFixed(2)}

Provide 3 to 5 concrete, actionable steps this specific student should take to meaningfully improve their admission chances at ${input.collegeName}. Focus exclusively on non-numeric qualitative actions: extracurriculars, leadership roles, essay strategy, recommendation letter approach, coursework rigor, research opportunities, or demonstrated interest activities. Do NOT suggest raising test scores or GPA — those are handled separately.

Tailor each step to the specific culture, values, and programs of ${input.collegeName}.

Respond with ONLY a valid JSON array — no markdown fences, no extra text — in exactly this shape:
[
  {
    "title": "Short action title (under 10 words)",
    "description": "2-3 sentence explanation of what to do and why it matters for this college specifically.",
    "impactTier": "Low" | "Medium" | "High"
  }
]`

  try {
    const message = await client.messages.create(
      {
        model: COLLEGE_PATH_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      },
      { timeout: ANTHROPIC_REQUEST_TIMEOUT_MS }
    )

    const block = message.content[0]
    if (!block || block.type !== 'text') {
      throw new AnthropicServiceUnavailableError('unexpected response shape from API')
    }

    return block.text
  } catch (err: unknown) {
    if (err instanceof AnthropicServiceUnavailableError) {
      throw err
    }

    const message = err instanceof Error ? err.message : String(err)
    logger.error('anthropic_request_failed', {
      model: COLLEGE_PATH_MODEL,
      collegeName: input.collegeName,
      error: message,
    })
    throw new AnthropicServiceUnavailableError(message)
  }
}
