import { describe, expect, it, jest } from '@jest/globals'

import { parseReportCard } from '../reportCard'

const DASH = String.fromCharCode(0x2014)

const people = [
  ['AP Biology', '1', '93.5', 'A', '1.0', 'Dr. Rivera'],
  ['English III', '2', '88', 'B', '1.0', 'Ms. Brooks'],
  ['Physical Education', '6', '98', 'A', '0.5', 'Coach Davis'],
] as const

// Shape A: the e2e fixture and backend demo.
const shapeA = {
  reportingPeriods: ['1st Semester', '2nd Semester'],
  currentPeriod: '1st Semester',
  semesters: {
    sem1: people.map(([name, period, numericGrade, letterGrade, credits, teacher]) => ({
      name,
      period,
      numericGrade,
      letterGrade,
      credits,
      teacher,
    })),
    sem2: people.map(([name, period, , letterGrade, credits, teacher]) => ({
      name,
      period,
      numericGrade: '99',
      letterGrade,
      credits,
      teacher,
    })),
  },
}

function hacRow(overrides: Record<string, string> = {}) {
  return {
    name: `BIO1 ${DASH} AP Biology`,
    period: '1',
    teacher: 'Dr. Rivera',
    attemptedCredit: '1.0',
    earnedCredit: '1.0',
    sixWeeks1: '92',
    sixWeeks2: '90',
    sixWeeks3: '94',
    exam1: '88',
    semester1: '91',
    sixWeeks4: '',
    sixWeeks5: '',
    sixWeeks6: '',
    exam2: '',
    semester2: '',
    ...overrides,
  }
}

// Shape B: live HAC.
const shapeB = {
  reportingPeriods: ['2026-2027 Report Card'],
  currentPeriod: '2026-2027 Report Card',
  courses: [
    hacRow(),
    hacRow({ name: `ENG3 ${DASH} English III`, period: '2', teacher: 'Ms. Brooks', semester1: '85', earnedCredit: '', attemptedCredit: '0.5' }),
  ],
}

describe('parseReportCard shape A', () => {
  it('reads the demo shape into two labelled sections', () => {
    const model = parseReportCard(shapeA)
    expect(model?.sections.map((section) => section.label)).toEqual(['1st Semester', '2nd Semester'])
    expect(model?.initialIndex).toBe(0)
    expect(model?.portalMessage).toBeNull()
    expect(model?.sections[0].rows[0]).toEqual({
      name: 'AP Biology',
      subtitle: 'Dr. Rivera · Period 1',
      grade: { label: 'A', letter: 'A', percent: '93.5' },
      creditsText: '1 credit',
      breakdown: [],
    })
  })

  it('totals the credits of a section', () => {
    const model = parseReportCard(shapeA)
    expect(model?.sections.map((section) => section.creditsTotalText)).toEqual(['2.5 credits', '2.5 credits'])
    expect(model?.sections[0].hasGrades).toBe(true)
  })

  it('totals the six-course fixture to 5.5 credits', () => {
    const rows = ['1.0', '1.0', '1.0', '1.0', '1.0', '0.5'].map((credits, index) => ({
      name: `Course ${index}`,
      numericGrade: '90',
      letterGrade: 'A',
      credits,
    }))
    const model = parseReportCard({ semesters: { sem1: rows } })
    expect(model?.sections[0].creditsTotalText).toBe('5.5 credits')
  })

  it('has no credit total when no row has numeric credits', () => {
    const model = parseReportCard({ semesters: { sem1: [{ name: 'Art', numericGrade: '90', credits: '' }] } })
    expect(model?.sections[0].creditsTotalText).toBeNull()
  })

  it('labels sections from the keys when reportingPeriods does not line up', () => {
    const model = parseReportCard({
      reportingPeriods: ['A', 'B', 'C'],
      semesters: { sem1: [{ name: 'Art' }], sem2: [{ name: 'Art' }], summer: [{ name: 'Art' }], fall2: [{ name: 'Art' }] },
    })
    expect(model?.sections.map((section) => section.label)).toEqual(['Semester 1', 'Semester 2', 'Summer', 'Semester 2 2'])
  })

  it('makes duplicate labels unique so the switcher can key on them', () => {
    const model = parseReportCard({
      reportingPeriods: ['Semester', 'semester', 'Semester'],
      currentPeriod: 'semester',
      semesters: { a: [{ name: 'X' }], b: [{ name: 'X' }], c: [{ name: 'X' }] },
    })
    expect(model?.sections.map((section) => section.label)).toEqual(['Semester', 'semester 2', 'Semester 3'])
  })

  it('falls back to the keys for labels when a reporting period is not text', () => {
    const model = parseReportCard({
      reportingPeriods: ['1st Semester', null],
      semesters: { sem1: [{ name: 'Art' }], sem2: [{ name: 'Art' }] },
    })
    expect(model?.sections.map((section) => section.label)).toEqual(['Semester 1', 'Semester 2'])
  })

  it('selects the section named by currentPeriod, case-insensitively', () => {
    const model = parseReportCard({ ...shapeA, currentPeriod: '2ND SEMESTER' })
    expect(model?.initialIndex).toBe(1)
  })

  it('selects the last section with grades when currentPeriod matches nothing', () => {
    const model = parseReportCard({
      reportingPeriods: ['1st Semester', '2nd Semester'],
      currentPeriod: 'Unknown',
      semesters: { sem1: [{ name: 'Art', numericGrade: '90' }], sem2: [{ name: 'Art' }] },
    })
    expect(model?.initialIndex).toBe(0)
    expect(model?.sections[1].hasGrades).toBe(false)
  })

  it('selects the first section when nothing has grades', () => {
    const model = parseReportCard({ semesters: { sem1: [{ name: 'Art' }], sem2: [{ name: 'Art' }] } })
    expect(model?.initialIndex).toBe(0)
  })

  it('keeps one section and ignores keys that are not lists', () => {
    const model = parseReportCard({ semesters: { sem1: [{ name: 'Art', letterGrade: 'A' }], note: 'x', count: 3 } })
    expect(model?.sections.map((section) => section.label)).toEqual(['Semester 1'])
  })

  it('shows a letter the portal sent as is, including plus and minus', () => {
    const model = parseReportCard({ semesters: { sem1: [{ name: 'Art', letterGrade: 'B+', numericGrade: '88' }] } })
    expect(model?.sections[0].rows[0].grade).toEqual({ label: 'B+', letter: 'B', percent: '88' })
  })
})

describe('parseReportCard shape B', () => {
  it('splits the courses into Semester 1 and Semester 2', () => {
    const model = parseReportCard(shapeB)
    expect(model?.sections.map((section) => section.label)).toEqual(['Semester 1', 'Semester 2'])
    expect(model?.initialIndex).toBe(0)
  })

  it('drops the course code, derives the letter and lists the six-weeks breakdown', () => {
    const row = parseReportCard(shapeB)?.sections[0].rows[0]
    expect(row).toEqual({
      name: 'AP Biology',
      subtitle: 'Dr. Rivera · Period 1',
      grade: { label: 'A', letter: 'A', percent: '91' },
      creditsText: '1 credit',
      breakdown: [
        { label: '1st', value: '92' },
        { label: '2nd', value: '90' },
        { label: '3rd', value: '94' },
        { label: 'Exam', value: '88' },
      ],
    })
  })

  it('falls back to attempted credit when earned is blank, and totals the section', () => {
    const model = parseReportCard(shapeB)
    expect(model?.sections[0].rows[1].creditsText).toBe('0.5 credits')
    expect(model?.sections[0].creditsTotalText).toBe('1.5 credits')
  })

  it('says the second semester has no grades yet and opens on the first', () => {
    const model = parseReportCard(shapeB)
    expect(model?.sections[1].hasGrades).toBe(false)
    expect(model?.sections[1].rows[0].breakdown).toEqual([])
    expect(model?.sections[1].rows[0].grade).toEqual({ label: null, letter: null, percent: null })
  })

  it('opens on the second semester when only it has grades', () => {
    const model = parseReportCard({
      courses: [hacRow({ sixWeeks1: '', sixWeeks2: '', sixWeeks3: '', exam1: '', semester1: '', sixWeeks4: '81', semester2: '81' })],
    })
    expect(model?.initialIndex).toBe(1)
    expect(model?.sections[1].rows[0].breakdown).toEqual([{ label: '4th', value: '81' }])
  })

  it('shows a letter or code in the semester cell as sent', () => {
    const model = parseReportCard({ courses: [hacRow({ semester1: 'A-' }), hacRow({ name: 'ART1', semester1: 'P' })] })
    expect(model?.sections[0].rows.map((row) => row.grade)).toEqual([
      { label: 'A-', letter: 'A', percent: null },
      { label: 'P', letter: null, percent: null },
    ])
  })

  it('keeps the whole name when there is nothing after the separator, or no separator', () => {
    const model = parseReportCard({ courses: [hacRow({ name: `ART1 ${DASH} ` }), hacRow({ name: 'Study Hall' })] })
    expect(model?.sections[0].rows.map((row) => row.name)).toEqual([`ART1 ${DASH}`, 'Study Hall'])
  })

  it('recognises HAC rows by their keys, whatever the casing', () => {
    const model = parseReportCard({ courses: [{ Name: 'Art', 'Semester 1': '90' }] })
    expect(model?.sections[0].rows).toHaveLength(1)
  })

  it('prefers HAC courses when the semesters list is present but empty', () => {
    const model = parseReportCard({ semesters: { sem1: [] }, courses: [hacRow()] })
    expect(model?.sections.map((section) => section.label)).toEqual(['Semester 1', 'Semester 2'])
    expect(model?.sections[0].rows).toHaveLength(1)
  })

  it('returns null when the courses are not HAC rows', () => {
    expect(parseReportCard({ courses: [{ name: 'Art', grade: 'A' }] })).toBeNull()
    expect(parseReportCard({ courses: ['Art', 7] })).toBeNull()
  })
})

describe('parseReportCard with nothing to list', () => {
  it('gives no sections but keeps HAC message for an empty courses list', () => {
    const message = 'This student does not have any Report Cards for this school year.'
    expect(parseReportCard({ reportingPeriods: ['2026-2027'], currentPeriod: '2026-2027', message, courses: [] })).toEqual({
      sections: [],
      initialIndex: 0,
      portalMessage: message,
    })
  })

  it('trims the message and treats a blank one as none', () => {
    expect(parseReportCard({ message: '  Nothing yet  ', courses: [] })?.portalMessage).toBe('Nothing yet')
    expect(parseReportCard({ message: '   ', courses: [] })?.portalMessage).toBeNull()
  })

  it('gives no sections when every semester list is empty', () => {
    expect(parseReportCard({ reportingPeriods: ['1st', '2nd'], semesters: { sem1: [], sem2: [] } })).toEqual({
      sections: [],
      initialIndex: 0,
      portalMessage: null,
    })
  })

  it('gives no sections when every row lacks a name', () => {
    expect(parseReportCard({ semesters: { sem1: [{ numericGrade: '90' }, null] } })?.sections).toEqual([])
  })
})

describe('parseReportCard on other payloads', () => {
  it('returns null for payloads that are not a report card', () => {
    expect(parseReportCard(null)).toBeNull()
    expect(parseReportCard(undefined)).toBeNull()
    expect(parseReportCard({})).toBeNull()
    expect(parseReportCard([])).toBeNull()
    expect(parseReportCard('Report card')).toBeNull()
    expect(parseReportCard({ note: 'Report cards are printed' })).toBeNull()
    expect(parseReportCard({ semesters: [{ name: 'Art' }] })).toBeNull()
    expect(parseReportCard({ semesters: { note: 'x' } })).toBeNull()
    expect(parseReportCard({ courses: 'none' })).toBeNull()
  })

  it('does not throw on fields of the wrong type', () => {
    const model = parseReportCard({
      reportingPeriods: 'two',
      currentPeriod: { id: 1 },
      message: 12,
      semesters: {
        sem1: [{ name: 'Art', period: ['1'], teacher: {}, numericGrade: [], letterGrade: {}, credits: { n: 1 } }, 'junk'],
      },
    })
    expect(model?.sections[0].rows[0]).toEqual({
      name: 'Art',
      subtitle: null,
      grade: { label: null, letter: null, percent: null },
      creditsText: null,
      breakdown: [],
    })
    expect(model?.portalMessage).toBeNull()
  })

  it('never logs the payload', () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) => jest.spyOn(console, method))
    parseReportCard(shapeA)
    parseReportCard(shapeB)
    parseReportCard({ semesters: 'bad' })
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    }
  })
})
