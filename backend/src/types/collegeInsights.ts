import type { ScoreLabel } from '../services/collegeScoring'

export type InsightCategory = 'test' | 'gpa' | 'essay' | 'extracurricular' | 'strategy'
export type InsightPriority = 'high' | 'medium' | 'low'

export interface ActionableStep {
  step: string
  category: InsightCategory
  priority: InsightPriority
}

export interface CollegeInsightsPayload {
  narrativeSummary: string
  actionableSteps: ActionableStep[]
}

export type SatPosition = 'well_below_25th' | 'below_25th' | 'in_band' | 'above_75th' | 'not_provided'
export type GpaPosition = 'well_below_mean' | 'below_mean' | 'at_mean' | 'above_mean' | 'not_provided'

export interface CollegeInsightsPromptInput {
  collegeName: string
  score: number
  label: ScoreLabel
  admissionRate: number
  sat25th: number | null
  sat75th: number | null
  satPosition: SatPosition
  satDeltaFrom25th: number | null
  gpaPosition: GpaPosition
  gpaZScore: number | null
}
