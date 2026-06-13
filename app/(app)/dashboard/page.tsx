'use client'

import { useEffect, useState } from 'react'
import { api, type StudentData } from '../../../lib/api'

const GRADE_COLORS: Record<string, string> = {
  A: '#3FB950', B: '#00C896', C: '#D29922', D: '#F0883E', F: '#F85149',
}

function gradeColor(letter: string) {
  return GRADE_COLORS[letter.charAt(0).toUpperCase()] ?? 'var(--text-muted)'
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function DashboardPage() {
  const [data, setData] = useState<StudentData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.me().then(setData).catch(e => setError(e instanceof Error ? e.message : 'Failed'))
  }, [])

  if (error) return <p style={{ color: 'var(--error)' }}>{error}</p>
  if (!data) return <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>

  const firstName = data.name?.split(' ')[0] ?? 'Student'
  const uGpa = (data.profile?.unweightedGpa ?? 0).toFixed(2)
  const wGpa = (data.profile?.weightedGpa ?? 0).toFixed(2)
  const today = new Date()
  const dueToday = data.assignments.filter(a => {
    if (a.completed) return false
    const d = new Date(a.dueDate)
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  })

  return (
    <div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Good morning,</p>
      <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>{firstName}</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>{formatDate()}</p>

      <div style={styles.topRow}>
        {/* GPA Card */}
        <div style={{ ...styles.card, flex: 1 }}>
          <p style={styles.cardLabel}>Current GPA</p>
          <div style={{ display: 'flex', gap: '32px', marginTop: '8px' }}>
            <div>
              <div style={styles.bigNum}>{uGpa}</div>
              <div style={styles.smallLabel}>Unweighted</div>
            </div>
            <div style={styles.divider} />
            <div>
              <div style={{ ...styles.bigNum, color: 'var(--primary)' }}>{wGpa}</div>
              <div style={styles.smallLabel}>Weighted</div>
            </div>
          </div>
        </div>

        {/* Due Today */}
        <div style={{ ...styles.card, flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <strong>Due Today</strong>
            {dueToday.length > 0 && (
              <span style={styles.countBadge}>{dueToday.length}</span>
            )}
          </div>
          {dueToday.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Nothing due today!</p>
          ) : (
            dueToday.slice(0, 3).map(a => (
              <div key={a.id} style={styles.dueTodayRow}>
                <span style={styles.dot} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px' }}>{a.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{a.subject}</div>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{a.estimatedMinutes}m</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div style={styles.statsRow}>
        <StatCard value={data.stats.totalCourses.toString()} label="Courses" />
        <StatCard value={data.stats.assignmentsDueThisWeek.toString()} label="Due Soon" />
        <StatCard value={data.stats.pendingAssignments.toString()} label="Pending" />
        <StatCard value="3" label="Day Streak 🔥" />
      </div>

      {/* Recent Grades */}
      <div style={styles.card}>
        <strong style={{ display: 'block', marginBottom: '16px' }}>Recent Grades</strong>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHead}>
              <th style={styles.th}>Course</th>
              <th style={styles.th}>Teacher</th>
              <th style={styles.th}>Period</th>
              <th style={styles.th}>Grade</th>
              <th style={styles.th}>%</th>
            </tr>
          </thead>
          <tbody>
            {data.courses.slice(0, 5).map(c => (
              <tr key={c.id} style={styles.tableRow}>
                <td style={styles.td}>{c.name}</td>
                <td style={{ ...styles.td, color: 'var(--text-secondary)' }}>{c.teacher}</td>
                <td style={styles.td}>{c.period}</td>
                <td style={styles.td}>
                  {c.grade ? (
                    <span style={{ color: gradeColor(c.grade.letterGrade), fontWeight: '700' }}>
                      {c.grade.letterGrade}
                    </span>
                  ) : '—'}
                </td>
                <td style={{ ...styles.td, color: 'var(--text-secondary)' }}>
                  {c.grade ? `${c.grade.percentage.toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div style={styles.statCard}>
      <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' },
  cardLabel: { fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-secondary)', marginBottom: '4px' },
  bigNum: { fontSize: '32px', fontWeight: '700' },
  smallLabel: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' },
  divider: { width: '1px', background: 'var(--border)', alignSelf: 'stretch' },
  topRow: { display: 'flex', gap: '16px', marginBottom: '16px' },
  countBadge: {
    background: 'var(--error)', color: '#fff', borderRadius: '100px',
    padding: '2px 8px', fontSize: '11px', fontWeight: '700',
  },
  dueTodayRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  dot: { width: '8px', height: '8px', borderRadius: '4px', background: 'var(--primary)', flexShrink: 0 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' },
  statCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', textAlign: 'center' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  tableHead: { borderBottom: '1px solid var(--border)' },
  th: { textAlign: 'left' as const, padding: '8px 12px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  tableRow: { borderBottom: '1px solid var(--border)' },
  td: { padding: '12px', fontSize: '14px' },
}
