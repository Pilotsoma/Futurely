'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CARDS = [
  {
    href: '/grades/classwork',
    title: 'Grades',
    desc: 'Assignments & current averages',
    icon: '📊',
    iconBg: 'rgba(16,185,129,0.1)',
  },
  {
    href: '/grades/report-card',
    title: 'Report Card',
    desc: 'Official grades by reporting period',
    icon: '📋',
    iconBg: 'rgba(59,130,246,0.12)',
  },
  {
    href: '/grades/schedule',
    title: 'Class Schedule',
    desc: 'Your class periods',
    icon: '🕐',
    iconBg: 'rgba(245,158,11,0.1)',
  },
  {
    href: '/grades/what-if',
    title: 'What-If Calculator',
    desc: 'Simulate GPA changes',
    icon: '🧮',
    iconBg: 'var(--primary-dim)',
  },
  {
    href: '/grades/contact',
    title: 'Contact Teachers',
    desc: 'Email your teachers',
    icon: '✉️',
    iconBg: 'rgba(249,115,22,0.1)',
  },
  {
    href: '/grades/progress',
    title: 'Progress Report',
    desc: 'Interim grades by date',
    icon: '📈',
    iconBg: 'rgba(167,139,250,0.1)',
  },
  {
    href: '/grades/transcript',
    title: 'Transcript',
    desc: 'Credits & GPA history',
    icon: '📄',
    iconBg: 'rgba(99,102,241,0.1)',
  },
  {
    href: '/grades/attendance',
    title: 'Attendance',
    desc: 'Absences & tardies calendar',
    icon: '📅',
    iconBg: 'rgba(239,68,68,0.1)',
  },
]

export default function GradesHubPage() {
  const router = useRouter()
  const [hovered, setHovered] = useState<string | null>(null)
  return (
    <div className="fade-up">
      <h1 style={S.title}>Grade Portal</h1>
      <div style={S.grid}>
        {CARDS.map(card => (
          <button
            key={card.href}
            onClick={() => router.push(card.href)}
            onMouseEnter={() => setHovered(card.href)}
            onMouseLeave={() => setHovered(null)}
            style={{ ...S.card, ...(hovered === card.href ? { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', borderColor: 'var(--border-hover)' } : {}) }}
          >
            <div style={{ ...S.iconBox, background: card.iconBg }}>
              <span style={{ fontSize: 22 }}>{card.icon}</span>
            </div>
            <div style={{ flex: 1, textAlign: 'left' as const }}>
              <div style={S.cardTitle}>{card.title}</div>
              <div style={S.cardDesc}>{card.desc}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  title:    { fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 28 },
  grid:     { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 },
  card:     { display: 'flex', alignItems: 'center', gap: 18, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.2s' },
  iconBox:  { width: 52, height: 52, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitle:{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: 'var(--text-secondary)' },
}
