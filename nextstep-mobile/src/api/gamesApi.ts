import { api } from './client'

/** Same cadence as the web play page's polling fallback (app/(app)/play/[code]/page.tsx). */
export const GAME_POLL_INTERVAL_MS = 3000

export interface LiveQuestion {
  id: number
  orderIndex?: number
  questionText: string
  questionType: 'MULTIPLE_CHOICE' | 'TRUE_FALSE'
  options: string[]
  timeLimit: number
}

export interface GameParticipant {
  id: number
  sessionId: number
  userId: number
  score: number
  joinedAt: string
  user: { id: number; name: string | null; avatarUrl: string | null }
}

export interface GameSession {
  id: number
  setId: number
  hostId: number
  joinCode: string
  status: 'WAITING' | 'ACTIVE' | 'FINISHED'
  type: 'QUIZ' | 'BATTLE'
  currentQuestion: number
  createdAt: string
  set: { title: string; questions: LiveQuestion[] }
  host: { id: number; name: string | null }
  participants: GameParticipant[]
  /** Host revealed the current question. */
  revealed: boolean
  /** Answers submitted for the current question. */
  answerCount: number
  /** Present only when revealed is true. */
  correctAnswer?: string
}

const path = (code: string, suffix = ''): string => `/games/${encodeURIComponent(code.trim().toUpperCase())}${suffix}`

export function createGame(setId: number, type: 'QUIZ' | 'BATTLE' = 'QUIZ'): Promise<GameSession> {
  return api.post('/games', { setId, type })
}

export function getGame(code: string): Promise<GameSession> {
  return api.get(path(code))
}

export function joinGame(code: string): Promise<GameSession> {
  return api.post(path(code, '/join'))
}

export function startGame(code: string): Promise<GameSession> {
  return api.post(path(code, '/start'))
}

export function submitAnswer(
  code: string,
  payload: { questionId: number; answer: string; timeMs: number },
): Promise<{ isCorrect: boolean; pointsEarned: number }> {
  return api.post(path(code, '/answer'), payload)
}

export function revealResults(code: string): Promise<{ ok: boolean }> {
  return api.post(path(code, '/reveal'))
}

export function nextQuestion(code: string): Promise<{ status: 'ACTIVE' | 'FINISHED'; questionIndex?: number }> {
  return api.post(path(code, '/next'))
}
