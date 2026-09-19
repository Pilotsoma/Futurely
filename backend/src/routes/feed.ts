import { Router, Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { broadcast, sendToUser } from '../lib/websocket';
import { filterContent, recordViolation } from '../lib/contentFilter';
import { AuthRequest } from '../middleware/auth';
import { requireAdmin, requireMod, hasDevPowers, hasModOrDevPowers } from '../middleware/requireAdmin';

// Keyed by authenticated userId so shared NAT IPs don't block other users.
const userKey = (req: Request): string => {
  const userId = (req as AuthRequest).userId
  return userId !== undefined ? String(userId) : ipKeyGenerator(req.ip ?? 'anon')
}

const postCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: userKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Posting too fast. Wait a moment.' } },
})

const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyGenerator: userKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Commenting too fast. Wait a moment.' } },
})

const followLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 200,
  keyGenerator: userKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many follow actions in one hour.' } },
})

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

const modDeleteLog = new Map<number, { date: string; count: number }>();
const MOD_DAILY_DELETE_LIMIT = 5;

function getModDeletesToday(userId: number): number {
  const today = new Date().toISOString().slice(0, 10);
  const entry = modDeleteLog.get(userId);
  return (entry && entry.date === today) ? entry.count : 0;
}

function recordModDelete(userId: number) {
  const today = new Date().toISOString().slice(0, 10);
  const entry = modDeleteLog.get(userId);
  if (!entry || entry.date !== today) {
    modDeleteLog.set(userId, { date: today, count: 1 });
  } else {
    entry.count++;
  }
}

const USER_SELECT = {
  id: true, name: true,
  avatarUrl: true,
  chatBanned: true, chatMutedUntil: true,
  role: true,
} as const;

type RawUser = {
  id: number; name: string | null; hacName?: string | null;
  avatarUrl: string | null;
  chatBanned: boolean; chatMutedUntil: Date | null;
  role: string;
};

function toFeedUser(u: RawUser) {
  if (u.chatBanned) return { id: u.id, name: u.name, hacName: u.hacName ?? null, avatarUrl: null as string | null, role: u.role };
  if (u.chatMutedUntil && u.chatMutedUntil > new Date()) return { id: u.id, name: u.name, hacName: u.hacName ?? null, avatarUrl: null as string | null, role: u.role };
  return { id: u.id, name: u.name, hacName: u.hacName ?? null, avatarUrl: u.avatarUrl, role: u.role };
}

/* ---------- Social Feed (all posts, ranked) ---------- */
router.get('/posts', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const network = (req.query.network as string) || 'global';
    const userId = (req as AuthRequest).userId as number;
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // For ISD network, resolve requesting user's district
    let isdCode: string | null = null;
    if (network === 'isd') {
      const sc = await prisma.schoolConnection.findUnique({ where: { userId }, select: { districtUrl: true } });
      if (!sc) return res.status(403).json({ error: 'You must link your HAC to access the ISD feed.' });
      isdCode = sc.districtUrl;
    }

    // Social feed: last 24h posts + currently-pinned posts (all types expire after 24h)
    const allPosts = await prisma.post.findMany({
      where: {
        network,
        ...(network === 'isd' && isdCode ? { isdCode } : {}),
        OR: [
          { createdAt: { gte: cutoff } },
          { pinnedUntil: { gt: now } },
        ],
      },
      take: 200,
      include: {
        user: {
          select: {
            id: true, name: true,
            avatarUrl: true,
            chatBanned: true, chatMutedUntil: true,
            role: true,
            _count: { select: { followers: true } },
          },
        },
        likes: { select: { userId: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    // Ranking: pinned first, then balanced recency + engagement.
    // New posts get a freshness boost, but trending posts with active
    // engagement can climb above quiet new posts.
    // DEV/ADMIN posts get a moderate boost.
    const ranked = allPosts
      .map(p => {
        const isPinned = p.pinnedUntil && p.pinnedUntil > now;
        const isPromoted = p.user.role === 'DEV' || p.user.role === 'ADMIN';
        const hoursSinceCreation = Math.max(0, (now.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60));
        const recencyScore = Math.max(0, 24 - hoursSinceCreation) * 200; // 4800 → 0
        const engagementScore = p._count.likes * 5 + p._count.comments * 8;
        const score =
          (isPinned ? 10_000_000 : 0) +
          recencyScore +
          engagementScore +
          (isPromoted ? 500 : 0) +
          p.user._count.followers * 3;
        return { ...p, _score: score };
      })
      .sort((a, b) => b._score - a._score);

    const total = ranked.length;
    const skip = (page - 1) * limit;
    const paged = ranked.slice(skip, skip + limit);

    const postsOut = paged.map(post => {
      const { _score, user, ...rest } = post;
      const { _count: _uc, ...userRest } = user;
      return {
        ...rest,
        user: toFeedUser(userRest),
        likedByMe: post.likes.some(l => l.userId === userId),
      };
    });

    res.json({ data: { posts: postsOut, total, page, pageSize: limit, hasMore: skip + limit < total } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

/* ---------- Create New Post ---------- */
router.post('/posts', postCreateLimiter, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId as number;
    const { body, network: rawNetwork } = req.body as { body?: string; network?: string };
    const network = rawNetwork === 'isd' ? 'isd' : 'global';
    if (!body?.trim()) return res.status(400).json({ error: 'Body is required' });

    const poster = await prisma.user.findUnique({ where: { id: userId } });
    if (poster?.chatBanned) return res.status(403).json({ error: 'You are banned from posting.' });
    if (poster?.chatMutedUntil && poster.chatMutedUntil > new Date())
      return res.status(403).json({ error: `You are muted until ${poster.chatMutedUntil.toLocaleString()}.` });

    const contentCheck = filterContent(body.trim());
    if (!contentCheck.ok) {
      const { shouldMute } = recordViolation(userId);
      if (shouldMute) {
        const mutedUntil = new Date(Date.now() + 60 * 60 * 1000);
        await prisma.user.update({ where: { id: userId }, data: { chatMutedUntil: mutedUntil } });
        return res.status(403).json({ error: 'You\'ve been automatically muted for 1 hour due to repeated policy violations.' });
      }
      return res.status(400).json({ error: contentCheck.reason });
    }

    // Resolve ISD code if posting to ISD network
    let isdCode: string | undefined;
    if (network === 'isd') {
      const sc = await prisma.schoolConnection.findUnique({ where: { userId }, select: { districtUrl: true } });
      if (!sc) return res.status(403).json({ error: 'You must link your HAC to post in the ISD feed.' });
      isdCode = sc.districtUrl;
    }

    const post = await prisma.post.create({
      data: { body: body.trim(), userId, network, ...(isdCode ? { isdCode } : {}) },
      include: {
        user: { select: USER_SELECT },
        likes: { select: { userId: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    const postOut = { ...post, user: toFeedUser(post.user), likedByMe: false };
    broadcast('NEW_POST', postOut);
    res.json({ data: postOut });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create post' });
  }
});

/* ---------- Following Feed (posts from followed users, newest first) ---------- */
router.get('/posts/following', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId as number;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const follows = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = follows.map(f => f.followingId);

    if (followingIds.length === 0) {
      return res.json({ data: { posts: [], total: 0, page, pageSize: limit, hasMore: false } });
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: { userId: { in: followingIds } },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
        include: {
          user: { select: USER_SELECT },
          likes: { select: { userId: true } },
          _count: { select: { likes: true, comments: true } },
        },
      }),
      prisma.post.count({ where: { userId: { in: followingIds } } }),
    ]);

    const postsOut = posts.map(p => ({
      ...p,
      user: toFeedUser(p.user),
      likedByMe: p.likes.some(l => l.userId === userId),
    }));

    res.json({ data: { posts: postsOut, total, page, pageSize: limit, hasMore: skip + limit < total } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch following posts' });
  }
});

/* ---------- Get Single Post ---------- */
router.get('/posts/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const requesterId = (req as AuthRequest).userId as number;
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: USER_SELECT },
            commentLikes: { select: { userId: true } },
          },
        },
        user: { select: USER_SELECT },
        likes: { select: { userId: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const commentsWithMeta = post.comments.map(c => ({
      ...c,
      user: toFeedUser(c.user),
      likedByMe: c.commentLikes.some((l: { userId: number }) => l.userId === requesterId),
      _count: { likes: c.commentLikes.length },
    }));
    res.json({ data: { ...post, user: toFeedUser(post.user), comments: commentsWithMeta } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

/* ---------- Add Comment ---------- */
router.post('/posts/:id/comments', commentLimiter, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as AuthRequest).userId as number;
    const { body } = req.body as { body?: string };
    if (!body?.trim()) return res.status(400).json({ error: 'Comment body is required' });

    const commenter = await prisma.user.findUnique({ where: { id: userId } });
    if (commenter?.chatBanned) return res.status(403).json({ error: 'You are banned from posting.' });
    if (commenter?.chatMutedUntil && commenter.chatMutedUntil > new Date())
      return res.status(403).json({ error: 'You are currently muted.' });

    const contentCheck = filterContent(body.trim());
    if (!contentCheck.ok) {
      const { shouldMute } = recordViolation(userId);
      if (shouldMute) {
        const mutedUntil = new Date(Date.now() + 60 * 60 * 1000);
        await prisma.user.update({ where: { id: userId }, data: { chatMutedUntil: mutedUntil } });
        return res.status(403).json({ error: 'You\'ve been automatically muted for 1 hour due to repeated policy violations.' });
      }
      return res.status(400).json({ error: contentCheck.reason });
    }

    const comment = await prisma.comment.create({
      data: { body: body.trim(), postId: id, userId },
      include: {
        user: { select: USER_SELECT },
        commentLikes: { select: { userId: true } },
      },
    });

    const commentOut = { ...comment, user: toFeedUser(comment.user), likedByMe: false, _count: { likes: 0 } };
    broadcast('NEW_COMMENT', { postId: id, comment: commentOut });

    const post = await prisma.post.findUnique({ where: { id }, select: { userId: true } });
    if (post && post.userId !== userId) {
      const alreadyNotified = await prisma.notification.findFirst({
        where: { userId: post.userId, fromUserId: userId, type: 'COMMENT', postId: id },
      });
      if (!alreadyNotified) {
        const notif = await prisma.notification.create({
          data: { userId: post.userId, fromUserId: userId, type: 'COMMENT', postId: id, preview: body.trim().slice(0, 80) },
          include: { sender: { select: USER_SELECT } },
        });
        sendToUser(post.userId, 'NOTIFICATION', { ...notif, sender: toFeedUser(notif.sender) });
      }
    }

    res.json({ data: commentOut });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

/* ---------- Toggle Like ---------- */
router.post('/posts/:id/like', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as AuthRequest).userId as number;

    const existingLike = await prisma.like.findFirst({ where: { userId, postId: id } });
    let liked = false;
    if (existingLike) {
      await prisma.like.delete({ where: { id: existingLike.id } });
    } else {
      await prisma.like.create({ data: { userId, postId: id } });
      liked = true;
    }

    const likedPost = await prisma.post.findUnique({ where: { id }, include: { _count: { select: { likes: true } } } });
    broadcast('LIKE_UPDATE', { postId: id, liked, count: likedPost?._count.likes || 0 });

    if (liked && likedPost && likedPost.userId !== userId) {
      const alreadyNotified = await prisma.notification.findFirst({
        where: { userId: likedPost.userId, fromUserId: userId, type: 'LIKE', postId: id },
      });
      if (!alreadyNotified) {
        const notif = await prisma.notification.create({
          data: { userId: likedPost.userId, fromUserId: userId, type: 'LIKE', postId: id },
          include: { sender: { select: USER_SELECT } },
        });
        sendToUser(likedPost.userId, 'NOTIFICATION', { ...notif, sender: toFeedUser(notif.sender) });
      }
    }

    res.json({ data: { liked, count: likedPost?._count.likes || 0 } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

/* ---------- Toggle Comment Like ---------- */
router.post('/posts/:id/comments/:commentId/like', async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.id);
    const commentId = parseInt(req.params.commentId);
    const userId = (req as AuthRequest).userId as number;

    const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { userId: true, postId: true } });
    if (!comment || comment.postId !== postId) return res.status(404).json({ error: 'Comment not found' });

    const existingLike = await prisma.commentLike.findFirst({ where: { userId, commentId } });
    let liked = false;
    if (existingLike) {
      await prisma.commentLike.delete({ where: { id: existingLike.id } });
    } else {
      await prisma.commentLike.create({ data: { userId, commentId } });
      liked = true;
    }

    const likedComment = await prisma.comment.findUnique({ where: { id: commentId }, include: { commentLikes: { select: { userId: true } } } });
    broadcast('COMMENT_LIKE_UPDATE', { postId, commentId, liked, count: likedComment?.commentLikes?.length || 0 });
    res.json({ data: { liked, count: likedComment?.commentLikes?.length || 0 } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle comment like' });
  }
});

/* ---------- Delete Post ---------- */
router.delete('/posts/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.userId!;
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const isOwn = post.userId === userId;
    const isDev = await hasDevPowers(userId);

    if (!isOwn && !isDev) {
      const isMod = await hasModOrDevPowers(userId);
      if (!isMod) return res.status(403).json({ error: 'Unauthorized' });
      const deletedToday = getModDeletesToday(userId);
      if (deletedToday >= MOD_DAILY_DELETE_LIMIT)
        return res.status(403).json({ error: `MODs can delete at most ${MOD_DAILY_DELETE_LIMIT} posts per day` });
      recordModDelete(userId);
    }

    await prisma.post.delete({ where: { id } });
    broadcast('POST_DELETED', { postId: id });
    res.json({ data: { deleted: true } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

/* ---------- Pin Post for 24h (DEV/admin) ---------- */
router.put('/posts/:id/pin', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const postId = parseInt(req.params.id);
    const pinnedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const updated = await prisma.post.update({ where: { id: postId }, data: { pinnedUntil } });
    broadcast('POST_PINNED', { postId, pinnedUntil: pinnedUntil.toISOString() });
    res.json({ data: { pinnedUntil: updated.pinnedUntil?.toISOString() ?? null } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to pin post' });
  }
});

/* ---------- Unpin Post (DEV/admin) ---------- */
router.put('/posts/:id/unpin', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const postId = parseInt(req.params.id);
    await prisma.post.update({ where: { id: postId }, data: { pinnedUntil: null } });
    broadcast('POST_UNPINNED', { postId });
    res.json({ data: { ok: true } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unpin post' });
  }
});

/* ---------- Get User Posts (legacy) ---------- */
router.get('/user/posts', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.query.userId as string);
    const posts = await prisma.post.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { likes: { select: { userId: true } }, _count: { select: { likes: true, comments: true } } },
    });
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
});

/* ---------- Get Current User Profile (legacy) ---------- */
router.get('/user/profile', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId as number;
    const profile = await prisma.user.findUnique({ where: { id: userId }, include: { _count: { select: { followers: true, following: true, posts: true } } } });
    if (!profile) return res.status(404).json({ error: 'User not found' });
    const totalLikes = await prisma.like.count({ where: { post: { userId } } });
    const { passwordHash, failedLoginAttempts: _fla, lockedUntil: _lu, emailVerificationToken: _evt, emailVerificationExpiry: _eve, ...safe } = profile as typeof profile & { passwordHash: string; failedLoginAttempts: number; lockedUntil: Date | null; emailVerificationToken: string | null; emailVerificationExpiry: Date | null };
    res.json({ ...safe, totalLikes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/* ---------- Get User Profile by ID (legacy) ---------- */
router.get('/user/profile/:id', async (req: Request, res: Response) => {
  try {
    const targetId = parseInt(req.params.id);
    const userId = (req as AuthRequest).userId as number;
    const profile = await prisma.user.findUnique({ where: { id: targetId }, include: { _count: { select: { followers: true, following: true, posts: true } } } });
    if (!profile) return res.status(404).json({ error: 'User not found' });
    const totalLikes = await prisma.like.count({ where: { post: { userId: targetId } } });
    const isFollowing = await prisma.follow.findFirst({ where: { followerId: userId, followingId: targetId } });
    const { passwordHash, email: _email, failedLoginAttempts: _fla, lockedUntil: _lu, emailVerificationToken: _evt, emailVerificationExpiry: _eve, ...safe } = profile as typeof profile & { passwordHash: string; email: string; failedLoginAttempts: number; lockedUntil: Date | null; emailVerificationToken: string | null; emailVerificationExpiry: Date | null };
    res.json({ ...safe, totalLikes, isFollowing: !!isFollowing });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/* ---------- Toggle Follow (legacy) ---------- */
router.post('/user/follow', followLimiter, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId as number;
    const { targetId } = req.body as { targetId: number };
    const existing = await prisma.follow.findFirst({ where: { followerId: userId, followingId: targetId } });
    let following = false;
    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } });
    } else {
      await prisma.follow.create({ data: { followerId: userId, followingId: targetId } });
      following = true;
    }
    res.json({ following });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle follow' });
  }
});

/* ---------- Search (legacy) ---------- */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId as number;
    const q = (req.query.q as string || '').trim();
    if (!q) return res.json({ data: [] });
    const users = await prisma.user.findMany({
      where: { AND: [{ id: { not: userId } }, { isDemoAccount: false }, { OR: [{ name: { contains: q, mode: 'insensitive' } }, { hacName: { contains: q, mode: 'insensitive' } }] }] },
      take: 20,
      select: { id: true, name: true, hacName: true, avatarUrl: true, chatBanned: true, chatMutedUntil: true, role: true },
    });
    res.json({ data: users.map(toFeedUser) });
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── /users/* routes ──────────────────────────────────────────────────────────

/* ---------- Users: Search ---------- */
router.get('/users/search', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId as number;
    const q = (req.query.q as string || '').trim();
    if (!q) return res.json({ data: [] });
    const users = await prisma.user.findMany({
      where: { AND: [{ id: { not: userId } }, { isDemoAccount: false }, { OR: [{ name: { contains: q, mode: 'insensitive' } }, { hacName: { contains: q, mode: 'insensitive' } }] }] },
      take: 20,
      select: { id: true, name: true, hacName: true, avatarUrl: true, chatBanned: true, chatMutedUntil: true, role: true },
    });
    res.json({ data: users.map(toFeedUser) });
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

/* ---------- Users: Get Profile by ID ---------- */
router.get('/users/:id/profile', async (req: Request, res: Response) => {
  try {
    const targetId = parseInt(req.params.id);
    const userId = (req as AuthRequest).userId as number;
    const isSelf = targetId === userId;
    const profile = await prisma.user.findUnique({
      where: { id: targetId },
      include: {
        _count: { select: { followers: true, following: true, posts: true } },
        ...(isSelf ? { schoolConnection: { select: { districtUrl: true } } } : {}),
      },
    });
    if (!profile) return res.status(404).json({ error: 'User not found' });

    const [totalLikes, isFollowingRow] = await Promise.all([
      prisma.like.count({ where: { post: { userId: targetId } } }),
      prisma.follow.findFirst({ where: { followerId: userId, followingId: targetId } }),
    ]);

    const { passwordHash, email: _email, failedLoginAttempts: _fla, lockedUntil: _lu, schoolConnection: sc, ...rest } = profile as typeof profile & { passwordHash: string; email: string; failedLoginAttempts: number; lockedUntil: Date | null; schoolConnection?: { districtUrl: string } | null };
    const isdCode = sc?.districtUrl ?? null;
    res.json({
      data: {
        ...rest,
        totalLikes,
        isFollowing: !!isFollowingRow,
        ...(isSelf ? { isdCode, isdDisplayName: isdCode ? isdCode.split('.')[0].replace(/isd$/i, ' ISD').replace(/^(.)/, (c: string) => c.toUpperCase()).trim() : null } : {}),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/* ---------- Users: Get Posts by User ---------- */
router.get('/users/:id/posts', async (req: Request, res: Response) => {
  try {
    const targetId = parseInt(req.params.id);
    const requesterId = (req as AuthRequest).userId as number;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: { userId: targetId },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
        include: {
          user: { select: USER_SELECT },
          likes: { select: { userId: true } },
          _count: { select: { likes: true, comments: true } },
        },
      }),
      prisma.post.count({ where: { userId: targetId } }),
    ]);
    const postsOut = posts.map(p => ({
      ...p,
      user: toFeedUser(p.user),
      likedByMe: p.likes.some((l: { userId: number }) => l.userId === requesterId),
    }));
    res.json({ data: { posts: postsOut, total, page, pageSize: limit, hasMore: skip + limit < total } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
});

/* ---------- Users: Toggle Follow ---------- */
router.post('/users/:id/follow', followLimiter, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId as number;
    const targetId = parseInt(req.params.id);
    const existing = await prisma.follow.findFirst({ where: { followerId: userId, followingId: targetId } });
    let following = false;
    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } });
    } else {
      await prisma.follow.create({ data: { followerId: userId, followingId: targetId } });
      following = true;
    }
    if (following) {
      const alreadyNotified = await prisma.notification.findFirst({
        where: { userId: targetId, fromUserId: userId, type: 'FOLLOW' },
      });
      if (!alreadyNotified) {
        const notif = await prisma.notification.create({
          data: { userId: targetId, fromUserId: userId, type: 'FOLLOW' },
          include: { sender: { select: USER_SELECT } },
        });
        sendToUser(targetId, 'NOTIFICATION', { ...notif, sender: toFeedUser(notif.sender) });
      }
    }
    res.json({ data: { following } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle follow' });
  }
});

/* ---------- Users: Ban from chat ---------- */
router.put('/users/:id/ban', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = parseInt(req.params.id);
    const { banned } = req.body as { banned: boolean };
    const updated = await prisma.user.update({ where: { id: targetId }, data: { chatBanned: banned } });
    res.json({ data: { banned: updated.chatBanned } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update ban status' });
  }
});

/* ---------- Users: Mute from chat ---------- */
router.put('/users/:id/mute', requireMod, async (req: AuthRequest, res: Response) => {
  try {
    const actorId = req.userId!;
    const targetId = parseInt(req.params.id);
    let { minutes } = req.body as { minutes?: number | null };
    const isDev = await hasDevPowers(actorId);
    if (!isDev && minutes != null && minutes > 1440) minutes = 1440;
    const mutedUntil = (minutes != null && minutes > 0)
      ? new Date(Date.now() + minutes * 60 * 1000)
      : null;
    const updated = await prisma.user.update({ where: { id: targetId }, data: { chatMutedUntil: mutedUntil } });
    res.json({ data: { mutedUntil: updated.chatMutedUntil?.toISOString() ?? null } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update mute status' });
  }
});

/* ---------- Users: Delete account (DEV only — target must be banned) ---------- */
router.delete('/users/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const actorId = req.userId!;
    const targetId = parseInt(req.params.id);
    if (actorId === targetId) return res.status(400).json({ error: 'Cannot delete your own account' });
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { chatBanned: true } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (!target.chatBanned) return res.status(400).json({ error: 'User must be banned before their account can be deleted' });
    await prisma.user.delete({ where: { id: targetId } });
    res.json({ data: { deleted: true } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

/* ---------- Users: Set role (DEV only) ---------- */
router.put('/users/:id/role', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const actorId = req.userId!;
    const targetId = parseInt(req.params.id);
    if (actorId === targetId) return res.status(400).json({ error: 'Cannot change your own role' });
    const { role } = req.body as { role: string };
    if (!['STUDENT', 'ADMIN', 'DEV', 'MODERATOR', 'TEACHER', 'COUNSELOR', 'PARENT'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const updated = await prisma.user.update({ where: { id: targetId }, data: { role } });
    res.json({ data: { role: updated.role } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

export default router;
