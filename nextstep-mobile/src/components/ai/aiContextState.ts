export type AIContextEntry = { label: string; prompt: string }
export type AIChatParams = { initialPrompt?: string; requestId: number }

export function registerContext(label: string, prompt: string): AIContextEntry | null {
  const l = label.trim()
  const p = prompt.trim()
  return l || p ? { label: l, prompt: p } : null
}

/** Clear only if the entry being cleared is still the active one (avoids blur/focus races). */
export function clearContext(
  current: AIContextEntry | null,
  owner: AIContextEntry | null,
): AIContextEntry | null {
  return current === owner ? null : current
}

export function buildChatParams(ctx: AIContextEntry | null, requestId: number): AIChatParams {
  return ctx?.prompt ? { initialPrompt: ctx.prompt, requestId } : { requestId }
}
