'use client'

import { useCallback, useEffect, useRef, useState, Suspense } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
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

const AiSparkIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
)

function AIChatInner() {
  // Load persisted sessions synchronously on first client render (mirrors the
  // curtainEnter pattern below) so the history sidebar never flashes empty
  // before populating — avoids a layout jump right as the entrance animation settles.
  const [sessions, setSessions]     = useState<ChatSession[]>(() => {
    if (typeof window === 'undefined') return []
    const loaded = loadSessions()
    saveSessions(loaded)
    return loaded
  })
  const [activeId, setActiveId]     = useState<string | null>(null)
  const [messages, setMessages]     = useState<Msg[]>([])
  const [input, setInput]           = useState('')
  const [sending, setSending]       = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prefersReducedMotion = useReducedMotion()

  // Read and immediately clear the curtain-enter flag written by the dashboard
  // when the user submits a query via AiBar. When set, the page rises from below
  // to continue the upward-sweep motion started by the dashboard exit animation.
  // Lazy initializer runs once on first client render — safe for SSR.
  const [curtainEnter] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const flag = sessionStorage.getItem('ai_curtain_enter') === '1'
    if (flag) sessionStorage.removeItem('ai_curtain_enter')
    return flag
  })

  // Auto-grow the composer textarea up to a max height, then scroll internally.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  // Auto-send a message passed from the dashboard AiBar via sessionStorage.
  // We use a cancel flag so React 18 Strict Mode's mount→unmount→remount
  // cycle works correctly: the first mount's callbacks are cancelled on
  // cleanup, the second (live) mount re-reads sessionStorage and completes
  // the send. sessionStorage is only removed after a successful send so the
  // second mount can still read the value.
  useEffect(() => {
    const msg = sessionStorage.getItem('ai_pending_msg')?.trim()
    if (!msg) return

    let cancelled = false
    const sessionId = newSessionId()
    const title = msg.length > 40 ? msg.slice(0, 40) + '…' : msg
    const userMsg: Msg = { id: Date.now().toString(), role: 'user', text: msg }

    setMessages([userMsg])
    setSending(true)
    setActiveId(sessionId)
    setInput('')

    api.chat(msg)
      .then(({ reply }) => {
        if (cancelled) return
        sessionStorage.removeItem('ai_pending_msg')
        const aiMsg: Msg = { id: (Date.now() + 1).toString(), role: 'ai', text: reply }
        setMessages([userMsg, aiMsg])
        setSessions(prev => {
          const next = [{ id: sessionId, title, messages: [userMsg, aiMsg], createdAt: Date.now(), updatedAt: Date.now() }, ...prev]
          saveSessions(next)
          return next
        })
      })
      .catch(() => {
        if (cancelled) return
        sessionStorage.removeItem('ai_pending_msg')
        const errMsg: Msg = { id: (Date.now() + 1).toString(), role: 'ai', text: 'Something went wrong. Please try again.' }
        setMessages([userMsg, errMsg])
        setSessions(prev => {
          const next = [{ id: sessionId, title, messages: [userMsg, errMsg], createdAt: Date.now(), updatedAt: Date.now() }, ...prev]
          saveSessions(next)
          return next
        })
      })
      .finally(() => {
        if (!cancelled) setSending(false)
        if (!cancelled) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
      })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startNewChat() {
    setActiveId(null)
    setMessages([])
    setInput('')
    setHistoryOpen(false)
  }

  function openSession(session: ChatSession) {
    setActiveId(session.id)
    setMessages(session.messages)
    setInput('')
    setHistoryOpen(false)
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

  const isEmpty = messages.length === 0

  // Curtain-rise entry: when coming from dashboard AiBar submit, the page rises
  // from below to continue the upward sweep. Otherwise a simple fade suffices.
  const shellInitial = curtainEnter && !prefersReducedMotion
    ? { y: 56, opacity: 0 }
    : { opacity: 0 }
  const shellTransition = curtainEnter && !prefersReducedMotion
    ? { duration: 0.48, ease: [0.19, 1, 0.22, 1] as [number, number, number, number] }
    : { duration: 0.22, ease: 'easeOut' as const }

  return (
    <motion.div
      className="aic-shell"
      initial={shellInitial}
      animate={{ y: 0, opacity: 1 }}
      transition={shellTransition}
    >

      {/* ── Chat history (collapsible on mobile) ── */}
      <aside className={`aic-history ${historyOpen ? 'aic-history--open' : ''}`}>
        <button onClick={startNewChat} className="aic-new-chat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Chat
        </button>
        <p className="aic-history-notice">Chats are automatically deleted after 7 days.</p>
        <p className="aic-eyebrow">Recent</p>
        <div className="aic-history-list">
          {sessions.length === 0 ? (
            <p className="aic-history-empty">No conversations yet.</p>
          ) : [...sessions].sort((a, b) => b.updatedAt - a.updatedAt).map(s => (
            <button
              key={s.id}
              onClick={() => openSession(s)}
              className={`aic-history-item ${activeId === s.id ? 'aic-history-item--active' : ''}`}
            >
              <span className="aic-history-item-title">{s.title}</span>
              <span className="aic-history-item-date">{formatSessionDate(s.updatedAt)}</span>
            </button>
          ))}
        </div>
      </aside>
      {historyOpen && <div className="aic-scrim" onClick={() => setHistoryOpen(false)} aria-hidden="true" />}

      {/* ── Chat ── */}
      <section className="aic-chat">
        <header className="aic-header">
          <button
            className="aic-history-toggle"
            onClick={() => setHistoryOpen(v => !v)}
            aria-label={historyOpen ? 'Close chat history' : 'Open chat history'}
            aria-expanded={historyOpen}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div className="aic-header-avatar"><AiSparkIcon size={16} /></div>
          <div className="aic-header-name">Futurely AI</div>
        </header>

        <div className="aic-messages" role="log" aria-live="polite" aria-label="Conversation">
          {isEmpty && (
            <div className="aic-empty">
              <div aria-hidden="true" className="aic-orb-wrap">
                <div className="aic-orb-glow" />
                <div className="aic-orb"><AiSparkIcon size={26} /></div>
              </div>
              <h1 className="aic-empty-title">How can I help you today?</h1>
              <p className="aic-empty-sub">Ask about your grades, upcoming assignments, or college planning.</p>

              <div className="aic-chips stagger">
                {CHIPS.map(chip => (
                  <button key={chip} className="aic-chip" onClick={() => void handleSend(chip)}>{chip}</button>
                ))}
              </div>
              <p className="aic-empty-hint">Personalized to your grades &amp; schedule.</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={m.id}
              className={`aic-row ${m.role === 'user' ? 'aic-row--user' : 'aic-row--ai'}`}
              style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}
            >
              {m.role === 'ai' && <div className="aic-avatar" aria-hidden="true"><AiSparkIcon size={14} /></div>}
              <div className={m.role === 'user' ? 'aic-bubble-user' : 'aic-bubble-ai'}>{m.text}</div>
            </div>
          ))}

          {sending && (
            <div className="aic-row aic-row--ai">
              <div className="aic-avatar" aria-hidden="true"><AiSparkIcon size={14} /></div>
              <div className="aic-bubble-ai aic-typing" aria-label="Futurely AI is thinking">
                <span className="ai-dot"/><span className="ai-dot"/><span className="ai-dot"/>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="aic-input-bar">
          <textarea
            ref={textareaRef}
            className="aic-textarea"
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            placeholder="Ask anything about your academics…"
            disabled={sending}
            aria-label="Message Futurely AI"
          />
          <button
            className="aic-send-btn"
            onClick={() => void handleSend()}
            disabled={sending || !input.trim()}
            aria-label="Send message"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </section>

      <style jsx>{`
        .aic-shell {
          display: flex;
          height: calc(100vh - 64px - (var(--page-px) * 2));
          gap: 0;
          position: relative;
        }

        /* ── History sidebar ── */
        .aic-history {
          width: 220px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          padding: 4px 16px 16px 0;
          border-right: 1px solid rgba(255,255,255,0.08);
        }
        .aic-new-chat {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.09);
          background: var(--surface-2);
          color: var(--text);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 14px;
          transition: border-color var(--dur-fast, 120ms) ease, background var(--dur-fast, 120ms) ease, transform var(--dur-fast, 120ms) ease;
        }
        .aic-new-chat:hover { border-color: var(--primary); background: var(--surface-3); transform: translateY(-1px); }
        .aic-new-chat:active { transform: scale(0.98); }
        .aic-history-notice { font-size: 10.5px; color: var(--text-muted); line-height: 1.55; margin-bottom: 16px; font-style: italic; }
        .aic-eyebrow { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); margin-bottom: 8px; }
        .aic-history-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
        .aic-history-empty { font-size: 12px; color: var(--text-muted); font-style: italic; }
        .aic-history-item {
          width: 100%;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 8px 10px;
          cursor: pointer;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 2px;
          transition: background 100ms ease;
        }
        .aic-history-item:hover { background: rgba(255,255,255,0.04); }
        .aic-history-item--active { background: var(--surface-2); border-color: rgba(255,255,255,0.08); }
        .aic-history-item-title { font-size: 12.5px; font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .aic-history-item-date { font-size: 10.5px; color: var(--text-muted); }
        .aic-scrim { display: none; }

        /* ── Chat column ── */
        .aic-chat { flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0; padding-left: 24px; }
        .aic-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .aic-history-toggle { display: none; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.08); background: var(--surface-2); color: var(--text-secondary); }
        .aic-header-avatar {
          width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          background: linear-gradient(135deg, var(--primary) 0%, var(--purple) 55%, var(--accent-blue) 100%);
        }
        .aic-header-name { font-family: var(--font-display, inherit); font-size: 15px; font-weight: 600; color: var(--text); letter-spacing: 0.1px; }

        /* ── Messages ── */
        .aic-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding-right: 4px; margin-bottom: 16px; }

        .aic-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; text-align: center; padding: 20px 24px; }
        .aic-orb-wrap { position: relative; width: 96px; height: 96px; display: flex; align-items: center; justify-content: center; margin-bottom: 22px; }
        .aic-orb-glow {
          position: absolute; inset: 0;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(41,121,255,0.35) 0%, rgba(124,58,237,0.22) 45%, rgba(0,229,255,0.10) 70%, transparent 75%);
          filter: blur(6px);
        }
        .aic-orb {
          position: relative;
          width: 62px; height: 62px; border-radius: 20px;
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          background: linear-gradient(135deg, var(--primary) 0%, var(--purple) 55%, var(--accent-blue) 100%);
          box-shadow: 0 8px 28px rgba(41,121,255,0.35), inset 0 1px 0 rgba(255,255,255,0.25);
        }
        .aic-empty-title { font-family: var(--font-display, inherit); font-size: 24px; font-weight: 600; letter-spacing: -0.2px; color: var(--text); margin-bottom: 10px; }
        .aic-empty-sub { font-size: 14px; color: var(--text-secondary); line-height: 1.6; max-width: 380px; margin-bottom: 28px; }

        .aic-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; max-width: 480px; margin-bottom: 16px; }
        .aic-chip {
          padding: 9px 16px;
          border-radius: 100px;
          border: 1px solid rgba(255,255,255,0.09);
          background: var(--surface-2);
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: border-color 120ms ease, color 120ms ease, background 120ms ease, transform 120ms ease;
        }
        .aic-chip:hover { border-color: var(--primary); color: var(--text); background: var(--primary-dim); transform: translateY(-1px); }
        .aic-chip:active { transform: scale(0.97); }
        .aic-empty-hint { font-size: 11.5px; color: var(--text-muted); }

        /* ── Bubbles ── */
        .aic-row { display: flex; align-items: flex-end; gap: 8px; max-width: 78%; opacity: 0; animation: aicRise 320ms var(--ease-out-quart, ease) both; }
        .aic-row--ai { align-self: flex-start; }
        .aic-row--user { align-self: flex-end; margin-left: auto; }
        .aic-avatar {
          width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0; margin-bottom: 2px;
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          background: linear-gradient(135deg, var(--primary) 0%, var(--purple) 55%, var(--accent-blue) 100%);
        }
        .aic-bubble-user {
          padding: 11px 16px;
          border-radius: 16px 16px 4px 16px;
          font-size: 14px;
          line-height: 1.55;
          background: var(--primary);
          color: #fff;
          font-weight: 500;
        }
        .aic-bubble-ai {
          padding: 11px 16px;
          border-radius: 16px 16px 16px 4px;
          font-size: 14px;
          line-height: 1.55;
          background: var(--surface-2);
          border: 1px solid rgba(255,255,255,0.08);
          color: var(--text);
          white-space: pre-wrap;
        }
        .aic-typing { display: flex; gap: 6px; align-items: center; padding: 14px 18px; }

        /* ── Input bar ── */
        .aic-input-bar {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          padding: 8px;
          border-radius: 18px;
          background: var(--surface-2);
          border: 1px solid rgba(255,255,255,0.08);
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }
        .aic-input-bar:focus-within {
          border-color: var(--primary);
          box-shadow: 0 0 0 4px var(--primary-dim);
        }
        .aic-textarea {
          flex: 1;
          resize: none;
          border: none;
          outline: none;
          background: transparent;
          color: var(--text);
          font-size: 14px;
          font-family: inherit;
          line-height: 1.5;
          padding: 10px 8px;
          max-height: 160px;
        }
        .aic-textarea::placeholder { color: var(--text-muted); }
        .aic-textarea:disabled { opacity: 0.6; }
        .aic-send-btn {
          flex-shrink: 0;
          width: 40px; height: 40px;
          border-radius: 12px;
          border: none;
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, var(--primary) 0%, var(--purple) 100%);
          transition: transform 120ms var(--ease-spring, ease), box-shadow 150ms ease, opacity 120ms ease;
        }
        .aic-send-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(41,121,255,0.4); }
        .aic-send-btn:active:not(:disabled) { transform: scale(0.94); }
        .aic-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .aic-send-btn:focus-visible,
        .aic-chip:focus-visible,
        .aic-new-chat:focus-visible,
        .aic-history-item:focus-visible,
        .aic-history-toggle:focus-visible,
        .aic-textarea:focus-visible {
          outline: 2px solid var(--accent-blue);
          outline-offset: 2px;
        }

        @keyframes aicRise {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes aicBreathe {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50%      { transform: scale(1.08); opacity: 1; }
        }
        @media (prefers-reduced-motion: no-preference) {
          .aic-orb-glow { animation: aicBreathe 4.5s ease-in-out infinite; }
        }
        :global(.reduce-motion) .aic-orb-glow,
        :global(.reduce-motion) .aic-row {
          animation: none !important;
          opacity: 1 !important;
          transform: none !important;
        }

        /* ── Mobile ── */
        @media (max-width: 760px) {
          .aic-history {
            position: fixed;
            top: 0; left: 0; bottom: 0;
            width: 260px;
            z-index: 40;
            background: var(--bg);
            border-right: 1px solid rgba(255,255,255,0.1);
            padding: 20px 16px;
            transform: translateX(-100%);
            transition: transform 220ms var(--ease-out-quart, ease);
          }
          .aic-history--open { transform: translateX(0); }
          .aic-scrim { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 30; }
          .aic-chat { padding-left: 0; }
          .aic-history-toggle { display: flex; }
          .aic-row { max-width: 90%; }
        }
      `}</style>
    </motion.div>
  )
}

export default function AIChatPage() {
  return (
    <Suspense fallback={null}>
      <AIChatInner />
    </Suspense>
  )
}
