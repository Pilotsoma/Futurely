'use client'

import React from 'react'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { CheckIcon } from '@/components/icons'
import { api } from '../../lib/api'
import { initWebAuth, clearWebAuth } from '../../lib/authState'

const NAV = [
  {
    href: '/teacher/dashboard', label: 'Classrooms',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>,
  },
  {
    href: '/teacher/settings', label: 'Settings',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  },
]

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)
  const [userName, setUserName] = useState('Teacher')
  const [requestStatus, setRequestStatus] = useState<string | null>(null)
  const [requestedRole, setRequestedRole] = useState<string | null>(null)

  useEffect(() => {
    async function checkAuth() {
      const ok = await initWebAuth()
      if (!ok) { router.replace('/login'); return }

      // Get fresh role from backend — localStorage may be stale after approval
      let freshRole: string | null = null
      try {
        const me = await api.authMe()
        freshRole = me.role
        const cached = JSON.parse(localStorage.getItem('ns_user') ?? 'null') as Record<string, unknown> | null
        localStorage.setItem('ns_user', JSON.stringify({ ...cached, ...me }))
      } catch { /* fall back to localStorage */ }

      const user = JSON.parse(localStorage.getItem('ns_user') ?? 'null') as { role?: string; name?: string | null } | null
      const role = freshRole ?? user?.role

      // Approved counselors belong in the counselor portal
      if (role === 'COUNSELOR') { router.replace('/counselor/dashboard'); return }
      if (role !== 'TEACHER') { router.replace('/dashboard'); return }

      if (user?.name) setUserName(user.name.split(' ')[0])
      try {
        const data = await api.educatorMe()
        setRequestStatus(data.requestStatus ?? 'PENDING')
        setRequestedRole(data.requestedRole ?? 'TEACHER')
      } catch {
        setRequestStatus('PENDING')
      }
      setChecked(true)
    }
    void checkAuth()
  }, [router])

  function handleLogout() {
    clearWebAuth()
    localStorage.removeItem('ns_user')
    router.push('/login')
  }

  if (!checked) return null

  if (requestStatus !== 'APPROVED') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>Awaiting Approval</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 28 }}>
            Your {requestedRole === 'COUNSELOR' ? 'counselor' : 'teacher'} account is pending review by an admin. You&apos;ll have full access once approved. This usually takes less than 24 hours. For a faster approval, contact <a href="mailto:sumodhprabhu2008@gmail.com" style={{ color: 'var(--primary)', textDecoration: 'none' }}>sumodhprabhu2008@gmail.com</a>.
          </p>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>What you get after approval</p>
            {['Create classrooms with invite codes', 'See all your students in one place', 'Assign homework & tasks', 'Reward up to 300 coins per student per day'].map(item => (
              <p key={item} style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <CheckIcon size={14}/>{item}
              </p>
            ))}
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 24px', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
            Log out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={S.sidebar}>
        {/* Logo */}
        <div style={S.logoRow}>
          <a href="/teacher/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={S.logoMark}>N</div>
            <span style={S.logoText}>Futurely</span>
          </a>
        </div>

        {/* Role badge */}
        <div style={S.roleBadge}>Teacher Portal</div>

        {/* Nav */}
        <nav style={S.nav}>
          {NAV.map(link => {
            const active = pathname === link.href || pathname.startsWith(link.href + '/')
            return (
              <Link key={link.href} href={link.href} style={{ textDecoration: 'none' }}>
                <div className={`ns-nav-link${active ? ' active' : ''}`} style={active ? S.navActive : {}}>
                  <span style={{ flexShrink: 0, opacity: active ? 1 : 0.7, color: active ? 'var(--primary)' : 'inherit' }}>{link.icon}</span>
                  {link.label}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div style={S.bottom}>
          <div style={S.userRow}>
            <div style={S.userAvatar}>{userName.charAt(0).toUpperCase()}</div>
            <span style={S.userName}>{userName}</span>
          </div>
          <button className="ns-btn-ghost" style={S.logoutBtn} onClick={handleLogout}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Log out
          </button>
        </div>
      </aside>

      <main style={S.main}>{children}</main>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  sidebar:    { width: 220, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', boxShadow: 'var(--neo-sidebar)', display: 'flex', flexDirection: 'column', padding: '20px 12px', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50 },
  logoRow:    { paddingLeft: 8, marginBottom: 16 },
  logoMark:   { width: 28, height: 28, borderRadius: 10, background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, flexShrink: 0 },
  logoText:   { fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' },
  roleBadge:  { margin: '0 4px 20px', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--primary)', textAlign: 'center' as const },
  nav:        { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  navActive:  { background: 'var(--primary-dim)', borderLeft: '2px solid var(--primary)', borderRadius: '0 12px 12px 0', paddingLeft: 12, marginLeft: 2 },
  bottom:     { borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 },
  userRow:    { display: 'flex', alignItems: 'center', gap: 9, paddingLeft: 4 },
  userAvatar: { width: 26, height: 26, borderRadius: '50%', background: 'var(--primary-dim)', border: '1px solid var(--primary)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 },
  userName:   { fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' },
  logoutBtn:  { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontSize: 13, padding: '8px 12px' },
  main:       { marginLeft: 220, flex: 1, overflowY: 'auto' as const, padding: 32, minHeight: '100vh' },
}
