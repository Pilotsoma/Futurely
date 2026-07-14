import OpenAI from 'openai'
import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions'
import { logger } from '../common/logger'

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

/**
 * Drop-in replacement for `getAiClient().chat.completions.create({ model: getAiModel(), ... })`.
 * If the configured NVIDIA model fails (newer/trendier NIM models like
 * deepseek-v4-pro are frequently capacity-overloaded on the free tier — see
 * PROVIDERS.nvidia above), automatically retries once against the
 * known-reliable llama-3.1-70b-instruct model before giving up, so a bad
 * NVIDIA_MODEL override degrades gracefully instead of failing every call.
 * OpenRouter calls are unaffected — no equivalent documented failure mode
 * to fall back from.
 *
 * Pass `retryOnFailure: false` for latency-sensitive calls that already have
 * their own fast, safe failure handling (e.g. a classifier that fails open) —
 * the retry doubles worst-case latency (up to another full timeout window),
 * which isn't worth it when the caller doesn't need the extra reliability.
 */
export async function createChatCompletion(
  params: Omit<ChatCompletionCreateParamsNonStreaming, 'model'> & { model?: string },
  options: { retryOnFailure?: boolean } = {}
): Promise<ChatCompletion> {
  const { retryOnFailure = true } = options
  const client = getAiClient()
  const { model: modelOverride, ...rest } = params
  const primaryModel = modelOverride ?? getAiModel()

  try {
    return await client.chat.completions.create({ ...rest, model: primaryModel })
  } catch (err) {
    const isNvidia = process.env.AI_PROVIDER === 'nvidia'
    if (retryOnFailure && isNvidia && primaryModel !== NVIDIA_RELIABLE_FALLBACK_MODEL) {
      logger.warn('AI call failed on configured NVIDIA model, retrying with reliable fallback', {
        errorType: err instanceof Error ? err.constructor.name : 'UnknownError',
      })
      return await client.chat.completions.create({ ...rest, model: NVIDIA_RELIABLE_FALLBACK_MODEL })
    }
    throw err
  }
}
