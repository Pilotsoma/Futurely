import { describe, expect, it, jest } from '@jest/globals'

import { parseSchedule } from '../schedule'

// The e2e / backend demo shape: capitalised keys.
const demo = {
  schedule: [
    { Period: '2', Course: 'English III', Teacher: 'Ms. Brooks', Room: 'Rm 108', Days: 'A Day', Semester: 'Full Year' },
    { Period: '1', Course: 'AP Biology', Teacher: 'Dr. Rivera', Room: 'Rm 214', Days: 'A Day', Semester: 'Full Year' },
    { Period: '10', Course: 'Study Hall', Teacher: 'Mr. Lee', Room: 'Library', Days: 'A Day', Semester: 'Full Year' },
  ],
}

describe('parseSchedule', () => {
  it('reads the demo shape, sorts by numeric period and drops a repeated term', () => {
    expect(parseSchedule(demo)).toEqual({
      rows: [
        { period: '1', course: 'AP Biology', subtitle: 'Dr. Rivera · A Day', room: 'Rm 214' },
        { period: '2', course: 'English III', subtitle: 'Ms. Brooks · A Day', room: 'Rm 108' },
        { period: '10', course: 'Study Hall', subtitle: 'Mr. Lee · A Day', room: 'Library' },
      ],
    })
  })

  it('reads the live HAC strategy 1 shape (course code plus course name)', () => {
    const model = parseSchedule({
      schedule: [
        { courseCode: 'BIO4001', courseName: 'AP Biology', period: '1', teacher: 'Rivera, M', room: '214' },
        { courseCode: 'ENG3001', courseName: 'English III', period: '2', teacher: 'Brooks, L', room: '108' },
      ],
    })
    expect(model?.rows).toEqual([
      { period: '1', course: 'AP Biology', subtitle: 'Rivera, M', room: '214' },
      { period: '2', course: 'English III', subtitle: 'Brooks, L', room: '108' },
    ])
  })

  it('reads district-specific headers with odd casing and punctuation', () => {
    const model = parseSchedule({
      schedule: [{ 'Course Description': 'World History', PD: '3', 'Teacher Name': 'Mr. Chen', 'Room Number': '121', Term: 'Fall' }],
    })
    expect(model?.rows).toEqual([{ period: '3', course: 'World History', subtitle: 'Mr. Chen', room: '121' }])
  })

  it('accepts a bare array as the payload', () => {
    expect(parseSchedule([{ course: 'Art I', period: 'A' }])?.rows).toEqual([
      { period: 'A', course: 'Art I', subtitle: null, room: null },
    ])
  })

  it('shows the term only when rows differ in term', () => {
    const model = parseSchedule({
      schedule: [
        { period: '1', course: 'Biology', semester: 'Fall' },
        { period: '1', course: 'Chemistry', semester: 'Spring' },
        { period: '2', course: 'English' },
      ],
    })
    expect(model?.rows.map((row) => row.subtitle)).toEqual(['Fall', 'Spring', null])
  })

  it('collapses exact duplicates but keeps rows that differ in any field', () => {
    const row = { period: '1', course: 'Biology', teacher: 'A', room: '1', days: 'A', semester: 'x' }
    expect(parseSchedule({ schedule: [row, { ...row }] })?.rows).toHaveLength(1)
    expect(parseSchedule({ schedule: [row, { ...row, room: '2' }] })?.rows).toHaveLength(2)
  })

  it('keeps portal order when a period is not numeric', () => {
    const model = parseSchedule({
      schedule: [
        { period: 'B', course: 'Second' },
        { period: '1', course: 'First' },
        { period: 'A', course: 'Third' },
      ],
    })
    expect(model?.rows.map((row) => row.course)).toEqual(['Second', 'First', 'Third'])
  })

  it('keeps portal order for equal periods (stable)', () => {
    const model = parseSchedule({
      schedule: [
        { period: '1', course: 'Fall class' },
        { period: '1', course: 'Spring class' },
      ],
    })
    expect(model?.rows.map((row) => row.course)).toEqual(['Fall class', 'Spring class'])
  })

  it('drops rows without a course and treats wrong-typed fields as missing', () => {
    const model = parseSchedule({
      schedule: [
        { period: '1', teacher: 'No course here' },
        'a string',
        null,
        42,
        { course: 'Real class', period: { nested: true }, teacher: ['x'], room: 214 },
      ],
    })
    expect(model?.rows).toEqual([{ period: null, course: 'Real class', subtitle: null, room: '214' }])
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty object', {}],
    ['a string', 'schedule'],
    ['an unrelated object', { foo: 'bar', count: 3 }],
    ['rows with no course at all', { schedule: [{ period: '1' }, { teacher: 'x' }] }],
    ['schedule that is an object', { schedule: { period: '1', course: 'Biology' } }],
  ])('returns null for %s', (_name, payload) => {
    expect(parseSchedule(payload)).toBeNull()
  })

  it('gives an empty model for an empty list, so the screen can show its empty state', () => {
    expect(parseSchedule({ schedule: [] })).toEqual({ rows: [] })
    expect(parseSchedule({ schedule: [], term: 'Fall 2026' })).toEqual({ rows: [] })
    expect(parseSchedule([])).toEqual({ rows: [] })
  })

  it('still falls back when the list has entries but none names a course', () => {
    expect(parseSchedule({ schedule: [null, 7] })).toBeNull()
  })

  it('never logs', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    parseSchedule(demo)
    parseSchedule({ schedule: [null, 1] })
    expect(spy).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    spy.mockRestore()
    warn.mockRestore()
    error.mockRestore()
  })
})
