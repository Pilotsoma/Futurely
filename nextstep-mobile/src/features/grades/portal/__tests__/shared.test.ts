import { describe, expect, it, jest } from '@jest/globals'

import {
  asArray,
  asNumber,
  asRecord,
  asText,
  formatCredits,
  formatPortalDate,
  parsePortalDate,
  pickKey,
  pickText,
  resolveGrade,
} from '../shared'

describe('narrowing helpers', () => {
  it('asRecord accepts plain objects only', () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 })
    expect(asRecord([])).toBeNull()
    expect(asRecord(null)).toBeNull()
    expect(asRecord('x')).toBeNull()
    expect(asRecord(undefined)).toBeNull()
  })

  it('asArray accepts arrays only', () => {
    expect(asArray([1])).toEqual([1])
    expect(asArray({})).toBeNull()
    expect(asArray('a')).toBeNull()
  })

  it('asText trims strings, stringifies finite numbers and drops everything else', () => {
    expect(asText('  AP Biology ')).toBe('AP Biology')
    expect(asText(5)).toBe('5')
    expect(asText('')).toBeNull()
    expect(asText('   ')).toBeNull()
    expect(asText(Number.NaN)).toBeNull()
    expect(asText(Infinity)).toBeNull()
    expect(asText(true)).toBeNull()
    expect(asText({})).toBeNull()
    expect(asText(null)).toBeNull()
  })

  it('asNumber reads numbers and numeric strings, with or without a percent sign', () => {
    expect(asNumber(93.5)).toBe(93.5)
    expect(asNumber('93.5')).toBe(93.5)
    expect(asNumber(' 93.5% ')).toBe(93.5)
    expect(asNumber('-2')).toBe(-2)
    expect(asNumber('.5')).toBe(0.5)
    expect(asNumber('88.')).toBe(88)
    expect(asNumber('A')).toBeNull()
    expect(asNumber('')).toBeNull()
    expect(asNumber('9 3')).toBeNull()
    expect(asNumber('1e3')).toBeNull()
    expect(asNumber(Number.NaN)).toBeNull()
    expect(asNumber(null)).toBeNull()
    expect(asNumber({})).toBeNull()
  })
})

describe('pickText / pickKey', () => {
  it('matches keys case- and punctuation-insensitively', () => {
    expect(pickText({ 'Course Name': 'Biology' }, ['courseName'])).toBe('Biology')
    expect(pickText({ COURSE_NAME: 'Biology' }, ['courseName'])).toBe('Biology')
    expect(pickText({ 'course-name': 'Biology' }, ['courseName'])).toBe('Biology')
  })

  it('follows alias priority, not key order, and skips empty values', () => {
    const row = { description: 'Desc', courseName: 'Name', course: '' }
    expect(pickText(row, ['course', 'courseName', 'description'])).toBe('Name')
    expect(pickText(row, ['description', 'courseName'])).toBe('Desc')
  })

  it('returns null when nothing matches or the value is not text', () => {
    expect(pickText({ a: 1 }, ['b'])).toBeNull()
    expect(pickText({ a: {} }, ['a'])).toBeNull()
    expect(pickText({}, ['a'])).toBeNull()
  })

  it('stringifies numeric values and pickKey returns the real key', () => {
    expect(pickText({ Period: 3 }, ['period'])).toBe('3')
    expect(pickKey({ 'Course Name': 'x' }, ['coursename'])).toBe('Course Name')
    expect(pickKey({ a: '' }, ['a'])).toBeNull()
  })
})

describe('resolveGrade', () => {
  it('keeps a letter as the label and uses its base letter for colour', () => {
    expect(resolveGrade('A', null)).toEqual({ label: 'A', letter: 'A', percent: null })
    expect(resolveGrade('A-', null)).toEqual({ label: 'A-', letter: 'A', percent: null })
    expect(resolveGrade('b+', null)).toEqual({ label: 'B+', letter: 'B', percent: null })
    expect(resolveGrade('F', '41')).toEqual({ label: 'F', letter: 'F', percent: '41' })
  })

  it('derives the letter from a numeric value, whichever argument carries it', () => {
    expect(resolveGrade('93', '93')).toEqual({ label: 'A', letter: 'A', percent: '93' })
    expect(resolveGrade('', '88.4')).toEqual({ label: 'B', letter: 'B', percent: '88.4' })
    expect(resolveGrade(null, 72)).toEqual({ label: 'C', letter: 'C', percent: '72' })
    expect(resolveGrade('93.5%', null)).toEqual({ label: 'A', letter: 'A', percent: '93.5' })
    expect(resolveGrade(undefined, '59')).toEqual({ label: 'F', letter: 'F', percent: '59' })
  })

  it('rounds the percent to one decimal', () => {
    expect(resolveGrade(null, '93.46').percent).toBe('93.5')
    expect(resolveGrade(null, 88).percent).toBe('88')
  })

  it('shows a short non-numeric token as a neutral label', () => {
    expect(resolveGrade('P', null)).toEqual({ label: 'P', letter: null, percent: null })
    expect(resolveGrade('I', null)).toEqual({ label: 'I', letter: null, percent: null })
    expect(resolveGrade('P', '75')).toEqual({ label: 'P', letter: null, percent: '75' })
  })

  it('returns an empty grade when nothing usable was sent', () => {
    const empty = { label: null, letter: null, percent: null }
    expect(resolveGrade(null, null)).toEqual(empty)
    expect(resolveGrade('', '')).toEqual(empty)
    expect(resolveGrade({}, [])).toEqual(empty)
    expect(resolveGrade('Incomplete', null)).toEqual(empty)
    expect(resolveGrade('Absent', null)).toEqual(empty)
  })

  it('does not read a word that merely starts with a letter as that letter', () => {
    expect(resolveGrade('Fail', null).letter).toBeNull()
    expect(resolveGrade('Audit', null).letter).toBeNull()
  })

  it('ignores a number that cannot be a percentage', () => {
    expect(resolveGrade(null, '-4').label).toBeNull()
    expect(resolveGrade(null, '1000').label).toBeNull()
    expect(resolveGrade(null, 'A').label).toBeNull()
  })
})

describe('formatCredits', () => {
  it('uses the singular for exactly one credit', () => {
    expect(formatCredits('1.0')).toBe('1 credit')
    expect(formatCredits(1)).toBe('1 credit')
  })

  it('uses the plural otherwise', () => {
    expect(formatCredits('0.5')).toBe('0.5 credits')
    expect(formatCredits('2')).toBe('2 credits')
    expect(formatCredits(5.5)).toBe('5.5 credits')
    expect(formatCredits('0')).toBe('0 credits')
  })

  it('returns null when the value is not numeric or is negative', () => {
    expect(formatCredits('')).toBeNull()
    expect(formatCredits('n/a')).toBeNull()
    expect(formatCredits(null)).toBeNull()
    expect(formatCredits('-1')).toBeNull()
  })
})

describe('parsePortalDate', () => {
  it('parses ISO dates and ISO timestamps without shifting the day', () => {
    expect(parsePortalDate('2026-11-06')).toEqual({ year: 2026, monthIndex: 10, day: 6 })
    expect(parsePortalDate('2026-11-06T00:00:00.000Z')).toEqual({ year: 2026, monthIndex: 10, day: 6 })
    expect(parsePortalDate('2026-1-5')).toEqual({ year: 2026, monthIndex: 0, day: 5 })
  })

  it('parses MM/DD/YYYY', () => {
    expect(parsePortalDate('11/06/2026')).toEqual({ year: 2026, monthIndex: 10, day: 6 })
    expect(parsePortalDate('1/5/2025')).toEqual({ year: 2025, monthIndex: 0, day: 5 })
  })

  it('rejects garbage and impossible dates', () => {
    expect(parsePortalDate('garbage')).toBeNull()
    expect(parsePortalDate('')).toBeNull()
    expect(parsePortalDate(null)).toBeNull()
    expect(parsePortalDate(20261106)).toBeNull()
    expect(parsePortalDate('2026-13-01')).toBeNull()
    expect(parsePortalDate('2026-02-30')).toBeNull()
    expect(parsePortalDate('13/01/2026')).toBeNull()
    expect(parsePortalDate('02/29/2025')).toBeNull()
    expect(parsePortalDate('02/29/2028')).toEqual({ year: 2028, monthIndex: 1, day: 29 })
  })
})

describe('formatPortalDate', () => {
  it('omits the year for the current year and prints it otherwise', () => {
    const year = new Date().getFullYear()
    expect(formatPortalDate(`${year}-11-06`)).toBe('Nov 6')
    expect(formatPortalDate(`11/06/${year}`)).toBe('Nov 6')
    expect(formatPortalDate('2019-03-14')).toBe('Mar 14, 2019')
  })

  it('keeps the first and last day of a year on their own date (no time zone shift)', () => {
    expect(formatPortalDate('2019-03-01')).toBe('Mar 1, 2019')
    expect(formatPortalDate('2019-12-31')).toBe('Dec 31, 2019')
    expect(formatPortalDate('01/01/2019')).toBe('Jan 1, 2019')
  })

  it('falls back to the raw text, or null', () => {
    expect(formatPortalDate(' Fall term ')).toBe('Fall term')
    expect(formatPortalDate('')).toBeNull()
    expect(formatPortalDate(undefined)).toBeNull()
  })

  it('never logs', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    formatPortalDate('2026-11-06')
    resolveGrade('A', '93')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
