'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { initWebAuth } from '../../../lib/authState'
import { api, type EducatorRequest } from '../../../lib/api'

type StatusFilter = 'PENDING' | 'APPROVED' | 'DENIED'

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'PENDING',  label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'DENIED',   label: 'Denied' },
]

export default function AdminEducatorRequestsPage() {
  const router = useRouter()
  const [checked, setChecked]     = useState(false)
  const [status, setStatus]       = useState<StatusFilter>('PENDING')
  const [requests, setRequests]   = useState<EducatorRequest[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [actioning, setActioning] = useState<Record<number, boolean>>({})

  useEffect(() => {
    void (async () => {
      const ok = await initWebAuth()
      if (!ok) { router.replace('/login'); return }
      const user = JSON.parse(localStorage.getItem('ns_user') ?? 'null') as { role?: string } | null
      if (user?.role !== 'ADMIN' && user?.role !== 'DEV') { router.replace('/dashboard'); return }
      setChecked(true)
    })()
  }, [router])

  useEffect(() => {
    if (!checked) return
    void loadRequests()
  }, [checked, status])

  async function loadRequests() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.adminEducatorRequests(status)
      setRequests(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id: number) {
    setActioning(prev => ({ ...prev, [id]: true }))
    try {
      await api.adminApproveEducatorRequest(id)
      setRequests(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve request')
    } finally {
      setActioning(prev => ({ ...prev, [id]: false }))
    }
  }

  async function handleDeny(id: number) {
    setActioning(prev => ({ ...prev, [id]: true }))
    try {
      await api.adminDenyEducatorRequest(id)
      setRequests(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to deny request')
    } finally {
      setActioning(prev => ({ ...prev, [id]: false }))
    }
  }

  if (!checked) return null

  return (
    <div className="fade-up" style={S.shell}>
      <div style={S.pageHeader}>
        <div>
          <h1 style={S.title}>Educator Role Requests</h1>
          <p style={S.subtitle}>Review and action teacher and counselor role requests</p>
        </div>
        <button
          className="ns-btn-ghost"
          style={{ fontSize: 13, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => void loadRequests()}
          disabled={loading}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          Refresh
        </button>
      </div>

      {/* Status tabs */}
      <div style={S.tabBar} role="tablist" aria-label="Request status filter">
        {STATUS_TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={status === t.id}
            style={{ ...S.tabBtn, ...(status === t.id ? S.tabBtnActive : {}) }}
            onClick={() => setStatus(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ marginTop: 24 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="ns-card" style={{ padding: 18, height: 72 }}>
                <div className="shimmer" style={{ width: '40%', height: 16, borderRadius: 6, marginBottom: 8 }} />
                <div className="shimmer" style={{ width: '60%', height: 13, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={S.errorBox}>{error}</div>
            <button className="ns-btn-primary" style={{ marginTop: 16 }} onClick={() => void loadRequests()}>Retry</button>
          </div>
        ) : requests.length === 0 ? (
          <div style={S.empty}>
            <div style={S.emptyIcon}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <p style={S.emptyTitle}>No {status.toLowerCase()} requests</p>
            <p style={S.emptySub}>
              {status === 'PENDING'
                ? 'All educator requests have been reviewed.'
                : `No ${status.toLowerCase()} requests to display.`}
            </p>
          </div>
        ) : (
          <div className="ns-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  {['Name', 'Email', 'Requested Role', 'Institution', 'Date Submitted', 'Actions'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={S.td}>
                      <span style={{ fontWeight: 600 }}>{r.user.name ?? '—'}</span>
                    </td>
                    <td style={{ ...S.td, color: 'var(--text-secondary)', fontSize: 13 }}>{r.user.email}</td>
                    <td style={S.td}>
                      <span style={r.requestedRole === 'TEACHER' ? S.badgeTeacher : S.badgeCounselor}>
                        {r.requestedRole === 'TEACHER' ? 'Teacher' : 'Counselor'}
                      </span>
                    </td>
                    <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{r.institution}</td>
                    <td style={{ ...S.td, color: 'var(--text-secondary)', fontSize: 13 }}>
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td style={S.td}>
                      {status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            style={S.approveBtn}
                            onClick={() => void handleApprove(r.id)}
                            disabled={actioning[r.id]}
                          >
                            {actioning[r.id] ? '…' : 'Approve'}
                          </button>
                          <button
                            style={S.denyBtn}
                            onClick={() => void handleDeny(r.id)}
                            disabled={actioning[r.id]}
                          >
                            {actioning[r.id] ? '…' : 'Deny'}
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          {r.status === 'APPROVED' ? 'Approved' : 'Denied'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  shell:       { maxWidth: 1100, margin: '0 auto' },
  pageHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title:       { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4 },
  subtitle:    { fontSize: 13, color: 'var(--text-secondary)' },
  tabBar:      { display: 'flex', gap: 2, borderBottom: '2px solid var(--border)' },
  tabBtn:      { background: 'none', border: 'none', borderBottom: '2px solid transparent', marginBottom: -2, padding: '10px 18px', fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer' },
  tabBtnActive: { color: 'var(--primary)', borderBottom: '2px solid var(--primary)', fontWeight: 700 },
  empty:       { textAlign: 'center', padding: '80px 0' },
  emptyIcon:   { width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' },
  emptyTitle:  { fontSize: 17, fontWeight: 700, marginBottom: 6 },
  emptySub:    { fontSize: 13, color: 'var(--text-secondary)' },
  th:          { textAlign: 'left' as const, padding: '10px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' },
  td:          { padding: '13px 16px', fontSize: 14, color: 'var(--text)', verticalAlign: 'middle' },
  approveBtn:  { height: 32, padding: '0 14px', fontSize: 13, fontWeight: 600, background: '#16a34a', color: '#FFFFFF', border: 'none', borderRadius: 7, cursor: 'pointer' },
  denyBtn:     { height: 32, padding: '0 14px', fontSize: 13, fontWeight: 600, background: 'transparent', color: '#dc2626', border: '1px solid #dc2626', borderRadius: 7, cursor: 'pointer' },
  badgeTeacher:  { display: 'inline-block', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: 'var(--primary)' },
  badgeCounselor: { display: 'inline-block', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: '#7c3aed' },
  errorBox:    { background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 16px', color: '#DC2626', fontSize: 13 },
}
