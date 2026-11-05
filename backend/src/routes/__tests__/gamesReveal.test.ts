jest.mock('../../lib/prisma', () => ({ prisma: {} }))
jest.mock('../../lib/websocket', () => ({ sendToSession: jest.fn(), sendToUser: jest.fn() }))
jest.mock('../../middleware/auth', () => ({ requireAuth: jest.fn() }))

import { isRevealed, shapeGameState } from '../games'

const base = (over = {}) => ({
  status: 'ACTIVE', currentQuestion: 1, revealedQuestion: null as number | null,
  set: { title: 't', questions: [{ id: 1, correctAnswer: 'a' }, { id: 2, correctAnswer: 'b' }] },
  ...over,
})

describe('shapeGameState', () => {
  it('never exposes correctAnswer before reveal', () => {
    const out = shapeGameState(base(), 3, 'b') as Record<string, unknown>
    expect(out.revealed).toBe(false)
    expect(out.answerCount).toBe(3)
    expect('correctAnswer' in out).toBe(false)
    expect(JSON.stringify(out)).not.toContain('correctAnswer')
  })
  it('exposes correctAnswer only for the revealed current question', () => {
    const out = shapeGameState(base({ revealedQuestion: 1 }), 2, 'b') as Record<string, unknown>
    expect(out.revealed).toBe(true)
    expect(out.correctAnswer).toBe('b')
    expect(JSON.stringify(out.set)).not.toContain('correctAnswer')
  })
  it('a stale reveal from a previous question does not count', () => {
    expect(isRevealed('ACTIVE', 2, 1)).toBe(false)
    expect(isRevealed('FINISHED', 1, 1)).toBe(false)
  })
})
