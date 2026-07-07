import { apiFetch, ApiError } from '../utils/api'

export interface CollegeInsightsStep {
  step: string
  category: 'test' | 'gpa' | 'essay' | 'extracurricular' | 'strategy'
  priority: 'high' | 'medium' | 'low'
}

export interface CollegeInsights {
  collegeListItemId: number
  collegeName: string
  score: number | null
  label: 'Likely' | 'Possible' | 'Reach' | 'Far Reach' | null
  narrativeSummary: string
  actionableSteps: CollegeInsightsStep[]
  generatedAt: string
  cached: boolean
}

export type InsightsFetchResult =
  | { status: 'success'; data: CollegeInsights }
  | { status: 'error-404' }
  | { status: 'error-503' }

interface CollegeInsightsApiResponse {
  data: CollegeInsights
}

export async function fetchCollegeInsights(id: number): Promise<InsightsFetchResult> {
  try {
    const res = await apiFetch<CollegeInsightsApiResponse>(`/colleges/${id}/insights`)
    return { status: 'success', data: res.data }
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) return { status: 'error-404' }
      if (err.status === 503) return { status: 'error-503' }
    }
    return { status: 'error-503' }
  }
}
