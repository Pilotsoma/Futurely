// prompt-version: 1.0
// last-updated: 2026-07-06
// author: ai-engineer
//
// PII policy: NO student names, emails, IDs, raw SAT scores, or raw GPA values
// may appear in the prompt. Only derived/positional fields are used.
// See COMPLIANCE.md for the full data-handling policy.

import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { logger } from '../../common/logger'
import type {
  CollegeInsightsPayload,
  CollegeInsightsPromptInput,
  GpaPosition,
  SatPosition,
} from '../../types/collegeInsights'

// ── Typed error class ─────────────────────────────────────────────────────────

/**
 * Thrown when the LLM call fails for any reason (network error, timeout, SDK
 * error, or schema validation failure).  The caller in collegeInsights.ts
 * catches this specific class and falls back to stale-cache data.
 */
export class CollegeInsightsGenerationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'CollegeInsightsGenerationError'
  }
}

// ── Zod validation schema ─────────────────────────────────────────────────────

const ActionableStepSchema = z.object({
  step: z.string().min(1, 'step must be non-empty'),
  category: z.enum(['test', 'gpa', 'essay', 'extracurricular', 'strategy']),
  priority: z.enum(['high', 'medium', 'low']),
})

const CollegeInsightsPayloadSchema = z.object({
  narrativeSummary: z.string().min(1, 'narrativeSummary must be non-empty'),
  actionableSteps: z
    .array(ActionableStepSchema)
    .min(3, 'at least 3 actionable steps required')
    .max(5, 'at most 5 actionable steps allowed'),
})

// ── Human-readable label mappings (never expose raw numbers) ──────────────────

function describeSatPosition(position: SatPosition, delta: number | null): string {
  switch (position) {
    case 'well_below_25th': {
      const gap = delta !== null ? ` (approximately ${Math.abs(Math.round(delta))} points below the 25th-percentile cutoff)` : ''
      return `well below the 25th percentile of enrolled students${gap}`
    }
    case 'below_25th':
      return 'slightly below the 25th percentile of enrolled students'
    case 'in_band':
      return 'within the middle 50% SAT range of enrolled students'
    case 'above_75th':
      return 'above the 75th percentile of enrolled students'
    case 'not_provided':
      return 'not provided'
  }
}

function describeGpaPosition(position: GpaPosition): string {
  switch (position) {
    case 'well_below_mean':
      return 'significantly below the average applicant GPA'
    case 'below_mean':
      return 'slightly below the average applicant GPA'
    case 'at_mean':
      return 'near the average applicant GPA'
    case 'above_mean':
      return 'above the average applicant GPA'
    case 'not_provided':
      return 'not provided'
  }
}

function describeLabelContext(label: string, admissionRatePct: number): string {
  switch (label) {
    case 'Likely':
      return `This is a strong match — the student's profile aligns well with ${admissionRatePct.toFixed(0)}% admission rate. The focus now is on essay quality and application polish.`
    case 'Possible':
      return `This is a competitive match — the student has a reasonable shot given the ${admissionRatePct.toFixed(0)}% admission rate, but strong essays and addressing any profile gaps will be important.`
    case 'Reach':
      return `This is a reach school — admission is challenging given the ${admissionRatePct.toFixed(0)}% admission rate, but achievable with a standout application that highlights unique strengths.`
    case 'Far Reach':
      return `This is a far reach — the ${admissionRatePct.toFixed(0)}% admission rate is very competitive, and this college should be treated as an aspirational target alongside a balanced list.`
    default:
      return `Admission rate is approximately ${admissionRatePct.toFixed(0)}%.`
  }
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are an experienced, encouraging high school college admissions counselor. Your role is to help students understand where they stand relative to a college and give them clear, actionable guidance they can act on now.

Your tone is warm, supportive, and realistic — never discouraging, but never falsely optimistic. You use plain English; no jargon, no percentages in the narrative, no raw test scores. You help students feel capable and motivated.

You must produce a JSON response using the provided tool. Follow the tool schema exactly.`
}

function buildUserPrompt(input: CollegeInsightsPromptInput): string {
  const admissionRatePct = input.admissionRate * 100
  const satSection =
    input.satPosition !== 'not_provided'
      ? `SAT position: ${describeSatPosition(input.satPosition, input.satDeltaFrom25th)}`
      : null
  const gpaSection =
    input.gpaPosition !== 'not_provided'
      ? `GPA position: ${describeGpaPosition(input.gpaPosition)}`
      : null

  const profileLines = [
    `College: ${input.collegeName}`,
    `Fit score: ${input.score}/100 (label: ${input.label})`,
    `Label context: ${describeLabelContext(input.label, admissionRatePct)}`,
    satSection,
    gpaSection,
    satSection === null ? 'SAT data: not provided — do not give SAT-specific advice' : null,
    gpaSection === null ? 'GPA data: not provided — do not give GPA-specific advice' : null,
  ]
    .filter(Boolean)
    .join('\n')

  const stepGuidance = buildStepGuidance(input)

  return `Generate college admission insights for the following student profile:

${profileLines}

Instructions for the narrative (narrativeSummary):
- Write 150–250 words.
- Explain what the fit score and label mean in plain English.
- Acknowledge any SAT or GPA positioning, but ONLY if the data was provided above.
- Be encouraging and concrete. Frame this as coaching, not judgment.
- Do NOT include raw numbers, percentages, or test scores in the narrative.

Instructions for actionable steps (actionableSteps):
- Provide exactly 3 to 5 steps.
- ${stepGuidance}
- Use the category values: test, gpa, essay, extracurricular, strategy.
- Use the priority values: high, medium, low.
- Each step should be specific and actionable, not generic platitudes.
- Do NOT include test-prep steps when SAT data is not provided.
- Do NOT include GPA-improvement steps when GPA data is not provided.`
}

function buildStepGuidance(input: CollegeInsightsPromptInput): string {
  const parts: string[] = []

  if (input.label === 'Far Reach') {
    parts.push('Include a "strategy" step about balancing this aspiration with a realistic college list.')
  }
  if (input.satPosition === 'well_below_25th' || input.satPosition === 'below_25th') {
    parts.push('Include a high-priority "test" step about SAT preparation.')
  }
  if (input.gpaPosition === 'well_below_mean' || input.gpaPosition === 'below_mean') {
    parts.push('Include a high-priority "gpa" step about academic improvement.')
  }
  if (input.label === 'Likely' || input.label === 'Possible') {
    parts.push('Emphasize "essay" and "extracurricular" steps since those become the differentiators at this fit level.')
  }

  return parts.length > 0 ? parts.join(' ') : 'Balance across essay, strategy, and any relevant academic areas.'
}

// ── Tool schema for forced tool_use ──────────────────────────────────────────

const TOOL_NAME = 'provide_college_insights' as const

const INSIGHTS_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    'Provide a narrative summary and actionable steps for a student\'s college admission profile.',
  input_schema: {
    type: 'object' as const,
    properties: {
      narrativeSummary: {
        type: 'string',
        description:
          'An encouraging 150–250 word narrative explaining the student\'s fit score and label in plain language. No raw numbers or percentages.',
      },
      actionableSteps: {
        type: 'array',
        description: 'Between 3 and 5 specific, actionable steps the student can take.',
        minItems: 3,
        maxItems: 5,
        items: {
          type: 'object',
          properties: {
            step: {
              type: 'string',
              description: 'A concise, specific action the student should take.',
            },
            category: {
              type: 'string',
              enum: ['test', 'gpa', 'essay', 'extracurricular', 'strategy'],
              description: 'The category this step falls under.',
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'The priority level of this step.',
            },
          },
          required: ['step', 'category', 'priority'],
        },
      },
    },
    required: ['narrativeSummary', 'actionableSteps'],
  },
}

// ── Lazy singleton SDK client ─────────────────────────────────────────────────

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (_client === null) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new CollegeInsightsGenerationError(
        'ANTHROPIC_API_KEY is not set — cannot call the LLM'
      )
    }
    _client = new Anthropic({ apiKey })
  }
  return _client
}

function resolveModelId(): string {
  return process.env.ANTHROPIC_MODEL_ID ?? 'claude-sonnet-4-5'
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a narrative summary and actionable steps for a student's college
 * admission profile relative to a specific institution.
 *
 * Uses Claude via the Anthropic SDK with forced tool_use to guarantee a
 * structured JSON response that is then validated with Zod before returning.
 *
 * Throws {@link CollegeInsightsGenerationError} on any LLM failure (network,
 * timeout, SDK error, or schema validation mismatch).  The caller in
 * collegeInsights.ts catches this class and falls back to stale-cache data.
 *
 * PII policy: the prompt is built entirely from derived/positional fields in
 * {@link CollegeInsightsPromptInput}.  No student name, email, ID, raw SAT
 * score, or raw GPA value enters the prompt.  Logs contain only non-PII
 * metadata (label, category counts, latency).
 */
export async function generateCollegeInsights(
  input: CollegeInsightsPromptInput
): Promise<CollegeInsightsPayload> {
  const startMs = Date.now()

  let response: Anthropic.Message
  try {
    const client = getClient()
    const model = resolveModelId()

    response = await client.messages.create({
      model,
      max_tokens: 600,
      system: buildSystemPrompt(),
      tools: [INSIGHTS_TOOL],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content: buildUserPrompt(input) }],
    })
  } catch (sdkError) {
    // Never log prompt contents — it contains student context
    logger.warn('College insights LLM call failed', {
      feature: 'collegeInsights',
      errorType: sdkError instanceof Error ? sdkError.constructor.name : 'UnknownError',
      latencyMs: Date.now() - startMs,
    })
    throw new CollegeInsightsGenerationError(
      'LLM call failed — SDK or network error',
      sdkError
    )
  }

  // ── Extract tool_use block from response ──────────────────────────────────

  const toolUseBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  )

  if (toolUseBlock === undefined) {
    logger.warn('College insights LLM returned no tool_use block', {
      feature: 'collegeInsights',
      stopReason: response.stop_reason,
      latencyMs: Date.now() - startMs,
    })
    throw new CollegeInsightsGenerationError(
      `LLM did not return a tool_use block (stop_reason: ${response.stop_reason})`
    )
  }

  // ── Validate the tool input against the Zod schema ────────────────────────

  const parseResult = CollegeInsightsPayloadSchema.safeParse(toolUseBlock.input)

  if (!parseResult.success) {
    logger.warn('College insights LLM output failed schema validation', {
      feature: 'collegeInsights',
      issues: parseResult.error.issues.map((i) => i.message),
      latencyMs: Date.now() - startMs,
    })
    throw new CollegeInsightsGenerationError(
      `LLM output failed schema validation: ${parseResult.error.issues.map((i) => i.message).join(', ')}`
    )
  }

  const payload = parseResult.data

  // Non-PII success log: only label, step count, and category distribution
  logger.info('College insights generated', {
    feature: 'collegeInsights',
    label: input.label,
    stepCount: payload.actionableSteps.length,
    categories: payload.actionableSteps.map((s) => s.category),
    latencyMs: Date.now() - startMs,
  })

  return payload
}
