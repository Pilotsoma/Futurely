import { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { prisma } from '../lib/prisma'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { requireAdmin } from '../middleware/requireAdmin'
import { sendToUser, broadcast } from '../lib/websocket'

// User-keyed limiter for coin-spending / inventory-mutating actions.
const txLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req: Request): string => String((req as AuthRequest).userId ?? req.ip ?? 'anon'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many marketplace actions. Slow down.' } },
})

const router = Router()

// ── Loot Tables ───────────────────────────────────────────────────────────────

interface TagItem  { id: string; tag: string; tagColor: string; rarity: string; weight: number }
interface ColorItem { id: string; name: string; value: string; rarity: string; weight: number }

export const TAG_BOX_ITEMS: TagItem[] = [
  { id: 'grinder',        tag: 'Grinder',        tagColor: '#6B7280', rarity: 'Common',    weight: 20   },
  { id: 'focused',        tag: 'Focused',         tagColor: '#6B7280', rarity: 'Common',    weight: 20   },
  { id: 'scholar',        tag: 'Scholar',         tagColor: '#6B7280', rarity: 'Common',    weight: 20   },
  { id: 'honors-student', tag: 'Honors Student',  tagColor: '#3B82F6', rarity: 'Uncommon',  weight: 12.5 },
  { id: 'ap-student',     tag: 'AP Student',      tagColor: '#06B6D4', rarity: 'Uncommon',  weight: 12.5 },
  { id: 'deans-list',     tag: "Dean's List",     tagColor: '#8B5CF6', rarity: 'Rare',      weight: 5    },
  { id: 'top-performer',  tag: 'Top Performer',   tagColor: '#8B5CF6', rarity: 'Rare',      weight: 5    },
  { id: 'ace',            tag: 'Ace',             tagColor: '#F97316', rarity: 'Epic',      weight: 1.85 },
  { id: 'genius',         tag: 'Genius',          tagColor: '#EC4899', rarity: 'Epic',      weight: 1.85 },
  { id: 'mastermind',     tag: 'Valedictorian',   tagColor: '#F8FAFC', rarity: 'Legendary', weight: 0.5  },
  { id: 'prodigy',        tag: 'Prodigy',         tagColor: '#111111', rarity: 'Legendary', weight: 0.5  },
  { id: 'god',            tag: 'GOD',             tagColor: '#111111', rarity: 'Mythic',    weight: 0.3  },
]

// Special role/staff tags — not in loot boxes, only grantable by DEV/ADMIN
const SPECIAL_TAGS: { id: string; tag: string; tagColor: string; rarity: string }[] = [
  { id: 'dev',   tag: 'DEV',   tagColor: '#ff6b6b', rarity: 'Staff'  },
  { id: 'admin', tag: 'Admin', tagColor: '#EF4444', rarity: 'Staff'  },
  { id: 'mod',   tag: 'MOD',   tagColor: '#3B82F6', rarity: 'Staff'  },
  { id: 'vip',   tag: 'VIP',   tagColor: '#A855F7', rarity: 'Staff'  },
  { id: 'bot',   tag: 'BOT',   tagColor: '#6B7280', rarity: 'Staff'  },
]

const NAME_COLOR_BOX_ITEMS: ColorItem[] = [
  { id: 'forest-green',  name: 'Forest Green',  value: '#15803D', rarity: 'Common',    weight: 12    },
  { id: 'navy-blue',     name: 'Navy Blue',      value: '#1D4ED8', rarity: 'Common',    weight: 12    },
  { id: 'dark-red',      name: 'Dark Red',       value: '#991B1B', rarity: 'Common',    weight: 12    },
  { id: 'slate-blue',    name: 'Slate Blue',     value: '#4338CA', rarity: 'Common',    weight: 12    },
  { id: 'teal',          name: 'Teal',           value: '#0F766E', rarity: 'Common',    weight: 12    },
  { id: 'bright-orange', name: 'Bright Orange',  value: '#EA580C', rarity: 'Uncommon',  weight: 8.33  },
  { id: 'violet',        name: 'Violet',         value: '#7C3AED', rarity: 'Uncommon',  weight: 8.33  },
  { id: 'cyan',          name: 'Cyan',           value: '#0891B2', rarity: 'Uncommon',  weight: 8.33  },
  { id: 'hot-pink',      name: 'Hot Pink',       value: '#DB2777', rarity: 'Rare',      weight: 3.34  },
  { id: 'gold',          name: 'Gold',           value: '#D97706', rarity: 'Rare',      weight: 3.33  },
  { id: 'lime-green',    name: 'Lime Green',     value: '#65A30D', rarity: 'Rare',      weight: 3.33  },
  { id: 'electric-blue', name: 'Electric Blue',  value: '#2563EB', rarity: 'Epic',      weight: 1.98  },
  { id: 'magenta',       name: 'Magenta',        value: '#C026D3', rarity: 'Epic',      weight: 1.98  },
  { id: 'pure-white',    name: 'Pure White',     value: '#F8FAFC', rarity: 'Legendary', weight: 0.5   },
  { id: 'black',         name: 'Black',          value: '#111111', rarity: 'Legendary', weight: 0.5   },
  { id: 'rainbow',       name: 'Rainbow RGB',    value: 'rainbow', rarity: 'Mythic',    weight: 0.05  },
]

const PFP_EFFECT_BOX_ITEMS: ColorItem[] = [
  { id: 'border-green',    name: 'Green Border',     value: 'border-green',   rarity: 'Common',    weight: 12   },
  { id: 'border-blue',     name: 'Blue Border',      value: 'border-blue',    rarity: 'Common',    weight: 12   },
  { id: 'border-red',      name: 'Red Border',       value: 'border-red',     rarity: 'Common',    weight: 12   },
  { id: 'border-navy',     name: 'Navy Border',      value: 'border-navy',    rarity: 'Common',    weight: 12   },
  { id: 'border-teal',     name: 'Teal Border',      value: 'border-teal',    rarity: 'Common',    weight: 12   },
  { id: 'border-orange',   name: 'Orange Border',    value: 'border-orange',  rarity: 'Uncommon',  weight: 8.33 },
  { id: 'border-violet',   name: 'Violet Border',    value: 'border-violet',  rarity: 'Uncommon',  weight: 8.33 },
  { id: 'border-cyan',     name: 'Cyan Border',      value: 'border-cyan',    rarity: 'Uncommon',  weight: 8.33 },
  { id: 'border-hotpink',  name: 'Hot Pink Border',  value: 'border-hotpink', rarity: 'Rare',      weight: 3.34 },
  { id: 'border-gold',     name: 'Gold Border',      value: 'border-gold',    rarity: 'Rare',      weight: 3.33 },
  { id: 'border-lime',     name: 'Lime Border',      value: 'border-lime',    rarity: 'Rare',      weight: 3.33 },
  { id: 'glow-pink',       name: 'Pink Glow',        value: 'glow-pink',      rarity: 'Epic',      weight: 1.98 },
  { id: 'glow-purple',     name: 'Purple Glow',      value: 'glow-purple',    rarity: 'Epic',      weight: 1.98 },
  { id: 'glow-gold',       name: 'Gold Fill',        value: 'glow-gold',      rarity: 'Legendary', weight: 0.5  },
  { id: 'frame-black',     name: 'Void Fill',        value: 'frame-black',    rarity: 'Legendary', weight: 0.5  },
  { id: 'fill-white',      name: 'White Fill',       value: 'fill-white',     rarity: 'Legendary', weight: 0.5  },
  { id: 'rainbow',         name: 'Rainbow Animated', value: 'rainbow',        rarity: 'Mythic',    weight: 0.05 },
]

interface DevCurseItem { id: string; name: string; tag?: string; tagColor?: string; value?: string; rarity: string; itemType: 'tag' | 'pfp'; weight: number }
// Common: 33333×3 = 99999 (99.999%) | Unobtainable: 1 (0.001%) | Total: 100000
const DEV_CURSE_ITEMS: DevCurseItem[] = [
  { id: 'grinder', name: 'Grinder',   tag: 'Grinder', tagColor: '#6B7280', rarity: 'Common',      itemType: 'tag', weight: 33333 },
  { id: 'focused', name: 'Focused',   tag: 'Focused',  tagColor: '#6B7280', rarity: 'Common',      itemType: 'tag', weight: 33333 },
  { id: 'scholar', name: 'Scholar',   tag: 'Scholar',  tagColor: '#6B7280', rarity: 'Common',      itemType: 'tag', weight: 33333 },
  { id: 'curse',   name: 'The Curse', value: 'unobtainable-curse',          rarity: 'Unobtainable', itemType: 'pfp', weight: 1    },
]

export const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Unobtainable']
const RARITY_RANK: Record<string, number> = {
  Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4, Mythic: 5, Unobtainable: 6,
}

// ── Estimated item prices (seed; updated dynamically on each sale) ─────────────

export const SEED_PRICES: Record<string, number> = {
  // Tags — spin cost 10 (was 15, ×2/3): Common 7, Uncommon 13, Rare 33, Epic 167, Legendary 667, GOD 3333, GOAT 33333
  'tag:grinder': 7,          'tag:focused': 7,          'tag:scholar': 7,
  'tag:honors-student': 13,  'tag:ap-student': 13,
  'tag:deans-list': 33,      'tag:top-performer': 33,
  'tag:ace': 167,            'tag:genius': 167,
  'tag:mastermind': 667,     'tag:prodigy': 667,
  'tag:god': 3333,
  // GOAT is the day-100 streak tag (tradeable — rarest item in the game)
  'tag:GOAT': 33333,
  // Name Colors — spin cost 15 (was 25, ×0.6): Common 9, Uncommon 18, Rare 45, Epic 210, Legendary 1200, Mythic 30000
  'name-color:forest-green': 9,    'name-color:navy-blue': 9,    'name-color:dark-red': 9,
  'name-color:slate-blue': 9,      'name-color:teal': 9,
  'name-color:bright-orange': 18,  'name-color:violet': 18,      'name-color:cyan': 18,
  'name-color:hot-pink': 45,       'name-color:gold': 45,        'name-color:lime-green': 45,
  'name-color:electric-blue': 210, 'name-color:magenta': 210,
  'name-color:pure-white': 1200,   'name-color:black': 1200,
  'name-color:rainbow': 30000,
  // PFP Effects — spin cost 20 (was 30, ×2/3): Common 13, Uncommon 27, Rare 67, Epic 267, Legendary 2000, Mythic 50000
  'pfp:border-green': 13,    'pfp:border-blue': 13,    'pfp:border-red': 13,
  'pfp:border-navy': 13,     'pfp:border-teal': 13,
  'pfp:border-orange': 27,   'pfp:border-violet': 27,  'pfp:border-cyan': 27,
  'pfp:border-hotpink': 67,  'pfp:border-gold': 67,    'pfp:border-lime': 67,
  'pfp:glow-pink': 267,      'pfp:glow-purple': 267,
  'pfp:glow-gold': 2000,     'pfp:frame-black': 2000,   'pfp:fill-white': 2000,
  'pfp:rainbow': 50000,
  // Developer's Curse — 0.001% chance, estimated market value
  'pfp:curse': 1_000_000,
}

// Streak milestone tags below GOAT are soulbound (earn-only, never trade/sell)
// GOAT (day-100) is the exception — it IS tradeable and sellable
const NON_TRADEABLE_TAGS = new Set(['Novice', 'Pro', 'Veteran', 'Legend'])

// Proper metadata for streak tags so they get correct rarity/color when listed
const STREAK_TAG_META: Record<string, { tagColor: string; rarity: string }> = {
  Novice:  { tagColor: '#22C55E', rarity: 'Common'    },
  Pro:     { tagColor: '#3B82F6', rarity: 'Uncommon'  },
  Veteran: { tagColor: '#F97316', rarity: 'Rare'      },
  Legend:  { tagColor: '#EC4899', rarity: 'Epic'      },
  GOAT:    { tagColor: '#EAB308', rarity: 'Mythic'    },
}

// ── Trade item type ────────────────────────────────────────────────────────────

interface TradeItem {
  type: 'tag' | 'name-color' | 'pfp'
  id: string
  tag?: string
  tagColor?: string
  name?: string
  value?: string
  rarity: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function weightedRandom<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let r = Math.random() * total
  for (const item of items) {
    r -= item.weight
    if (r <= 0) return item
  }
  return items[items.length - 1]
}

function parseJsonArr(raw: unknown): Array<{ id: string; [k: string]: unknown }> {
  if (Array.isArray(raw)) return raw as Array<{ id: string; [k: string]: unknown }>
  try { return JSON.parse(String(raw ?? '[]')) } catch { return [] }
}

function parseTagArr(raw: unknown): Array<{ tag: string; tagColor: string }> {
  if (Array.isArray(raw)) return raw as Array<{ tag: string; tagColor: string }>
  try { return JSON.parse(String(raw ?? '[]')) } catch { return [] }
}

function parseTradeItems(raw: unknown): TradeItem[] {
  if (Array.isArray(raw)) return raw as TradeItem[]
  try { return JSON.parse(String(raw ?? '[]')) } catch { return [] }
}

type UserSnap = {
  allTags: unknown
  ownedNameColors: unknown
  ownedPfpEffects: unknown
  tag?: string
  nameColor?: string | null
  pfpEffect?: string | null
}

function resolveTagName(item: TradeItem): string {
  const def = TAG_BOX_ITEMS.find(t => t.id === item.id)
  return def ? def.tag : (item.tag ?? item.id)
}

function userOwnsItem(user: UserSnap, item: TradeItem): boolean {
  if (item.type === 'tag') {
    const tagName = resolveTagName(item)
    return parseTagArr(user.allTags).some(t => t.tag === tagName)
  }
  if (item.type === 'name-color') return parseJsonArr(user.ownedNameColors).some(i => i.id === item.id)
  if (item.type === 'pfp') return parseJsonArr(user.ownedPfpEffects).some(i => i.id === item.id)
  return false
}

function removeItem(user: UserSnap, item: TradeItem): Record<string, string | null> {
  const updates: Record<string, string | null> = {}
  if (item.type === 'tag') {
    const tagName = resolveTagName(item)
    const tags = parseTagArr(user.allTags)
    const idx = tags.findIndex(t => t.tag === tagName)
    if (idx !== -1) tags.splice(idx, 1)
    updates.allTags = JSON.stringify(tags)
    // Only unequip if no copies remain
    if (user.tag === tagName && !tags.some(t => t.tag === tagName)) {
      updates.tag = 'Student'; updates.tagColor = null
    }
  } else if (item.type === 'name-color') {
    const owned = parseJsonArr(user.ownedNameColors)
    const idx = owned.findIndex((i: { id: string }) => i.id === item.id)
    if (idx !== -1) owned.splice(idx, 1)
    updates.ownedNameColors = JSON.stringify(owned)
    const def = NAME_COLOR_BOX_ITEMS.find(c => c.id === item.id)
    if (def && user.nameColor === def.value && !owned.some((i: { id: string }) => i.id === item.id)) {
      updates.nameColor = null
    }
  } else if (item.type === 'pfp') {
    const owned = parseJsonArr(user.ownedPfpEffects)
    const idx = owned.findIndex((i: { id: string }) => i.id === item.id)
    if (idx !== -1) owned.splice(idx, 1)
    updates.ownedPfpEffects = JSON.stringify(owned)
    const def = PFP_EFFECT_BOX_ITEMS.find(c => c.id === item.id)
    if (def && user.pfpEffect === def.value && !owned.some((i: { id: string }) => i.id === item.id)) {
      updates.pfpEffect = null
    }
  }
  return updates
}

function addItem(user: UserSnap, item: TradeItem): Record<string, string> {
  const updates: Record<string, string> = {}
  if (item.type === 'tag') {
    const tagDef = TAG_BOX_ITEMS.find(t => t.id === item.id)
    const tagName = tagDef ? tagDef.tag : (item.tag ?? item.id)
    const tagColor = tagDef ? tagDef.tagColor : (item.tagColor ?? '#6B7280')
    const tags = parseTagArr(user.allTags)
    tags.push({ tag: tagName, tagColor })
    updates.allTags = JSON.stringify(tags)
  } else if (item.type === 'name-color') {
    const owned = parseJsonArr(user.ownedNameColors)
    owned.push({ id: item.id, name: item.name, value: item.value, rarity: item.rarity })
    updates.ownedNameColors = JSON.stringify(owned)
  } else if (item.type === 'pfp') {
    const owned = parseJsonArr(user.ownedPfpEffects)
    owned.push({ id: item.id, name: item.name, value: item.value, rarity: item.rarity })
    updates.ownedPfpEffects = JSON.stringify(owned)
  }
  return updates
}

function applyMultipleRemoves(user: UserSnap, items: TradeItem[]): Record<string, string | null> {
  let tags = parseTagArr(user.allTags)
  let nameColors = parseJsonArr(user.ownedNameColors)
  let pfpEffects = parseJsonArr(user.ownedPfpEffects)
  const updates: Record<string, string | null> = {}

  for (const item of items) {
    if (item.type === 'tag') {
      const tagName = resolveTagName(item)
      tags = tags.filter(t => t.tag !== tagName)
      if (user.tag === tagName) { updates.tag = 'Student'; updates.tagColor = null }
    } else if (item.type === 'name-color') {
      nameColors = nameColors.filter(i => i.id !== item.id)
      const def = NAME_COLOR_BOX_ITEMS.find(c => c.id === item.id)
      if (def && user.nameColor === def.value) updates.nameColor = null
    } else if (item.type === 'pfp') {
      pfpEffects = pfpEffects.filter(i => i.id !== item.id)
      const def = PFP_EFFECT_BOX_ITEMS.find(c => c.id === item.id)
      if (def && user.pfpEffect === def.value) updates.pfpEffect = null
    }
  }

  updates.allTags = JSON.stringify(tags)
  updates.ownedNameColors = JSON.stringify(nameColors)
  updates.ownedPfpEffects = JSON.stringify(pfpEffects)
  return updates
}

function applyMultipleAdds(user: UserSnap, items: TradeItem[]): Record<string, string> {
  let tags = parseTagArr(user.allTags)
  let nameColors = parseJsonArr(user.ownedNameColors)
  let pfpEffects = parseJsonArr(user.ownedPfpEffects)

  for (const item of items) {
    if (item.type === 'tag') {
      const def = TAG_BOX_ITEMS.find(t => t.id === item.id)
      const tagName = def ? def.tag : (item.tag ?? item.id)
      const tagColor = def ? def.tagColor : (item.tagColor ?? '#6B7280')
      if (!tags.some(t => t.tag === tagName)) tags.push({ tag: tagName, tagColor })
    } else if (item.type === 'name-color') {
      if (!nameColors.some(i => i.id === item.id)) {
        nameColors.push({ id: item.id, name: item.name, value: item.value, rarity: item.rarity })
      }
    } else if (item.type === 'pfp') {
      if (!pfpEffects.some(i => i.id === item.id)) {
        pfpEffects.push({ id: item.id, name: item.name, value: item.value, rarity: item.rarity })
      }
    }
  }

  return {
    allTags: JSON.stringify(tags),
    ownedNameColors: JSON.stringify(nameColors),
    ownedPfpEffects: JSON.stringify(pfpEffects),
  }
}

// ── Item Prices ───────────────────────────────────────────────────────────────

// Bump this number whenever SEED_PRICES changes — forces a one-time DB reset
// to the new values, after which dynamic pricing takes over again.
const SEED_VERSION = 7

router.get('/prices', async (_req, res: Response): Promise<void> => {
  try {
    // Check if DB prices are from the current seed version
    const versionRow = await prisma.itemPrice.findUnique({
      where: { itemType_itemId: { itemType: 'meta', itemId: 'seed_version' } },
    })
    const needsReseed = !versionRow || versionRow.price !== SEED_VERSION

    const entries = Object.entries(SEED_PRICES)
    await Promise.all(entries.map(([key, price]) => {
      const [itemType, ...rest] = key.split(':')
      const itemId = rest.join(':')
      return prisma.itemPrice.upsert({
        where: { itemType_itemId: { itemType, itemId } },
        create: { itemType, itemId, price },
        // Force-reset to seed when version changed; otherwise preserve learned prices
        update: needsReseed ? { price } : {},
      })
    }))

    if (needsReseed) {
      await prisma.itemPrice.upsert({
        where: { itemType_itemId: { itemType: 'meta', itemId: 'seed_version' } },
        create: { itemType: 'meta', itemId: 'seed_version', price: SEED_VERSION },
        update: { price: SEED_VERSION },
      })
    }

    const all = await prisma.itemPrice.findMany({ where: { itemType: { not: 'meta' } } })
    const map: Record<string, number> = {}
    for (const row of all) map[`${row.itemType}:${row.itemId}`] = row.price
    res.json({ data: map })
  } catch {
    res.status(500).json({ error: 'Failed to fetch prices' })
  }
})

// ── Daily Coins ───────────────────────────────────────────────────────────────

router.post('/daily-coins', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return }
  try {
    const { streak } = req.body as { streak?: number }
    const streakDay = typeof streak === 'number' && streak >= 1 ? streak : 1
    const coinBonus = Math.min(275, 30 + (streakDay - 1) * 5)

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { coins: true, lastCoinClaim: true } })
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    const todayUTC = new Date().toISOString().slice(0, 10)
    const lastClaimDate = user.lastCoinClaim ? user.lastCoinClaim.toISOString().slice(0, 10) : null
    const alreadyClaimed = lastClaimDate === todayUTC

    // Always sync loginStreak so the leaderboard stays accurate.
    // Only award coins + update lastCoinClaim on the first claim of the day.
    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(alreadyClaimed ? {} : { coins: { increment: coinBonus }, lastCoinClaim: new Date() }),
        loginStreak: streakDay,
      },
      select: { coins: true },
    })
    res.json({ data: { coins: updated.coins, claimed: !alreadyClaimed, alreadyClaimed, coinBonus } })
  } catch {
    res.status(500).json({ error: 'Failed to claim daily coins' })
  }
})

// ── Inventory ─────────────────────────────────────────────────────────────────

router.get('/inventory', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { coins: true, tag: true, tagColor: true, nameColor: true, pfpEffect: true, ownedNameColors: true, ownedPfpEffects: true, lastCoinClaim: true, allTags: true },
    })
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    const todayUTC = new Date().toISOString().slice(0, 10)
    const canClaimToday = !user.lastCoinClaim || user.lastCoinClaim.toISOString().slice(0, 10) !== todayUTC

    const rawTags = parseTagArr(user.allTags)
    const ownedTags = rawTags.map(t => {
      const def = TAG_BOX_ITEMS.find(d => d.tag === t.tag)
      const streakMeta = STREAK_TAG_META[t.tag]
      return { id: def?.id ?? t.tag, tag: t.tag, tagColor: def?.tagColor ?? t.tagColor, rarity: def?.rarity ?? streakMeta?.rarity ?? 'Common' }
    })

    res.json({
      data: {
        coins: user.coins,
        canClaimToday,
        tag: user.tag,
        tagColor: user.tagColor,
        nameColor: user.nameColor,
        pfpEffect: user.pfpEffect,
        ownedTags,
        ownedNameColors: parseJsonArr(user.ownedNameColors),
        ownedPfpEffects: parseJsonArr(user.ownedPfpEffects),
      },
    })
  } catch {
    res.status(500).json({ error: 'Failed to fetch inventory' })
  }
})

// ── Unbox auto-post helper ────────────────────────────────────────────────────

async function autoPostUnbox(
  userId: number,
  boxType: string,
  itemId: string,
  itemName: string,
  itemValue: string | undefined,
  itemRarity: string,
  itemTagColor: string | undefined,
): Promise<void> {
  try {
    const emoji = itemRarity === 'Mythic' ? '👑' : '🌟'
    const seedKey = `${boxType}:${itemId}`
    const estValue = SEED_PRICES[seedKey] ?? 0

    const postUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, tag: true, tagColor: true, nameColor: true, pfpEffect: true, avatarUrl: true },
    })
    if (!postUser) return

    const newPost = await prisma.post.create({
      data: {
        body: `${emoji} I just spun ${itemName}!`,
        userId,
        type: 'UNBOX',
        unboxItemType: boxType,
        unboxItemId: itemId,
        unboxItemName: itemName,
        unboxItemValue: itemValue ?? itemTagColor ?? null,
        unboxItemRarity: itemRarity,
        unboxItemEstValue: estValue,
        unboxItemTagColor: itemTagColor ?? null,
      },
      include: {
        likes: { select: { userId: true } },
        giveawayEntries: { select: { userId: true } },
        giveawayWinner: { select: { id: true, name: true } },
        _count: { select: { likes: true, comments: true, giveawayEntries: true } },
      },
    })

    broadcast('NEW_POST', { ...newPost, user: postUser, likedByMe: false, enteredByMe: false })
    console.log(`[autoPostUnbox] ✓ Post created for user ${userId}: ${itemRarity} ${itemName}`)
  } catch (e) {
    console.error('[autoPostUnbox] Failed for user', userId, e)
  }
}

// ── Open Box ──────────────────────────────────────────────────────────────────

router.post('/open-box', requireAuth, txLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return }
  const { boxType, quantity: rawQty = 1 } = req.body as { boxType?: string; quantity?: number }
  const quantity = Math.max(1, Math.min(1_000_000, Math.floor(Number(rawQty) || 1)))

  if (!boxType || !['tag', 'name-color', 'pfp', 'dev-curse'].includes(boxType)) {
    res.status(400).json({ error: 'boxType must be tag, name-color, pfp, or dev-curse' }); return
  }

  const BOX_COSTS: Record<string, number> = { tag: 10, 'name-color': 15, pfp: 20, 'dev-curse': 1 }
  const BOX_COST = BOX_COSTS[boxType]
  const totalCost = BOX_COST * quantity

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { coins: true, allTags: true, ownedNameColors: true, ownedPfpEffects: true },
    })
    if (!user) { res.status(404).json({ error: 'User not found' }); return }
    if (user.coins < totalCost) {
      const maxAffordable = Math.floor(user.coins / BOX_COST)
      res.status(402).json({ error: 'Not enough coins', coins: user.coins, maxAffordable }); return
    }

    const newTags = parseTagArr(user.allTags)
    const newColors = parseJsonArr(user.ownedNameColors)
    const newPfps = parseJsonArr(user.ownedPfpEffects)
    const tagSet   = new Set(newTags.map(t => t.tag))
    const colorSet = new Set(newColors.map(c => c.id as string))
    const pfpSet   = new Set(newPfps.map(p => p.id as string))

    const results: Array<{ won: Record<string, unknown>; alreadyHad: boolean }> = []
    const postArgs: Parameters<typeof autoPostUnbox>[] = []

    for (let i = 0; i < quantity; i++) {
      if (boxType === 'tag') {
        const won = weightedRandom(TAG_BOX_ITEMS)
        const alreadyHad = tagSet.has(won.tag)
        newTags.push({ tag: won.tag, tagColor: won.tagColor })
        tagSet.add(won.tag)
        results.push({ won: { ...won, type: 'tag' }, alreadyHad })
        if (won.rarity === 'Legendary' || won.rarity === 'Mythic')
          postArgs.push([req.userId, 'tag', won.id, won.tag, undefined, won.rarity, won.tagColor])

      } else if (boxType === 'name-color') {
        const won = weightedRandom(NAME_COLOR_BOX_ITEMS)
        const alreadyHad = colorSet.has(won.id)
        newColors.push({ id: won.id, name: won.name, value: won.value, rarity: won.rarity })
        colorSet.add(won.id)
        results.push({ won: { ...won, type: 'name-color' }, alreadyHad })
        if (won.rarity === 'Legendary' || won.rarity === 'Mythic')
          postArgs.push([req.userId, 'name-color', won.id, won.name, won.value, won.rarity, undefined])

      } else if (boxType === 'pfp') {
        const won = weightedRandom(PFP_EFFECT_BOX_ITEMS)
        const alreadyHad = pfpSet.has(won.id)
        newPfps.push({ id: won.id, name: won.name, value: won.value, rarity: won.rarity })
        pfpSet.add(won.id)
        results.push({ won: { ...won, type: 'pfp' }, alreadyHad })
        if (won.rarity === 'Legendary' || won.rarity === 'Mythic')
          postArgs.push([req.userId, 'pfp', won.id, won.name, won.value, won.rarity, undefined])

      } else { // dev-curse
        const cursed = weightedRandom(DEV_CURSE_ITEMS)
        if (cursed.itemType === 'tag') {
          const alreadyHad = tagSet.has(cursed.tag!)
          newTags.push({ tag: cursed.tag!, tagColor: cursed.tagColor! })
          tagSet.add(cursed.tag!)
          results.push({ won: { id: cursed.id, name: cursed.name, tag: cursed.tag, tagColor: cursed.tagColor, rarity: cursed.rarity, type: 'tag' }, alreadyHad })
          if (cursed.rarity === 'Unobtainable')
            postArgs.push([req.userId, 'tag', cursed.id, cursed.tag!, undefined, cursed.rarity, cursed.tagColor])
        } else {
          const alreadyHad = pfpSet.has(cursed.id)
          newPfps.push({ id: cursed.id, name: cursed.name, value: cursed.value, rarity: cursed.rarity })
          pfpSet.add(cursed.id)
          results.push({ won: { id: cursed.id, name: cursed.name, value: cursed.value, rarity: cursed.rarity, type: 'pfp' }, alreadyHad })
          if (cursed.rarity === 'Unobtainable')
            postArgs.push([req.userId, 'pfp', cursed.id, cursed.name, cursed.value!, cursed.rarity, undefined])
        }
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        coins: { decrement: totalCost },
        allTags: JSON.stringify(newTags),
        ownedNameColors: JSON.stringify(newColors),
        ownedPfpEffects: JSON.stringify(newPfps),
      },
      select: { coins: true },
    })

    if (quantity === 1) {
      res.json({ data: { coins: updated.coins, won: results[0].won, alreadyHad: results[0].alreadyHad } })
    } else {
      res.json({ data: { coins: updated.coins, results } })
    }

    for (const args of postArgs) autoPostUnbox(...args)
  } catch {
    res.status(500).json({ error: 'Failed to open box' })
  }
})

// ── Quicksell ─────────────────────────────────────────────────────────────────

const QUICKSELL_PRICES: Record<string, number> = {
  Common: 3, Uncommon: 7, Rare: 13, Epic: 27, Legendary: 100, Mythic: 667, Unobtainable: 5000,
}

router.post('/quicksell/duplicates', requireAuth, txLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return }
  try {
    // exclude = ["tag:someId", "pfp:otherId", ...] — kept entirely (all copies)
    const exclude = new Set<string>((req.body as { exclude?: string[] }).exclude ?? [])

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { coins: true, allTags: true, ownedNameColors: true, ownedPfpEffects: true },
    })
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    const rawTags = parseTagArr(user.allTags)
    const rawColors = parseJsonArr(user.ownedNameColors) as Array<{ id: string; rarity?: string; [k: string]: unknown }>
    const rawPfps  = parseJsonArr(user.ownedPfpEffects)  as Array<{ id: string; rarity?: string; [k: string]: unknown }>

    let totalPayout = 0

    // Keep first occurrence of each tag; sell remaining duplicates (unless excluded)
    const finalTags: typeof rawTags = []
    const tagKept = new Set<string>()
    for (const t of rawTags) {
      const key = `tag:${t.tag}`
      if (exclude.has(key) || !tagKept.has(t.tag)) { finalTags.push(t); tagKept.add(t.tag) }
      else {
        const def = TAG_BOX_ITEMS.find(d => d.tag === t.tag)
        totalPayout += QUICKSELL_PRICES[def?.rarity ?? 'Common'] ?? 5
      }
    }

    // Keep first occurrence of each name-color id (unless excluded)
    const finalColors: typeof rawColors = []
    const colorKept = new Set<string>()
    for (const c of rawColors) {
      const key = `name-color:${c.id}`
      if (exclude.has(key) || !colorKept.has(c.id)) { finalColors.push(c); colorKept.add(c.id) }
      else { totalPayout += QUICKSELL_PRICES[c.rarity ?? 'Common'] ?? 5 }
    }

    // Keep first occurrence of each pfp id (unless excluded)
    const finalPfps: typeof rawPfps = []
    const pfpKept = new Set<string>()
    for (const p of rawPfps) {
      const key = `pfp:${p.id}`
      if (exclude.has(key) || !pfpKept.has(p.id)) { finalPfps.push(p); pfpKept.add(p.id) }
      else { totalPayout += QUICKSELL_PRICES[p.rarity ?? 'Common'] ?? 5 }
    }

    if (totalPayout === 0) {
      res.json({ data: { coins: user.coins, sold: 0, totalPayout: 0 } })
      return
    }

    const sold = (rawTags.length - finalTags.length) + (rawColors.length - finalColors.length) + (rawPfps.length - finalPfps.length)
    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        allTags: JSON.stringify(finalTags),
        ownedNameColors: JSON.stringify(finalColors),
        ownedPfpEffects: JSON.stringify(finalPfps),
        coins: { increment: totalPayout },
      },
      select: { coins: true },
    })
    res.json({ data: { coins: updated.coins, sold, totalPayout } })
  } catch {
    res.status(500).json({ error: 'Failed to sell duplicates' })
  }
})

router.post('/quicksell', requireAuth, txLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return }
  const { itemType, itemId } = req.body as { itemType?: string; itemId?: string }
  if (!itemType || !['tag', 'name-color', 'pfp'].includes(itemType) || !itemId) {
    res.status(400).json({ error: 'itemType and itemId are required' }); return
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { coins: true, allTags: true, ownedNameColors: true, ownedPfpEffects: true },
    })
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    let rarity = 'Common'
    let data: Record<string, unknown> = {}

    if (itemType === 'tag') {
      const tags = parseTagArr(user.allTags)
      const def = TAG_BOX_ITEMS.find(t => t.id === itemId)
      if (def) {
        // Box tag — match by tag name from definition
        rarity = def.rarity
        const idx = tags.findIndex(t => t.tag === def.tag)
        if (idx === -1) { res.status(404).json({ error: 'You do not own this item' }); return }
        tags.splice(idx, 1)
      } else {
        // Awarded/admin-granted tag — itemId is the tag string itself
        const idx = tags.findIndex(t => t.tag === itemId)
        if (idx === -1) { res.status(404).json({ error: 'You do not own this item' }); return }
        rarity = 'Common'
        tags.splice(idx, 1)
      }
      data = { allTags: JSON.stringify(tags) }
    } else if (itemType === 'name-color') {
      const owned = parseJsonArr(user.ownedNameColors)
      const idx = owned.findIndex((i: { id: string; rarity?: string }) => i.id === itemId)
      if (idx === -1) { res.status(404).json({ error: 'You do not own this item' }); return }
      rarity = (owned[idx] as { rarity?: string }).rarity ?? 'Common'
      owned.splice(idx, 1)
      data = { ownedNameColors: JSON.stringify(owned) }
    } else {
      const owned = parseJsonArr(user.ownedPfpEffects)
      const idx = owned.findIndex((i: { id: string; rarity?: string }) => i.id === itemId)
      if (idx === -1) { res.status(404).json({ error: 'You do not own this item' }); return }
      rarity = (owned[idx] as { rarity?: string }).rarity ?? 'Common'
      owned.splice(idx, 1)
      data = { ownedPfpEffects: JSON.stringify(owned) }
    }

    const payout = QUICKSELL_PRICES[rarity] ?? 5
    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { ...data, coins: { increment: payout } },
      select: { coins: true },
    })
    res.json({ data: { coins: updated.coins, payout } })
  } catch {
    res.status(500).json({ error: 'Failed to quicksell' })
  }
})

// ── Equip ─────────────────────────────────────────────────────────────────────

router.put('/equip', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return }
  const { type, itemId } = req.body as { type?: string; itemId?: string | null }
  if (!type || !['name-color', 'pfp', 'tag'].includes(type)) {
    res.status(400).json({ error: 'type must be name-color, pfp, or tag' }); return
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { ownedNameColors: true, ownedPfpEffects: true, allTags: true, tag: true, tagColor: true },
    })
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    if (type === 'tag') {
      if (itemId) {
        const owned = parseTagArr(user.allTags)
        const tagDef = TAG_BOX_ITEMS.find(d => d.id === itemId)
        const ownedMatch = owned.find(t => (TAG_BOX_ITEMS.find(d => d.tag === t.tag)?.id ?? t.tag) === itemId)
        if (!ownedMatch) { res.status(403).json({ error: 'You do not own this tag' }); return }
        const updated = await prisma.user.update({
          where: { id: req.userId },
          data: { tag: ownedMatch.tag, tagColor: tagDef?.tagColor ?? ownedMatch.tagColor },
          select: { tag: true, tagColor: true },
        })
        res.json({ data: { tag: updated.tag, tagColor: updated.tagColor } })
      } else {
        const updated = await prisma.user.update({
          where: { id: req.userId },
          data: { tag: 'Student', tagColor: 'grey' },
          select: { tag: true, tagColor: true },
        })
        res.json({ data: { tag: updated.tag, tagColor: updated.tagColor } })
      }
      return
    }
    if (type === 'name-color') {
      if (itemId !== null && itemId !== undefined) {
        const owned = parseJsonArr(user.ownedNameColors)
        const item = owned.find(i => i.id === itemId)
        if (!item) { res.status(403).json({ error: 'You do not own this item' }); return }
      }
      const updated = await prisma.user.update({
        where: { id: req.userId },
        data: { nameColor: itemId ? (parseJsonArr(user.ownedNameColors).find(i => i.id === itemId) as { value?: string } | undefined)?.value ?? null : null },
        select: { nameColor: true },
      })
      res.json({ data: { nameColor: updated.nameColor } })
    } else {
      if (itemId !== null && itemId !== undefined) {
        const owned = parseJsonArr(user.ownedPfpEffects)
        const item = owned.find(i => i.id === itemId)
        if (!item) { res.status(403).json({ error: 'You do not own this item' }); return }
      }
      const updated = await prisma.user.update({
        where: { id: req.userId },
        data: { pfpEffect: itemId ? (parseJsonArr(user.ownedPfpEffects).find(i => i.id === itemId) as { value?: string } | undefined)?.value ?? null : null },
        select: { pfpEffect: true },
      })
      res.json({ data: { pfpEffect: updated.pfpEffect } })
    }
  } catch {
    res.status(500).json({ error: 'Failed to equip item' })
  }
})

// ── DEV Admin Grant (self only) ───────────────────────────────────────────────

router.post('/admin/grant', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, amount, itemId } = req.body as {
      type: 'coins' | 'name-color' | 'pfp' | 'tag'
      amount?: number
      itemId?: string
    }

    if (type === 'coins') {
      if (typeof amount !== 'number' || amount < 0) { res.status(400).json({ error: 'amount must be a non-negative number' }); return }
      const updated = await prisma.user.update({ where: { id: req.userId }, data: { coins: { increment: amount } }, select: { coins: true } })
      res.json({ data: { coins: updated.coins } })

    } else if (type === 'name-color') {
      const pool = NAME_COLOR_BOX_ITEMS
      const item = itemId ? pool.find(i => i.id === itemId) : null
      if (!item) { res.status(400).json({ error: 'Unknown name-color itemId' }); return }
      const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { ownedNameColors: true } })
      const owned = parseJsonArr(user?.ownedNameColors)
      owned.push({ id: item.id, name: item.name, value: item.value, rarity: item.rarity })
      await prisma.user.update({ where: { id: req.userId }, data: { ownedNameColors: JSON.stringify(owned) } })
      res.json({ data: { granted: item } })

    } else if (type === 'pfp') {
      const pool = PFP_EFFECT_BOX_ITEMS
      const item = itemId ? pool.find(i => i.id === itemId) : null
      if (!item) { res.status(400).json({ error: 'Unknown pfp itemId' }); return }
      const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { ownedPfpEffects: true } })
      const owned = parseJsonArr(user?.ownedPfpEffects)
      owned.push({ id: item.id, name: item.name, value: item.value, rarity: item.rarity })
      await prisma.user.update({ where: { id: req.userId }, data: { ownedPfpEffects: JSON.stringify(owned) } })
      res.json({ data: { granted: item } })

    } else if (type === 'tag') {
      if (!itemId?.trim()) { res.status(400).json({ error: 'Provide a tag id' }); return }
      const id = itemId.trim()
      const tagDef = TAG_BOX_ITEMS.find(t => t.id === id) ?? SPECIAL_TAGS.find(t => t.id === id)
      if (!tagDef) { res.status(400).json({ error: 'Unknown tag id' }); return }
      const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { allTags: true, tag: true } })
      const existing = parseTagArr(user?.allTags)
      const filtered = existing.filter(t => t.tag !== tagDef.tag)
      const newAllTags = [...filtered, { tag: tagDef.tag, tagColor: tagDef.tagColor }]
      const updated = await prisma.user.update({
        where: { id: req.userId },
        data: {
          allTags: JSON.stringify(newAllTags),
          tag: tagDef.tag,
          tagColor: tagDef.tagColor,
        },
        select: { tag: true, tagColor: true },
      })
      res.json({ data: { granted: { id: tagDef.id, tag: tagDef.tag, tagColor: tagDef.tagColor, rarity: tagDef.rarity }, tag: updated.tag, tagColor: updated.tagColor } })

    } else {
      res.status(400).json({ error: 'Unknown grant type' })
    }
  } catch {
    res.status(500).json({ error: 'Failed to process grant' })
  }
})

// ── Catalog ────────────────────────────────────────────────────────────────────

router.get('/catalog', (_req, res: Response) => {
  res.json({
    data: {
      tagBox: TAG_BOX_ITEMS,
      specialTags: SPECIAL_TAGS,
      nameColorBox: NAME_COLOR_BOX_ITEMS,
      pfpBox: PFP_EFFECT_BOX_ITEMS,
      boxCost: 10,
    },
  })
})

// ── Marketplace Listings ───────────────────────────────────────────────────────

router.get('/listings', requireAuth, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const listings = await prisma.marketplaceListing.findMany({
      where: { status: 'ACTIVE' },
      include: {
        seller: { select: { id: true, name: true, tag: true, tagColor: true, nameColor: true } },
      },
      orderBy: [{ price: 'desc' }, { itemRarityRank: 'desc' }],
    })
    res.json({ data: listings })
  } catch {
    res.status(500).json({ error: 'Failed to fetch listings' })
  }
})

router.post('/listings', requireAuth, txLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return }
  const { itemType, itemId, price } = req.body as { itemType?: string; itemId?: string; price?: number }

  if (!itemType || !['tag', 'name-color', 'pfp'].includes(itemType)) {
    res.status(400).json({ error: 'itemType must be tag, name-color, or pfp' }); return
  }
  if (!itemId || typeof itemId !== 'string') {
    res.status(400).json({ error: 'itemId is required' }); return
  }
  if (typeof price !== 'number' || price < 10 || !Number.isInteger(price)) {
    res.status(400).json({ error: 'price must be an integer >= 10' }); return
  }
  if (itemType === 'tag' && NON_TRADEABLE_TAGS.has(itemId)) {
    res.status(403).json({ error: 'This tag cannot be listed on the marketplace' }); return
  }

  const listingFee = Math.floor(price * 0.1)

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { coins: true, allTags: true, ownedNameColors: true, ownedPfpEffects: true, tag: true, nameColor: true, pfpEffect: true },
    })
    if (!user) { res.status(404).json({ error: 'User not found' }); return }
    if (user.coins < listingFee) {
      res.status(402).json({ error: `Not enough coins for listing fee (${listingFee} coins required)` }); return
    }

    // Resolve item metadata and verify ownership
    let itemName = ''
    let itemValue = ''
    let itemRarity = ''
    const tradeItem: TradeItem = { type: itemType as 'tag' | 'name-color' | 'pfp', id: itemId, rarity: '' }

    if (itemType === 'tag') {
      const def = TAG_BOX_ITEMS.find(t => t.id === itemId)
      const ownedTags = parseTagArr(user.allTags)
      if (def) {
        // also match old tag name in case item was renamed after user acquired it
        if (!ownedTags.some(t => t.tag === def.tag || t.tag === def.id)) {
          res.status(403).json({ error: 'You do not own this tag' }); return
        }
        itemName = def.tag; itemValue = def.tagColor; itemRarity = def.rarity
        tradeItem.tag = def.tag; tradeItem.tagColor = def.tagColor; tradeItem.rarity = def.rarity
      } else {
        // Awarded/admin-granted tag — itemId is the tag string itself
        const owned = ownedTags.find(t => t.tag === itemId)
        if (!owned) { res.status(403).json({ error: 'You do not own this tag' }); return }
        const streakMeta = STREAK_TAG_META[owned.tag]
        const fallbackRarity = streakMeta?.rarity ?? 'Common'
        itemName = owned.tag; itemValue = owned.tagColor; itemRarity = fallbackRarity
        tradeItem.tag = owned.tag; tradeItem.tagColor = owned.tagColor; tradeItem.rarity = fallbackRarity
      }
    } else if (itemType === 'name-color') {
      const owned = parseJsonArr(user.ownedNameColors)
      const def = owned.find(i => i.id === itemId) as { id: string; name: string; value: string; rarity: string } | undefined
      if (!def) { res.status(403).json({ error: 'You do not own this name color' }); return }
      const catalogDef = NAME_COLOR_BOX_ITEMS.find(c => c.id === itemId)
      itemName = def.name; itemValue = def.value; itemRarity = def.rarity
      tradeItem.name = def.name; tradeItem.value = def.value; tradeItem.rarity = def.rarity
      if (!catalogDef) { res.status(400).json({ error: 'Unknown name color item' }); return }
    } else {
      const owned = parseJsonArr(user.ownedPfpEffects)
      const def = owned.find(i => i.id === itemId) as { id: string; name: string; value: string; rarity: string } | undefined
      if (!def) { res.status(403).json({ error: 'You do not own this pfp effect' }); return }
      const catalogDef = PFP_EFFECT_BOX_ITEMS.find(c => c.id === itemId)
      itemName = def.name; itemValue = def.value; itemRarity = def.rarity
      tradeItem.name = def.name; tradeItem.value = def.value; tradeItem.rarity = def.rarity
      if (!catalogDef) { res.status(400).json({ error: 'Unknown pfp effect item' }); return }
    }

    const inventoryUpdates = removeItem(user, tradeItem)

    const listing = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.userId },
        data: { coins: { decrement: listingFee }, ...inventoryUpdates },
      })
      return tx.marketplaceListing.create({
        data: {
          sellerId: req.userId!,
          itemType,
          itemId,
          itemName,
          itemValue,
          itemRarity,
          itemRarityRank: RARITY_RANK[itemRarity] ?? 0,
          price,
          status: 'ACTIVE',
        },
        include: { seller: { select: { id: true, name: true, tag: true, tagColor: true, nameColor: true } } },
      })
    })

    res.json({ data: { listing, listingFee } })
  } catch {
    res.status(500).json({ error: 'Failed to create listing' })
  }
})

router.delete('/listings/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return }
  const listingId = parseInt(req.params.id)
  if (isNaN(listingId)) { res.status(400).json({ error: 'Invalid listing id' }); return }

  try {
    const listing = await prisma.marketplaceListing.findUnique({ where: { id: listingId } })
    if (!listing) { res.status(404).json({ error: 'Listing not found' }); return }
    if (listing.sellerId !== req.userId) { res.status(403).json({ error: 'Not your listing' }); return }
    if (listing.status !== 'ACTIVE') { res.status(400).json({ error: 'Listing is not active' }); return }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { allTags: true, ownedNameColors: true, ownedPfpEffects: true, tag: true, nameColor: true, pfpEffect: true },
    })
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    const tradeItem: TradeItem = {
      type: listing.itemType as 'tag' | 'name-color' | 'pfp',
      id: listing.itemId,
      rarity: listing.itemRarity,
      name: listing.itemName,
      value: listing.itemValue,
      tag: listing.itemType === 'tag' ? listing.itemName : undefined,
      tagColor: listing.itemType === 'tag' ? listing.itemValue : undefined,
    }
    const addUpdates = addItem(user, tradeItem)

    await prisma.$transaction([
      prisma.user.update({ where: { id: req.userId }, data: addUpdates }),
      prisma.marketplaceListing.update({ where: { id: listingId }, data: { status: 'CANCELLED' } }),
    ])

    res.json({ data: { ok: true } })
  } catch {
    res.status(500).json({ error: 'Failed to cancel listing' })
  }
})

router.post('/listings/:id/buy', requireAuth, txLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return }
  const listingId = parseInt(req.params.id)
  if (isNaN(listingId)) { res.status(400).json({ error: 'Invalid listing id' }); return }

  try {
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      include: { seller: { select: { id: true } } },
    })
    if (!listing) { res.status(404).json({ error: 'Listing not found' }); return }
    if (listing.status !== 'ACTIVE') { res.status(400).json({ error: 'Listing is no longer available' }); return }
    if (listing.sellerId === req.userId) { res.status(400).json({ error: 'Cannot buy your own listing' }); return }

    const COOLDOWN_MS = 5 * 60 * 1000
    const elapsed = Date.now() - listing.createdAt.getTime()
    if (elapsed < COOLDOWN_MS) {
      const secondsRemaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000)
      res.status(400).json({ error: 'COOLDOWN_REQUIRED', secondsRemaining }); return
    }

    const buyer = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { coins: true, allTags: true, ownedNameColors: true, ownedPfpEffects: true, tag: true, nameColor: true, pfpEffect: true },
    })
    if (!buyer) { res.status(404).json({ error: 'User not found' }); return }
    if (buyer.coins < listing.price) {
      res.status(402).json({ error: `Not enough coins (need ${listing.price})` }); return
    }

    const tradeItem: TradeItem = {
      type: listing.itemType as 'tag' | 'name-color' | 'pfp',
      id: listing.itemId,
      rarity: listing.itemRarity,
      name: listing.itemName,
      value: listing.itemValue,
      tag: listing.itemType === 'tag' ? listing.itemName : undefined,
      tagColor: listing.itemType === 'tag' ? listing.itemValue : undefined,
    }
    const addUpdates = addItem(buyer, tradeItem)

    const [updatedBuyer] = await prisma.$transaction([
      prisma.user.update({ where: { id: req.userId }, data: { coins: { decrement: listing.price }, ...addUpdates } }),
      prisma.user.update({ where: { id: listing.sellerId }, data: { coins: { increment: listing.price } } }),
      prisma.marketplaceListing.update({ where: { id: listingId }, data: { status: 'SOLD', buyerId: req.userId } }),
    ])

    // Update estimated price: rolling average of current price and actual sale price
    try {
      const current = await prisma.itemPrice.findUnique({
        where: { itemType_itemId: { itemType: listing.itemType, itemId: listing.itemId } },
      })
      const seedKey = `${listing.itemType}:${listing.itemId}`
      const currentPrice = current?.price ?? SEED_PRICES[seedKey] ?? listing.price
      const newPrice = Math.round((currentPrice + listing.price) / 2)
      await prisma.itemPrice.upsert({
        where: { itemType_itemId: { itemType: listing.itemType, itemId: listing.itemId } },
        create: { itemType: listing.itemType, itemId: listing.itemId, price: newPrice },
        update: { price: newPrice },
      })
    } catch { /* non-critical, don't fail the purchase */ }

    // Create notification outside transaction so we can include sender relation and push via WebSocket
    const notif = await prisma.notification.create({
      data: {
        userId: listing.sellerId,
        fromUserId: req.userId,
        type: 'LISTING_SOLD',
        preview: `${listing.itemName} for 🪙 ${listing.price}`,
      },
      include: {
        sender: { select: { id: true, name: true, tag: true, tagColor: true, nameColor: true, pfpEffect: true, chatBanned: true, chatMutedUntil: true, deletedAt: true, role: true, allTags: true } },
      },
    })
    const sender = notif.sender
    const senderOut = { id: sender.id, name: sender.name, tag: sender.tag, tagColor: sender.tagColor, nameColor: sender.nameColor, pfpEffect: sender.pfpEffect }
    sendToUser(listing.sellerId, 'NOTIFICATION', { ...notif, sender: senderOut })

    res.json({ data: { ok: true, coins: updatedBuyer.coins } })
  } catch {
    res.status(500).json({ error: 'Failed to purchase listing' })
  }
})

// ── User Public Inventory (for trading) ───────────────────────────────────────

router.get('/users/:userId/inventory', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const targetId = parseInt(req.params.userId)
  if (isNaN(targetId)) { res.status(400).json({ error: 'Invalid userId' }); return }

  try {
    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, tag: true, tagColor: true, nameColor: true, allTags: true, ownedNameColors: true, ownedPfpEffects: true },
    })
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    const rawTags = parseTagArr(user.allTags)
    const tags = rawTags
      .filter(t => !NON_TRADEABLE_TAGS.has(t.tag))
      .map(t => {
        const def = TAG_BOX_ITEMS.find(d => d.tag === t.tag)
        const streakMeta = STREAK_TAG_META[t.tag]
        return { id: def?.id ?? t.tag, tag: t.tag, tagColor: def?.tagColor ?? t.tagColor, rarity: def?.rarity ?? streakMeta?.rarity ?? 'Common' }
      })

    res.json({
      data: {
        user: { id: user.id, name: user.name, tag: user.tag, tagColor: user.tagColor, nameColor: user.nameColor },
        tags,
        nameColors: parseJsonArr(user.ownedNameColors),
        pfpEffects: parseJsonArr(user.ownedPfpEffects),
      },
    })
  } catch {
    res.status(500).json({ error: 'Failed to fetch user inventory' })
  }
})

// ── Trades — order matters: static before dynamic ─────────────────────────────

router.get('/trades/incoming', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return }
  try {
    const trades = await prisma.tradeOffer.findMany({
      where: { receiverId: req.userId, status: 'PENDING' },
      include: {
        sender: { select: { id: true, name: true, tag: true, tagColor: true, nameColor: true } },
        receiver: { select: { id: true, name: true, tag: true, tagColor: true, nameColor: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ data: trades })
  } catch {
    res.status(500).json({ error: 'Failed to fetch incoming trades' })
  }
})

router.get('/trades/sent', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return }
  try {
    const trades = await prisma.tradeOffer.findMany({
      where: { senderId: req.userId, status: 'PENDING' },
      include: {
        sender: { select: { id: true, name: true, tag: true, tagColor: true, nameColor: true } },
        receiver: { select: { id: true, name: true, tag: true, tagColor: true, nameColor: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ data: trades })
  } catch {
    res.status(500).json({ error: 'Failed to fetch sent trades' })
  }
})

router.get('/trades/history', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return }
  try {
    const trades = await prisma.tradeOffer.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ senderId: req.userId }, { receiverId: req.userId }],
      },
      include: {
        sender: { select: { id: true, name: true, tag: true, tagColor: true, nameColor: true } },
        receiver: { select: { id: true, name: true, tag: true, tagColor: true, nameColor: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })
    res.json({ data: trades })
  } catch {
    res.status(500).json({ error: 'Failed to fetch trade history' })
  }
})

router.post('/trades', requireAuth, txLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return }
  const { receiverId, senderItems, receiverItems } = req.body as {
    receiverId?: number
    senderItems?: TradeItem[]
    receiverItems?: TradeItem[]
  }

  if (!receiverId || typeof receiverId !== 'number') { res.status(400).json({ error: 'receiverId required' }); return }
  if (receiverId === req.userId) { res.status(400).json({ error: 'Cannot trade with yourself' }); return }
  if (!Array.isArray(senderItems) || senderItems.length === 0) { res.status(400).json({ error: 'senderItems must be a non-empty array' }); return }
  if (!Array.isArray(receiverItems) || receiverItems.length === 0) { res.status(400).json({ error: 'receiverItems must be a non-empty array' }); return }

  const hasNonTradeable = [...senderItems, ...receiverItems].some(
    i => i.type === 'tag' && NON_TRADEABLE_TAGS.has(i.id)
  )
  if (hasNonTradeable) { res.status(403).json({ error: 'One or more items cannot be traded' }); return }

  const TRADE_COST = 5
  try {
    const [sender, receiver] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.userId },
        select: { coins: true, allTags: true, ownedNameColors: true, ownedPfpEffects: true, tag: true, nameColor: true, pfpEffect: true },
      }),
      prisma.user.findUnique({ where: { id: receiverId }, select: { id: true } }),
    ])

    if (!sender) { res.status(404).json({ error: 'User not found' }); return }
    if (!receiver) { res.status(404).json({ error: 'Trade partner not found' }); return }
    if (sender.coins < TRADE_COST) { res.status(402).json({ error: 'Not enough coins (need 5 to send a trade)' }); return }

    for (const item of senderItems) {
      if (!userOwnsItem(sender, item)) {
        res.status(403).json({ error: `You do not own: ${item.name ?? item.tag ?? item.id}` }); return
      }
    }

    const removeUpdates = applyMultipleRemoves(sender, senderItems)

    const trade = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.userId },
        data: { coins: { decrement: TRADE_COST }, ...removeUpdates },
      })
      const created = await tx.tradeOffer.create({
        data: {
          senderId: req.userId!,
          receiverId,
          senderItems: JSON.stringify(senderItems),
          receiverItems: JSON.stringify(receiverItems),
          status: 'PENDING',
        },
        include: {
          sender: { select: { id: true, name: true, tag: true, tagColor: true, nameColor: true } },
          receiver: { select: { id: true, name: true, tag: true, tagColor: true, nameColor: true } },
        },
      })
      await tx.notification.create({
        data: {
          userId: receiverId,
          fromUserId: req.userId!,
          type: 'TRADE_OFFER',
          preview: `${sender} sent you a trade offer`,
        },
      })
      return created
    })

    res.json({ data: trade })
  } catch {
    res.status(500).json({ error: 'Failed to create trade offer' })
  }
})

router.post('/trades/:id/accept', requireAuth, txLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return }
  const tradeId = parseInt(req.params.id)
  if (isNaN(tradeId)) { res.status(400).json({ error: 'Invalid trade id' }); return }

  try {
    const trade = await prisma.tradeOffer.findUnique({ where: { id: tradeId } })
    if (!trade) { res.status(404).json({ error: 'Trade not found' }); return }
    if (trade.receiverId !== req.userId) { res.status(403).json({ error: 'Not your trade to accept' }); return }
    if (trade.status !== 'PENDING') { res.status(400).json({ error: 'Trade is no longer pending' }); return }

    await prisma.$transaction(async (tx) => {
      const [senderSnap, receiverSnap] = await Promise.all([
        tx.user.findUnique({
          where: { id: trade.senderId },
          select: { allTags: true, ownedNameColors: true, ownedPfpEffects: true, tag: true, nameColor: true, pfpEffect: true },
        }),
        tx.user.findUnique({
          where: { id: trade.receiverId },
          select: { allTags: true, ownedNameColors: true, ownedPfpEffects: true, tag: true, nameColor: true, pfpEffect: true },
        }),
      ])
      if (!senderSnap || !receiverSnap) throw new Error('User not found')

      const senderItems = parseTradeItems(trade.senderItems)
      const receiverItems = parseTradeItems(trade.receiverItems)

      for (const item of receiverItems) {
        if (!userOwnsItem(receiverSnap, item)) {
          throw new Error(`You no longer own: ${item.name ?? item.tag ?? item.id}`)
        }
      }

      const receiverRemoveUpdates = applyMultipleRemoves(receiverSnap, receiverItems)
      const receiverAddUpdates = applyMultipleAdds({ ...receiverSnap, ...receiverRemoveUpdates }, senderItems)

      const senderAddUpdates = applyMultipleAdds(senderSnap, receiverItems)

      await Promise.all([
        tx.user.update({ where: { id: trade.senderId }, data: senderAddUpdates }),
        tx.user.update({ where: { id: trade.receiverId }, data: { ...receiverRemoveUpdates, ...receiverAddUpdates } }),
        tx.tradeOffer.update({ where: { id: tradeId }, data: { status: 'ACCEPTED' } }),
        tx.notification.create({
          data: {
            userId: trade.senderId,
            fromUserId: req.userId!,
            type: 'TRADE_ACCEPTED',
            preview: 'Your trade offer was accepted',
          },
        }),
      ])
    })

    res.json({ data: { ok: true } })
  } catch (err) {
    console.error('[MARKETPLACE] Trade accept failed', { message: err instanceof Error ? err.message : String(err) })
    res.status(500).json({ error: 'Failed to accept trade' })
  }
})

router.post('/trades/:id/decline', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return }
  const tradeId = parseInt(req.params.id)
  if (isNaN(tradeId)) { res.status(400).json({ error: 'Invalid trade id' }); return }

  try {
    const trade = await prisma.tradeOffer.findUnique({ where: { id: tradeId } })
    if (!trade) { res.status(404).json({ error: 'Trade not found' }); return }
    if (trade.receiverId !== req.userId) { res.status(403).json({ error: 'Not your trade to decline' }); return }
    if (trade.status !== 'PENDING') { res.status(400).json({ error: 'Trade is no longer pending' }); return }

    const sender = await prisma.user.findUnique({
      where: { id: trade.senderId },
      select: { allTags: true, ownedNameColors: true, ownedPfpEffects: true, tag: true, nameColor: true, pfpEffect: true },
    })
    if (!sender) { res.status(404).json({ error: 'Sender not found' }); return }

    const senderItems = parseTradeItems(trade.senderItems)
    const addUpdates = applyMultipleAdds(sender, senderItems)

    await prisma.$transaction([
      prisma.user.update({ where: { id: trade.senderId }, data: addUpdates }),
      prisma.tradeOffer.update({ where: { id: tradeId }, data: { status: 'DECLINED' } }),
      prisma.notification.create({
        data: {
          userId: trade.senderId,
          fromUserId: req.userId!,
          type: 'TRADE_DECLINED',
          preview: 'Your trade offer was declined — items returned',
        },
      }),
    ])

    res.json({ data: { ok: true } })
  } catch {
    res.status(500).json({ error: 'Failed to decline trade' })
  }
})

router.post('/trades/:id/cancel', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return }
  const tradeId = parseInt(req.params.id)
  if (isNaN(tradeId)) { res.status(400).json({ error: 'Invalid trade id' }); return }

  try {
    const trade = await prisma.tradeOffer.findUnique({ where: { id: tradeId } })
    if (!trade) { res.status(404).json({ error: 'Trade not found' }); return }
    if (trade.senderId !== req.userId) { res.status(403).json({ error: 'Not your trade to cancel' }); return }
    if (trade.status !== 'PENDING') { res.status(400).json({ error: 'Trade is no longer pending' }); return }

    const sender = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { allTags: true, ownedNameColors: true, ownedPfpEffects: true, tag: true, nameColor: true, pfpEffect: true },
    })
    if (!sender) { res.status(404).json({ error: 'User not found' }); return }

    const senderItems = parseTradeItems(trade.senderItems)
    const addUpdates = applyMultipleAdds(sender, senderItems)

    await prisma.$transaction([
      prisma.user.update({ where: { id: req.userId }, data: addUpdates }),
      prisma.tradeOffer.update({ where: { id: tradeId }, data: { status: 'CANCELLED' } }),
    ])

    res.json({ data: { ok: true } })
  } catch {
    res.status(500).json({ error: 'Failed to cancel trade' })
  }
})

router.get('/admin/stats', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000)
    const [totalUsers, activeUsers, liveUsers] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, lastSeenAt: { gte: threeDaysAgo } } }),
      prisma.user.count({ where: { deletedAt: null, lastSeenAt: { gte: tenMinAgo } } }),
    ])
    res.json({ data: { totalUsers, activeUsers, liveUsers } })
  } catch (err) {
    console.error('[ADMIN STATS]', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── Item Price History ────────────────────────────────────────────────────────

router.get('/item/:itemType/:itemId/history', async (req: Request, res: Response): Promise<void> => {
  const { itemType, itemId } = req.params
  if (!['tag', 'name-color', 'pfp'].includes(itemType)) {
    res.status(400).json({ error: 'Invalid itemType' }); return
  }
  try {
    const sales = await prisma.marketplaceListing.findMany({
      where: { itemType, itemId, status: 'SOLD' },
      select: { price: true, updatedAt: true },
      orderBy: { updatedAt: 'asc' },
      take: 100,
    })
    res.json({ data: sales.map(s => ({ price: s.price, soldAt: s.updatedAt.toISOString() })) })
  } catch {
    res.status(500).json({ error: 'Failed to fetch item history' })
  }
})

// ── Item Owners ───────────────────────────────────────────────────────────────

router.get('/item/:itemType/:itemId/owners', async (req: Request, res: Response): Promise<void> => {
  const { itemType, itemId } = req.params
  if (!['tag', 'name-color', 'pfp'].includes(itemType)) {
    res.status(400).json({ error: 'Invalid itemType' }); return
  }
  try {
    type OwnerRow = { id: number; name: string | null; tag: string; tagColor: string | null; nameColor: string | null; pfpEffect: string | null }
    let owners: OwnerRow[] = []

    // ownedNameColors / ownedPfpEffects / allTags are stored as double-encoded JSON
    // (JSON.stringify was called before writing to the Json field), so the Postgres
    // column holds a JSON *string* rather than a JSON array.  #>> '{}' extracts the
    // raw string content, then LIKE does a text scan for the target id/tag.
    const idPattern = `%"id":"${itemId}"%`
    if (itemType === 'name-color') {
      owners = await prisma.$queryRaw<OwnerRow[]>`
        SELECT DISTINCT u.id, u.name, u.tag, u."tagColor", u."nameColor", u."pfpEffect"
        FROM "User" u
        WHERE (u."ownedNameColors" #>> '{}') LIKE ${idPattern}
        AND u."deletedAt" IS NULL
        ORDER BY u.id ASC LIMIT 50`
    } else if (itemType === 'pfp') {
      owners = await prisma.$queryRaw<OwnerRow[]>`
        SELECT DISTINCT u.id, u.name, u.tag, u."tagColor", u."nameColor", u."pfpEffect"
        FROM "User" u
        WHERE (u."ownedPfpEffects" #>> '{}') LIKE ${idPattern}
        AND u."deletedAt" IS NULL
        ORDER BY u.id ASC LIMIT 50`
    } else {
      const spinDef    = TAG_BOX_ITEMS.find(t => t.id === itemId)
      const specialDef = SPECIAL_TAGS.find(t => t.tag === itemId || t.id === itemId || t.id === itemId.toLowerCase())
      // Fall back to itemId itself — works when itemId IS the tag name (DEV, VIP, GOAT, Novice …)
      const tagName = spinDef?.tag ?? specialDef?.tag ?? itemId
      const tagPattern = `%"tag":"${tagName}"%`
      owners = await prisma.$queryRaw<OwnerRow[]>`
        SELECT DISTINCT u.id, u.name, u.tag, u."tagColor", u."nameColor", u."pfpEffect"
        FROM "User" u
        WHERE (u."allTags" #>> '{}') LIKE ${tagPattern}
        AND u."deletedAt" IS NULL
        ORDER BY u.id ASC LIMIT 50`
    }

    res.json({ data: owners.map((u, i) => ({ rank: i + 1, id: u.id, name: u.name, tag: u.tag, tagColor: u.tagColor, nameColor: u.nameColor, pfpEffect: u.pfpEffect })) })
  } catch (err) {
    console.error('[ITEM OWNERS]', err)
    res.status(500).json({ error: 'Failed to fetch item owners' })
  }
})

// ── Leaderboards ──────────────────────────────────────────────────────────────

router.get('/leaderboard', requireAuth, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userSelect = { id: true, name: true, tag: true, tagColor: true, nameColor: true, pfpEffect: true }

    const [coinsRows, streakRows] = await Promise.all([
      prisma.user.findMany({
        where: { deletedAt: null },
        select: { ...userSelect, coins: true },
        orderBy: { coins: 'desc' },
        take: 15,
      }),
      prisma.user.findMany({
        where: { deletedAt: null },
        select: { ...userSelect, loginStreak: true },
        orderBy: { loginStreak: 'desc' },
        take: 15,
      }),
    ])

    // Inventory value: scan recently active users, compute value from item prices
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const [activeUsers, allPrices] = await Promise.all([
      prisma.user.findMany({
        where: { deletedAt: null, lastSeenAt: { gte: thirtyDaysAgo } },
        select: { ...userSelect, coins: true, ownedNameColors: true, ownedPfpEffects: true, allTags: true },
        take: 500,
        orderBy: { lastSeenAt: 'desc' },
      }),
      prisma.itemPrice.findMany({ where: { itemType: { not: 'meta' } } }),
    ])

    const priceMap = new Map(allPrices.map(p => [`${p.itemType}:${p.itemId}`, p.price]))
    const withValue = activeUsers.map(u => {
      let value = u.coins
      for (const item of parseJsonArr(u.ownedNameColors)) value += priceMap.get(`name-color:${(item as { id: string }).id}`) ?? 0
      for (const item of parseJsonArr(u.ownedPfpEffects)) value += priceMap.get(`pfp:${(item as { id: string }).id}`) ?? 0
      for (const t of parseTagArr(u.allTags)) {
        const def = TAG_BOX_ITEMS.find(d => d.tag === t.tag)
        if (def) value += priceMap.get(`tag:${def.id}`) ?? 0
      }
      return { id: u.id, name: u.name, tag: u.tag, tagColor: u.tagColor, nameColor: u.nameColor, pfpEffect: u.pfpEffect, inventoryValue: value }
    }).sort((a, b) => b.inventoryValue - a.inventoryValue).slice(0, 15)

    res.json({
      data: {
        coins: coinsRows.map((u, i) => ({ rank: i + 1, id: u.id, name: u.name, tag: u.tag, tagColor: u.tagColor, nameColor: u.nameColor, pfpEffect: u.pfpEffect, value: u.coins })),
        streak: streakRows.map((u, i) => ({ rank: i + 1, id: u.id, name: u.name, tag: u.tag, tagColor: u.tagColor, nameColor: u.nameColor, pfpEffect: u.pfpEffect, value: u.loginStreak })),
        inventory: withValue.map((u, i) => ({ rank: i + 1, id: u.id, name: u.name, tag: u.tag, tagColor: u.tagColor, nameColor: u.nameColor, pfpEffect: u.pfpEffect, value: u.inventoryValue })),
      },
    })
  } catch (err) {
    console.error('[LEADERBOARD]', err)
    res.status(500).json({ error: 'Failed to fetch leaderboard' })
  }
})

export default router
