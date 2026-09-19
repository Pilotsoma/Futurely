'use client'

import React from 'react'
import { useEffect, useState } from 'react'
import { api, FeedUserProfile } from '@/lib/api'
import { TrashIcon } from '@/components/icons'

export function DevAdminPanel({
  profile, userId, currentUserId, onUpdateBan, onUpdateMute, onUpdateRole, onDeleted, onUpdateTag,
}: {
  profile: FeedUserProfile
  userId: number
  currentUserId: number
  onUpdateBan: (banned: boolean) => void
  onUpdateMute: (mutedUntil: string | null) => void
  onUpdateRole: (role: string) => void
  onDeleted: () => void
  onUpdateTag?: (u: { tag: string | null; tagColor: string | null; allTags: Array<{ tag: string; tagColor: string }> }) => void
}) {
  const [saving, setSaving] = useState(false)
  const [muteMinutes, setMuteMinutes] = useState('60')
  const [muteSaving, setMuteSaving] = useState(false)
  const [roleSaving, setRoleSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [dobStatus, setDobStatus] = useState<{ accountStatus: string; dobCorrectionAttempts: number; bannedUntilDate: string | null; hasSchoolRecord: boolean } | null>(null)
  const [dobStatusLoading, setDobStatusLoading] = useState(false)
  const [dobActionSaving, setDobActionSaving] = useState(false)
  const [dobActionMsg, setDobActionMsg] = useState('')

  useEffect(() => {
    api.feedUserProfile(currentUserId).then((p) => { setMyRole(p.role) }).catch(() => {})
  }, [currentUserId])

  const canManage = myRole === 'ADMIN' || myRole === 'DEV'
  const isOwnProfile = userId === currentUserId

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

  const isMutedTarget = profile.chatMutedUntil != null && new Date(profile.chatMutedUntil) > new Date()
  const isAdmin = profile.role === 'ADMIN'
  const isModerator = profile.role === 'MODERATOR'

  return (
    <div style={{ background: 'rgba(255,200,50,0.06)', border: '1px solid rgba(255,200,50,0.2)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#ffc832', marginBottom: 10 }}>DEV — {isOwnProfile ? 'Platform Console' : 'Manage User'}</p>

      {!isOwnProfile && (<>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>PRIVILEGES</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center', marginBottom: 10 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
          background: isAdmin ? 'rgba(239,68,68,0.15)' : isModerator ? 'rgba(167,139,250,0.15)' : 'rgba(128,128,128,0.12)',
          color: isAdmin ? '#EF4444' : isModerator ? '#a78bfa' : 'var(--text-secondary)',
          border: `1px solid ${isAdmin ? '#EF4444' : isModerator ? '#a78bfa' : 'rgba(128,128,128,0.4)'}`,
        }}>
          {isAdmin ? 'ADMIN' : isModerator ? 'MODERATOR' : 'STUDENT'}
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
        {!isModerator && !isAdmin ? (
          <button
            style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid #a78bfa', borderRadius: 6, padding: '4px 10px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
            onClick={() => void handleSetRole('MODERATOR')}
            disabled={roleSaving}
          >{roleSaving ? '…' : '+ Moderator'}</button>
        ) : isModerator ? (
          <button
            style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid #a78bfa', borderRadius: 6, padding: '4px 10px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
            onClick={() => void handleSetRole('STUDENT')}
            disabled={roleSaving}
          >{roleSaving ? '…' : '− Moderator'}</button>
        ) : null}
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
  const [myRole, setMyRole] = useState<string | null>(null)
  const [muteMinutes, setMuteMinutes] = useState('60')
  const [muteSaving, setMuteSaving] = useState(false)

  useEffect(() => {
    api.feedUserProfile(currentUserId).then(p => setMyRole(p.role)).catch(() => {})
  }, [currentUserId])

  if (!(myRole === 'ADMIN' || myRole === 'DEV' || myRole === 'MODERATOR') || userId === currentUserId) return null

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
