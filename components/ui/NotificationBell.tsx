'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, AppNotification } from '../../lib/api'

// Module-level dedup set — shared across all instances so toasts fire only once
const _seen = new Set<number>()

interface Toast { id: string; notif: AppNotification }

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function senderFirst(notif: AppNotification): string {
  const raw = notif.sender.name
  if (!raw) return notif.sender.email.split('@')[0]
  if (raw.includes(',')) {
    const parts = raw.split(',')
    const given = parts[1]?.trim().split(' ')[0] ?? ''
    return given.charAt(0).toUpperCase() + given.slice(1).toLowerCase()
  }
  return raw.split(' ')[0]
}

interface Props {
  showToasts?: boolean
  collapsed?: boolean
}

export default function NotificationBell({ showToasts = false, collapsed = false }: Props) {
  const router = useRouter()
  const [notifs, setNotifs]       = useState<AppNotification[]>([])
  const [unread, setUnread]       = useState(0)
  const [showPanel, setShowPanel] = useState(false)
  const [toasts, setToasts]       = useState<Toast[]>([])
  const [panelPos, setPanelPos]   = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const bellRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const pushToast = useCallback((notif: AppNotification) => {
    if (!showToasts || _seen.has(notif.id)) return
    _seen.add(notif.id)
    const id = `${Date.now()}-${notif.id}`
    setToasts(prev => [...prev, { id, notif }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000)
  }, [showToasts])

  // WebSocket for real-time notifications
  useEffect(() => {
    const token = localStorage.getItem('ns_token')
    if (!token) return
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    const wsBase = process.env.NEXT_PUBLIC_WS_URL ?? apiUrl.replace(/^http/, 'ws')
    let ws: WebSocket, dead = false
    function connect() {
      if (dead) return
      ws = new WebSocket(wsBase)
      ws.onopen = () => ws.send(JSON.stringify({ type: 'AUTH', token }))
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as { event: string; data: AppNotification }
          if (msg.event === 'NOTIFICATION') {
            setNotifs(prev => [msg.data, ...prev])
            setUnread(c => c + 1)
            pushToast(msg.data)
          }
        } catch { /* ignore */ }
      }
      ws.onclose = () => { if (!dead) setTimeout(connect, 3000) }
    }
    connect()
    return () => { dead = true; ws?.close() }
  }, [pushToast])

  // Polling fallback every 30s
  useEffect(() => {
    const poll = async () => {
      try {
        const d = await api.getNotifications()
        setUnread(d.unreadCount)
        setNotifs(d.notifications)
        d.notifications.filter(n => !n.read && !_seen.has(n.id)).slice(0, 3).forEach(n => pushToast(n))
        d.notifications.forEach(n => _seen.add(n.id))
      } catch { /* ignore */ }
    }
    poll()
    const t = setInterval(poll, 30_000)
    return () => clearInterval(t)
  }, [pushToast])

  // Close panel on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current  && !bellRef.current.contains(e.target as Node)
      ) setShowPanel(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // Calculate fixed panel position from button rect (bypasses sidebar overflow:hidden)
  useEffect(() => {
    if (!showPanel || !bellRef.current) return
    const r = bellRef.current.getBoundingClientRect()
    const pW = 320, pH = 420
    const left = r.right + 8 + pW > window.innerWidth ? r.left - pW - 8 : r.right + 8
    const top  = r.bottom + 8 + pH > window.innerHeight ? Math.max(8, r.top - pH) : r.bottom + 8
    setPanelPos({ top, left })
  }, [showPanel])

  async function handleOpen() {
    setShowPanel(v => !v)
    if (!showPanel && unread > 0) {
      setUnread(0)
      setNotifs(prev => prev.map(n => ({ ...n, read: true })))
      await api.markAllNotificationsRead().catch(() => null)
    }
  }

  return (
    <>
      {/* Bell button */}
      <div style={{ position: 'relative' }}>
        <button
          ref={bellRef}
          onClick={handleOpen}
          title="Notifications"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : undefined,
            gap: collapsed ? 0 : 8, padding: '8px 12px',
            borderRadius: 8, color: 'var(--text-secondary)', width: '100%',
          }}
        >
          <span style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            {unread > 0 && (
              <span style={{ position: 'absolute', top: -5, right: -6, background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 99, minWidth: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1 }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </span>
          {!collapsed && (
            <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden' }}>
              Notifications
            </span>
          )}
        </button>
      </div>

      {/* Panel — position:fixed so it's never clipped by parent overflow */}
      {showPanel && (
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: panelPos.top, left: panelPos.left, width: 320, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 1000, overflow: 'hidden' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Notifications</span>
            {notifs.some(n => !n.read) && (
              <button style={{ fontSize: 11.5, color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }} onClick={async () => {
                setUnread(0)
                setNotifs(prev => prev.map(n => ({ ...n, read: true })))
                await api.markAllNotificationsRead().catch(() => null)
              }}>Mark all read</button>
            )}
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifs.length === 0
              ? <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No notifications yet</div>
              : notifs.map(n => {
                const name = senderFirst(n)
                const icon = n.type === 'FOLLOW' ? '👤' : n.type === 'LIKE' ? '❤️' : n.type === 'GIVEAWAY_WIN' ? '🎉' : n.type === 'LISTING_SOLD' ? '🏷️' : n.type.startsWith('TRADE') ? '🔄' : n.type === 'ASSIGNMENT_CREATED' ? '📚' : '💬'
                const link = (label: React.ReactNode) => (
                  <b onClick={() => { setShowPanel(false); router.push('/feed') }} style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 700 }}>{label}</b>
                )
                let body: React.ReactNode
                if (n.type === 'FOLLOW')           body = <>{link(name)} started following you</>
                else if (n.type === 'LIKE')        body = <>{link(name)} liked your post</>
                else if (n.type === 'COMMENT')     body = n.preview ? <>{link(name)}: &quot;{n.preview}&quot;</> : <>{link(name)} commented</>
                else if (n.type === 'GIVEAWAY_WIN') body = n.preview ?? 'You won a giveaway!'
                else if (n.type === 'LISTING_SOLD') body = <>{link(name)} bought your listing</>
                else if (n.type === 'TRADE_OFFER')    body = <>{link(name)} sent a trade offer</>
                else if (n.type === 'TRADE_ACCEPTED') body = <>{link(name)} accepted your trade</>
                else if (n.type === 'TRADE_DECLINED')    body = <>{link(name)} declined your trade</>
                else if (n.type === 'ASSIGNMENT_CREATED') body = n.preview ?? 'New assignment added'
                else body = n.preview ?? 'New notification'
                return (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: n.read ? 'transparent' : 'rgba(75,110,255,0.07)' }}>
                    <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{body}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{timeAgo(n.createdAt)}</div>
                    </div>
                    {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, alignSelf: 'center' }} />}
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Global toast stack — only rendered by the instance with showToasts=true */}
      {showToasts && (
        <div style={{ position: 'fixed', bottom: 24, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none', maxWidth: 360, width: 'calc(100vw - 32px)' }}>
          {toasts.map(t => {
            const name = senderFirst(t.notif)
            const { emoji, accent, text } = (() => {
              switch (t.notif.type) {
                case 'LIKE':             return { emoji: '❤️', accent: '#EF4444', text: `${name} liked your post` }
                case 'COMMENT':          return { emoji: '💬', accent: '#3B82F6', text: `${name} commented on your post` }
                case 'FOLLOW':           return { emoji: '👤', accent: '#00C896', text: `${name} started following you` }
                case 'GIVEAWAY_WIN':     return { emoji: '🎉', accent: '#EAB308', text: t.notif.preview ?? 'You won a giveaway!' }
                case 'TRADE_OFFER':      return { emoji: '🔄', accent: '#8B5CF6', text: `${name} sent you a trade offer` }
                case 'TRADE_ACCEPTED':   return { emoji: '✅', accent: '#22C55E', text: `${name} accepted your trade` }
                case 'TRADE_DECLINED':   return { emoji: '❌', accent: '#EF4444', text: `${name} declined your trade` }
                case 'LISTING_SOLD':        return { emoji: '💰', accent: '#EAB308', text: `Your listing sold — ${t.notif.preview ?? ''}` }
                case 'ASSIGNMENT_CREATED':  return { emoji: '📚', accent: '#6366F1', text: t.notif.preview ?? 'New assignment added' }
                default:                    return { emoji: '🔔', accent: 'var(--primary)', text: t.notif.preview ?? 'New notification' }
              }
            })()
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `4px solid ${accent}`, borderRadius: 12, padding: '13px 14px', boxShadow: '0 6px 24px rgba(0,0,0,0.4)', pointerEvents: 'auto', animation: 'fadeUp 0.2s ease' }}>
                <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{text}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{timeAgo(t.notif.createdAt)}</div>
                </div>
                <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1, flexShrink: 0, padding: '0 0 0 4px', pointerEvents: 'auto' }} onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>×</button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
