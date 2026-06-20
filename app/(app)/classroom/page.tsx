'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { api, getApiToken, CounselorLink, StudentClassroom, StudentActionItem, CounselorChatMessage } from '../../../lib/api'

export default function ClassroomPage() {
  const [classrooms, setClassrooms] = useState<StudentClassroom[]>([])
  const [actionItems, setActionItems] = useState<StudentActionItem[]>([])
  const [pendingLinks, setPendingLinks] = useState<CounselorLink[]>([])
  const [activeLinks, setActiveLinks] = useState<CounselorLink[]>([])
  const [loading, setLoading] = useState(true)

  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinMsg, setJoinMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [linkBusy, setLinkBusy] = useState<number | null>(null)

  const [chatCounselorId, setChatCounselorId] = useState<number | null>(null)
  const [chatMessages, setChatMessages] = useState<CounselorChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const [myId, setMyId] = useState<number | null>(null)

  useEffect(() => {
    try {
      const token = getApiToken()
      if (token) setMyId(Number(JSON.parse(atob(token.split('.')[1])).sub))
    } catch { /* ignore */ }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cls, ai, pending, active] = await Promise.all([
        api.studentClassrooms(),
        api.studentActionItems(),
        api.studentPendingCounselorLinks(),
        api.studentActiveCounselorLinks(),
      ])
      setClassrooms(cls)
      setActionItems(ai)
      setPendingLinks(pending)
      setActiveLinks(active)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)
    setJoinMsg(null)
    try {
      await api.studentJoinClassroom(joinCode.trim())
      setJoinMsg({ ok: true, text: 'Joined classroom!' })
      setJoinCode('')
      void load()
    } catch (err) {
      setJoinMsg({ ok: false, text: err instanceof Error ? err.message : 'Invalid code or already joined.' })
    } finally { setJoining(false) }
  }

  async function handleAccept(counselorId: number) {
    setLinkBusy(counselorId)
    try {
      await api.studentAcceptCounselorLink(counselorId)
      void load()
    } catch { /* ignore */ }
    finally { setLinkBusy(null) }
  }

  async function handleDecline(counselorId: number) {
    setLinkBusy(counselorId)
    try {
      await api.studentDeclineCounselorLink(counselorId)
      void load()
    } catch { /* ignore */ }
    finally { setLinkBusy(null) }
  }

  async function openChat(counselorId: number) {
    setChatCounselorId(counselorId)
    setChatMessages([])
    setChatLoading(true)
    try {
      const { messages } = await api.studentGetCounselorChat(counselorId)
      setChatMessages([...messages].reverse())
    } catch { /* ignore */ }
    finally { setChatLoading(false) }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!chatCounselorId || !chatInput.trim()) return
    setChatSending(true)
    try {
      const msg = await api.studentSendCounselorMessage(chatCounselorId, chatInput.trim())
      setChatMessages(prev => [...prev, msg])
      setChatInput('')
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch { /* ignore */ }
    finally { setChatSending(false) }
  }

  const activeCounselor = activeLinks.find(l => l.counselorId === chatCounselorId)

  return (
    <div style={{ padding: '24px 28px', maxWidth: 760, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 24 }}>Classroom</h1>

      {/* ── Pending counselor requests ── */}
      {pendingLinks.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Counselor Requests
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingLinks.map(link => (
              <div key={link.id} className="ns-card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0 }}>
                    {link.counselor.name ?? link.counselor.email}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    wants to be your counselor
                  </p>
                </div>
                <button
                  disabled={linkBusy === link.counselorId}
                  onClick={() => void handleDecline(link.counselorId)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', opacity: linkBusy === link.counselorId ? 0.5 : 1 }}>
                  Decline
                </button>
                <button
                  disabled={linkBusy === link.counselorId}
                  onClick={() => void handleAccept(link.counselorId)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: linkBusy === link.counselorId ? 0.5 : 1 }}>
                  Accept
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Join classroom ── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Join a Classroom
        </h2>
        <div className="ns-card" style={{ padding: '18px 20px' }}>
          <form onSubmit={e => void handleJoin(e)} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="Enter 6-character code"
              maxLength={6}
              style={{ flex: 1, minWidth: 180, padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontFamily: 'monospace', letterSpacing: 3, textTransform: 'uppercase' }}
            />
            <button
              type="submit"
              disabled={joining || joinCode.length !== 6}
              style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: (joining || joinCode.length !== 6) ? 0.5 : 1 }}>
              {joining ? 'Joining…' : 'Join'}
            </button>
          </form>
          {joinMsg && (
            <p style={{ marginTop: 10, fontSize: 13, color: joinMsg.ok ? '#22C55E' : '#EF4444', margin: '10px 0 0' }}>
              {joinMsg.ok ? '✓ ' : '✗ '}{joinMsg.text}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 40 }}>Loading…</div>
      ) : (
        <>
          {/* ── My classrooms ── */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              My Classrooms
            </h2>
            {classrooms.length === 0 ? (
              <div className="ns-card" style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No classrooms yet. Join one using an invite code above.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {classrooms.map(cls => (
                  <div key={cls.id} className="ns-card" style={{ padding: '14px 18px' }}>
                    <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', margin: '0 0 2px' }}>{cls.name}</p>
                    {cls.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 4px' }}>{cls.description}</p>}
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                      Teacher: {cls.educator.name ?? cls.educator.email}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── My Counselors ── */}
          {activeLinks.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                My Counselors
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeLinks.map(link => (
                  <div key={link.id} className="ns-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0 }}>
                        {link.counselor.name ?? link.counselor.email}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>Counselor</p>
                    </div>
                    <button
                      onClick={() => void openChat(link.counselorId)}
                      style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      Chat
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Action items ── */}
          {actionItems.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                Action Items
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {actionItems.map(item => (
                  <div key={item.id} className="ns-card" style={{ padding: '12px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, border: '2px solid', borderColor: item.completed ? '#22C55E' : 'var(--border)', background: item.completed ? '#22C55E' : 'transparent', flexShrink: 0, marginTop: 2 }}>
                      {item.completed && <svg viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2"><polyline points="2,6 5,9 10,3"/></svg>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: item.completed ? 'var(--text-muted)' : 'var(--text)', margin: 0, textDecoration: item.completed ? 'line-through' : 'none' }}>
                        {item.title}
                      </p>
                      {item.description && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{item.description}</p>}
                      {item.dueDate && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>Due {new Date(item.dueDate).toLocaleDateString()}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Chat modal ── */}
      {chatCounselorId !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', margin: 0 }}>
                  {activeCounselor?.counselor.name ?? activeCounselor?.counselor.email ?? 'Counselor'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Counselor</p>
              </div>
              <button onClick={() => setChatCounselorId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {chatLoading ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Loading…</p>
              ) : chatMessages.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No messages yet. Say hello!</p>
              ) : (
                chatMessages.map(msg => {
                  const isMe = msg.senderId === myId
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '75%', padding: '8px 12px', borderRadius: 12, background: isMe ? 'var(--primary)' : 'var(--bg)', color: isMe ? '#fff' : 'var(--text)', fontSize: 14, lineHeight: 1.5 }}>
                        {msg.body}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={chatBottomRef} />
            </div>
            <form onSubmit={e => void sendMessage(e)} style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type a message…"
                style={{ flex: 1, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 }}
              />
              <button
                type="submit"
                disabled={chatSending || !chatInput.trim()}
                style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: (chatSending || !chatInput.trim()) ? 0.5 : 1 }}>
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
