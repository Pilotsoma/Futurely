/**
 * Unit tests for roadmapCore.service.ts
 *
 * All external I/O is mocked:
 *   - prisma (profile.findUnique, course.findMany)
 *   - getPortalData (lib/studentContext)
 *
 * Critical compliance coverage:
 *   (a) courseSubjects strips grade info from the colon onward — no letter
 *       grade or numeric percentage may appear in any returned entry.
 *   (b) courseSubjects is empty array when portalData is null (no HAC sync).
 *   (c) GPA prefers live portal values over stale Profile table values.
 *   (d) GPA falls back to Profile table when portalData is null.
 *   (e) GPA defaults to 0 when both sources are missing.
 *   (f) Course names that contain a colon never leak grade info after stripping.
 *   (g) Empty course-name strings after stripping are excluded from the result.
 */

// ── Mocks (hoisted before imports by ts-jest) ─────────────────────────────────

const mockProfileFindUnique = jest.fn()
const mockCourseFindMany = jest.fn()
const mockGetPortalData = jest.fn()

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    profile: { findUnique: mockProfileFindUnique },
    course: { findMany: mockCourseFindMany },
  },
}))

jest.mock('../../../lib/studentContext', () => ({
  getPortalData: mockGetPortalData,
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { gatherRoadmapCore, categorize, deriveGradeLevel, CREDITS_REQUIRED } from '../roadmapCore.service'

// ── Test fixtures ─────────────────────────────────────────────────────────────

const BASE_PROFILE = {
  userId: 1,
  graduationYear: 2026,
  gradeLevel: 11,
  weightedGpa: 3.5,
  unweightedGpa: 3.2,
  futureDecision: 'college',
}

const PORTAL_DATA_WITH_COURSES = {
  weightedGpa: 3.8,
  unweightedGpa: 3.6,
  classRank: '15/300',
  courseList: [
    'AP Chemistry: A (94%)',
    'AP English Language: B+ (87%)',
    'Pre-Calculus: 91%',
    'US History: C (73%)',
  ],
  transcriptSummary: 'Most recent semester...',
  attendanceSummary: 'September 2025: 1 absence(s), 0 excused, 0 tardy(ies)',
}

const PASSING_COURSE = {
  id: 1,
  userId: 1,
  name: 'AP Chemistry',
  creditHours: 1,
  grades: [{ letterGrade: 'A', gradingPeriod: 'CURRENT' }],
}

const FAILING_COURSE = {
  id: 2,
  userId: 1,
  name: 'Math',
  creditHours: 1,
  grades: [{ letterGrade: 'F', gradingPeriod: 'CURRENT' }],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasGradeInfo(subject: string): boolean {
  // Detects any percentage number or isolated letter grade (A-F with optional +/-)
  return /\d+%/.test(subject) || /\b[A-F][+-]?\b/.test(subject)
}

// ── Tests: pure helper functions ──────────────────────────────────────────────

describe('categorize()', () => {
  it('maps course names to categories case-insensitively', () => {
    expect(categorize('AP Chemistry')).toBe('Science')
    expect(categorize('AP ENGLISH LANGUAGE')).toBe('English')
    expect(categorize('Pre-Calculus')).toBe('Math')
    expect(categorize('US History')).toBe('Social Studies')
    expect(categorize('PE I')).toBe('PE / Health')
    expect(categorize('Spanish II')).toBe('Language')
    expect(categorize('Art I')).toBe('Fine Arts')
  })

  it('returns Electives for unrecognized course names', () => {
    expect(categorize('Random Elective 101')).toBe('Electives')
  })
})

describe('deriveGradeLevel()', () => {
  it('returns stored grade level when graduation year is null', () => {
    expect(deriveGradeLevel(null, 10)).toBe(10)
  })

  it('defaults to 9 when both graduation year and stored grade level are null', () => {
    expect(deriveGradeLevel(null, null)).toBe(9)
  })
})

// ── Tests: gatherRoadmapCore — courseSubjects compliance ─────────────────────

describe('gatherRoadmapCore() — courseSubjects compliance', () => {
  beforeEach(() => {
    mockProfileFindUnique.mockResolvedValue(BASE_PROFILE)
    mockCourseFindMany.mockResolvedValue([PASSING_COURSE])
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('strips grade info after the first colon for each course entry', async () => {
    mockGetPortalData.mockResolvedValue(PORTAL_DATA_WITH_COURSES)

    const result = await gatherRoadmapCore(1)

    expect(result.courseSubjects).toEqual([
      'AP Chemistry',
      'AP English Language',
      'Pre-Calculus',
      'US History',
    ])
  })

  it('COMPLIANCE: no entry in courseSubjects contains a percentage or letter grade', async () => {
    mockGetPortalData.mockResolvedValue(PORTAL_DATA_WITH_COURSES)

    const result = await gatherRoadmapCore(1)

    for (const subject of result.courseSubjects) {
      expect(hasGradeInfo(subject)).toBe(false)
    }
  })

  it('COMPLIANCE: course name containing a colon does not leak grade info', async () => {
    // Simulate a course name that itself contains a colon, like "SAT Prep: Math",
    // then the full entry would be "SAT Prep: Math: A (94%)"
    mockGetPortalData.mockResolvedValue({
      ...PORTAL_DATA_WITH_COURSES,
      courseList: ['SAT Prep: Math: A (94%)'],
    })

    const result = await gatherRoadmapCore(1)

    // Must not contain any grade information — course name may be truncated
    expect(result.courseSubjects).toHaveLength(1)
    expect(hasGradeInfo(result.courseSubjects[0]!)).toBe(false)
  })

  it('returns empty courseSubjects when portalData is null (no HAC sync yet)', async () => {
    mockGetPortalData.mockResolvedValue(null)

    const result = await gatherRoadmapCore(1)

    expect(result.courseSubjects).toEqual([])
  })

  it('excludes empty strings that result from entries with no text before the colon', async () => {
    mockGetPortalData.mockResolvedValue({
      ...PORTAL_DATA_WITH_COURSES,
      courseList: [': A (94%)', 'AP Chemistry: B (87%)'],
    })

    const result = await gatherRoadmapCore(1)

    expect(result.courseSubjects).toEqual(['AP Chemistry'])
    expect(result.courseSubjects).not.toContain('')
  })
})

// ── Tests: gatherRoadmapCore — GPA source priority ───────────────────────────

describe('gatherRoadmapCore() — GPA source priority', () => {
  beforeEach(() => {
    mockCourseFindMany.mockResolvedValue([])
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('prefers live HAC-synced portal GPA over stale Profile table values', async () => {
    mockProfileFindUnique.mockResolvedValue(BASE_PROFILE)
    mockGetPortalData.mockResolvedValue(PORTAL_DATA_WITH_COURSES)

    const result = await gatherRoadmapCore(1)

    expect(result.weightedGpa).toBe(3.8)
    expect(result.unweightedGpa).toBe(3.6)
  })

  it('falls back to Profile table GPA when portalData is null', async () => {
    mockProfileFindUnique.mockResolvedValue(BASE_PROFILE)
    mockGetPortalData.mockResolvedValue(null)

    const result = await gatherRoadmapCore(1)

    expect(result.weightedGpa).toBe(3.5)
    expect(result.unweightedGpa).toBe(3.2)
  })

  it('defaults GPA to 0 when both portal and profile are missing', async () => {
    mockProfileFindUnique.mockResolvedValue(null)
    mockGetPortalData.mockResolvedValue(null)

    const result = await gatherRoadmapCore(1)

    expect(result.weightedGpa).toBe(0)
    expect(result.unweightedGpa).toBe(0)
  })

  it('falls back to Profile GPA when portal GPA values are null', async () => {
    mockProfileFindUnique.mockResolvedValue(BASE_PROFILE)
    mockGetPortalData.mockResolvedValue({
      ...PORTAL_DATA_WITH_COURSES,
      weightedGpa: null,
      unweightedGpa: null,
    })

    const result = await gatherRoadmapCore(1)

    expect(result.weightedGpa).toBe(3.5)
    expect(result.unweightedGpa).toBe(3.2)
  })
})

// ── Tests: gatherRoadmapCore — credit calculations ───────────────────────────

describe('gatherRoadmapCore() — credit calculations', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('counts credits only for passing courses', async () => {
    mockProfileFindUnique.mockResolvedValue(BASE_PROFILE)
    mockGetPortalData.mockResolvedValue(null)
    mockCourseFindMany.mockResolvedValue([PASSING_COURSE, FAILING_COURSE])

    const result = await gatherRoadmapCore(1)

    expect(result.creditsCompleted).toBe(1)
    expect(result.creditsRequired).toBe(CREDITS_REQUIRED)
  })

  it('returns the full RoadmapCore shape with all required fields', async () => {
    mockProfileFindUnique.mockResolvedValue(BASE_PROFILE)
    mockGetPortalData.mockResolvedValue(PORTAL_DATA_WITH_COURSES)
    mockCourseFindMany.mockResolvedValue([PASSING_COURSE])

    const result = await gatherRoadmapCore(1)

    expect(result).toMatchObject({
      gradeLevel: expect.any(Number),
      graduationYear: expect.any(Number),
      creditsCompleted: expect.any(Number),
      creditsRequired: CREDITS_REQUIRED,
      creditsByCategory: expect.any(Object),
      weightedGpa: expect.any(Number),
      unweightedGpa: expect.any(Number),
      futureDecision: expect.any(String),
      courseSubjects: expect.any(Array),
    })
  })
})
