'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PageLoader from '../../../../components/ui/PageLoader'

const BASE = ''

interface AttendanceDay {
  date: string
  dayOfWeek: string
  status: string
  code: string
  description: string
}

interface AttendanceData {
  month: string
  year: number
  monthIndex: number
  days: AttendanceDay[]
  summary: { absences: number; tardies: number; excused: number }
}

function apiFetch<T>(path: string): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('ns_token') : null
  return fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(r => r.json())
}

// ── Code definitions ──────────────────────────────────────────────────────────
// A = Absent (Unexcused)  T = Tardy / Late (Unexcused)
// X = Excused Absence     S = School Activity / UIL
// U = Suspension          P = Present   C = School Closed

const CODE_META: Record<string, { label: string; bg: string; color: string; border: string }> = {
  A: { label: 'Absent - Unexcused', bg: 'rgba(239,68,68,0.18)',   color: '#F87171', border: 'rgba(239,68,68,0.35)' },
  T: { label: 'Tardy / Late',       bg: 'rgba(245,158,11,0.18)',  color: '#FBBF24', border: 'rgba(245,158,11,0.35)' },
  X: { label: 'Excused Absence',    bg: 'rgba(34,197,94,0.18)',   color: '#4ADE80', border: 'rgba(34,197,94,0.35)' },
  S: { label: 'School Activity/UIL',bg: 'rgba(217,119,6,0.18)',   color: '#F59E0B', border: 'rgba(217,119,6,0.35)' },
  U: { label: 'Suspension',         bg: 'rgba(107,114,128,0.25)', color: '#9CA3AF', border: 'rgba(107,114,128,0.4)' },
  P: { label: 'Present',            bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: 'var(--border)' },
}

function cellStyle(code: string): React.CSSProperties | undefined {
  const m = CODE_META[code]
  if (!m || code === 'P' || code === 'C' || !code) return undefined
  return { background: m.bg, color: m.color, border: `1px solid ${m.border}` }
}

export default function AttendancePage() {
  const router = useRouter()
  const [data, setData] = useState<AttendanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [monthOffset, setMonthOffset] = useState(0)

  const fetchAttendance = useCallback((offset: number) => {
    setLoading(true)
    setError(null)
    apiFetch<{ data?: AttendanceData; error?: { message?: string } | string }>(
      `/api/integrations/grades/attendance?monthOffset=${offset}`
    )
      .then(json => {
        if (json.error) {
          const msg = typeof json.error === 'string' ? json.error : (json.error?.message ?? 'Failed to load')
          setError(msg); return
        }
        setData(json.data ?? null)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load attendance'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchAttendance(0) }, [fetchAttendance])

  function buildGrid(): ({ dayNum: number; day: AttendanceDay | null } | null)[][] {
    if (!data) return []
    const { year, monthIndex, days } = data
    const dayMap = new Map<number, AttendanceDay>()
    for (const d of days) {
      const num = parseInt(d.date.split('-')[2], 10)
      if (!isNaN(num)) dayMap.set(num, d)
    }
    const firstDow    = new Date(year, monthIndex, 1).getDay()
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
    const grid: ({ dayNum: number; day: AttendanceDay | null } | null)[][] = []
    let week: ({ dayNum: number; day: AttendanceDay | null } | null)[] = Array(firstDow).fill(null)
    for (let d = 1; d <= daysInMonth; d++) {
      week.push({ dayNum: d, day: dayMap.get(d) ?? null })
      if (week.length === 7) { grid.push(week); week = [] }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null)
      grid.push(week)
    }
    return grid
  }

  const grid = buildGrid()

  function navigate(dir: -1 | 1) {
    const next = monthOffset + dir
    setMonthOffset(next)
    fetchAttendance(next)
  }

  // All notable events (exclude plain present days and school-closed days)
  const events = data?.days.filter(d => d.code && d.code !== 'P' && d.code !== 'C' && d.code !== '') ?? []

  // Summary counts
  const totalAbsent  = data?.days.filter(d => d.code === 'A').length ?? 0
  const totalTardy   = data?.days.filter(d => d.code === 'T').length ?? 0
  const totalExcused = data?.days.filter(d => d.code === 'X').length ?? 0
  const totalUIL     = data?.days.filter(d => d.code === 'S').length ?? 0

  if (loading && !data) return <PageLoader message="Opening attendance…" />

  return (
    <div className="fade-up">
      <button onClick={() => router.push('/grades')} style={S.back}>← Grade Portal</button>
      <h1 style={S.title}>Attendance</h1>

      {error && (
        <div style={S.errorBanner}>
          {error}
          {error.toLowerCase().includes('session') && (
            <span> — <a href="/settings" style={{ color: 'var(--warning)', textDecoration: 'underline' }}>reconnect in Settings</a></span>
          )}
        </div>
      )}

      {/* Summary cards */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
          {[
            { count: totalAbsent,  label: 'Unexcused',  code: 'A' },
            { count: totalTardy,   label: 'Tardy/Late',  code: 'T' },
            { count: totalExcused, label: 'Excused',     code: 'X' },
            { count: totalUIL,     label: 'School Act.', code: 'S' },
          ].map(({ count, label, code }) => {
            const m = CODE_META[code]
            return (
              <div key={code} className="ns-card" style={{ padding: '12px 8px', textAlign: 'center', border: `1px solid ${m.border}` }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{count}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={() => navigate(-1)} style={S.navBtn}>← Prev</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{data?.month ?? '—'}</span>
        <button onClick={() => navigate(1)} disabled={monthOffset >= 0} style={{ ...S.navBtn, opacity: monthOffset >= 0 ? 0.3 : 1, cursor: monthOffset >= 0 ? 'default' : 'pointer' }}>Next →</button>
      </div>

      {loading && <div style={{ height: 240, background: 'rgba(255,255,255,0.04)', borderRadius: 12 }} />}

      {!loading && !data && !error && (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
          No attendance data available. Connect your school portal in Settings.
        </p>
      )}

      {!loading && data && (
        <>
          {/* Calendar */}
          <div className="ns-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} style={{ textAlign: 'center', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{d}</div>
              ))}
            </div>
            {grid.map((week, wi) => (
              <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {week.map((cell, di) => {
                  const cs = cellStyle(cell?.day?.code ?? '')
                  const titleTip = cell?.day?.description || cell?.day?.status || undefined
                  return (
                    <div
                      key={di}
                      title={titleTip}
                      style={{
                        aspectRatio: '1',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        borderRight: di < 6 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        cursor: titleTip ? 'help' : 'default',
                        ...(cs ?? {}),
                      }}
                    >
                      {cell && (
                        <>
                          <span style={{ fontWeight: 500, color: cs ? 'inherit' : 'var(--text-secondary)' }}>
                            {cell.dayNum}
                          </span>
                          {cell.day?.code && cell.day.code !== 'P' && cell.day.code !== 'C' && cell.day.code !== '' && (
                            <span style={{ fontSize: 9, fontWeight: 700, marginTop: 1, letterSpacing: '0.3px' }}>
                              {cell.day.code}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {Object.entries(CODE_META).map(([code, meta]) => (
              <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, fontSize: 11.5, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                <span style={{ fontWeight: 700 }}>{code}</span>
                <span>{meta.label}</span>
              </div>
            ))}
          </div>

          {/* Attendance events list */}
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Events This Month
            </div>
            {events.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No events recorded this month.</p>
            ) : (
              <div className="ns-card" style={{ padding: 0, overflow: 'hidden' }}>
                {events.map((ev, i) => {
                  const m = CODE_META[ev.code]
                  return (
                    <div
                      key={ev.date}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}
                    >
                      <div style={{
                        background: m?.bg, color: m?.color, border: `1px solid ${m?.border}`,
                        width: 30, height: 30, borderRadius: 7,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1,
                      }}>
                        {ev.code}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)' }}>
                          {new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: m?.color, marginTop: 1 }}>
                          {m?.label ?? ev.status}
                        </div>
                        {ev.description && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>
                            {ev.description}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  back:        { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 },
  title:       { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 20 },
  errorBanner: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: 'var(--error)', fontSize: 13, marginBottom: 16 },
  navBtn:      { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '7px 14px', borderRadius: 8, fontSize: 12.5, cursor: 'pointer' },
}
