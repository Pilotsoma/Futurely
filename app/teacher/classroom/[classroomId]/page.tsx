'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api, ApiError, type EducatorClassroomDetail, type EducatorAssignment } from '../../../../lib/api'

interface CoinState {
  [studentId: number]: { amount: string; loading: boolean; error: string | null; success: boolean }
}

export default function TeacherClassroomPage() {
  const router = useRouter()
  const params = useParams()
  const classroomId = Number(params.classroomId)

  const [classroom, setClassroom] = useState<EducatorClassroomDetail | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  // Assignment form
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [aTitle, setATitle]         = useState('')
  const [aSubject, setASubject]     = useState('')
  const [aDesc, setADesc]           = useState('')
  const [aDueDate, setADueDate]     = useState('')
  const [aSubmitting, setASubmitting] = useState(false)
  const [aError, setAError]         = useState<string | null>(null)

  // Coin state per student
  const [coinState, setCoinState] = useState<CoinState>({})

  // Delete
  const [deleting, setDeleting] = useState(false)

  // Invite code copy feedback
  const [codeCopied, setCodeCopied] = useState(false)

  function copyCode(code: string) {
    void navigator.clipboard.writeText(code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 1500)
  }

  useEffect(() => {
    void loadClassroom()
  }, [classroomId])

  async function loadClassroom() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.educatorClassroomDetail(classroomId)
      setClassroom(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classroom')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this classroom? This cannot be undone.')) return
    setDeleting(true)
    try {
      await api.educatorDeleteClassroom(classroomId)
      router.push('/teacher/dashboard')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete classroom')
      setDeleting(false)
    }
  }

  async function handleGrantCoins(studentId: number) {
    const s = coinState[studentId]
    const coins = Number(s?.amount ?? 0)
    if (!coins || coins < 1 || coins > 300) {
      setCoinState(prev => ({ ...prev, [studentId]: { ...prev[studentId], error: 'Enter a value between 1 and 300.' } }))
      return
    }
    setCoinState(prev => ({ ...prev, [studentId]: { ...prev[studentId], loading: true, error: null, success: false } }))
    try {
      await api.educatorGrantCoins(classroomId, studentId, coins)
      setCoinState(prev => ({ ...prev, [studentId]: { amount: '', loading: false, error: null, success: true } }))
      setTimeout(() => {
        setCoinState(prev => ({ ...prev, [studentId]: { ...prev[studentId], success: false } }))
      }, 2500)
    } catch (err) {
      const isCapExceeded = err instanceof ApiError && err.code === 'COIN_CAP_EXCEEDED'
      const msg = isCapExceeded
        ? 'Daily limit of 300 coins reached for this student.'
        : err instanceof Error ? err.message : 'Failed to grant coins'
      setCoinState(prev => ({ ...prev, [studentId]: { ...prev[studentId], loading: false, error: msg } }))
    }
  }

  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault()
    if (!aTitle.trim() || !aSubject.trim() || !aDueDate) {
      setAError('Title, subject, and due date are required.')
      return
    }
    setASubmitting(true)
    setAError(null)
    try {
      const created = await api.educatorCreateAssignment(classroomId, {
        title: aTitle.trim(),
        subject: aSubject.trim(),
        description: aDesc.trim() || undefined,
        dueDate: new Date(aDueDate).toISOString(),
      })
      setClassroom(prev => prev ? { ...prev, assignments: [created, ...prev.assignments] } : prev)
      setATitle(''); setASubject(''); setADesc(''); setADueDate('')
      setShowAssignForm(false)
    } catch (err) {
      setAError(err instanceof Error ? err.message : 'Failed to create assignment')
    } finally {
      setASubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="fade-up">
        <div className="shimmer" style={{ width: 200, height: 30, borderRadius: 8, marginBottom: 12 }} />
        <div className="shimmer" style={{ width: 120, height: 20, borderRadius: 6, marginBottom: 32 }} />
        <div className="ns-card" style={{ padding: 24, marginBottom: 20 }}>
          <div className="shimmer" style={{ width: '100%', height: 60, borderRadius: 8, marginBottom: 12 }} />
          <div className="shimmer" style={{ width: '60%', height: 18, borderRadius: 6, marginBottom: 10 }} />
          <div className="shimmer" style={{ width: '40%', height: 14, borderRadius: 6 }} />
        </div>
        <div className="ns-card" style={{ padding: 24, marginBottom: 20 }}>
          <div className="shimmer" style={{ width: '40%', height: 18, borderRadius: 6, marginBottom: 16 }} />
          {[0, 1, 2].map(i => (
            <div key={i} className="shimmer" style={{ width: '100%', height: 40, borderRadius: 8, marginBottom: 8 }} />
          ))}
        </div>
        <div className="ns-card" style={{ padding: 24, marginBottom: 20 }}>
          <div className="shimmer" style={{ width: '40%', height: 18, borderRadius: 6, marginBottom: 16 }} />
          {[0, 1, 2].map(i => (
            <div key={i} className="shimmer" style={{ width: '100%', height: 40, borderRadius: 8, marginBottom: 8 }} />
          ))}
        </div>
      </div>
    )
  }

  if (error || !classroom) {
    return (
      <div className="fade-up" style={{ padding: 40, textAlign: 'center' }}>
        <div style={S.errorBox}>{error ?? 'Classroom not found.'}</div>
        <button className="ns-btn-primary" style={{ marginTop: 16 }} onClick={() => void loadClassroom()}>Retry</button>
      </div>
    )
  }

  return (
    <div className="fade-up">
      {/* Back link */}
      <button
        className="ns-btn-ghost"
        style={{ marginBottom: 20, fontSize: 13, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        onClick={() => router.push('/teacher/dashboard')}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        All Classrooms
      </button>

      {/* Section A: Header */}
      <div className="ns-card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.4px', marginBottom: 6 }}>{classroom.name}</h1>
            {classroom.description && (
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>{classroom.description}</p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={S.inviteChip}>
                <span style={S.inviteLabel}>Invite Code</span>
                <span style={S.inviteCode}>{classroom.inviteCode}</span>
                <button
                  style={S.copyBtn}
                  onClick={() => copyCode(classroom.inviteCode)}
                  aria-label="Copy invite code"
                  title="Copy invite code"
                  type="button"
                >
                  {codeCopied ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>Copied!</span>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  )}
                </button>
              </div>
            </div>
          </div>
          <button
            className="ns-btn-ghost"
            style={{ color: 'var(--error)', borderColor: 'var(--error)', fontSize: 13, padding: '8px 16px', opacity: deleting ? 0.6 : 1 }}
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete Classroom'}
          </button>
        </div>
      </div>

      {/* Section B: Students */}
      <div className="ns-card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={S.sectionTitle}>
          Students
          <span style={S.countBadge}>{classroom.memberships.length}</span>
        </h2>

        {classroom.memberships.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>
            No students have joined yet. Share the invite code above.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {classroom.memberships.map(({ student }) => {
              const cs = coinState[student.id] ?? { amount: '', loading: false, error: null, success: false }
              return (
                <div key={student.id} style={S.studentRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{student.name ?? student.email}</div>
                    {student.name && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{student.email}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <input
                      type="number"
                      min={1}
                      max={300}
                      value={cs.amount}
                      onChange={e => setCoinState(prev => ({ ...prev, [student.id]: { ...prev[student.id] ?? { loading: false, error: null, success: false }, amount: e.target.value } }))}
                      placeholder="Coins"
                      disabled={cs.loading}
                      aria-label="Coins to grant"
                      style={{ ...S.coinInput }}
                    />
                    <button
                      className="ns-btn-primary"
                      style={{ height: 36, padding: '0 14px', fontSize: 13, opacity: cs.loading || !cs.amount ? 0.6 : 1 }}
                      onClick={() => void handleGrantCoins(student.id)}
                      disabled={cs.loading || !cs.amount}
                    >
                      {cs.loading ? '…' : 'Grant'}
                    </button>
                  </div>
                  {(cs.error || cs.success) && (
                    <div style={{ width: '100%', fontSize: 12, marginTop: 4, color: cs.success ? 'var(--primary)' : 'var(--error)' }}>
                      {cs.success ? 'Coins granted!' : cs.error}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Section C: Assignments */}
      <div className="ns-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ ...S.sectionTitle, marginBottom: 0 }}>
            Assignments
            <span style={S.countBadge}>{classroom.assignments.length}</span>
          </h2>
          <button
            className="ns-btn-primary"
            style={{ height: 36, padding: '0 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => { setShowAssignForm(v => !v); setAError(null) }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Assign Homework
          </button>
        </div>

        {showAssignForm && (
          <form onSubmit={e => void handleCreateAssignment(e)} style={S.assignForm}>
            <div style={S.formRow}>
              <div style={{ flex: 1 }}>
                <label htmlFor="assign-title" style={S.fieldLabel}>Title <span style={{ color: 'var(--error)' }}>*</span></label>
                <input id="assign-title" className="ns-input" type="text" value={aTitle} onChange={e => setATitle(e.target.value)} placeholder="Assignment title" disabled={aSubmitting} style={S.input} />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="assign-subject" style={S.fieldLabel}>Subject <span style={{ color: 'var(--error)' }}>*</span></label>
                <input id="assign-subject" className="ns-input" type="text" value={aSubject} onChange={e => setASubject(e.target.value)} placeholder="e.g. Chemistry" disabled={aSubmitting} style={S.input} />
              </div>
            </div>
            <div style={S.formRow}>
              <div style={{ flex: 1 }}>
                <label htmlFor="assign-desc" style={S.fieldLabel}>Description <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
                <input id="assign-desc" className="ns-input" type="text" value={aDesc} onChange={e => setADesc(e.target.value)} placeholder="Brief description" disabled={aSubmitting} style={S.input} />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="assign-due" style={S.fieldLabel}>Due Date <span style={{ color: 'var(--error)' }}>*</span></label>
                <input id="assign-due" className="ns-input" type="datetime-local" value={aDueDate} onChange={e => setADueDate(e.target.value)} disabled={aSubmitting} style={S.input} />
              </div>
            </div>
            {aError && <div style={S.errorBox}>{aError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="ns-btn-ghost" style={{ height: 40, padding: '0 18px', fontSize: 13 }} onClick={() => setShowAssignForm(false)} disabled={aSubmitting}>Cancel</button>
              <button type="submit" className="ns-btn-primary" style={{ height: 40, padding: '0 18px', fontSize: 13, opacity: aSubmitting ? 0.6 : 1 }} disabled={aSubmitting}>{aSubmitting ? 'Creating…' : 'Create Assignment'}</button>
            </div>
          </form>
        )}

        {classroom.assignments.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>No assignments yet.</p>
            <button
              className="ns-btn-primary"
              style={{ height: 38, padding: '0 18px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => { setShowAssignForm(true); setAError(null) }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Assign Homework
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {classroom.assignments.map(a => (
              <AssignmentRow key={a.id} assignment={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AssignmentRow({ assignment }: { assignment: EducatorAssignment }) {
  const due = new Date(assignment.dueDate)
  const overdue = due < new Date()
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{assignment.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{assignment.subject}{assignment.description ? ` · ${assignment.description}` : ''}</div>
      </div>
      <div style={{ fontSize: 12, color: overdue ? 'var(--error)' : 'var(--text-secondary)', flexShrink: 0, marginLeft: 16 }}>
        Due {due.toLocaleDateString()} {due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  sectionTitle: { fontSize: 16, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 },
  countBadge:  { background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', color: 'var(--primary)', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 },
  studentRow:  { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)', flexWrap: 'wrap' },
  coinInput:   { width: 80, height: 36, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 10px', fontSize: 14, color: 'var(--text)', textAlign: 'center' as const },
  inviteChip:  { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 8, padding: '6px 12px' },
  inviteLabel: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.8px', color: 'var(--primary)' },
  inviteCode:  { fontFamily: 'monospace', fontSize: 15, fontWeight: 800, letterSpacing: '3px', color: 'var(--primary)' },
  copyBtn:     { background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 24, minHeight: 24 },
  assignForm:  { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 18, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  formRow:     { display: 'flex', gap: 12, flexWrap: 'wrap' },
  fieldLabel:  { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 },
  input:       { width: '100%', height: 40, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', fontSize: 14, color: 'var(--text)', boxSizing: 'border-box' as const },
  errorBox:    { background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 16px', color: '#DC2626', fontSize: 13 },
}
