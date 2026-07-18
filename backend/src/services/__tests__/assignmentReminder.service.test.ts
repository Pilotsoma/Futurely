/**
 * Unit tests for assignmentReminder.service.ts
 *
 * All external I/O is mocked:
 *   - prisma (assignment.findMany, assignment.update)
 *   - createAndSendNotification (notifications lib)
 *
 * The computeDeadline helper is also tested directly (it is exported for
 * testability).
 *
 * Coverage:
 *   (a) Correctly identifies assignments in the 50–70 minute window and
 *       excludes ones outside it.
 *   (b) Skips PENDING-consent users.
 *   (c) Skips already-reminded assignments (reminderSentAt not null —
 *       enforced by the DB query filter, verified via the mock call).
 *   (d) Correctly parses valid dueTime; falls back to 23:59 UTC for null
 *       and malformed dueTime values.
 *   (e) Sets reminderSentAt after a successful send.
 *   (f) One assignment's update failure doesn't block others in the batch.
 */

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

const mockFindMany = jest.fn()
const mockUpdate = jest.fn()

jest.mock('../../lib/prisma', () => ({
  prisma: {
    assignment: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}))

const mockCreateAndSendNotification = jest.fn()

jest.mock('../../lib/notifications', () => ({
  createAndSendNotification: (...args: unknown[]) => mockCreateAndSendNotification(...args),
}))

// ── Subject under test ────────────────────────────────────────────────────────

import { checkAndSendReminders, computeDeadline } from '../assignmentReminder.service'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAssignment(overrides: {
  id?: number
  userId?: number
  title?: string
  dueDate?: Date
  dueTime?: string | null
  completed?: boolean
  reminderSentAt?: Date | null
  coppaConsentStatus?: string
}) {
  return {
    id: overrides.id ?? 1,
    userId: overrides.userId ?? 42,
    title: overrides.title ?? 'Test Assignment',
    subject: 'Math',
    dueDate: overrides.dueDate ?? new Date(),
    dueTime: overrides.dueTime !== undefined ? overrides.dueTime : '14:00',
    completed: overrides.completed ?? false,
    reminderSentAt: overrides.reminderSentAt !== undefined ? overrides.reminderSentAt : null,
    user: { coppaConsentStatus: overrides.coppaConsentStatus ?? 'NOT_REQUIRED' },
  }
}

/** Returns a Date that is `offsetMs` milliseconds from now. */
function nowPlusMs(offsetMs: number): Date {
  return new Date(Date.now() + offsetMs)
}

/**
 * Builds `dueDate` (UTC midnight on the date of `target`) and `dueTime` (HH:MM UTC)
 * so that `computeDeadline(dueDate, dueTime)` returns exactly `target` floored to
 * the minute. Use this when you want a precise, time-of-day-independent deadline.
 */
function makeDeadlineInputs(target: Date): { dueDate: Date; dueTime: string } {
  const dueDate = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()),
  )
  const hh = String(target.getUTCHours()).padStart(2, '0')
  const mm = String(target.getUTCMinutes()).padStart(2, '0')
  return { dueDate, dueTime: `${hh}:${mm}` }
}

const MIN = 60 * 1000

// ── Suite: computeDeadline ────────────────────────────────────────────────────

describe('computeDeadline', () => {
  const baseDate = new Date('2026-08-01T00:00:00.000Z') // 2026-08-01 UTC midnight

  it('returns HH:MM UTC on the dueDate when dueTime is a valid "HH:MM" string', () => {
    const result = computeDeadline(baseDate, '14:30', 1)
    expect(result.toISOString()).toBe('2026-08-01T14:30:00.000Z')
  })

  it('returns 23:59 UTC when dueTime is null', () => {
    const result = computeDeadline(baseDate, null, 1)
    expect(result.toISOString()).toBe('2026-08-01T23:59:00.000Z')
  })

  it('returns 23:59 UTC when dueTime is malformed (non-HH:MM string)', () => {
    const result = computeDeadline(baseDate, 'invalid', 99)
    expect(result.toISOString()).toBe('2026-08-01T23:59:00.000Z')
  })

  it('returns 23:59 UTC when dueTime is an empty string', () => {
    const result = computeDeadline(baseDate, '', 2)
    expect(result.toISOString()).toBe('2026-08-01T23:59:00.000Z')
  })

  it('handles midnight correctly (00:00)', () => {
    const result = computeDeadline(baseDate, '00:00', 3)
    expect(result.toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })

  it('handles end-of-day (23:59)', () => {
    const result = computeDeadline(baseDate, '23:59', 4)
    expect(result.toISOString()).toBe('2026-08-01T23:59:00.000Z')
  })

  it('uses the UTC date of dueDate, not the local date', () => {
    // dueDate is 2026-07-31T23:30:00.000Z — UTC date is July 31, not Aug 1
    const nearMidnight = new Date('2026-07-31T23:30:00.000Z')
    const result = computeDeadline(nearMidnight, '10:00', 5)
    expect(result.toISOString()).toBe('2026-07-31T10:00:00.000Z')
  })
})

// ── Suite: checkAndSendReminders ──────────────────────────────────────────────

describe('checkAndSendReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateAndSendNotification.mockResolvedValue(undefined)
    mockUpdate.mockResolvedValue({})
  })

  // (a) Assignments inside the window are processed; those outside are not
  it('(a) sends a reminder for an assignment whose deadline is exactly 60 min away', async () => {
    const target = nowPlusMs(60 * MIN)
    const { dueDate, dueTime } = makeDeadlineInputs(target)
    const assignment = makeAssignment({ id: 1, dueDate, dueTime })

    mockFindMany.mockResolvedValue([assignment])

    const result = await checkAndSendReminders()

    expect(result.processed).toBe(1)
    expect(mockCreateAndSendNotification).toHaveBeenCalledTimes(1)
    expect(mockCreateAndSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: assignment.userId, type: 'ASSIGNMENT_DUE_SOON' }),
    )
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it('(a) does not send when deadline is only 49 min away (below the 50-min lower bound)', async () => {
    const target = nowPlusMs(49 * MIN)
    const { dueDate, dueTime } = makeDeadlineInputs(target)
    const assignment = makeAssignment({ id: 10, dueDate, dueTime })

    mockFindMany.mockResolvedValue([assignment])

    const result = await checkAndSendReminders()

    expect(result.processed).toBe(0)
    expect(mockCreateAndSendNotification).not.toHaveBeenCalled()
  })

  it('(a) does not send when deadline is 71 min away (above the 70-min upper bound)', async () => {
    const target = nowPlusMs(71 * MIN)
    const { dueDate, dueTime } = makeDeadlineInputs(target)
    const assignment = makeAssignment({ id: 11, dueDate, dueTime })

    mockFindMany.mockResolvedValue([assignment])

    const result = await checkAndSendReminders()

    expect(result.processed).toBe(0)
    expect(mockCreateAndSendNotification).not.toHaveBeenCalled()
  })

  it('(a) sends near the lower boundary (51 min — inside the 50–70 min window)', async () => {
    // Use 51 min to avoid sub-second rounding issues when the exact 50-min timestamp
    // is floored to the minute: floored(now+50min) can be just below windowStart.
    const target = nowPlusMs(51 * MIN)
    const { dueDate, dueTime } = makeDeadlineInputs(target)
    const assignment = makeAssignment({ id: 12, dueDate, dueTime })

    mockFindMany.mockResolvedValue([assignment])

    const result = await checkAndSendReminders()

    expect(result.processed).toBe(1)
  })

  it('(a) sends near the upper boundary (69 min — inside the 50–70 min window)', async () => {
    const target = nowPlusMs(69 * MIN)
    const { dueDate, dueTime } = makeDeadlineInputs(target)
    const assignment = makeAssignment({ id: 13, dueDate, dueTime })

    mockFindMany.mockResolvedValue([assignment])

    const result = await checkAndSendReminders()

    expect(result.processed).toBe(1)
  })

  // (b) PENDING consent users are skipped
  it('(b) skips assignments whose user has coppaConsentStatus PENDING', async () => {
    const target = nowPlusMs(60 * MIN)
    const { dueDate, dueTime } = makeDeadlineInputs(target)
    const assignment = makeAssignment({
      id: 3,
      dueDate,
      dueTime,
      coppaConsentStatus: 'PENDING',
    })

    mockFindMany.mockResolvedValue([assignment])

    const result = await checkAndSendReminders()

    expect(result.processed).toBe(0)
    expect(mockCreateAndSendNotification).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('(b) processes assignments for VERIFIED-consent users normally', async () => {
    const target = nowPlusMs(60 * MIN)
    const { dueDate, dueTime } = makeDeadlineInputs(target)
    const assignment = makeAssignment({ id: 4, dueDate, dueTime, coppaConsentStatus: 'VERIFIED' })

    mockFindMany.mockResolvedValue([assignment])

    const result = await checkAndSendReminders()

    expect(result.processed).toBe(1)
  })

  // (c) Already-reminded assignments excluded at query level
  it('(c) the DB query includes reminderSentAt: null as a filter', async () => {
    mockFindMany.mockResolvedValue([])

    await checkAndSendReminders()

    const callArgs = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(callArgs.where).toMatchObject({ reminderSentAt: null })
  })

  it('(c) the DB query also filters completed: false', async () => {
    mockFindMany.mockResolvedValue([])

    await checkAndSendReminders()

    const callArgs = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(callArgs.where).toMatchObject({ completed: false })
  })

  // (d) dueTime parsing and fallback — tested via computeDeadline unit tests above;
  //     here we verify the integration: valid dueTime is respected at service level.
  it('(d) uses dueTime when valid — deadline must fall in window for notification to fire', async () => {
    const target = nowPlusMs(65 * MIN)
    const { dueDate, dueTime } = makeDeadlineInputs(target)
    const assignment = makeAssignment({ id: 20, dueDate, dueTime })

    mockFindMany.mockResolvedValue([assignment])

    const result = await checkAndSendReminders()

    expect(result.processed).toBe(1)
  })

  it('(d) a malformed dueTime causes deadline to fall to 23:59 UTC, which may exclude it from window', async () => {
    // dueDate is tomorrow — 23:59 UTC tomorrow is well outside [50, 70] min window
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const assignment = makeAssignment({ id: 21, dueDate: tomorrow, dueTime: 'bad-format' })

    mockFindMany.mockResolvedValue([assignment])

    const result = await checkAndSendReminders()

    // 23:59 UTC tomorrow is ~24h from now — outside the 50–70 min window
    expect(result.processed).toBe(0)
    expect(mockCreateAndSendNotification).not.toHaveBeenCalled()
  })

  // (e) reminderSentAt is set after a successful send
  it('(e) updates reminderSentAt on the assignment after sending the notification', async () => {
    const target = nowPlusMs(60 * MIN)
    const { dueDate, dueTime } = makeDeadlineInputs(target)
    const assignment = makeAssignment({ id: 5, dueDate, dueTime })

    mockFindMany.mockResolvedValue([assignment])

    await checkAndSendReminders()

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { reminderSentAt: expect.any(Date) },
    })
  })

  it('(e) does NOT update reminderSentAt when the assignment is outside the window', async () => {
    const target = nowPlusMs(90 * MIN)
    const { dueDate, dueTime } = makeDeadlineInputs(target)
    const assignment = makeAssignment({ id: 6, dueDate, dueTime })

    mockFindMany.mockResolvedValue([assignment])

    await checkAndSendReminders()

    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // (f) Failure on one assignment does not block others
  it('(f) processes remaining assignments even if one throws on update', async () => {
    const target60 = nowPlusMs(60 * MIN)
    const target62 = nowPlusMs(62 * MIN)
    const inputs60 = makeDeadlineInputs(target60)
    const inputs62 = makeDeadlineInputs(target62)

    const failing = makeAssignment({ id: 7, title: 'Failing', ...inputs60 })
    const succeeding = makeAssignment({ id: 8, title: 'Succeeding', ...inputs62 })

    mockFindMany.mockResolvedValue([failing, succeeding])

    // First update throws; second succeeds
    mockUpdate
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({})

    const result = await checkAndSendReminders()

    // Both notifications were dispatched (createAndSendNotification never throws)
    expect(mockCreateAndSendNotification).toHaveBeenCalledTimes(2)
    // Only the second update succeeded, so processed = 1
    expect(result.processed).toBe(1)
  })

  it('returns { processed: 0 } when there are no candidates', async () => {
    mockFindMany.mockResolvedValue([])

    const result = await checkAndSendReminders()

    expect(result.processed).toBe(0)
    expect(mockCreateAndSendNotification).not.toHaveBeenCalled()
  })

  it('notification preview contains the assignment title', async () => {
    const target = nowPlusMs(60 * MIN)
    const { dueDate, dueTime } = makeDeadlineInputs(target)
    const assignment = makeAssignment({ id: 9, title: 'Math Homework', dueDate, dueTime })

    mockFindMany.mockResolvedValue([assignment])

    await checkAndSendReminders()

    expect(mockCreateAndSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        preview: 'Math Homework is due in about an hour',
      }),
    )
  })

  it('notification uses userId as both userId and fromUserId (self-notification pattern)', async () => {
    const target = nowPlusMs(60 * MIN)
    const { dueDate, dueTime } = makeDeadlineInputs(target)
    const assignment = makeAssignment({ id: 15, userId: 99, dueDate, dueTime })

    mockFindMany.mockResolvedValue([assignment])

    await checkAndSendReminders()

    expect(mockCreateAndSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 99, fromUserId: 99 }),
    )
  })
})
