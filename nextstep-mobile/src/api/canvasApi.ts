/**
 * canvasApi.ts
 * Mobile API client for the Canvas LMS integration endpoints.
 * All response interfaces are typed from the confirmed backend contract.
 */

import { apiFetch } from '../utils/api'

// ── Canvas grades response interfaces (confirmed backend contract) ─────────────

export interface CanvasSubmission {
  score: number | null
  grade: string | null
  submitted_at: string | null
  workflow_state: string
  late: boolean
  missing: boolean
}

export interface CanvasAssignmentWithSubmission {
  id: number
  name: string
  due_at: string | null
  points_possible: number | null
  html_url: string
  course_id: number
  submission: CanvasSubmission | null
}

export interface CanvasCourseWithAssignments {
  id: number
  name: string
  currentScore: number | null
  currentGrade: string | null
  assignments: CanvasAssignmentWithSubmission[]
}

export interface CanvasConnectionGrades {
  canvasInstanceUrl: string
  canvasUserName: string | null
  courses: CanvasCourseWithAssignments[]
  error?: 'TOKEN_EXPIRED' | 'FETCH_FAILED'
}

export interface GetCanvasGradesResponse {
  data: CanvasConnectionGrades[]
}

// ── Status / dashboard interfaces ─────────────────────────────────────────────

export interface CanvasStatusResponse {
  data: {
    connected: boolean
    instanceUrl: string | null
    userName: string | null
  }
}

export interface CanvasDashboardResponse {
  data: Record<string, unknown>
}

export interface CanvasModule {
  id: number
  name: string
  position: number
  items_count: number
  state: string | null
}

export interface CanvasModulesResponse {
  data: CanvasModule[]
}

export interface CanvasConnectResponse {
  data: {
    connected: boolean
    instanceUrl: string
  }
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function getCanvasStatus(): Promise<CanvasStatusResponse> {
  return apiFetch<CanvasStatusResponse>('/integrations/canvas/status')
}

export async function getCanvasDashboard(): Promise<CanvasDashboardResponse> {
  return apiFetch<CanvasDashboardResponse>('/integrations/canvas/dashboard')
}

export async function getCanvasModules(
  courseId: string | number,
): Promise<CanvasModule[]> {
  const res = await apiFetch<CanvasModulesResponse>(
    `/integrations/canvas/courses/${courseId}/modules`,
  )
  return res.data
}

export async function getCanvasGrades(): Promise<CanvasConnectionGrades[]> {
  const res = await apiFetch<GetCanvasGradesResponse>(
    '/integrations/canvas/grades',
  )
  return res.data
}

export async function connectCanvas(
  instanceUrl: string,
  accessToken: string,
): Promise<CanvasConnectResponse> {
  return apiFetch<CanvasConnectResponse>('/integrations/canvas/connect', {
    method: 'POST',
    body: JSON.stringify({ canvasInstanceUrl: instanceUrl, accessToken }),
  })
}
