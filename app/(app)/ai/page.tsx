'use client'

import { useCallback, useEffect, useRef, useState, Suspense } from 'react'
import { api } from '../../../lib/api'

interface Msg { id: string; role: 'user' | 'ai'; text: string }

interface ChatSession {
  id: string
  title: string
  messages: Msg[]
  createdAt: number
  updatedAt: number
}

const CHIPS = [
  'What is my GPA?',
  'Upcoming assignments?',
  'College prep advice',
  'Study tips for finals',
  'Weakest subject?',
]

const STORAGE_KEY = 'ns_ai_sessions'
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const all: ChatSession[] = JSON.parse(raw)
    const cutoff = Date.now() - SESSION_TTL
    return all.filter(s => s.createdAt >= cutoff)
  } catch {
    return []
  }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {}
}

function newSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatSessionDate(ts: number): string {
  const toDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const today = toDay(new Date())
  const day   = toDay(new Date(ts))
  const diffDays = Math.round((today - day) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function AIChatInner() {
  const [sessions, setSessions]   = useState<ChatSession[]>([])
  const [activeId, setActiveId]   = useState<string | null>(null)
  const [messages, setMessages]   = useState<Msg[]>([])
  const [input, setInput]         = useState('')
  const [sending, setSending]     = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastAutoSentQ = useRef<string | null>(null)

  useEffect(() => {
    const loaded = loadSessions()
    setSessions(loaded)
    saveSessions(loaded)
  }, [])

  // Auto-send a message passed from the dashboard AiBar via sessionStorage.
  // sessionStorage is consumed immediately so a page reload won't resend.
  useEffect(() => {
    const msg = sessionStorage.getItem('ai_pending_msg')?.trim()
    sessionStorage.removeItem('ai_pending_msg')
    if (!msg || lastAutoSentQ.current === msg) return
    lastAutoSentQ.current = msg

    const sessionId = newSessionId()
    const title = msg.length > 40 ? msg.slice(0, 40) + '…' : msg
    const userMsg: Msg = { id: Date.now().toString(), role: 'user', text: msg }

    setMessages([userMsg])
    setSending(true)
    setActiveId(sessionId)
    setInput('')

    api.chat(msg)
      .then(({ reply }) => {
        const aiMsg: Msg = { id: (Date.now() + 1).toString(), role: 'ai', text: reply }
        setMessages([userMsg, aiMsg])
        setSessions(prev => {
          const next = [{ id: sessionId, title, messages: [userMsg, aiMsg], createdAt: Date.now(), updatedAt: Date.now() }, ...prev]
          saveSessions(next)
          return next
        })
      })
      .catch(() => {
        const errMsg: Msg = { id: (Date.now() + 1).toString(), role: 'ai', text: 'Something went wrong. Please try again.' }
        setMessages([userMsg, errMsg])
        setSessions(prev => {
          const next = [{ id: sessionId, title, messages: [userMsg, errMsg], createdAt: Date.now(), updatedAt: Date.now() }, ...prev]
          saveSessions(next)
          return next
        })
      })
      .finally(() => {
        setSending(false)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startNewChat() {
    setActiveId(null)
    setMessages([])
    setInput('')
  }

  function openSession(session: ChatSession) {
    setActiveId(session.id)
    setMessages(session.messages)
    setInput('')
  }

  function persistMessages(msgs: Msg[], sessionId: string, title: string) {
    setSessions(prev => {
      const exists = prev.some(s => s.id === sessionId)
      const next = exists
        ? prev.map(s => s.id === sessionId ? { ...s, messages: msgs, updatedAt: Date.now() } : s)
        : [{ id: sessionId, title, messages: msgs, createdAt: Date.now(), updatedAt: Date.now() }, ...prev]
      saveSessions(next)
      return next
    })
  }

  const handleSend = useCallback(async function handleSend(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || sending) return
    setInput('')

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
      const { reply } = await api.chat(msg)
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
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, sending, messages, sessions, activeId])

  return (
    <div className="fade-up" style={S.shell}>

      {/* ── Chat History Panel ── */}
      <div style={S.historyPanel}>
        <button onClick={startNewChat} style={S.newChatBtn}>+ New Chat</button>
        <p style={S.historyNotice}>Chats are automatically deleted after 7 days.</p>
        <p style={S.historyLabel}>Recent</p>
        <div style={S.historyList}>
          {sessions.length === 0 ? (
            <p style={S.historyEmpty}>No conversations yet.</p>
          ) : [...sessions].sort((a, b) => b.updatedAt - a.updatedAt).map(s => (
            <button
              key={s.id}
              onClick={() => openSession(s)}
              style={{
                ...S.historyItem,
                background: activeId === s.id ? 'var(--surface-2)' : 'transparent',
                borderColor: activeId === s.id ? 'var(--border)' : 'transparent',
              }}
            >
              <span style={S.historyItemTitle}>{s.title}</span>
              <span style={S.historyItemDate}>{formatSessionDate(s.updatedAt)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Quick Questions ── */}
      <div style={S.sidebar}>
        <p style={S.sidebarLabel}>Quick Questions</p>
        {CHIPS.map(chip => (
          <button key={chip} className="ns-chip" onClick={() => void handleSend(chip)}>{chip}</button>
        ))}
        <p style={S.sidebarHint}>Personalized to your grades &amp; schedule.</p>
      </div>

      {/* ── Chat ── */}
      <div style={S.chat}>
        <div style={S.chatHeader}>
          <div style={S.aiLogo}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
          </div>
          <div>
            <div style={S.aiName}>Futurely AI</div>
          </div>
        </div>

        <div style={S.messages}>
          {messages.length === 0 && (
            <div style={S.empty}>
              <div style={S.emptyLogo}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
                </svg>
              </div>
              <p style={S.emptyTitle}>How can I help you today?</p>
              <p style={S.emptySub}>Ask about your grades, upcoming assignments, or college planning.</p>
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} style={m.role === 'user' ? S.bubbleUser : S.bubbleAi}>
              {m.text}
            </div>
          ))}
          {sending && (
            <div style={{ ...S.bubbleAi, display: 'flex', gap: 6, alignItems: 'center', padding: '14px 18px' }}>
              <span className="ai-dot"/><span className="ai-dot"/><span className="ai-dot"/>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={S.inputBar}>
          <input
            className="ns-input"
            style={{ flex: 1, height: 46, fontSize: 14 }}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
            placeholder="Ask anything about your academics…"
            disabled={sending}
          />
          <button
            className="ns-btn-primary"
            style={{ height: 46, padding: '0 22px', flexShrink: 0, opacity: sending ? 0.5 : 1 }}
            onClick={() => void handleSend()}
            disabled={sending}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AIChatPage() {
  return (
    <Suspense fallback={null}>
      <AIChatInner />
    </Suspense>
  )
}

const S: Record<string, React.CSSProperties> = {
  shell:            { display: 'flex', gap: 20, height: 'calc(100vh - 64px)' },

  // History panel
  historyPanel:     { width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', paddingTop: 4, borderRight: '1px solid var(--border)', paddingRight: 14, gap: 0 },
  newChatBtn:       { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 12, textAlign: 'left' as const, transition: 'background 0.15s' },
  historyNotice:    { fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 12, fontStyle: 'italic' },
  historyLabel:     { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 6 },
  historyList:      { flex: 1, overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: 2 },
  historyEmpty:     { fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' },
  historyItem:      { width: '100%', background: 'transparent', border: '1px solid transparent', borderRadius: 7, padding: '7px 9px', cursor: 'pointer', textAlign: 'left' as const, display: 'flex', flexDirection: 'column' as const, gap: 2, transition: 'background 0.1s' },
  historyItemTitle: { fontSize: 12.5, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, display: 'block' },
  historyItemDate:  { fontSize: 10.5, color: 'var(--text-muted)' },

  // Quick questions
  sidebar:          { width: 160, flexShrink: 0, display: 'flex', flexDirection: 'column' as const, gap: 6, paddingTop: 4 },
  sidebarLabel:     { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 4 },
  sidebarHint:      { fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 },

  // Chat
  chat:             { flex: 1, display: 'flex', flexDirection: 'column' as const, minHeight: 0 },
  chatHeader:       { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' },
  aiLogo:           { width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#2B4A8E,#2D6A4F)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  aiName:           { fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  aiSub:            { fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 },
  messages:         { flex: 1, overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: 10, paddingRight: 4, marginBottom: 16 },
  empty:            { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center' as const, padding: '20px 40px' },
  emptyLogo:        { width: 60, height: 60, borderRadius: 18, background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:       { fontSize: 17, fontWeight: 700, marginBottom: 8 },
  emptySub:         { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 },
  bubbleUser:       { maxWidth: '72%', padding: '11px 16px', borderRadius: '16px 16px 4px 16px', fontSize: 14, lineHeight: 1.55, background: 'var(--primary)', color: '#FFFFFF', alignSelf: 'flex-end', fontWeight: 500 },
  bubbleAi:         { maxWidth: '72%', padding: '11px 16px', borderRadius: '16px 16px 16px 4px', fontSize: 14, lineHeight: 1.55, background: 'var(--surface-2)', border: '1px solid var(--border)', alignSelf: 'flex-start', color: 'var(--text)', whiteSpace: 'pre-wrap' as const },
  inputBar:         { display: 'flex', gap: 10 },
}
