'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import { api, FeedPost, FeedComment, FeedUserProfile, AppNotification, getApiToken } from '@/lib/api'
import CoinIcon from '@/components/ui/CoinIcon'
import VerifiedBadge from '@/components/ui/VerifiedBadge'
import { DevAdminPanel, ModPanel } from '@/components/ui/DevAdminPanel'

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function parseHacName(raw: string | null | undefined): string {
  if (!raw) return ''
  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''
  if (raw.includes(',')) {
    const [rawLast, rawRest = ''] = raw.split(',')
    const first = cap(rawRest.trim().split(' ')[0])
    const last = cap(rawLast.trim())
    return `${first} ${last}`.trim()
  }
  return raw
}

function displayName(user: { name: string | null; hacName?: string | null }): string {
  if (user.name) return user.name
  if (user.hacName) return parseHacName(user.hacName)
  return 'User'
}

function initials(user: { name: string | null; hacName?: string | null }): string {
  const n = displayName(user)
  const parts = n.trim().split(' ')
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : n.slice(0, 2).toUpperCase()
}

const PFP_BORDER_MAP: Record<string, string> = {
  'border-green': '#22C55E', 'border-blue': '#3B82F6', 'border-red': '#EF4444',
  'border-navy': '#1D4ED8', 'border-teal': '#14B8A6', 'border-orange': '#F97316',
  'border-violet': '#7C3AED', 'border-cyan': '#06B6D4', 'border-hotpink': '#EC4899',
  'border-gold': '#D97706', 'border-lime': '#84CC16',
}
const PFP_GLOW_MAP: Record<string, [string, string]> = {
  'glow-pink':   ['#EC4899', '#EC489955'],
  'glow-purple': ['#8B5CF6', '#8B5CF655'],
}
function pfpStyle(effect: string | null | undefined): React.CSSProperties {
  if (!effect) return {}
  if (effect === 'rainbow') return { background: '#ff0000', border: '3px solid #ff0000', boxShadow: '0 0 14px #ff000088', color: '#fff' }
  if (effect === 'glow-gold')          return {}
  if (effect === 'frame-black')        return {}
  if (effect === 'fill-white')         return {}
  if (effect === 'unobtainable-curse') return { background: 'transparent' }
  if (PFP_BORDER_MAP[effect]) return { border: `2px solid ${PFP_BORDER_MAP[effect]}` }
  if (PFP_GLOW_MAP[effect]) return { border: `2px solid ${PFP_GLOW_MAP[effect][0]}`, boxShadow: `0 0 12px ${PFP_GLOW_MAP[effect][1]}` }
  return {}
}
function pfpClass(effect: string | null | undefined): string {
  if (effect === 'rainbow')           return 'pfp-rainbow'
  if (effect === 'glow-gold')         return 'pfp-gold-fill'
  if (effect === 'frame-black')       return 'pfp-void-fill'
  if (effect === 'fill-white')        return 'pfp-white-fill'
  if (effect === 'unobtainable-curse') return 'pfp-curse'
  return ''
}

const GW_NAME_COLOR_ITEMS = [
  { id: 'forest-green', name: 'Forest Green', value: '#15803D', rarity: 'Common' },
  { id: 'navy-blue',    name: 'Navy Blue',    value: '#1D4ED8', rarity: 'Common' },
  { id: 'dark-red',     name: 'Dark Red',     value: '#991B1B', rarity: 'Common' },
  { id: 'slate-blue',   name: 'Slate Blue',   value: '#4338CA', rarity: 'Common' },
  { id: 'teal',         name: 'Teal',         value: '#0F766E', rarity: 'Common' },
  { id: 'bright-orange',name: 'Bright Orange',value: '#EA580C', rarity: 'Uncommon' },
  { id: 'violet',       name: 'Violet',       value: '#7C3AED', rarity: 'Uncommon' },
  { id: 'cyan',         name: 'Cyan',         value: '#0891B2', rarity: 'Uncommon' },
  { id: 'hot-pink',     name: 'Hot Pink',     value: '#DB2777', rarity: 'Rare' },
  { id: 'gold',         name: 'Gold',         value: '#D97706', rarity: 'Rare' },
  { id: 'lime-green',   name: 'Lime Green',   value: '#65A30D', rarity: 'Rare' },
  { id: 'electric-blue',name: 'Electric Blue',value: '#2563EB', rarity: 'Epic' },
  { id: 'magenta',      name: 'Magenta',      value: '#C026D3', rarity: 'Epic' },
  { id: 'pure-white',   name: 'Pure White',   value: '#F8FAFC', rarity: 'Legendary' },
  { id: 'black',        name: 'Black',        value: '#111111', rarity: 'Legendary' },
  { id: 'rainbow',      name: 'Rainbow RGB',  value: 'rainbow', rarity: 'Mythic' },
]
const GW_PFP_ITEMS = [
  { id: 'border-green',  name: 'Green Border',    value: 'border-green',   rarity: 'Common' },
  { id: 'border-blue',   name: 'Blue Border',     value: 'border-blue',    rarity: 'Common' },
  { id: 'border-red',    name: 'Red Border',      value: 'border-red',     rarity: 'Common' },
  { id: 'border-navy',   name: 'Navy Border',     value: 'border-navy',    rarity: 'Common' },
  { id: 'border-teal',   name: 'Teal Border',     value: 'border-teal',    rarity: 'Common' },
  { id: 'border-orange', name: 'Orange Border',   value: 'border-orange',  rarity: 'Uncommon' },
  { id: 'border-violet', name: 'Violet Border',   value: 'border-violet',  rarity: 'Uncommon' },
  { id: 'border-cyan',   name: 'Cyan Border',     value: 'border-cyan',    rarity: 'Uncommon' },
  { id: 'border-hotpink',name: 'Hot Pink Border', value: 'border-hotpink', rarity: 'Rare' },
  { id: 'border-gold',   name: 'Gold Border',     value: 'border-gold',    rarity: 'Rare' },
  { id: 'border-lime',   name: 'Lime Border',     value: 'border-lime',    rarity: 'Rare' },
  { id: 'glow-pink',     name: 'Pink Glow',       value: 'glow-pink',      rarity: 'Epic' },
  { id: 'glow-purple',   name: 'Purple Glow',     value: 'glow-purple',    rarity: 'Epic' },
  { id: 'glow-gold',     name: 'Gold Fill',       value: 'glow-gold',      rarity: 'Legendary' },
  { id: 'frame-black',   name: 'Void Fill',       value: 'frame-black',    rarity: 'Legendary' },
  { id: 'rainbow',       name: 'Rainbow Animated',value: 'rainbow',        rarity: 'Mythic' },
]

function avatarContent(user: { name: string | null; avatarUrl?: string | null }): React.ReactNode {
  if (user.avatarUrl) return <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
  return initials(user)
}
function nameColorStyle(color: string | null | undefined): React.CSSProperties {
  if (!color || color === 'rainbow' || color === 'curse') return {}
  if (color === '#111111') return { color, textShadow: '0 0 6px rgba(180,180,180,0.65)' }
  if (color === '#C0C0C0') return { color: '#E8E8FF', textShadow: '0 0 4px rgba(255,255,255,1), 0 0 8px rgba(255,255,255,0.95), 0 0 18px rgba(255,255,255,0.7), 0 0 35px rgba(210,220,255,0.35)' }
  return { color }
}
function nameColorClass(color: string | null | undefined): string {
  return color === 'rainbow' ? 'name-rainbow' : color === 'curse' ? 'name-curse' : ''
}

// ── Notification row with clickable sender name ───────────────────────────────

function NotifRow({ n, onOpenProfile, onClose }: { n: AppNotification; onOpenProfile: (id: number) => void; onClose: () => void }) {
  const name = parseHacName(n.sender.name) || 'User'
  const isRainbowName = n.sender.nameColor === 'rainbow'

  function handleNameClick(e: React.MouseEvent) {
    e.stopPropagation()
    onClose()
    onOpenProfile(n.fromUserId)
  }

  const nameEl = (
    <button
      className={isRainbowName ? 'name-rainbow' : n.sender.nameColor === 'curse' ? 'name-curse' : ''}
      style={{ background: 'none', border: 'none', padding: 0, color: (isRainbowName || n.sender.nameColor === 'curse') ? undefined : (n.sender.nameColor ?? 'var(--primary)'), fontWeight: 700, cursor: 'pointer', fontSize: 'inherit' }}
      onClick={handleNameClick}
    >
      {name}
    </button>
  )

  let content: React.ReactNode
  if (n.type === 'FOLLOW') content = <>{nameEl} started following you</>
  else if (n.type === 'LIKE') content = <>{nameEl} liked your post</>
  else if (n.type === 'COMMENT') content = n.preview ? <>{nameEl}: &quot;{n.preview}&quot;</> : <>{nameEl} commented on your post</>
  else if (n.type === 'GIVEAWAY_WIN') content = n.preview ? <>{n.preview}</> : <>You won a giveaway!</>
  else if (n.type === 'LISTING_SOLD') content = n.preview ? <>{nameEl} bought your {n.preview}</> : <>{nameEl} bought your listing</>
  else if (n.type === 'TRADE_OFFER') content = <>{nameEl} sent you a trade offer</>
  else if (n.type === 'TRADE_ACCEPTED') content = <>{nameEl} accepted your trade</>
  else if (n.type === 'TRADE_DECLINED')    content = <>{nameEl} declined your trade</>
  else if (n.type === 'ASSIGNMENT_CREATED') content = <>{n.preview ?? 'New assignment added'}</>
  else content = null

  const icon = n.type === 'FOLLOW' ? '👤'
    : n.type === 'LIKE' ? '❤️'
    : n.type === 'GIVEAWAY_WIN' ? '🎉'
    : n.type === 'LISTING_SOLD' ? '🏷️'
    : n.type === 'TRADE_OFFER' || n.type === 'TRADE_ACCEPTED' || n.type === 'TRADE_DECLINED' ? '🔄'
    : n.type === 'ASSIGNMENT_CREATED' ? '📚'
    : '💬'

  if (!content) return null

  return (
    <div style={{ ...N.item, background: n.read ? 'transparent' : 'rgba(43,74,142,0.07)' }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={N.text}>{content}</div>
        <div style={N.time}>{notifTimeAgo(n.createdAt)}</div>
      </div>
      {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, alignSelf: 'center' as const }} />}
    </div>
  )
}

function notifTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── User Profile Overlay ──────────────────────────────────────────────────────

function UserProfileOverlay({ userId, onClose, currentUserId, onViewPost }: { userId: number; onClose: () => void; currentUserId: number; onViewPost: (postId: number) => void }) {
  const [profile, setProfile] = useState<FeedUserProfile | null>(null)
  const [userPosts, setUserPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState(false)
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsError, setPostsError] = useState(false)
  const [sendCoinAmount, setSendCoinAmount] = useState('')
  const [sendCoinBusy, setSendCoinBusy] = useState(false)
  const [sendCoinMsg, setSendCoinMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    setProfile(null); setLoading(true); setUserPosts([]); setPostsLoading(true); setPostsError(false)
    api.feedUserProfile(userId).then((data) => {
      if (!cancelled) { setProfile(data); setFollowing(data.isFollowing); setLoading(false) }
    }).catch(() => { if (!cancelled) setLoading(false) })
    api.feedUserPosts(userId).then((data) => {
      if (!cancelled) { setUserPosts(data.posts); setPostsLoading(false) }
    }).catch(() => { if (!cancelled) { setPostsLoading(false); setPostsError(true) } })
    return () => { cancelled = true }
  }, [userId])

  async function handleFollow() {
    try {
      const result = await api.feedToggleFollow(userId)
      setFollowing(result.following)
      setProfile((prev) => prev ? { ...prev, isFollowing: result.following, _count: { ...prev._count, followers: result.following ? prev._count.followers + 1 : prev._count.followers - 1 } } : prev)
    } catch { /* ignore */ }
  }

  async function handleLike(postId: number) {
    try {
      const result = await api.feedToggleLike(postId)
      setUserPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likedByMe: result.liked, _count: { ...p._count, likes: result.liked ? p._count.likes + 1 : p._count.likes - 1 } } : p))
    } catch { /* ignore */ }
  }

  const isDevTag = profile?.tag === 'DEV'
  const isGodTag = profile?.tag === 'GOAT'
  const isMythicTag = profile?.tag === 'VIP'

  return createPortal(
    <div style={O.overlay} onClick={onClose}>
      <div style={O.panel} onClick={e => e.stopPropagation()}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>Loading profile…</div>
        ) : !profile ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>User not found</div>
        ) : (
          <>
            <div style={O.header}>
              <div className={pfpClass(profile.pfpEffect)} style={{ ...O.avatar, ...pfpStyle(profile.pfpEffect), ...(profile.avatarUrl ? { background: 'none', padding: 0 } : {}) }}>{avatarContent(profile)}</div>
              <div style={{ flex: 1 }}>
                <div className={nameColorClass(profile.nameColor)} style={{ ...O.name, ...nameColorStyle(profile.nameColor) }}>{displayName(profile)}</div>
                {profile.hacName && parseHacName(profile.hacName) !== displayName(profile) && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 3 }}>{parseHacName(profile.hacName)}</div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 3 }}>
                  {(profile.chatBanned || (profile.chatMutedUntil && new Date(profile.chatMutedUntil) > new Date())) && (
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, display: 'inline-block', ...(profile.chatBanned ? { color: '#EF4444', background: '#EF444422', border: '1px solid #EF4444' } : { color: '#f97316', background: '#f9731622', border: '1px solid #f97316' }) }}>
                      {profile.chatBanned ? 'BANNED' : 'MUTED'}
                    </span>
                  )}
                  {profile.tag && !profile.chatBanned && !(profile.chatMutedUntil && new Date(profile.chatMutedUntil) > new Date()) && (
                    profile.tagColor === 'verified-yellow' || profile.tagColor === 'verified-blue'
                      ? <VerifiedBadge variant={profile.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} />
                      : <span className={tagCssClass(profile.tag, profile.tagColor)} style={isAnimatedTag(profile.tag) ? { ...O.tag } : profile.tagColor === 'curse' ? { ...O.tag, border: '1px solid #ff0000' } : { ...O.tag, color: profile.tagColor === 'grey' || !profile.tagColor ? 'var(--text-secondary)' : profile.tagColor, background: profile.tagColor === 'grey' || !profile.tagColor ? 'rgba(128,128,128,0.12)' : `${profile.tagColor}22`, border: `1px solid ${profile.tagColor === 'grey' || !profile.tagColor ? 'rgba(128,128,128,0.4)' : profile.tagColor}` }}>
                          {profile.tag}
                        </span>
                  )}
                  {(profile.badge === 'verified-yellow' || profile.badge === 'verified-blue') && !profile.chatBanned && !(profile.chatMutedUntil && new Date(profile.chatMutedUntil) > new Date()) && (
                    <VerifiedBadge variant={profile.badge === 'verified-yellow' ? 'yellow' : 'blue'} size={16} />
                  )}
                </div>
              </div>
              <button style={O.closeBtn} onClick={onClose}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div style={O.stats}>
              {[{ v: profile._count.followers, l: 'Followers' }, { v: profile._count.following, l: 'Following' }, { v: profile._count.posts, l: 'Posts' }, { v: profile.totalLikes, l: 'Likes' }].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' as const }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase' as const, letterSpacing: '0.4px' }}>{s.l}</div>
                </div>
              ))}
            </div>

            {userId !== currentUserId && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button className={following ? 'ns-btn-ghost' : 'ns-btn-primary'} style={{ flex: 1, height: 40, fontSize: 14 }} onClick={handleFollow}>
                  {following ? 'Following' : 'Follow'}
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('futurely:call', { detail: { targetUserId: userId, targetName: profile?.name ?? `User ${userId}` } }))}
                  style={{ height: 40, padding: '0 16px', borderRadius: 10, border: '1px solid #22C55E', background: 'transparent', color: '#22C55E', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  title="Start call"
                >
                  📞 Call
                </button>
              </div>
            )}

            {/* Send Coins — visible to all users on other profiles */}
            {userId !== currentUserId && (() => {
              const amt = parseInt(sendCoinAmount)
              const tax = (!isNaN(amt) && amt > 0) ? Math.ceil(amt * 0.05) : 0
              return (
                <div style={{ marginBottom: 20, padding: '12px 14px', borderRadius: 10, background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#EAB308', marginBottom: 8 }}>🪙 Send Coins</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      className="ns-input"
                      style={{ flex: 1, height: 34, fontSize: 13 }}
                      type="number"
                      min="1"
                      placeholder="Amount"
                      value={sendCoinAmount}
                      onChange={e => { setSendCoinAmount(e.target.value); setSendCoinMsg('') }}
                    />
                    <button
                      style={{ background: '#EAB308', color: '#000', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 700, fontSize: 13, cursor: sendCoinBusy ? 'not-allowed' : 'pointer', opacity: sendCoinBusy ? 0.6 : 1 }}
                      disabled={sendCoinBusy}
                      onClick={async () => {
                        if (isNaN(amt) || amt <= 0 || sendCoinBusy) return
                        setSendCoinBusy(true); setSendCoinMsg('')
                        try {
                          await api.sendCoins(userId, amt)
                          setSendCoinMsg(`✓ Sent ${amt} coins (−${tax} tax)`)
                          setSendCoinAmount('')
                        } catch (e: unknown) {
                          const msg = (e instanceof Error ? e.message : '') || 'Failed'
                          setSendCoinMsg(msg.includes('INSUFFICIENT') ? 'Not enough coins' : 'Failed')
                        } finally { setSendCoinBusy(false) }
                      }}
                    >{sendCoinBusy ? '…' : 'Send'}</button>
                  </div>
                  {tax > 0 && !sendCoinMsg && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                      5% tax — you pay <strong style={{ color: '#EAB308' }}>{amt + tax}</strong> total ({amt} + {tax} tax)
                    </div>
                  )}
                  {sendCoinMsg && <div style={{ fontSize: 11, color: sendCoinMsg.startsWith('✓') ? '#22C55E' : '#EF4444', fontWeight: 600, marginTop: 6 }}>{sendCoinMsg}</div>}
                </div>
              )
            })()}

            {/* DEV/Admin panel */}
            <DevAdminPanel
              profile={profile}
              userId={userId}
              currentUserId={currentUserId}
              onUpdateTag={updated => setProfile(prev => prev ? { ...prev, tag: updated.tag, tagColor: updated.tagColor, allTags: updated.allTags ?? prev.allTags } : prev)}
              onUpdateBan={banned => setProfile(prev => prev ? { ...prev, chatBanned: banned } : prev)}
              onUpdateMute={mu => setProfile(prev => prev ? { ...prev, chatMutedUntil: mu } : prev)}
              onUpdateRole={role => setProfile(prev => prev ? { ...prev, role } : prev)}
              onDeleted={onClose}
            />

            <ModPanel
              userId={userId}
              currentUserId={currentUserId}
              profile={profile}
              onUpdateMute={mu => setProfile(prev => prev ? { ...prev, chatMutedUntil: mu } : prev)}
            />

            {/* Tag picker — only shown on own profile */}
            {userId === currentUserId && (profile.allTags ?? []).length > 0 && (
              <OwnTagPicker
                profile={profile}
                onUpdateTag={updated => setProfile(prev => prev ? { ...prev, tag: updated.tag, tagColor: updated.tagColor } : prev)}
              />
            )}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <p style={O.postsTitle}>Posts</p>
              {postsLoading ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading posts…</div>
              ) : postsError ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Could not load posts.</div>
              ) : userPosts.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No posts yet.</div>
              ) : userPosts.map(post => (
                <div key={post.id} style={{ ...O.postCard, cursor: 'pointer' }} onClick={() => onViewPost(post.id)}>
                  <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text)', whiteSpace: 'pre-wrap' as const }}>{post.body}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{timeAgo(post.createdAt)}</span>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: post.likedByMe ? '#EF4444' : 'var(--text-secondary)', padding: 0 }} onClick={e => { e.stopPropagation(); void handleLike(post.id) }}>
                      {post.likedByMe ? '♥' : '♡'} {post._count.likes}
                    </button>
                  </div>
                  <div style={{ marginTop: 5, fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>View full post & comments →</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Own Tag Picker ────────────────────────────────────────────────────────────

function OwnTagPicker({ profile, onUpdateTag }: {
  profile: FeedUserProfile
  onUpdateTag: (u: { tag: string | null; tagColor: string | null }) => void
}) {
  const [saving, setSaving] = useState<string | null>(null)
  const isBannedOrMuted = profile.chatBanned || (!!profile.chatMutedUntil && new Date(profile.chatMutedUntil) > new Date())
  const allTags = Array.from(new Map((profile.allTags ?? []).map(t => [`${t.tag}:${t.tagColor}`, t])).values())

  async function handleSelect(tag: string, tagColor: string) {
    if (saving || isBannedOrMuted) return
    const savingKey = `${tag}:${tagColor}`
    setSaving(savingKey)
    try {
      const updated = await api.feedSetDisplayTag(tag, tagColor)
      onUpdateTag(updated)
    } catch { /* ignore */ }
    finally { setSaving(null) }
  }

  return (
    <div style={{ background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>YOUR DISPLAY TAG</p>
      {isBannedOrMuted ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tag selection is disabled while banned or muted.</p>
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          {allTags.map(t => {
            const savingKey = `${t.tag}:${t.tagColor}`
            const isVerified = t.tagColor === 'verified-yellow' || t.tagColor === 'verified-blue'
            const isActive = profile.tag === t.tag && (isVerified ? profile.tagColor === t.tagColor : true)
            const isDev = t.tag === 'DEV'
            const isGod = t.tag === 'GOAT'
            const isMythic = t.tag === 'VIP'
            if (isVerified) {
              // Verified checkmarks are badges, not equippable tags — show as read-only
              return (
                <span
                  key={savingKey}
                  title="This is a badge — it displays automatically and cannot be equipped as a tag"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'var(--surface-2)',
                    border: `1px solid ${t.tagColor === 'verified-yellow' ? '#EAB30840' : '#1D9BF040'}`,
                    borderRadius: 6, padding: '4px 8px',
                    opacity: 0.6, cursor: 'default',
                  }}
                >
                  <VerifiedBadge variant={t.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} size={16} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: t.tagColor === 'verified-yellow' ? '#EAB308' : '#1D9BF0' }}>
                    {t.tagColor === 'verified-yellow' ? 'Verified' : 'Partner'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>badge</span>
                </span>
              )
            }
            return (
              <button
                key={savingKey}
                disabled={!!saving}
                onClick={() => void handleSelect(t.tag, t.tagColor)}
                className={tagCssClass(t.tag, t.tagColor)}
                style={{
                  border: `2px solid ${isActive ? (t.tagColor === 'grey' ? 'rgba(128,128,128,0.6)' : t.tagColor === 'curse' ? '#ff0000' : isAnimatedTag(t.tag) ? 'rgba(255,255,255,0.4)' : t.tagColor) : 'transparent'}`,
                  background: isActive && !isAnimatedTag(t.tag) ? (t.tagColor === 'grey' ? 'rgba(128,128,128,0.12)' : t.tagColor === 'curse' ? 'rgba(255,0,0,0.08)' : `${t.tagColor}22`) : undefined,
                  borderRadius: 6, padding: '4px 10px',
                  fontSize: 12, fontWeight: 700,
                  color: isAnimatedTag(t.tag) ? undefined : t.tagColor === 'grey' ? 'var(--text-secondary)' : t.tagColor === 'curse' ? undefined : t.tagColor,
                  cursor: saving ? 'default' : 'pointer',
                  opacity: saving === savingKey ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {saving === savingKey ? '…' : t.tag}
                {isActive && <span style={{ marginLeft: 4, fontSize: 10 }}>✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Post Card ────────────────────────────────────────────────────────────────

function GiveawayCountdown({ endsAt }: { endsAt: string }) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    function update() {
      const diff = Math.max(0, new Date(endsAt).getTime() - Date.now())
      if (diff === 0) { setLabel('Ended'); return }
      const s = Math.floor(diff / 1000)
      if (s < 60) { setLabel(`${s}s left`); return }
      const m = Math.floor(s / 60)
      if (m < 60) { setLabel(`${m}m left`); return }
      const h = Math.floor(m / 60)
      if (h < 24) { setLabel(`${h}h ${m % 60}m left`); return }
      setLabel(`${Math.floor(h / 24)}d left`)
    }
    update()
    const t = setInterval(update, 5000)
    return () => clearInterval(t)
  }, [endsAt])
  return <span>{label}</span>
}

function PostCard({ post, onLike, onDelete, onOpenComments, onOpenProfile, onFollow, onEnterGiveaway, onDrawGiveaway, onPin, currentUserId, followedUsers, isDevUser, isModUser }: {
  post: FeedPost
  onLike: (id: number) => void
  onDelete: (id: number) => void
  onOpenComments: (id: number) => void
  onOpenProfile: (userId: number) => void
  onFollow: (userId: number) => void
  onEnterGiveaway: (id: number) => void
  onDrawGiveaway: (id: number) => void
  onPin: (id: number, currentlyPinned: boolean) => void
  currentUserId: number
  followedUsers: Set<number>
  isDevUser: boolean
  isModUser: boolean
}) {
  const [showLikeRequired, setShowLikeRequired] = useState(false)

  const tagColor = (post.user as { tagColor?: string }).tagColor || 'grey'
  const isDevTag = post.user.tag === 'DEV'
  const isGodTag = post.user.tag === 'GOAT'
  const isMythicTag = post.user.tag === 'VIP'
  const isFollowing = followedUsers.has(post.userId)
  const canDelete = post.userId === currentUserId || isDevUser || isModUser
  const isPinned = !!post.pinnedUntil && new Date(post.pinnedUntil) > new Date()
  const isGiveaway = post.type === 'giveaway'
  const isUnbox = post.type === 'UNBOX'
  const isCoinGiveaway = isGiveaway && !!post.giveawayCoinAmount
  const isNameColorGiveaway = isGiveaway && post.giveawayItemType === 'name-color'
  const isPfpGiveaway = isGiveaway && post.giveawayItemType === 'pfp'
  const isItemGiveaway = isNameColorGiveaway || isPfpGiveaway
  const giveawayEnded = !!post.giveawayEndsAt && new Date(post.giveawayEndsAt) <= new Date()
  const giveawayTagColor = post.giveawayTagColor || 'gold'
  const giveawayRainbow = isNameColorGiveaway && post.giveawayTagColor === 'rainbow'
  const giveawayAccent = isCoinGiveaway
    ? '#EAB308'
    : isNameColorGiveaway && !giveawayRainbow
      ? (post.giveawayTagColor ?? '#6B7280')
      : isPfpGiveaway
        ? '#8B5CF6'
        : giveawayTagColor

  return (
    <div className="ns-card" style={{ padding: 16, marginBottom: 12, ...(isGiveaway ? { border: `1px solid ${giveawayAccent}55`, background: `${giveawayAccent}08` } : {}), ...(isPinned && !isGiveaway ? { border: '1px solid rgba(43,74,142,0.3)' } : {}) }}>
      {/* Pinned banner */}
      {isPinned && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
          PINNED
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div className={pfpClass(post.user.pfpEffect)} style={{ ...P.avatar, ...pfpStyle(post.user.pfpEffect), ...(post.user.avatarUrl ? { background: 'none', padding: 0 } : {}) }}>{avatarContent(post.user)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
            <span className={nameColorClass(post.user.nameColor)} style={{ ...P.authorName, ...nameColorStyle(post.user.nameColor) }} onClick={() => onOpenProfile(post.user.id)}>{displayName(post.user)}</span>
            {post.user.tag && (
              tagColor === 'verified-yellow' || tagColor === 'verified-blue'
                ? <VerifiedBadge variant={tagColor === 'verified-yellow' ? 'yellow' : 'blue'} />
                : <span className={tagCssClass(post.user.tag, tagColor)} style={isAnimatedTag(post.user.tag) ? { ...P.tag } : tagColor === 'curse' ? { ...P.tag, border: '1px solid #ff0000' } : { ...P.tag, color: tagColor, border: `1px solid ${tagColor}`, background: tagColor === 'grey' ? 'rgba(128,128,128,0.1)' : `${tagColor}22` }}>
                    {post.user.tag}
                  </span>
            )}
            {(post.user.badge === 'verified-yellow' || post.user.badge === 'verified-blue') && <VerifiedBadge variant={post.user.badge === 'verified-yellow' ? 'yellow' : 'blue'} size={16} />}
            {post.userId !== currentUserId && (
              <button
                style={{ ...P.followBtn, ...(isFollowing ? { background: 'var(--primary)', color: '#FFFFFF', border: '1px solid var(--primary)' } : {}) }}
                onClick={e => { e.stopPropagation(); onFollow(post.userId) }}
              >{isFollowing ? 'Following' : 'Follow'}</button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{timeAgo(post.createdAt)}</span>
            {post.network === 'isd' && <span style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 4, padding: '1px 5px' }}>🏫 ISD</span>}
          </div>
        </div>
        {canDelete && (
          <button style={P.deleteBtn} onClick={() => onDelete(post.id)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--text)', marginBottom: 14, whiteSpace: 'pre-wrap' as const }}>{post.body}</div>

      {/* Unbox section */}
      {isUnbox && post.unboxItemName && (
        (() => {
          const unboxAccent = '#EAB308'
          return (
        <div style={{ border: `1px solid ${unboxAccent}44`, borderRadius: 8, padding: 12, marginBottom: 12, background: `${unboxAccent}0d` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 20 }}>{post.unboxItemRarity === 'Mythic' ? '👑' : '🌟'}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: unboxAccent, letterSpacing: '0.5px' }}>
                {post.unboxItemType === 'tag' ? 'TAG SPIN' : post.unboxItemType === 'name-color' ? 'NAME COLOR SPIN' : 'PFP SPIN'}
              </div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, color: unboxAccent, background: `${unboxAccent}18`, border: `1px solid ${unboxAccent}44` }}>
              {post.unboxItemRarity}
            </span>
          </div>

          {/* Item preview card - profile-like preview of the won item */}
          <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--border)' }}>
            {/* Avatar: pfp type uses won effect, others use default */}
            {post.unboxItemType === 'pfp' ? (
              <div className={pfpClass(post.unboxItemValue)} style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, ...pfpStyle(post.unboxItemValue) }}>U</div>
            ) : (
              <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>U</div>
            )}
            {/* Name + tag row */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
              {post.unboxItemType === 'pfp' && (
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)' }}>
                  {post.unboxItemValue === 'rainbow' ? 'RGB' : post.unboxItemName}
                </span>
              )}
              <span
                className={post.unboxItemType === 'name-color' ? nameColorClass(post.unboxItemValue) : ''}
                style={{ fontSize: 13, fontWeight: 800, ...(post.unboxItemType === 'name-color' ? nameColorStyle(post.unboxItemValue) : { color: 'var(--text)' }) }}
              >Username</span>
              {post.unboxItemType === 'tag' ? (
                post.unboxItemTagColor === 'verified-yellow' || post.unboxItemTagColor === 'verified-blue'
                  ? <VerifiedBadge variant={post.unboxItemTagColor === 'verified-yellow' ? 'yellow' : 'blue'} size={18} />
                  : <span
                      className={tagCssClass(post.unboxItemName, post.unboxItemTagColor)}
                      style={isAnimatedTag(post.unboxItemName) ? { ...P.tag } : post.unboxItemTagColor === 'curse' ? { ...P.tag, border: '1px solid #ff0000' } : { ...P.tag, color: post.unboxItemTagColor || '#6B7280', border: `1px solid ${post.unboxItemTagColor || '#6B7280'}`, background: post.unboxItemTagColor ? `${post.unboxItemTagColor}22` : 'rgba(107,114,128,0.12)' }}
                    >
                      {post.unboxItemName}
                    </span>
              ) : (
                <span style={{ ...P.tag, color: '#6B7280', border: '1px solid rgba(107,114,128,0.4)', background: 'rgba(107,114,128,0.12)' }}>TAG</span>
              )}
            </div>
          </div>

          {/* Estimated value */}
          {post.unboxItemEstValue != null && post.unboxItemEstValue > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ fontSize: 13 }}>💰</span>
              <span>Est. value: <strong style={{ color: unboxAccent }}><CoinIcon size={13} style={{ marginRight: 2 }} />{post.unboxItemEstValue?.toLocaleString()}</strong></span>
            </div>
          )}
        </div>
          )
        })()
      )}

      {/* Giveaway section */}
      {isGiveaway && (
        <div style={{ border: `1px solid ${giveawayAccent}44`, borderRadius: 8, padding: 12, marginBottom: 12, background: `${giveawayAccent}0d` }}>
          {/* Header: icon + label + prize bubble inline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: 16 }}>🎁</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: giveawayAccent, letterSpacing: '0.5px' }}>
              {isCoinGiveaway ? 'COIN GIVEAWAY' : isNameColorGiveaway ? 'NAME COLOR GIVEAWAY' : isPfpGiveaway ? 'PFP GIVEAWAY' : 'TAG GIVEAWAY'}
            </span>
            {isCoinGiveaway ? (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(234,179,8,0.15)', color: '#EAB308', border: '1px solid rgba(234,179,8,0.5)' }}>
                <CoinIcon size={12} style={{ marginRight: 3 }} />{post.giveawayCoinAmount?.toLocaleString()} coins
              </span>
            ) : isNameColorGiveaway && post.giveawayTag ? (
              <span className={giveawayRainbow ? 'name-rainbow' : ''} style={{ fontSize: 13, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'var(--surface-2)', border: '1px solid var(--border)', ...(giveawayRainbow ? {} : { color: post.giveawayTagColor ?? '#6B7280' }) }}>
                {post.giveawayTag}
              </span>
            ) : isPfpGiveaway && post.giveawayTag ? (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.5)' }}>
                {post.giveawayTag}
              </span>
            ) : post.giveawayTag ? (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${giveawayTagColor}22`, color: giveawayTagColor, border: `1px solid ${giveawayTagColor}` }}>
                {post.giveawayTag}
              </span>
            ) : null}
          </div>

          {/* Item preview for name-color / pfp giveaways */}
          {isItemGiveaway && post.giveawayTag && (
            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, border: '1px solid var(--border)' }}>
              {isPfpGiveaway ? (
                <div className={pfpClass(post.giveawayTagColor)} style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, ...pfpStyle(post.giveawayTagColor) }}>U</div>
              ) : (
                <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>U</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' as const }}>
                  <span className={isNameColorGiveaway && giveawayRainbow ? 'name-rainbow' : ''} style={{ fontSize: 13, fontWeight: 700, ...(isNameColorGiveaway && !giveawayRainbow ? { color: post.giveawayTagColor ?? 'var(--text)' } : !isNameColorGiveaway ? { color: 'var(--text)' } : {}) }}>
                    Username
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }}>[Student]</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  Preview of the {isNameColorGiveaway ? 'name color' : 'PFP effect'} ✨
                </div>
              </div>
              {post.giveawayItemRarity && (
                <span style={{ fontSize: 10, fontWeight: 700, color: giveawayAccent, background: `${giveawayAccent}18`, padding: '2px 7px', borderRadius: 99, border: `1px solid ${giveawayAccent}44`, flexShrink: 0 }}>
                  {post.giveawayItemRarity}
                </span>
              )}
            </div>
          )}

          {post.giveawayWinnerId ? (
            /* Winner announced */
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6 }}>
              <span style={{ fontSize: 18 }}>🏆</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#22C55E' }}>Winner!</div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>
                  {post.giveawayWinner ? displayName(post.giveawayWinner) : 'Someone'} won{' '}
                  {isCoinGiveaway
                    ? <strong style={{ color: '#EAB308' }}><CoinIcon size={13} style={{ marginRight: 3 }} />{post.giveawayCoinAmount?.toLocaleString()} coins</strong>
                    : isNameColorGiveaway
                      ? <><strong className={giveawayRainbow ? 'name-rainbow' : ''} style={giveawayRainbow ? {} : { color: post.giveawayTagColor ?? 'var(--text)' }}>{post.giveawayTag}</strong> name color</>
                      : isPfpGiveaway
                        ? <><strong style={{ color: '#8B5CF6' }}>{post.giveawayTag}</strong> PFP effect</>
                        : <>the <strong style={{ color: giveawayTagColor }}>{post.giveawayTag}</strong> tag</>
                  }!
                </div>
              </div>
            </div>
          ) : giveawayEnded ? (
            /* Ended, no winner drawn yet */
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              Giveaway ended · {post._count.giveawayEntries} {post._count.giveawayEntries === 1 ? 'entry' : 'entries'}
              {isDevUser && post._count.giveawayEntries > 0 && (
                <button
                  style={{ marginLeft: 10, background: giveawayAccent, color: '#000', border: 'none', borderRadius: 5, padding: '3px 10px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                  onClick={() => onDrawGiveaway(post.id)}
                >
                  Draw Winner
                </button>
              )}
            </div>
          ) : (
            /* Active giveaway */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {post._count.giveawayEntries} {post._count.giveawayEntries === 1 ? 'entry' : 'entries'} ·{' '}
                  {post.giveawayEndsAt && <GiveawayCountdown endsAt={post.giveawayEndsAt} />}
                </span>
                <div style={{ marginLeft: 'auto' }}>
                  {post.enteredByMe ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#22C55E', padding: '6px 14px', border: '1px solid #22C55E', borderRadius: 6, display: 'inline-block' }}>✓ Entered</span>
                  ) : (
                    <button
                      style={{ background: giveawayAccent, color: '#000', border: 'none', borderRadius: 6, padding: '6px 16px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                      onClick={() => {
                        if (!post.likedByMe) { setShowLikeRequired(true); return }
                        onEnterGiveaway(post.id)
                      }}
                    >
                      Enter Giveaway
                    </button>
                  )}
                </div>
              </div>
              {!post.enteredByMe && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>♥ You must like this post to enter</div>
              )}
              {showLikeRequired && createPortal(
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowLikeRequired(false)}>
                  <div style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 16, padding: 28, width: '90%', maxWidth: 360, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🚫</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--error)', marginBottom: 8 }}>Entry Denied</div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                      You must like this post before you can enter the giveaway.
                    </div>
                    <button
                      style={{ width: '100%', padding: '10px 0', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#FFFFFF', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                      onClick={() => setShowLikeRequired(false)}
                    >
                      Got it
                    </button>
                  </div>
                </div>,
                document.body
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <button style={{ ...P.actionBtn, color: post.likedByMe ? '#EF4444' : 'var(--text-secondary)' }} onClick={() => onLike(post.id)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={post.likedByMe ? '#EF4444' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          {post._count.likes}
        </button>
        <button style={P.actionBtn} onClick={() => onOpenComments(post.id)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          {post._count.comments}
        </button>
        {isDevUser && (
          <button
            style={{ ...P.actionBtn, marginLeft: 'auto', color: isPinned ? 'var(--primary)' : 'var(--text-secondary)' }}
            onClick={() => onPin(post.id, isPinned)}
            title={isPinned ? 'Unpin post' : 'Pin for 24h'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
            {isPinned ? 'Unpin' : 'Pin'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Post Detail Modal (for viewing any post + comments from a profile) ────────

function PostDetailModal({ postId, onClose, currentUserId, onOpenProfile }: {
  postId: number
  onClose: () => void
  currentUserId: number
  onOpenProfile: (userId: number) => void
}) {
  const [post, setPost] = useState<(FeedPost & { comments: FeedComment[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [likingId, setLikingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.feedPostDetail(postId).then(d => {
      if (!cancelled) { setPost(d as FeedPost & { comments: FeedComment[] }); setLoading(false) }
    }).catch(() => { if (!cancelled) setLoading(false) })
    // Poll for new comments every 15s so the viewer sees replies without refreshing
    const timer = setInterval(() => {
      if (cancelled) return
      api.feedPostDetail(postId).then(d => {
        if (!cancelled) setPost(d as FeedPost & { comments: FeedComment[] })
      }).catch(() => {})
    }, 15_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [postId])

  async function handleLikePost() {
    if (!post) return
    try {
      const r = await api.feedToggleLike(post.id)
      setPost(prev => prev ? { ...prev, likedByMe: r.liked, _count: { ...prev._count, likes: r.liked ? prev._count.likes + 1 : prev._count.likes - 1 } } : prev)
    } catch { /* ignore */ }
  }

  async function handleLikeComment(commentId: number) {
    if (likingId !== null || !post) return
    setLikingId(commentId)
    try {
      const r = await api.feedToggleCommentLike(post.id, commentId)
      setPost(prev => prev ? { ...prev, comments: prev.comments.map(c => c.id === commentId ? { ...c, likedByMe: r.liked, _count: { likes: r.count } } : c) } : prev)
    } catch { /* ignore */ }
    finally { setLikingId(null) }
  }

  async function handleAddComment() {
    if (!newComment.trim() || !post || submitting) return
    setSubmitting(true)
    try {
      const c = await api.feedAddComment(post.id, newComment.trim())
      setPost(prev => prev ? { ...prev, comments: [...prev.comments, c], _count: { ...prev._count, comments: prev._count.comments + 1 } } : prev)
      setNewComment('')
    } catch { /* ignore */ }
    finally { setSubmitting(false) }
  }

  return createPortal(
    <div style={O.overlay} onClick={onClose}>
      <div style={{ ...O.panel, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Post</h3>
          <button style={O.closeBtn} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
        ) : !post ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Post not found.</div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Post body */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div
                className={pfpClass(post.user.pfpEffect)}
                style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0, cursor: 'pointer', ...pfpStyle(post.user.pfpEffect), ...(post.user.avatarUrl ? { background: 'none', padding: 0, overflow: 'hidden' } : {}) }}
                onClick={() => { onClose(); onOpenProfile(post.user.id) }}
              >
                {avatarContent(post.user)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <button
                    className={nameColorClass(post.user.nameColor)}
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: 14, fontWeight: 700, cursor: 'pointer', ...nameColorStyle(post.user.nameColor) }}
                    onClick={() => { onClose(); onOpenProfile(post.user.id) }}
                  >{displayName(post.user)}</button>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(post.createdAt)}</span>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap' as const, marginBottom: 10 }}>{post.body}</div>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: post.likedByMe ? '#EF4444' : 'var(--text-secondary)', padding: 0, fontWeight: 600 }}
                  onClick={handleLikePost}
                >{post.likedByMe ? '♥' : '♡'} {post._count.likes}</button>
              </div>
            </div>

            {/* Comments */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Comments ({post._count.comments})</p>
              {post.comments.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>No comments yet.</div>
              ) : post.comments.map(c => (
                <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div
                      className={pfpClass(c.user.pfpEffect)}
                      style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, flexShrink: 0, cursor: 'pointer', ...pfpStyle(c.user.pfpEffect), ...(c.user.avatarUrl ? { background: 'none', padding: 0, overflow: 'hidden' } : {}) }}
                      onClick={() => { onClose(); onOpenProfile(c.user.id) }}
                    >{avatarContent(c.user)}</div>
                    <button
                      className={nameColorClass(c.user.nameColor)}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 700, cursor: 'pointer', ...nameColorStyle(c.user.nameColor) }}
                      onClick={() => { onClose(); onOpenProfile(c.user.id) }}
                    >{displayName(c.user)}</button>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{timeAgo(c.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text)', marginBottom: 4 }}>{c.body}</div>
                  <button
                    disabled={likingId !== null}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: c.likedByMe ? '#EF4444' : 'var(--text-muted)', fontWeight: 600 }}
                    onClick={() => void handleLikeComment(c.id)}
                  >{c.likedByMe ? '♥' : '♡'} {c._count.likes}</button>
                </div>
              ))}

              {/* Add comment */}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <input
                  className="ns-input"
                  style={{ flex: 1, height: 36, fontSize: 13 }}
                  placeholder="Add a comment…"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleAddComment() } }}
                />
                <button
                  className="ns-btn-primary"
                  style={{ height: 36, padding: '0 14px', fontSize: 13 }}
                  disabled={submitting || !newComment.trim()}
                  onClick={() => void handleAddComment()}
                >Post</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Comment Section ───────────────────────────────────────────────────────────

function CommentSection({ postId, onClose, onCommentAdded, currentUserId, onOpenProfile, isMuted, mutedUntil }: {
  postId: number
  onClose: () => void
  onCommentAdded: () => void
  currentUserId: number
  onOpenProfile: (userId: number) => void
  isMuted?: boolean
  mutedUntil?: string | null
}) {
  const [comments, setComments] = useState<FeedComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [likingId, setLikingId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    api.feedPostDetail(postId).then(data => {
      if (!cancelled) {
        const raw = (data as FeedPost & { comments: FeedComment[] }).comments || []
        setComments(raw)
        setLoading(false)
      }
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [postId])

  const [commentError, setCommentError] = useState<string | null>(null)

  async function handleAdd() {
    if (!newComment.trim()) return
    setCommentError(null)
    try {
      const comment = await api.feedAddComment(postId, newComment.trim())
      setComments(prev => [...prev, comment])
      setNewComment('')
      onCommentAdded()
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to post comment')
    }
  }

  async function handleCommentLike(commentId: number) {
    if (likingId !== null) return
    setLikingId(commentId)
    try {
      const result = await api.feedToggleCommentLike(postId, commentId)
      setComments(prev => prev.map(c => c.id === commentId
        ? { ...c, likedByMe: result.liked, _count: { likes: result.count } }
        : c
      ))
    } catch (err) {
      console.error('[comment like]', err)
    } finally {
      setLikingId(null)
    }
  }

  const sorted = [...comments].sort((a, b) => (b._count?.likes ?? 0) - (a._count?.likes ?? 0))

  return createPortal(
    <div style={O.overlay} onClick={onClose}>
      <div style={{ ...O.panel, maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Comments</h3>
          <button style={O.closeBtn} onClick={onClose}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
          ) : sorted.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No comments yet. Be the first!</div>
          ) : sorted.map(c => {
            const isDevTag = c.user.tag === 'DEV'
            const isGodTag = c.user.tag === 'GOAT'
            const isMythicTag = c.user.tag === 'VIP'
            const tagColor = c.user.tagColor || 'grey'
            return (
              <div key={c.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div
                    className={pfpClass(c.user.pfpEffect)}
                    style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, flexShrink: 0, cursor: 'pointer', ...pfpStyle(c.user.pfpEffect), ...(c.user.avatarUrl ? { background: 'none', padding: 0, overflow: 'hidden' } : {}) }}
                    onClick={() => { onClose(); onOpenProfile(c.user.id) }}
                  >
                    {avatarContent(c.user)}
                  </div>
                  <button
                    className={nameColorClass(c.user.nameColor)}
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, ...nameColorStyle(c.user.nameColor) }}
                    onClick={() => { onClose(); onOpenProfile(c.user.id) }}
                  >
                    {displayName(c.user)}
                  </button>
                  {c.user.tag && (
                    tagColor === 'verified-yellow' || tagColor === 'verified-blue'
                      ? <VerifiedBadge variant={tagColor === 'verified-yellow' ? 'yellow' : 'blue'} size={16} />
                      : <span
                          className={tagCssClass(c.user.tag, tagColor)}
                          style={isAnimatedTag(c.user.tag)
                            ? { fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }
                            : tagColor === 'curse'
                            ? { fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, border: '1px solid #ff0000' }
                            : { fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, color: tagColor, border: `1px solid ${tagColor}`, background: tagColor === 'grey' ? 'rgba(128,128,128,0.1)' : `${tagColor}22` }
                          }
                        >
                          {c.user.tag}
                        </span>
                  )}
                  {(c.user.badge === 'verified-yellow' || c.user.badge === 'verified-blue') && <VerifiedBadge variant={c.user.badge === 'verified-yellow' ? 'yellow' : 'blue'} size={16} />}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{timeAgo(c.createdAt)}</span>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text)', marginBottom: 6 }}>{c.body}</div>
                <button
                  disabled={likingId !== null}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: likingId !== null ? 'default' : 'pointer', fontSize: 12, color: c.likedByMe ? '#EF4444' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, opacity: likingId === c.id ? 0.5 : 1 }}
                  onClick={() => void handleCommentLike(c.id)}
                >
                  {c.likedByMe ? '♥' : '♡'} {c._count?.likes ?? 0}
                </button>
              </div>
            )
          })}
        </div>
        {isMuted ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 8 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🔇</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f97316' }}>You are muted</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {mutedUntil ? `Until ${new Date(mutedUntil).toLocaleString()}` : 'Cannot comment while muted'}
              </div>
            </div>
          </div>
        ) : (
          <>
            {commentError && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', marginBottom: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>🚫</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', marginBottom: 1 }}>Comment blocked</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{commentError}</div>
                </div>
                <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }} onClick={() => setCommentError(null)}>×</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="ns-input" style={{ flex: 1, height: 42 }} placeholder="Write a comment…" value={newComment}
                onChange={e => { setNewComment(e.target.value); if (commentError) setCommentError(null) }}
                onKeyDown={e => e.key === 'Enter' && void handleAdd()} />
              <button className="ns-btn-primary" style={{ height: 42, padding: '0 18px' }} onClick={handleAdd}>Send</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── User Search ───────────────────────────────────────────────────────────────

function UserSearch({ currentUserId, onOpenProfile, followedUsers, onFollow }: { currentUserId: number; onOpenProfile: (userId: number) => void; followedUsers: Set<number>; onFollow: (userId: number) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: number; name: string | null; tag: string | null; tagColor: string | null; avatarUrl?: string | null; badge?: string | null }>>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(() => {
      setSearching(true)
      api.feedSearchUsers(query.trim()).then((data) => { setResults(data); setSearching(false) }).catch(() => setSearching(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input className="ns-input" style={{ paddingLeft: 40, height: 44 }} placeholder="Search users to follow…" value={query} onChange={e => setQuery(e.target.value)} />
      </div>
      {searching && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Searching…</div>}
      {results.map(u => (
        <div key={u.id} className="ns-card" style={{ padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ ...P.avatar, width: 36, height: 36, fontSize: 12, cursor: 'pointer', ...(u.avatarUrl ? { background: 'none', padding: 0, overflow: 'hidden' } : {}) }} onClick={() => onOpenProfile(u.id)}>
            {avatarContent(u)}
          </div>
          <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onOpenProfile(u.id)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{displayName(u)}</span>
              {u.tag && (
                u.tagColor === 'verified-yellow' || u.tagColor === 'verified-blue'
                  ? <VerifiedBadge variant={u.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} />
                  : <span
                      className={tagCssClass(u.tag, u.tagColor)}
                      style={isAnimatedTag(u.tag) ? { ...P.tag } : u.tagColor === 'curse' ? { ...P.tag } : { ...P.tag, color: u.tagColor || 'grey', border: `1px solid ${u.tagColor || 'grey'}`, background: u.tagColor ? `${u.tagColor}22` : 'rgba(128,128,128,0.1)' }}
                    >{u.tag}</span>
              )}
              {(u.badge === 'verified-yellow' || u.badge === 'verified-blue') && <VerifiedBadge variant={u.badge === 'verified-yellow' ? 'yellow' : 'blue'} />}
            </div>
          </div>
          <button style={{ ...P.followBtn, padding: '6px 14px', fontSize: 12.5, background: followedUsers.has(u.id) ? 'var(--primary)' : 'transparent', color: followedUsers.has(u.id) ? '#060D10' : 'var(--primary)' }} onClick={() => onFollow(u.id)}>
            {followedUsers.has(u.id) ? 'Following' : 'Follow'}
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

interface Toast { id: string; notif: AppNotification }

export default function StudyFeedPage() {
  const searchParams = useSearchParams()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [feedError, setFeedError] = useState<string | false>(false)
  const [loading, setLoading] = useState(true)
  const [newPostBody, setNewPostBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [followingPosts, setFollowingPosts] = useState<FeedPost[]>([])
  const [followingPage, setFollowingPage] = useState(1)
  const [followingHasMore, setFollowingHasMore] = useState(false)
  const [followingLoading, setFollowingLoading] = useState(false)
  const [followingLoaded, setFollowingLoaded] = useState(false)
  const [commentPostId, setCommentPostId] = useState<number | null>(null)
  const [currentUserId, setCurrentUserId] = useState<number>(0)
  const [tab, setTab] = useState<'social' | 'following' | 'search'>('social')
  const [profileUserId, setProfileUserId] = useState<number | null>(null)
  const [followedUsers, setFollowedUsers] = useState<Set<number>>(new Set())
  const [isDevUser, setIsDevUser] = useState(false)
  const [isModUser, setIsModUser] = useState(false)
  const [isBanned, setIsBanned] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [mutedUntil, setMutedUntil] = useState<string | null>(null)
  const [statusLoaded, setStatusLoaded] = useState(false)
  const [showGiveawayForm, setShowGiveawayForm] = useState(false)
  const [gwType, setGwType] = useState<'tag' | 'coin' | 'name-color' | 'pfp'>('tag')
  const [gwTag, setGwTag] = useState('')
  const [gwColor, setGwColor] = useState('gold')
  const [gwCoins, setGwCoins] = useState('')
  const [gwDuration, setGwDuration] = useState('60')
  const [gwBody, setGwBody] = useState('')
  const [gwItemId, setGwItemId] = useState('')
  const [creatingGw, setCreatingGw] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [network, setNetwork] = useState<'global' | 'isd'>('global')
  const [isdCode, setIsdCode] = useState<string | null>(null)
  const [isdDisplayName, setIsdDisplayName] = useState<string | null>(null)

  const [viewPostId, setViewPostId] = useState<number | null>(null)

  // sessionStorage relay — runs once on mount (from notification bell on another page)
  useEffect(() => {
    const pending = sessionStorage.getItem('ns_open_profile')
    if (pending) {
      const id = parseInt(pending, 10)
      if (!isNaN(id)) {
        setProfileUserId(id)
        // Delay removal so React Strict Mode's double-invoke (dev only) can also read it on remount
        setTimeout(() => sessionStorage.removeItem('ns_open_profile'), 100)
      }
    }
    // Custom event relay — when already on feed page and notification bell fires
    function handleOpenProfile(e: Event) {
      const id = (e as CustomEvent<number>).detail
      if (!isNaN(id)) setProfileUserId(id)
    }
    window.addEventListener('ns:open-profile', handleOpenProfile)
    return () => window.removeEventListener('ns:open-profile', handleOpenProfile)
  }, [])

  // URL params — handles direct links like /feed?profile=123
  useEffect(() => {
    const profileId = searchParams.get('profile')
    const postId = searchParams.get('post')
    if (profileId) {
      const id = parseInt(profileId, 10)
      if (!isNaN(id)) setProfileUserId(id)
      window.history.replaceState({}, '', '/feed')
    }
    if (postId) {
      const id = parseInt(postId, 10)
      if (!isNaN(id)) setViewPostId(id)
      window.history.replaceState({}, '', '/feed')
    }
  }, [searchParams])

  const loadPosts = useCallback(async (p: number, net?: 'global' | 'isd') => {
    if (p > 1) setLoadingMore(true)
    try {
      const data = await api.feedPosts(p, 20, net ?? network)
      setFeedError(false)
      if (p === 1) setPosts(data.posts)
      else setPosts((prev) => [...prev, ...data.posts])
      setHasMore(data.hasMore)
    } catch (err) {
      console.error('[feed] loadPosts error:', err)
      if (p === 1) setFeedError(err instanceof Error ? err.message : String(err))
    }
    finally { setLoading(false); setLoadingMore(false) }
  }, [])

  const loadFollowingPosts = useCallback(async (p: number) => {
    setFollowingLoading(true)
    try {
      const data = await api.feedFollowingPosts(p, 20)
      if (p === 1) setFollowingPosts(data.posts)
      else setFollowingPosts((prev) => [...prev, ...data.posts])
      setFollowingHasMore(data.hasMore)
      setFollowingLoaded(true)
    } catch { /* ignore */ }
    finally { setFollowingLoading(false) }
  }, [])

  useEffect(() => {
    try {
      const token = getApiToken()
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const uid = payload.sub || 0
        setCurrentUserId(uid)
        if (uid) {
          api.feedUserProfile(uid).then(p => {
            setIsDevUser(p.role === 'ADMIN' || p.tag === 'DEV')
            setIsModUser((p.allTags ?? []).some(t => t.tag === 'MOD'))
            setIsBanned(p.chatBanned)
            const activeMute = !!p.chatMutedUntil && new Date(p.chatMutedUntil) > new Date()
            setIsMuted(activeMute)
            setMutedUntil(p.chatMutedUntil)
            if (p.isdCode) { setIsdCode(p.isdCode); setIsdDisplayName(p.isdDisplayName ?? null) }
            setStatusLoaded(true)
          }).catch(() => { setStatusLoaded(true) })
        } else {
          setStatusLoaded(true)
        }
      } else {
        setStatusLoaded(true)
      }
    } catch { setStatusLoaded(true) }
    loadPosts(1)
  }, [loadPosts])

  // WebSocket — NEW_POST events only (notifications handled globally by NotificationBell in layout)
  useEffect(() => {
    const token = getApiToken()
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
          const msg = JSON.parse(e.data as string) as { event: string; data: FeedPost }
          if (msg.event === 'NEW_POST') {
            // Only add the post if it belongs to the currently selected network
            setNetwork(currentNetwork => {
              const postNetwork = msg.data.network ?? 'global'
              if (postNetwork === currentNetwork) {
                if (currentNetwork === 'isd') {
                  setIsdCode(currentIsd => {
                    if (msg.data.isdCode === currentIsd) {
                      setPosts(prev => [{ ...msg.data, likedByMe: false, enteredByMe: false }, ...prev])
                    }
                    return currentIsd
                  })
                } else {
                  setPosts(prev => [{ ...msg.data, likedByMe: false, enteredByMe: false }, ...prev])
                }
              }
              return currentNetwork
            })
          }
        } catch { /* ignore */ }
      }
      ws.onclose = () => { if (!dead) setTimeout(connect, 3000) }
    }
    connect()
    return () => { dead = true; ws?.close() }
  }, [])

  // Infinite scroll — trigger next page when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          const next = page + 1
          setPage(next)
          void loadPosts(next)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, page, loadPosts])

  async function handleCreatePost() {
    if (!newPostBody.trim() || posting) return
    setPostError(null)
    setPosting(true)
    try {
      const post = await api.feedCreatePost(newPostBody.trim(), network)
      setPosts(prev => [{ ...post, likedByMe: false }, ...prev])
      setNewPostBody('')
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Failed to create post')
    } finally { setPosting(false) }
  }

  async function handleLike(postId: number) {
    try {
      const result = await api.feedToggleLike(postId)
      const update = (p: FeedPost) => p.id === postId ? { ...p, likedByMe: result.liked, _count: { ...p._count, likes: result.liked ? p._count.likes + 1 : p._count.likes - 1 } } : p
      setPosts(prev => prev.map(update))
      setFollowingPosts(prev => prev.map(update))
    } catch { /* ignore */ }
  }

  async function handleDelete(postId: number) {
    try {
      await api.feedDeletePost(postId)
      setPosts(prev => prev.filter(p => p.id !== postId))
      setFollowingPosts(prev => prev.filter(p => p.id !== postId))
    } catch { /* ignore */ }
  }

  async function handleFollow(userId: number) {
    try {
      const result = await api.feedToggleFollow(userId)
      setFollowedUsers(prev => { const n = new Set(prev); result.following ? n.add(userId) : n.delete(userId); return n })
    } catch { /* ignore */ }
  }

  async function handleEnterGiveaway(postId: number) {
    try {
      const result = await api.feedEnterGiveaway(postId)
      const update = (p: FeedPost) => p.id === postId
        ? { ...p, enteredByMe: result.entered, _count: { ...p._count, giveawayEntries: result.count } }
        : p
      setPosts(prev => prev.map(update))
      setFollowingPosts(prev => prev.map(update))
    } catch { /* ignore */ }
  }

  async function handleDrawGiveaway(postId: number) {
    try {
      const result = await api.feedDrawGiveaway(postId)
      const update = (p: FeedPost) => p.id === postId
        ? { ...p, giveawayWinnerId: result.winnerId, giveawayWinner: { id: result.winnerId, name: result.winnerName, email: '' } }
        : p
      setPosts(prev => prev.map(update))
      setFollowingPosts(prev => prev.map(update))
    } catch { /* ignore */ }
  }

  async function handlePin(postId: number, currentlyPinned: boolean) {
    try {
      if (currentlyPinned) {
        await api.feedUnpinPost(postId)
        const update = (p: FeedPost) => p.id === postId ? { ...p, pinnedUntil: null } : p
        setPosts(prev => prev.map(update))
        setFollowingPosts(prev => prev.map(update))
      } else {
        const result = await api.feedPinPost(postId)
        const update = (p: FeedPost) => p.id === postId ? { ...p, pinnedUntil: result.pinnedUntil } : p
        setPosts(prev => prev.map(update))
        setFollowingPosts(prev => prev.map(update))
      }
    } catch { /* ignore */ }
  }

  async function handleCreateGiveaway() {
    const coinAmt = parseInt(gwCoins)
    if (!gwBody.trim() || creatingGw) return
    if (gwType === 'tag' && !gwTag.trim()) return
    if (gwType === 'coin' && (!coinAmt || coinAmt < 1)) return
    if ((gwType === 'name-color' || gwType === 'pfp') && !gwItemId) return
    setCreatingGw(true)
    try {
      let giveawayPayload: Parameters<typeof api.feedCreateGiveaway>[0]
      if (gwType === 'coin') {
        giveawayPayload = { body: gwBody.trim(), durationMinutes: parseInt(gwDuration) || 60, giveawayCoinAmount: coinAmt }
      } else if (gwType === 'name-color') {
        const item = GW_NAME_COLOR_ITEMS.find(i => i.id === gwItemId)!
        giveawayPayload = {
          body: gwBody.trim(), durationMinutes: parseInt(gwDuration) || 60,
          giveawayTag: item.name, giveawayTagColor: item.value,
          giveawayItemType: 'name-color', giveawayItemId: item.id, giveawayItemRarity: item.rarity,
        }
      } else if (gwType === 'pfp') {
        const item = GW_PFP_ITEMS.find(i => i.id === gwItemId)!
        giveawayPayload = {
          body: gwBody.trim(), durationMinutes: parseInt(gwDuration) || 60,
          giveawayTag: item.name, giveawayTagColor: item.value,
          giveawayItemType: 'pfp', giveawayItemId: item.id, giveawayItemRarity: item.rarity,
        }
      } else {
        giveawayPayload = { body: gwBody.trim(), durationMinutes: parseInt(gwDuration) || 60, giveawayTag: gwTag.trim(), giveawayTagColor: gwColor.trim() || 'gold' }
      }
      const post = await api.feedCreateGiveaway(giveawayPayload)
      setPosts(prev => [post, ...prev])
      setGwTag(''); setGwColor('gold'); setGwCoins(''); setGwBody(''); setGwDuration('60'); setGwType('tag'); setGwItemId('')
      setShowGiveawayForm(false)
    } catch { /* ignore */ }
    finally { setCreatingGw(false) }
  }

  function handleOpenProfile(uid: number) {
    setProfileUserId(uid)
  }

  if (statusLoaded && isBanned) {
    return (
      <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '0 var(--page-px)', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EF444422', border: '1px solid #EF4444', borderRadius: 6, padding: '4px 10px', marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#EF4444', letterSpacing: '0.5px' }}>BANNED</span>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>You&apos;re banned from the feed</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 360, lineHeight: 1.6 }}>
          A moderator has restricted your access to the social feed. You can no longer post, comment, or interact until the ban is lifted.
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>If you think this is a mistake, contact a DEV.</p>
      </div>
    )
  }

  return (
    <>
    <div className="fade-up" style={{ padding: '0 var(--page-px) 32px' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', marginBottom: 16, position: 'relative' }}>
        {([['social', 'Social'], ['following', 'Following'], ['search', 'Find People']] as const).map(([key, label]) => (
          <button key={key} onClick={() => {
            setTab(key)
            if (key === 'following' && !followingLoaded) loadFollowingPosts(1)
          }} style={{ background: 'none', border: 'none', padding: '14px 16px', fontSize: 14, fontWeight: tab === key ? 600 : 500, color: tab === key ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: -1, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />

        <button
          onClick={() => currentUserId ? setProfileUserId(currentUserId) : null}
          style={{ background: 'none', border: 'none', padding: '10px 12px', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, borderRadius: 8 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          My Profile
        </button>
      </div>

      {tab === 'social' || tab === 'following' ? (
        <>
          {/* Network switcher — visible to everyone on Social tab */}
          {tab === 'social' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['global', 'isd'] as const).map(net => (
                <button
                  key={net}
                  onClick={() => {
                    if (net !== network) {
                      setNetwork(net)
                      setPage(1)
                      setLoading(true)
                      setPosts([])
                      void loadPosts(1, net)
                    }
                  }}
                  style={{
                    padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${net === network ? 'var(--primary)' : 'var(--border)'}`,
                    background: net === network ? 'var(--primary)' : 'var(--surface-2)',
                    color: net === network ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >
                  {net === 'global' ? '🌐 Global' : '🏫 ISD'}
                </button>
              ))}
            </div>
          )}

          {/* New post composer / muted notice */}
          {isMuted ? (
            <div className="ns-card" style={{ padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>🔇</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f97316', marginBottom: 2 }}>You are muted</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {mutedUntil ? `Until ${new Date(mutedUntil).toLocaleString()}` : 'You cannot post until your mute expires.'}
                </div>
              </div>
            </div>
          ) : (
            <div className="ns-card" style={{ padding: 16, marginBottom: 20 }}>
              {!showGiveawayForm ? (
                <>
                  <textarea className="ns-input" style={{ width: '100%', resize: 'vertical' as const, height: 'auto', minHeight: 80, fontSize: 14, lineHeight: 1.6, padding: 14 }}
                    placeholder={network === 'isd' ? 'Post to your ISD…' : 'What are you studying today?'}
                    value={newPostBody}
                    onChange={e => { setNewPostBody(e.target.value); if (postError) setPostError(null) }}
                    rows={3}
                  />
                  {postError && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', marginTop: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8 }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>🚫</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#EF4444', marginBottom: 2 }}>Post blocked</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{postError}</div>
                      </div>
                      <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }} onClick={() => setPostError(null)}>×</button>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{newPostBody.length}/500</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {isDevUser && (
                        <button
                          className="ns-btn-ghost"
                          style={{ height: 38, padding: '0 14px', fontSize: 13 }}
                          onClick={() => setShowGiveawayForm(true)}
                        >
                          🎁 Giveaway
                        </button>
                      )}
                      <button className="ns-btn-primary" style={{ height: 38, padding: '0 20px', opacity: newPostBody.trim() && !posting ? 1 : 0.5 }}
                        onClick={handleCreatePost} disabled={!newPostBody.trim() || posting}>
                        {posting ? 'Posting…' : 'Post'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Giveaway creator */
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'gold' }}>🎁 Create Giveaway</span>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }} onClick={() => setShowGiveawayForm(false)}>×</button>
                  </div>
                  {/* Type toggle */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' as const }}>
                    {([['tag', '🏷️ Tag'], ['coin', null], ['name-color', '🎨 Name Color'], ['pfp', '🖼️ PFP Effect']] as const).map(([t, label]) => (
                      <button key={t} onClick={() => { setGwType(t); setGwItemId('') }} style={{ flex: 1, minWidth: 80, height: 34, borderRadius: 8, border: `1px solid ${gwType === t ? 'gold' : 'var(--border)'}`, background: gwType === t ? 'rgba(255,215,0,0.12)' : 'transparent', color: gwType === t ? 'gold' : 'var(--text-secondary)', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        {t === 'coin' ? <><CoinIcon size={13} /> Coins</> : label}
                      </button>
                    ))}
                  </div>
                  <textarea className="ns-input" style={{ width: '100%', resize: 'vertical' as const, minHeight: 60, fontSize: 14, lineHeight: 1.6, padding: 12, marginBottom: 10 }}
                    placeholder={
                      gwType === 'coin' ? "Announce the giveaway… (e.g. 'Enter to win 500 coins!')"
                      : gwType === 'name-color' ? "Announce the giveaway… (e.g. 'Win a legendary name color!')"
                      : gwType === 'pfp' ? "Announce the giveaway… (e.g. 'Enter to win a rare PFP effect!')"
                      : "Announce the giveaway… (e.g. 'Enter to win a limited VIP tag!')"
                    }
                    value={gwBody}
                    onChange={e => setGwBody(e.target.value)}
                    rows={2}
                  />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 10 }}>
                    {gwType === 'tag' ? (
                      <>
                        <input className="ns-input" style={{ flex: 1, minWidth: 100, height: 36, fontSize: 13 }}
                          placeholder="Tag name (e.g. VIP)"
                          value={gwTag}
                          onChange={e => setGwTag(e.target.value)}
                        />
                        <input className="ns-input" style={{ width: 90, height: 36, fontSize: 13 }}
                          placeholder="Color"
                          value={gwColor}
                          onChange={e => setGwColor(e.target.value)}
                        />
                      </>
                    ) : gwType === 'coin' ? (
                      <input className="ns-input" style={{ flex: 1, height: 36, fontSize: 13 }}
                        placeholder="Coin amount (e.g. 500)"
                        type="number"
                        min="1"
                        value={gwCoins}
                        onChange={e => setGwCoins(e.target.value)}
                      />
                    ) : gwType === 'name-color' ? (
                      <select className="ns-input" style={{ flex: 1, height: 36, fontSize: 13 }} value={gwItemId} onChange={e => setGwItemId(e.target.value)}>
                        <option value="">Pick a name color…</option>
                        {GW_NAME_COLOR_ITEMS.map(i => (
                          <option key={i.id} value={i.id}>{i.name} ({i.rarity})</option>
                        ))}
                      </select>
                    ) : (
                      <select className="ns-input" style={{ flex: 1, height: 36, fontSize: 13 }} value={gwItemId} onChange={e => setGwItemId(e.target.value)}>
                        <option value="">Pick a PFP effect…</option>
                        {GW_PFP_ITEMS.map(i => (
                          <option key={i.id} value={i.id}>{i.name} ({i.rarity})</option>
                        ))}
                      </select>
                    )}
                    <select className="ns-input" style={{ height: 36, fontSize: 13 }} value={gwDuration} onChange={e => setGwDuration(e.target.value)}>
                      <option value="30">30 min</option>
                      <option value="60">1 hour</option>
                      <option value="360">6 hours</option>
                      <option value="720">12 hours</option>
                      <option value="1440">24 hours</option>
                      <option value="4320">3 days</option>
                      <option value="10080">1 week</option>
                    </select>
                  </div>
                  {/* Live preview for name-color / pfp */}
                  {(gwType === 'name-color' || gwType === 'pfp') && gwItemId && (() => {
                    const item = gwType === 'name-color'
                      ? GW_NAME_COLOR_ITEMS.find(i => i.id === gwItemId)
                      : GW_PFP_ITEMS.find(i => i.id === gwItemId)
                    if (!item) return null
                    const isRainbow = item.value === 'rainbow'
                    return (
                      <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, border: '1px solid var(--border)' }}>
                        {gwType === 'pfp' ? (
                          <div className={pfpClass(item.value)} style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0, ...pfpStyle(item.value) }}>D</div>
                        ) : (
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>D</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span className={gwType === 'name-color' && isRainbow ? 'name-rainbow' : ''} style={{ fontSize: 13, fontWeight: 700, ...(gwType === 'name-color' && !isRainbow ? { color: item.value } : {}) }}>
                            DUMMY
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>[Student] · {item.rarity}</span>
                        </div>
                      </div>
                    )
                  })()}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="ns-btn-ghost" style={{ height: 36, padding: '0 14px', fontSize: 13 }} onClick={() => setShowGiveawayForm(false)}>Cancel</button>
                    <button
                      style={{ height: 36, padding: '0 20px', fontSize: 13, fontWeight: 700, background: 'gold', color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: gwBody.trim() && (gwType === 'coin' ? parseInt(gwCoins) > 0 : gwType === 'name-color' || gwType === 'pfp' ? !!gwItemId : gwTag.trim()) && !creatingGw ? 1 : 0.5 }}
                      onClick={handleCreateGiveaway}
                      disabled={!gwBody.trim() || (gwType === 'coin' ? !parseInt(gwCoins) : gwType === 'name-color' || gwType === 'pfp' ? !gwItemId : !gwTag.trim()) || creatingGw}
                    >
                      {creatingGw ? 'Creating…' : 'Launch Giveaway'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Posts */}
          {tab === 'social' ? (
            loading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>Loading feed…</div>
            ) : feedError ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#EF4444', marginBottom: 6 }}>Failed to load feed</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Something went wrong on the server. Try refreshing.</p>
                {feedError && typeof feedError === 'string' && <p style={{ fontSize: 11, color: '#EF4444', marginBottom: 16, fontFamily: 'monospace', background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 6, wordBreak: 'break-all' }}>{feedError}</p>}
                <button className="ns-btn-ghost" style={{ fontSize: 13 }} onClick={() => { setLoading(true); void loadPosts(1) }}>Retry</button>
              </div>
            ) : network === 'isd' && !isdCode ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🏫</div>
                <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Link your school to see ISD posts</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Connect your school portal in Settings to view and post in your district feed.</p>
                <a href="/settings" style={{ display: 'inline-block', padding: '9px 22px', borderRadius: 20, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Go to Settings</a>
              </div>
            ) : posts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No posts yet</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Be the first to share what you&apos;re studying!</p>
              </div>
            ) : (
              <>
                {posts.map(post => (
                  <PostCard key={post.id} post={post} onLike={handleLike} onDelete={handleDelete}
                    onOpenComments={id => setCommentPostId(id)} onOpenProfile={id => setProfileUserId(id)}
                    onFollow={handleFollow} onEnterGiveaway={handleEnterGiveaway}
                    onDrawGiveaway={handleDrawGiveaway} onPin={handlePin}
                    currentUserId={currentUserId} followedUsers={followedUsers} isDevUser={isDevUser} isModUser={isModUser} />
                ))}
                <div ref={sentinelRef} style={{ height: 1 }} />
                {loadingMore && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Loading…</div>
                )}
              </>
            )
          ) : (() => {
            // Following tab — only show posts from the last 24 hours
            const cutoff = Date.now() - 86400000
            const recentFollowingPosts = followingPosts.filter(p => new Date(p.createdAt).getTime() >= cutoff)
            const isFollowingAnyone = followedUsers.size > 0

            if (followingLoading && followingPosts.length === 0) {
              return <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>Loading…</div>
            }
            if (recentFollowingPosts.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                  </div>
                  {isFollowingAnyone ? (
                    <>
                      <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No new posts</p>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No one you follow has posted in the last 24 hours.</p>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Nothing here yet</p>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Follow people in <strong>Find People</strong> to see their posts here.</p>
                    </>
                  )}
                </div>
              )
            }
            return (
              <>
                {recentFollowingPosts.map(post => (
                  <PostCard key={post.id} post={post} onLike={handleLike} onDelete={handleDelete}
                    onOpenComments={id => setCommentPostId(id)} onOpenProfile={id => setProfileUserId(id)}
                    onFollow={handleFollow} onEnterGiveaway={handleEnterGiveaway}
                    onDrawGiveaway={handleDrawGiveaway} onPin={handlePin}
                    currentUserId={currentUserId} followedUsers={followedUsers} isDevUser={isDevUser} isModUser={isModUser} />
                ))}
              </>
            )
          })()}
        </>
      ) : (
        <UserSearch currentUserId={currentUserId} onOpenProfile={id => setProfileUserId(id)}
          followedUsers={followedUsers} onFollow={handleFollow} />
      )}

    </div>

    {commentPostId !== null && (
      <CommentSection
        postId={commentPostId}
        onClose={() => setCommentPostId(null)}
        onCommentAdded={() => setPosts(prev => prev.map(p => p.id === commentPostId ? { ...p, _count: { ...p._count, comments: p._count.comments + 1 } } : p))}
        currentUserId={currentUserId}
        onOpenProfile={id => { setCommentPostId(null); setProfileUserId(id) }}
        isMuted={isMuted}
        mutedUntil={mutedUntil}
      />
    )}

    {profileUserId !== null && (
      <UserProfileOverlay
        userId={profileUserId}
        onClose={() => setProfileUserId(null)}
        currentUserId={currentUserId}
        onViewPost={postId => { setProfileUserId(null); setViewPostId(postId) }}
      />
    )}

    {viewPostId !== null && (
      <PostDetailModal
        postId={viewPostId}
        onClose={() => setViewPostId(null)}
        currentUserId={currentUserId}
        onOpenProfile={id => { setViewPostId(null); setProfileUserId(id) }}
      />
    )}
    </>
  )
}


// ── Style objects ──────────────────────────────────────────────────────────────

const P: Record<string, React.CSSProperties> = {
  avatar:     { width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 },
  authorName: { fontSize: 14, fontWeight: 700, color: 'var(--text)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 },
  tag:        { fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4 },
  tagDev:     { fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, border: '1px solid #ff6b6b', color: '#ff6b6b', background: 'rgba(255,107,107,0.12)' },
  tagGod:     { fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, border: '1px solid #b8860b', color: '#b8860b', background: 'rgba(184,134,11,0.10)' },
  followBtn:  { padding: '2px 9px', borderRadius: 5, border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', fontWeight: 600, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  deleteBtn:  { marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' },
  actionBtn:  { background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 6, fontWeight: 600 },
}

function tagCssClass(tag?: string | null, tagColor?: string | null): string {
  if (tag === 'DEV') return 'tag-rainbow'
  if (tag === 'VIP') return 'tag-mythic'
  if (tag === 'GOAT') return 'tag-god'
  if (tag === 'Prodigy') return 'tag-prodigy'
  if (tag === 'Valedictorian') return 'tag-valedictorian'
  if (tagColor === 'curse') return 'tag-curse'
  return ''
}
function isAnimatedTag(tag?: string | null): boolean {
  return tag === 'DEV' || tag === 'VIP' || tag === 'GOAT' || tag === 'Prodigy' || tag === 'Valedictorian'
}

const N: Record<string, React.CSSProperties> = {
  panel:   { position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 320, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.35)', zIndex: 300, overflow: 'hidden' },
  header:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' },
  title:   { fontSize: 13.5, fontWeight: 700, color: 'var(--text)' },
  markAll: { fontSize: 11.5, color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 },
  list:    { maxHeight: 360, overflowY: 'auto' },
  empty:   { padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 },
  item:    { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)' },
  text:    { fontSize: 13, color: 'var(--text)', lineHeight: 1.4 },
  time:    { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 },
  toast:   { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--primary)', borderRadius: 10, padding: '12px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', minWidth: 260, maxWidth: 340, pointerEvents: 'auto', animation: 'fadeUp 0.25s ease' },
}

const O: Record<string, React.CSSProperties> = {
  overlay:    { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  panel:      { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '90%', maxWidth: 480, maxHeight: '85vh', overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column' as const },
  header:     { display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' },
  avatar:     { width: 54, height: 54, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, flexShrink: 0 },
  name:       { fontSize: 19, fontWeight: 800, color: 'var(--text)', marginBottom: 3 },
  tag:        { fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-dim)', padding: '2px 8px', borderRadius: 4, display: 'inline-block' },
  tagDev:     { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, border: '1px solid #ff6b6b', color: '#ff6b6b', background: 'rgba(255,107,107,0.12)', display: 'inline-block' },
  tagGod:     { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, border: '1px solid #b8860b', color: '#b8860b', background: 'rgba(184,134,11,0.10)', display: 'inline-block' },
  email:      { fontSize: 12, color: 'var(--text-muted)', marginTop: 3 },
  closeBtn:   { marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: 6, display: 'flex', alignItems: 'center', flexShrink: 0 },
  stats:      { display: 'flex', justifyContent: 'space-around', padding: '14px 0', borderBottom: '1px solid var(--border)', marginBottom: 16 },
  postsTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 },
  postCard:   { padding: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 },
}
