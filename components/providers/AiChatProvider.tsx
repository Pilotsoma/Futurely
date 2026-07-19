'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'

// ── Exported types (moved from app/(app)/ai/page.tsx) ────────────────────────

// Prefix stored on AI messages that were produced by an agent session.
// Using a zero-width space so it is invisible in raw text but reliably
// detectable; exported so the page can use the same constant for detection.
export const AGENT_MSG_PREFIX = '​[AGENT]'

export interface Msg { id: string; role: 'user' | 'ai'; text: string }

export interface ChatSession {
  id: string
  title: string
  messages: Msg[]
  createdAt: number
  updatedAt: number
}

// ── Server sync ────────────────────────────────────────────────────────────
// Chat history is persisted on the user's account (GET/PUT /api/ai/sessions)
// so it follows them across devices — it used to live only in localStorage,
// which meant a fresh browser/machine always started with an empty history.

function newSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Fire-and-forget save — the UI already reflects the change optimistically via
// local state, so a transient network failure here just means that one turn
// doesn't make it to the server; it's retried implicitly on the next turn's
// save since each save sends the session's full message list.
function persistToServer(session: ChatSession): void {
  api.saveAiChatSession(session.id, session.title, session.messages).catch(err => {
    console.warn('[AI CHAT] Failed to sync session to server:', err instanceof Error ? err.message : String(err))
  })
}

// ── Context ───────────────────────────────────────────────────────────────────

interface AiChatContextValue {
  sessions: ChatSession[]
  activeId: string | null
  messages: Msg[]
  sending: boolean
  handleSend: (text: string) => Promise<void>
  submitPendingMessage: (msg: string) => void
  startNewChat: () => void
  openSession: (session: ChatSession) => void
  /**
   * Persist a completed agent-mode turn to the server and update the active
   * session in the sidebar.  The agentText is stored with AGENT_MSG_PREFIX
   * prepended so that the rendering layer can detect and badge it correctly.
   * Returns the new session id.
   */
  persistAgentTurn: (userText: string, agentText: string) => string
}

const AiChatContext = createContext<AiChatContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function AiChatProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [sending, setSending] = useState(false)

  // Load this account's chat history from the server once on mount. Not
  // gated on auth state here — the request just 401s harmlessly for a
  // logged-out visitor and this provider only renders inside the
  // authenticated app layout anyway.
  useEffect(() => {
    api.aiChatSessions()
      .then(remote => {
        setSessions(remote.map(s => ({
          id: s.id,
          title: s.title,
          messages: s.messages as Msg[],
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })))
      })
      .catch(() => {})
  }, [])

  // Internal helper — not exported. Upserts a session in local state and
  // syncs the new message list to the server so it's visible on other devices.
  const persistMessages = useCallback((msgs: Msg[], sessionId: string, title: string) => {
    setSessions(prev => {
      const exists = prev.some(s => s.id === sessionId)
      const next = exists
        ? prev.map(s => s.id === sessionId ? { ...s, messages: msgs, updatedAt: Date.now() } : s)
        : [{ id: sessionId, title, messages: msgs, createdAt: Date.now(), updatedAt: Date.now() }, ...prev]
      const updated = next.find(s => s.id === sessionId)
      if (updated) persistToServer(updated)
      return next
    })
  }, [])

  // handleSend — adapted from page's handleSend. Takes `text` directly (no
  // `input` state here). The page passes its composer value and clears its own
  // input state. scrollIntoView is handled by the page via a messages-watching
  // effect instead of living inside this async function.
  const handleSend = useCallback(async (text: string): Promise<void> => {
    const msg = text.trim()
    if (!msg || sending) return

    const userMsg: Msg = { id: Date.now().toString(), role: 'user', text: msg }
    const withUser = [...messages, userMsg]
    setMessages(withUser)
    setSending(true)

    // Determine or create session
    let sessionId = activeId
    let sessionTitle = msg.length > 40 ? msg.slice(0, 40) + '…' : msg
    if (!sessionId) {
      sessionId = newSessionId()
      setActiveId(sessionId)
    } else {
      const existing = sessions.find(s => s.id === sessionId)
      if (existing) sessionTitle = existing.title
    }

    try {
      const history = messages.slice(-10).map(m => ({
        role: m.role === 'ai' ? 'assistant' as const : 'user' as const,
        content: m.text,
      }))
      const { reply } = await api.chat(msg, history)
      const aiMsg: Msg = { id: (Date.now() + 1).toString(), role: 'ai', text: reply }
      const finalMsgs = [...withUser, aiMsg]
      setMessages(finalMsgs)
      persistMessages(finalMsgs, sessionId, sessionTitle)
    } catch {
      const errMsg: Msg = { id: (Date.now() + 1).toString(), role: 'ai', text: 'Something went wrong. Please try again.' }
      const finalMsgs = [...withUser, errMsg]
      setMessages(finalMsgs)
      persistMessages(finalMsgs, sessionId, sessionTitle)
    } finally {
      setSending(false)
    }
  }, [messages, sessions, activeId, sending, persistMessages])

  // submitPendingMessage — adapted from the page's auto-send effect body, but
  // as a standalone function. Called once per page mount when ai_pending_msg is
  // present in sessionStorage. No AbortController is intentional: the fetch
  // completing after navigation is exactly what keeps the reply alive.
  const submitPendingMessage = useCallback((msg: string): void => {
    if (sending) return

    const sessionId = newSessionId()
    const title = msg.length > 40 ? msg.slice(0, 40) + '…' : msg
    const userMsg: Msg = { id: Date.now().toString(), role: 'user', text: msg }

    setMessages([userMsg])
    setSending(true)
    setActiveId(sessionId)

    api.chat(msg)
      .then(({ reply }) => {
        const aiMsg: Msg = { id: (Date.now() + 1).toString(), role: 'ai', text: reply }
        const finalMsgs = [userMsg, aiMsg]
        setMessages(finalMsgs)
        persistMessages(finalMsgs, sessionId, title)
      })
      .catch(() => {
        const errMsg: Msg = { id: (Date.now() + 1).toString(), role: 'ai', text: 'Something went wrong. Please try again.' }
        const finalMsgs = [userMsg, errMsg]
        setMessages(finalMsgs)
        persistMessages(finalMsgs, sessionId, title)
      })
      .finally(() => {
        setSending(false)
      })
  }, [sending, persistMessages])

  // persistAgentTurn — saves a completed agent-mode exchange to the server
  // and updates the running session list so the sidebar reflects it immediately.
  // The AI text is stored with AGENT_MSG_PREFIX so that reopening the session
  // via openSession() still renders the "Agent" badge in the message list.
  const persistAgentTurn = useCallback((userText: string, agentText: string): string => {
    const sessionId = newSessionId()
    const title = userText.length > 40 ? userText.slice(0, 40) + '…' : userText
    const userMsg: Msg = { id: Date.now().toString(), role: 'user', text: userText }
    const aiMsg: Msg = {
      id: (Date.now() + 1).toString(),
      role: 'ai',
      text: AGENT_MSG_PREFIX + agentText,
    }
    const msgs: Msg[] = [userMsg, aiMsg]
    // Update active session + live message list so the conversation is
    // immediately visible through the normal messages.map() rendering path.
    setActiveId(sessionId)
    setMessages(msgs)
    persistMessages(msgs, sessionId, title)
    return sessionId
  }, [persistMessages])

  // startNewChat — only handles provider-owned state. Page-local state (input,
  // historyOpen) is cleared by the page's own wrapper around this function.
  const startNewChat = useCallback((): void => {
    setActiveId(null)
    setMessages([])
  }, [])

  // openSession — only handles provider-owned state. Page-local state is
  // cleared by the page's own wrapper.
  const openSession = useCallback((session: ChatSession): void => {
    setActiveId(session.id)
    setMessages(session.messages)
  }, [])

  const value = useMemo<AiChatContextValue>(() => ({
    sessions,
    activeId,
    messages,
    sending,
    handleSend,
    submitPendingMessage,
    startNewChat,
    openSession,
    persistAgentTurn,
  }), [sessions, activeId, messages, sending, handleSend, submitPendingMessage, startNewChat, openSession, persistAgentTurn])

  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

export function useAiChat(): AiChatContextValue {
  const ctx = useContext(AiChatContext)
  if (!ctx) throw new Error('useAiChat must be used within AiChatProvider')
  return ctx
}
