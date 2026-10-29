import { buildChatParams, clearContext, registerContext } from './aiContextState'

describe('aiContextState', () => {
  it('registers a trimmed entry, null when empty', () => {
    expect(registerContext(' Chem ', ' Explain ')).toEqual({ label: 'Chem', prompt: 'Explain' })
    expect(registerContext('', ' ')).toBeNull()
  })
  it('clears only the owning entry', () => {
    const a = registerContext('A', 'a')
    const b = registerContext('B', 'b')
    expect(clearContext(a, a)).toBeNull()
    expect(clearContext(b, a)).toBe(b)
  })
  it('builds nav params with fresh requestId', () => {
    const a = registerContext('A', 'do a')
    expect(buildChatParams(a, 5)).toEqual({ initialPrompt: 'do a', requestId: 5 })
    expect(buildChatParams(null, 6)).toEqual({ requestId: 6 })
  })
})
