'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { api, type StudentData } from '../../../lib/api'
import { consumeStudentPrefetch } from '../../../lib/prefetch'
import AiBar from '../../../components/ui/AiBar'
import PageLoader from '../../../components/ui/PageLoader'
import NotificationBell from '../../../components/ui/NotificationBell'

// Quick links between the stat row and the AI bar. "Chatbot" from the design
// spec maps to the same /ai surface as AI Chat, so Colleges fills the 4th slot.
const QUICK_LINKS = [
  { href: '/grades',   label: 'Grade Portal', icon: '📊', iconBg: 'rgba(16,185,129,0.1)' },
  { href: '/ai',       label: 'AI Chat',      icon: '🤖', iconBg: 'rgba(99,102,241,0.12)' },
  { href: '/planner',  label: 'Planner',      icon: '📅', iconBg: 'rgba(245,158,11,0.1)' },
  { href: '/colleges', label: 'Colleges',     icon: '🎓', iconBg: 'rgba(59,130,246,0.12)' },
]

function useCountUp(target: number | null, duration = 700): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (target === null || target === 0) return
    const t = target
    const start = Date.now()
    let raf: number
    function tick() {
      const p = Math.min((Date.now() - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(t * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

function useCountUpFloat(target: number | null, duration = 900): string {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (target === null) return
    const start = Date.now()
    let raf: number
    function tick() {
      const p = Math.min((Date.now() - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal((target ?? 0) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val.toFixed(3)
}

function normalCdf(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = z >= 0 ? 1 : -1
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + p * x)
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x)
  return 0.5 * (1 + sign * y)
}

// National distribution (mean 2.96, sd 0.52). Weighted GPA normalized to 4.0 scale first.
// Averages both when available — stricter than unweighted-only.
function computeGpaPercentile(ugpa: number | null, wgpa: number | null): number | null {
  if (ugpa === null && wgpa === null) return null
  const pctFromGpa = (g: number) => Math.min(99.99, Math.max(0.01, normalCdf((g - 2.96) / 0.52) * 100))
  const uPct = ugpa !== null ? pctFromGpa(ugpa) : null
  const wPct = wgpa !== null ? pctFromGpa(wgpa * 4 / 5) : null
  if (uPct !== null && wPct !== null) return (uPct + wPct) / 2
  return uPct ?? wPct!
}

// Returns 0–50 (percent). Averages unweighted (floor 2.0/max 4.0) and weighted (floor 2.5/max 5.0).
function getGpaBonusPct(ugpa: number | null, wgpa: number | null): number {
  const fromU = (g: number) => Math.max(0, Math.min(50, (g - 2.0) / 2.0 * 50))
  const fromW = (g: number) => Math.max(0, Math.min(50, (g - 2.5) / 2.5 * 50))
  if (ugpa === null && wgpa === null) return 0
  if (ugpa !== null && wgpa !== null) return (fromU(ugpa) + fromW(wgpa)) / 2
  if (ugpa !== null) return fromU(ugpa)
  return fromW(wgpa!)
}

function percentileStr(p: number): string {
  const s = p.toFixed(2)
  const int = Math.floor(p)
  const suffix = (int % 100 >= 11 && int % 100 <= 13) ? 'th'
    : int % 10 === 1 ? 'st'
    : int % 10 === 2 ? 'nd'
    : int % 10 === 3 ? 'rd' : 'th'
  return `${s}${suffix}`
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
function getTimeOfDay() {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}


export default function DashboardPage() {
  const router = useRouter()
  const [data, setData]         = useState<StudentData | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [portalUGpa, setPortalUGpa] = useState<number | null>(null)
  const [portalWGpa, setPortalWGpa] = useState<number | null>(null)
  const [courseCount, setCourseCount] = useState<number | null>(null)
  const [semesterLabel, setSemesterLabel] = useState<string>('')
  const [showResyncPopup, setShowResyncPopup] = useState(false)
  const [resyncing, setResyncing] = useState(false)
  const [resyncError, setResyncError] = useState<string | null>(null)
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [showGpaWelcome, setShowGpaWelcome] = useState(false)
  const [hideGpa, setHideGpa] = useState(false)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const gpaNeedsResync = useRef(false)

  useEffect(() => {
    setHideGpa(localStorage.getItem('ns_hide_gpa') === '1')
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('connect') === '1') {
      setShowConnectModal(true)
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])

  useEffect(() => {
    // Claim the daily coin reward (flat daily amount + GPA bonus, streak-free)
    api.marketplaceDailyClaim().catch(() => {})
    const prefetch = consumeStudentPrefetch()
    const dataPromise = prefetch ?? api.me().catch(() => null)
    dataPromise.then(d => { if (d) setData(d); else api.me().then(setData).catch(e => setError(e instanceof Error ? e.message : 'Failed')) })
    api.portalGpa()
      .then(g => { setPortalUGpa(g.unweightedGpa); setPortalWGpa(g.weightedGpa) })
      .catch(() => {})

    api.portalStatus().then(status => {
      if (!status.connected) return
      const now = new Date()
      const isFall = now.getMonth() >= 7
      setSemesterLabel(isFall ? `Fall ${now.getFullYear()}` : `Spring ${now.getFullYear()}`)
      api.portalGrades()
        .then(g => { setCourseCount(new Set(g.grades.map(c => c.name)).size) })
        .catch(() => { gpaNeedsResync.current = true })
    }).catch(() => {})

    const resyncTimer = setTimeout(() => {
      if (gpaNeedsResync.current) setShowResyncPopup(true)
    }, 6000)

    return () => clearTimeout(resyncTimer)
  }, [])

  async function handleResync() {
    setResyncing(true)
    setResyncError(null)
    setNeedsReconnect(false)
    try {
      await api.portalSyncProfile()
      const [g, grades, freshData] = await Promise.all([api.portalGpa(), api.portalGrades(), api.me()])
      setPortalUGpa(g.unweightedGpa)
      setPortalWGpa(g.weightedGpa)
      setCourseCount(new Set(grades.grades.map(c => c.name)).size)
      setData(freshData)
      setShowResyncPopup(false)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'NOT_CONNECTED' || code === 'NO_CREDENTIALS' || code === 'RELOGIN_FAILED') {
        setNeedsReconnect(true)
      } else {
        setResyncError('Something went wrong, try again')
      }
    } finally {
      setResyncing(false)
    }
  }

  // Show one-time GPA percentile popup when GPA first loads
  useEffect(() => {
    const ugpa = portalUGpa ?? data?.profile?.unweightedGpa ?? null
    const wgpa = portalWGpa ?? data?.profile?.weightedGpa ?? null
    if (ugpa === null && wgpa === null) return
    if (localStorage.getItem('ns_gpa_welcome_v1')) return
    localStorage.setItem('ns_gpa_welcome_v1', '1')
    setShowGpaWelcome(true)
  }, [portalUGpa, portalWGpa, data])

  // ── Derived values (computed before hooks so they can be passed as targets) ──
  const dbCourseCount = (() => {
    if (!data) return 0
    const now = new Date()
    const isFall = now.getMonth() >= 7
    const semKey = `${now.getFullYear()}-${isFall ? 'FA' : 'SP'}`
    return data.courses.filter(c => c.semester === semKey).length
  })()
  const displayCourseCount = courseCount || dbCourseCount

  // ── All hooks must be called before any early return ──────────────────────
  const animCourses = useCountUp(data ? displayCourseCount : null, 600)
  const animDueWeek = useCountUp(data ? data.stats.assignmentsDueThisWeek : null, 700)
  const animPending = useCountUp(data ? data.stats.pendingAssignments : null, 750)
  const animUGpa    = useCountUpFloat(portalUGpa ?? data?.profile?.unweightedGpa ?? null, 900)
  const animWGpa    = useCountUpFloat(portalWGpa ?? data?.profile?.weightedGpa ?? null, 900)

  if (error) return <div style={{ padding: 40, color: 'var(--error)' }}>{error}</div>
  if (!data) return <PageLoader message="Opening dashboard…" />

  const firstName = (() => {
    const n = data.name
    if (!n) return 'Student'
    const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''
    if (n.includes(',')) {
      const rest = n.split(',')[1]?.trim() ?? ''
      return cap(rest.split(' ')[0]) || 'Student'
    }
    return cap(n.split(' ')[0]) || 'Student'
  })()
  const today = new Date()
  const dueToday = data.assignments.filter(a => {
    if (a.completed) return false
    const d = new Date(a.dueDate)
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  })

  const staggerItem = (i: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.28, ease: [0.19, 1, 0.22, 1] as [number, number, number, number], delay: i * 0.05 },
  })

  const effectiveUGpa = portalUGpa ?? data.profile?.unweightedGpa ?? null
  const effectiveWGpa = portalWGpa ?? data.profile?.weightedGpa ?? null
  const gpaPercentile = computeGpaPercentile(effectiveUGpa, effectiveWGpa)
  const gpaBonusPct = getGpaBonusPct(effectiveUGpa, effectiveWGpa)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div style={S.pageHeader}>
        <div>
          <p style={S.greeting}>Good {getTimeOfDay()},</p>
          <h1 style={S.name}>{firstName}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={S.dateChip}>{formatDate()}</span>
          <NotificationBell />
        </div>
      </div>

      {/* GPA + Due Today */}
      <motion.div style={S.topRow} {...staggerItem(0)}>
        <div className="ns-card" style={{ ...S.card, flex: 1, cursor: 'pointer' }} onClick={() => router.push('/grades/what-if')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ ...S.cardLabel, marginBottom: 0 }}>GPA</p>
            <button
              onClick={e => { e.stopPropagation(); const next = !hideGpa; setHideGpa(next); localStorage.setItem('ns_hide_gpa', next ? '1' : '0') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--text-muted)', lineHeight: 1 }}
              title={hideGpa ? 'Show GPA' : 'Hide GPA'}
            >
              {hideGpa
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          </div>
          <div style={S.gpaRow}>
            <div style={S.gpaBlock}>
              <div style={{ ...S.gpaNum, ...(hideGpa ? { filter: 'blur(8px)', userSelect: 'none' } : {}) }}>{animUGpa}</div>
              <div style={S.gpaTag}>Unweighted</div>
            </div>
            <div style={S.gpaDivider} />
            <div style={S.gpaBlock}>
              <div style={{ ...S.gpaNum, ...gradientStyle, ...(hideGpa ? { filter: 'blur(8px)', userSelect: 'none' } : {}) }}>{animWGpa}</div>
              <div style={S.gpaTag}>Weighted</div>
            </div>
          </div>
          {showResyncPopup && (
            <button
              onClick={e => { e.stopPropagation(); setShowResyncPopup(true) }}
              style={S.resyncBanner}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>
              Some data didn&apos;t load · Re-sync
            </button>
          )}
        </div>

        <div className="ns-card" style={{ ...S.card, flex: 1, cursor: 'pointer' }} onClick={() => router.push('/planner')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={S.cardLabel}>Due Today</p>
            {dueToday.length > 0 && <span style={S.countPill}>{dueToday.length}</span>}
          </div>
          {dueToday.length === 0 ? (
            <p style={S.emptyMsg}>All clear for today ✓</p>
          ) : (
            dueToday.slice(0, 3).map(a => (
              <div key={a.id} style={S.dueRow}>
                <span style={S.dueDot} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.dueTitle}>{a.title}</div>
                  <div style={S.dueSub}>{a.subject}</div>
                </div>
                <span style={S.dueTime}>{a.estimatedMinutes}m</span>
              </div>
            ))
          )}
        </div>
      </motion.div>

      {/* Stat row */}
      <div style={S.statsRow}>
        <motion.div className="ns-card" style={{ ...S.statCard, cursor: 'pointer' }} onClick={() => router.push('/grades/schedule')} {...staggerItem(1)}>
          <div style={S.statNum}>{animCourses}</div>
          <div style={S.statLabel}>Courses · {semesterLabel || 'This Semester'}</div>
        </motion.div>
        <motion.div className="ns-card" style={{ ...S.statCard, cursor: 'pointer' }} onClick={() => router.push('/planner')} {...staggerItem(2)}>
          <div style={S.statNum}>{animDueWeek}</div>
          <div style={S.statLabel}>Due This Week</div>
        </motion.div>
        <motion.div className="ns-card" style={{ ...S.statCard, cursor: 'pointer' }} onClick={() => router.push('/planner')} {...staggerItem(3)}>
          <div style={S.statNum}>{animPending}</div>
          <div style={S.statLabel}>Pending</div>
        </motion.div>
      </div>

      {/* Quick Access */}
      <div style={S.quickAccessWrap}>
        <p style={{ ...S.cardLabel, marginBottom: 12 }}>Quick Access</p>
        <div style={S.quickAccessRow}>
          {QUICK_LINKS.map((link, i) => (
            <motion.button
              key={link.href}
              className="ns-card"
              style={S.quickAccessCard}
              onClick={() => router.push(link.href)}
              {...staggerItem(4 + i)}
            >
              <div style={{ ...S.quickAccessIcon, background: link.iconBg }}>
                <span style={{ fontSize: 20 }}>{link.icon}</span>
              </div>
              <span style={S.quickAccessLabel}>{link.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* GPA Percentile Welcome Popup (one-time) */}
      {showGpaWelcome && createPortal(
        <div style={S.popupOverlay} onClick={() => setShowGpaWelcome(false)}>
          <div style={{ ...S.popupCard, textAlign: 'center' as const }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowGpaWelcome(false)} style={S.popupClose}>×</button>
            <div style={{ fontSize: 48, marginBottom: 14 }}>🎓</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: 'var(--text)', letterSpacing: '-0.5px' }}>
              Your GPA Rank
            </h3>
            {gpaPercentile !== null ? (
              <>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 10 }}>
                  {percentileStr(gpaPercentile)} Percentile
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                  Based on your {effectiveUGpa !== null ? `${effectiveUGpa.toFixed(2)} unweighted GPA` : 'GPA'}, you rank above the vast majority of Futurely students.
                </p>
                <div style={{ background: 'rgba(43,74,142,0.1)', border: '1px solid rgba(43,74,142,0.3)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.7px', marginBottom: 6 }}>
                    Your Daily Coin Bonus
                  </p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-blue)', marginBottom: 4 }}>
                    +{gpaBonusPct.toFixed(1)}% daily boost
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Applied to your daily coins · perfect GPA = +50%
                  </p>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                  Raise your GPA to unlock daily coin bonuses that stack on top of your daily earnings.
                </p>
                <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#EAB308', lineHeight: 1.5 }}>
                    Perfect GPA (4.0/5.0) → +50% on daily coins<br />Scales smoothly with both your GPAs
                  </p>
                </div>
              </>
            )}
            <button onClick={() => setShowGpaWelcome(false)} style={S.popupButton}>
              Got it! 🚀
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* HAC session expired / resync popup */}
      {showResyncPopup && createPortal(
        <div style={S.popupOverlay} onClick={() => setShowResyncPopup(false)}>
          <div style={S.popupCard} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowResyncPopup(false)} style={S.popupClose}>×</button>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{needsReconnect ? '🔗' : '🔄'}</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
              {needsReconnect ? 'Reconnect your school account' : 'Some school data didn\'t load'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              {needsReconnect
                ? 'Your saved school portal credentials couldn\'t be used to sign in — your password may have changed, or credentials weren\'t saved. Go to Settings to sign in again and everything will sync automatically.'
                : 'Your GPA loaded fine, but your course list couldn\'t be fetched — your school portal session may have expired mid-load. Hit "Re-sync" to reconnect and pull everything in together.'}
            </p>
            {resyncError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--error)' }}>
                {resyncError}
              </div>
            )}
            {needsReconnect ? (
              <button
                onClick={() => { setShowResyncPopup(false); router.push('/settings') }}
                style={S.popupButton}
              >
                Go to Settings to reconnect
              </button>
            ) : (
              <button
                onClick={handleResync}
                disabled={resyncing}
                style={{ ...S.popupButton, opacity: resyncing ? 0.7 : 1, cursor: resyncing ? 'not-allowed' : 'pointer' }}
              >
                {resyncing ? 'Syncing…' : 'Re-sync now'}
              </button>
            )}
            <button onClick={() => setShowResyncPopup(false)} style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', marginTop: 8 }}>
              Dismiss
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ── Connect school account modal (shown after OAuth sign-up) ── */}
      {showConnectModal && createPortal(
        <div style={S.popupOverlay} onClick={() => setShowConnectModal(false)}>
          <div style={S.popupCard} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowConnectModal(false)} style={S.popupClose}>×</button>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎓</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
              Connect your school account
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
              You haven&apos;t connected your HAC or Canvas accounts yet. Connect them to unlock your grades, assignments, AI study tools, and much more.
            </p>
            <button
              onClick={() => { setShowConnectModal(false); router.push('/settings') }}
              style={S.popupButton}
            >
              Connect my school account
            </button>
            <button
              onClick={() => setShowConnectModal(false)}
              style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', marginTop: 8 }}
            >
              Skip for now
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* AI bar */}
      <div style={S.aiBarWrap}>
        <p style={{ ...S.cardLabel, marginBottom: 10 }}>Ask Futurely AI</p>
        <AiBar />
      </div>

    </div>
  )
}

const gradientStyle: React.CSSProperties = {
  color: 'var(--primary)',
}

const S: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 },
  greeting:   { fontSize: 15, color: 'var(--text-secondary)', marginBottom: 4 },
  name:       { fontSize: 38, fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--text)' },
  dateChip:   { fontSize: 13, color: 'var(--primary)', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 20, padding: '6px 14px', marginTop: 4 },
  topRow:     { display: 'flex', gap: 20, marginBottom: 20 },
  card:       { padding: 28, marginBottom: 20 },
  cardLabel:  { fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' },
  gpaRow:     { display: 'flex', gap: 0, marginTop: 18, alignItems: 'center' },
  gpaBlock:   { flex: 1, textAlign: 'center' as const },
  gpaNum:     { fontSize: 48, fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1 },
  gpaTag:     { fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 },
  gpaDivider: { width: 1, height: 56, background: 'var(--border)', flexShrink: 0 },
  countPill:  { background: 'var(--error)', color: '#fff', borderRadius: 100, padding: '3px 10px', fontSize: 12, fontWeight: 700 },
  emptyMsg:   { color: 'var(--success)', fontSize: 15, fontStyle: 'italic' },
  dueRow:     { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  dueDot:     { width: 9, height: 9, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 },
  dueTitle:   { fontSize: 15, fontWeight: 500, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
  dueSub:     { fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 },
  dueTime:    { fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 },
  statsRow:   { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 },
  statCard:   { padding: '22px', textAlign: 'center' as const },
  statNum:    { fontSize: 34, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 6 },
  statLabel:  { fontSize: 13, color: 'var(--text-secondary)' },
  quickAccessWrap: { marginBottom: 20 },
  quickAccessRow:  { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 },
  quickAccessCard: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 14, textAlign: 'left' as const },
  quickAccessIcon: { width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  quickAccessLabel:{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' },
  aiBarWrap:  { paddingBottom: 24 },
  popupOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  popupCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, maxWidth: 380, width: '100%', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  popupClose: { position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', padding: 4, lineHeight: 1 },
  popupBenefit: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 10 },
  popupButton: { width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 16 },
  resyncBanner: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(154,124,48,0.3)', background: 'rgba(154,124,48,0.08)', color: 'var(--warning)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.1px' },
}
