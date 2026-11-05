import { api, requestEnvelope } from './client'
import type {
  Assignment,
  CreateAssignmentRequest,
  ListAssignmentsMeta,
  ListAssignmentsParams,
} from '../types/assignments'

export interface ListAssignmentsResult {
  data: Assignment[]
  meta: ListAssignmentsMeta
}

export async function listAssignments(params: ListAssignmentsParams = {}): Promise<ListAssignmentsResult> {
  const query: Record<string, string | number> = {}
  if (params.status) query.status = params.status
  if (params.cursor !== undefined) query.cursor = params.cursor
  if (params.limit !== undefined) query.limit = params.limit

  const { data, meta } = await requestEnvelope<Assignment[], ListAssignmentsMeta>('/assignments', {
    method: 'GET',
    query,
  })
  return { data, meta: meta ?? { nextCursor: null, hasNextPage: false, count: data.length } }
}

// The backend requires dueDate as a full ISO timestamp. Like the web client, build
// it from the user's local calendar day so their timezone is captured; a bare
// "YYYY-MM-DD" means that local day at dueTime (default end of day).
export function toDueDateIso(dueDate: string, dueTime = '23:59'): string {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate.trim())
  if (!day) return dueDate
  const time = /^(\d{1,2}):(\d{2})$/.exec(dueTime.trim())
  const [hours, minutes] = time ? [Number(time[1]), Number(time[2])] : [23, 59]
  return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]), hours, minutes).toISOString()
}

export async function createAssignment(payload: CreateAssignmentRequest): Promise<Assignment> {
  return api.post('/assignments', {
    ...payload,
    dueDate: toDueDateIso(payload.dueDate, payload.dueTime),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
}

export async function completeAssignment(id: number, completed: boolean): Promise<Assignment> {
  return api.patch(`/assignments/${id}/complete`, { completed })
}

export async function deleteAssignment(id: number): Promise<{ deleted: true }> {
  return api.delete(`/assignments/${id}`)
}
