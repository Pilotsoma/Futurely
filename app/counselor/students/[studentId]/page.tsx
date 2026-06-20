'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import {
  api,
  type CounselorStudentDetail,
  type CounselorStudentCourse,
  type CounselorComment,
  type CounselorNote,
  type CounselorRecommendation,
  type CounselorActionItem,
  type CounselorChatMessage,
} from '../../../../lib/api'

type Tab = 'overview' | 'grades' | 'notes' | 'recommendations' | 'action-items' | 'chat'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',         label: 'Overview' },
  { id: 'grades',           label: 'Grades' },
  { id: 'notes',            label: 'Notes' },
  { id: 'recommendations',  label: 'Recommendations' },
  { id: 'action-items',     label: 'Action Items' },
  { id: 'chat',             label: 'Chat' },
]

export default function CounselorStudentPage() {
  const router    = useRouter()
  const params    = useParams()
  const studentId = Number(params.studentId)

  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [student, setStudent]     = useState<CounselorStudentDetail | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [counselorId, setCounselorId] = useState<number | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('ns_user')
    if (raw) {
      const u = JSON.parse(raw) as { id?: number }
      if (u.id) setCounselorId(u.id)
    }
    void loadStudent()
  }, [studentId])

  async function loadStudent() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.counselorStudentDetail(studentId)
      setStudent(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student')
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove() {
    if (!confirm(`Remove ${student?.name ?? 'this student'} from your caseload?`)) return
    try {
      await api.counselorRemoveStudent(studentId)
      router.push('/counselor/dashboard')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove student')
    }
  }

  if (loading) {
    return (
      <div className="fade-up">
        <div className="shimmer" style={{ width: 60, height: 20, borderRadius: 6, marginBottom: 24 }} />
        <div className="shimmer" style={{ width: '100%', height: 60, borderRadius: 8, marginBottom: 12 }} />
        <div className="shimmer" style={{ width: 200, height: 28, borderRadius: 8, marginBottom: 8 }} />
        <div className="shimmer" style={{ width: 140, height: 16, borderRadius: 6, marginBottom: 32 }} />
        {[0, 1, 2].map(i => (
          <div key={i} className="shimmer" style={{ width: '100%', height: 40, borderRadius: 8, marginBottom: 8 }} />
        ))}
      </div>
    )
  }

  if (error || !student) {
    return (
      <div className="fade-up" style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 16px', color: '#DC2626', fontSize: 13, marginBottom: 16 }}>
          {error ?? 'Student not found.'}
        </div>
        <button className="ns-btn-primary" onClick={() => void loadStudent()}>Retry</button>
      </div>
    )
  }

  return (
    <div className="fade-up">
      {/* Back */}
      <button
        className="ns-btn-ghost"
        style={{ marginBottom: 20, fontSize: 13, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        onClick={() => router.push('/counselor/dashboard')}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        All Students
      </button>

      {/* Student name + meta */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4 }}>{student.name ?? student.email}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{student.email}</p>
      </div>

      {/* Tabs */}
      <div style={S.tabBar} role="tablist" aria-label="Student detail sections">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            style={{ ...S.tabBtn, ...(activeTab === t.id ? S.tabBtnActive : {}) }}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel" style={{ paddingTop: 20 }}>
        {activeTab === 'overview' && (
          <OverviewTab student={student} onRemove={handleRemove} />
        )}
        {activeTab === 'grades' && (
          <GradesTab studentId={studentId} />
        )}
        {activeTab === 'notes' && (
          <NotesTab studentId={studentId} />
        )}
        {activeTab === 'recommendations' && (
          <RecommendationsTab studentId={studentId} />
        )}
        {activeTab === 'action-items' && (
          <ActionItemsTab studentId={studentId} />
        )}
        {activeTab === 'chat' && (
          <ChatTab studentId={studentId} counselorId={counselorId} studentName={student.name} />
        )}
      </div>
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ student, onRemove }: { student: CounselorStudentDetail; onRemove: () => void }) {
  const p = student.profile
  return (
    <div>
      <div className="ns-card" style={{ padding: 24, marginBottom: 16 }}>
        <p style={S.sectionLabel}>Student Profile</p>
        <div style={S.profileGrid}>
          <InfoField label="Name" value={student.name ?? '—'} />
          <InfoField label="Email" value={student.email} />
          <InfoField label="Grade Level" value={p?.gradeLevel != null ? `Grade ${p.gradeLevel}` : '—'} />
          <InfoField label="Graduation Year" value={p?.graduationYear != null ? `Class of ${p.graduationYear}` : '—'} />
          <InfoField label="Weighted GPA" value={p?.weightedGpa != null ? p.weightedGpa.toFixed(3) : '—'} />
          <InfoField label="Unweighted GPA" value={p?.unweightedGpa != null ? p.unweightedGpa.toFixed(3) : '—'} />
          <InfoField label="SAT Score" value={p?.satScore != null ? String(p.satScore) : '—'} />
          <InfoField label="ACT Score" value={p?.actScore != null ? String(p.actScore) : '—'} />
        </div>
      </div>

      <button
        className="ns-btn-ghost"
        style={{ color: 'var(--error)', fontSize: 13, padding: '8px 16px' }}
        onClick={onRemove}
      >
        Remove Student
      </button>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

// ── Grades Tab ────────────────────────────────────────────────────────────────

function GradesTab({ studentId }: { studentId: number }) {
  const [courses, setCourses]   = useState<CounselorStudentCourse[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [openComment, setOpenComment] = useState<number | null>(null)
  const [comments, setComments] = useState<Record<number, CounselorComment[]>>({})
  const [commentBody, setCommentBody] = useState<Record<number, string>>({})
  const [submitting, setSubmitting]   = useState<Record<number, boolean>>({})

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.counselorStudentCourses(studentId)
        setCourses(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load courses')
      } finally {
        setLoading(false)
      }
    })()
  }, [studentId])

  async function loadComments(courseId: number) {
    try {
      const data = await api.counselorGetCourseComments(studentId, courseId)
      setComments(prev => ({ ...prev, [courseId]: data }))
    } catch {
      // best-effort
    }
  }

  async function toggleComments(courseId: number) {
    if (openComment === courseId) { setOpenComment(null); return }
    setOpenComment(courseId)
    if (!comments[courseId]) await loadComments(courseId)
  }

  async function handleSubmitComment(courseId: number) {
    const body = (commentBody[courseId] ?? '').trim()
    if (!body) return
    setSubmitting(prev => ({ ...prev, [courseId]: true }))
    try {
      const created = await api.counselorAddCourseComment(studentId, courseId, body)
      setComments(prev => ({ ...prev, [courseId]: [...(prev[courseId] ?? []), created] }))
      setCommentBody(prev => ({ ...prev, [courseId]: '' }))
    } catch {
      // best-effort
    } finally {
      setSubmitting(prev => ({ ...prev, [courseId]: false }))
    }
  }

  if (loading) return <LoadingSkeleton />
  if (error)   return <ErrorState message={error} />
  if (!courses.length) return <EmptyState message="No courses found for this student." />

  return (
    <div className="ns-card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
            {['Course', 'Teacher', 'Period', 'Grade', 'Percentage', ''].map(h => (
              <th key={h} style={S.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {courses.map(c => (
            <>
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={S.td}>{c.name}</td>
                <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{c.teacher}</td>
                <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{c.period}</td>
                <td style={{ ...S.td, fontWeight: 700 }}>{c.grade?.letterGrade ?? '—'}</td>
                <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{c.grade?.percentage != null ? `${c.grade.percentage}%` : '—'}</td>
                <td style={S.td}>
                  <button
                    className="ns-btn-ghost"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => void toggleComments(c.id)}
                  >
                    {openComment === c.id ? 'Close' : 'Comments'}
                  </button>
                </td>
              </tr>
              {openComment === c.id && (
                <tr key={`${c.id}-comments`}>
                  <td colSpan={6} style={{ padding: '14px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <p style={S.sectionLabel}>Comments</p>
                    {(comments[c.id] ?? []).length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>No comments yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                        {(comments[c.id] ?? []).map(cm => (
                          <div key={cm.id} style={{ fontSize: 13, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <div style={{ color: 'var(--text)' }}>{cm.body}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{new Date(cm.createdAt).toLocaleDateString()}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <textarea
                        value={commentBody[c.id] ?? ''}
                        onChange={e => setCommentBody(prev => ({ ...prev, [c.id]: e.target.value }))}
                        placeholder="Add a comment…"
                        rows={2}
                        style={{ ...S.textarea, flex: 1 }}
                        disabled={submitting[c.id]}
                      />
                      <button
                        className="ns-btn-primary"
                        style={{ height: 60, padding: '0 16px', fontSize: 13, alignSelf: 'flex-end', opacity: submitting[c.id] || !commentBody[c.id]?.trim() ? 0.6 : 1 }}
                        onClick={() => void handleSubmitComment(c.id)}
                        disabled={submitting[c.id] || !commentBody[c.id]?.trim()}
                      >
                        Post
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Notes Tab ─────────────────────────────────────────────────────────────────

function NotesTab({ studentId }: { studentId: number }) {
  const [notes, setNotes]       = useState<CounselorNote[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [body, setBody]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId]   = useState<number | null>(null)
  const [editBody, setEditBody]     = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.counselorGetNotes(studentId)
        setNotes(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load notes')
      } finally {
        setLoading(false)
      }
    })()
  }, [studentId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSubmitting(true)
    try {
      const created = await api.counselorAddNote(studentId, body.trim())
      setNotes(prev => [created, ...prev])
      setBody('')
    } catch {
      // best-effort
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEdit(id: number) {
    if (!editBody.trim()) return
    try {
      const updated = await api.counselorUpdateNote(id, editBody.trim())
      setNotes(prev => prev.map(n => n.id === id ? updated : n))
      setEditingId(null)
    } catch {
      // best-effort
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this note?')) return
    try {
      await api.counselorDeleteNote(id)
      setNotes(prev => prev.filter(n => n.id !== id))
    } catch {
      alert('Failed to delete note')
    }
  }

  if (loading) return <LoadingSkeleton />
  if (error)   return <ErrorState message={error} />

  return (
    <div>
      {/* Add note form */}
      <div className="ns-card" style={{ padding: 20, marginBottom: 20 }}>
        <p style={S.sectionLabel}>Add Note</p>
        <form onSubmit={e => void handleAdd(e)}>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write a note about this student…"
            maxLength={5000}
            rows={3}
            style={{ ...S.textarea, width: '100%', marginBottom: 10, boxSizing: 'border-box' }}
            disabled={submitting}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{body.length}/5000</span>
            <button
              type="submit"
              className="ns-btn-primary"
              style={{ height: 38, padding: '0 18px', fontSize: 13, opacity: submitting || !body.trim() ? 0.6 : 1 }}
              disabled={submitting || !body.trim()}
            >
              {submitting ? 'Saving…' : 'Add Note'}
            </button>
          </div>
        </form>
      </div>

      {notes.length === 0 ? (
        <EmptyState message="No notes yet." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {notes.map(n => (
            <div key={n.id} className="ns-card" style={{ padding: 18 }}>
              {editingId === n.id ? (
                <div>
                  <textarea
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    rows={3}
                    maxLength={5000}
                    style={{ ...S.textarea, width: '100%', marginBottom: 10, boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="ns-btn-ghost" style={{ height: 36, padding: '0 14px', fontSize: 13 }} onClick={() => setEditingId(null)}>Cancel</button>
                    <button className="ns-btn-primary" style={{ height: 36, padding: '0 14px', fontSize: 13 }} onClick={() => void handleEdit(n.id)}>Save</button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{n.body}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(n.createdAt).toLocaleDateString()}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="ns-btn-ghost" style={{ fontSize: 12, padding: '3px 10px' }} aria-label="Edit note" onClick={() => { setEditingId(n.id); setEditBody(n.body) }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                      </button>
                      <button className="ns-btn-ghost" style={{ fontSize: 12, padding: '3px 10px', color: 'var(--error)' }} aria-label="Delete note" onClick={() => void handleDelete(n.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Recommendations Tab ───────────────────────────────────────────────────────

function RecommendationsTab({ studentId }: { studentId: number }) {
  const [recs, setRecs]         = useState<CounselorRecommendation[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [courseName, setCourseName]   = useState('')
  const [courseCode, setCourseCode]   = useState('')
  const [semester, setSemester]       = useState('')
  const [rationale, setRationale]     = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [formError, setFormError]     = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.counselorGetRecommendations(studentId)
        setRecs(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recommendations')
      } finally {
        setLoading(false)
      }
    })()
  }, [studentId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!courseName.trim() || !semester.trim()) { setFormError('Course name and semester are required.'); return }
    setSubmitting(true)
    setFormError(null)
    try {
      const created = await api.counselorAddRecommendation(studentId, {
        courseName: courseName.trim(),
        courseCode: courseCode.trim() || undefined,
        semester: semester.trim(),
        rationale: rationale.trim() || undefined,
      })
      setRecs(prev => [created, ...prev])
      setCourseName(''); setCourseCode(''); setSemester(''); setRationale('')
      setShowForm(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add recommendation')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this recommendation?')) return
    try {
      await api.counselorDeleteRecommendation(id)
      setRecs(prev => prev.filter(r => r.id !== id))
    } catch {
      alert('Failed to delete recommendation')
    }
  }

  if (loading) return <LoadingSkeleton />
  if (error)   return <ErrorState message={error} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="ns-btn-primary" style={{ height: 38, padding: '0 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => { setShowForm(v => !v); setFormError(null) }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Recommendation
        </button>
      </div>

      {showForm && (
        <div className="ns-card" style={{ padding: 20, marginBottom: 20 }}>
          <form onSubmit={e => void handleSubmit(e)}>
            <div style={S.formRow}>
              <div style={{ flex: 1 }}>
                <label htmlFor="rec-course-name" style={S.fieldLabel}>Course Name <span style={{ color: 'var(--error)' }}>*</span></label>
                <input id="rec-course-name" className="ns-input" type="text" value={courseName} onChange={e => setCourseName(e.target.value)} placeholder="e.g. AP Calculus BC" disabled={submitting} style={S.input} />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="rec-course-code" style={S.fieldLabel}>Course Code <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
                <input id="rec-course-code" className="ns-input" type="text" value={courseCode} onChange={e => setCourseCode(e.target.value)} placeholder="e.g. MATH4200" disabled={submitting} style={S.input} />
              </div>
            </div>
            <div style={S.formRow}>
              <div style={{ flex: 1 }}>
                <label htmlFor="rec-semester" style={S.fieldLabel}>Semester <span style={{ color: 'var(--error)' }}>*</span></label>
                <input id="rec-semester" className="ns-input" type="text" value={semester} onChange={e => setSemester(e.target.value)} placeholder="e.g. Fall 2025" disabled={submitting} style={S.input} />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="rec-rationale" style={S.fieldLabel}>Rationale <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
                <input id="rec-rationale" className="ns-input" type="text" value={rationale} onChange={e => setRationale(e.target.value)} placeholder="Why this course?" disabled={submitting} style={S.input} />
              </div>
            </div>
            {formError && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 16px', color: '#DC2626', fontSize: 13, marginBottom: 10 }}>{formError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="ns-btn-ghost" style={{ height: 38, padding: '0 14px', fontSize: 13 }} onClick={() => setShowForm(false)} disabled={submitting}>Cancel</button>
              <button type="submit" className="ns-btn-primary" style={{ height: 38, padding: '0 18px', fontSize: 13, opacity: submitting ? 0.6 : 1 }} disabled={submitting}>{submitting ? 'Saving…' : 'Add'}</button>
            </div>
          </form>
        </div>
      )}

      {recs.length === 0 ? (
        <EmptyStateWithCTA
          message="No recommendations yet."
          ctaLabel="Add Recommendation"
          onCTA={() => { setShowForm(true); setFormError(null) }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recs.map(r => (
            <div key={r.id} className="ns-card" style={{ padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{r.courseName}{r.courseCode ? ` (${r.courseCode})` : ''}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{r.semester}</div>
                {r.rationale && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>{r.rationale}</div>}
              </div>
              <button className="ns-btn-ghost" style={{ fontSize: 12, padding: '4px 10px', color: 'var(--error)', flexShrink: 0 }} aria-label="Delete recommendation" onClick={() => void handleDelete(r.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Action Items Tab ──────────────────────────────────────────────────────────

function ActionItemsTab({ studentId }: { studentId: number }) {
  const [items, setItems]       = useState<CounselorActionItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [aTitle, setATitle]     = useState('')
  const [aDesc, setADesc]       = useState('')
  const [aDue, setADue]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.counselorGetActionItems(studentId)
        setItems(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load action items')
      } finally {
        setLoading(false)
      }
    })()
  }, [studentId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!aTitle.trim()) { setFormError('Title is required.'); return }
    setSubmitting(true)
    setFormError(null)
    try {
      const created = await api.counselorAddActionItem(studentId, {
        title: aTitle.trim(),
        description: aDesc.trim() || undefined,
        dueDate: aDue || undefined,
      })
      setItems(prev => [...prev, created])
      setATitle(''); setADesc(''); setADue('')
      setShowForm(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add action item')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggle(id: number, completed: boolean) {
    try {
      const updated = await api.counselorUpdateActionItem(id, { completed })
      setItems(prev => prev.map(i => i.id === id ? updated : i))
    } catch {
      // best-effort
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this action item?')) return
    try {
      await api.counselorDeleteActionItem(id)
      setItems(prev => prev.filter(i => i.id !== id))
    } catch {
      alert('Failed to delete action item')
    }
  }

  const incomplete = items.filter(i => !i.completed)
  const complete   = items.filter(i => i.completed)

  if (loading) return <LoadingSkeleton />
  if (error)   return <ErrorState message={error} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="ns-btn-primary" style={{ height: 38, padding: '0 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => { setShowForm(v => !v); setFormError(null) }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Action Item
        </button>
      </div>

      {showForm && (
        <div className="ns-card" style={{ padding: 20, marginBottom: 20 }}>
          <form onSubmit={e => void handleAdd(e)}>
            <div style={S.formRow}>
              <div style={{ flex: 2 }}>
                <label htmlFor="action-title" style={S.fieldLabel}>Title <span style={{ color: 'var(--error)' }}>*</span></label>
                <input id="action-title" className="ns-input" type="text" value={aTitle} onChange={e => setATitle(e.target.value)} placeholder="Action item title" disabled={submitting} style={S.input} />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="action-due" style={S.fieldLabel}>Due Date <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
                <input id="action-due" className="ns-input" type="date" value={aDue} onChange={e => setADue(e.target.value)} disabled={submitting} style={S.input} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="action-desc" style={S.fieldLabel}>Description <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
              <input id="action-desc" className="ns-input" type="text" value={aDesc} onChange={e => setADesc(e.target.value)} placeholder="Brief description" disabled={submitting} style={S.input} />
            </div>
            {formError && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 16px', color: '#DC2626', fontSize: 13, marginBottom: 10 }}>{formError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="ns-btn-ghost" style={{ height: 38, padding: '0 14px', fontSize: 13 }} onClick={() => setShowForm(false)} disabled={submitting}>Cancel</button>
              <button type="submit" className="ns-btn-primary" style={{ height: 38, padding: '0 18px', fontSize: 13, opacity: submitting ? 0.6 : 1 }} disabled={submitting}>{submitting ? 'Saving…' : 'Add'}</button>
            </div>
          </form>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyStateWithCTA
          message="No action items yet."
          ctaLabel="Add Action Item"
          onCTA={() => { setShowForm(true); setFormError(null) }}
        />
      ) : (
        <>
          {incomplete.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ ...S.sectionLabel, marginBottom: 10 }}>Incomplete ({incomplete.length})</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {incomplete.map(item => (
                  <ActionItemRow key={item.id} item={item} onToggle={handleToggle} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}
          {complete.length > 0 && (
            <div>
              <p style={{ ...S.sectionLabel, marginBottom: 10 }}>Completed ({complete.length})</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {complete.map(item => (
                  <ActionItemRow key={item.id} item={item} onToggle={handleToggle} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ActionItemRow({ item, onToggle, onDelete }: {
  item: CounselorActionItem
  onToggle: (id: number, completed: boolean) => Promise<void>
  onDelete: (id: number) => Promise<void>
}) {
  return (
    <div className="ns-card" style={{ padding: 14, display: 'flex', alignItems: 'flex-start', gap: 12, opacity: item.completed ? 0.7 : 1 }}>
      <input
        type="checkbox"
        checked={item.completed}
        onChange={e => void onToggle(item.id, e.target.checked)}
        style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0, cursor: 'pointer', accentColor: 'var(--primary)' }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? 'var(--text-muted)' : 'var(--text)' }}>{item.title}</div>
        {item.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.description}</div>}
        {item.dueDate && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Due {new Date(item.dueDate).toLocaleDateString()}</div>}
      </div>
      <button className="ns-btn-ghost" style={{ fontSize: 12, padding: '3px 10px', color: 'var(--error)', flexShrink: 0 }} aria-label="Delete action item" onClick={() => void onDelete(item.id)}>Delete</button>
    </div>
  )
}

// ── Chat Tab ──────────────────────────────────────────────────────────────────

function ChatTab({ studentId, counselorId, studentName }: { studentId: number; counselorId: number | null; studentName: string | null }) {
  const [messages, setMessages] = useState<CounselorChatMessage[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [body, setBody]         = useState('')
  const [sending, setSending]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.counselorGetChat(studentId)
        setMessages(data.messages ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load messages')
      } finally {
        setLoading(false)
        scrollToBottom()
      }
    })()
  }, [studentId, scrollToBottom])

  // Supabase Realtime subscription
  useEffect(() => {
    if (!counselorId) return

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    )

    const channel = supabase
      .channel(`counselor-chat:${counselorId}:${studentId}`)
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        setMessages(prev => [...prev, payload as CounselorChatMessage])
        scrollToBottom()
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [counselorId, studentId, scrollToBottom])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() || sending) return
    const text = body.trim()
    setBody('')
    setSending(true)
    try {
      const msg = await api.counselorSendChat(studentId, text)
      setMessages(prev => [...prev, msg])
      scrollToBottom()
    } catch {
      setBody(text) // restore on error
    } finally {
      setSending(false)
    }
  }

  if (loading) return <LoadingSkeleton />
  if (error)   return <ErrorState message={error} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 320px)', minHeight: 400 }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0', marginBottom: 16 }}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            No messages yet. Start the conversation.
          </div>
        ) : (
          messages.map(m => {
            const isCounselor = m.senderId === counselorId
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isCounselor ? 'flex-end' : 'flex-start' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, paddingLeft: isCounselor ? 0 : 4, paddingRight: isCounselor ? 4 : 0 }}>
                  {isCounselor ? 'You' : (studentName ?? 'Student')}
                </div>
                <div style={{
                  maxWidth: '72%',
                  padding: '10px 14px',
                  borderRadius: isCounselor ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  fontSize: 14,
                  lineHeight: 1.5,
                  background: isCounselor ? 'var(--primary)' : 'var(--surface-2)',
                  color: isCounselor ? '#FFFFFF' : 'var(--text)',
                  border: isCounselor ? 'none' : '1px solid var(--border)',
                }}>
                  {m.body}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, paddingLeft: isCounselor ? 0 : 4, paddingRight: isCounselor ? 4 : 0 }}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )
          })
        )}
        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ padding: '10px 14px', borderRadius: '16px 16px 4px 16px', background: 'var(--primary)', opacity: 0.5, color: '#FFFFFF', fontSize: 14 }}>…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={e => void handleSend(e)} style={{ display: 'flex', gap: 10 }}>
        <input
          className="ns-input"
          style={{ flex: 1, height: 46, fontSize: 14 }}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={`Message ${studentName ?? 'student'}…`}
          disabled={sending}
        />
        <button
          type="submit"
          className="ns-btn-primary"
          style={{ height: 46, padding: '0 20px', flexShrink: 0, opacity: sending || !body.trim() ? 0.5 : 1 }}
          disabled={sending || !body.trim()}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </form>
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[0, 1, 2].map(i => (
        <div key={i} className="ns-card" style={{ padding: 18, height: 70 }}>
          <div className="shimmer" style={{ width: '60%', height: 16, borderRadius: 6, marginBottom: 8 }} />
          <div className="shimmer" style={{ width: '40%', height: 13, borderRadius: 6 }} />
        </div>
      ))}
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 16px', color: '#DC2626', fontSize: 13 }}>{message}</div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>{message}</div>
}

function EmptyStateWithCTA({ message, ctaLabel, onCTA }: { message: string; ctaLabel: string; onCTA: () => void }) {
  return (
    <div style={{ padding: '40px 0', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>{message}</p>
      <button
        className="ns-btn-primary"
        style={{ height: 38, padding: '0 18px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        onClick={onCTA}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        {ctaLabel}
      </button>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  tabBar:      { display: 'flex', gap: 2, borderBottom: '2px solid var(--border)', marginBottom: 0, overflowX: 'auto' },
  tabBtn:      { background: 'none', border: 'none', borderBottom: '2px solid transparent', marginBottom: -2, padding: '10px 16px', fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' },
  tabBtnActive: { color: 'var(--primary)', borderBottom: '2px solid var(--primary)', fontWeight: 700 },
  sectionLabel: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 16 },
  profileGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px 32px' },
  fieldLabel:  { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 },
  input:       { width: '100%', height: 40, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', fontSize: 14, color: 'var(--text)', boxSizing: 'border-box' as const },
  textarea:    { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--text)', resize: 'vertical' as const, fontFamily: 'inherit', lineHeight: 1.5 },
  formRow:     { display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
  th:          { textAlign: 'left' as const, padding: '10px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' },
  td:          { padding: '12px 16px', fontSize: 14, color: 'var(--text)', verticalAlign: 'top' },
}
