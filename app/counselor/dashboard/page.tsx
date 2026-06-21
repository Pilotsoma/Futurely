'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { api, type CounselorStudentSummary } from '../../../lib/api'

interface StudentResult { id: number; name: string | null; email: string }

export default function CounselorDashboardPage() {
  const router = useRouter()
  const [students, setStudents] = useState<CounselorStudentSummary[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const [showForm, setShowForm]     = useState(false)
  const [adding, setAdding]         = useState(false)
  const [addError, setAddError]     = useState<string | null>(null)

  // Search state
  const [searchQuery, setSearchQuery]     = useState('')
  const [searchResults, setSearchResults] = useState<StudentResult[]>([])
  const [searchOpen, setSearchOpen]       = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [selected, setSelected]           = useState<StudentResult | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadStudents()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2 || selected) { setSearchResults([]); setSearchOpen(false); return }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const results = await api.counselorSearchStudents(searchQuery)
        setSearchResults(results)
        setSearchOpen(results.length > 0)
      } catch { setSearchResults([]) }
      finally { setSearchLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, selected])

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

  function pickStudent(s: StudentResult) {
    setSelected(s)
    setSearchQuery(s.name ?? s.email)
    setSearchOpen(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const id = selected?.id
    if (!id) { setAddError('Please search for and select a student.'); return }
    setAdding(true)
    setAddError(null)
    try {
      await api.counselorAddStudent(id)
      setSelected(null)
      setSearchQuery('')
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
        <div className="ns-card" style={{ padding: 24, marginBottom: 24, maxWidth: 420 }}>
          <p style={S.cardLabel}>Add a student</p>
          <form onSubmit={e => void handleAdd(e)}>
            <div style={{ marginBottom: 14 }}>
              <label style={S.fieldLabel}>Search by name or email</label>
              <div ref={searchRef} style={{ position: 'relative' }}>
                <input
                  className="ns-input"
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSelected(null) }}
                  onFocus={() => { if (searchResults.length > 0 && !selected) setSearchOpen(true) }}
                  placeholder="Type student name or email…"
                  disabled={adding}
                  autoComplete="off"
                  style={S.input}
                />
                {searchLoading && (
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-muted)' }}>searching…</span>
                )}
                {selected && (
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </span>
                )}
                {searchOpen && searchResults.length > 0 && (
                  <div style={S.dropdown}>
                    {searchResults.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        style={S.dropdownItem}
                        onMouseDown={e => { e.preventDefault(); pickStudent(s) }}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                          {(s.name ?? s.email).charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name ?? s.email}</div>
                          {s.name && <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</div>}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>ID {s.id}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selected && (
                <p style={{ fontSize: 11, color: '#22C55E', marginTop: 5, fontWeight: 600 }}>
                  ✓ Selected: {selected.name ?? selected.email} (ID {selected.id})
                </p>
              )}
            </div>
            {addError && <div style={{ ...S.errorBox, marginBottom: 12 }}>{addError}</div>}
            <button
              type="submit"
              className="ns-btn-primary"
              style={{ width: '100%', height: 42, fontSize: 14, opacity: adding || !selected ? 0.6 : 1 }}
              disabled={adding || !selected}
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
          <p style={S.emptySub}>Search for a student by name or email to start tracking their progress.</p>
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
  dropdown:    { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', marginTop: 4, overflow: 'hidden' },
  dropdownItem: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' as const, transition: 'background 0.1s' },
}
