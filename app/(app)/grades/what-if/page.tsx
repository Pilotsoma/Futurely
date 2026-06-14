'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Official Katy ISD GPA Scale ───────────────────────────────────────────────
// Regular:     A=4.0  B=3.0  C=2.0  F=0.0
// KAP/AP:      A=5.0  B=4.0  C=3.0  F=1.0
// Dual Credit: A=4.5  B=3.5  C=2.5  F=0.5
// Grade cutoffs: A≥90  B≥80  C≥70  F<70

type CourseLevel = 'Regular' | 'KAP' | 'AP' | 'Dual Credit'

const GRADE_POINTS: Record<CourseLevel, Record<string, number>> = {
  'Regular':     { A: 4.0, B: 3.0, C: 2.0, F: 0.0 },
  'KAP':         { A: 5.0, B: 4.0, C: 3.0, F: 1.0 },
  'AP':          { A: 5.0, B: 4.0, C: 3.0, F: 1.0 },
  'Dual Credit': { A: 4.5, B: 3.5, C: 2.5, F: 0.5 },
}

function avgToLetter(avg: number): string {
  if (avg >= 90) return 'A'
  if (avg >= 80) return 'B'
  if (avg >= 70) return 'C'
  return 'F'
}

function gradePoints(avg: number, level: CourseLevel): number {
  const letter = avgToLetter(avg)
  return GRADE_POINTS[level][letter] ?? 0
}

function detectLevel(courseName: string): CourseLevel {
  const n = courseName.toUpperCase()
  if (/^AP\b|^AP /.test(n)) return 'AP'
  if (/\bKAP\b|^KAP /.test(n)) return 'KAP'
  if (/DUAL|DC\b/.test(n)) return 'Dual Credit'
  return 'Regular'
}

interface SimCourse {
  id: string
  name: string
  period: string
  average: number
  credits: number
  level: CourseLevel
  hypothetical: string
}

function calcGPA(courses: SimCourse[]): number {
  const gradable = courses.filter(c => {
    const avg = c.hypothetical !== '' ? (parseFloat(c.hypothetical) || c.average) : c.average
    return avg > 0
  })
  if (!gradable.length) return 0
  let totalPoints = 0, totalCredits = 0
  for (const c of gradable) {
    const avg = c.hypothetical !== '' ? (parseFloat(c.hypothetical) || c.average) : c.average
    totalPoints += gradePoints(avg, c.level) * c.credits
    totalCredits += c.credits
  }
  return totalCredits === 0 ? 0 : Math.round((totalPoints / totalCredits) * 1000) / 1000
}

const LETTER_COLORS: Record<string, string> = {
  A: '#22C55E', B: '#10B981', C: '#F59E0B', F: '#EF4444',
}
const letterColor = (avg: number) => LETTER_COLORS[avgToLetter(avg)] ?? 'var(--text-muted)'

const LEVEL_COLORS: Record<CourseLevel, { bg: string; color: string; border: string }> = {
  'AP':          { bg: 'rgba(167,139,250,0.15)', color: '#A78BFA', border: 'rgba(167,139,250,0.3)' },
  'KAP':         { bg: 'rgba(96,165,250,0.15)',  color: '#60A5FA', border: 'rgba(96,165,250,0.3)'  },
  'Dual Credit': { bg: 'rgba(52,211,153,0.15)',  color: '#34D399', border: 'rgba(52,211,153,0.3)'  },
  'Regular':     { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: 'var(--border)' },
}

export default function WhatIfGpaPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<SimCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('ns_token') : null
    fetch('/api/integrations/grades/classwork', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then((json: { data?: { classes?: Array<{ name: string; period: string; average: string | null }> }; error?: { message?: string } | string }) => {
        if (json.error) {
          const msg = typeof json.error === 'string' ? json.error : (json.error?.message ?? 'Failed to load')
          setError(msg); return
        }
        const raw = json.data?.classes ?? []
        setCourses(raw.map((c, i) => ({
          id: String(i),
          name: c.name ?? '',
          period: c.period ?? '',
          average: parseFloat(c.average ?? '0') || 0,
          credits: 0.5,
          level: detectLevel(c.name ?? ''),
          hypothetical: '',
        })))
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load grades'))
      .finally(() => setLoading(false))
  }, [])

  const realGPA = calcGPA(courses.map(c => ({ ...c, hypothetical: '' })))
  const simGPA  = calcGPA(courses)
  const delta   = simGPA - realGPA
  const hasChanges = courses.some(c => c.hypothetical !== '')

  const updateCourse = (id: string, field: 'hypothetical' | 'level', value: string) =>
    setCourses(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))

  const clearAll = () => setCourses(prev => prev.map(c => ({ ...c, hypothetical: '' })))

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading grades…</div>

  return (
    <div className="fade-up">
      <button onClick={() => router.push('/grades')} style={S.back}>← Grade Portal</button>
      <h1 style={S.title}>GPA What-If Calculator</h1>
      <p style={S.sub}>Official Katy ISD weighted scale: AP/KAP=5.0, Dual=4.5, Regular=4.0</p>

      {error && (
        <div style={S.errorBanner}>
          {error}
          {error.toLowerCase().includes('session') && (
            <span> — <a href="/settings" style={{ color: 'var(--warning)', textDecoration: 'underline' }}>reconnect in Settings</a></span>
          )}
        </div>
      )}

      {courses.length > 0 && (
        <>
          {/* GPA summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="ns-card" style={{ padding: 20 }}>
              <div style={S.gpaLabel}>Current GPA</div>
              <div style={{ ...S.gpaNum, marginTop: 8 }}>{realGPA.toFixed(3)}</div>
              <div style={S.gpaNote}>Katy ISD weighted scale</div>
            </div>
            <div className="ns-card" style={{ padding: 20, borderColor: hasChanges ? 'rgba(0,200,150,0.3)' : 'var(--border)', background: hasChanges ? 'rgba(0,200,150,0.04)' : undefined }}>
              <div style={S.gpaLabel}>Simulated GPA</div>
              <div style={{ ...S.gpaNum, marginTop: 8, color: hasChanges ? 'var(--primary)' : 'var(--text-muted)' }}>{simGPA.toFixed(3)}</div>
              {hasChanges && (
                <div style={{ fontSize: 13, fontWeight: 700, color: delta >= 0 ? '#22C55E' : '#EF4444', marginTop: 4 }}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(3)}
                </div>
              )}
            </div>
          </div>

          {hasChanges && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={clearAll} style={S.clearBtn}>Clear all changes</button>
            </div>
          )}

          {/* Course rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {courses.map(c => {
              const effectiveAvg = c.hypothetical !== '' ? (parseFloat(c.hypothetical) || c.average) : c.average
              const effectiveLetter = avgToLetter(effectiveAvg)
              const effectivePts = gradePoints(effectiveAvg, c.level)
              const isChanged = c.hypothetical !== ''
              const levelStyle = LEVEL_COLORS[c.level]

              return (
                <div key={c.id} className="ns-card"
                  style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', gap: 12,
                    borderColor: isChanged ? 'rgba(0,200,150,0.3)' : 'var(--border)' }}>
                  {/* Course info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                        {c.period ? `P${c.period} — ` : ''}{c.name}
                      </span>
                      {c.level !== 'Regular' && (
                        <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 4,
                          background: levelStyle.bg, color: levelStyle.color, border: `1px solid ${levelStyle.border}`,
                          flexShrink: 0 }}>
                          {c.level}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3 }}>
                      Current: {c.average.toFixed(1)}% ({avgToLetter(c.average)}) → {gradePoints(c.average, c.level).toFixed(1)} pts
                    </div>
                  </div>

                  {/* Level override */}
                  <select
                    value={c.level}
                    onChange={e => updateCourse(c.id, 'level', e.target.value)}
                    style={{ background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 11.5,
                      border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', outline: 'none', cursor: 'pointer' }}
                  >
                    <option>Regular</option>
                    <option>KAP</option>
                    <option>AP</option>
                    <option>Dual Credit</option>
                  </select>

                  {/* Hypothetical input */}
                  <div style={{ position: 'relative' as const, flexShrink: 0 }}>
                    <input
                      type="number" min="0" max="100"
                      value={c.hypothetical}
                      onChange={e => updateCourse(c.id, 'hypothetical', e.target.value)}
                      placeholder={c.average.toFixed(1)}
                      className="ns-input"
                      style={{ width: 80, height: 36, textAlign: 'right' as const, fontSize: 13,
                        borderColor: isChanged ? 'var(--primary)' : undefined }}
                    />
                    {isChanged && (
                      <button onClick={() => updateCourse(c.id, 'hypothetical', '')}
                        style={{ position: 'absolute', top: -8, right: -8, width: 18, height: 18,
                          borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)',
                          color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Points result */}
                  <div style={{ width: 40, textAlign: 'center' as const, flexShrink: 0, opacity: isChanged ? 1 : 0.4 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: letterColor(effectiveAvg) }}>{effectiveLetter}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>{effectivePts.toFixed(1)} pts</div>
                  </div>
                </div>
              )
            })}
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' as const, marginTop: 16, lineHeight: 1.5 }}>
            Change the level dropdown if auto-detection is wrong. Enter a new average (0–100) to simulate.
          </p>
        </>
      )}

      {!loading && !error && courses.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          No grade data available. Connect your portal in Settings.
        </p>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  back:        { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 },
  title:       { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 6 },
  sub:         { fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 20 },
  errorBanner: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: 'var(--error)', fontSize: 13, marginBottom: 16 },
  gpaLabel:    { fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)' },
  gpaNum:      { fontSize: 36, fontWeight: 800, letterSpacing: '-1px', color: 'var(--text)', lineHeight: 1 },
  gpaNote:     { fontSize: 11, color: 'var(--text-muted)', marginTop: 6 },
  clearBtn:    { background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: '6px 14px' },
}
