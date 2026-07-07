'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, type EducatorClassroom } from '../../../lib/api'

export default function TeacherDashboardPage() {
  const router = useRouter()
  const [classrooms, setClassrooms] = useState<EducatorClassroom[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  const [showModal, setShowModal]   = useState(false)
  const [name, setName]             = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating]     = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  function copyCode(code: string) {
    void navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 1500)
  }

  useEffect(() => {
    void loadClassrooms()
  }, [])

  async function loadClassrooms() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.educatorClassrooms()
      setClassrooms(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classrooms')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setCreateError('Classroom name is required.'); return }
    setCreating(true)
    setCreateError(null)
    try {
      const created = await api.educatorCreateClassroom(name.trim(), description.trim() || undefined)
      setClassrooms(prev => [{ ...created, _count: { memberships: 0 } }, ...prev])
      setShowModal(false)
      setName('')
      setDescription('')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create classroom')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="fade-up">
        <div style={S.pageHeader}>
          <div>
            <div className="shimmer" style={{ width: 180, height: 32, borderRadius: 8, marginBottom: 8 }} />
            <div className="shimmer" style={{ width: 120, height: 16, borderRadius: 6 }} />
          </div>
        </div>
        <div style={S.grid}>
          {[0, 1, 2].map(i => (
            <div key={i} className="ns-card" style={{ padding: 24, height: 160 }}>
              <div className="shimmer" style={{ width: '60%', height: 20, borderRadius: 6, marginBottom: 12 }} />
              <div className="shimmer" style={{ width: '40%', height: 28, borderRadius: 8, marginBottom: 12 }} />
              <div className="shimmer" style={{ width: '30%', height: 16, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fade-up">
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={S.errorBox}>{error}</div>
          <button className="ns-btn-primary" style={{ marginTop: 16 }} onClick={() => void loadClassrooms()}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-up">
      {/* Page header */}
      <div style={S.pageHeader}>
        <div>
          <h1 style={S.title}>My Classrooms</h1>
          <p style={S.subtitle}>
            {classrooms.length === 0
              ? 'No classrooms yet.'
              : `${classrooms.length} classroom${classrooms.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          className="ns-btn-primary"
          style={{ height: 40, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={() => { setShowModal(true); setCreateError(null) }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Classroom
        </button>
      </div>

      {/* Create classroom modal */}
      {showModal && (
        <div style={S.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="ns-card" style={S.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>New Classroom</h2>
              <button style={S.closeBtn} onClick={() => setShowModal(false)} aria-label="Close modal">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={e => void handleCreate(e)}>
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="classroom-name" style={S.fieldLabel}>Name <span style={{ color: 'var(--error)' }}>*</span></label>
                <input
                  id="classroom-name"
                  className="ns-input"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. AP Chemistry Period 3"
                  disabled={creating}
                  style={S.input}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="classroom-description" style={S.fieldLabel}>Description <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
                <input
                  id="classroom-description"
                  className="ns-input"
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description of this class"
                  disabled={creating}
                  style={S.input}
                />
              </div>
              {createError && <div style={{ ...S.errorBox, marginBottom: 12 }}>{createError}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: createError ? 0 : 4 }}>
                <button
                  type="button"
                  className="ns-btn-ghost"
                  style={{ flex: 1, height: 42 }}
                  onClick={() => setShowModal(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ns-btn-primary"
                  style={{ flex: 1, height: 42, opacity: creating || !name.trim() ? 0.6 : 1 }}
                  disabled={creating || !name.trim()}
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Empty state */}
      {classrooms.length === 0 ? (
        <div style={S.empty}>
          <div style={S.emptyIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
          </div>
          <p style={S.emptyTitle}>You haven&apos;t created any classrooms yet.</p>
          <p style={S.emptySub}>Create your first classroom to get started and share the invite code with your students.</p>
          <button
            className="ns-btn-primary"
            style={{ marginTop: 20, height: 40, padding: '0 20px', fontSize: 14 }}
            onClick={() => { setShowModal(true); setCreateError(null) }}
          >
            Create Classroom
          </button>
        </div>
      ) : (
        <div style={S.grid}>
          {classrooms.map(c => (
            <div key={c.id} className="ns-card" style={{ padding: 24 }}>
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{c.name}</h3>
                {c.description && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{c.description}</p>
                )}
              </div>

              {/* Invite code chip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={S.inviteChip}>
                  <span style={S.inviteLabel}>Invite Code</span>
                  <span style={S.inviteCode}>{c.inviteCode}</span>
                  <button
                    style={S.copyBtn}
                    onClick={() => copyCode(c.inviteCode)}
                    aria-label="Copy invite code"
                    title="Copy invite code"
                    type="button"
                  >
                    {copiedCode === c.inviteCode ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>Copied!</span>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Student count */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, marginTop: 10 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {c._count.memberships} student{c._count.memberships !== 1 ? 's' : ''}
                </span>
              </div>

              <button
                className="ns-btn-ghost"
                style={{ width: '100%', height: 38, fontSize: 13 }}
                onClick={() => router.push(`/teacher/classroom/${c.id}`)}
              >
                View Classroom
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 6 }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  pageHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  title:       { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4 },
  subtitle:    { fontSize: 13, color: 'var(--text-secondary)' },
  grid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 },
  empty:       { textAlign: 'center', padding: '80px 0' },
  emptyIcon:   { width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' },
  emptyTitle:  { fontSize: 17, fontWeight: 700, marginBottom: 6 },
  emptySub:    { fontSize: 13, color: 'var(--text-secondary)' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal:       { width: '100%', maxWidth: 440, padding: 28 },
  closeBtn:    { background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' },
  fieldLabel:  { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 },
  input:       { width: '100%', height: 42, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', fontSize: 14, color: 'var(--text)', boxSizing: 'border-box' as const, boxShadow: 'var(--neo-inset)' },
  inviteChip:  { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 8, padding: '6px 12px' },
  inviteLabel: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.8px', color: 'var(--primary)' },
  inviteCode:  { fontFamily: 'monospace', fontSize: 15, fontWeight: 800, letterSpacing: '3px', color: 'var(--primary)' },
  copyBtn:     { background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 24, minHeight: 24 },
  errorBox:    { background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 16px', color: '#DC2626', fontSize: 13 },
}
