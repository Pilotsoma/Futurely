import { describe, expect, it } from '@jest/globals'

import { parseProgressReport } from '../progressReport'

const year = new Date().getFullYear()

// The e2e / backend demo shape.
const demo = {
  availableDates: [`11/06/${year}`, `10/09/${year}`],
  currentDate: `11/06/${year}`,
  courses: [
    { name: 'AP Biology', period: '1', average: '93.5', letterGrade: 'A', teacher: 'Dr. Rivera' },
    { name: 'English III', period: '2', average: '88', letterGrade: 'B', teacher: 'Ms. Brooks' },
  ],
}

describe('parseProgressReport', () => {
  it('reads the demo shape', () => {
    expect(parseProgressReport(demo)).toEqual({
      asOf: 'Nov 6',
      courses: [
        {
          name: 'AP Biology',
          subtitle: 'Dr. Rivera · Period 1',
          grade: { label: 'A', letter: 'A', percent: '93.5' },
          rawAverage: null,
        },
        {
          name: 'English III',
          subtitle: 'Ms. Brooks · Period 2',
          grade: { label: 'B', letter: 'B', percent: '88' },
          rawAverage: null,
        },
      ],
    })
  })

  it('derives the letter when live HAC puts the same cell in both fields (strategy 1)', () => {
    const model = parseProgressReport({
      currentDate: '2019-03-14',
      courses: [{ name: 'Biology', period: '1', average: '93', letterGrade: '93', teacher: 'R' }],
    })
    expect(model?.asOf).toBe('Mar 14, 2019')
    expect(model?.courses[0].grade).toEqual({ label: 'A', letter: 'A', percent: '93' })
    expect(model?.courses[0].rawAverage).toBeNull()
  })

  it('derives the letter when live HAC sends an empty letterGrade (strategy 2)', () => {
    const model = parseProgressReport({ courses: [{ name: 'Biology', average: '81.2', letterGrade: '' }] })
    expect(model?.asOf).toBeNull()
    expect(model?.courses[0]).toEqual({
      name: 'Biology',
      subtitle: null,
      grade: { label: 'B', letter: 'B', percent: '81.2' },
      rawAverage: null,
    })
  })

  it('keeps a code such as EX as plain text instead of a percent', () => {
    const course = parseProgressReport({ courses: [{ name: 'Choir', average: 'EX', letterGrade: '' }] })?.courses[0]
    expect(course?.rawAverage).toBe('EX')
    expect(course?.grade).toEqual({ label: null, letter: null, percent: null })
  })

  it('reads a letter sent only in the average cell', () => {
    const course = parseProgressReport({ courses: [{ name: 'Art', average: 'B+', letterGrade: '' }] })?.courses[0]
    expect(course?.grade).toEqual({ label: 'B+', letter: 'B', percent: null })
    expect(course?.rawAverage).toBeNull()
  })

  it('ignores an over-long non-numeric average', () => {
    const course = parseProgressReport({ courses: [{ name: 'Art', average: 'Not yet graded by teacher', letterGrade: '' }] })?.courses[0]
    expect(course?.rawAverage).toBeNull()
  })

  it('treats numbers sent as numbers like numeric strings', () => {
    const course = parseProgressReport({ courses: [{ name: 'Art', average: 90, letterGrade: 'A', period: 4 }] })?.courses[0]
    expect(course?.grade).toEqual({ label: 'A', letter: 'A', percent: '90' })
    expect(course?.subtitle).toBe('Period 4')
  })

  it('falls back to the raw date text when it is not a date', () => {
    expect(parseProgressReport({ currentDate: 'Latest', courses: [{ name: 'A' }] })?.asOf).toBe('Latest')
  })

  it('drops rows without a name and tolerates wrong types', () => {
    const model = parseProgressReport({ courses: [{ average: '90' }, null, 3, 'x', { name: 'Real', average: {}, letterGrade: [], teacher: 9 }] })
    expect(model?.courses).toEqual([
      { name: 'Real', subtitle: '9', grade: { label: null, letter: null, percent: null }, rawAverage: null },
    ])
  })

  it('gives an empty model for an empty course list, keeping the report date', () => {
    expect(parseProgressReport({ courses: [] })).toEqual({ asOf: null, courses: [] })
    expect(
      parseProgressReport({ availableDates: ['11/06/' + year], currentDate: '11/06/' + year, courses: [] }),
    ).toEqual({ asOf: 'Nov 6', courses: [] })
  })

  it('still falls back when the course list has entries but none has a name', () => {
    expect(parseProgressReport({ courses: [null, { average: '90' }] })).toBeNull()
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty object', {}],
    ['empty array', []],
    ['a string', 'report'],
    ['an unrelated object', { foo: 'bar' }],
    ['rows with no names', { courses: [{ average: '90' }] }],
    ['courses that is an object', { courses: { name: 'A' } }],
    ['a bare array of courses', [{ name: 'A' }]],
  ])('returns null for %s', (_name, payload) => {
    expect(parseProgressReport(payload)).toBeNull()
  })
})
