import { api, request } from './client'

export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE'

export interface Question {
  id: number
  setId: number
  orderIndex: number
  questionText: string
  questionType: QuestionType
  options: string[]
  /** Index of the correct option, stored as a string ('0'..'3'), same as the web app. */
  correctAnswer: string
  timeLimit: number
}

export interface QuestionInput {
  questionText: string
  questionType: QuestionType
  options: string[]
  correctAnswer: string
  timeLimit: number
}

export interface QuestionSet {
  id: number
  creatorId: number
  title: string
  description: string | null
  subject: string | null
  visibility: 'PUBLIC' | 'PRIVATE'
  createdAt: string
  updatedAt: string
  creator: { id: number; name: string | null }
  _count?: { questions: number }
}

export interface QuestionSetWithQuestions extends QuestionSet {
  questions: Question[]
}

export interface SetInput {
  title: string
  description?: string | null
  subject?: string | null
  visibility?: 'PUBLIC' | 'PRIVATE'
  questions?: QuestionInput[]
}

export function listSets(params: { mine?: boolean; q?: string; subject?: string } = {}): Promise<QuestionSet[]> {
  return api.get('/sets', {
    mine: params.mine ? 'true' : undefined,
    q: params.q || undefined,
    subject: params.subject || undefined,
  })
}

export function getSet(id: number): Promise<QuestionSetWithQuestions> {
  return api.get(`/sets/${id}`)
}

export function createSet(payload: SetInput): Promise<QuestionSetWithQuestions> {
  return api.post('/sets', payload)
}

/** Metadata only: the backend ignores `questions` on PUT /sets/:id. */
export function updateSet(id: number, payload: Omit<SetInput, 'questions'>): Promise<QuestionSetWithQuestions> {
  return request(`/sets/${id}`, { method: 'PUT', body: payload })
}

export function deleteSet(id: number): Promise<{ id: number }> {
  return api.delete(`/sets/${id}`)
}

export function addQuestion(setId: number, payload: QuestionInput): Promise<Question> {
  return api.post(`/sets/${setId}/questions`, payload)
}

export function updateQuestion(setId: number, questionId: number, payload: Partial<QuestionInput>): Promise<Question> {
  return request(`/sets/${setId}/questions/${questionId}`, { method: 'PUT', body: payload })
}

export function deleteQuestion(setId: number, questionId: number): Promise<{ id: number }> {
  return api.delete(`/sets/${setId}/questions/${questionId}`)
}
