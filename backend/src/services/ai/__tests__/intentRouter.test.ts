import { IntentClassificationSchema } from '../intentRouter'

jest.mock('../../../lib/aiClient', () => ({
  createChatCompletion: jest.fn(),
  getAiModel: jest.fn(() => 'test-model'),
}))

import { createChatCompletion } from '../../../lib/aiClient'
import { chatIntentRouter } from '../intentRouter'

const mockCreateChatCompletion = createChatCompletion as jest.MockedFunction<typeof createChatCompletion>

describe('IntentClassificationSchema refine constraint', () => {
  describe('invalid payloads', () => {
    it('rejects allowed:true with complexityScore:null', () => {
      expect(() =>
        IntentClassificationSchema.parse({
          allowed: true,
          intent: 'surface',
          complexityScore: null,
          category: 'basic_academics',
        }),
      ).toThrow()
    })

    it('rejects allowed:false with a non-null complexityScore', () => {
      expect(() =>
        IntentClassificationSchema.parse({
          allowed: false,
          intent: 'surface',
          complexityScore: 42,
          category: 'blocked',
        }),
      ).toThrow()
    })
  })

  describe('valid payloads', () => {
    it('accepts a valid blocked payload (allowed:false, complexityScore:null, category:blocked)', () => {
      const result = IntentClassificationSchema.parse({
        allowed: false,
        intent: 'surface',
        complexityScore: null,
        category: 'blocked',
      })
      expect(result.allowed).toBe(false)
      expect(result.complexityScore).toBeNull()
      expect(result.category).toBe('blocked')
    })

    it('accepts a valid allowed surface payload', () => {
      const result = IntentClassificationSchema.parse({
        allowed: true,
        intent: 'surface',
        complexityScore: 25,
        category: 'study_skills',
      })
      expect(result.allowed).toBe(true)
      expect(result.complexityScore).toBe(25)
    })

    it('accepts a valid off_topic blocked payload (allowed:false, complexityScore:null, category:off_topic)', () => {
      const result = IntentClassificationSchema.parse({
        allowed: false,
        intent: 'surface',
        complexityScore: null,
        category: 'off_topic',
      })
      expect(result.allowed).toBe(false)
      expect(result.complexityScore).toBeNull()
      expect(result.category).toBe('off_topic')
    })
  })
})

describe('ChatIntentRouter.analyze fail-open behavior', () => {
  beforeEach(() => jest.clearAllMocks())

  it('fails open to "personalized" for an obviously self-referential question when the classifier call throws', async () => {
    mockCreateChatCompletion.mockRejectedValueOnce(new Error('Provider timeout'))
    const result = await chatIntentRouter.analyze('What is my GPA?')
    expect(result.allowed).toBe(true)
    expect(result.intent).toBe('personalized')
  })

  it('fails open to "personalized" for "my grades" phrasing when the classifier returns malformed JSON', async () => {
    mockCreateChatCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: 'not json at all' } }],
    } as never)
    const result = await chatIntentRouter.analyze('can you check my grades real quick')
    expect(result.allowed).toBe(true)
    expect(result.intent).toBe('personalized')
  })

  it('still fails open to "surface" for an ambiguous question when the classifier call throws', async () => {
    mockCreateChatCompletion.mockRejectedValueOnce(new Error('Provider timeout'))
    const result = await chatIntentRouter.analyze('How does weighted GPA work?')
    expect(result.allowed).toBe(true)
    expect(result.intent).toBe('surface')
  })
})
