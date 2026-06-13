'use client'

import { useEffect, useState } from 'react'
import { api, type StudentData } from '../../../lib/api'

type Assignment = StudentData['assignments'][number]

type GroupKey = 'Overdue' | 'Today' | 'Tomorrow' | 'This Week' | 'Later' | 'Completed'

interface Group {
  key: GroupKey
  items: Assignment[]
}

function groupAssignments(assignments: Assignment[]): Group[] {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = new Date(todayStart.getTime() + 86400000)
  const weekEnd = new Date(todayStart.getTime() + 7 * 86400000)

  const groups: Record<GroupKey, Assignment[]> = {
    Overdue: [], Today: [], Tomorrow: [], 'This Week': [], Later: [], Completed: [],
  }

  for (const a of assignments) {
    if (a.completed) { groups.Completed.push(a); continue }
    const due = new Date(a.dueDate)
    if (due < todayStart) groups.Overdue.push(a)
    else if (due < tomorrowStart) groups.Today.push(a)
    else if (due < new Date(tomorrowStart.getTime() + 86400000)) groups.Tomorrow.push(a)
    else if (due < weekEnd) groups['This Week'].push(a)
    else groups.Later.push(a)
  }

  const ORDER: GroupKey[] = ['Overdue', 'Today', 'Tomorrow', 'This Week', 'Later', 'Completed']
  return ORDER.filter(k => groups[k].length > 0).map(k => ({ key: k, items: groups[k] }))
}

const GROUP_COLORS: Partial<Record<GroupKey, string>> = {
  Overdue: 'var(--error)', Today: 'var(--warning)',
}

export default function PlannerPage() {
  const [data, setData] = useState<StudentData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<Set<number>>(new Set())
  const [studyPlan, setStudyPlan] = useState<Array<{ id: number; title: string; subject: string; priority: string }>>([])

  useEffect(() => {
    api.me().then(setData).catch(e => setError(e instanceof Error ? e.message : 'Failed'))
    api.studyPlan().then(r => setStudyPlan(r.plan)).catch(() => null)
  }, [])

  async function handleToggle(id: number, completed: boolean) {
    setToggling(prev => new Set([...prev, id]))
    setData(prev => prev ? {
      ...prev,
      assignments: prev.assignments.map(a => a.id === id ? { ...a, completed, completedAt: completed ? new Date().toISOString() : null } : a),
    } : prev)
    try {
      const token = localStorage.getItem('ns_token')
      await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/assignments/${id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ completed }),
      })
    } catch { /* optimistic — leave it */ }
    finally {
      setToggling(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  if (error) return <p style={{ color: 'var(--error)' }}>{error}</p>
  if (!data) return <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>

  const groups = groupAssignments(data.assignments)
  const PRIORITY_COLORS: Record<string, string> = { HIGH: 'var(--error)', MEDIUM: 'var(--warning)', LOW: 'var(--text-muted)' }

  return (
    <div style={styles.layout}>
      {/* Left: assignments */}
      <div style={{ flex: 2 }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '24px' }}>Planner</h1>
        {groups.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{ fontSize: '24px', marginBottom: '8px' }}>You're all caught up!</p>
            <p style={{ color: 'var(--text-secondary)' }}>No assignments due.</p>
          </div>
        ) : groups.map(group => (
          <div key={group.key} style={{ marginBottom: '24px' }}>
            <div style={{ ...styles.groupHeader, color: GROUP_COLORS[group.key] ?? 'var(--text-secondary)' }}>
              {group.key} <span style={styles.groupCount}>{group.items.length}</span>
            </div>
            {group.items.map(a => (
              <div key={a.id} style={styles.assignmentRow}>
                <input
                  type="checkbox"
                  checked={a.completed}
                  disabled={toggling.has(a.id)}
                  onChange={() => void handleToggle(a.id, !a.completed)}
                  style={styles.checkbox}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', textDecoration: a.completed ? 'line-through' : 'none', color: a.completed ? 'var(--text-muted)' : 'var(--text)' }}>
                    {a.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {a.subject} · {a.estimatedMinutes}m · Due {new Date(a.dueDate).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Right: study plan */}
      <div style={{ flex: 1, minWidth: '240px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>AI Study Plan</h2>
        {studyPlan.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No upcoming assignments.</p>
        ) : studyPlan.map(item => (
          <div key={item.id} style={styles.studyItem}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>{item.title}</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: PRIORITY_COLORS[item.priority] }}>
                {item.priority}
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.subject}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', gap: '32px', alignItems: 'flex-start' },
  groupHeader: { fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' },
  groupCount: { background: 'var(--border)', borderRadius: '100px', padding: '2px 8px', fontSize: '11px', color: 'var(--text-secondary)' },
  assignmentRow: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', marginBottom: '8px' },
  checkbox: { marginTop: '2px', accentColor: 'var(--primary)', width: '18px', height: '18px' },
  emptyState: { textAlign: 'center', padding: '60px 20px' },
  studyItem: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', marginBottom: '8px' },
}
