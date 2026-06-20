'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, type CounselorStudentSummary } from '../../../lib/api'

export default function CounselorDashboardPage() {
  const router = useRouter()
  const [students, setStudents] = useState<CounselorStudentSummary[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const [showForm, setShowForm]     = useState(false)
  const [studentId, setStudentId]   = useState('')
  const [adding, setAdding]         = useState(false)
  const [addError, setAddError]     = useState<string | null>(null)

  useEffect(() => {
    void loadStudents()
  }, [])

  async function loadStudents() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.counselorStudents()
      setStudents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const id = Number(studentId)
    if (!id || isNaN(id)) { setAddError('Please enter a valid student ID.'); return }
    setAdding(true)
    setAddError(null)
    try {
      await api.counselorAddStudent(id)
      setStudentId('')
      setShowForm(false)
      await loadStudents()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add student')
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return (
      <div className="fade-up">
        <div style={S.pageHeader}>
          <div>
            <div className="shimmer" style={{ width: 160, height: 32, borderRadius: 8, marginBottom: 8 }} />
            <div className="shimmer" style={{ width: 100, height: 16, borderRadius: 6 }} />
          </div>
        </div>
        <div style={S.grid}>
          {[0, 1, 2].map(i => (
            <div key={i} className="ns-card" style={{ padding: 22, height: 130 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div className="shimmer" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="shimmer" style={{ width: '60%', height: 16, borderRadius: 6, marginBottom: 6 }} />
                  <div className="shimmer" style={{ width: '80%', height: 13, borderRadius: 6 }} />
                </div>
              </div>
              <div className="shimmer" style={{ width: '40%', height: 13, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fade-up" style={{ padding: 40, textAlign: 'center' }}>
        <div style={S.errorBox}>{error}</div>
        <button className="ns-btn-primary" style={{ marginTop: 16 }} onClick={() => void loadStudents()}>Retry</button>
      </div>
    )
  }

  return (
    <div className="fade-up">
      <div style={S.pageHeader}>
        <div>
          <h1 style={S.title}>My Students</h1>
          <p style={S.subtitle}>
            {students.length === 0
              ? 'No students assigned yet.'
              : `${students.length} student${students.length > 1 ? 's' : ''} assigned`}
          </p>
        </div>
        <button
          className="ns-btn-primary"
          style={{ height: 40, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={() => { setShowForm(v => !v); setAddError(null) }}
        >
          {showForm ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Cancel
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Student
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="ns-card" style={{ padding: 24, marginBottom: 24, maxWidth: 400 }}>
          <p style={S.cardLabel}>Add a student by their ID</p>
          <form onSubmit={e => void handleAdd(e)}>
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="student-id-input" style={S.fieldLabel}>Student ID</label>
              <input
                id="student-id-input"
                className="ns-input"
                type="number"
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                placeholder="Enter numeric student ID"
                disabled={adding}
                style={S.input}
              />
            </div>
            {addError && <div style={{ ...S.errorBox, marginBottom: 12 }}>{addError}</div>}
            <button
              type="submit"
              className="ns-btn-primary"
              style={{ width: '100%', height: 42, fontSize: 14, opacity: adding || !studentId ? 0.6 : 1 }}
              disabled={adding || !studentId}
            >
              {adding ? 'Adding…' : 'Add Student'}
            </button>
          </form>
        </div>
      )}

      {students.length === 0 ? (
        <div style={S.empty}>
          <div style={S.emptyIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          </div>
          <p style={S.emptyTitle}>No students assigned yet.</p>
          <p style={S.emptySub}>Add a student by their ID to start tracking their progress.</p>
          <button
            className="ns-btn-primary"
            style={{ marginTop: 20, height: 40, padding: '0 20px', fontSize: 14 }}
            onClick={() => { setShowForm(true); setAddError(null) }}
          >
            Add Student
          </button>
        </div>
      ) : (
        <div style={S.grid}>
          {students.map(s => (
            <div key={s.id} className="ns-card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={S.avatar}>{(s.name ?? s.email).slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name ?? s.email}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</div>
                </div>
              </div>

              {s.profile && (
                <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                  {s.profile.gradeLevel !== null && (
                    <div>
                      <div style={S.statVal}>Grade {s.profile.gradeLevel}</div>
                    </div>
                  )}
                  {s.profile.weightedGpa !== null && (
                    <div>
                      <div style={S.statVal}>{s.profile.weightedGpa.toFixed(2)} GPA</div>
                    </div>
                  )}
                  {s.profile.graduationYear !== null && (
                    <div>
                      <div style={S.statVal}>Class of {s.profile.graduationYear}</div>
                    </div>
                  )}
                </div>
              )}

              <button
                className="ns-btn-ghost"
                style={{ width: '100%', height: 36, fontSize: 13 }}
                onClick={() => router.push(`/counselor/students/${s.id}`)}
              >
                View
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
  cardLabel:   { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 14 },
  fieldLabel:  { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 },
  input:       { width: '100%', height: 42, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', fontSize: 14, color: 'var(--text)', boxSizing: 'border-box' as const },
  grid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 },
  empty:       { textAlign: 'center', padding: '80px 0' },
  emptyIcon:   { width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' },
  emptyTitle:  { fontSize: 17, fontWeight: 700, marginBottom: 6 },
  emptySub:    { fontSize: 13, color: 'var(--text-secondary)' },
  avatar:      { width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, flexShrink: 0 },
  statVal:     { fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' },
  errorBox:    { background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 16px', color: '#DC2626', fontSize: 13 },
}
