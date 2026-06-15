'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, type PlannerItem, type StudentData } from '../../../lib/api'
import PageLoader from '../../../components/ui/PageLoader'

type GroupKey = 'Overdue' | 'Today' | 'Tomorrow' | 'This Week' | 'Later' | 'Completed'
interface Group { key: GroupKey; items: PlannerItem[] }

const GROUP_META: Partial<Record<GroupKey, { color: string; bg: string }>> = {
  Overdue: { color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
  Today:   { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
}

function groupAssignments(items: PlannerItem[]): Group[] {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = new Date(todayStart.getTime() + 86400000)
  const weekEnd = new Date(todayStart.getTime() + 7 * 86400000)

  const groups: Record<GroupKey, PlannerItem[]> = {
    Overdue: [], Today: [], Tomorrow: [], 'This Week': [], Later: [], Completed: [],
  }

  for (const item of items) {
    if (item.completed) { groups.Completed.push(item); continue }
    const due = new Date(item.dueDate)
    if (due < todayStart) groups.Overdue.push(item)
    else if (due < tomorrowStart) groups.Today.push(item)
    else if (due < new Date(tomorrowStart.getTime() + 86400000)) groups.Tomorrow.push(item)
    else if (due < weekEnd) groups['This Week'].push(item)
    else groups.Later.push(item)
  }

  const ORDER: GroupKey[] = ['Overdue', 'Today', 'Tomorrow', 'This Week', 'Later', 'Completed']
  return ORDER.filter(k => groups[k].length > 0).map(k => ({ key: k, items: groups[k] }))
}

function formatDueDate(item: PlannerItem): string {
  const date = new Date(item.dueDate)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (item.dueTime) return `${dateStr} at ${item.dueTime}`
  return dateStr
}

export default function PlannerPage() {
  const [items, setItems] = useState<PlannerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<Set<number>>(new Set())

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const assignments = await api.plannerList()
      setItems(assignments)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load planner')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !dueDate) return

    setSubmitting(true)
    setFormError(null)
    try {
      const created = await api.plannerCreate({
        title: title.trim(),
        subject: subject || undefined,
        dueDate,
        dueTime: dueTime || undefined,
      })
      setItems(prev => [...prev, created])
      setTitle('')
      setSubject('')
      setDueDate('')
      setDueTime('')
      setShowForm(false)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggle(id: number, completed: boolean) {
    setToggling(prev => new Set([...prev, id]))
    // Optimistic update
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, completed, completedAt: completed ? new Date().toISOString() : null } : item
    ))
    try {
      await api.plannerToggle(id, completed)
    } catch {
      // Revert on failure
      setItems(prev => prev.map(item =>
        item.id === id ? { ...item, completed: !completed, completedAt: !completed ? new Date().toISOString() : null } : item
      ))
    } finally {
      setToggling(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  async function handleDelete(id: number) {
    // Optimistic remove
    setItems(prev => prev.filter(item => item.id !== id))
    try {
      await api.plannerDelete(id)
    } catch {
      // Refetch on failure
      fetchData()
    }
  }

  if (error) return <div style={{ padding: 40, color: '#EF4444' }}>{error}</div>
  if (loading) return <PageLoader message="Opening planner…" />

  const groups = groupAssignments(items)

  return (
    <div className="fade-up" style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>Planner</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: showForm ? 'var(--surface-2)' : 'var(--primary)',
            color: showForm ? 'var(--text)' : '#fff',
            border: showForm ? '1px solid var(--border)' : 'none',
            borderRadius: 10,
            padding: '10px 20px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {showForm ? 'Cancel' : '+ New Task'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={e => void handleCreate(e)} style={S.form}>
          <div style={S.formRow}>
            <input
              type="text"
              placeholder="Task name (e.g. Math Homework)"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              style={{ ...S.input, flex: 2 }}
            />
          </div>
          <div style={S.formRow}>
            <input
              type="text"
              placeholder="Class (e.g. AP Calculus, English)"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              style={{ ...S.input, flex: 1 }}
            />
          </div>
          <div style={S.formRow}>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              required
              style={{ ...S.input, flex: 1 }}
            />
            <input
              type="time"
              value={dueTime}
              onChange={e => setDueTime(e.target.value)}
              style={{ ...S.input, flex: 1 }}
            />
          </div>
          {formError && <div style={{ color: '#EF4444', fontSize: 12, marginBottom: 8 }}>{formError}</div>}
          <button
            type="submit"
            disabled={submitting || !title.trim() || !dueDate}
            style={{
              ...S.button,
              opacity: submitting || !title.trim() || !dueDate ? 0.5 : 1,
            }}
          >
            {submitting ? 'Adding…' : 'Add Task'}
          </button>
        </form>
      )}

      {/* Assignment Groups */}
      {groups.length === 0 ? (
        <div style={S.empty}>
          <div style={S.emptyIcon}>✓</div>
          <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 5 }}>No tasks yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Click "+ New Task" to add your first assignment.</p>
        </div>
      ) : groups.map(group => {
        const meta = GROUP_META[group.key]
        return (
          <div key={group.key} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ color: meta?.color ?? 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                {group.key}
              </span>
              <span style={{ borderRadius: 100, padding: '2px 8px', fontSize: 11, fontWeight: 700, background: meta?.bg ?? 'var(--surface-2)', color: meta?.color ?? 'var(--text-secondary)' }}>
                {group.items.length}
              </span>
            </div>
            {group.items.map(item => (
              <div
                key={item.id}
                className="ns-card"
                style={{
                  padding: '13px 14px',
                  marginBottom: 8,
                  opacity: item.completed ? 0.6 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Checkbox */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 5,
                      border: `1.5px solid ${item.completed ? 'var(--primary)' : 'var(--border)'}`,
                      background: item.completed ? 'var(--primary)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'background 0.15s, border-color 0.15s',
                    }}>
                      {item.completed && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="#060D10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={item.completed}
                      disabled={toggling.has(item.id)}
                      onChange={() => void handleToggle(item.id, !item.completed)}
                      style={{ display: 'none' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13.5, fontWeight: 500,
                        textDecoration: item.completed ? 'line-through' : 'none',
                        color: item.completed ? 'var(--text-muted)' : 'var(--text)',
                      }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {item.subject && <span>{item.subject}</span>}
                        <span>Due {formatDueDate(item)}</span>
                      </div>
                    </div>
                  </label>

                  {/* Delete button */}
                  <button
                    onClick={() => void handleDelete(item.id)}
                    title="Delete task"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: 16, padding: 4,
                      opacity: 0.5, transition: 'opacity 0.15s',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '1' }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '0.5' }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  form: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 28,
  },
  formRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 10,
  },
  input: {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
  },
  button: {
    padding: '10px 20px',
    borderRadius: 8,
    border: 'none',
    background: 'var(--primary)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '60px 20px',
  },
  emptyIcon: {
    width: 48, height: 48, borderRadius: '50%',
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    color: 'var(--success)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 700, margin: '0 auto 14px',
  },
}
