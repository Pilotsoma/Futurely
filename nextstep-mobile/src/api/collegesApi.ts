/**
 * collegesApi.ts
 * Mobile API client for the college search and saved-colleges endpoints.
 */

import { apiFetch } from '../utils/api'

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface CollegeSearchResult {
  unitId: string
  name: string
  city: string
  state: string
  admissionRate: number | null
  sat25th: number | null
  sat75th: number | null
  score: number | null
  label: string | null
}

export interface SavedCollege extends CollegeSearchResult {
  id: number
  createdAt: string
}

interface CollegeSearchApiResponse {
  data: CollegeSearchResult[]
}

interface SavedCollegesApiResponse {
  data: SavedCollege[]
}

interface AddCollegeApiResponse {
  data: SavedCollege
}

interface RemoveCollegeApiResponse {
  data: { removed: boolean }
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function searchColleges(q: string): Promise<CollegeSearchResult[]> {
  const res = await apiFetch<CollegeSearchApiResponse>(
    `/colleges/search?q=${encodeURIComponent(q)}`,
  )
  return res.data
}

export async function getSavedColleges(): Promise<SavedCollege[]> {
  const res = await apiFetch<SavedCollegesApiResponse>('/colleges')
  return res.data
}

export async function addCollege(
  name: string,
  scorecardUnitId?: string,
): Promise<SavedCollege> {
  const body: { name: string; scorecardUnitId?: string } = { name }
  if (scorecardUnitId !== undefined) {
    body.scorecardUnitId = scorecardUnitId
  }
  const res = await apiFetch<AddCollegeApiResponse>('/colleges', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return res.data
}

export async function removeCollege(id: number): Promise<{ removed: boolean }> {
  const res = await apiFetch<RemoveCollegeApiResponse>(`/colleges/${id}`, {
    method: 'DELETE',
  })
  return res.data
}
