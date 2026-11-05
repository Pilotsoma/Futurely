import { emptyProgress, markCard, shuffle, summarizeProgress } from '../flashcards'

describe('flashcard progress', () => {
  it('counts known and learning cards and reports remaining', () => {
    let p = markCard(emptyProgress, 1, 'known')
    p = markCard(p, 2, 'learning')
    expect(summarizeProgress(p, 5)).toEqual({ known: 1, learning: 1, remaining: 3, done: false })
  })

  it('moves a card between buckets instead of double counting', () => {
    let p = markCard(emptyProgress, 1, 'learning')
    p = markCard(p, 1, 'known')
    p = markCard(p, 1, 'known')
    expect(p).toEqual({ known: [1], learning: [] })
  })

  it('is done once every card is marked, and never for an empty deck', () => {
    const p = markCard(markCard(emptyProgress, 1, 'known'), 2, 'learning')
    expect(summarizeProgress(p, 2).done).toBe(true)
    expect(summarizeProgress(emptyProgress, 0).done).toBe(false)
  })

  it('shuffle keeps all items and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5]
    const out = shuffle(input, () => 0.3)
    expect([...out].sort()).toEqual(input)
    expect(input).toEqual([1, 2, 3, 4, 5])
  })
})
