'use client'

import React from 'react'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence, type Transition } from 'framer-motion'
import { api } from '../../lib/api'
import { BanIcon } from '@/components/icons'
import { initWebAuth, clearWebAuth } from '../../lib/authState'
import { startStudentPrefetch } from '../../lib/prefetch'
import NotificationBell from '../../components/ui/NotificationBell'
import UpdatePopup from '../../components/ui/UpdatePopup'
import ForcedLogoutWatcher from '../../components/ui/ForcedLogoutWatcher'
import InactivityWatcher from '../../components/ui/InactivityWatcher'
import ExternalLinkGuard from '../../components/ui/ExternalLinkGuard'
import CanvasTokenExpiredBanner from '../../components/ui/CanvasTokenExpiredBanner'
import LagDetector from '../../components/ui/LagDetector'
import { AiChatProvider } from '../../components/providers/AiChatProvider'
import FixBirthdayBlockScreen from '../../components/ui/FixBirthdayBlockScreen'
import AccessRestrictedScreen from '../../components/ui/AccessRestrictedScreen'

const NAV = [
  {
    href: '/dashboard', label: 'Dashboard',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  },
  {
    href: '/grades', label: 'Grade Portal',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  },
  {
    href: '/planner', label: 'Planner',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
  {
    href: '/feed', label: 'Study Feed',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  },
  {
    href: '/colleges', label: 'My Future',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    href: '/ai', label: 'AI Chat',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  },
  {
    href: '/settings', label: 'Settings',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  },
]

// Features hidden from regular users — visible only to DEV via the toggle
const HIDDEN_NAV = [
  {
    href: '/classroom', label: 'Classroom',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  },
  {
    href: '/sets', label: 'Study Sets',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  },
  {
    href: '/play', label: 'Play',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  },
]

const SIDEBAR_EXPANDED  = 260
const SIDEBAR_COLLAPSED = 68

const springTransition: Transition = { type: 'spring', stiffness: 380, damping: 30, mass: 0.8 }
const fastSpring: Transition       = { type: 'spring', stiffness: 500, damping: 38, mass: 0.6 }

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [checked, setChecked]           = useState(false)
  const [isDeleted, setIsDeleted]       = useState(false)
  const [accountStatus, setAccountStatus] = useState<string | null>(null)
  const [bannedUntilDate, setBannedUntilDate] = useState<string | null>(null)
  const [userName, setUserName]         = useState<string>('Student')
  const [pinnedExpanded, setPinnedExpanded] = useState(false)
  const [hoverExpanded, setHoverExpanded]   = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isDev, setIsDev]     = useState(false)
  const [showHidden, setShowHidden] = useState(false)

  const isExpanded  = pinnedExpanded || hoverExpanded
  const sideW       = isExpanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED
  const mainMargin  = pinnedExpanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED

  useEffect(() => {
    async function checkAuth() {
      // 1. Apply cached role from localStorage immediately (works across navigations).
      const cachedUser = JSON.parse(localStorage.getItem('ns_user') ?? 'null') as { name?: string | null; role?: string } | null
      if (cachedUser?.role === 'DEV' || cachedUser?.role === 'ADMIN') setIsAdmin(true)
      if (cachedUser?.role === 'DEV') setIsDev(true)

      const ok = await initWebAuth()
      if (!ok) { router.replace('/login'); return }

      startStudentPrefetch()

      // 2. Fetch live user data to get name and keep ns_user current — the
      // only authoritative source for role now that web holds no raw JWT.
      const freshUser = await api.authMe().catch(() => null)
      const role = freshUser?.role ?? cachedUser?.role
      const name = freshUser?.name ?? cachedUser?.name
      if (freshUser) {
        localStorage.setItem('ns_user', JSON.stringify({ ...cachedUser, ...freshUser }))
        // COPPA account-status gate — lock out DOB-mismatched or under-13 accounts
        if (freshUser.accountStatus && freshUser.accountStatus !== 'ACTIVE') {
          setAccountStatus(freshUser.accountStatus)
          setBannedUntilDate(freshUser.bannedUntilDate ?? null)
          setChecked(true)
          return
        }
      }
      if (role === 'DEV' || role === 'ADMIN') setIsAdmin(true)
      if (role === 'DEV') setIsDev(true)

      // Also check allTags for a DEV tag
      if (freshUser && role !== 'DEV') {
        api.feedUserProfile(freshUser.id).then(p => {
          if (p.tag === 'DEV' || (p.allTags ?? []).some((t: { tag: string }) => t.tag === 'DEV')) {
            setIsDev(true)
            setIsAdmin(true)
          }
        }).catch(() => {})
      }
      if (name) {
        const n = name
        if (n.includes(',')) {
          const rest = n.split(',')[1]?.trim() ?? ''
          const first = rest.split(' ')[0]
          setUserName(first.charAt(0).toUpperCase() + first.slice(1).toLowerCase())
        } else {
          setUserName(n.split(' ')[0])
        }
      }
      setChecked(true)
      api.portalStatus().catch(() => {})
    }
    void checkAuth()
  }, [router])

  function handleDobVerified() {
    setAccountStatus(null)
    setBannedUntilDate(null)
  }

  function handleLogout() {
    api.logout().catch(() => null)
    clearWebAuth()
    localStorage.removeItem('ns_user')
    router.push('/login')
  }

  if (!checked) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-muted)', fontSize: 14, flexDirection: 'column', gap: 10 }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%' }}
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
      <div><BanIcon size={52}/></div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Your account has been deleted</h1>
      <p style={{ fontSize: 15, color: 'var(--text-muted)', textAlign: 'center' as const, maxWidth: 360, margin: 0, lineHeight: 1.6 }}>
        Your myFuturely account has been permanently removed by an administrator.
      </p>
      <button className="ns-btn-ghost" style={{ marginTop: 8 }} onClick={handleLogout}>Log out</button>
    </div>
  )

  if (accountStatus === 'DOB_MISMATCH_LOCKED') return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', zIndex: 9999 }}>
      <FixBirthdayBlockScreen onLogout={handleLogout} onVerified={handleDobVerified} />
    </div>
  )

  if (accountStatus === 'UNDER_13_BANNED') return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', zIndex: 9999 }}>
      <AccessRestrictedScreen bannedUntilDate={bannedUntilDate} onLogout={handleLogout} />
    </div>
  )

  return (
    <AiChatProvider>
    <div className="ns-scale-shell" style={{ display: 'flex', minHeight: 'calc(100vh / var(--ui-zoom, 1))' }}>
      <motion.aside
        animate={{ width: sideW }}
        transition={springTransition}
        onMouseEnter={() => setHoverExpanded(true)}
        onMouseLeave={() => setHoverExpanded(false)}
        style={{
          ...S.sidebar,
          boxShadow: 'var(--neo-sidebar)',
        }}
      >
        {/* Pin toggle */}
        <motion.button
          onClick={() => setPinnedExpanded(p => !p)}
          aria-label={pinnedExpanded ? 'Unpin sidebar' : 'Pin sidebar open'}
          style={S.toggleBtn}
          whileHover={{ scale: 1.1, backgroundColor: 'var(--surface-2)' }}
          whileTap={{ scale: 0.9 }}
          transition={fastSpring}
        >
          <motion.span
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={springTransition}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </motion.span>
        </motion.button>

        {/* Logo */}
        <div style={{ ...S.logoRow, justifyContent: isExpanded ? 'flex-start' : 'center' }}>
          <a href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
            <Image src="/logo.png" alt="myFuturely" width={44} height={44} style={{ flexShrink: 0 }} />
            <AnimatePresence>
              {isExpanded && (
                <motion.span
                  key="logo-text"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={fastSpring}
                  style={S.logoText}
                >
                  myFuturely
                </motion.span>
              )}
            </AnimatePresence>
          </a>
        </div>

        {/* Nav */}
        <nav style={S.nav}>
          {NAV.map(link => {
            const active = pathname === link.href || pathname.startsWith(link.href + '/')
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{ textDecoration: 'none' }}
                title={!isExpanded ? link.label : undefined}
              >
                <motion.div
                  className={`ns-nav-link${active ? ' active' : ''}`}
                  style={{ justifyContent: !isExpanded ? 'center' : undefined, gap: !isExpanded ? 0 : undefined }}
                  whileHover={{ x: !isExpanded ? 0 : 2 }}
                  transition={fastSpring}
                >
                  {active && <motion.div layoutId="ns-sidebar-active-pill" style={S.navPill} transition={springTransition} />}
                  <motion.span
                    style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}
                    animate={{ opacity: active ? 1 : 0.55, color: active ? 'var(--primary)' : 'currentColor' }}
                    transition={{ duration: 0.15 }}
                  >
                    {link.icon}
                  </motion.span>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.span
                        key={`label-${link.href}`}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={fastSpring}
                        style={{ whiteSpace: 'nowrap', overflow: 'hidden', position: 'relative', zIndex: 1 }}
                      >
                        {link.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              </Link>
            )
          })}

          {/* Admin: educator approval queue */}
          {isAdmin && (() => {
            const active = pathname.startsWith('/admin')
            return (
              <>
                <div style={{ height: 1, background: 'var(--border)', margin: '8px 8px' }} />
                <Link href="/admin/educator-requests" style={{ textDecoration: 'none' }} title={!isExpanded ? 'Educator Requests' : undefined}>
                  <motion.div
                    className={`ns-nav-link${active ? ' active' : ''}`}
                    style={{ justifyContent: !isExpanded ? 'center' : undefined, gap: !isExpanded ? 0 : undefined }}
                    whileHover={{ x: !isExpanded ? 0 : 2 }}
                    transition={fastSpring}
                  >
                    {active && <motion.div layoutId="ns-sidebar-active-pill" style={S.navPill} transition={springTransition} />}
                    <motion.span style={{ flexShrink: 0, position: 'relative', zIndex: 1 }} animate={{ opacity: active ? 1 : 0.55, color: '#EF4444' }} transition={{ duration: 0.15 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
                    </motion.span>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.span key="label-admin" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={fastSpring}
                          style={{ whiteSpace: 'nowrap', overflow: 'hidden', color: '#EF4444', fontWeight: 700, position: 'relative', zIndex: 1 }}>
                          Educator Requests
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </Link>
              </>
            )
          })()}

          {/* DEV only: toggle + hidden feature links */}
          {isDev && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 8px' }} />
              <motion.button
                onClick={() => setShowHidden(s => !s)}
                title={!isExpanded ? (showHidden ? 'Hide features' : 'Show hidden features') : undefined}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: !isExpanded ? 'center' : 'flex-start',
                  gap: !isExpanded ? 0 : 10, width: '100%',
                  padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: showHidden ? 'rgba(168,85,247,0.10)' : 'transparent',
                  color: showHidden ? '#A855F7' : 'var(--text-muted)',
                  fontSize: 15, fontWeight: 600,
                  transition: 'background 0.15s, color 0.15s',
                }}
                whileHover={{ backgroundColor: 'rgba(168,85,247,0.10)' }}
                whileTap={{ scale: 0.97 }}
                transition={fastSpring}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  {showHidden
                    ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
                    : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                  }
                </svg>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.span key="hidden-label" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={fastSpring}
                      style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
                      {showHidden ? 'Hide features' : 'Show hidden features'}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              <AnimatePresence>
                {showHidden && HIDDEN_NAV.map((link, i) => {
                  const active = pathname === link.href || pathname.startsWith(link.href + '/')
                  return (
                    <motion.div key={link.href}
                      initial={{ opacity: 0, y: -6, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -4, height: 0 }}
                      transition={{ ...fastSpring, delay: i * 0.04 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <Link href={link.href} style={{ textDecoration: 'none' }} title={!isExpanded ? link.label : undefined}>
                        <motion.div
                          className={`ns-nav-link${active ? ' active' : ''}`}
                          style={{ justifyContent: !isExpanded ? 'center' : undefined, gap: !isExpanded ? 0 : undefined }}
                          whileHover={{ x: !isExpanded ? 0 : 2 }}
                          transition={fastSpring}
                        >
                          {active && <motion.div layoutId="ns-sidebar-active-pill" style={S.navPill} transition={springTransition} />}
                          <motion.span style={{ flexShrink: 0, position: 'relative', zIndex: 1 }} animate={{ opacity: active ? 1 : 0.55, color: '#A855F7' }} transition={{ duration: 0.15 }}>
                            {link.icon}
                          </motion.span>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.span key={`hidden-${link.href}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={fastSpring}
                                style={{ whiteSpace: 'nowrap', overflow: 'hidden', color: '#A855F7', fontSize: 15, position: 'relative', zIndex: 1 }}>
                                {link.label}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      </Link>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </>
          )}
        </nav>

        {/* Bottom */}
        <div style={S.bottom}>
          <NotificationBell showToasts collapsed={!isExpanded} />
          <AnimatePresence>
            {isExpanded && (
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
            title={!isExpanded ? 'Log out' : undefined}
            whileTap={{ scale: 0.95 }}
            transition={fastSpring}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <AnimatePresence>
              {isExpanded && (
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
      <LagDetector />

      {/* Main content — only shifts when sidebar is pinned open */}
      <motion.main
        animate={{ marginLeft: mainMargin }}
        transition={springTransition}
        style={S.main}
      >
        <AnimatePresence mode="popLayout">
          <motion.div
            key={pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{ width: '100%' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </motion.main>
    </div>
    </AiChatProvider>
  )
}

const S: Record<string, React.CSSProperties> = {
  sidebar:    { flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '20px 12px 24px', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, overflow: 'hidden' },
  toggleBtn:  { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', marginLeft: 'auto', marginBottom: 22, flexShrink: 0, boxShadow: 'var(--neo-raised)' },
  logoRow:    { paddingLeft: 0, marginBottom: 28, display: 'flex' },
  logoText:   { fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.4px', whiteSpace: 'nowrap' },
  nav:        { flex: 1, display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden', position: 'relative' },
  navPill:    { position: 'absolute', inset: 0, borderRadius: 12, background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', pointerEvents: 'none', zIndex: 0 },
  bottom:     { borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  userRow:    { display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 4, overflow: 'hidden' },
  userAvatar: { width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 },
  userName:   { fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  logoutBtn:  { display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, padding: '9px 12px' },
  main:       { flex: 1, padding: 'var(--page-px)', minHeight: 'calc(100vh / var(--ui-zoom, 1))', position: 'relative' },
}
