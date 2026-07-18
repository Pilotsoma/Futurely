'use client'

import { useState } from 'react'
import type { PlannerItem } from '../../lib/api'
import { ChevronLeftIcon, ChevronRightIcon, LinkIcon } from '@/components/icons'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MAX_VISIBLE_ITEMS = 3
const MS_PER_DAY = 86400000

function dayOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((dayOnly(b).getTime() - dayOnly(a).getTime()) / MS_PER_DAY)
}

interface DayCell {
  date: Date
  inMonth: boolean
}

function buildMonthCells(monthAnchor: Date): DayCell[] {
  const year = monthAnchor.getFullYear()
  const month = monthAnchor.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay())

  const cells: DayCell[] = []
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    cells.push({ date, inMonth: date.getMonth() === month })
  }
  return cells
}

function itemColor(item: PlannerItem, today: Date): string {
  if (item.completed) return 'var(--text-muted)'
  if (dayOnly(new Date(item.dueDate)) < today) return '#EF4444'
  if (item.source === 'CANVAS') return '#E53935'
  return 'var(--primary)'
}

interface Lane {
  item: PlannerItem
  due: Date
  lane: number
}

// Each assignment appears only on its due-date cell — no multi-day spanning bars.
// Lane-packing still runs so multiple items due on the same day stack vertically
// without overlapping each other.
function assignLanes(items: PlannerItem[], weekStart: Date, weekEnd: Date): Lane[] {
  const touching = items
    .map(item => {
      const due = dayOnly(new Date(item.dueDate))
      return { item, due }
    })
    .filter(({ due }) => due >= weekStart && due <= weekEnd)
    .sort((a, b) => a.due.getTime() - b.due.getTime())

  const laneEnds: Date[] = []
  const result: Lane[] = []
  for (const t of touching) {
    let lane = laneEnds.findIndex(end => end < t.due)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(t.due) }
    else laneEnds[lane] = t.due
    result.push({ ...t, lane })
  }
  return result
}

interface Props {
  items: PlannerItem[]
  selectedDate: Date
  onSelectDate: (d: Date) => void
  onReschedule: (item: PlannerItem, newDueDate: Date) => void
  canvasConnected?: boolean
  onToggleCanvasPanel?: () => void
}

export default function CalendarView({ items, selectedDate, onSelectDate, onReschedule, canvasConnected, onToggleCanvasPanel }: Props) {
  const [monthAnchor, setMonthAnchor] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)
  const today = dayOnly(new Date())

  const cells = buildMonthCells(monthAnchor)
  const monthLabel = monthAnchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const monthAssignmentCount = items.filter(item => {
    if (item.completed) return false
    const due = new Date(item.dueDate)
    return due.getFullYear() === monthAnchor.getFullYear() && due.getMonth() === monthAnchor.getMonth()
  }).length

  function goMonth(delta: number) {
    setMonthAnchor(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  function goToday() {
    const now = new Date()
    setMonthAnchor(new Date(now.getFullYear(), now.getMonth(), 1))
    onSelectDate(now)
  }

  function handleDrop(e: React.DragEvent, dropDate: Date) {
    e.preventDefault()
    setDragOverDay(null)
    const id = e.dataTransfer.getData('text/plain')
    const item = items.find(i => String(i.id) === id)
    if (!item) return
    const oldDue = new Date(item.dueDate)
    const delta = daysBetween(dayOnly(oldDue), dropDate)
    if (delta === 0) return
    const newDue = new Date(oldDue.getTime() + delta * MS_PER_DAY)
    onReschedule(item, newDue)
  }

  return (
    <div className="ns-card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: 16 }}>
        <div>
          {onToggleCanvasPanel && (
            <button
              onClick={onToggleCanvasPanel}
              title={canvasConnected ? 'Manage Canvas connection' : 'Link Canvas'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'none', border: '1px solid var(--border)', borderRadius: 7,
                padding: '5px 10px', fontSize: 11.5, fontWeight: 600,
                color: canvasConnected ? '#22C55E' : 'var(--text-secondary)',
                cursor: 'pointer', boxShadow: 'var(--neo-raised)',
              }}
            >
              <LinkIcon size={12} />
              Canvas
              {canvasConnected && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
              )}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifySelf: 'center' }}>
          <button onClick={() => goMonth(-1)} aria-label="Previous month" style={navBtn}>
            <ChevronLeftIcon size={14} />
          </button>
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', minWidth: 170, textAlign: 'center' }}>
            {monthLabel}
          </span>
          <button onClick={() => goMonth(1)} aria-label="Next month" style={navBtn}>
            <ChevronRightIcon size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifySelf: 'end' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
            {monthAssignmentCount} assignment{monthAssignmentCount === 1 ? '' : 's'} this month
          </span>
          <button onClick={goToday} style={{ ...navBtn, width: 'auto', padding: '6px 12px', fontSize: 12, fontWeight: 600 }}>
            Today
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', padding: '6px 0' }}>
            {label}
          </div>
        ))}
      </div>

      {Array.from({ length: 6 }, (_, weekIdx) => {
        const week = cells.slice(weekIdx * 7, weekIdx * 7 + 7)
        const weekStart = week[0].date
        const weekEnd = week[6].date
        // Exclude completed items from the calendar grid entirely (they should
        // not appear at all — not even dimmed; this is calendar-only behaviour).
        const lanes = assignLanes(items.filter(item => !item.completed), weekStart, weekEnd)
        const countByDay = new Array(7).fill(0)
        for (const l of lanes) {
          const col = daysBetween(weekStart, l.due)
          if (col >= 0 && col <= 6) countByDay[col]++
        }

        return (
          <div key={weekIdx} style={{ position: 'relative', marginBottom: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {week.map((cell, i) => {
                const isToday = isSameDay(cell.date, today)
                const isSelected = isSameDay(cell.date, selectedDate)
                const dayKey = cell.date.toISOString()
                const isDragOver = dragOverDay === dayKey
                return (
                  <div
                    key={i}
                    onClick={() => onSelectDate(cell.date)}
                    onDragOver={e => { e.preventDefault(); setDragOverDay(dayKey) }}
                    onDragLeave={() => setDragOverDay(prev => (prev === dayKey ? null : prev))}
                    onDrop={e => handleDrop(e, cell.date)}
                    style={{
                      position: 'relative',
                      minHeight: 150,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      paddingTop: 8,
                      borderRadius: 10,
                      border: isSelected ? '1.5px solid var(--primary)' : isDragOver ? '1.5px dashed var(--primary)' : '1px solid transparent',
                      background: isSelected ? 'var(--primary-dim)' : 'var(--surface-2)',
                      cursor: 'pointer',
                      opacity: cell.inMonth ? 1 : 0.35,
                      transition: 'background 0.12s, border-color 0.12s',
                    }}
                  >
                    <span style={{
                      fontSize: 16,
                      fontWeight: isToday ? 800 : 500,
                      color: isToday ? 'var(--primary)' : 'var(--text)',
                    }}>
                      {cell.date.getDate()}
                    </span>
                    {countByDay[i] > MAX_VISIBLE_ITEMS && (
                      <span
                        title={`${countByDay[i]} assignments due`}
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          minWidth: 17,
                          height: 17,
                          borderRadius: '50%',
                          background: '#EF4444',
                          color: '#fff',
                          fontSize: 9,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 2px',
                        }}
                      >
                        +{countByDay[i] - MAX_VISIBLE_ITEMS}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Item overlay: up to MAX_VISIBLE_ITEMS draggable pills per day. The
                overflow badge is rendered next to the date number above, not here. */}
            <div style={{
              position: 'absolute', top: 34, left: 0, right: 0, bottom: 6,
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 22, gap: 3,
              padding: '0 3px', pointerEvents: 'none',
            }}>
              {lanes.filter(l => l.lane < MAX_VISIBLE_ITEMS).map(l => {
                const col = daysBetween(weekStart, l.due)
                const color = itemColor(l.item, today)
                return (
                  <div
                    key={l.item.id}
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('text/plain', String(l.item.id)); e.dataTransfer.effectAllowed = 'move' }}
                    onClick={e => { e.stopPropagation(); onSelectDate(l.due) }}
                    title={l.item.title}
                    style={{
                      gridColumn: `${col + 1} / ${col + 2}`,
                      gridRow: l.lane + 1,
                      pointerEvents: 'auto',
                      background: `color-mix(in srgb, ${color} 22%, transparent)`,
                      border: `1px solid ${color}`,
                      borderRadius: 5,
                      fontSize: 12,
                      fontWeight: 600,
                      color,
                      padding: '0 5px',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      cursor: 'grab',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {l.item.title}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const navBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
  background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
