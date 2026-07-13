import OpenAI from 'openai'

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
