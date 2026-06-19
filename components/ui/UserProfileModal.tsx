'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, FeedPost, FeedUserProfile } from '@/lib/api'
import Portal from './Portal'

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function parseHacName(raw: string | null | undefined): string {
  if (!raw) return ''
  if (raw.includes(',')) {
    const [rawLast, rawRest = ''] = raw.split(',')
    const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''
    return `${cap(rawRest.trim().split(' ')[0])} ${cap(rawLast.trim())}`.trim()
  }
  return raw
}
function displayName(user: { name: string | null }): string {
  return parseHacName(user.name) || 'User'
}
function initials(user: { name: string | null }): string {
  const n = parseHacName(user.name) || 'U'
  const parts = n.trim().split(' ')
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : n.slice(0, 2).toUpperCase()
}
function avatarContent(user: { name: string | null; avatarUrl?: string | null }): React.ReactNode {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
  }
  return initials(user)
}

const PFP_BORDER_MAP: Record<string, string> = {
  'border-green': '#22C55E', 'border-blue': '#3B82F6', 'border-red': '#EF4444',
  'border-navy': '#1D4ED8', 'border-teal': '#14B8A6', 'border-orange': '#F97316',
  'border-violet': '#7C3AED', 'border-cyan': '#06B6D4', 'border-hotpink': '#EC4899',
  'border-gold': '#D97706', 'border-lime': '#84CC16',
}
const PFP_GLOW_MAP: Record<string, [string, string]> = {
  'glow-pink': ['#EC4899', '#EC489955'],
  'glow-purple': ['#8B5CF6', '#8B5CF655'],
}
function pfpStyle(effect: string | null | undefined): React.CSSProperties {
  if (!effect) return {}
  if (effect === 'rainbow') return { background: '#ff0000', border: '3px solid #ff0000', boxShadow: '0 0 14px #ff000088', color: '#fff' }
  if (effect === 'glow-gold' || effect === 'frame-black') return {}
  if (PFP_BORDER_MAP[effect]) return { border: `2px solid ${PFP_BORDER_MAP[effect]}` }
  if (PFP_GLOW_MAP[effect]) return { border: `2px solid ${PFP_GLOW_MAP[effect][0]}`, boxShadow: `0 0 12px ${PFP_GLOW_MAP[effect][1]}` }
  return {}
}
function pfpClass(effect: string | null | undefined): string {
  if (effect === 'rainbow') return 'pfp-rainbow'
  if (effect === 'glow-gold') return 'pfp-gold-fill'
  if (effect === 'frame-black') return 'pfp-void-fill'
  return ''
}
function nameColorStyle(color: string | null | undefined): React.CSSProperties {
  return color && color !== 'rainbow' ? { color } : {}
}
function nameColorClass(color: string | null | undefined): string {
  return color === 'rainbow' ? 'name-rainbow' : ''
}

interface Props {
  userId: number
  currentUserId: number
  onClose: () => void
}

export default function UserProfileModal({ userId, currentUserId, onClose }: Props) {
  const router = useRouter()
  const [profile, setProfile] = useState<FeedUserProfile | null>(null)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [postsLoading, setPostsLoading] = useState(true)
  const [following, setFollowing] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.feedUserProfile(userId).then(d => {
      if (!cancelled) { setProfile(d); setFollowing(d.isFollowing); setLoading(false) }
    }).catch(() => { if (!cancelled) setLoading(false) })
    api.feedUserPosts(userId).then(d => {
      if (!cancelled) { setPosts(d.posts); setPostsLoading(false) }
    }).catch(() => { if (!cancelled) setPostsLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  async function handleFollow() {
    try {
      const r = await api.feedToggleFollow(userId)
      setFollowing(r.following)
      setProfile(prev => prev ? {
        ...prev,
        isFollowing: r.following,
        _count: { ...prev._count, followers: r.following ? prev._count.followers + 1 : prev._count.followers - 1 },
      } : prev)
    } catch { /* ignore */ }
  }

  async function handleLike(postId: number) {
    try {
      const r = await api.feedToggleLike(postId)
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, likedByMe: r.liked, _count: { ...p._count, likes: r.liked ? p._count.likes + 1 : p._count.likes - 1 } }
        : p
      ))
    } catch { /* ignore */ }
  }

  function handleViewPost(postId: number) {
    onClose()
    router.push(`/feed?post=${postId}`)
  }

  const isDevTag = profile?.tag === 'DEV'
  const isGodTag = profile?.tag === 'GOAT'
  const isMythicTag = profile?.tag === 'GOD'

  return (
    <Portal>
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>Loading profile…</div>
        ) : !profile ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>User not found</div>
        ) : (
          <>
            <div style={S.header}>
              <div
                className={pfpClass(profile.pfpEffect)}
                style={{ ...S.avatar, ...pfpStyle(profile.pfpEffect), ...(profile.avatarUrl ? { background: 'none', padding: 0 } : {}) }}
              >
                {avatarContent(profile)}
              </div>
              <div style={{ flex: 1 }}>
                <div className={nameColorClass(profile.nameColor)} style={{ ...S.name, ...nameColorStyle(profile.nameColor) }}>
                  {displayName(profile)}
                </div>
                {profile.tag && !profile.chatBanned && (
                  <span
                    className={isDevTag ? 'tag-rainbow' : isMythicTag ? 'tag-mythic' : isGodTag ? 'tag-god' : ''}
                    style={isDevTag ? S.tagDev : isMythicTag ? { ...S.tagGod, color: undefined, background: undefined, border: undefined } : isGodTag ? S.tagGod : {
                      ...S.tag,
                      color: profile.tagColor || 'var(--text-secondary)',
                      background: profile.tagColor ? `${profile.tagColor}22` : 'rgba(128,128,128,0.12)',
                      border: `1px solid ${profile.tagColor || 'rgba(128,128,128,0.4)'}`,
                    }}
                  >{profile.tag}</span>
                )}
              </div>
              <button style={S.closeBtn} onClick={onClose}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div style={S.stats}>
              {[
                { v: profile._count.followers, l: 'Followers' },
                { v: profile._count.following, l: 'Following' },
                { v: profile._count.posts, l: 'Posts' },
                { v: profile.totalLikes, l: 'Likes' },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' as const }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase' as const, letterSpacing: '0.4px' }}>{s.l}</div>
                </div>
              ))}
            </div>

            {userId !== currentUserId && (
              <button
                className={following ? 'ns-btn-ghost' : 'ns-btn-primary'}
                style={{ width: '100%', height: 40, marginBottom: 20, fontSize: 14 }}
                onClick={handleFollow}
              >
                {following ? 'Following' : 'Follow'}
              </button>
            )}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <p style={S.postsTitle}>Posts</p>
              {postsLoading ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading posts…</div>
              ) : posts.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No posts yet.</div>
              ) : posts.map(post => (
                <div
                  key={post.id}
                  style={S.postCard}
                  onClick={() => handleViewPost(post.id)}
                >
                  <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text)', whiteSpace: 'pre-wrap' as const }}>{post.body}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{timeAgo(post.createdAt)}</span>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: post.likedByMe ? '#EF4444' : 'var(--text-secondary)', padding: 0 }}
                      onClick={e => { e.stopPropagation(); void handleLike(post.id) }}
                    >
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
    </div>
    </Portal>
  )
}

const S: Record<string, React.CSSProperties> = {
  overlay:    { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  panel:      { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '90%', maxWidth: 480, maxHeight: '85vh', overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column' as const },
  header:     { display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' },
  avatar:     { width: 54, height: 54, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, flexShrink: 0 },
  name:       { fontSize: 19, fontWeight: 800, color: 'var(--text)', marginBottom: 3 },
  tag:        { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, display: 'inline-block' },
  tagDev:     { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, border: '1px solid #ff6b6b', color: '#ff6b6b', background: 'rgba(255,107,107,0.12)', display: 'inline-block' },
  tagGod:     { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, border: '1px solid #b8860b', color: '#b8860b', background: 'rgba(184,134,11,0.10)', display: 'inline-block' },
  closeBtn:   { marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', flexShrink: 0 },
  stats:      { display: 'flex', justifyContent: 'space-around', padding: '14px 0', borderBottom: '1px solid var(--border)', marginBottom: 16 },
  postsTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 },
  postCard:   { padding: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, cursor: 'pointer' },
}
