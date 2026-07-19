'use client'

import React from 'react'
import { useEffect, useState } from 'react'
import { api, FeedUserProfile } from '@/lib/api'
import VerifiedBadge from './VerifiedBadge'
import CoinIcon from './CoinIcon'
import { TrashIcon, LockOpenIcon, CheckIcon } from '@/components/icons'

export function DevAdminPanel({
  profile, userId, currentUserId, onUpdateTag, onUpdateBan, onUpdateMute, onUpdateRole, onDeleted,
}: {
  profile: FeedUserProfile
  userId: number
  currentUserId: number
  onUpdateTag: (u: { tag: string | null; tagColor: string | null; allTags?: Array<{ tag: string; tagColor: string }> }) => void
  onUpdateBan: (banned: boolean) => void
  onUpdateMute: (mutedUntil: string | null) => void
  onUpdateRole: (role: string) => void
  onDeleted: () => void
}) {
  const [localTag, setLocalTag] = useState('')
  const [localColor, setLocalColor] = useState('')
  const [saving, setSaving] = useState(false)
  const [removingTag, setRemovingTag] = useState<string | null>(null)
  const [muteMinutes, setMuteMinutes] = useState('60')
  const [muteSaving, setMuteSaving] = useState(false)
  const [roleSaving, setRoleSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [myTag, setMyTag] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [myAllTags, setMyAllTags] = useState<Array<{ tag: string; tagColor: string }>>([])
  const [devStats, setDevStats] = useState<{ totalCoins: number; totalInventoryValue: number; userCount: number } | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [coinAmount, setCoinAmount] = useState('')
  const [coinSaving, setCoinSaving] = useState(false)
  const [coinError, setCoinError] = useState('')
  const [targetCoins, setTargetCoins] = useState<number | null>(profile.coins ?? null)
  const [marketGranting, setMarketGranting] = useState(false)
  const [marketGrantMsg, setMarketGrantMsg] = useState('')
  const [dobStatus, setDobStatus] = useState<{ accountStatus: string; dobCorrectionAttempts: number; bannedUntilDate: string | null; hasSchoolRecord: boolean } | null>(null)
  const [dobStatusLoading, setDobStatusLoading] = useState(false)
  const [dobActionSaving, setDobActionSaving] = useState(false)
  const [dobActionMsg, setDobActionMsg] = useState('')

  useEffect(() => {
    api.feedUserProfile(currentUserId).then((p) => { setMyRole(p.role); setMyTag(p.tag); setMyAllTags(p.allTags ?? []) }).catch(() => {})
  }, [currentUserId])

  const canManage = myRole === 'ADMIN' || myTag === 'DEV' || myAllTags.some(t => t.tag === 'DEV')
  const isOwnProfile = userId === currentUserId

  useEffect(() => {
    if (!canManage || !isOwnProfile) return
    setStatsLoading(true)
    api.feedDevStats().then(d => { setDevStats(d); setStatsLoading(false) }).catch(() => setStatsLoading(false))
  }, [canManage, isOwnProfile])

  useEffect(() => {
    if (!canManage || isOwnProfile) return
    setDobStatusLoading(true)
    api.adminGetDobStatus(userId).then(setDobStatus).catch(() => setDobStatus(null)).finally(() => setDobStatusLoading(false))
  }, [canManage, isOwnProfile, userId])

  async function handleResetDobAttempts() {
    if (dobActionSaving) return
    setDobActionSaving(true)
    setDobActionMsg('')
    try {
      const result = await api.adminResetDobAttempts(userId)
      setDobStatus(prev => prev ? { ...prev, dobCorrectionAttempts: result.dobCorrectionAttempts } : prev)
      setDobActionMsg('✓ Attempts reset')
    } catch {
      setDobActionMsg('Failed')
    } finally {
      setDobActionSaving(false)
    }
  }

  async function handleForceActivate() {
    if (dobActionSaving) return
    if (!confirm('Force this account ACTIVE without re-verifying their birthday? Only do this for a confirmed false positive.')) return
    setDobActionSaving(true)
    setDobActionMsg('')
    try {
      const result = await api.adminForceActivateAccount(userId)
      setDobStatus(prev => prev
        ? { ...prev, accountStatus: result.accountStatus, bannedUntilDate: result.bannedUntilDate, dobCorrectionAttempts: result.dobCorrectionAttempts }
        : prev)
      setDobActionMsg('✓ Account activated')
    } catch {
      setDobActionMsg('Failed')
    } finally {
      setDobActionSaving(false)
    }
  }

  if (!canManage) return null

  async function handleSetTag() {
    if (!localTag.trim() || saving) return
    setSaving(true)
    try {
      const updated = await api.feedAwardTag(userId, localTag.trim(), localColor.trim() || undefined)
      onUpdateTag(updated)
      setLocalTag('')
      setLocalColor('')
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  async function handleRemoveTag(tagName: string) {
    if (removingTag) return
    setRemovingTag(tagName)
    try {
      const updated = await api.feedRemoveTagFromUser(userId, tagName)
      onUpdateTag(updated)
    } catch { /* ignore */ }
    finally { setRemovingTag(null) }
  }

  async function handleResetTag() {
    if (saving) return
    setSaving(true)
    try {
      const updated = await api.feedResetTag(userId)
      onUpdateTag(updated)
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  async function handleToggleBan() {
    setSaving(true)
    try {
      const result = await api.feedBanUser(userId, !profile.chatBanned)
      onUpdateBan(result.banned)
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  async function handleDeleteAccount() {
    if (deleting) return
    if (!confirm(`Permanently delete this account? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await api.feedDeleteUser(userId)
      onDeleted()
    } catch { /* ignore */ }
    finally { setDeleting(false) }
  }

  async function handleMute() {
    const mins = parseInt(muteMinutes)
    if (isNaN(mins) || muteSaving) return
    setMuteSaving(true)
    try {
      const result = await api.feedMuteUser(userId, mins > 0 ? mins : null)
      onUpdateMute(result.mutedUntil)
    } catch { /* ignore */ }
    finally { setMuteSaving(false) }
  }

  async function handleUnmute() {
    if (muteSaving) return
    setMuteSaving(true)
    try {
      const result = await api.feedMuteUser(userId, null)
      onUpdateMute(result.mutedUntil)
    } catch { /* ignore */ }
    finally { setMuteSaving(false) }
  }

  async function handleSetRole(role: string) {
    if (roleSaving) return
    setRoleSaving(true)
    try {
      const result = await api.feedSetUserRole(userId, role)
      onUpdateRole(result.role)
    } catch { /* ignore */ }
    finally { setRoleSaving(false) }
  }

  async function handleQuickGrantTag(tag: string, color: string) {
    if (saving) return
    setSaving(true)
    try {
      const updated = await api.feedAwardTag(userId, tag, color)
      onUpdateTag(updated)
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  async function handleCoinAction(action: 'add' | 'remove' | 'zero') {
    if (coinSaving) return
    const amount = action === 'zero' ? 0 : parseInt(coinAmount)
    if (action !== 'zero' && (isNaN(amount) || amount <= 0)) return
    if (action === 'add' && amount > 10_000 && isOwnProfile) { setCoinError('Single add cannot exceed 10,000 coins (daily limit).'); return }
    setCoinSaving(true)
    setCoinError('')
    try {
      const result = await api.feedAdjustCoins(userId, action, action !== 'zero' ? amount : undefined)
      setTargetCoins(result.coins)
      if (action !== 'zero') setCoinAmount('')
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? ''
      setCoinError(msg || 'Failed to adjust coins')
    }
    finally { setCoinSaving(false) }
  }

  const isMutedTarget = profile.chatMutedUntil != null && new Date(profile.chatMutedUntil) > new Date()
  const allTags = Array.from(new Map((profile.allTags ?? []).map(t => [t.tag, t])).values())
  const hasDevTag = allTags.some(t => t.tag === 'DEV')
  const hasModTag = allTags.some(t => t.tag === 'MOD')
  const isAdmin = profile.role === 'ADMIN'

  return (
    <div style={{ background: 'rgba(255,200,50,0.06)', border: '1px solid rgba(255,200,50,0.2)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#ffc832', marginBottom: 10 }}>DEV — {isOwnProfile ? 'Platform Console' : 'Manage User'}</p>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>PLATFORM STATS</p>
      {statsLoading ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Loading…</p>
      ) : devStats ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 120, background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 6, padding: '8px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>TOTAL COINS IN CIRCULATION</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>{devStats.totalCoins.toLocaleString()} <CoinIcon size={16}/></div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{devStats.userCount} active users</div>
          </div>
          <div style={{ flex: 1, minWidth: 120, background: 'rgba(43,74,142,0.08)', border: '1px solid rgba(43,74,142,0.2)', borderRadius: 6, padding: '8px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>TOTAL INVENTORY VALUE</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 4 }}>{devStats.totalInventoryValue.toLocaleString()} <CoinIcon size={16}/></div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>combined across all users</div>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Stats unavailable</p>
      )}

      {!isOwnProfile && (<>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>PRIVILEGES</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center', marginBottom: 10 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
          background: isAdmin ? 'rgba(239,68,68,0.15)' : 'rgba(128,128,128,0.12)',
          color: isAdmin ? '#EF4444' : 'var(--text-secondary)',
          border: `1px solid ${isAdmin ? '#EF4444' : 'rgba(128,128,128,0.4)'}`,
        }}>
          {isAdmin ? 'ADMIN' : 'STUDENT'}
        </span>
        {!isAdmin ? (
          <button
            style={{ background: '#EF4444', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
            onClick={() => void handleSetRole('ADMIN')}
            disabled={roleSaving}
          >{roleSaving ? '…' : 'Grant Admin'}</button>
        ) : (
          <button
            style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid #EF4444', borderRadius: 6, padding: '4px 10px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
            onClick={() => void handleSetRole('STUDENT')}
            disabled={roleSaving}
          >{roleSaving ? '…' : 'Revoke Admin'}</button>
        )}
        {!hasDevTag ? (
          <button
            style={{ background: 'rgba(173,216,230,0.15)', color: 'lightblue', border: '1px solid lightblue', borderRadius: 6, padding: '4px 10px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
            onClick={() => void handleQuickGrantTag('DEV', 'lightblue')}
            disabled={saving}
          >+ DEV</button>
        ) : (
          <button
            style={{ background: 'rgba(173,216,230,0.15)', color: 'lightblue', border: '1px solid lightblue', borderRadius: 6, padding: '4px 10px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
            onClick={() => void handleRemoveTag('DEV')}
            disabled={!!removingTag}
          >− DEV</button>
        )}
        {!hasModTag ? (
          <button
            style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid #a78bfa', borderRadius: 6, padding: '4px 10px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
            onClick={() => void handleQuickGrantTag('MOD', '#a78bfa')}
            disabled={saving}
          >+ MOD</button>
        ) : (
          <button
            style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid #a78bfa', borderRadius: 6, padding: '4px 10px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
            onClick={() => void handleRemoveTag('MOD')}
            disabled={!!removingTag}
          >− MOD</button>
        )}
      </div>

      {allTags.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>AWARDED TAGS</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
            {allTags.map(t => {
              const isVerified = t.tagColor === 'verified-yellow' || t.tagColor === 'verified-blue'
              return (
                <div key={`${t.tag}:${t.tagColor}`} style={{ display: 'flex', alignItems: 'center', gap: 4, background: isVerified ? 'rgba(128,128,128,0.12)' : t.tagColor === 'grey' ? 'rgba(128,128,128,0.12)' : t.tagColor === 'curse' ? 'rgba(255,0,0,0.08)' : `${t.tagColor}22`, border: `1px solid ${isVerified ? (t.tagColor === 'verified-yellow' ? '#EAB308' : '#1D9BF0') : t.tagColor === 'grey' ? 'rgba(128,128,128,0.4)' : t.tagColor === 'curse' ? '#ff0000' : t.tagColor}`, borderRadius: 4, padding: '2px 6px 2px 8px' }}>
                  {isVerified
                    ? <VerifiedBadge variant={t.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} size={16} />
                    : <span className={t.tagColor === 'curse' ? 'tag-curse' : ''} style={{ fontSize: 11, fontWeight: 700, color: t.tagColor === 'grey' ? 'var(--text-secondary)' : t.tagColor === 'curse' ? undefined : t.tagColor }}>{t.tag}</span>
                  }
                  <button
                    style={{ background: 'none', border: 'none', padding: '0 0 0 2px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center' }}
                    onClick={() => void handleRemoveTag(t.tag)}
                    disabled={!!removingTag}
                    title={`Remove ${t.tag} tag`}
                  >×</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>AWARD TAG</p>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 10 }}>
        <input className="ns-input" style={{ flex: 1, minWidth: 80, height: 34, fontSize: 12 }} placeholder="Tag (VIP, MOD…)" value={localTag} onChange={e => setLocalTag(e.target.value)} />
        <input className="ns-input" style={{ width: 80, height: 34, fontSize: 12 }} placeholder="Color" value={localColor} onChange={e => setLocalColor(e.target.value)} />
        <button style={{ background: '#ffc832', color: '#000', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }} onClick={handleSetTag} disabled={saving}>{saving ? '…' : 'Award'}</button>
        <button className="ns-btn-ghost" style={{ height: 34, padding: '0 10px', fontSize: 12 }} onClick={handleResetTag} disabled={saving}>Reset All</button>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>MUTE</p>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 10 }}>
        <select className="ns-input" style={{ flex: 1, height: 34, fontSize: 12 }} value={muteMinutes} onChange={e => setMuteMinutes(e.target.value)}>
          <option value="5">5 minutes</option>
          <option value="60">1 hour</option>
          <option value="1440">1 day</option>
          <option value="10080">1 week</option>
          <option value="525600">1 year (perm)</option>
        </select>
        <button style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }} onClick={handleMute} disabled={muteSaving}>{muteSaving ? '…' : 'Mute'}</button>
        {isMutedTarget && (
          <button className="ns-btn-ghost" style={{ height: 34, padding: '0 10px', fontSize: 12 }} onClick={handleUnmute} disabled={muteSaving}>Unmute</button>
        )}
      </div>
      {isMutedTarget && (
        <p style={{ fontSize: 11, color: '#f97316', marginBottom: 8 }}>
          Muted until {new Date(profile.chatMutedUntil!).toLocaleString()}
        </p>
      )}

      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>CHAT BAN</p>
      <button
        style={{ width: '100%', border: 'none', borderRadius: 6, padding: '8px 0', fontWeight: 700, fontSize: 12, cursor: 'pointer', background: profile.chatBanned ? '#22C55E' : '#EF4444', color: '#fff' }}
        onClick={handleToggleBan}
        disabled={saving}
      >
        {profile.chatBanned ? 'Unban from Chat' : 'Ban from Chat'}
      </button>
      {profile.chatBanned && (
        <p style={{ fontSize: 11, color: '#EF4444', marginTop: 6 }}>This user is banned from posting.</p>
      )}

      {profile.chatBanned && (
        <div style={{ marginTop: 12, borderTop: '1px solid rgba(239,68,68,0.2)', paddingTop: 12 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>DANGER ZONE</p>
          <button
            style={{ width: '100%', border: '1px solid #7f1d1d', borderRadius: 6, padding: '8px 0', fontWeight: 700, fontSize: 12, cursor: deleting ? 'default' : 'pointer', background: '#450a0a', color: '#fca5a5', opacity: deleting ? 0.6 : 1 }}
            onClick={() => void handleDeleteAccount()}
            disabled={deleting}
          ><>{deleting ? 'Deleting…' : <><TrashIcon size={13}/> Delete Account Permanently</>}</></button>
        </div>
      )}

      <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,200,50,0.15)', paddingTop: 12 }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
          COINS — current balance: <span style={{ color: '#ffc832', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3 }}>{targetCoins ?? '…'} <CoinIcon size={13}/></span>
        </p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const }}>
          <input
            className="ns-input"
            style={{ flex: 1, minWidth: 80, height: 34, fontSize: 12 }}
            type="number"
            min="0"
            max={isOwnProfile ? 10000 : undefined}
            placeholder={isOwnProfile ? 'Amount (max 10k/day)' : 'Amount'}
            value={coinAmount}
            onChange={e => setCoinAmount(e.target.value)}
          />
          <button style={{ background: '#22C55E', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }} onClick={() => void handleCoinAction('add')} disabled={coinSaving}>{coinSaving ? '…' : '+ Add'}</button>
          <button style={{ background: '#EF4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }} onClick={() => void handleCoinAction('remove')} disabled={coinSaving}>{coinSaving ? '…' : '− Remove'}</button>
          <button style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid #EF4444', borderRadius: 6, padding: '6px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }} onClick={() => void handleCoinAction('zero')} disabled={coinSaving}>{coinSaving ? '…' : 'Set 0'}</button>
        </div>
        {coinError && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 6, fontWeight: 600 }}>{coinError}</p>}
      </div>

      <div style={{ marginTop: 12, borderTop: '1px solid rgba(59,130,246,0.2)', paddingTop: 12 }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>DOB VERIFICATION / COPPA LOCK</p>
        {dobStatusLoading ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</p>
        ) : !dobStatus ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Status unavailable</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center', marginBottom: 8 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                background: dobStatus.accountStatus === 'ACTIVE' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: dobStatus.accountStatus === 'ACTIVE' ? '#22C55E' : '#EF4444',
                border: `1px solid ${dobStatus.accountStatus === 'ACTIVE' ? '#22C55E' : '#EF4444'}`,
              }}>
                {dobStatus.accountStatus}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {dobStatus.dobCorrectionAttempts}/3 correction attempts used
                {' · '}{dobStatus.hasSchoolRecord ? 'school record on file' : 'no school record yet'}
              </span>
            </div>
            {dobStatus.bannedUntilDate && (
              <p style={{ fontSize: 11, color: '#EF4444', marginBottom: 8 }}>
                Banned until {new Date(dobStatus.bannedUntilDate).toLocaleDateString()}
              </p>
            )}
            {dobStatus.accountStatus !== 'ACTIVE' && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                <button
                  style={{ background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: dobActionSaving ? 'not-allowed' : 'pointer', opacity: dobActionSaving ? 0.6 : 1 }}
                  onClick={() => void handleResetDobAttempts()}
                  disabled={dobActionSaving}
                  title="Gives the user 3 more correction attempts — they still have to enter a birthday that actually matches their school record."
                >{dobActionSaving ? '…' : 'Reset Attempts'}</button>
                <button
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid #EF4444', borderRadius: 6, padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: dobActionSaving ? 'not-allowed' : 'pointer', opacity: dobActionSaving ? 0.6 : 1 }}
                  onClick={() => void handleForceActivate()}
                  disabled={dobActionSaving}
                  title="Danger zone: bypasses verification entirely and activates the account without checking the birthday. Only for a confirmed false positive."
                >{dobActionSaving ? '…' : 'Force Activate'}</button>
              </div>
            )}
            {dobActionMsg && <span style={{ fontSize: 11, color: dobActionMsg.startsWith('✓') ? '#22C55E' : '#EF4444', fontWeight: 600, marginTop: 6, display: 'block' }}>{dobActionMsg}</span>}
          </>
        )}
      </div>

      <div style={{ marginTop: 12, borderTop: '1px solid rgba(34,197,94,0.15)', paddingTop: 12 }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>MARKETPLACE ACCESS</p>
        <button
          style={{ background: '#22C55E', color: '#000', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: marketGranting ? 'not-allowed' : 'pointer', opacity: marketGranting ? 0.6 : 1 }}
          onClick={async () => {
            setMarketGranting(true); setMarketGrantMsg('')
            try { await api.adminGrantMarketAccess(userId); setMarketGrantMsg('✓ Granted') }
            catch { setMarketGrantMsg('Failed') }
            finally { setMarketGranting(false) }
          }}
          disabled={marketGranting}
        >{marketGranting ? '…' : <><LockOpenIcon size={13}/> Grant Market Access</>}</button>
        {marketGrantMsg && <span style={{ fontSize: 11, color: marketGrantMsg.startsWith('✓') ? '#22C55E' : '#EF4444', fontWeight: 600, marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 3 }}>{marketGrantMsg.startsWith('✓') && <CheckIcon size={11} color='#22C55E'/>}{marketGrantMsg.startsWith('✓') ? marketGrantMsg.slice(2) : marketGrantMsg}</span>}
      </div>

      </>)}
    </div>
  )
}

export function ModPanel({ userId, currentUserId, profile, onUpdateMute }: {
  userId: number
  currentUserId: number
  profile: FeedUserProfile
  onUpdateMute: (mutedUntil: string | null) => void
}) {
  const [myAllTags, setMyAllTags] = useState<Array<{ tag: string; tagColor: string }>>([])
  const [muteMinutes, setMuteMinutes] = useState('60')
  const [muteSaving, setMuteSaving] = useState(false)

  useEffect(() => {
    api.feedUserProfile(currentUserId).then(p => setMyAllTags(p.allTags ?? [])).catch(() => {})
  }, [currentUserId])

  const isMod = myAllTags.some(t => t.tag === 'MOD')
  const isDevOrAdmin = myAllTags.some(t => t.tag === 'DEV')
  if (!isMod || isDevOrAdmin || userId === currentUserId) return null

  const isMutedTarget = !!profile.chatMutedUntil && new Date(profile.chatMutedUntil) > new Date()

  async function handleMute() {
    const mins = parseInt(muteMinutes)
    if (isNaN(mins) || muteSaving) return
    setMuteSaving(true)
    try {
      const result = await api.feedMuteUser(userId, mins > 0 ? mins : null)
      onUpdateMute(result.mutedUntil)
    } catch { /* ignore */ }
    finally { setMuteSaving(false) }
  }

  async function handleUnmute() {
    if (muteSaving) return
    setMuteSaving(true)
    try {
      const result = await api.feedMuteUser(userId, null)
      onUpdateMute(result.mutedUntil)
    } catch { /* ignore */ }
    finally { setMuteSaving(false) }
  }

  return (
    <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', marginBottom: 10 }}>MOD — Moderation</p>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>MUTE (max 24h)</p>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const }}>
        <select className="ns-input" style={{ flex: 1, height: 34, fontSize: 12 }} value={muteMinutes} onChange={e => setMuteMinutes(e.target.value)}>
          <option value="5">5 minutes</option>
          <option value="60">1 hour</option>
          <option value="1440">1 day (max)</option>
        </select>
        <button style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }} onClick={handleMute} disabled={muteSaving}>
          {muteSaving ? '…' : 'Mute'}
        </button>
        {isMutedTarget && (
          <button className="ns-btn-ghost" style={{ height: 34, padding: '0 10px', fontSize: 12 }} onClick={handleUnmute} disabled={muteSaving}>
            Unmute
          </button>
        )}
      </div>
    </div>
  )
}
