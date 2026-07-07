'use client'

import React from 'react'
import { ArrowLeftIcon } from '@/components/icons'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../../../lib/api'
import PageLoader from '../../../../components/ui/PageLoader'

type ScheduleRow = Record<string, string>

// ── Helpers ──────────────────────────────────────────────────────────────────

function get(row: ScheduleRow, ...keys: string[]): string {
  for (const k of keys) { const v = row[k]; if (v) return v.trim() }
  return ''
}

/**
 * Determine which semester a row belongs to.
 *
 * Rules (in priority order):
 * 1. Course code base ends with A / B  (e.g. "0316A" → 1, "0316B" → 2)
 * 2. Course description last word is A / B (e.g. "AP PRE CALC GT A" → 1)
 * 3. Marking Periods column: M1/M2/M3 → 1, M4/M5/M6 → 2
 * 4. Returns null — caller handles order-based assignment
 */
function detectSem(row: ScheduleRow): '1' | '2' | null {
  const code = get(row, 'courseCode', 'Course')
  const name = get(row, 'courseName', 'Description')

  // Code base is the part before " - " e.g. "0316A" from "0316A - 16"
  const codeBase = code.split('-')[0].trim()
  const lastCode = codeBase.slice(-1).toUpperCase()
  if (lastCode === 'A') return '1'
  if (lastCode === 'B') return '2'

  // Description last word
  const lastWord = (name.split(/\s+/).pop() ?? '').toUpperCase()
  if (lastWord === 'A') return '1'
  if (lastWord === 'B') return '2'

  // Marking Periods fallback
  const mp = get(row, 'Marking Periods')
  if (mp) {
    if (/M[456]/i.test(mp)) return '2'
    if (/M[123]/i.test(mp)) return '1'
  }

  return null
}

/**
 * Assign semesters to all rows.
 * Rows with no A/B suffix that share a "period slot" (first digit of period)
 * are paired in appearance order: first = sem 1, second = sem 2.
 */
function assignSemesters(rows: ScheduleRow[]): (ScheduleRow & { _sem: '1' | '2' })[] {
  const periodNoLetterCount = new Map<string, number>()

  return rows.map(row => {
    const explicit = detectSem(row)
    if (explicit) return { ...row, _sem: explicit }

    // No letter — use period slot + order of appearance
    const periodSlot = get(row, 'Periods', 'period').charAt(0)
    const count = periodNoLetterCount.get(periodSlot) ?? 0
    periodNoLetterCount.set(periodSlot, count + 1)
    return { ...row, _sem: count === 0 ? '1' : '2' }
  })
}

/** Keep only the first occurrence of each course code per semester. */
function dedupeByCode(rows: (ScheduleRow & { _sem: string })[]): (ScheduleRow & { _sem: string })[] {
  const seen = new Set<string>()
  return rows.filter(r => {
    const key = get(r, 'Course', 'courseCode').trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Columns we never want to surface in the table
const ALWAYS_HIDE = new Set([
  'courseCode', 'courseName', 'period', 'teacher', 'room',  // lowercase scraper aliases — capitalized versions take precedence
  'Course',           // raw code like "0231A - 10" (not user-friendly)
  'Marking Periods',  // handled by tab buttons
  'Days',             // always "M, T, W, R, F"
  'Status',           // always "Active"
  '_sem',             // internal
])

// Preferred display order (any extras come after in original order)
const PREFERRED_ORDER = ['Description', 'Periods', 'Teacher', 'Room', 'Building']

export default function SchedulePage() {
  const router = useRouter()
  const [schedule, setSchedule] = useState<ScheduleRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [activeSem, setActiveSem] = useState<'1' | '2'>('1')

  useEffect(() => {
    api.portalSchedule()
      .then(r => setSchedule(r.schedule ?? []))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load schedule'))
      .finally(() => setLoading(false))
  }, [])

  const assigned = assignSemesters(schedule)
  const sem1Rows = dedupeByCode(assigned.filter(r => r._sem === '1'))
  const sem2Rows = dedupeByCode(assigned.filter(r => r._sem === '2'))
  const activeRows = activeSem === '1' ? sem1Rows : sem2Rows

  // Build ordered display headers
  const allKeys = schedule.length > 0 ? Object.keys(schedule[0]) : []
  const visible  = allKeys.filter(h => !ALWAYS_HIDE.has(h))
  const ordered  = [
    ...PREFERRED_ORDER.filter(h => visible.includes(h)),
    ...visible.filter(h => !PREFERRED_ORDER.includes(h)),
  ]
  // Fallback: if no capitalized columns (backend didn't extract headers),
  // fall back to the lowercase scraper keys so SOMETHING shows
  const displayHeaders = ordered.length > 0
    ? ordered
    : ['courseName', 'period', 'teacher', 'room'].filter(k => allKeys.includes(k))

  const HEADER_LABEL: Record<string, string> = {
    Description: 'Course Name',
    Periods: 'Period',
    Teacher: 'Teacher',
    Room: 'Room',
    Building: 'Building',
    courseName: 'Course Name',
    period: 'Period',
    teacher: 'Teacher',
    room: 'Room',
  }

  if (loading) return <PageLoader message="Opening schedule…" />

  return (
    <div className="fade-up">
      <button onClick={() => router.push('/grades')} style={S.back}><ArrowLeftIcon size={14}/> Grade Portal</button>
      <h1 style={S.title}>Class Schedule</h1>

      {error && (
        <div style={S.errorBanner}>
          {error}
          {error.toLowerCase().includes('session') && (
            <span> — <a href="/settings" style={{ color: 'var(--warning)', textDecoration: 'underline' }}>reconnect in Settings</a></span>
          )}
        </div>
      )}

      {schedule.length === 0 && !error && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          No schedule data available. Connect your school portal in Settings.
        </p>
      )}

      {schedule.length > 0 && (
        <>
          {/* Semester tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['1', '2'] as const).map(sem => (
              <button
                key={sem}
                onClick={() => setActiveSem(sem)}
                style={{ ...S.semBtn, ...(activeSem === sem ? S.semBtnActive : {}) }}
              >
                {sem === '1' ? '1st Semester' : '2nd Semester'}
                <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.75 }}>
                  ({(sem === '1' ? sem1Rows : sem2Rows).length})
                </span>
              </button>
            ))}
          </div>

          <div className="ns-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr>
                  {displayHeaders.map(h => (
                    <th key={h} style={S.th}>{HEADER_LABEL[h] ?? h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeRows.map((row, i) => (
                  <tr key={i} className="ns-tr" style={{ borderTop: '1px solid var(--border)' }}>
                    {displayHeaders.map(h => (
                      <td key={h} style={S.td}>{row[h] || '—'}</td>
                    ))}
                  </tr>
                ))}
                {activeRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={displayHeaders.length || 1}
                      style={{ ...S.td, textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}
                    >
                      No classes found for this semester.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  back:         { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 },
  title:        { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 20 },
  errorBanner:  { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: 'var(--error)', fontSize: 13, marginBottom: 16 },
  th:           { textAlign: 'left' as const, padding: '12px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  td:           { padding: '11px 14px', fontSize: 13.5, color: 'var(--text)' },
  semBtn:       { padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' },
  semBtnActive: { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' },
}
