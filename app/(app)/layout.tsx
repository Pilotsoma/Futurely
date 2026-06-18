'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence, type Transition } from 'framer-motion'
import { api } from '../../lib/api'
import { initWebAuth, clearWebAuth } from '../../lib/authState'
import NotificationBell from '../../components/ui/NotificationBell'
import UpdatePopup from '../../components/ui/UpdatePopup'
import ForcedLogoutWatcher from '../../components/ui/ForcedLogoutWatcher'
import InactivityWatcher from '../../components/ui/InactivityWatcher'
import ExternalLinkGuard from '../../components/ui/ExternalLinkGuard'
import CanvasTokenExpiredBanner from '../../components/ui/CanvasTokenExpiredBanner'

const NAV = [
  {
    href: '/dashboard', label: 'Dashboard',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  },
  {
    href: '/grades', label: 'Grades',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  },
  {
    href: '/planner', label: 'Planner',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
  {
    href: '/feed', label: 'Study Feed',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  },
  {
    href: '/colleges', label: 'Colleges',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    href: '/marketplace', label: 'Marketplace',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
  },
  {
    href: '/ai', label: 'AI Chat',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  },
  {
    href: '/settings', label: 'Settings',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  },
]

const SIDEBAR_EXPANDED = 220
const SIDEBAR_COLLAPSED = 64

const springTransition: Transition = { type: 'spring', stiffness: 380, damping: 30, mass: 0.8 }
const fastSpring: Transition       = { type: 'spring', stiffness: 500, damping: 38, mass: 0.6 }

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [checked, setChecked]   = useState(false)
  const [isDeleted, setIsDeleted] = useState(false)
  const [userName, setUserName] = useState<string>('Student')
  const [collapsed, setCollapsed] = useState(true)

  // Floating active pill
  const navRef  = useRef<HTMLElement>(null)
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const [pillY, setPillY]         = useState(0)
  const [pillH, setPillH]         = useState(36)
  const [pillReady, setPillReady] = useState(false)

  useLayoutEffect(() => {
    const activeHref = NAV.find(n => pathname === n.href || pathname.startsWith(n.href + '/'))?.href
    if (!activeHref) return
    const linkEl = linkRefs.current[activeHref]
    const navEl  = navRef.current
    if (!linkEl || !navEl) return
    const navRect  = navEl.getBoundingClientRect()
    const linkRect = linkEl.getBoundingClientRect()
    setPillY(linkRect.top - navRect.top)
    setPillH(linkRect.height)
    setPillReady(true)
  }, [pathname, collapsed])

  useEffect(() => {
    async function checkAuth() {
      const ok = await initWebAuth()
      if (!ok) { router.replace('/login'); return }

      const user = JSON.parse(localStorage.getItem('ns_user') ?? 'null') as { name?: string | null } | null
      if (user?.name) {
        const n = user.name
        if (n.includes(',')) {
          const rest = n.split(',')[1]?.trim() ?? ''
          const first = rest.split(' ')[0]
          setUserName(first.charAt(0).toUpperCase() + first.slice(1).toLowerCase())
        } else {
          setUserName(n.split(' ')[0])
        }
      }
      api.portalStatus().catch(() => {}).finally(() => setChecked(true))
    }
    void checkAuth()
  }, [router])

  function handleLogout() {
    api.logout().catch(() => null)
    clearWebAuth()
    localStorage.removeItem('ns_user')
    router.push('/login')
  }

  if (!checked) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-muted)', fontSize: 13, flexDirection: 'column', gap: 10 }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        style={{ width: 22, height: 22, border: '2px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%' }}
      />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        Refreshing session…
      </motion.span>
    </div>
  )

  if (isDeleted) return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 9999 }}>
      <div style={{ fontSize: 52 }}>🚫</div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Your account has been deleted</h1>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center' as const, maxWidth: 360, margin: 0, lineHeight: 1.6 }}>
        Your Futurely account has been permanently removed by an administrator.
      </p>
      <button className="ns-btn-ghost" style={{ marginTop: 8 }} onClick={handleLogout}>Log out</button>
    </div>
  )

  const sideW = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <motion.aside
        animate={{ width: sideW }}
        transition={springTransition}
        style={S.sidebar}
      >
        {/* Collapse toggle */}
        <motion.button
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={S.toggleBtn}
          whileHover={{ scale: 1.1, backgroundColor: 'var(--surface-2)' }}
          whileTap={{ scale: 0.9 }}
          transition={fastSpring}
        >
          <motion.span
            animate={{ rotate: collapsed ? 0 : 180 }}
            transition={springTransition}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </motion.span>
        </motion.button>

        {/* Logo */}
        <div style={{ ...S.logoRow, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <a href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            <Image src="/logo.png" alt="Futurely" width={40} height={40} style={{ flexShrink: 0 }} />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  key="logo-text"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={fastSpring}
                  style={S.logoText}
                >
                  Futurely
                </motion.span>
              )}
            </AnimatePresence>
          </a>
        </div>

        {/* Nav */}
        <nav ref={navRef} style={S.nav}>
          {/* Floating active pill */}
          {pillReady && (
            <motion.div
              animate={{ y: pillY, height: pillH }}
              transition={springTransition}
              style={S.navPill}
            />
          )}
          {NAV.map(link => {
            const active = pathname === link.href || pathname.startsWith(link.href + '/')
            return (
              <Link
                key={link.href}
                href={link.href}
                ref={el => { linkRefs.current[link.href] = el }}
                style={{ textDecoration: 'none' }}
                title={collapsed ? link.label : undefined}
              >
                <motion.div
                  className={`ns-nav-link${active ? ' active' : ''}`}
                  style={{ justifyContent: collapsed ? 'center' : undefined, gap: collapsed ? 0 : undefined }}
                  whileHover={{ x: collapsed ? 0 : 2 }}
                  transition={fastSpring}
                >
                  <motion.span
                    style={{ flexShrink: 0 }}
                    animate={{ opacity: active ? 1 : 0.55, color: active ? 'var(--primary)' : 'currentColor' }}
                    transition={{ duration: 0.15 }}
                  >
                    {link.icon}
                  </motion.span>
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        key={`label-${link.href}`}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={fastSpring}
                        style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}
                      >
                        {link.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div style={S.bottom}>
          <NotificationBell showToasts collapsed={collapsed} />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                key="user-row"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={fastSpring}
                style={S.userRow}
              >
                <div style={S.userAvatar}>{userName.charAt(0).toUpperCase()}</div>
                <span style={S.userName}>{userName}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button
            className="ns-btn-ghost"
            style={{ ...S.logoutBtn, justifyContent: 'center' }}
            onClick={handleLogout}
            title={collapsed ? 'Log out' : undefined}
            whileTap={{ scale: 0.95 }}
            transition={fastSpring}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  key="logout-label"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={fastSpring}
                >
                  Log out
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.aside>

      <UpdatePopup />
      <ForcedLogoutWatcher />
      <InactivityWatcher />
      <ExternalLinkGuard />
      <CanvasTokenExpiredBanner />

      {/* Main content — spring-follows sidebar width */}
      <motion.main
        animate={{ marginLeft: sideW }}
        transition={springTransition}
        style={S.main}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, filter: 'blur(2px)' }}
            transition={{ duration: 0.28, ease: [0.19, 1, 0.22, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </motion.main>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  sidebar:    { flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '16px 10px 20px', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, overflow: 'hidden', boxShadow: '2px 0 20px rgba(26,21,14,0.05)' },
  toggleBtn:  { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', marginLeft: 'auto', marginBottom: 18, flexShrink: 0 },
  logoRow:    { paddingLeft: 0, marginBottom: 24, display: 'flex' },
  logoText:   { fontSize: 15, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.3px', whiteSpace: 'nowrap' },
  nav:        { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', position: 'relative' },
  navPill:    { position: 'absolute', left: 0, right: 0, borderRadius: 9, background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', pointerEvents: 'none', zIndex: 0 },
  bottom:     { borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 },
  userRow:    { display: 'flex', alignItems: 'center', gap: 9, paddingLeft: 4, overflow: 'hidden' },
  userAvatar: { width: 26, height: 26, borderRadius: '50%', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 },
  userName:   { fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  logoutBtn:  { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '8px 12px' },
  main:       { flex: 1, padding: 'var(--page-px)', minHeight: '100vh' },
}
