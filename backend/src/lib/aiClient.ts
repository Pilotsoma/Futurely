import OpenAI from 'openai'
import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions'
import { logger } from '../common/logger'
import { shouldSkipPrimaryModel, markFallbackUsed } from './aiRequestContext'

// Provider-agnostic LLM client. Switch providers for local testing via
// AI_PROVIDER=openrouter|nvidia — defaults to openrouter (production).
interface ProviderConfig {
  baseURL: string
  apiKeyEnv: string
  modelEnv: string
  defaultModel: string
}

const PROVIDERS: Record<'openrouter' | 'nvidia', ProviderConfig> = {
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    modelEnv: 'AI_MODEL',
    defaultModel: 'openrouter/free',
  },
  nvidia: {
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKeyEnv: 'NVIDIA_API_KEY',
    modelEnv: 'NVIDIA_MODEL',
    // deepseek-v4-pro (and other newer/trendier NIM models) are frequently
    // capacity-overloaded on the free tier; llama-3.1-70b-instruct has
    // reliably stayed available while still producing good instruction
    // following and tutoring-quality output.
    defaultModel: 'meta/llama-3.1-70b-instruct',
  },
}

function activeProvider(): ProviderConfig {
  const name = process.env.AI_PROVIDER === 'nvidia' ? 'nvidia' : 'openrouter'
  return PROVIDERS[name]
}

export function getAiClient(): OpenAI {
  const provider = activeProvider()
  const apiKey = process.env[provider.apiKeyEnv]
  if (!apiKey) {
    throw new Error(`${provider.apiKeyEnv} is not set — cannot call the LLM`)
  }
  // Without a timeout the SDK defaults to 10 minutes — a slow/degraded provider
  // would hang the request well past any client-side fetch timeout, surfacing
  // as an aborted/reset connection instead of a clean error. maxRetries: 0 keeps
  // the worst case at one timeout window, not a multiple of it.
  return new OpenAI({ apiKey, baseURL: provider.baseURL, timeout: 30000, maxRetries: 0 })
}

export function getAiModel(): string {
  const provider = activeProvider()
  return process.env[provider.modelEnv] ?? provider.defaultModel
}

const NVIDIA_RELIABLE_FALLBACK_MODEL = PROVIDERS.nvidia.defaultModel // meta/llama-3.1-70b-instruct

// When a fallback model is available, don't make the caller wait the full
// 30s client timeout to find out the primary is down — every observed
// failure has hung for the entire window rather than erroring quickly, so a
// shorter fail-fast timeout on just the primary attempt gets us to the
// (already-fast, ~10-15s) fallback sooner without giving up on the primary
// model as the first choice.
const PRIMARY_FAIL_FAST_TIMEOUT_MS = 18000

// ── Circuit breaker for the configured NVIDIA model ────────────────────────
//
// Once the primary model fails, skip straight to the reliable fallback for a
// cooldown window instead of eating another timeout on every subsequent call
// — e.g. deepseek-v4-pro being capacity-overloaded doesn't clear up between
// one request and the next a few seconds later.
//
// NOTE: this is in-memory, scoped to a single warm serverless instance (this
// backend runs as a Vercel function, not a persistent server) — it resets on
// cold start and isn't shared across concurrently-running instances. Still a
// meaningful win in practice since Vercel reuses a warm instance across
// requests that land close together in time (e.g. the messages in one chat
// conversation). A fully consistent version would need a shared store
// (Redis/DB row) — not worth that infra for this stage.
const CIRCUIT_COOLDOWN_MS = 3 * 60 * 1000 // 3 minutes
let circuitOpenUntil = 0

function isCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil
}

/**
 * Drop-in replacement for `getAiClient().chat.completions.create({ model: getAiModel(), ... })`.
 * If the configured NVIDIA model fails (newer/trendier NIM models like
 * deepseek-v4-pro are frequently capacity-overloaded on the free tier — see
 * PROVIDERS.nvidia above), automatically falls back to the known-reliable
 * llama-3.1-70b-instruct model, and remembers the failure for a cooldown
 * window so subsequent calls skip the bad model entirely rather than paying
 * for another timeout first. OpenRouter calls are unaffected — no equivalent
 * documented failure mode to fall back from.
 *
 * Also honors a per-request "skip the primary model" signal (see
 * aiRequestContext.ts) — set when the client itself already saw a fallback
 * happen earlier in the browser session and asked to skip straight to the
 * reliable model for the rest of that session, regardless of the shared
 * circuit breaker's state.
 *
 * Pass `retryOnFailure: false` for latency-sensitive calls that already have
 * their own fast, safe failure handling (e.g. a classifier that fails open) —
 * such a call still benefits from an already-open circuit (skips the bad
 * model preemptively) and still contributes to opening the circuit on
 * failure, it just won't itself retry-in-place after a fresh failure.
 */
export async function createChatCompletion(
  params: Omit<ChatCompletionCreateParamsNonStreaming, 'model'> & { model?: string },
  options: { retryOnFailure?: boolean } = {}
): Promise<ChatCompletion> {
  const { retryOnFailure = true } = options
  const client = getAiClient()
  const { model: modelOverride, ...rest } = params
  const primaryModel = modelOverride ?? getAiModel()
  const isNvidia = process.env.AI_PROVIDER === 'nvidia'
  const hasFallback = isNvidia && primaryModel !== NVIDIA_RELIABLE_FALLBACK_MODEL

  if (hasFallback && (isCircuitOpen() || shouldSkipPrimaryModel())) {
    markFallbackUsed()
    return await client.chat.completions.create({ ...rest, model: NVIDIA_RELIABLE_FALLBACK_MODEL })
  }

  try {
    const primaryOptions = hasFallback ? { timeout: PRIMARY_FAIL_FAST_TIMEOUT_MS } : undefined
    const result = await client.chat.completions.create({ ...rest, model: primaryModel }, primaryOptions)
    if (hasFallback) circuitOpenUntil = 0 // primary recovered — close the circuit
    return result
  } catch (err) {
    if (hasFallback) {
      circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS
      markFallbackUsed()
      logger.warn('AI call failed on configured NVIDIA model, opening circuit breaker', {
        errorType: err instanceof Error ? err.constructor.name : 'UnknownError',
        retrying: retryOnFailure,
        cooldownMs: CIRCUIT_COOLDOWN_MS,
      })
      if (retryOnFailure) {
        return await client.chat.completions.create({ ...rest, model: NVIDIA_RELIABLE_FALLBACK_MODEL })
      }
    }
    throw err
  }
}
