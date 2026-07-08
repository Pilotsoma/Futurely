'use client'

import React from 'react'
import { ArrowLeftIcon } from '@/components/icons'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageLoader from '../../../../components/ui/PageLoader'
import { api, getApiToken } from '../../../../lib/api'

// ── Official Katy ISD GPA Scale ───────────────────────────────────────────────
// Regular:     A=4.0  B=3.0  C=2.0  F=0.0
// Pre-AP/AP:   A=5.0  B=4.0  C=3.0  F=1.0 (Weighted only)
// Dual Credit: A=4.5  B=3.5  C=2.5  F=0.5 (Weighted only)
// Unweighted:  All courses use Regular scale (A=4.0, B=3.0, C=2.0, F=0.0)
// Grade cutoffs: A≥90  B≥80  C≥70  F<70

type CourseLevel = 'Regular' | 'Pre-AP' | 'AP' | 'Dual Credit'
type GpaType = 'weighted' | 'unweighted'

const GRADE_POINTS: Record<CourseLevel, Record<string, number>> = {
  'Regular':     { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0.0 },
  'Pre-AP':      { A: 5.0, B: 4.0, C: 3.0, D: 2.0, F: 0.0 },
  'AP':          { A: 5.0, B: 4.0, C: 3.0, D: 2.0, F: 0.0 },
  'Dual Credit': { A: 4.5, B: 3.5, C: 2.5, D: 1.5, F: 0.0 },
}

function avgToLetter(avg: number): string {
  if (avg >= 90) return 'A'
  if (avg >= 80) return 'B'
  if (avg >= 70) return 'C'
  if (avg >= 60) return 'D'
  return 'F'
}

function gradePoints(avg: number, level: CourseLevel, gpaType: GpaType): number {
  const letter = avgToLetter(avg)
  if (gpaType === 'unweighted') return GRADE_POINTS['Regular'][letter] ?? 0
  return GRADE_POINTS[level][letter] ?? 0
}

function detectLevel(courseName: string): CourseLevel {
  const n = courseName.toUpperCase().trim()
  // Strip a leading course-code prefix so detection runs on the actual title:
  //  - Transcript rows: "CODE — DESCRIPTION" (em dash), e.g. "A3580300 - 1 — APCSPRIN"
  //  - Classwork rows: "CODE - SECTION DESCRIPTION" (plain hyphen), e.g. "0231B - 10 AP PRE CALC GT B"
  const desc = n.includes(' — ')
    ? n.slice(n.lastIndexOf(' — ') + 3)
    : n.replace(/^[A-Z0-9]+\s*-\s*\d+\s+/, '')

  // Match AP/KAP/Dual-Credit markers as a standalone token anywhere in the
  // title — as a prefix ("AP PRE CALC"), a suffix ("... (DUAL CR)"), etc. —
  // not just at the very start. Bounded by non-letters on both sides so
  // "APPLIED" or "MAP" don't false-match.
  const hasToken = (token: string) => new RegExp(`(?:^|[^A-Z])${token}(?:[^A-Z]|$)`).test(desc)

  if (hasToken('KAP')) return 'Pre-AP'
  if (hasToken('AP')) return 'AP'
  if (hasToken('DUAL') || hasToken('DC')) return 'Dual Credit'
  return 'Regular'
}

interface SimCourse {
  id: string
  name: string
  level: CourseLevel
  average: number          // projected grade percentage (editable)
  originalAverage: number  // synced grade percentage, for reset/delta comparisons
}

const LETTER_COLORS: Record<string, string> = {
  A: 'var(--gc-a)', B: 'var(--gc-b)', C: 'var(--gc-c)', F: 'var(--gc-f)',
}
const letterColor = (avg: number) => LETTER_COLORS[avgToLetter(avg)] ?? 'var(--text-muted)'

const LEVEL_COLORS: Record<CourseLevel, { bg: string; color: string; border: string }> = {
  'AP':          { bg: 'rgba(167,139,250,0.15)', color: '#A78BFA', border: 'rgba(167,139,250,0.3)' },
  'Pre-AP':      { bg: 'rgba(96,165,250,0.15)',  color: '#60A5FA', border: 'rgba(96,165,250,0.3)'  },
  'Dual Credit': { bg: 'rgba(52,211,153,0.15)',  color: '#34D399', border: 'rgba(52,211,153,0.3)'  },
  'Regular':     { bg: 'var(--surface-2)', color: 'var(--text-muted)', border: 'var(--border)' },
}

async function apiFetch<T>(path: string): Promise<T> {
  const token = typeof window !== 'undefined' ? getApiToken() : null
  const res = await fetch(path, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = typeof json?.error === 'string'
      ? json.error
      : (json?.error?.message ?? res.statusText)
    throw new Error(msg)
  }
  return json.data as T
}

export default function WhatIfGpaPage() {
  const router = useRouter()
  const [simCourses, setSimCourses]         = useState<SimCourse[]>([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState<string | null>(null)
  const [resyncing, setResyncing]           = useState(false)
  const [gpaType, setGpaType]               = useState<GpaType>('weighted')
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null)

  // Exact GPAs from HAC (same source as dashboard)
  const [exactWeightedGpa, setExactWeightedGpa]     = useState<number | null>(null)
  const [exactUnweightedGpa, setExactUnweightedGpa] = useState<number | null>(null)
  const [courseCount, setCourseCount]               = useState(0)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // 1. Fetch exact GPAs from the portal (what HAC calculates, not recomputed)
        const gpaJson = await apiFetch<{
          unweightedGpa: number | null
          weightedGpa: number | null
          courseCount: number
        }>('/api/integrations/grades/gpa')

        if (gpaJson.unweightedGpa === null && gpaJson.weightedGpa === null) {
          setError('No GPA data found. Connect your school portal in Settings.')
          setLoading(false)
          return
        }

        setExactWeightedGpa(gpaJson.weightedGpa)
        setExactUnweightedGpa(gpaJson.unweightedGpa)
        setCourseCount(gpaJson.courseCount)

        // 2. Fetch current classes and seed the simulator with them,
        // using each course's real weight/level and synced grade.
        const classworkRes = await fetch('/api/integrations/grades/classwork', {
          credentials: 'include',
          headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? getApiToken() : null}` },
        })
        const classworkJson = await classworkRes.json()
        const raw = classworkJson.data?.classes ?? []
        setSimCourses(raw.map((c: { name: string; average: string | null }, i: number) => {
          const avg = parseFloat(c.average ?? '')
          const average = isNaN(avg) ? 0 : avg
          return {
            id: `sim-${i}`,
            name: c.name ?? '',
            level: detectLevel(c.name ?? ''),
            average,
            originalAverage: average,
          }
        }))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  async function handleResync() {
    setResyncing(true)
    setError(null)
    try {
      await api.portalSyncProfile()
      window.location.reload()
    } catch {
      setError('Resync failed. Try again.')
    } finally {
      setResyncing(false)
    }
  }

  // Project the simulated GPA by swapping each edited course's grade-point
  // contribution in and out of the real cumulative GPA — NOT by averaging
  // the synced courses on their own, which would ignore all prior semesters'
  // history baked into the exact HAC GPA and produce a bogus number even
  // with zero edits. With no edits, originalPts === editedPts, so this
  // always resolves back to exactly the baseline GPA.
  function calcSimulatedGpa(type: GpaType): number {
    const base = type === 'weighted' ? exactWeightedGpa : exactUnweightedGpa
    if (base === null || courseCount === 0) return 0

    const originalPts = simCourses.reduce((sum, c) =>
      sum + (c.originalAverage > 0 ? gradePoints(c.originalAverage, c.level, type) : 0), 0)
    const editedPts = simCourses.reduce((sum, c) =>
      sum + (c.average > 0 ? gradePoints(c.average, c.level, type) : 0), 0)

    const otherPoints = base * courseCount - originalPts
    return Math.round(((otherPoints + editedPts) / courseCount) * 1000) / 1000
  }

  const baselineGpa = (gpaType === 'weighted' ? exactWeightedGpa : exactUnweightedGpa) ?? 0
  const simGPA      = calcSimulatedGpa(gpaType)
  const delta       = simGPA - baselineGpa
  const isEdited     = simCourses.some(c => c.average !== c.originalAverage)

  const updateSimCourse = (id: string, field: 'average' | 'level', value: string) =>
    setSimCourses(prev => prev.map(c => c.id === id ? {
      ...c,
      [field]: field === 'average' ? (parseFloat(value) || 0) : (value as CourseLevel),
    } : c))

  const resetAll = () => setSimCourses(prev => prev.map(c => ({ ...c, average: c.originalAverage })))

  if (loading) return <PageLoader message="Opening GPA calculator…" />

  return (
    <div className="fade-up">
      <button onClick={() => router.push('/grades')} style={S.back}><ArrowLeftIcon size={14}/> Grade Portal</button>
      <h1 style={S.title}>GPA What-If Calculator</h1>

      {/* GPA type toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setGpaType('weighted')}
          style={{
            ...S.toggleBtn,
            background: gpaType === 'weighted' ? 'var(--primary)' : 'var(--surface)',
            color: gpaType === 'weighted' ? '#fff' : 'var(--text-secondary)',
            borderColor: gpaType === 'weighted' ? 'var(--primary)' : 'var(--border)',
          }}>Weighted</button>
        <button onClick={() => setGpaType('unweighted')}
          style={{
            ...S.toggleBtn,
            background: gpaType === 'unweighted' ? 'var(--primary)' : 'var(--surface)',
            color: gpaType === 'unweighted' ? '#fff' : 'var(--text-secondary)',
            borderColor: gpaType === 'unweighted' ? 'var(--primary)' : 'var(--border)',
          }}>Unweighted</button>
      </div>

      {error && (
        <div style={S.errorBanner}>
          {error.toLowerCase().includes('session') ? (
            <span>
              Session expired.{' '}
              <span
                onClick={handleResync}
                style={{ textDecoration: 'underline', cursor: resyncing ? 'not-allowed' : 'pointer', opacity: resyncing ? 0.6 : 1 }}
              >
                {resyncing ? 'Resyncing…' : 'Click to resync'}
              </span>
            </span>
          ) : error}
        </div>
      )}

      {/* GPA cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div className="ns-card" style={{ flex: 1, padding: 20 }}>
          <div style={S.gpaLabel}>Current {gpaType === 'weighted' ? 'Weighted' : 'Unweighted'} GPA</div>
          <div style={{ ...S.gpaNum, marginTop: 8 }}>{baselineGpa.toFixed(3)}</div>
          <div style={S.gpaNote}>
            {courseCount} courses from transcript
          </div>
        </div>
        <div className="ns-card" style={{ flex: 1, padding: 20, borderColor: isEdited ? 'var(--primary-glow)' : 'var(--border)', background: isEdited ? 'var(--primary-dim)' : undefined }}>
          <div style={S.gpaLabel}>Simulated {gpaType === 'weighted' ? 'Weighted' : 'Unweighted'} GPA</div>
          <div style={{ ...S.gpaNum, marginTop: 8, color: isEdited ? 'var(--primary)' : 'var(--text-muted)' }}>{simGPA.toFixed(3)}</div>
          {isEdited && (
            <div style={{ fontSize: 13, fontWeight: 700, color: delta >= 0 ? '#22C55E' : '#EF4444', marginTop: 4 }}>
              {delta >= 0 ? '+' : ''}{delta.toFixed(3)}
            </div>
          )}
        </div>
      </div>

      <p style={S.sub}>
        {gpaType === 'weighted'
          ? 'Weighted scale: AP/Pre-AP=5.0, Dual=4.5, Regular=4.0'
          : 'Unweighted scale: All courses use Regular scale (A=4.0, B=3.0, C=2.0, F=0.0)'}
      </p>

      <div style={{ marginBottom: 12 }}>
        <div style={S.sectionLabel}>Simulate this semester</div>
      </div>

      {isEdited && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button onClick={resetAll} style={S.clearBtn}>Reset to synced grades</button>
        </div>
      )}

      {/* Simulated course rows */}
      {simCourses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {simCourses.map(c => {
            const effectiveLetter = c.average > 0 ? avgToLetter(c.average) : '—'
            const effectivePts = c.average > 0 ? gradePoints(c.average, c.level, gpaType) : 0
            const isFilled = c.average > 0
            const levelStyle = LEVEL_COLORS[c.level]

            return (
              <div key={c.id} className="ns-card"
                style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 10,
                  borderColor: isFilled ? 'var(--primary-glow)' : 'var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {c.name}
                  </span>
                </div>

                {/* Synced level badge (weighted only) — click to override */}
                {gpaType === 'weighted' && (
                  editingLevelId === c.id ? (
                    <select value={c.level} autoFocus
                      onChange={e => { updateSimCourse(c.id, 'level', e.target.value); setEditingLevelId(null) }}
                      onBlur={() => setEditingLevelId(null)}
                      style={{ background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 11,
                        border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', outline: 'none', cursor: 'pointer' }}>
                      <option>Regular</option>
                      <option>Pre-AP</option>
                      <option>AP</option>
                      <option>Dual Credit</option>
                    </select>
                  ) : (
                    <button onClick={() => setEditingLevelId(c.id)} title="Click to override synced level"
                      style={{ background: levelStyle.bg, color: levelStyle.color, border: `1px solid ${levelStyle.border}`,
                        fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                      {c.level}
                    </button>
                  )
                )}

                <input type="number" min="0" max="100"
                  value={c.average > 0 ? c.average : ''}
                  onChange={e => updateSimCourse(c.id, 'average', e.target.value)}
                  placeholder="Avg %"
                  className="ns-input"
                  style={{ width: 70, height: 32, textAlign: 'right' as const, fontSize: 12,
                    borderColor: isFilled ? 'var(--primary)' : undefined }} />

                <div style={{ width: 36, textAlign: 'center' as const, flexShrink: 0, opacity: isFilled ? 1 : 0.3 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: isFilled ? letterColor(c.average) : 'var(--text-muted)' }}>{effectiveLetter}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{isFilled ? `${effectivePts.toFixed(1)}` : 'pts'}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' as const, marginTop: 20, lineHeight: 1.5 }}>
        {gpaType === 'weighted'
          ? 'Courses are synced from your portal with their real weight. Adjust a grade to see how it changes your GPA.'
          : 'Courses are synced from your portal. Adjust a grade to see how it changes your GPA. Unweighted uses Regular scale for all types.'}
      </p>

      {!loading && !error && courseCount === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          No GPA data available. Connect your portal in Settings.
        </p>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  back:        { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 },
  title:       { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 20 },
  sub:         { fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 16 },
  errorBanner: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: 'var(--error)', fontSize: 13, marginBottom: 16 },
  sectionLabel:{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)' },
  toggleBtn:   { height: 34, padding: '0 20px', borderRadius: 8, border: '1px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--neo-raised)' },
  semBtn:      { height: 34, padding: '0 14px', borderRadius: 8, border: '1px solid', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--neo-raised)' },
  gpaLabel:    { fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)' },
  gpaNum:      { fontSize: 36, fontWeight: 800, letterSpacing: '-1px', color: 'var(--text)', lineHeight: 1 },
  gpaNote:     { fontSize: 11, color: 'var(--text-muted)', marginTop: 6 },
  clearBtn:    { background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: '6px 14px', boxShadow: 'var(--neo-raised)' },
}
