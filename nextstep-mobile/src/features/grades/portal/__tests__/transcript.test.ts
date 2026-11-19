import { describe, expect, it } from '@jest/globals'

import { parseTranscript } from '../transcript'

const sophomore = [
  { name: 'Biology', grade: 'A', credits: '1.0' },
  { name: 'Geometry', grade: 'B', credits: '1.0' },
  { name: 'Health', grade: 'A', credits: '0.5' },
]

// The e2e / backend demo shape.
const hac = {
  semesters: [
    { year: '2025-2026', semester: 'Spring', courses: sophomore },
    { year: '2025-2026', semester: 'Fall', courses: [{ name: 'Algebra I', grade: '91', credits: '1.0' }] },
  ],
  cumulativeGPA: '3.875',
  weightedGPA: '4.125',
  unweightedGPA: '3.875',
  classRank: '58/412',
  quartile: '1',
}

describe('parseTranscript, HAC shape', () => {
  it('reads semesters in portal order with grades, credits and a credit total', () => {
    const model = parseTranscript(hac)
    expect(model?.sections).toHaveLength(2)
    expect(model?.sections[0]).toEqual({
      title: 'Spring',
      meta: '2025-2026',
      creditsTotalText: '2.5 credits',
      rows: [
        { name: 'Biology', grade: { label: 'A', letter: 'A', percent: null }, creditsText: '1 credit', terms: [] },
        { name: 'Geometry', grade: { label: 'B', letter: 'B', percent: null }, creditsText: '1 credit', terms: [] },
        { name: 'Health', grade: { label: 'A', letter: 'A', percent: null }, creditsText: '0.5 credits', terms: [] },
      ],
    })
    expect(model?.sections[1].creditsTotalText).toBe('1 credit')
  })

  it('treats a number in the grade field as a percent and derives the letter', () => {
    const row = parseTranscript(hac)?.sections[1].rows[0]
    expect(row?.grade).toEqual({ label: 'A', letter: 'A', percent: '91' })
  })

  it('reads the GPA summary, rank and quartile', () => {
    expect(parseTranscript(hac)?.summary).toEqual({
      unweighted: 3.875,
      weighted: 4.125,
      cumulative: 3.875,
      rankText: '58/412',
      quartileText: 'Quartile 1',
    })
  })

  it('leaves null GPA and rank fields null, and the summary null when all are missing', () => {
    const partial = parseTranscript({ ...hac, weightedGPA: null, classRank: null, quartile: null, cumulativeGPA: null })
    expect(partial?.summary).toEqual({
      unweighted: 3.875,
      weighted: null,
      cumulative: null,
      rankText: null,
      quartileText: null,
    })
    const none = parseTranscript({
      semesters: hac.semesters,
      cumulativeGPA: null,
      weightedGPA: null,
      unweightedGPA: '',
      classRank: '',
      quartile: null,
    })
    expect(none?.summary).toBeNull()
    expect(none?.sections).toHaveLength(2)
  })

  it('names a bare digit semester "Semester N" and falls back to the year', () => {
    const model = parseTranscript({
      semesters: [
        { year: '2024-2025', semester: '1', courses: sophomore },
        { year: '2024-2025', courses: sophomore },
        { courses: sophomore },
      ],
    })
    expect(model?.sections.map((s) => [s.title, s.meta])).toEqual([
      ['Semester 1', '2024-2025'],
      ['2024-2025', null],
      ['Semester 3', null],
    ])
  })

  it('shows no credit total when no course has numeric credits', () => {
    const model = parseTranscript({ semesters: [{ semester: 'Fall', courses: [{ name: 'Art', grade: 'A' }] }] })
    expect(model?.sections[0].creditsTotalText).toBeNull()
    expect(model?.sections[0].rows[0].creditsText).toBeNull()
  })

  it('drops courses without a name and semesters without courses', () => {
    const model = parseTranscript({
      semesters: [
        { semester: 'Fall', courses: [{ grade: 'A' }, null, 'x', { name: 'Art', grade: 5 }] },
        { semester: 'Spring', courses: [] },
        { semester: 'Summer' },
        null,
      ],
    })
    expect(model?.sections).toHaveLength(1)
    expect(model?.sections[0].rows.map((r) => r.name)).toEqual(['Art'])
  })

  it('returns null when no semester has a usable course', () => {
    expect(parseTranscript({ semesters: [{ semester: 'Fall', courses: [] }] })).toBeNull()
    expect(parseTranscript({ semesters: [] })).toBeNull()
  })
})

// powerSchoolClient.getTranscript: header-keyed rows, no GPA or rank.
const powerSchool = {
  terms: ['Exp', 'Course', 'Last Week', 'This Week', 'Q1', 'Q2', 'S1', '', 'Absences', 'Tardies'],
  courses: [
    {
      Exp: '1(A)',
      Course: 'AP Biology\n   Rivera, M - Rm 214',
      'Last Week': '93',
      'This Week': '94',
      Q1: '92',
      Q2: '',
      S1: 'A',
      Absences: '0',
      Tardies: '1',
    },
    { Exp: '2(A)', Course: 'English III', Q1: '85', Q2: '88', S1: 'B' },
  ],
}

describe('parseTranscript, PowerSchool shape', () => {
  it('makes one "Courses" section and keeps only reporting-term columns with a value', () => {
    expect(parseTranscript(powerSchool)).toEqual({
      summary: null,
      sections: [
        {
          title: 'Courses',
          meta: null,
          creditsTotalText: null,
          rows: [
            {
              name: 'AP Biology Rivera, M - Rm 214',
              grade: { label: null, letter: null, percent: null },
              creditsText: null,
              terms: [
                { label: 'Q1', value: '92' },
                { label: 'S1', value: 'A' },
              ],
            },
            {
              name: 'English III',
              grade: { label: null, letter: null, percent: null },
              creditsText: null,
              terms: [
                { label: 'Q1', value: '85' },
                { label: 'Q2', value: '88' },
                { label: 'S1', value: 'B' },
              ],
            },
          ],
        },
      ],
    })
  })

  it('finds the course column case-insensitively under other names', () => {
    const model = parseTranscript({ terms: ['COURSE NAME', 'Q1'], courses: [{ 'COURSE NAME': 'Art', Q1: '90' }] })
    expect(model?.sections[0].rows[0]).toMatchObject({ name: 'Art', terms: [{ label: 'Q1', value: '90' }] })
  })

  it('returns null when there is no recognisable course column', () => {
    expect(parseTranscript({ terms: ['Q1', 'Q2'], courses: [{ Q1: '90', Q2: '91' }] })).toBeNull()
  })

  it('returns null when the rows are not records or the terms list is missing', () => {
    expect(parseTranscript({ terms: ['Course'], courses: ['Art', 3] })).toBeNull()
    expect(parseTranscript({ courses: [{ Course: 'Art' }] })).toBeNull()
  })

  it('skips rows with an empty course cell', () => {
    const model = parseTranscript({ terms: ['Course', 'Q1'], courses: [{ Course: '', Q1: '9' }, { Course: 'Art', Q1: '90' }] })
    expect(model?.sections[0].rows.map((r) => r.name)).toEqual(['Art'])
  })
})

describe('parseTranscript, unrecognised input', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty object', {}],
    ['empty array', []],
    ['a string', 'transcript'],
    ['an unrelated object', { foo: 'bar', count: 3 }],
    ['semesters that is an object', { semesters: { Fall: [] } }],
    ['an array', [{ name: 'A' }]],
  ])('returns null for %s', (_name, payload) => {
    expect(parseTranscript(payload)).toBeNull()
  })
})
