'use client'

import React from 'react'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { CheckIcon, XMarkIcon } from '@/components/icons'
import { useRouter } from 'next/navigation'
import { api, CounselorLink, StudentClassroom, StudentActionItem } from '../../../lib/api'

export default function ClassroomPage() {
  const router = useRouter()
  const [classrooms, setClassrooms] = useState<StudentClassroom[]>([])
  const [actionItems, setActionItems] = useState<StudentActionItem[]>([])
  const [activeLinks, setActiveLinks] = useState<CounselorLink[]>([])
  const [loading, setLoading] = useState(true)

  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinMsg, setJoinMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const chatBottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cls, ai, active] = await Promise.all([
        api.studentClassrooms(),
        api.studentActionItems(),
        api.studentActiveCounselorLinks(),
      ])
      setClassrooms(cls)
      setActionItems(ai)
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

  return (
    <div style={{ padding: '24px 28px', maxWidth: 760, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 24 }}>Classroom</h1>

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
              style={{ flex: 1, minWidth: 180, padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontFamily: 'monospace', letterSpacing: 3, textTransform: 'uppercase', boxShadow: 'var(--neo-inset)' }}
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
              {joinMsg.ok ? <><CheckIcon size={13} color='#22C55E'/> </> : <><XMarkIcon size={13} color='#EF4444'/> </>}{joinMsg.text}
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
                  <Link key={cls.id} href={`/classroom/${cls.id}`} style={{ textDecoration: 'none' }}>
                    <div className="ns-card" style={{ padding: '14px 18px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', margin: '0 0 2px' }}>{cls.name}</p>
                          {cls.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 4px' }}>{cls.description}</p>}
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                            Teacher: {cls.educator.name ?? cls.educator.email}
                          </p>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* ── My Counselors ── */}
          {activeLinks.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                My Counselor{activeLinks.length > 1 ? 's' : ''}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
                {activeLinks.map(link => {
                  const openCount = actionItems.filter(a => !a.completed).length
                  return (
                    <div key={link.id} className="ns-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>
                          {(link.counselor.name ?? link.counselor.email).charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {link.counselor.name ?? link.counselor.email}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, margin: '2px 0 0' }}>Counselor</p>
                        </div>
                      </div>

                      {/* Quick stats */}
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' as const }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: openCount > 0 ? '#F97316' : 'var(--text)' }}>{openCount}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Open Tasks</div>
                        </div>
                        <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' as const }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle' }}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Chat</div>
                        </div>
                      </div>

                      {/* CTA */}
                      <button
                        className="ns-btn-primary"
                        style={{ width: '100%', height: 38, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                        onClick={() => router.push(`/my-counselor/${link.counselorId}`)}
                      >
                        Open Portal
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Quick action items preview (only if no counselors) ── */}
          {activeLinks.length === 0 && actionItems.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                Action Items
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {actionItems.slice(0, 3).map(item => (
                  <div key={item.id} className="ns-card" style={{ padding: '12px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, border: '2px solid', borderColor: item.completed ? '#22C55E' : 'var(--border)', background: item.completed ? '#22C55E' : 'transparent', flexShrink: 0, marginTop: 2 }}>
                      {item.completed && <svg viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2"><polyline points="2,6 5,9 10,3"/></svg>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: item.completed ? 'var(--text-muted)' : 'var(--text)', margin: 0, textDecoration: item.completed ? 'line-through' : 'none' }}>
                        {item.title}
                      </p>
                      {item.dueDate && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>Due {new Date(item.dueDate).toLocaleDateString()}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {/* hidden ref kept to avoid unused warning */}
      <div ref={chatBottomRef} style={{ display: 'none' }} />
    </div>
  )
}
