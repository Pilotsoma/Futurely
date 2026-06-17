'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api, type StudentData } from '../../../../lib/api'
import PageLoader from '../../../../components/ui/PageLoader'

type Tab = 'overview' | 'grades' | 'assignments' | 'chat'

type HacClass = NonNullable<StudentData['hacGrades']>['classes'][number]

const GRADE_COLORS: Record<string, string> = {
  A: '#22C55E', B: '#10B981', C: '#F59E0B', D: '#F97316', F: '#EF4444',
}
function gradeColor(letter: string | null) {
  if (!letter) return 'var(--text-muted)'
  return GRADE_COLORS[letter.charAt(0).toUpperCase()] ?? 'var(--text-muted)'
}

function letterFromAvg(avg: string | null): string {
  if (!avg) return ''
  const n = parseFloat(avg)
  if (isNaN(n)) return avg.charAt(0).toUpperCase()
  if (n >= 90) return 'A'
  if (n >= 80) return 'B'
  if (n >= 70) return 'C'
  if (n >= 60) return 'D'
  return 'F'
}

const ORDINALS: Record<string, string> = { '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '5': '5th', '6': '6th', '7': '7th', '8': '8th' }
function periodLabel(p: string): string {
  if (/^\(.*\)$/.test(p)) return 'All Periods'
  const ord = ORDINALS[p.trim()]
  if (ord) return `${ord} 6 Wks`
  return p
}

interface ChatMsg { id: string; role: 'user' | 'ai'; text: string }

export default function ParentStudentDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const studentId = parseInt(id)

  const [data, setData]       = useState<StudentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [tab, setTab]         = useState<Tab>('overview')

  // Grades tab state
  const [hacClasses, setHacClasses]           = useState<HacClass[]>([])
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([])
  const [currentPeriod, setCurrentPeriod]     = useState('')
  const [selectedPeriod, setSelectedPeriod]   = useState('')
  const [periodLoading, setPeriodLoading]     = useState(false)
  const [expanded, setExpanded]               = useState<Set<number>>(new Set())

  // Chat state
  const [messages, setMessages]   = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.parentStudentDetail(studentId)
      .then(d => {
        setData(d)
        if (d.hacGrades) {
          setHacClasses(d.hacGrades.classes)
          setAvailablePeriods(d.hacGrades.availablePeriods)
          setCurrentPeriod(d.hacGrades.currentPeriod)
          setSelectedPeriod(d.hacGrades.currentPeriod)
        }
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load student'))
      .finally(() => setLoading(false))
  }, [studentId])

  const loadPeriod = useCallback((period: string) => {
    setPeriodLoading(true)
    setExpanded(new Set())
    api.parentStudentGrades(studentId, period)
      .then(d => {
        setHacClasses(d.classes)
        if (d.availablePeriods.length > 0) setAvailablePeriods(d.availablePeriods)
        setCurrentPeriod(d.currentPeriod || period)
        setSelectedPeriod(period)
      })
      .catch(() => {})
      .finally(() => setPeriodLoading(false))
  }, [studentId])

  function toggleRow(i: number) {
    setExpanded(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  }

  async function handleChat(textOverride?: string) {
    const text = (textOverride ?? chatInput).trim()
    if (!text || chatSending) return
    setChatInput('')
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text }])
    setChatSending(true)
    try {
      const { reply } = await api.parentStudentChat(studentId, text)
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', text: reply }])
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', text: 'Sorry, I had trouble connecting. Please try again.' }])
    } finally {
      setChatSending(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  if (loading) return <PageLoader message="Opening student data…" />
  if (error)   return <div style={{ padding: 40, color: 'var(--error)' }}>{error}</div>
  if (!data)   return null

  const uGpa = (data.profile?.unweightedGpa ?? 0).toFixed(3)
  const wGpa = (data.profile?.weightedGpa ?? 0).toFixed(3)
  const firstName = data.name?.split(' ')[0] ?? 'Student'

  const today = new Date()
  const dueToday = data.assignments.filter(a => {
    if (a.completed) return false
    const d = new Date(a.dueDate)
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  })

  // Grade distribution from HAC classes
  const gradedClasses = hacClasses.filter(c => c.average != null)
  const gradeDist = gradedClasses.reduce<Record<string, number>>((acc, c) => {
    const letter = letterFromAvg(c.average)
    if (letter) acc[letter] = (acc[letter] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="fade-up">
      <button style={S.backBtn} onClick={() => router.push('/parent/dashboard')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Students
      </button>

      {/* Student header */}
      <div style={S.studentHeader}>
        <div style={S.avatar}>{(data.name ?? data.email).charAt(0).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <h1 style={S.studentName}>{data.name ?? data.email}</h1>
          <p style={S.studentSub}>
            {[data.profile?.gradeLevel ? `Grade ${data.profile.gradeLevel}` : '', data.profile?.graduationYear ? `Class of ${data.profile.graduationYear}` : ''].filter(Boolean).join(' · ') || 'Student'}
          </p>
        </div>
        <div style={S.gpaChips}>
          <div style={S.gpaChip}>
            <span style={S.gpaNum}>{uGpa}</span>
            <span style={S.gpaLbl}>UW GPA</span>
          </div>
          <div style={{ ...S.gpaChip, borderColor: 'var(--primary-glow)', background: 'var(--primary-dim)' }}>
            <span style={{ ...S.gpaNum, ...gradientStyle }}>{wGpa}</span>
            <span style={S.gpaLbl}>W GPA</span>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {(['overview', 'grades', 'assignments', 'chat'] as Tab[]).map(t => (
          <button key={t} style={{ ...S.tabBtn, ...(tab === t ? S.tabBtnActive : {}) }} onClick={() => setTab(t)}>
            {t === 'overview' ? 'Overview' : t === 'grades' ? 'Grades' : t === 'assignments' ? 'Assignments' : 'AI Chat'}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div>
          <div style={S.statsGrid}>
            {[
              { v: String(data.stats.totalCourses), l: 'Courses' },
              { v: String(data.stats.pendingAssignments), l: 'Pending', highlight: data.stats.pendingAssignments > 3 },
              { v: String(data.stats.assignmentsDueToday), l: 'Due Today', highlight: data.stats.assignmentsDueToday > 0 },
              { v: String(data.stats.assignmentsDueThisWeek), l: 'Due This Week' },
              { v: String(data.stats.completedAssignments ?? 0), l: 'Completed' },
            ].map(s => (
              <div key={s.l} className="ns-card" style={{ padding: 16, textAlign: 'center', border: s.highlight ? '1px solid rgba(239,68,68,0.3)' : undefined }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.highlight ? 'var(--error)' : 'var(--text)', marginBottom: 4 }}>{s.v}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Grade Distribution */}
          <div className="ns-card" style={{ padding: 20, marginBottom: 16 }}>
            <p style={S.cardLabel}>Grade Distribution</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -8, marginBottom: 12 }}>Based on most recent grading period</p>
            {gradedClasses.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No graded courses yet.</p>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                {['A', 'B', 'C', 'D', 'F'].map(letter => (
                  <div key={letter} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', minWidth: 52 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: gradeColor(letter) }}>{gradeDist[letter] ?? 0}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{letter}s</span>
                  </div>
                ))}
              </div>
            )}

            <p style={{ ...S.cardLabel, marginTop: 4 }}>All Courses</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {hacClasses.map((c, i) => {
                const letter = letterFromAvg(c.average)
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{c.teacher || '—'} · Period {c.period}</div>
                    </div>
                    <div style={{ textAlign: 'right' as const }}>
                      {c.average != null ? (
                        <>
                          <span style={{ fontSize: 17, fontWeight: 700, color: gradeColor(letter) }}>{letter}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 6 }}>{parseFloat(c.average).toFixed(1)}%</span>
                        </>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </div>
                  </div>
                )
              })}
              {hacClasses.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No course data available yet.</p>}
            </div>
          </div>

          {dueToday.length > 0 && (
            <div className="ns-card" style={{ padding: 20 }}>
              <p style={S.cardLabel}>Due Today ({dueToday.length})</p>
              {dueToday.map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13.5 }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{a.subject}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── GRADES ── */}
      {tab === 'grades' && (
        <div>
          {/* GPA summary */}
          <div className="ns-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'flex', padding: '18px 0', borderBottom: availablePeriods.length > 0 || hacClasses.length > 0 ? '1px solid var(--border)' : undefined }}>
              {[
                { label: 'Unweighted GPA', val: uGpa, gradient: false },
                { label: 'Weighted GPA', val: wGpa, gradient: true },
                { label: 'Courses', val: String(hacClasses.length), gradient: false },
              ].map((item, i) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  {i > 0 && <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch', margin: '0 4px' }} />}
                  <div style={{ flex: 1, textAlign: 'center' as const }}>
                    <div style={item.gradient ? { ...S.bigNum, ...gradientStyle } : S.bigNum}>{item.val}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Period dropdown */}
            {availablePeriods.length > 0 && (
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', display: 'block', marginBottom: 8 }}>
                  Grading Period
                </label>
                <select
                  value={selectedPeriod}
                  onChange={e => loadPeriod(e.target.value)}
                  disabled={periodLoading}
                  style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', minWidth: 200, appearance: 'auto', outline: 'none' }}
                >
                  {availablePeriods.map(p => <option key={p} value={p}>{periodLabel(p)}</option>)}
                </select>
              </div>
            )}

            {periodLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16 }}>
                {[1, 2, 3, 4, 5].map(i => <div key={i} style={{ height: 52, background: 'var(--surface-2)', borderRadius: 8 }} />)}
              </div>
            )}

            {!periodLoading && hacClasses.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, padding: 16 }}>
                No grade data yet. The student needs to sync their grades in Futurely first.
              </p>
            )}

            {!periodLoading && hacClasses.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr>
                    {['Course', 'Teacher', 'Period', 'Avg', 'Grade'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hacClasses.flatMap((c, i) => {
                    const letter = letterFromAvg(c.average)
                    const isExpanded = expanded.has(i)
                    return [
                      <tr key={i} className="ns-tr"
                        style={{ borderTop: '1px solid var(--border)', cursor: c.scores.length > 0 ? 'pointer' : 'default' }}
                        onClick={() => c.scores.length > 0 && toggleRow(i)}>
                        <td style={S.td}>
                          {c.name}
                          {c.scores.length > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{isExpanded ? '▲' : '▼'}</span>}
                        </td>
                        <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{c.teacher || '—'}</td>
                        <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{c.period || '—'}</td>
                        <td style={{ ...S.td, color: gradeColor(letter), fontWeight: 700 }}>{c.average ?? '—'}</td>
                        <td style={S.td}>
                          {letter ? <span style={{ color: gradeColor(letter), fontWeight: 700, fontSize: 16 }}>{letter}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                      </tr>,
                      isExpanded && (
                        <tr key={`${i}-exp`}>
                          <td colSpan={5} style={{ background: 'rgba(0,0,0,0.25)', padding: '12px 20px' }}>
                            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 10 }}>
                              Assignments ({c.scores.length})
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12.5 }}>
                              <thead>
                                <tr>{['Assignment', 'Category', 'Due', 'Score'].map(h => (
                                  <th key={h} style={{ textAlign: 'left' as const, padding: '4px 8px', color: 'var(--text-muted)', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase' as const }}>{h}</th>
                                ))}</tr>
                              </thead>
                              <tbody>
                                {c.scores.map((a, j) => (
                                  <tr key={j} style={{ borderTop: '1px solid var(--border)' }}>
                                    <td style={{ padding: '7px 8px', color: 'var(--text)' }}>{a.name}</td>
                                    <td style={{ padding: '7px 8px', color: 'var(--text-secondary)' }}>{a.category || '—'}</td>
                                    <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>{a.dateDue || '—'}</td>
                                    <td style={{ padding: '7px 8px' }}>
                                      {a.score !== null && a.totalPoints !== null
                                        ? <span style={{ color: gradeColor(letterFromAvg(String((a.score / (a.totalPoints || 1)) * 100))) }}>{a.score}/{a.totalPoints}</span>
                                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      ),
                    ].filter(Boolean)
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── ASSIGNMENTS ── */}
      {tab === 'assignments' && (
        <div className="ns-card" style={{ padding: 0, overflow: 'hidden' }}>
          {data.assignments.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', padding: 24, fontSize: 13 }}>No assignments on file.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr>
                  {['Assignment', 'Subject', 'Due Date', 'Est.', 'Status'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.assignments.map(a => {
                  const due = new Date(a.dueDate)
                  const isOverdue = !a.completed && due < new Date()
                  return (
                    <tr key={a.id} className="ns-tr" style={{ borderTop: '1px solid var(--border)', opacity: a.completed ? 0.6 : 1 }}>
                      <td style={{ ...S.td, textDecoration: a.completed ? 'line-through' : 'none' }}>{a.title}</td>
                      <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{a.subject}</td>
                      <td style={{ ...S.td, color: isOverdue ? 'var(--error)' : 'var(--text-secondary)' }}>
                        {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ ...S.td, color: 'var(--text-muted)' }}>{a.estimatedMinutes ?? 0}m</td>
                      <td style={S.td}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: a.completed ? 'rgba(34,197,94,0.12)' : isOverdue ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', color: a.completed ? '#22C55E' : isOverdue ? 'var(--error)' : 'var(--warning)' }}>
                          {a.completed ? 'Done' : isOverdue ? 'Overdue' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── AI CHAT ── */}
      {tab === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 300px)', minHeight: 400 }}>
          <div style={S.chatBanner}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
            AI context: {data.name ?? data.email}&apos;s academic data
          </div>
          <div style={S.messages}>
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, textAlign: 'center' as const }}>
                <div style={S.chatLogo}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                </div>
                <p style={{ fontSize: 15, fontWeight: 600 }}>Ask about {firstName}&apos;s academics</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 300 }}>Get insights on grades, progress, and personalized study strategies.</p>
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} style={m.role === 'user' ? S.bubbleUser : S.bubbleAi}>{m.text}</div>
            ))}
            {chatSending && (
              <div style={{ ...S.bubbleAi, color: 'var(--text-muted)', display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)' }} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)' }} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)' }} />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input className="ns-input" style={{ flex: 1, height: 46, fontSize: 14 }} value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleChat() }}
              placeholder={`Ask about ${firstName}…`} disabled={chatSending} />
            <button className="ns-btn-primary" style={{ height: 46, padding: '0 22px', opacity: chatSending ? 0.5 : 1 }}
              onClick={() => void handleChat()} disabled={chatSending}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const gradientStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const S: Record<string, React.CSSProperties> = {
  backBtn:      { background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13.5, cursor: 'pointer', marginBottom: 20, padding: 0, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 },
  studentHeader:{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 },
  avatar:       { width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, flexShrink: 0 },
  studentName:  { fontSize: 24, fontWeight: 800, letterSpacing: '-0.3px', marginBottom: 2 },
  studentSub:   { fontSize: 13, color: 'var(--text-secondary)' },
  gpaChips:     { marginLeft: 'auto', display: 'flex', gap: 10 },
  gpaChip:      { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 16px', textAlign: 'center' as const, minWidth: 72 },
  gpaNum:       { display: 'block', fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1 },
  gpaLbl:       { fontSize: 10.5, color: 'var(--text-muted)', display: 'block', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.4px' },
  tabBar:       { display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 },
  tabBtn:       { background: 'none', border: 'none', padding: '10px 20px', fontSize: 13.5, fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer', borderBottom: '2px solid transparent', transition: 'color 0.15s' },
  tabBtnActive: { color: 'var(--primary)', borderBottom: '2px solid var(--primary)', fontWeight: 600 },
  statsGrid:    { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 },
  cardLabel:    { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 14 },
  bigNum:       { fontSize: 30, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1, marginBottom: 6 },
  th:           { textAlign: 'left' as const, padding: '14px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  td:           { padding: '12px 14px', fontSize: 13.5 },
  chatBanner:   { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: 'var(--primary)', marginBottom: 14 },
  messages:     { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 },
  bubbleUser:   { maxWidth: '72%', padding: '11px 16px', borderRadius: '16px 16px 4px 16px', fontSize: 14, lineHeight: 1.55, background: 'var(--primary)', color: '#FFFFFF', alignSelf: 'flex-end', fontWeight: 500 },
  bubbleAi:     { maxWidth: '72%', padding: '11px 16px', borderRadius: '16px 16px 16px 4px', fontSize: 14, lineHeight: 1.55, background: 'var(--surface-2)', border: '1px solid var(--border)', alignSelf: 'flex-start', whiteSpace: 'pre-wrap' as const },
  chatLogo:     { width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' },
}
