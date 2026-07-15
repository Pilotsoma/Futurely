'use client'

import React from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChartIcon, ClipboardIcon, ClockIcon, CalculatorIcon, EnvelopeIcon,
  TrendingUpIcon, DocumentIcon, CalendarIcon,
} from '@/components/icons'

const CARDS: Array<{ href: string; title: string; desc: string; icon: React.ReactNode; iconBg: string; iconColor: string }> = [
  {
    href: '/grades/classwork',
    title: 'Grades',
    desc: 'Assignments & current averages',
    icon: <BarChartIcon size={30}/>,
    iconBg: 'rgba(16,185,129,0.14)',
    iconColor: '#10B981',
  },
  {
    href: '/grades/report-card',
    title: 'Report Card',
    desc: 'Official grades by reporting period',
    icon: <ClipboardIcon size={30}/>,
    iconBg: 'rgba(59,130,246,0.16)',
    iconColor: '#3B82F6',
  },
  {
    href: '/grades/schedule',
    title: 'Class Schedule',
    desc: 'Your class periods',
    icon: <ClockIcon size={30}/>,
    iconBg: 'rgba(245,158,11,0.14)',
    iconColor: '#F59E0B',
  },
  {
    href: '/grades/what-if',
    title: 'What-If Calculator',
    desc: 'Simulate GPA changes',
    icon: <CalculatorIcon size={30}/>,
    iconBg: 'var(--primary-dim)',
    iconColor: 'var(--primary)',
  },
  {
    href: '/grades/contact',
    title: 'Contact Teachers',
    desc: 'Email your teachers',
    icon: <EnvelopeIcon size={30}/>,
    iconBg: 'rgba(249,115,22,0.14)',
    iconColor: '#F97316',
  },
  {
    href: '/grades/progress',
    title: 'Progress Report',
    desc: 'Interim grades by date',
    icon: <TrendingUpIcon size={30}/>,
    iconBg: 'rgba(167,139,250,0.16)',
    iconColor: '#A78BFA',
  },
  {
    href: '/grades/transcript',
    title: 'Transcript',
    desc: 'Credits & GPA history',
    icon: <DocumentIcon size={30}/>,
    iconBg: 'rgba(99,102,241,0.16)',
    iconColor: '#6366F1',
  },
  {
    href: '/grades/attendance',
    title: 'Attendance',
    desc: 'Absences & tardies calendar',
    icon: <CalendarIcon size={30}/>,
    iconBg: 'rgba(239,68,68,0.14)',
    iconColor: '#EF4444',
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
            style={{ ...S.card, ...(hovered === card.href ? { transform: 'translateY(-2px)', boxShadow: 'var(--neo-raised), var(--shadow-md)', borderColor: 'var(--border-hover)' } : {}) }}
          >
            <div style={{ ...S.iconBox, background: card.iconBg }}>
              <span style={{ display: 'flex', alignItems: 'center', color: card.iconColor }}>{card.icon}</span>
            </div>
            <div style={{ flex: 1, textAlign: 'left' as const }}>
              <div style={S.cardTitle}>{card.title}</div>
              <div style={S.cardDesc}>{card.desc}</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  title:    { fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 32 },
  grid:     { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 },
  card:     { display: 'flex', alignItems: 'center', gap: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '34px 30px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.2s', boxShadow: 'var(--neo-raised)' },
  iconBox:  { width: 68, height: 68, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitle:{ fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 5 },
  cardDesc: { fontSize: 14.5, color: 'var(--text-secondary)' },
}
