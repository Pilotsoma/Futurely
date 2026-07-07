'use client'

import React from 'react'
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PageLoader from '../../../../components/ui/PageLoader'
import { getApiToken } from '../../../../lib/api'

const BASE = ''

interface AttendancePeriod {
  period: string
  status: string
}

interface AttendanceDay {
  date: string
  dayOfWeek: string
  dayNum: number
  bgColor: string
  description: string
  isSchoolClosed: boolean
  periods: AttendancePeriod[]
}

interface AttendanceData {
  month: string
  year: number
  monthIndex: number
  days: AttendanceDay[]
  summary: { absences: number; excused: number; tardies: number; multiple: number }
}

function apiFetch<T>(path: string): Promise<T> {
  const token = typeof window !== 'undefined' ? getApiToken() : null
  return fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(r => r.json())
}

function getDayStyle(description: string): { bg: string; color: string; border: string } | null {
  if (!description) return null
  const desc = description.toLowerCase()
  if (desc === 'multiple attendance codes') {
    return { bg: 'rgba(251,146,60,0.18)', color: '#FB923C', border: 'rgba(251,146,60,0.35)' }
  }
  if (/absent.*unexcused|unexcused.*absent/i.test(desc)) {
    return { bg: 'rgba(239,68,68,0.18)', color: '#F87171', border: 'rgba(239,68,68,0.35)' }
  }
  if (/tardy|late.?arrival|early.?depart/i.test(desc)) {
    return { bg: 'rgba(245,158,11,0.18)', color: '#FBBF24', border: 'rgba(245,158,11,0.35)' }
  }
  if (/excused|approved.?absence|doctor|note|kisd|religious|illness|healthcare|homebound|court|college.?visit|military/i.test(desc)) {
    return { bg: 'rgba(34,197,94,0.18)', color: '#4ADE80', border: 'rgba(34,197,94,0.35)' }
  }
  if (/uil|school.?act|field.?trip|sponsored|mentorship/i.test(desc)) {
    return { bg: 'rgba(217,119,6,0.18)', color: '#F59E0B', border: 'rgba(217,119,6,0.35)' }
  }
  if (/suspend|truancy|no.?show/i.test(desc)) {
    return { bg: 'rgba(107,114,128,0.25)', color: '#9CA3AF', border: 'rgba(107,114,128,0.4)' }
  }
  if (/present/i.test(desc)) return null
  return { bg: 'rgba(99,102,241,0.15)', color: '#A78BFA', border: 'rgba(99,102,241,0.3)' }
}

function shortLabel(description: string): string {
  if (!description) return ''
  if (description === 'Multiple Attendance Codes') return 'Multi'
  if (description === 'School Closed') return 'Closed'
  const words = description.split(' ')
  return words.slice(0, 2).join(' ')
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
    for (const d of days) dayMap.set(d.dayNum, d)

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

  const events = data?.days.filter(d =>
    d.description &&
    d.description !== '' &&
    !d.isSchoolClosed &&
    !/^present/i.test(d.description)
  ) ?? []

  const otherCount = data?.days.filter(d => {
    if (!d.description || d.isSchoolClosed || /^present/i.test(d.description)) return false
    if (/absent.*unexcused|unexcused.*absent/i.test(d.description)) return false
    if (/tardy|late.?arrival|early.?depart/i.test(d.description)) return false
    if (/excused|approved.?absence|doctor|note|kisd|religious|illness|healthcare|homebound|court|college.?visit|military/i.test(d.description)) return false
    return true
  }).length ?? 0

  if (loading && !data) return <PageLoader message="Opening attendance…" />

  return (
    <div className="fade-up">
      <button onClick={() => router.push('/grades')} style={S.back}><ArrowLeftIcon size={14}/> Grade Portal</button>
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
            { count: data.summary.absences, label: 'Unexcused',  color: '#F87171', border: 'rgba(239,68,68,0.35)' },
            { count: data.summary.tardies,  label: 'Tardy/Late',  color: '#FBBF24', border: 'rgba(245,158,11,0.35)' },
            { count: data.summary.excused,  label: 'Excused',     color: '#4ADE80', border: 'rgba(34,197,94,0.35)' },
            { count: otherCount,            label: 'Other',       color: '#FB923C', border: 'rgba(251,146,60,0.35)' },
          ].map(({ count, label, color, border }) => (
            <div key={label} className="ns-card" style={{ padding: '12px 8px', textAlign: 'center', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 22, fontWeight: 800, color }}>{count}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={() => navigate(-1)} style={S.navBtn}><ChevronLeftIcon size={13}/> Prev</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{data?.month ?? '—'}</span>
        <button
          onClick={() => navigate(1)}
          disabled={monthOffset >= 0}
          style={{ ...S.navBtn, opacity: monthOffset >= 0 ? 0.3 : 1, cursor: monthOffset >= 0 ? 'default' : 'pointer' }}
        >
          Next <ChevronRightIcon size={13}/>
        </button>
      </div>

      {loading && <div style={{ height: 240, background: 'var(--surface-2)', borderRadius: 12 }} />}

      {!loading && !data && !error && (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
          No attendance data. Connect your school portal in Settings.
        </p>
      )}

      {!loading && data && (
        <>
          {/* Calendar grid */}
          <div className="ns-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} style={{ textAlign: 'center', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{d}</div>
              ))}
            </div>
            {grid.map((week, wi) => (
              <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--surface-2)' }}>
                {week.map((cell, di) => {
                  const day = cell?.day ?? null
                  const style = day ? getDayStyle(day.description) : null
                  const label = day ? shortLabel(day.description) : ''
                  const closed = day?.isSchoolClosed ?? false

                  return (
                    <div
                      key={di}
                      title={day?.description || undefined}
                      style={{
                        aspectRatio: '1',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        borderRight: di < 6 ? '1px solid var(--surface-2)' : 'none',
                        cursor: (style || closed) ? 'help' : 'default',
                        background: closed ? 'rgba(156,163,175,0.07)' : (style?.bg ?? 'transparent'),
                        color: style?.color ?? (closed ? 'rgba(156,163,175,0.5)' : 'var(--text-secondary)'),
                        border: style ? `1px solid ${style.border}` : 'none',
                      }}
                    >
                      {cell && (
                        <>
                          <span style={{ fontWeight: 500 }}>{cell.dayNum}</span>
                          {label && !closed && (
                            <span style={{ fontSize: 7, fontWeight: 700, marginTop: 1, letterSpacing: '0.2px', textAlign: 'center', lineHeight: 1.1 }}>
                              {label}
                            </span>
                          )}
                          {closed && (
                            <span style={{ fontSize: 7, opacity: 0.4, marginTop: 1 }}>—</span>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Events list */}
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Notable Events This Month
            </div>
            {events.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No notable attendance events this month.</p>
            ) : (
              <div className="ns-card" style={{ padding: 0, overflow: 'hidden' }}>
                {events.map((ev, i) => {
                  const style = getDayStyle(ev.description)
                  return (
                    <div
                      key={ev.date}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}
                    >
                      <div style={{
                        background: style?.bg ?? 'var(--surface-2)',
                        color: style?.color ?? 'var(--text-muted)',
                        border: `1px solid ${style?.border ?? 'var(--border)'}`,
                        width: 34, height: 34, borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800, flexShrink: 0, marginTop: 1,
                      }}>
                        {ev.dayNum}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)' }}>
                          {new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: style?.color ?? 'var(--text-secondary)', marginTop: 2 }}>
                          {ev.description}
                        </div>
                        {ev.periods.length > 0 && ev.periods[0].period !== 'all' && (
                          <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {ev.periods.map((p, pi) => {
                              const ps = getDayStyle(p.status)
                              return (
                                <span key={pi} style={{
                                  fontSize: 10, fontWeight: 600,
                                  padding: '2px 7px', borderRadius: 999,
                                  background: ps?.bg ?? 'var(--surface-2)',
                                  color: ps?.color ?? 'var(--text-muted)',
                                  border: `1px solid ${ps?.border ?? 'var(--border)'}`,
                                }}>
                                  Pd {p.period}: {p.status}
                                </span>
                              )
                            })}
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
