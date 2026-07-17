'use client'

import { useState, useRef, useCallback } from 'react'
import { api, ApiError, type AgentModule } from '../../lib/api'

const POLL_INTERVAL_MS = 2500

export type AgentSessionPhase =
  | 'idle'
  | 'running'
  | 'awaiting_confirm'
  | 'completed'
  | 'failed'
  | 'coppa_blocked'

export interface PendingConfirm {
  toolCallId: number
  description: string
}

export interface UseAgentSessionReturn {
  phase: AgentSessionPhase
  sessionId: number | null
  finalResponse: string | null
  pendingConfirm: PendingConfirm | null
  errorMessage: string | null
  startSession: (module: AgentModule, userMessage: string) => Promise<void>
  confirmAction: (confirmed: boolean) => Promise<void>
  reset: () => void
}

export function useAgentSession(): UseAgentSessionReturn {
  const [phase, setPhase] = useState<AgentSessionPhase>('idle')
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [finalResponse, setFinalResponse] = useState<string | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeSessionRef = useRef<number | null>(null)

  function stopPolling() {
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  // Poll a session by id. Uses activeSessionRef to bail out if a new session
  // was started (or reset called) while a poll was in-flight.
  const pollSession = useCallback(async (id: number): Promise<void> => {
    if (activeSessionRef.current !== id) return

    try {
      const session = await api.getAgentSession(id)

      if (activeSessionRef.current !== id) return

      if (session.status === 'COMPLETED') {
        stopPolling()
        setFinalResponse(session.finalResponse)
        setPhase('completed')
        return
      }

      if (session.status === 'FAILED') {
        stopPolling()
        setErrorMessage(session.errorMessage ?? 'The AI agent encountered an error.')
        setPhase('failed')
        return
      }

      // Still RUNNING — check for a pending write intent requiring confirmation.
      const toolCalls = await api.getAgentToolCalls(id)

      if (activeSessionRef.current !== id) return

      const pending = toolCalls.find(
        tc => tc.toolName === 'write_intent' && tc.status === 'PENDING',
      )

      if (pending) {
        const description =
          typeof (pending.toolInput as { description?: unknown }).description === 'string'
            ? (pending.toolInput as { description: string }).description
            : 'The AI wants to make a change. Confirm to proceed.'

        setPendingConfirm({ toolCallId: pending.id, description })
        setPhase('awaiting_confirm')
        // Pause polling — will resume after confirm/deny.
        return
      }

      // Schedule the next poll.
      pollTimerRef.current = setTimeout(() => {
        void pollSession(id)
      }, POLL_INTERVAL_MS)
    } catch {
      // Transient network error — keep polling rather than surfacing a failure.
      if (activeSessionRef.current === id) {
        pollTimerRef.current = setTimeout(() => {
          void pollSession(id)
        }, POLL_INTERVAL_MS)
      }
    }
  }, [])

  const startSession = useCallback(
    async (module: AgentModule, userMessage: string): Promise<void> => {
      stopPolling()
      const newToken = Date.now()
      activeSessionRef.current = -newToken // provisional sentinel until we have a real id

      setPhase('running')
      setSessionId(null)
      setFinalResponse(null)
      setPendingConfirm(null)
      setErrorMessage(null)

      try {
        const { sessionId: id } = await api.startAgentSession(module, userMessage)

        // Another startSession or reset may have fired while the POST was in-flight.
        if (activeSessionRef.current !== -newToken) return

        activeSessionRef.current = id
        setSessionId(id)

        pollTimerRef.current = setTimeout(() => {
          void pollSession(id)
        }, POLL_INTERVAL_MS)
      } catch (err) {
        if (activeSessionRef.current !== -newToken) return

        activeSessionRef.current = null
        if (err instanceof ApiError && err.code === 'COPPA_BLOCKED') {
          setPhase('coppa_blocked')
        } else {
          setErrorMessage(
            err instanceof Error ? err.message : 'Failed to start AI agent session.',
          )
          setPhase('failed')
        }
      }
    },
    [pollSession],
  )

  const confirmAction = useCallback(
    async (confirmed: boolean): Promise<void> => {
      const id = sessionId
      if (id === null) return

      if (!confirmed) {
        // Server sets session to FAILED immediately on deny — stop locally too.
        try {
          await api.confirmAgentAction(id, false)
        } catch {
          // Best-effort; session is treated as failed regardless.
        }
        stopPolling()
        setPendingConfirm(null)
        setErrorMessage('Action cancelled.')
        setPhase('failed')
        return
      }

      // confirmed = true
      try {
        await api.confirmAgentAction(id, true)
      } catch (err) {
        if (err instanceof ApiError && err.httpStatus === 409) {
          // 409 means a concurrent request already claimed the confirmation —
          // that's fine, the orchestrator is already resuming. Just re-poll.
        } else {
          // Surface the error but still resume polling so the session can finish.
          setErrorMessage(err instanceof Error ? err.message : 'Confirmation failed.')
        }
      }

      setPendingConfirm(null)
      setPhase('running')

      // Resume polling after ~2 s to give the orchestrator time to act.
      pollTimerRef.current = setTimeout(() => {
        void pollSession(id)
      }, 2000)
    },
    [sessionId, pollSession],
  )

  const reset = useCallback((): void => {
    stopPolling()
    activeSessionRef.current = null
    setPhase('idle')
    setSessionId(null)
    setFinalResponse(null)
    setPendingConfirm(null)
    setErrorMessage(null)
  }, [])

  return {
    phase,
    sessionId,
    finalResponse,
    pendingConfirm,
    errorMessage,
    startSession,
    confirmAction,
    reset,
  }
}
