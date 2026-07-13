'use client'

import React from 'react'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { WarningIcon } from '@/components/icons'
import {
  api,
  type StudentCounselorPortal,
  type StudentActionItem,
  type CounselorChatMessage,
} from '../../../../lib/api'

type Tab = 'action-items' | 'recommendations' | 'notes' | 'chat'

export default function MyCounselorPage() {
  const params     = useParams()
  const router     = useRouter()
  const counselorId = Number(params.counselorId)

  const [portal, setPortal]     = useState<StudentCounselorPortal | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('action-items')
  const [myId, setMyId]         = useState<number | null>(null)

  useEffect(() => {
    api.authMe().then(me => setMyId(me.id)).catch(() => {})
    void loadPortal()
  }, [counselorId])

  async function loadPortal() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.studentCounselorPortal(counselorId)
      setPortal(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load counselor portal')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleItem(id: number) {
    if (!portal) return
    try {
      const updated = await api.studentToggleActionItem(id)
      setPortal(prev => prev ? {
        ...prev,
        actionItems: prev.actionItems.map(a => a.id === id ? updated : a),
      } : prev)
    } catch { /* best-effort */ }
  }

  if (loading) return <PortalSkeleton />

  if (error || !portal) {
    return (
      <div style={{ padding: '40px 28px', maxWidth: 720, margin: '0 auto' }}>
        <button
          className="ns-btn-ghost"
          style={S.backBtn}
          onClick={() => router.push('/classroom')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back
        </button>
        <div style={S.errorBox}>{error ?? 'Portal not found.'}</div>
      </div>
    )
  }

  const openItems = portal.actionItems.filter(a => !a.completed).length
  const totalRecs  = portal.recommendations.length

  return (
    <div style={{ padding: '24px 28px', maxWidth: 720, margin: '0 auto' }}>
      {/* Back */}
      <button
        className="ns-btn-ghost"
        style={S.backBtn}
        onClick={() => router.push('/classroom')}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back to Classroom
      </button>

      {/* Counselor header */}
      <div className="ns-card" style={{ padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={S.counselorAvatar}>
          {(portal.counselor.name ?? portal.counselor.email).charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>
            {portal.counselor.name ?? portal.counselor.email}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Your Counselor</div>
        </div>
        <div style={{ display: 'flex', gap: 20, textAlign: 'center' as const }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: openItems > 0 ? '#F97316' : 'var(--text)' }}>{openItems}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Open Tasks</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{totalRecs}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Recommendations</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabBar} role="tablist">
        {([
          { id: 'action-items',    label: 'Action Items', badge: openItems > 0 ? openItems : null },
          { id: 'recommendations', label: 'Courses' },
          { id: 'notes',           label: 'Notes' },
          { id: 'chat',            label: 'Chat' },
        ] as { id: Tab; label: string; badge?: number | null }[]).map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            style={{ ...S.tabBtn, ...(activeTab === t.id ? S.tabBtnActive : {}) }}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
            {t.badge ? <span style={S.tabBadge}>{t.badge}</span> : null}
          </button>
        ))}
      </div>

      <div style={{ paddingTop: 20 }}>
        {activeTab === 'action-items' && (
          <ActionItemsTab items={portal.actionItems} onToggle={handleToggleItem} />
        )}
        {activeTab === 'recommendations' && (
          <RecommendationsTab recs={portal.recommendations} />
        )}
        {activeTab === 'notes' && (
          <NotesTab notes={portal.notes} />
        )}
        {activeTab === 'chat' && (
          <ChatTab counselorId={counselorId} counselorName={portal.counselor.name} myId={myId} />
        )}
      </div>
    </div>
  )
}

// ── Action Items Tab ──────────────────────────────────────────────────────────

function ActionItemsTab({ items, onToggle }: { items: StudentActionItem[]; onToggle: (id: number) => void }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>}
        title="No action items yet"
        sub="Your counselor hasn't assigned any tasks yet."
      />
    )
  }

  const open = items.filter(a => !a.completed)
  const done = items.filter(a => a.completed)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {open.length > 0 && (
        <>
          <p style={S.groupLabel}>To Do ({open.length})</p>
          {open.map(item => <ActionItemRow key={item.id} item={item} onToggle={onToggle} />)}
        </>
      )}
      {done.length > 0 && (
        <>
          <p style={{ ...S.groupLabel, marginTop: open.length > 0 ? 20 : 0 }}>Completed ({done.length})</p>
          {done.map(item => <ActionItemRow key={item.id} item={item} onToggle={onToggle} />)}
        </>
      )}
    </div>
  )
}

function ActionItemRow({ item, onToggle }: { item: StudentActionItem; onToggle: (id: number) => void }) {
  const overdue = !item.completed && item.dueDate && new Date(item.dueDate) < new Date()
  return (
    <div
      className="ns-card"
      style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, cursor: 'pointer', transition: 'opacity 0.15s', opacity: item.completed ? 0.6 : 1 }}
      onClick={() => onToggle(item.id)}
    >
      <div style={{
        width: 20, height: 20, borderRadius: 6, border: '2px solid',
        borderColor: item.completed ? '#22C55E' : overdue ? '#EF4444' : 'var(--border)',
        background: item.completed ? '#22C55E' : 'transparent',
        flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
      }}>
        {item.completed && (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="2,6 5,9 10,3"/></svg>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 600, fontSize: 14, color: item.completed ? 'var(--text-muted)' : 'var(--text)', margin: 0, textDecoration: item.completed ? 'line-through' : 'none' }}>
          {item.title}
        </p>
        {item.description && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.5 }}>{item.description}</p>
        )}
        {item.dueDate && (
          <p style={{ fontSize: 11, fontWeight: 600, margin: '6px 0 0', color: overdue ? '#EF4444' : 'var(--text-muted)' }}>
            {overdue ? <><WarningIcon size={11}/> Overdue · </> : ''}Due {new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Recommendations Tab ───────────────────────────────────────────────────────

function RecommendationsTab({ recs }: { recs: StudentCounselorPortal['recommendations'] }) {
  if (recs.length === 0) {
    return (
      <EmptyState
        icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>}
        title="No recommendations yet"
        sub="Your counselor hasn't recommended any courses yet."
      />
    )
  }

  const bySemester = recs.reduce<Record<string, typeof recs>>((acc, r) => {
    const key = r.semester
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {Object.entries(bySemester).map(([semester, courses]) => (
        <div key={semester}>
          <p style={S.groupLabel}>{semester}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {courses.map(r => (
              <div key={r.id} className="ns-card" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={S.recIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                      {r.courseName}
                      {r.courseCode && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>{r.courseCode}</span>}
                    </div>
                    {r.rationale && (
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.5 }}>{r.rationale}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Notes Tab ─────────────────────────────────────────────────────────────────

function NotesTab({ notes }: { notes: StudentCounselorPortal['notes'] }) {
  if (notes.length === 0) {
    return (
      <EmptyState
        icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
        title="No notes yet"
        sub="Notes your counselor shares with you will appear here."
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {notes.map(note => (
        <div key={note.id} className="ns-card" style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>{note.body}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '10px 0 0', fontWeight: 500 }}>
            {new Date(note.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      ))}
    </div>
  )
}

// ── Chat Tab ──────────────────────────────────────────────────────────────────

function ChatTab({ counselorId, counselorName, myId }: { counselorId: number; counselorName: string | null; myId: number | null }) {
  const [messages, setMessages] = useState<CounselorChatMessage[]>([])
  const [loading, setLoading]   = useState(true)
  const [body, setBody]         = useState('')
  const [sending, setSending]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const { messages: msgs } = await api.studentGetCounselorChat(counselorId)
        setMessages([...msgs].reverse())
      } catch { /* ignore */ }
      finally { setLoading(false); scrollToBottom() }
    })()
  }, [counselorId, scrollToBottom])

  // Supabase Realtime
  useEffect(() => {
    if (!myId) return
    const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnon) return
    const client  = createClient(supabaseUrl, supabaseAnon)
    const channel = client.channel(`counselor-chat:${counselorId}:${myId}`)
    channel.on('broadcast', { event: 'message' }, ({ payload }: { payload: CounselorChatMessage }) => {
      setMessages(prev => [...prev, payload])
      scrollToBottom()
    }).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [counselorId, myId, scrollToBottom])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    try {
      const msg = await api.studentSendCounselorMessage(counselorId, body.trim())
      setMessages(prev => [...prev, msg])
      setBody('')
      scrollToBottom()
    } catch { /* ignore */ }
    finally { setSending(false) }
  }

  return (
    <div className="ns-card" style={{ display: 'flex', flexDirection: 'column', height: 480, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
          {(counselorName ?? 'C').charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{counselorName ?? 'Counselor'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Your Counselor</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, paddingTop: 40 }}>Loading…</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, paddingTop: 40 }}>
            No messages yet. Send a message to start the conversation.
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderId === myId
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%', padding: '9px 13px', borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                  background: isMe ? 'var(--primary)' : 'var(--surface-2)',
                  color: isMe ? '#fff' : 'var(--text)', fontSize: 14, lineHeight: 1.5,
                }}>
                  {msg.body}
                  <div style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)', marginTop: 3, textAlign: 'right' as const }}>
                    {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={e => void handleSend(e)} style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Type a message…"
          style={{ flex: 1, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none' }}
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: (sending || !body.trim()) ? 0.5 : 1, transition: 'opacity 0.15s' }}
        >
          Send
        </button>
      </form>
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        {icon}
      </div>
      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{sub}</p>
    </div>
  )
}

function PortalSkeleton() {
  return (
    <div style={{ padding: '24px 28px', maxWidth: 720, margin: '0 auto' }}>
      <div className="shimmer" style={{ width: 80, height: 20, borderRadius: 6, marginBottom: 24 }} />
      <div className="ns-card" style={{ padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 18 }}>
        <div className="shimmer" style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="shimmer" style={{ width: 160, height: 20, borderRadius: 6, marginBottom: 8 }} />
          <div className="shimmer" style={{ width: 80, height: 14, borderRadius: 6 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[100, 120, 80, 80].map((w, i) => (
          <div key={i} className="shimmer" style={{ width: w, height: 36, borderRadius: 8 }} />
        ))}
      </div>
      {[0, 1, 2].map(i => (
        <div key={i} className="shimmer" style={{ width: '100%', height: 70, borderRadius: 10, marginBottom: 10 }} />
      ))}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  backBtn:      { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, padding: '6px 12px', marginBottom: 20 },
  errorBox:     { background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 16px', color: '#DC2626', fontSize: 13 },
  counselorAvatar: { width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, flexShrink: 0 },
  tabBar:       { display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 0 },
  tabBtn:       { padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', borderBottom: '2px solid transparent', marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6, transition: 'color 0.15s' },
  tabBtnActive: { color: 'var(--primary)', borderBottomColor: 'var(--primary)', fontWeight: 700 },
  tabBadge:     { background: '#EF4444', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px', minWidth: 16, textAlign: 'center' as const },
  groupLabel:   { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 8 },
  recIcon:      { width: 32, height: 32, borderRadius: 8, background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
}
