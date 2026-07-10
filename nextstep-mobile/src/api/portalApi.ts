/**
 * portalApi.ts
 * Mobile API client for the live school portal integration.
 *
 * This version uses direct fetch instead of apiFetch so we can debug:
 * - exact URL being called
 * - whether auth token exists
 * - backend status code
 * - backend response body
 *
 * SECURITY NOTE:
 * This file never stores portal passwords. Passwords are passed only in the
 * connect request body and are discarded immediately after the request.
 */

import { API_BASE_URL } from '../constants/api'
import { getToken } from '../utils/auth'

// ── Shared types ──────────────────────────────────────────────────────────────

export interface NormalizedAssignment {
  name: string
  category: string
  score: number | null
  totalPoints: number | null
  percentage: string
  dateDue: string
}

export interface NormalizedCourse {
  id: string
  name: string
  teacher: string
  period: string
  average: number | null
  letterGrade: string | null
  assignments: NormalizedAssignment[]
}

export interface PortalStatus {
  connected: boolean
  systemType: 'HAC' | 'PowerSchool' | null
  districtUrl: string | null
  lastSynced: string | null
  sessionExpiresIn: number
}

export interface ConnectResult {
  connected: boolean
  systemType: 'HAC' | 'PowerSchool'
}

export interface PortalGpa {
  gpa: number | null
  unweightedGpa: number | null
  weightedGpa: number | null
  courseCount: number
  systemType: 'HAC' | 'PowerSchool'
}

// ── Classwork types ───────────────────────────────────────────────────────────

export interface PortalClassworkScore {
  name: string
  score: number | null
  dateDue: string
  category: string
  percentage: string
  totalPoints: number | null
}

export interface PortalClassworkClass {
  name: string
  room: string
  period: string
  teacher: string
  average: number | null
  categoryWeights: Record<string, number>
  scores: PortalClassworkScore[]
}

export interface PortalClassworkResult {
  classes: PortalClassworkClass[]
  currentPeriod: string
  availablePeriods: string[]
}

// ── Transcript types ──────────────────────────────────────────────────────────

export interface PortalTranscriptCourse {
  name: string
  grade: string
  credits: string
}

export interface PortalTranscriptSemester {
  year: string
  courses: PortalTranscriptCourse[]
  semester: string
}

export interface PortalTranscriptData {
  quartile: string
  classRank: string
  semesters: PortalTranscriptSemester[]
  weightedGPA: string
  cumulativeGPA: string
  unweightedGPA: string
}

export interface PortalTranscriptResult {
  systemType: string
  transcript: PortalTranscriptData
}

// ── Schedule types ────────────────────────────────────────────────────────────

export interface PortalScheduleEntry {
  room: string
  period: string
  teacher: string
  courseCode: string
  courseName: string
}

// ── Contact teacher types ─────────────────────────────────────────────────────

export interface PortalTeacherCourse {
  period: string
  courseName: string
}

export interface PortalTeacher {
  name: string
  room: string
  email: string
  courses: PortalTeacherCourse[]
  building: string
}

// ── Internal request helper ───────────────────────────────────────────────────

async function portalRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken()

  const normalizedBaseUrl = API_BASE_URL.endsWith('/')
    ? API_BASE_URL.slice(0, -1)
    : API_BASE_URL

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${normalizedBaseUrl}${normalizedPath}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response: Response

  try {
    response = await fetch(url, {
      ...options,
      headers,
    })
  } catch (error: unknown) {
    throw new Error(
      `Network request failed. The app could not reach the backend. Check API_BASE_URL in src/constants/api.ts. Current URL: ${url}`,
    )
  }

  const text = await response.text()

  let json: unknown = {}

  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text }
  }

  if (!response.ok) {
    const body = (json && typeof json === 'object' ? json : {}) as {
      error?: string | { message?: string }
      message?: string
    }
    const message =
      typeof body.error === 'string'
        ? body.error
        : body.error?.message || body.message || response.statusText

    throw new Error(`${response.status}: ${message}`)
  }

  return json as T
}

// ── Portal connection ─────────────────────────────────────────────────────────

export async function connectHac(
  baseUrl: string,
  username: string,
  password: string,
): Promise<ConnectResult> {
  const res = await portalRequest<{
    data: {
      sessionToken?: string
      systemType?: string
    }
  }>('/integrations/grades/hac/login', {
    method: 'POST',
    body: JSON.stringify({
      baseUrl,
      username,
      password,
    }),
  })

  return {
    connected: Boolean(res.data?.sessionToken),
    systemType: 'HAC',
  }
}

export async function connectPowerSchool(
  baseUrl: string,
  username: string,
  password: string,
): Promise<ConnectResult> {
  const res = await portalRequest<{
    data: {
      sessionToken?: string
      systemType?: string
    }
  }>('/integrations/grades/powerschool/login', {
    method: 'POST',
    body: JSON.stringify({
      baseUrl,
      username,
      password,
    }),
  })

  return {
    connected: Boolean(res.data?.sessionToken),
    systemType: 'PowerSchool',
  }
}

// ── Status ────────────────────────────────────────────────────────────────────

export async function getPortalStatus(): Promise<PortalStatus> {
  const res = await portalRequest<{ data: PortalStatus }>(
    '/integrations/grades/status',
  )

  return res.data
}

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'complete' | 'error'
  lastSyncedAt: string | null
  errorMessage: string | null
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const res = await portalRequest<{ data: SyncStatus }>(
    '/integrations/grades/sync-status',
  )
  return res.data
}

// ── Grade data ────────────────────────────────────────────────────────────────

export async function getCurrentPortalGrades(): Promise<NormalizedCourse[]> {
  const res = await portalRequest<{
    data: {
      systemType: string
      grades: NormalizedCourse[]
    }
  }>('/integrations/grades/current')

  return res.data.grades ?? []
}

export async function getPortalGpa(): Promise<PortalGpa> {
  const res = await portalRequest<{ data: PortalGpa }>(
    '/integrations/grades/gpa',
  )

  return res.data
}

export async function getPortalClasswork(period?: string): Promise<PortalClassworkResult> {
  const path =
    period !== undefined
      ? `/integrations/grades/classwork?period=${encodeURIComponent(period)}`
      : '/integrations/grades/classwork'

  const res = await portalRequest<{ data: PortalClassworkResult }>(path)
  return res.data
}

export interface PortalReportCardCourse {
  name: string
  period: string
  teacher: string
  attemptedCredit: string
  earnedCredit: string
  /** Numeric grade string (e.g. "92") or "" if not yet posted */
  sixWeeks1: string
  sixWeeks2: string
  sixWeeks3: string
  /** Semester 1 exam grade string or "" */
  exam1: string
  /** Semester 1 final average string or "" */
  semester1: string
  sixWeeks4: string
  sixWeeks5: string
  sixWeeks6: string
  /** Semester 2 exam grade string or "" */
  exam2: string
  /** Semester 2 final average string or "" */
  semester2: string
}

export interface PortalReportCardResult {
  reportingPeriods: string[]
  currentPeriod: string
  /** Set when HAC has an explanatory status message (e.g. no report cards published yet). */
  message?: string
  /** Flat list of courses spanning the full year, one row per course matching HAC's report card table. */
  courses: PortalReportCardCourse[]
}

export async function getPortalReportCard(period?: string): Promise<PortalReportCardResult> {
  const path =
    period !== undefined
      ? `/integrations/grades/report-card?period=${encodeURIComponent(period)}`
      : '/integrations/grades/report-card'

  const res = await portalRequest<{ data: PortalReportCardResult }>(path)
  return res.data
}

export async function getPortalTranscript(): Promise<PortalTranscriptResult> {
  const res = await portalRequest<{ data: PortalTranscriptResult }>(
    '/integrations/grades/transcript',
  )
  return res.data
}

export async function getPortalSchedule(): Promise<PortalScheduleEntry[]> {
  const res = await portalRequest<{ data: { schedule: PortalScheduleEntry[] } }>(
    '/integrations/grades/schedule',
  )
  return res.data.schedule ?? []
}

export async function getPortalContactTeachers(): Promise<PortalTeacher[]> {
  const res = await portalRequest<{ data: { teachers: PortalTeacher[] } }>(
    '/integrations/grades/contact-teachers',
  )
  return res.data.teachers ?? []
}

// ── Attendance types ──────────────────────────────────────────────────────────

export interface AttendancePeriod {
  period: string
  status: string
}

export interface AttendanceDay {
  date: string
  dayOfWeek: string
  dayNum: number
  bgColor: string
  description: string
  isSchoolClosed: boolean
  periods: AttendancePeriod[]
}

export interface AttendanceSummary {
  absences: number
  excused: number
  tardies: number
  multiple: number
}

export interface PortalAttendanceResult {
  month: string
  year: number
  monthIndex: number
  days: AttendanceDay[]
  summary: AttendanceSummary
}

// ── Progress report types ─────────────────────────────────────────────────────

export interface ProgressReportCourse {
  name: string
  period: string
  average: string
  letterGrade: string
  teacher: string
}

export interface PortalProgressReportResult {
  availableDates: string[]
  currentDate: string
  courses: ProgressReportCourse[]
}

// ── Attendance ────────────────────────────────────────────────────────────────

export async function getPortalAttendance(
  monthOffset: number,
): Promise<PortalAttendanceResult> {
  const res = await portalRequest<{ data: PortalAttendanceResult }>(
    `/integrations/grades/attendance?monthOffset=${monthOffset}`,
  )
  return res.data
}

// ── Progress report ───────────────────────────────────────────────────────────

export async function getProgressReport(
  date?: string,
): Promise<PortalProgressReportResult> {
  const path =
    date !== undefined
      ? `/integrations/grades/progress-report?date=${encodeURIComponent(date)}`
      : '/integrations/grades/progress-report'

  const res = await portalRequest<{ data: PortalProgressReportResult }>(path)
  return res.data
}

// ── Disconnect ────────────────────────────────────────────────────────────────

export async function disconnectPortal(): Promise<{ disconnected: boolean }> {
  const res = await portalRequest<{ data: { disconnected: boolean } }>(
    '/integrations/grades/session',
    {
      method: 'DELETE',
    },
  )

  return res.data
}