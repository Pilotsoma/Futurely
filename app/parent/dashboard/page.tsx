'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, type ParentStudentSummary } from '../../../lib/api'
import { SORTED_ISD_LIST, type ISDEntry } from '../../../lib/isds'
import PageLoader from '../../../components/ui/PageLoader'

const GRADE_COLORS: Record<string, string> = {
  A: '#22C55E', B: '#10B981', C: '#F59E0B', D: '#F97316', F: '#EF4444',
}
function gradeColor(letter: string | null) {
  if (!letter) return 'var(--text-muted)'
  return GRADE_COLORS[letter.charAt(0).toUpperCase()] ?? 'var(--text-muted)'
}

function initials(name: string | null, fallback: string) {
  const n = name || fallback
  return n.slice(0, 2).toUpperCase()
}

export default function ParentDashboard() {
  const router = useRouter()
  const [students, setStudents] = useState<ParentStudentSummary[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const [showLinkForm, setShowLinkForm] = useState(false)
  const [linking, setLinking]           = useState(false)
  const [linkError, setLinkError]       = useState<string | null>(null)
  const [linkSuccess, setLinkSuccess]   = useState<string | null>(null)

  // Portal credentials form state
  const [districtUrl, setDistrictUrl]       = useState('')
  const [hacUsername, setHacUsername]       = useState('')
  const [hacPassword, setHacPassword]       = useState('')
  const [selectedIsd, setSelectedIsd]       = useState<ISDEntry | null>(null)
  const [isdSearch, setIsdSearch]           = useState('')
  const [isdOpen, setIsdOpen]               = useState(false)
  const [useCustomUrl, setUseCustomUrl]     = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.parentStudents()
      .then(setStudents)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load students'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsdOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  const filteredIsds = SORTED_ISD_LIST.filter(isd =>
    isd.name.toLowerCase().includes(isdSearch.toLowerCase()) ||
    isd.state.toLowerCase().includes(isdSearch.toLowerCase()),
  )

  function selectIsd(isd: ISDEntry) {
    setSelectedIsd(isd); setDistrictUrl(isd.hacUrl ?? ''); setUseCustomUrl(false); setIsdSearch(''); setIsdOpen(false)
  }
  function selectOther() {
    setSelectedIsd(null); setDistrictUrl(''); setUseCustomUrl(true); setIsdSearch(''); setIsdOpen(false)
  }

  function resetForm() {
    setDistrictUrl(''); setHacUsername(''); setHacPassword('')
    setSelectedIsd(null); setIsdSearch(''); setIsdOpen(false); setUseCustomUrl(false)
    setLinkError(null); setLinkSuccess(null)
  }

  async function handleLink(e: React.FormEvent) {
    e.preventDefault()
    setLinkError(null); setLinkSuccess(null)
    if (!districtUrl.trim() || !hacUsername.trim() || !hacPassword.trim()) {
      setLinkError('Please fill in all fields.')
      return
    }
    setLinking(true)
    try {
      const { student } = await api.parentLinkStudent({
        districtUrl: districtUrl.trim(),
        username: hacUsername.trim(),
        password: hacPassword,
      })
      setLinkSuccess(`${student.name ?? student.email} connected successfully.`)
      const updated = await api.parentStudents()
      setStudents(updated)
      setTimeout(() => { setShowLinkForm(false); resetForm() }, 1800)
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Failed to connect student')
    } finally {
      setLinking(false)
    }
  }

  async function handleUnlink(studentId: number, studentName: string | null) {
    if (!confirm(`Remove ${studentName ?? 'this student'} from your account?`)) return
    try {
      await api.parentUnlinkStudent(studentId)
      setStudents(prev => prev.filter(s => s.id !== studentId))
    } catch {
      alert('Failed to remove student')
    }
  }

  const isdLabel = useCustomUrl
    ? 'Other / Not Listed'
    : selectedIsd
      ? `${selectedIsd.name} (${selectedIsd.state})`
      : ''

  if (loading) return <PageLoader message="Opening student overview…" />
  if (error)   return <div style={{ padding: 40, color: 'var(--error)' }}>{error}</div>

  return (
    <div className="fade-up">
      {/* Page header */}
      <div style={S.pageHeader}>
        <div>
          <h1 style={S.title}>Student Overview</h1>
          <p style={S.subtitle}>
            {students.length === 0
              ? 'No students linked yet.'
              : `${students.length} student${students.length > 1 ? 's' : ''} linked to your account`}
          </p>
        </div>
        <button className="ns-btn-primary"
          style={{ height: 40, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={() => { if (showLinkForm) resetForm(); setShowLinkForm(v => !v) }}>
          {showLinkForm ? (
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

      {/* Connect child form */}
      {showLinkForm && (
        <div className="ns-card" style={{ padding: 24, marginBottom: 24 }}>
          <p style={S.cardLabel}>Connect your child&apos;s school portal</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Enter your child&apos;s school district and Home Access Center login credentials to securely connect their account.
          </p>

          <form onSubmit={e => void handleLink(e)}>
            {/* ISD Dropdown */}
            <div style={{ marginBottom: 14 }}>
              <label style={S.fieldLabel}>School District</label>
              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <button type="button"
                  style={{ ...S.input, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', color: isdLabel ? 'var(--text)' : 'var(--text-muted)', width: '100%' }}
                  onClick={() => setIsdOpen(v => !v)} disabled={linking}>
                  <span>{isdLabel || 'Search for your school district…'}</span>
                  <span style={{ fontSize: 11, marginLeft: 8, flexShrink: 0 }}>{isdOpen ? '▲' : '▼'}</span>
                </button>
                {isdOpen && (
                  <div style={S.dropdown}>
                    <input autoFocus type="text" value={isdSearch}
                      onChange={e => setIsdSearch(e.target.value)}
                      placeholder="Search districts…"
                      style={{ ...S.input, marginBottom: 6, fontSize: 13 }} />
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {filteredIsds.length === 0 ? (
                        <>
                          <div style={S.dropdownEmpty}>No districts found</div>
                          <button type="button" style={S.dropdownItem} onClick={selectOther}>
                            Other / Not Listed
                          </button>
                        </>
                      ) : (
                        <>
                          {filteredIsds.map(isd => (
                            <button key={isd.hacUrl} type="button"
                              style={{ ...S.dropdownItem, ...(selectedIsd?.hacUrl === isd.hacUrl ? S.dropdownItemActive : {}) }}
                              onClick={() => selectIsd(isd)}>
                              {isd.name}
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{isd.state}</span>
                            </button>
                          ))}
                          <button type="button" style={S.dropdownItem} onClick={selectOther}>
                            Other / Not Listed
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Custom URL (shown when "Other" is selected) */}
            {useCustomUrl && (
              <div style={{ marginBottom: 14 }}>
                <label style={S.fieldLabel}>Portal URL</label>
                <input className="ns-input" type="url" value={districtUrl}
                  onChange={e => setDistrictUrl(e.target.value)}
                  placeholder="https://hac.yourschool.org"
                  disabled={linking} style={S.input} />
              </div>
            )}

            {/* Username */}
            <div style={{ marginBottom: 14 }}>
              <label style={S.fieldLabel}>HAC Username (Student ID)</label>
              <input className="ns-input" type="text" value={hacUsername}
                onChange={e => setHacUsername(e.target.value)}
                placeholder="e.g. K2300001" autoComplete="username"
                disabled={linking} style={S.input} />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <label style={S.fieldLabel}>HAC Password</label>
              <input className="ns-input" type="password" value={hacPassword}
                onChange={e => setHacPassword(e.target.value)}
                placeholder="Your child's portal password" autoComplete="current-password"
                disabled={linking} style={S.input} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                Credentials are encrypted and only used to access your child&apos;s grades.
              </span>
            </div>

            <button className="ns-btn-primary" type="submit" disabled={linking || !districtUrl || !hacUsername || !hacPassword}
              style={{ width: '100%', height: 44, fontSize: 14, opacity: (linking || !districtUrl || !hacUsername || !hacPassword) ? 0.6 : 1 }}>
              {linking ? 'Connecting…' : 'Connect Student Portal'}
            </button>
          </form>

          {linkError   && <p style={{ color: 'var(--error)',   fontSize: 13, marginTop: 12 }}>{linkError}</p>}
          {linkSuccess && <p style={{ color: 'var(--primary)', fontSize: 13, marginTop: 12 }}>{linkSuccess}</p>}
        </div>
      )}

      {/* Empty state */}
      {students.length === 0 ? (
        <div style={S.empty}>
          <div style={S.emptyIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <p style={S.emptyTitle}>No students yet</p>
          <p style={S.emptySub}>Click &quot;Add Student&quot; and connect your child&apos;s school portal to get started.</p>
        </div>
      ) : (
        <div style={S.grid}>
          {students.map(s => (
            <div key={s.id} className="ns-card" style={{ padding: 20 }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={S.avatar}>{initials(s.name, s.email)}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name ?? s.email}</div>
                    {s.gradeLevel && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Grade {s.gradeLevel}{s.graduationYear ? ` · Class of ${s.graduationYear}` : ''}
                      </div>
                    )}
                  </div>
                </div>
                <button style={S.removeBtn} onClick={() => handleUnlink(s.id, s.name)} title="Remove student">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* GPA row */}
              <div style={S.gpaRow}>
                <div style={{ flex: 1, textAlign: 'center' as const }}>
                  <div style={S.gpaVal}>{s.unweightedGpa.toFixed(3)}</div>
                  <div style={S.gpaLbl}>UW GPA</div>
                </div>
                <div style={S.gpaDivider} />
                <div style={{ flex: 1, textAlign: 'center' as const }}>
                  <div style={{ ...S.gpaVal, ...gradientStyle }}>{s.weightedGpa.toFixed(3)}</div>
                  <div style={S.gpaLbl}>W GPA</div>
                </div>
                <div style={S.gpaDivider} />
                <div style={{ flex: 1, textAlign: 'center' as const }}>
                  <div style={{ ...S.gpaVal, color: s.pendingAssignments > 0 ? 'var(--warning)' : 'var(--text)' }}>{s.pendingAssignments}</div>
                  <div style={S.gpaLbl}>Pending</div>
                </div>
              </div>

              {/* Courses */}
              {s.courses.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={S.sectionLabel}>Courses</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {s.courses.slice(0, 4).map((c, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{c.name}</span>
                        <span style={{ fontWeight: 700, color: gradeColor(c.letterGrade), fontSize: 14 }}>
                          {c.letterGrade ?? '—'}
                        </span>
                      </div>
                    ))}
                    {s.courses.length > 4 && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>+{s.courses.length - 4} more courses</div>
                    )}
                  </div>
                </div>
              )}

              {/* View button */}
              <button className="ns-btn-ghost" style={{ width: '100%', height: 38, fontSize: 13 }}
                onClick={() => router.push(`/parent/students/${s.id}`)}>
                View Full Report
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 6 }}>
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const gradientStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg,#00C896,#4DC8E0)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const S: Record<string, React.CSSProperties> = {
  pageHeader:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  title:           { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4 },
  subtitle:        { fontSize: 13, color: 'var(--text-secondary)' },
  cardLabel:       { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 6 },
  fieldLabel:      { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 },
  input:           { width: '100%', height: 42, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', fontSize: 14, color: 'var(--text)', boxSizing: 'border-box' as const },
  dropdown:        { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' },
  dropdownItem:    { display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13.5, color: 'var(--text)' },
  dropdownItemActive: { background: 'var(--surface-2)', color: 'var(--primary)' },
  dropdownEmpty:   { padding: '8px 10px', fontSize: 13, color: 'var(--text-muted)' },
  empty:           { textAlign: 'center', padding: '80px 0' },
  emptyIcon:       { width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' },
  emptyTitle:      { fontSize: 17, fontWeight: 700, marginBottom: 6 },
  emptySub:        { fontSize: 13, color: 'var(--text-secondary)' },
  grid:            { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 },
  avatar:          { width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#00A3CC,#4DC8E0)', color: '#060D10', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, flexShrink: 0 },
  removeBtn:       { background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' },
  gpaRow:          { display: 'flex', background: 'var(--surface-2)', borderRadius: 10, padding: '12px 0', marginBottom: 16, border: '1px solid var(--border)' },
  gpaVal:          { fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1, marginBottom: 4 },
  gpaLbl:          { fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' },
  gpaDivider:      { width: 1, background: 'var(--border)', alignSelf: 'stretch', margin: '0 4px' },
  sectionLabel:    { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 },
}
