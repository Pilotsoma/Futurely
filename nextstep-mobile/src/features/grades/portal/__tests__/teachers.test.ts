import { describe, expect, it } from '@jest/globals'

import { parseTeachers } from '../teachers'

const fixture = {
  teachers: [
    {
      name: 'Dr. Rivera',
      email: 'rivera@school.example.test',
      room: 'Rm 214',
      building: 'Main Building',
      courses: [{ courseName: 'AP Biology', period: '1' }],
    },
    {
      name: 'Ms. Brooks',
      email: 'brooks@school.example.test',
      room: 'Rm 108',
      building: 'Main Building',
      courses: [
        { courseName: 'English III', period: '2' },
        { courseName: 'Journalism', period: '6' },
      ],
    },
  ],
}

describe('parseTeachers', () => {
  it('reads the e2e / backend shape', () => {
    expect(parseTeachers(fixture)).toEqual({
      teachers: [
        {
          name: 'Dr. Rivera',
          coursesText: 'AP Biology · Period 1',
          placeText: 'Rm 214 · Main Building',
          email: 'rivera@school.example.test',
        },
        {
          name: 'Ms. Brooks',
          coursesText: 'English III · Period 2, Journalism · Period 6',
          placeText: 'Rm 108 · Main Building',
          email: 'brooks@school.example.test',
        },
      ],
    })
  })

  it('accepts a bare array of teachers', () => {
    expect(parseTeachers([{ name: 'Coach Davis' }])).toEqual({
      teachers: [{ name: 'Coach Davis', coursesText: null, placeText: null, email: null }],
    })
  })

  it('leaves out missing parts instead of inventing separators', () => {
    const model = parseTeachers({
      teachers: [
        { name: 'A', room: '12', courses: [{ courseName: 'Art' }] },
        { name: 'B', building: 'Annex', courses: [] },
        { name: 'C', courses: 'not an array' },
      ],
    })
    expect(model?.teachers.map((t) => [t.coursesText, t.placeText])).toEqual([
      ['Art', '12'],
      [null, 'Annex'],
      [null, null],
    ])
  })

  it('accepts course names given as plain strings and removes repeated courses', () => {
    const model = parseTeachers({
      teachers: [{ name: 'A', courses: ['Art I', 'Art I', { courseName: 'Art II', period: 3 }] }],
    })
    expect(model?.teachers[0].coursesText).toBe('Art I, Art II · Period 3')
  })

  it('keeps an address only when it looks like one', () => {
    const emails = ['ok@school.test', 'no-at-sign.test', 'two@@school.test', 'spaces in@school.test', 'a@b', '', null, 42]
    const model = parseTeachers({ teachers: emails.map((email, i) => ({ name: `T${i}`, email })) })
    expect(model?.teachers.map((t) => t.email)).toEqual(['ok@school.test', null, null, null, null, null, null, null])
  })

  it('refuses an address that could add mailto: parameters', () => {
    const model = parseTeachers({
      teachers: [
        { name: 'A', email: 'a@school.test?subject=Grades&body=secret' },
        { name: 'B', email: 'b@school.test#frag' },
        { name: 'C', email: 'c?cc=x@school.test' },
        { name: 'D', email: 'd#x@school.test' },
      ],
    })
    expect(model?.teachers.map((t) => t.email)).toEqual([null, null, null, null])
  })

  it('refuses an address that smuggles a second recipient or a header into the mailto: link', () => {
    const smuggled = [
      'ms.r@school.org,attacker%40evil.com',
      'a@b.com%0D%0ABcc:x%40y.com',
      'a@b.com,c@d.com',
      'a@b.com;c@d.com',
      'ms.r@school.org%2Cattacker%40evil.com',
      'ms.r@school%40evil.com',
      'a@b.com&cc=c@d.com',
      'a%40b.com@school.org',
      'a@b.com\r\nBcc: c@d.com',
      "a@b.com'",
      'a@b..com',
    ]
    const model = parseTeachers({ teachers: smuggled.map((email, i) => ({ name: `T${i}`, email })) })
    expect(model?.teachers.map((t) => t.email)).toEqual(smuggled.map(() => null))
    // The teacher stays listed; only the tappable address is dropped.
    expect(model?.teachers.map((t) => t.name)).toEqual(smuggled.map((_, i) => `T${i}`))
  })

  it('keeps ordinary school addresses, including dots, plus signs, apostrophes and subdomains', () => {
    const good = ['ms.r@school.org', 'first.last+math@mail.district.k12.tx.us', "o'brien@school.test", 'a_b-c@sub-domain.school.edu']
    const model = parseTeachers({ teachers: good.map((email, i) => ({ name: `T${i}`, email })) })
    expect(model?.teachers.map((t) => t.email)).toEqual(good)
  })

  it('trims the address', () => {
    expect(parseTeachers({ teachers: [{ name: 'A', email: '  a@school.test ' }] })?.teachers[0].email).toBe('a@school.test')
  })

  it('drops entries with no name and tolerates wrong types', () => {
    const model = parseTeachers({ teachers: [{ email: 'x@y.test' }, 7, null, 'text', { name: 'Real', room: { a: 1 } }] })
    expect(model?.teachers).toEqual([{ name: 'Real', coursesText: null, placeText: null, email: null }])
  })

  it('gives an empty model for an empty list, so the screen can show its empty state', () => {
    expect(parseTeachers({ teachers: [] })).toEqual({ teachers: [] })
    expect(parseTeachers({ teachers: [], school: 'North High' })).toEqual({ teachers: [] })
    expect(parseTeachers([])).toEqual({ teachers: [] })
  })

  it('still falls back when the list has entries but none has a name', () => {
    expect(parseTeachers({ teachers: [null, 7, { email: 'a@b.test' }] })).toBeNull()
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty object', {}],
    ['a string', 'teachers'],
    ['an unrelated object', { foo: 'bar' }],
    ['entries without names', { teachers: [{ email: 'a@b.test' }] }],
    ['teachers that is an object', { teachers: { name: 'A' } }],
  ])('returns null for %s', (_name, payload) => {
    expect(parseTeachers(payload)).toBeNull()
  })
})
