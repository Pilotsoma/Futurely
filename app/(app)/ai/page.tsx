'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { renderChatMarkdown } from '../../../lib/chatMarkdown'
import { useAiChat, type ChatSession } from '../../../components/providers/AiChatProvider'
import { useAgentSession } from '../../../components/agent/useAgentSession'
import AgentConfirmDialog from '../../../components/agent/AgentConfirmDialog'

const CHIPS = [
  'What is my GPA?',
  'Upcoming assignments?',
  'College prep advice',
  'Study tips for finals',
  'Weakest subject?',
]

// Indicates that a message was produced by an agent session.
const AGENT_MSG_PREFIX = '​[AGENT]'

function isAgentMessage(text: string): boolean {
  return text.startsWith(AGENT_MSG_PREFIX)
}

function stripAgentPrefix(text: string): string {
  return text.startsWith(AGENT_MSG_PREFIX) ? text.slice(AGENT_MSG_PREFIX.length) : text
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
  <Image src="/logo.png" alt="" width={size} height={size} style={{ objectFit: 'contain', width: size, height: size }} />
)

function AIChatInner() {
  const {
    sessions,
    activeId,
    messages,
    sending,
    handleSend,
    startNewChat: ctxStartNewChat,
    openSession: ctxOpenSession,
    submitPendingMessage,
  } = useAiChat()

  const [input, setInput]           = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [agentMode, setAgentMode]     = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prefersReducedMotion = useReducedMotion()

  const {
    phase: agentPhase,
    finalResponse: agentFinalResponse,
    pendingConfirm: agentPendingConfirm,
    errorMessage: agentErrorMessage,
    startSession,
    confirmAction,
    reset: resetAgent,
  } = useAgentSession()

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
  // Fires once per page mount ([] deps). The provider's submitPendingMessage
  // owns the async logic and keeps state alive across navigations.
  // sessionStorage is cleared *before* the call so that React 18 Strict Mode's
  // double-invocation (effect → cleanup → effect) reads null on the second
  // fire and exits early, preventing duplicate API requests.
  useEffect(() => {
    const msg = sessionStorage.getItem('ai_pending_msg')?.trim()
    if (!msg) return
    sessionStorage.removeItem('ai_pending_msg')
    submitPendingMessage(msg)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll to the latest message whenever the message list grows.
  useEffect(() => {
    if (messages.length === 0) return
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }, [messages.length])

  // Agent responses are shown inline in the messages section while the session
  // is active; they are not injected into the persistent chat history (that
  // lives in localStorage). The full record is available at /ai/activity.

  // Page-local wrappers add UI cleanup (input, history panel) on top of the
  // provider-owned state changes.
  function startNewChat() {
    ctxStartNewChat()
    resetAgent()
    setInput('')
    setAgentMode(false)
    setHistoryOpen(false)
  }

  function openSession(session: ChatSession) {
    ctxOpenSession(session)
    resetAgent()
    setInput('')
    setAgentMode(false)
    setHistoryOpen(false)
  }

  // In agent mode the send button starts an agent session instead of the
  // regular api.chat() call.
  async function handleAgentSend(text: string) {
    const msg = text.trim()
    if (!msg) return
    setInput('')
    await startSession('CHAT', msg)
  }

  async function handleConfirmAgent(confirmed: boolean) {
    setConfirmLoading(true)
    try {
      await confirmAction(confirmed)
    } finally {
      setConfirmLoading(false)
    }
  }

  const isEmpty = messages.length === 0 && agentPhase === 'idle'
  const agentActive = agentPhase !== 'idle'

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
        <Link href="/ai/activity" className="aic-activity-link">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          AI Activity
        </Link>
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
          <div className="aic-header-name">myFuturely AI</div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className={`aic-agent-toggle${agentMode ? ' aic-agent-toggle--on' : ''}`}
              onClick={() => {
                if (agentActive) return // don't switch modes mid-session
                if (agentMode) { setAgentMode(false); resetAgent() }
                else setAgentMode(true)
              }}
              aria-pressed={agentMode}
              title={agentMode ? 'Switch to Quick AI' : 'Switch to AI Agent (deeper analysis)'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              {agentMode ? 'Agent Mode' : 'Quick AI'}
            </button>
          </div>
        </header>

        <div className="aic-messages" role="log" aria-live="polite" aria-label="Conversation">
          {isEmpty && (
            <div className="aic-empty">
              <div aria-hidden="true" className="aic-orb-wrap">
                <div className="aic-orb-glow" />
                <div className="aic-orb"><AiSparkIcon size={38} /></div>
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

          {messages.map((m, i) => {
            const isAgent = m.role === 'ai' && isAgentMessage(m.text)
            const displayText = isAgent ? stripAgentPrefix(m.text) : m.text
            return (
              <div
                key={m.id}
                className={`aic-row ${m.role === 'user' ? 'aic-row--user' : 'aic-row--ai'}`}
                style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}
              >
                {m.role === 'ai' && <div className="aic-avatar" aria-hidden="true"><AiSparkIcon size={14} /></div>}
                {m.role === 'ai' ? (
                  <div className="aic-bubble-ai">
                    {isAgent && <span className="aic-agent-badge">Agent</span>}
                    <span dangerouslySetInnerHTML={{ __html: renderChatMarkdown(displayText) }} />
                  </div>
                ) : (
                  <div className="aic-bubble-user">{displayText}</div>
                )}
              </div>
            )
          })}

          {/* Agent session: running state */}
          {agentPhase === 'running' && (
            <div className="aic-row aic-row--ai">
              <div className="aic-avatar" aria-hidden="true"><AiSparkIcon size={14} /></div>
              <div className="aic-bubble-ai aic-agent-working" aria-label="AI Agent is working">
                <div className="aic-agent-spinner" aria-hidden="true" />
                <span>Thinking…</span>
              </div>
            </div>
          )}

          {/* Agent session: awaiting confirmation */}
          {agentPhase === 'awaiting_confirm' && (
            <div className="aic-row aic-row--ai">
              <div className="aic-avatar" aria-hidden="true"><AiSparkIcon size={14} /></div>
              <div className="aic-bubble-ai">
                <span className="aic-agent-badge aic-agent-badge--warning">Needs approval</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  The AI wants to take an action. Review and confirm or cancel below.
                </span>
              </div>
            </div>
          )}

          {/* Agent session: completed — shown inline before being reset */}
          {agentPhase === 'completed' && agentFinalResponse && (
            <div className="aic-row aic-row--ai">
              <div className="aic-avatar" aria-hidden="true"><AiSparkIcon size={14} /></div>
              <div className="aic-bubble-ai">
                <span className="aic-agent-badge">Agent</span>
                <span dangerouslySetInnerHTML={{ __html: renderChatMarkdown(agentFinalResponse) }} />
              </div>
            </div>
          )}

          {/* Agent session: error */}
          {(agentPhase === 'failed' || agentPhase === 'coppa_blocked') && (
            <div className="aic-row aic-row--ai">
              <div className="aic-avatar" aria-hidden="true"><AiSparkIcon size={14} /></div>
              <div className="aic-bubble-ai" style={{ color: 'var(--error)' }}>
                {agentPhase === 'coppa_blocked'
                  ? 'This feature requires parental consent. Please ask a parent or guardian to approve AI Check-ins in the Parent Portal.'
                  : (agentErrorMessage ?? 'The AI Agent encountered an error. Please try again.')}
              </div>
            </div>
          )}

          {sending && (
            <div className="aic-row aic-row--ai">
              <div className="aic-avatar" aria-hidden="true"><AiSparkIcon size={14} /></div>
              <div className="aic-bubble-ai aic-typing" aria-label="myFuturely AI is thinking">
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
                const text = input
                if (agentMode) {
                  void handleAgentSend(text)
                } else {
                  setInput('')
                  void handleSend(text)
                }
              }
            }}
            placeholder={agentMode ? 'Ask the AI Agent (deep analysis)…' : 'Ask anything about your academics…'}
            disabled={sending || agentPhase === 'running' || agentPhase === 'awaiting_confirm'}
            aria-label={agentMode ? 'Message AI Agent' : 'Message myFuturely AI'}
          />
          <button
            className="aic-send-btn"
            onClick={() => {
              if (agentMode) {
                void handleAgentSend(input)
              } else {
                const text = input
                setInput('')
                void handleSend(text)
              }
            }}
            disabled={sending || !input.trim() || agentPhase === 'running' || agentPhase === 'awaiting_confirm'}
            aria-label="Send message"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </section>

      {/* Agent confirmation dialog — shown above everything when a write intent is pending */}
      {agentPhase === 'awaiting_confirm' && agentPendingConfirm && (
        <AgentConfirmDialog
          description={agentPendingConfirm.description}
          onConfirm={() => void handleConfirmAgent(true)}
          onDeny={() => void handleConfirmAgent(false)}
          loading={confirmLoading}
        />
      )}

      <style jsx>{`
        /* :global because this class lives on a motion.div — styled-jsx's
           scoping class only gets attached to plain native elements, so a
           scoped selector here would silently never match. */
        :global(.aic-shell) {
          display: flex;
          height: calc((100vh / var(--ui-zoom, 1)) - (var(--page-px) * 2));
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
          padding: 5px;
          background: var(--surface-2);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .aic-header-name { font-family: var(--font-display, inherit); font-size: 15px; font-weight: 600; color: var(--text); letter-spacing: 0.1px; }

        /* ── Messages ── */
        .aic-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding-right: 4px; margin-bottom: 16px; }

        .aic-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; text-align: center; padding: 20px 24px; }
        .aic-orb-wrap { position: relative; width: 116px; height: 116px; display: flex; align-items: center; justify-content: center; margin-bottom: 22px; }
        .aic-orb-glow {
          position: absolute; inset: 0;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(41,121,255,0.35) 0%, rgba(124,58,237,0.22) 45%, rgba(0,229,255,0.10) 70%, transparent 75%);
          filter: blur(6px);
        }
        .aic-orb {
          position: relative;
          width: 80px; height: 80px; border-radius: 22px;
          display: flex; align-items: center; justify-content: center;
          padding: 11px;
          background: var(--surface-2);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 8px 28px rgba(41,121,255,0.25), inset 0 1px 0 rgba(255,255,255,0.12);
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
          padding: 4px;
          background: var(--surface-2);
          border: 1px solid rgba(255,255,255,0.08);
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

        /* ── Activity log link in sidebar ── */
        .aic-activity-link {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.06);
          background: transparent;
          color: var(--text-muted);
          font-size: 11.5px;
          font-weight: 500;
          text-decoration: none;
          margin-bottom: 10px;
          transition: color 120ms ease, background 120ms ease;
        }
        .aic-activity-link:hover { color: var(--primary); background: rgba(41,121,255,0.06); }

        /* ── Agent mode toggle in header ── */
        .aic-agent-toggle {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 11px;
          border-radius: 100px;
          border: 1px solid rgba(255,255,255,0.08);
          background: var(--surface-2);
          color: var(--text-muted);
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
        }
        .aic-agent-toggle--on {
          border-color: rgba(41,121,255,0.4);
          color: var(--primary);
          background: rgba(41,121,255,0.08);
        }
        .aic-agent-toggle:hover { border-color: rgba(41,121,255,0.3); color: var(--primary); }

        /* ── Agent badge inside bubbles ── */
        .aic-agent-badge {
          display: inline-flex;
          align-items: center;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--primary);
          background: rgba(41,121,255,0.1);
          border: 1px solid rgba(41,121,255,0.2);
          border-radius: 4px;
          padding: 2px 6px;
          margin-bottom: 6px;
          margin-right: 4px;
          vertical-align: middle;
        }
        .aic-agent-badge--warning {
          color: #F59E0B;
          background: rgba(245,158,11,0.1);
          border-color: rgba(245,158,11,0.2);
        }

        /* ── Agent working indicator ── */
        .aic-agent-working {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          color: var(--text-secondary);
          font-size: 13px;
        }
        .aic-agent-spinner {
          width: 14px; height: 14px;
          border-radius: 50%;
          border: 2px solid rgba(41,121,255,0.2);
          border-top-color: #2979FF;
          animation: aicAgentSpin 0.9s linear infinite;
          flex-shrink: 0;
        }
        @keyframes aicAgentSpin { to { transform: rotate(360deg); } }

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
