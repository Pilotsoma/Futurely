import { api } from './client'

// Student-side counselor endpoints (backend/src/routes/students.ts). The
// /counselor/* routes are counselor-facing and intentionally not used here.

export interface CounselorSummary {
  id: number
  name: string | null
  email: string
}

export interface CounselorLink {
  id: number
  counselorId: number
  studentId: number
  status: string
  createdAt: string
  counselor: CounselorSummary
}

export interface CounselorChatMessage {
  id: number
  body: string
  senderId: number | null
  senderName: string | null
  createdAt: string
}

export interface CounselorChatPage {
  messages: CounselorChatMessage[]
  nextCursor: number | null
}

export interface CounselorActionItem {
  id: number
  title: string
  description: string | null
  dueDate: string | null
  completed: boolean
  createdAt: string
}

export interface CounselorRecommendation {
  id: number
  courseName: string
  courseCode: string | null
  rationale: string | null
  semester: string
  createdAt: string
}

export interface CounselorPortal {
  counselor: CounselorSummary
  notes: { id: number; body: string; createdAt: string; updatedAt: string }[]
  recommendations: CounselorRecommendation[]
  actionItems: CounselorActionItem[]
}

export async function listActiveCounselorLinks(): Promise<CounselorLink[]> {
  return api.get('/students/counselor-links/active')
}

/** Newest-first page of messages (server order). Pass `cursor` for older pages. */
export async function getCounselorChat(counselorId: number, cursor?: number): Promise<CounselorChatPage> {
  return api.get(`/students/counselor-chat/${counselorId}`, cursor !== undefined ? { cursor } : undefined)
}

export async function sendCounselorMessage(counselorId: number, body: string): Promise<CounselorChatMessage> {
  return api.post(`/students/counselor-chat/${counselorId}`, { body })
}

export async function getCounselorPortal(counselorId: number): Promise<CounselorPortal> {
  return api.get(`/students/counselor-portal/${counselorId}`)
}
