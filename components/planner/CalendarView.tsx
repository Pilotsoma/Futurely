'use client'

import { useState } from 'react'
import type { PlannerItem } from '../../lib/api'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MAX_LANES = 3
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
  start: Date
  due: Date
  lane: number
}

function assignLanes(items: PlannerItem[], weekStart: Date, weekEnd: Date): Lane[] {
  const touching = items
    .map(item => {
      const due = dayOnly(new Date(item.dueDate))
      const start = item.startDate ? dayOnly(new Date(item.startDate)) : due
      return { item, start, due }
    })
    .filter(({ start, due }) => due >= weekStart && start <= weekEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || (b.due.getTime() - b.start.getTime()) - (a.due.getTime() - a.start.getTime()))

  const laneEnds: Date[] = []
  const result: Lane[] = []
  for (const t of touching) {
    let lane = laneEnds.findIndex(end => end < t.start)
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
}

export default function CalendarView({ items, selectedDate, onSelectDate, onReschedule }: Props) {
  const [monthAnchor, setMonthAnchor] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)
  const today = dayOnly(new Date())

  const cells = buildMonthCells(monthAnchor)
  const monthLabel = monthAnchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

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
    <div className="ns-card" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => goMonth(-1)} aria-label="Previous month" style={navBtn}>
            <ChevronLeftIcon size={14} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', minWidth: 140, textAlign: 'center' }}>
            {monthLabel}
          </span>
          <button onClick={() => goMonth(1)} aria-label="Next month" style={navBtn}>
            <ChevronRightIcon size={14} />
          </button>
        </div>
        <button onClick={goToday} style={{ ...navBtn, width: 'auto', padding: '6px 12px', fontSize: 12, fontWeight: 600 }}>
          Today
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', padding: '4px 0' }}>
            {label}
          </div>
        ))}
      </div>

      {Array.from({ length: 6 }, (_, weekIdx) => {
        const week = cells.slice(weekIdx * 7, weekIdx * 7 + 7)
        const weekStart = week[0].date
        const weekEnd = week[6].date
        const lanes = assignLanes(items, weekStart, weekEnd)
        const overflowByDay = new Array(7).fill(0)
        for (const l of lanes) {
          if (l.lane < MAX_LANES) continue
          const segStart = Math.max(0, daysBetween(weekStart, l.start))
          const segEnd = Math.min(6, daysBetween(weekStart, l.due))
          for (let d = segStart; d <= segEnd; d++) overflowByDay[d]++
        }

        return (
          <div key={weekIdx} style={{ position: 'relative', marginBottom: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
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
                      minHeight: 74,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      paddingTop: 4,
                      borderRadius: 8,
                      border: isSelected ? '1.5px solid var(--primary)' : isDragOver ? '1.5px dashed var(--primary)' : '1px solid transparent',
                      background: isSelected ? 'var(--primary-dim)' : 'var(--surface-2)',
                      cursor: 'pointer',
                      opacity: cell.inMonth ? 1 : 0.35,
                      transition: 'background 0.12s, border-color 0.12s',
                    }}
                  >
                    <span style={{
                      fontSize: 12,
                      fontWeight: isToday ? 800 : 500,
                      color: isToday ? 'var(--primary)' : 'var(--text)',
                    }}>
                      {cell.date.getDate()}
                    </span>
                    {overflowByDay[i] > 0 && (
                      <span style={{ fontSize: 8.5, color: 'var(--text-muted)', fontWeight: 700, marginTop: 'auto', paddingBottom: 2 }}>
                        +{overflowByDay[i]}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Bars overlay: spans/single-day items rendered as draggable pills across day columns */}
            <div style={{
              position: 'absolute', top: 22, left: 0, right: 0, bottom: 4,
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 15, gap: 2,
              padding: '0 2px', pointerEvents: 'none',
            }}>
              {lanes.filter(l => l.lane < MAX_LANES).map(l => {
                const segStart = Math.max(0, daysBetween(weekStart, l.start))
                const segEnd = Math.min(6, daysBetween(weekStart, l.due))
                const color = itemColor(l.item, today)
                return (
                  <div
                    key={l.item.id}
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('text/plain', String(l.item.id)); e.dataTransfer.effectAllowed = 'move' }}
                    onClick={e => { e.stopPropagation(); onSelectDate(l.due) }}
                    title={l.item.title}
                    style={{
                      gridColumn: `${segStart + 1} / ${segEnd + 2}`,
                      gridRow: l.lane + 1,
                      pointerEvents: 'auto',
                      background: `color-mix(in srgb, ${color} 22%, transparent)`,
                      border: `1px solid ${color}`,
                      borderRadius: 4,
                      fontSize: 9.5,
                      fontWeight: 600,
                      color,
                      padding: '0 4px',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      cursor: 'grab',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: l.item.completed ? 0.55 : 1,
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
