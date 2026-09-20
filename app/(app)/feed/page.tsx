'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import { api, FeedPost, FeedComment, FeedUserProfile, AppNotification } from '@/lib/api'
import { DevAdminPanel, ModPanel } from '@/components/ui/DevAdminPanel'
import {
  UserIcon, HeartFilledIcon, HeartOutlineIcon, BooksIcon,
  ChatBubbleIcon, BanIcon, MuteIcon,
  GlobeIcon, SchoolBuildingIcon, ArrowRightIcon,
} from '@/components/icons'

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

function avatarContent(user: { name: string | null; avatarUrl?: string | null }): React.ReactNode {
  if (user.avatarUrl) return <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
  return initials(user)
}

// ── Notification row with clickable sender name ───────────────────────────────

function NotifRow({ n, onOpenProfile, onClose }: { n: AppNotification; onOpenProfile: (id: number) => void; onClose: () => void }) {
  const name = parseHacName(n.sender.name) || 'User'

  function handleNameClick(e: React.MouseEvent) {
    e.stopPropagation()
    onClose()
    onOpenProfile(n.fromUserId)
  }

  const nameEl = (
    <button
      style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: 'inherit' }}
      onClick={handleNameClick}
    >
      {name}
    </button>
  )

  let content: React.ReactNode
  if (n.type === 'FOLLOW') content = <>{nameEl} started following you</>
  else if (n.type === 'LIKE') content = <>{nameEl} liked your post</>
  else if (n.type === 'COMMENT') content = n.preview ? <>{nameEl}: &quot;{n.preview}&quot;</> : <>{nameEl} commented on your post</>
  else if (n.type === 'ASSIGNMENT_CREATED') content = <>{n.preview ?? 'New assignment added'}</>
  else content = null

  const icon: React.ReactNode = n.type === 'FOLLOW' ? <UserIcon size={15}/>
    : n.type === 'LIKE' ? <HeartFilledIcon size={15}/>
    : n.type === 'ASSIGNMENT_CREATED' ? <BooksIcon size={15}/>
    : <ChatBubbleIcon size={15}/>

  if (!content) return null

  return (
    <div style={{ ...N.item, background: n.read ? 'transparent' : 'rgba(43,74,142,0.07)' }}>
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
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
              <div style={{ ...O.avatar, ...(profile.avatarUrl ? { background: 'none', padding: 0 } : {}) }}>{avatarContent(profile)}</div>
              <div style={{ flex: 1 }}>
                <div style={O.name}>{displayName(profile)}</div>
                {profile.hacName && parseHacName(profile.hacName) !== displayName(profile) && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 3 }}>{parseHacName(profile.hacName)}</div>
                )}
                {profile.lastSeenAt && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>Last active {timeAgo(profile.lastSeenAt)}</div>
                )}
                {(profile.chatBanned || (profile.chatMutedUntil && new Date(profile.chatMutedUntil) > new Date())) && (
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, display: 'inline-block', ...(profile.chatBanned ? { color: '#EF4444', background: '#EF444422', border: '1px solid #EF4444' } : { color: '#f97316', background: '#f9731622', border: '1px solid #f97316' }) }}>
                    {profile.chatBanned ? 'BANNED' : 'MUTED'}
                  </span>
                )}
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
              </div>
            )}

            {/* DEV/Admin panel */}
            <DevAdminPanel
              profile={profile}
              userId={userId}
              currentUserId={currentUserId}
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
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: post.likedByMe ? '#EF4444' : 'var(--text-secondary)', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }} onClick={e => { e.stopPropagation(); void handleLike(post.id) }}>
                      {post.likedByMe ? <HeartFilledIcon size={12}/> : <HeartOutlineIcon size={12}/>}{' '}{post._count.likes}
                    </button>
                  </div>
                  <div style={{ marginTop: 5, fontSize: 11, color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>View full post & comments <ArrowRightIcon size={11}/></div>
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

// ── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ post, onLike, onDelete, onOpenComments, onOpenProfile, onFollow, onPin, currentUserId, followedUsers, isDevUser, isModUser }: {
  post: FeedPost
  onLike: (id: number) => void
  onDelete: (id: number) => void
  onOpenComments: (id: number) => void
  onOpenProfile: (userId: number) => void
  onFollow: (userId: number) => void
  onPin: (id: number, currentlyPinned: boolean) => void
  currentUserId: number
  followedUsers: Set<number>
  isDevUser: boolean
  isModUser: boolean
}) {
  const isFollowing = followedUsers.has(post.userId)
  const canDelete = post.userId === currentUserId || isDevUser || isModUser
  const isPinned = !!post.pinnedUntil && new Date(post.pinnedUntil) > new Date()

  return (
    <div className="ns-card" style={{ padding: 16, marginBottom: 12, ...(isPinned ? { border: '1px solid rgba(43,74,142,0.3)' } : {}) }}>
      {/* Pinned banner */}
      {isPinned && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
          PINNED
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ ...P.avatar, ...(post.user.avatarUrl ? { background: 'none', padding: 0 } : {}) }}>{avatarContent(post.user)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
            <span style={P.authorName} onClick={() => onOpenProfile(post.user.id)}>{displayName(post.user)}</span>
            {post.userId !== currentUserId && (
              <button
                style={{ ...P.followBtn, ...(isFollowing ? { background: 'var(--primary)', color: '#FFFFFF', border: '1px solid var(--primary)' } : {}) }}
                onClick={e => { e.stopPropagation(); onFollow(post.userId) }}
              >{isFollowing ? 'Following' : 'Follow'}</button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{timeAgo(post.createdAt)}</span>
            {post.network === 'isd' && <span style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 4, padding: '1px 5px', display: 'inline-flex', alignItems: 'center', gap: 3 }}><SchoolBuildingIcon size={10}/> ISD</span>}
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
                style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0, cursor: 'pointer', ...(post.user.avatarUrl ? { background: 'none', padding: 0, overflow: 'hidden' } : {}) }}
                onClick={() => { onClose(); onOpenProfile(post.user.id) }}
              >
                {avatarContent(post.user)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <button
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: 14, fontWeight: 700, cursor: 'pointer', color: 'var(--text)' }}
                    onClick={() => { onClose(); onOpenProfile(post.user.id) }}
                  >{displayName(post.user)}</button>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(post.createdAt)}</span>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap' as const, marginBottom: 10 }}>{post.body}</div>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: post.likedByMe ? '#EF4444' : 'var(--text-secondary)', padding: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}
                  onClick={handleLikePost}
                >{post.likedByMe ? <HeartFilledIcon size={14}/> : <HeartOutlineIcon size={14}/>}{' '}{post._count.likes}</button>
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
                      style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, flexShrink: 0, cursor: 'pointer', ...(c.user.avatarUrl ? { background: 'none', padding: 0, overflow: 'hidden' } : {}) }}
                      onClick={() => { onClose(); onOpenProfile(c.user.id) }}
                    >{avatarContent(c.user)}</div>
                    <button
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--text)' }}
                      onClick={() => { onClose(); onOpenProfile(c.user.id) }}
                    >{displayName(c.user)}</button>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{timeAgo(c.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text)', marginBottom: 4 }}>{c.body}</div>
                  <button
                    disabled={likingId !== null}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: c.likedByMe ? '#EF4444' : 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}
                    onClick={() => void handleLikeComment(c.id)}
                  >{c.likedByMe ? <HeartFilledIcon size={12}/> : <HeartOutlineIcon size={12}/>}{' '}{c._count.likes}</button>
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
          ) : sorted.map(c => (
              <div key={c.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div
                    style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, flexShrink: 0, cursor: 'pointer', ...(c.user.avatarUrl ? { background: 'none', padding: 0, overflow: 'hidden' } : {}) }}
                    onClick={() => { onClose(); onOpenProfile(c.user.id) }}
                  >
                    {avatarContent(c.user)}
                  </div>
                  <button
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, color: 'var(--text)' }}
                    onClick={() => { onClose(); onOpenProfile(c.user.id) }}
                  >
                    {displayName(c.user)}
                  </button>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{timeAgo(c.createdAt)}</span>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text)', marginBottom: 6 }}>{c.body}</div>
                <button
                  disabled={likingId !== null}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: likingId !== null ? 'default' : 'pointer', fontSize: 12, color: c.likedByMe ? '#EF4444' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, opacity: likingId === c.id ? 0.5 : 1 }}
                  onClick={() => void handleCommentLike(c.id)}
                >
                  {c.likedByMe ? <HeartFilledIcon size={12}/> : <HeartOutlineIcon size={12}/>}{' '}{c._count?.likes ?? 0}
                </button>
              </div>
            )
          )}
        </div>
        {isMuted ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 8 }}>
            <MuteIcon size={18}/>
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
                <BanIcon size={16}/>
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
  const [results, setResults] = useState<Array<{ id: number; name: string | null; avatarUrl?: string | null }>>([])
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
            <span style={{ fontSize: 14, fontWeight: 600 }}>{displayName(u)}</span>
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
    api.authMe()
      .then(me => {
        const uid = me.id || 0
        setCurrentUserId(uid)
        if (uid) {
          return api.feedUserProfile(uid).then(p => {
            setIsDevUser(p.role === 'ADMIN' || p.role === 'DEV')
            setIsModUser(p.role === 'MODERATOR')
            setIsBanned(p.chatBanned)
            const activeMute = !!p.chatMutedUntil && new Date(p.chatMutedUntil) > new Date()
            setIsMuted(activeMute)
            setMutedUntil(p.chatMutedUntil)
            if (p.isdCode) { setIsdCode(p.isdCode); setIsdDisplayName(p.isdDisplayName ?? null) }
            setStatusLoaded(true)
          })
        }
        setStatusLoaded(true)
      })
      .catch(() => setStatusLoaded(true))
    loadPosts(1)
  }, [loadPosts])

  // WebSocket — NEW_POST events only (notifications handled globally by NotificationBell in layout).
  // Auth happens server-side via the httpOnly cookie sent on the handshake.
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    const wsBase = process.env.NEXT_PUBLIC_WS_URL ?? apiUrl.replace(/^http/, 'ws')
    let ws: WebSocket, dead = false
    function connect() {
      if (dead) return
      ws = new WebSocket(wsBase)
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
                      setPosts(prev => [{ ...msg.data, likedByMe: false }, ...prev])
                    }
                    return currentIsd
                  })
                } else {
                  setPosts(prev => [{ ...msg.data, likedByMe: false }, ...prev])
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

  function handleOpenProfile(uid: number) {
    setProfileUserId(uid)
  }

  if (statusLoaded && isBanned) {
    return (
      <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '0 var(--page-px)', textAlign: 'center' }}>
        <div style={{ marginBottom: 16 }}><BanIcon size={48}/></div>
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
                  {net === 'global' ? <><GlobeIcon size={13}/> Global</> : <><SchoolBuildingIcon size={13}/> ISD</>}
                </button>
              ))}
            </div>
          )}

          {/* New post composer / muted notice */}
          {isMuted ? (
            <div className="ns-card" style={{ padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <MuteIcon size={22}/>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f97316', marginBottom: 2 }}>You are muted</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {mutedUntil ? `Until ${new Date(mutedUntil).toLocaleString()}` : 'You cannot post until your mute expires.'}
                </div>
              </div>
            </div>
          ) : (
            <div className="ns-card" style={{ padding: 16, marginBottom: 20 }}>
              <textarea className="ns-input" style={{ width: '100%', resize: 'vertical' as const, height: 'auto', minHeight: 80, fontSize: 14, lineHeight: 1.6, padding: 14 }}
                placeholder={network === 'isd' ? 'Post to your ISD…' : 'What are you studying today?'}
                value={newPostBody}
                onChange={e => { setNewPostBody(e.target.value); if (postError) setPostError(null) }}
                rows={3}
              />
              {postError && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', marginTop: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8 }}>
                  <BanIcon size={18}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#EF4444', marginBottom: 2 }}>Post blocked</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{postError}</div>
                  </div>
                  <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }} onClick={() => setPostError(null)}>×</button>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{newPostBody.length}/500</span>
                <button className="ns-btn-primary" style={{ height: 38, padding: '0 20px', opacity: newPostBody.trim() && !posting ? 1 : 0.5 }}
                  onClick={handleCreatePost} disabled={!newPostBody.trim() || posting}>
                  {posting ? 'Posting…' : 'Post'}
                </button>
              </div>
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
                <div style={{ marginBottom: 16 }}><SchoolBuildingIcon size={40}/></div>
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
                    onFollow={handleFollow} onPin={handlePin}
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
                    onFollow={handleFollow} onPin={handlePin}
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
  followBtn:  { padding: '2px 9px', borderRadius: 5, border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', fontWeight: 600, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  deleteBtn:  { marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' },
  actionBtn:  { background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 6, fontWeight: 600 },
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
  panel:      { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '90%', maxWidth: 480, maxHeight: '85vh', overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column' as const, boxShadow: 'var(--neo-raised), var(--shadow-xl)' },
  header:     { display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' },
  avatar:     { width: 54, height: 54, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, flexShrink: 0 },
  name:       { fontSize: 19, fontWeight: 800, color: 'var(--text)', marginBottom: 3 },
  email:      { fontSize: 12, color: 'var(--text-muted)', marginTop: 3 },
  closeBtn:   { marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: 6, display: 'flex', alignItems: 'center', flexShrink: 0 },
  stats:      { display: 'flex', justifyContent: 'space-around', padding: '14px 0', borderBottom: '1px solid var(--border)', marginBottom: 16 },
  postsTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 },
  postCard:   { padding: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, boxShadow: 'var(--neo-raised)' },
}
