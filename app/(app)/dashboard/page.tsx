'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { api, type StudentData } from '../../../lib/api'
import AiBar from '../../../components/ui/AiBar'
import PageLoader from '../../../components/ui/PageLoader'
import CoinIcon from '../../../components/ui/CoinIcon'
import NotificationBell from '../../../components/ui/NotificationBell'

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

const STREAK_MILESTONES: Array<{ days: number; emoji: string; tag?: string; tagColor?: string; perk?: string; perkColor?: string }> = [
  { days: 3,   perk: 'Marketplace Access', perkColor: '#F97316', emoji: '🛒' },
  { days: 7,   tag: 'Novice',  tagColor: '#22C55E', emoji: '✅' },
  { days: 14,  tag: 'Pro',     tagColor: '#3B82F6', emoji: '⚡' },
  { days: 30,  tag: 'Veteran', tagColor: '#F97316', emoji: '🏅' },
  { days: 50,  tag: 'Legend',  tagColor: '#EC4899', emoji: '💎' },
  { days: 100, tag: 'GOAT',    tagColor: '#EAB308', emoji: '👑' },
]

function streakCoinBonus(streak: number, perDay = 5) {
  return Math.min(275, 30 + Math.max(0, streak - 1) * perDay)
}

function getNextMilestone(streak: number) {
  return STREAK_MILESTONES.find(m => m.days > streak) ?? null
}

// Normal CDF via Abramowitz & Stegun approximation
function normalCdf(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = z >= 0 ? 1 : -1
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + p * x)
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x)
  return 0.5 * (1 + sign * y)
}

// Returns GPA percentile (0–100) based on US national unweighted GPA distribution.
// Returns null if GPA is unavailable or either GPA < 3.0 (not qualified for bonus).
function computeGpaPercentile(ugpa: number | null, wgpa: number | null): number | null {
  if (ugpa === null && wgpa === null) return null
  if (ugpa !== null && ugpa < 3.0) return null
  if (wgpa !== null && wgpa < 3.0) return null
  const gpa = ugpa ?? wgpa!
  // US national unweighted GPA distribution: mean ≈ 2.96, sd ≈ 0.52
  const z = (gpa - 2.96) / 0.52
  return Math.min(99.99, Math.max(50.01, normalCdf(z) * 100))
}

// Extra coins earned per additional streak day based on GPA percentile
function gpaStreakIncrement(percentile: number | null): number {
  if (percentile === null) return 5
  if (percentile >= 99.99) return 15   // top 0.01%: 200% more than baseline
  if (percentile >= 99.9)  return 12
  if (percentile >= 99.0)  return 10
  if (percentile >= 97.0)  return 9
  if (percentile >= 95.0)  return 8
  if (percentile >= 90.0)  return 7
  if (percentile >= 75.0)  return 6
  return 5
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

const GRADE_COLOR: Record<string, string> = { A: 'var(--gc-a)', B: 'var(--gc-b)', C: 'var(--gc-c)', D: 'var(--gc-d)', F: 'var(--gc-f)' }
const gradeColor = (g: string) => GRADE_COLOR[g?.charAt(0).toUpperCase()] ?? 'var(--text-muted)'

function formatDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
function getTimeOfDay() {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}

const QUICK_LINKS = [
  { href: '/grades',  label: 'Grade Portal',   sub: 'Grades & GPA',        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2B4A8E" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, iconBg: 'rgba(43,74,142,0.09)' },
  { href: '/ai',      label: 'AI Chat',         sub: 'College guidance',     icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>, iconBg: 'rgba(45,106,79,0.08)' },
  { href: '/planner', label: 'Planner',         sub: 'Assignments & tasks',  icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8A6E2D" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, iconBg: 'rgba(138,110,45,0.09)' },
  { href: '/feed',    label: 'Study Feed',      sub: 'Connect with peers',   icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6A5A8A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>, iconBg: 'rgba(106,90,138,0.09)' },
  { href: '/colleges',label: 'Colleges',        sub: 'Track your college list', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C45A1A" strokeWidth="1.8" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, iconBg: 'rgba(196,90,26,0.09)' },
  { href: '/marketplace',label: 'Marketplace',   sub: 'Buy, sell & trade items', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8A5A2D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>, iconBg: 'rgba(138,90,45,0.09)' },
]

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData]         = useState<StudentData | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [portalUGpa, setPortalUGpa] = useState<number | null>(null)
  const [portalWGpa, setPortalWGpa] = useState<number | null>(null)
  const [courseCount, setCourseCount] = useState<number | null>(null)
  const [semesterLabel, setSemesterLabel] = useState<string>('')
  const [dayStreak, setDayStreak] = useState(0)
  const [coins, setCoins] = useState<number | null>(null)
  const [newlyAwardedTags, setNewlyAwardedTags] = useState<Array<{ tag: string; tagColor: string }>>([])
  const [showStreakPopup, setShowStreakPopup] = useState(false)
  const [streakMilestone, setStreakMilestone] = useState<typeof STREAK_MILESTONES[0] | null>(null)
  const [showResyncPopup, setShowResyncPopup] = useState(false)
  const [resyncing, setResyncing] = useState(false)
  const [resyncError, setResyncError] = useState<string | null>(null)
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [showGpaWelcome, setShowGpaWelcome] = useState(false)
  const [hideGpa, setHideGpa] = useState(false)
  const gpaNeedsResync = useRef(false)

  useEffect(() => {
    setHideGpa(localStorage.getItem('ns_hide_gpa') === '1')
  }, [])

  useEffect(() => {
    // Track day streak using user-specific localStorage keys so accounts
    // on the same device don't inherit each other's streak.
    const uid = (() => { try { return (JSON.parse(localStorage.getItem('ns_user') ?? 'null') as { id?: number } | null)?.id ?? 'anon' } catch { return 'anon' } })()
    const streakKey = `ns_streak_${uid}`
    const visitKey  = `ns_lastVisit_${uid}`

    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const lastVisit = localStorage.getItem(visitKey)
    const streak = parseInt(localStorage.getItem(streakKey) ?? '0', 10)

    let currentStreak = streak
    if (lastVisit === today) {
      setDayStreak(streak)
    } else if (lastVisit) {
      const lastDate = new Date(lastVisit)
      const todayDate = new Date(today)
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / 86400000)
      if (diffDays === 1) {
        currentStreak = streak + 1
        localStorage.setItem(streakKey, String(currentStreak))
        setDayStreak(currentStreak)
      } else {
        currentStreak = 1
        localStorage.setItem(streakKey, '1')
        setDayStreak(1)
      }
    } else {
      currentStreak = 1
      localStorage.setItem(streakKey, '1')
      setDayStreak(1)
    }
    localStorage.setItem(visitKey, today)

    // Show milestone celebration popup once per milestone
    if (lastVisit !== today) {
      const milestone = STREAK_MILESTONES.find(m => m.days === currentStreak)
      if (milestone) {
        const seenKey = `ns_milestone_seen_${uid}_${milestone.days}`
        if (!localStorage.getItem(seenKey)) {
          localStorage.setItem(seenKey, '1')
          setStreakMilestone(milestone)
        }
      }
    }

    // Claim daily coins + award any streak milestone tags
    if (currentStreak > 0) {
      api.streakReward(currentStreak)
        .then(r => { if (r.newTags?.length) setNewlyAwardedTags(r.newTags) })
        .catch(() => {})
    }
    api.marketplaceDailyClaim(currentStreak)
      .then(r => setCoins(r.coins))
      .catch(() => {})
    api.me().then(setData).catch(e => setError(e instanceof Error ? e.message : 'Failed'))
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
  const animStreak  = useCountUp(dayStreak, 500)
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
  const streakIncrement = gpaStreakIncrement(gpaPercentile)

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
              Some data didn't load · Re-sync
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
        <motion.div className="ns-card" style={{ ...S.statCard, cursor: 'pointer' }} onClick={() => setShowStreakPopup(true)} {...staggerItem(4)}>
          <div style={S.statNum}>{animStreak}</div>
          <div style={S.statLabel}>Day Streak 🔥</div>
          <div style={{ ...S.statSub, color: '#EAB308' }}><CoinIcon size={11} style={{ marginRight: 2 }} /> +{streakCoinBonus(dayStreak, streakIncrement)} today{streakIncrement > 5 ? ` ✦` : ''}</div>
          {(() => {
            const next = getNextMilestone(dayStreak)
            if (!next) return <div style={S.statSub} title="All streak rewards earned">👑 GOAT</div>
            return <div style={S.statSub}>Next: {next.days}d → {next.tag}</div>
          })()}
        </motion.div>
      </div>

      {/* Quick navigation */}
      <motion.p style={{ ...S.cardLabel, marginBottom: 14 }} {...staggerItem(5)}>Quick Access</motion.p>
      <div style={S.tilesGrid}>
        {QUICK_LINKS.map((tile, i) => (
          <motion.button key={tile.href} onClick={() => router.push(tile.href)} style={S.tile} {...staggerItem(6 + i)}>
            <div style={{ ...S.tileIcon, background: tile.iconBg }}>{tile.icon}</div>
            <div>
              <div style={S.tileTitle}>{tile.label}</div>
              <div style={S.tileSub}>{tile.sub}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
          </motion.button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Streak Milestone Celebration Popup */}
      {streakMilestone && (
        <div style={S.popupOverlay} onClick={() => setStreakMilestone(null)}>
          <div style={{ ...S.popupCard, textAlign: 'center' as const }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setStreakMilestone(null)} style={S.popupClose}>×</button>
            <div style={{ fontSize: 52, marginBottom: 14 }}>{streakMilestone.emoji}</div>
            <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, color: 'var(--text)', letterSpacing: '-0.5px' }}>
              {streakMilestone.days}-Day Streak!
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 18 }}>
              You&apos;ve logged in {streakMilestone.days} days in a row. That&apos;s dedication — keep it going!
            </p>
            <div style={{
              background: (streakMilestone.tagColor ?? streakMilestone.perkColor ?? '#22C55E') + '18',
              border: `1px solid ${(streakMilestone.tagColor ?? streakMilestone.perkColor ?? '#22C55E')}44`,
              borderRadius: 12, padding: '14px 18px', marginBottom: 20,
            }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.7px', marginBottom: 8 }}>
                You just unlocked
              </p>
              {streakMilestone.tag ? (
                <span style={{
                  display: 'inline-block',
                  fontSize: 16, fontWeight: 800,
                  color: '#fff',
                  background: streakMilestone.tagColor,
                  borderRadius: 8, padding: '4px 14px',
                }}>
                  {streakMilestone.tag}
                </span>
              ) : (
                <span style={{ fontSize: 16, fontWeight: 800, color: streakMilestone.perkColor }}>
                  {streakMilestone.perk}
                </span>
              )}
            </div>
            <button onClick={() => setStreakMilestone(null)} style={S.popupButton}>
              Let&apos;s go! 🚀
            </button>
          </div>
        </div>
      )}

      {/* Streak Popup */}
      {showStreakPopup && (
        <div style={S.popupOverlay} onClick={() => setShowStreakPopup(false)}>
          <div style={S.popupCard} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowStreakPopup(false)} style={S.popupClose}>×</button>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔥</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
              {dayStreak} Day Streak!
            </h3>
            <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#EAB308', fontWeight: 600, textAlign: 'center' as const }}>
              <CoinIcon size={13} style={{ marginRight: 4 }} /> +{streakCoinBonus(dayStreak, streakIncrement)} coins today · +{streakIncrement} more each extra day
            </div>

            {/* GPA Rank Section */}
            {gpaPercentile !== null ? (
              <div style={{ background: 'rgba(43,74,142,0.08)', border: '1px solid rgba(43,74,142,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.7px', color: 'var(--text-muted)', marginBottom: 5 }}>GPA Rank</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-blue)' }}>{percentileStr(gpaPercentile)} Percentile</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                    +{streakIncrement}/day{streakIncrement > 5 ? ` (+${streakIncrement - 5} bonus)` : ''}
                  </span>
                </div>
              </div>
            ) : effectiveUGpa !== null ? (
              <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '9px 14px', marginBottom: 10, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' as const }}>
                📚 GPA below 3.0 · Reach 3.0+ to unlock streak bonuses
              </div>
            ) : null}

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
              Start at +30 coins on day 1, and earn +{streakIncrement} more for every consecutive day. Log in every day to unlock exclusive tags too!
            </p>

            {newlyAwardedTags.length > 0 && (
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#22C55E', fontWeight: 600 }}>
                🎉 You just earned: {newlyAwardedTags.map(t => t.tag).join(', ')}!
              </div>
            )}

            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 10 }}>Tag Rewards</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {STREAK_MILESTONES.map(m => {
                const earned = dayStreak >= m.days
                const accentColor = m.tagColor ?? m.perkColor ?? '#6B7280'
                return (
                  <div key={m.days} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '9px 12px', borderRadius: 10,
                    background: earned ? 'var(--surface-2)' : 'transparent',
                    border: `1px solid ${earned ? accentColor + '44' : 'var(--border)'}`,
                    opacity: earned ? 1 : 0.6,
                  }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{earned ? m.emoji : '🔒'}</span>
                    <div style={{ flex: 1 }}>
                      {m.tag ? (
                        <span className={m.tag === 'GOD' ? 'tag-mythic' : m.tag === 'GOAT' ? 'tag-god' : ''} style={{
                          fontSize: 13, fontWeight: 700,
                          color: (m.tag === 'GOAT' || m.tag === 'GOD') ? undefined : '#fff',
                          background: (m.tag === 'GOAT' || m.tag === 'GOD') ? undefined : m.tagColor,
                          borderRadius: 6, padding: '2px 8px',
                          marginRight: 4,
                        }}>
                          {m.tag}
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>
                          {m.perk}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: m.tag ? 4 : 8 }}>
                        {m.days}d{!m.perk && <> · <CoinIcon size={11} style={{ margin: '0 2px' }} /> +{streakCoinBonus(m.days)}/day</>}
                      </span>
                    </div>
                    {earned && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: accentColor, background: accentColor + '22', borderRadius: 6, padding: '2px 7px' }}>Earned</span>
                    )}
                  </div>
                )
              })}
            </div>

            <button onClick={() => setShowStreakPopup(false)} style={S.popupButton}>
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* GPA Percentile Welcome Popup (one-time) */}
      {showGpaWelcome && (
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
                    Your Daily Streak Bonus
                  </p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-blue)', marginBottom: 4 }}>
                    +{streakIncrement} coins per streak day
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Average students earn +5/day{streakIncrement > 5 ? ` · You earn +${streakIncrement - 5} extra` : ''}
                  </p>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                  Maintain a 3.0+ GPA in both unweighted and weighted to unlock enhanced daily streak bonuses.
                </p>
                <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#EAB308', lineHeight: 1.5 }}>
                    Top 0.01% of students earn +15 coins/day<br />vs +5 for the average student
                  </p>
                </div>
              </>
            )}
            <button onClick={() => setShowGpaWelcome(false)} style={S.popupButton}>
              Got it! 🚀
            </button>
          </div>
        </div>
      )}

      {/* HAC session expired / resync popup */}
      {showResyncPopup && (
        <div style={S.popupOverlay} onClick={() => setShowResyncPopup(false)}>
          <div style={S.popupCard} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowResyncPopup(false)} style={S.popupClose}>×</button>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{needsReconnect ? '🔗' : '🔄'}</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
              {needsReconnect ? 'Reconnect your school account' : 'Some school data didn\'t load'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              {needsReconnect
                ? 'Your saved HAC credentials couldn\'t be used to sign in — your password may have changed, or credentials weren\'t saved. Go to Settings to sign in again and everything will sync automatically.'
                : 'Your GPA loaded fine, but your course list couldn\'t be fetched — your HAC session may have expired mid-load. Hit "Re-sync" to reconnect and pull everything in together.'}
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
                {resyncing ? 'Syncing…' : 'Re-sync with HAC'}
              </button>
            )}
            <button onClick={() => setShowResyncPopup(false)} style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', marginTop: 8 }}>
              Dismiss
            </button>
          </div>
        </div>
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
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  greeting:   { fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 },
  name:       { fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)' },
  dateChip:   { fontSize: 12, color: 'var(--primary)', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 20, padding: '5px 12px', marginTop: 4 },
  topRow:     { display: 'flex', gap: 16, marginBottom: 16 },
  card:       { padding: 20, marginBottom: 16 },
  cardLabel:  { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' },
  gpaRow:     { display: 'flex', gap: 0, marginTop: 14, alignItems: 'center' },
  gpaBlock:   { flex: 1, textAlign: 'center' as const },
  gpaNum:     { fontSize: 36, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1 },
  gpaTag:     { fontSize: 11, color: 'var(--text-secondary)', marginTop: 5 },
  gpaDivider: { width: 1, height: 44, background: 'var(--border)', flexShrink: 0 },
  countPill:  { background: 'var(--error)', color: '#fff', borderRadius: 100, padding: '2px 9px', fontSize: 11, fontWeight: 700 },
  emptyMsg:   { color: 'var(--success)', fontSize: 13, fontStyle: 'italic' },
  dueRow:     { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  dueDot:     { width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 },
  dueTitle:   { fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
  dueSub:     { fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 1 },
  dueTime:    { fontSize: 11.5, color: 'var(--text-muted)', flexShrink: 0 },
  statsRow:   { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 },
  statCard:   { padding: '16px', textAlign: 'center' as const },
  statNum:    { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4 },
  statLabel:  { fontSize: 11.5, color: 'var(--text-secondary)' },
  statSub:    { fontSize: 10, color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
  tilesGrid:  { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 },
  tile:       { display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color 0.15s' },
  tileIcon:   { width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tileTitle:  { fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 },
  tileSub:    { fontSize: 12, color: 'var(--text-secondary)' },
  aiBarWrap:  { paddingBottom: 20 },
  popupOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  popupCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, maxWidth: 380, width: '100%', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  popupClose: { position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', padding: 4, lineHeight: 1 },
  popupBenefit: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 10 },
  popupButton: { width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 16 },
  resyncBanner: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(154,124,48,0.3)', background: 'rgba(154,124,48,0.08)', color: 'var(--warning)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.1px' },
}
