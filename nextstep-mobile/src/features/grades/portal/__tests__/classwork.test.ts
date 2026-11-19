import { describe, expect, it, jest } from '@jest/globals'

import { parseClasswork } from '../classwork'

const year = new Date().getFullYear()

function scored(score: number | null, totalPoints: number | null) {
  return { name: 'Quiz', category: 'Minor', score, totalPoints, percentage: '', dateDue: `${year}-11-05` }
}

// The e2e fixture shape: a letter is present, weights are fractions.
const fixture = {
  classes: [
    {
      name: 'AP Biology',
      period: '1',
      teacher: 'Dr. Rivera',
      room: 'Rm 214',
      average: '93.5',
      letterGrade: 'A',
      categoryWeights: { Daily: 0.4, Minor: 0.3, Major: 0.3 },
      scores: [
        { name: 'Unit Test', category: 'Major', score: 94, totalPoints: 100, percentage: '94', dateDue: `${year}-11-05` },
        { name: 'Homework Set', category: 'Daily', score: 19, totalPoints: 20, percentage: '95', dateDue: `${year}-11-09` },
      ],
    },
  ],
  availablePeriods: ['1', '2'],
  currentPeriod: '1',
}

describe('parseClasswork', () => {
  it('reads the fixture shape', () => {
    expect(parseClasswork(fixture)).toEqual({
      classes: [
        {
          name: 'AP Biology',
          teacher: 'Dr. Rivera',
          period: '1',
          grade: { label: 'A', letter: 'A', percent: '93.5' },
          weightsText: 'Daily 40% · Minor 30% · Major 30%',
          assignments: [
            { name: 'Unit Test', category: 'Major', dueText: 'Nov 5', scoreText: '94/100', tone: 'success' },
            { name: 'Homework Set', category: 'Daily', dueText: 'Nov 9', scoreText: '19/20', tone: 'success' },
          ],
        },
      ],
    })
  })

  it('derives the letter when the portal sends none (live HAC)', () => {
    const model = parseClasswork({
      classes: [{ name: 'English III', period: '2', teacher: 'Ms. Brooks', average: '88.40', scores: [] }],
    })
    expect(model?.classes[0].grade).toEqual({ label: 'B', letter: 'B', percent: '88.4' })
  })

  it('keeps a portal letter such as A- and still shows the percent', () => {
    const model = parseClasswork({ classes: [{ name: 'Art', average: '91', letterGrade: 'A-' }] })
    expect(model?.classes[0].grade).toEqual({ label: 'A-', letter: 'A', percent: '91' })
  })

  it('has no grade to show when neither a letter nor an average arrives', () => {
    const model = parseClasswork({ classes: [{ name: 'Study hall', average: null }] })
    expect(model?.classes[0].grade).toEqual({ label: null, letter: null, percent: null })
  })

  it('keeps a class with no scores array and an empty assignment list', () => {
    const model = parseClasswork({ classes: [{ name: 'Choir' }] })
    expect(model?.classes[0]).toEqual({
      name: 'Choir',
      teacher: null,
      period: null,
      grade: { label: null, letter: null, percent: null },
      weightsText: null,
      assignments: [],
    })
  })

  it('keeps the portal order of classes and assignments', () => {
    const model = parseClasswork({
      classes: [
        { name: 'Zoology', scores: [{ name: 'B' }, { name: 'A' }] },
        { name: 'Art' },
      ],
    })
    expect(model?.classes.map((item) => item.name)).toEqual(['Zoology', 'Art'])
    expect(model?.classes[0].assignments.map((item) => item.name)).toEqual(['B', 'A'])
  })

  describe('weights', () => {
    const weights = (value: unknown) => parseClasswork({ classes: [{ name: 'X', categoryWeights: value }] })?.classes[0].weightsText

    it('treats values at or below 1 as fractions and larger values as percents', () => {
      expect(weights({ Daily: 0.4, Major: 0.6 })).toBe('Daily 40% · Major 60%')
      expect(weights({ Daily: 40, Major: 60 })).toBe('Daily 40% · Major 60%')
      expect(weights({ Tests: 1 })).toBe('Tests 100%')
    })

    it('rounds float noise away and keeps one decimal', () => {
      expect(weights({ A: 0.35, B: 0.375, C: 0.1 + 0.2 })).toBe('A 35% · B 37.5% · C 30%')
    })

    it('reads numeric strings', () => {
      expect(weights({ Daily: '40%', Major: '0.6' })).toBe('Daily 40% · Major 60%')
    })

    it('is null for anything that is not a record of numbers', () => {
      expect(weights(undefined)).toBeNull()
      expect(weights(null)).toBeNull()
      expect(weights('Daily 40%')).toBeNull()
      expect(weights([0.4, 0.6])).toBeNull()
      expect(weights({})).toBeNull()
      expect(weights({ Daily: 0.4, Major: 'most' })).toBeNull()
      expect(weights({ Daily: -1 })).toBeNull()
      expect(weights({ ' ': 0.4 })).toBeNull()
    })
  })

  describe('assignments', () => {
    const only = (score: number | null, total: number | null) =>
      parseClasswork({ classes: [{ name: 'X', scores: [scored(score, total)] }] })?.classes[0].assignments[0]

    it('formats the score and picks the tone from score over total', () => {
      expect(only(94, 100)).toMatchObject({ scoreText: '94/100', tone: 'success' })
      expect(only(18, 20)).toMatchObject({ scoreText: '18/20', tone: 'success' })
      expect(only(17.5, 25)).toMatchObject({ scoreText: '17.5/25', tone: 'neutral' })
    })

    it('has exact tone boundaries at 90, 70 and 60 percent', () => {
      expect(only(90, 100)?.tone).toBe('success')
      expect(only(89.9, 100)?.tone).toBe('neutral')
      expect(only(70, 100)?.tone).toBe('neutral')
      expect(only(69.9, 100)?.tone).toBe('warning')
      expect(only(60, 100)?.tone).toBe('warning')
      expect(only(59.9, 100)?.tone).toBe('error')
      expect(only(0, 100)).toMatchObject({ scoreText: '0/100', tone: 'error' })
    })

    it('does not trust the percentage field', () => {
      const item = parseClasswork({
        classes: [{ name: 'X', scores: [{ name: 'Quiz', score: 10, totalPoints: 100, percentage: '99' }] }],
      })?.classes[0].assignments[0]
      expect(item?.tone).toBe('error')
    })

    it('shows only the score when there is no usable total, with a neutral tone', () => {
      expect(only(94, null)).toMatchObject({ scoreText: '94', tone: 'neutral' })
      expect(only(5, 0)).toMatchObject({ scoreText: '5', tone: 'neutral' })
    })

    it('has no score text for an ungraded assignment', () => {
      expect(only(null, 25)).toMatchObject({ scoreText: null, tone: 'neutral' })
    })

    it('reads numeric strings and ignores other text scores', () => {
      const model = parseClasswork({
        classes: [
          {
            name: 'X',
            scores: [
              { name: 'One', score: '9', totalPoints: '10' },
              { name: 'Two', score: 'Exempt', totalPoints: '10' },
            ],
          },
        ],
      })
      expect(model?.classes[0].assignments.map((item) => [item.scoreText, item.tone])).toEqual([
        ['9/10', 'success'],
        [null, 'neutral'],
      ])
    })

    it('formats due dates and falls back to the raw text, or nothing', () => {
      const model = parseClasswork({
        classes: [
          {
            name: 'X',
            scores: [
              { name: 'A', dateDue: '11/05/2019' },
              { name: 'B', dateDue: 'Next Friday' },
              { name: 'C', dateDue: '' },
              { name: 'D' },
            ],
          },
        ],
      })
      expect(model?.classes[0].assignments.map((item) => item.dueText)).toEqual(['Nov 5, 2019', 'Next Friday', null, null])
    })

    it('drops assignments with no name', () => {
      const model = parseClasswork({ classes: [{ name: 'X', scores: [scored(1, 2), { score: 5 }, null, 'text', { name: '  ' }] }] })
      expect(model?.classes[0].assignments).toHaveLength(1)
    })
  })

  it('drops classes with no name and returns null when none has one', () => {
    expect(parseClasswork({ classes: [{ name: 'Art' }, { average: '90' }, null, 'x'] })?.classes).toHaveLength(1)
    expect(parseClasswork({ classes: [{ average: '90' }, 42] })).toBeNull()
  })

  it('gives a model with no classes for an empty list, so the screen shows its empty state', () => {
    expect(parseClasswork({ classes: [], availablePeriods: [], currentPeriod: '' })).toEqual({ classes: [] })
  })

  it('returns null for payloads that are not classwork', () => {
    expect(parseClasswork(null)).toBeNull()
    expect(parseClasswork(undefined)).toBeNull()
    expect(parseClasswork({})).toBeNull()
    expect(parseClasswork([])).toBeNull()
    expect(parseClasswork('classes')).toBeNull()
    expect(parseClasswork({ classes: 'none' })).toBeNull()
    expect(parseClasswork({ note: 'Classwork is not posted' })).toBeNull()
  })

  it('does not throw on fields of the wrong type', () => {
    const model = parseClasswork({
      classes: [
        {
          name: 'Math',
          teacher: { first: 'A' },
          period: ['1'],
          average: { value: 90 },
          letterGrade: 7,
          categoryWeights: 'x',
          scores: 'none',
        },
      ],
    })
    expect(model?.classes[0]).toMatchObject({ name: 'Math', teacher: null, period: null, weightsText: null, assignments: [] })
  })

  it('never logs the payload', () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) => jest.spyOn(console, method))
    parseClasswork(fixture)
    parseClasswork({ classes: 'bad' })
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    }
  })
})
