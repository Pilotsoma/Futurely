'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  api, ApiError, InventoryData, BoxResult, MarketplaceItem, TagInventoryItem,
  MarketplaceListing, TradeOffer, TradeItem, UserPublicInventory, FeedUserProfile,
} from '../../../lib/api'

// ── Constants ─────────────────────────────────────────────────────────────────

const DUMMY_PFP = 'https://i.pinimg.com/474x/13/74/20/137420f5b9c39bc911e472f5d20f053e.jpg'

const RARITY_COLOR: Record<string, string> = {
  Common: '#6B7280', Uncommon: '#3B82F6', Rare: '#8B5CF6',
  Epic: '#F97316', Legendary: '#EAB308', Mythic: '#EC4899',
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
  if (effect === 'glow-gold')   return { background: 'linear-gradient(135deg, #D97706, #F59E0B)', color: '#000', border: '2px solid #D97706' }
  if (effect === 'frame-black') return { background: '#0d0d0d', color: '#4B5563', border: '2px solid #1F2937' }
  if (PFP_BORDER_MAP[effect]) return { border: `2px solid ${PFP_BORDER_MAP[effect]}` }
  if (PFP_GLOW_MAP[effect]) return { border: `2px solid ${PFP_GLOW_MAP[effect][0]}`, boxShadow: `0 0 12px ${PFP_GLOW_MAP[effect][1]}` }
  return {}
}
function pfpClass(effect: string | null | undefined): string {
  return effect === 'rainbow' ? 'pfp-rainbow' : ''
}

type DropGroup = { rarity: string; pct: string; items: string[] }

const BOX_DEFS: { type: 'tag' | 'name-color' | 'pfp'; icon: string; label: string; desc: string; cost: number; drops: DropGroup[] }[] = [
  {
    type: 'tag', icon: '📦', label: 'Tag Box', desc: 'Win exclusive profile tags', cost: 15,
    drops: [
      { rarity: 'Common',    pct: '60%',   items: ['Grinder', 'Focused', 'Scholar'] },
      { rarity: 'Uncommon',  pct: '25%',   items: ['Honors Student', 'AP Student'] },
      { rarity: 'Rare',      pct: '10%',   items: ["Dean's List", 'Top Performer'] },
      { rarity: 'Epic',      pct: '3.5%',  items: ['Ace', 'Prodigy'] },
      { rarity: 'Legendary', pct: '1%',    items: ['Mastermind', 'Genius'] },
      { rarity: 'Mythic',    pct: '0.5%',  items: ['GOAT'] },
    ],
  },
  {
    type: 'name-color', icon: '🎨', label: 'Name Color Box', desc: 'Colorize your display name', cost: 25,
    drops: [
      { rarity: 'Common',    pct: '60%',    items: ['Forest Green', 'Navy Blue', 'Dark Red', 'Slate Blue', 'Teal'] },
      { rarity: 'Uncommon',  pct: '24.99%', items: ['Bright Orange', 'Violet', 'Cyan'] },
      { rarity: 'Rare',      pct: '10%',    items: ['Hot Pink', 'Gold', 'Lime Green'] },
      { rarity: 'Epic',      pct: '4%',     items: ['Electric Blue', 'Magenta'] },
      { rarity: 'Legendary', pct: '1%',     items: ['Pure White', 'Black'] },
      { rarity: 'Mythic',    pct: '0.01%',  items: ['Rainbow RGB ✨'] },
    ],
  },
  {
    type: 'pfp', icon: '🖼️', label: 'Profile Picture Box', desc: 'Apply effects to your avatar', cost: 30,
    drops: [
      { rarity: 'Common',    pct: '60%',    items: ['Green Border', 'Blue Border', 'Red Border', 'Navy Border', 'Teal Border'] },
      { rarity: 'Uncommon',  pct: '24.99%', items: ['Orange Border', 'Violet Border', 'Cyan Border'] },
      { rarity: 'Rare',      pct: '10%',    items: ['Hot Pink Border', 'Gold Border', 'Lime Border'] },
      { rarity: 'Epic',      pct: '4%',     items: ['Pink Glow', 'Purple Glow'] },
      { rarity: 'Legendary', pct: '1%',     items: ['Gold Fill', 'Void Fill'] },
      { rarity: 'Mythic',    pct: '0.01%',  items: ['Rainbow Animated ✨'] },
    ],
  },
]

type SimItem = { id: string; label: string; rarity: string; type: 'tag' | 'name-color' | 'pfp'; tag?: string; tagColor?: string; value?: string; name?: string }
const SIM_ITEMS: Record<'tag' | 'name-color' | 'pfp', SimItem[]> = {
  tag: [
    { id: 'grinder',        label: 'Grinder (Common)',          rarity: 'Common',    type: 'tag', tag: 'Grinder',        tagColor: '#6B7280' },
    { id: 'focused',        label: 'Focused (Common)',          rarity: 'Common',    type: 'tag', tag: 'Focused',         tagColor: '#6B7280' },
    { id: 'scholar',        label: 'Scholar (Common)',          rarity: 'Common',    type: 'tag', tag: 'Scholar',         tagColor: '#6B7280' },
    { id: 'honors-student', label: 'Honors Student (Uncommon)', rarity: 'Uncommon',  type: 'tag', tag: 'Honors Student',  tagColor: '#3B82F6' },
    { id: 'ap-student',     label: 'AP Student (Uncommon)',     rarity: 'Uncommon',  type: 'tag', tag: 'AP Student',      tagColor: '#06B6D4' },
    { id: 'deans-list',     label: "Dean's List (Rare)",        rarity: 'Rare',      type: 'tag', tag: "Dean's List",     tagColor: '#8B5CF6' },
    { id: 'top-performer',  label: 'Top Performer (Rare)',      rarity: 'Rare',      type: 'tag', tag: 'Top Performer',   tagColor: '#8B5CF6' },
    { id: 'ace',            label: 'Ace (Epic)',                rarity: 'Epic',      type: 'tag', tag: 'Ace',             tagColor: '#F97316' },
    { id: 'prodigy',        label: 'Prodigy (Epic)',            rarity: 'Epic',      type: 'tag', tag: 'Prodigy',         tagColor: '#EC4899' },
    { id: 'mastermind',     label: 'Mastermind (Legendary)',    rarity: 'Legendary', type: 'tag', tag: 'Mastermind',      tagColor: '#EAB308' },
    { id: 'genius',         label: 'Genius (Legendary)',        rarity: 'Legendary', type: 'tag', tag: 'Genius',          tagColor: '#EC4899' },
    { id: 'goat',           label: 'GOAT (Mythic)',             rarity: 'Mythic',    type: 'tag', tag: 'GOAT',            tagColor: '#EAB308' },
  ],
  'name-color': [
    { id: 'forest-green',  label: 'Forest Green (Common)',    rarity: 'Common',    type: 'name-color', name: 'Forest Green',  value: '#15803D' },
    { id: 'navy-blue',     label: 'Navy Blue (Common)',       rarity: 'Common',    type: 'name-color', name: 'Navy Blue',      value: '#1D4ED8' },
    { id: 'hot-pink',      label: 'Hot Pink (Rare)',          rarity: 'Rare',      type: 'name-color', name: 'Hot Pink',       value: '#DB2777' },
    { id: 'electric-blue', label: 'Electric Blue (Epic)',     rarity: 'Epic',      type: 'name-color', name: 'Electric Blue',  value: '#2563EB' },
    { id: 'magenta',       label: 'Magenta (Epic)',           rarity: 'Epic',      type: 'name-color', name: 'Magenta',        value: '#C026D3' },
    { id: 'pure-white',    label: 'Pure White (Legendary)',   rarity: 'Legendary', type: 'name-color', name: 'Pure White',     value: '#F8FAFC' },
    { id: 'black',         label: 'Black (Legendary)',        rarity: 'Legendary', type: 'name-color', name: 'Black',          value: '#111111' },
    { id: 'rainbow',       label: 'Rainbow RGB ✨ (Mythic)',  rarity: 'Mythic',    type: 'name-color', name: 'Rainbow RGB',    value: 'rainbow' },
  ],
  pfp: [
    { id: 'border-green',   label: 'Green Border (Common)',      rarity: 'Common',    type: 'pfp', name: 'Green Border',     value: 'border-green' },
    { id: 'glow-pink',      label: 'Pink Glow (Epic)',           rarity: 'Epic',      type: 'pfp', name: 'Pink Glow',        value: 'glow-pink' },
    { id: 'glow-purple',    label: 'Purple Glow (Epic)',         rarity: 'Epic',      type: 'pfp', name: 'Purple Glow',      value: 'glow-purple' },
    { id: 'glow-gold',      label: 'Gold Fill (Legendary)',      rarity: 'Legendary', type: 'pfp', name: 'Gold Fill',        value: 'glow-gold' },
    { id: 'frame-black',    label: 'Void Fill (Legendary)',      rarity: 'Legendary', type: 'pfp', name: 'Void Fill',        value: 'frame-black' },
    { id: 'rainbow',        label: 'Rainbow Animated ✨ (Mythic)', rarity: 'Mythic',  type: 'pfp', name: 'Rainbow Animated', value: 'rainbow' },
  ],
}

const QUICKSELL_PRICES: Record<string, number> = {
  Common: 2, Uncommon: 5, Rare: 10, Epic: 20, Legendary: 75, Mythic: 500,
}

const RARITY_RANK: Record<string, number> = {
  Mythic: 0, Legendary: 1, Epic: 2, Rare: 3, Uncommon: 4, Common: 5,
}

function byRarity<T extends { rarity: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => (RARITY_RANK[a.rarity] ?? 99) - (RARITY_RANK[b.rarity] ?? 99))
}

function groupById<T extends { id: string }>(arr: T[]): Array<T & { count: number }> {
  const map = new Map<string, T & { count: number }>()
  for (const item of arr) {
    const e = map.get(item.id)
    if (e) e.count++
    else map.set(item.id, { ...item, count: 1 })
  }
  return [...map.values()]
}

type Tab = 'boxes' | 'shop' | 'trade' | 'inventory'
type TradeSubTab = 'new' | 'incoming' | 'sent'

function RarityBadge({ rarity }: { rarity: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: RARITY_COLOR[rarity] ?? '#6B7280', background: `${RARITY_COLOR[rarity] ?? '#6B7280'}18`, padding: '2px 7px', borderRadius: 99, border: `1px solid ${RARITY_COLOR[rarity] ?? '#6B7280'}44` }}>
      {rarity}
    </span>
  )
}

function ItemIcon({ item }: { item: { type: string; itemValue?: string; value?: string; itemType?: string; itemId?: string } }) {
  const type = item.type ?? item.itemType
  const value = item.itemValue ?? item.value ?? ''
  if (type === 'tag') return <span style={{ fontSize: 18 }}>🏷️</span>
  if (type === 'name-color') {
    return (
      <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-block', flexShrink: 0, border: '1px solid var(--border)', background: value === 'rainbow' ? 'linear-gradient(135deg,#ff6b6b,#ffd43b,#69db7c,#4dabf7)' : value }} />
    )
  }
  if (type === 'pfp') {
    return (
      <span className={pfpClass(value)} style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-block', flexShrink: 0, background: 'linear-gradient(135deg,#00C896,#00A3CC)', ...pfpStyle(value) }} />
    )
  }
  return <span style={{ fontSize: 18 }}>📦</span>
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [tab, setTab] = useState<Tab>('boxes')
  const [tradeSubTab, setTradeSubTab] = useState<TradeSubTab>('new')

  // Inventory & coins
  const [inv, setInv] = useState<InventoryData | null>(null)
  const [loading, setLoading] = useState(true)

  // Box opening
  const [opening, setOpening] = useState<'tag' | 'name-color' | 'pfp' | null>(null)
  const [hoveredBox, setHoveredBox] = useState<'tag' | 'name-color' | 'pfp' | null>(null)
  const [result, setResult] = useState<(BoxResult & { dismissed?: boolean }) | null>(null)
  const [equipping, setEquipping] = useState<string | null>(null)
  const [quickselling, setQuickselling] = useState<string | null>(null)

  // DEV panel
  const [isDevUser, setIsDevUser] = useState(false)
  const [devCoins, setDevCoins] = useState('500')
  const [devType, setDevType] = useState<'name-color' | 'pfp'>('name-color')
  const [devItemId, setDevItemId] = useState('')
  const [devGranting, setDevGranting] = useState(false)
  const [devMsg, setDevMsg] = useState('')
  const [simBoxType, setSimBoxType] = useState<'tag' | 'name-color' | 'pfp'>('name-color')
  const [simItemId, setSimItemId] = useState('')

  // Shop (listings)
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [listingsLoading, setListingsLoading] = useState(false)
  const [buyingId, setBuyingId] = useState<number | null>(null)
  const [buyMsg, setBuyMsg] = useState<{ id: number; msg: string } | null>(null)
  const [cooldownPopup, setCooldownPopup] = useState<{ secondsRemaining: number } | null>(null)

  // Listing an item
  const [listingItem, setListingItem] = useState<{ type: string; id: string; name: string } | null>(null)
  const [listingPrice, setListingPrice] = useState('100')
  const [listingBusy, setListingBusy] = useState(false)
  const [listingMsg, setListingMsg] = useState('')
  const [myActiveListings, setMyActiveListings] = useState<MarketplaceListing[]>([])
  const [cancellingListing, setCancellingListing] = useState<number | null>(null)

  // Trade — new
  const [tradeSearch, setTradeSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: number; name: string | null; email: string; tag: string | null; tagColor: string | null }>>([])
  const [tradeTarget, setTradeTarget] = useState<UserPublicInventory | null>(null)
  const [targetLoading, setTargetLoading] = useState(false)
  const [selectedOffer, setSelectedOffer] = useState<TradeItem[]>([])
  const [selectedRequest, setSelectedRequest] = useState<TradeItem[]>([])
  const [sendingTrade, setSendingTrade] = useState(false)
  const [tradeMsg, setTradeMsg] = useState('')

  // Profile panel
  const [profilePanel, setProfilePanel] = useState<FeedUserProfile | null>(null)
  const [profilePanelLoading, setProfilePanelLoading] = useState(false)

  // Trade — lists
  const [incomingTrades, setIncomingTrades] = useState<TradeOffer[]>([])
  const [sentTrades, setSentTrades] = useState<TradeOffer[]>([])
  const [tradesLoading, setTradesLoading] = useState(false)
  const [tradeBusy, setTradeBusy] = useState<number | null>(null)
  const [tradeActionMsg, setTradeActionMsg] = useState<{ id: number; msg: string } | null>(null)

  // ── Data fetching ─────────────────────────────────────────────────────────

  const refreshInventory = useCallback(() => {
    api.marketplaceInventory()
      .then(d => setInv(d))
      .catch(() => {})
  }, [])

  useEffect(() => {
    api.marketplaceInventory()
      .then(d => { setInv(d); setLoading(false) })
      .catch(() => setLoading(false))

    try {
      const token = localStorage.getItem('ns_token')
      if (token) {
        const uid = JSON.parse(atob(token.split('.')[1])).sub
        if (uid) {
          api.feedUserProfile(uid)
            .then(p => setIsDevUser(p.role === 'DEV' || p.role === 'ADMIN' || p.tag === 'DEV'))
            .catch(() => {})
        }
      }
    } catch { /* ignore */ }
  }, [])

  const fetchListings = useCallback(() => {
    setListingsLoading(true)
    api.marketplaceGetListings()
      .then(data => setListings(data))
      .catch(() => {})
      .finally(() => setListingsLoading(false))
  }, [])

  const fetchMyActiveListings = useCallback(() => {
    api.marketplaceGetListings()
      .then(all => {
        try {
          const token = localStorage.getItem('ns_token')
          if (token) {
            const uid = Number(JSON.parse(atob(token.split('.')[1])).sub)
            setMyActiveListings(all.filter(l => l.sellerId === uid))
          }
        } catch { setMyActiveListings([]) }
      })
      .catch(() => {})
  }, [])

  const fetchTrades = useCallback(() => {
    setTradesLoading(true)
    Promise.all([
      api.marketplaceGetIncomingTrades(),
      api.marketplaceGetSentTrades(),
    ]).then(([inc, sent]) => {
      setIncomingTrades(inc)
      setSentTrades(sent)
    }).catch(() => {})
      .finally(() => setTradesLoading(false))
  }, [])

  useEffect(() => {
    if (tab === 'shop') { fetchListings(); fetchMyActiveListings() }
    if (tab === 'trade') fetchTrades()
    if (tab === 'inventory') fetchMyActiveListings()
  }, [tab, fetchListings, fetchMyActiveListings, fetchTrades])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function openProfile(userId: number) {
    setProfilePanelLoading(true); setProfilePanel(null)
    try {
      const p = await api.feedUserProfile(userId)
      setProfilePanel(p)
    } catch { /* ignore */ }
    finally { setProfilePanelLoading(false) }
  }

  async function handleDailyClaim() {
    try {
      const r = await api.marketplaceDailyClaim()
      setInv(prev => prev ? { ...prev, coins: r.coins, canClaimToday: false } : prev)
    } catch { /* ignore */ }
  }

  async function handleOpenBox(boxType: 'tag' | 'name-color' | 'pfp') {
    const cost = BOX_DEFS.find(b => b.type === boxType)!.cost
    if (opening || !inv || inv.coins < cost) return
    setOpening(boxType); setResult(null)
    try {
      const r = await api.marketplaceOpenBox(boxType)
      setInv(prev => {
        if (!prev) return prev
        const next = { ...prev, coins: r.coins }
        if (boxType === 'name-color' && r.won.value) {
          const item: MarketplaceItem = { id: r.won.id, name: r.won.name ?? r.won.id, value: r.won.value, rarity: r.won.rarity, weight: 0 }
          next.ownedNameColors = prev.ownedNameColors.some(i => i.id === r.won.id) ? prev.ownedNameColors : [...prev.ownedNameColors, item]
        }
        if (boxType === 'pfp' && r.won.value) {
          const item: MarketplaceItem = { id: r.won.id, name: r.won.name ?? r.won.id, value: r.won.value, rarity: r.won.rarity, weight: 0 }
          next.ownedPfpEffects = prev.ownedPfpEffects.some(i => i.id === r.won.id) ? prev.ownedPfpEffects : [...prev.ownedPfpEffects, item]
        }
        if (boxType === 'tag' && r.won.tag) {
          const item: TagInventoryItem = { id: r.won.id, tag: r.won.tag, tagColor: r.won.tagColor ?? '#6B7280', rarity: r.won.rarity }
          next.ownedTags = (prev.ownedTags ?? []).some(i => i.id === r.won.id) ? (prev.ownedTags ?? []) : [...(prev.ownedTags ?? []), item]
        }
        return next
      })
      setResult(r)
    } catch { /* ignore */ }
    finally { setOpening(null) }
  }

  async function handleEquip(type: 'name-color' | 'pfp', itemId: string | null) {
    if (equipping || !inv) return
    setEquipping(type + (itemId ?? 'null'))
    try {
      await api.marketplaceEquip(type, itemId)
      setInv(prev => {
        if (!prev) return prev
        if (type === 'name-color') {
          return { ...prev, nameColor: itemId ? prev.ownedNameColors.find(i => i.id === itemId)?.value ?? null : null }
        }
        return { ...prev, pfpEffect: itemId ? prev.ownedPfpEffects.find(i => i.id === itemId)?.value ?? null : null }
      })
    } catch { /* ignore */ }
    finally { setEquipping(null) }
  }

  async function handleQuicksell(itemType: 'tag' | 'name-color' | 'pfp', itemId: string) {
    const key = `${itemType}:${itemId}`
    if (quickselling || !inv) return
    setQuickselling(key)
    try {
      const res = await api.marketplaceQuicksell(itemType, itemId)
      setInv(prev => {
        if (!prev) return prev
        if (itemType === 'tag') {
          const tags = [...(prev.ownedTags ?? [])]
          const idx = tags.findIndex(t => t.id === itemId)
          if (idx !== -1) tags.splice(idx, 1)
          return { ...prev, coins: res.coins, ownedTags: tags }
        }
        if (itemType === 'name-color') {
          const items = [...prev.ownedNameColors]
          const idx = items.findIndex(i => i.id === itemId)
          if (idx !== -1) items.splice(idx, 1)
          return { ...prev, coins: res.coins, ownedNameColors: items }
        }
        const items = [...prev.ownedPfpEffects]
        const idx = items.findIndex(i => i.id === itemId)
        if (idx !== -1) items.splice(idx, 1)
        return { ...prev, coins: res.coins, ownedPfpEffects: items }
      })
    } catch { /* ignore */ }
    finally { setQuickselling(null) }
  }

  async function handleDevGrant(grantType: 'coins' | 'name-color' | 'pfp') {
    if (devGranting) return
    setDevGranting(true); setDevMsg('')
    try {
      if (grantType === 'coins') {
        const amount = parseInt(devCoins)
        if (isNaN(amount) || amount <= 0) { setDevMsg('Enter a valid amount'); return }
        const r = await api.marketplaceAdminGrant({ type: 'coins', amount })
        setInv(prev => prev ? { ...prev, coins: r.coins ?? prev.coins } : prev)
        setDevMsg(`✓ Granted ${amount} coins`)
      } else {
        if (!devItemId.trim()) { setDevMsg('Enter an item ID'); return }
        const r = await api.marketplaceAdminGrant({ type: grantType === 'name-color' ? 'name-color' : 'pfp', itemId: devItemId.trim() })
        setDevMsg(`✓ Granted: ${r.granted?.name}`)
        refreshInventory()
      }
    } catch { setDevMsg('Grant failed') }
    finally { setDevGranting(false) }
  }

  async function handleBuyListing(listingId: number) {
    if (buyingId) return
    setBuyingId(listingId); setBuyMsg(null)
    try {
      const r = await api.marketplaceBuyListing(listingId)
      setInv(prev => prev ? { ...prev, coins: r.coins } : prev)
      setBuyMsg({ id: listingId, msg: '✓ Purchased!' })
      fetchListings()
      refreshInventory()
    } catch (e) {
      if (e instanceof ApiError && e.secondsRemaining != null) {
        setCooldownPopup({ secondsRemaining: e.secondsRemaining })
      } else {
        const msg = e instanceof Error ? e.message : 'Purchase failed'
        setBuyMsg({ id: listingId, msg })
      }
    } finally { setBuyingId(null) }
  }

  async function handleCreateListing() {
    if (!listingItem || listingBusy) return
    const price = parseInt(listingPrice)
    if (isNaN(price) || price < 10) { setListingMsg('Minimum price is 10 coins'); return }
    setListingBusy(true); setListingMsg('')
    try {
      await api.marketplaceCreateListing({ itemType: listingItem.type, itemId: listingItem.id, price })
      setListingItem(null); setListingPrice('100')
      setListingMsg('✓ Listed!')
      refreshInventory()
      fetchMyActiveListings()
    } catch (e) {
      setListingMsg(e instanceof Error ? e.message : 'Failed to list item')
    } finally { setListingBusy(false) }
  }

  async function handleCancelListing(listingId: number) {
    if (cancellingListing) return
    setCancellingListing(listingId)
    try {
      await api.marketplaceCancelListing(listingId)
      setMyActiveListings(prev => prev.filter(l => l.id !== listingId))
      refreshInventory()
    } catch { /* ignore */ }
    finally { setCancellingListing(null) }
  }

  async function handleTradeSearch(q: string) {
    setTradeSearch(q)
    if (q.length < 2) { setSearchResults([]); return }
    try {
      const results = await api.feedSearchUsers(q)
      setSearchResults(results)
    } catch { /* ignore */ }
  }

  async function handleSelectTradeTarget(userId: number) {
    setTargetLoading(true); setTradeTarget(null)
    setSelectedOffer([]); setSelectedRequest([]); setSearchResults([]); setTradeSearch('')
    try {
      const data = await api.marketplaceGetUserInventory(userId)
      setTradeTarget(data)
    } catch { /* ignore */ }
    finally { setTargetLoading(false) }
  }

  function toggleOffer(item: TradeItem) {
    setSelectedOffer(prev =>
      prev.some(i => i.id === item.id && i.type === item.type)
        ? prev.filter(i => !(i.id === item.id && i.type === item.type))
        : [...prev, item]
    )
  }

  function toggleRequest(item: TradeItem) {
    setSelectedRequest(prev =>
      prev.some(i => i.id === item.id && i.type === item.type)
        ? prev.filter(i => !(i.id === item.id && i.type === item.type))
        : [...prev, item]
    )
  }

  async function handleSendTrade() {
    if (!tradeTarget || selectedOffer.length === 0 || selectedRequest.length === 0 || sendingTrade) return
    if (!inv || inv.coins < 5) { setTradeMsg('Need 🪙 5 to send a trade'); return }
    setSendingTrade(true); setTradeMsg('')
    try {
      await api.marketplaceCreateTrade({
        receiverId: tradeTarget.user.id,
        senderItems: selectedOffer,
        receiverItems: selectedRequest,
      })
      setTradeTarget(null); setSelectedOffer([]); setSelectedRequest([])
      setTradeMsg('✓ Trade sent!')
      refreshInventory()
      fetchTrades()
      setTradeSubTab('sent')
    } catch (e) {
      setTradeMsg(e instanceof Error ? e.message : 'Failed to send trade')
    } finally { setSendingTrade(false) }
  }

  async function handleAcceptTrade(tradeId: number) {
    if (tradeBusy) return
    setTradeBusy(tradeId); setTradeActionMsg(null)
    try {
      await api.marketplaceAcceptTrade(tradeId)
      setTradeActionMsg({ id: tradeId, msg: '✓ Trade accepted!' })
      refreshInventory()
      fetchTrades()
    } catch (e) {
      setTradeActionMsg({ id: tradeId, msg: e instanceof Error ? e.message : 'Failed' })
    } finally { setTradeBusy(null) }
  }

  async function handleDeclineTrade(tradeId: number) {
    if (tradeBusy) return
    setTradeBusy(tradeId); setTradeActionMsg(null)
    try {
      await api.marketplaceDeclineTrade(tradeId)
      setTradeActionMsg({ id: tradeId, msg: '✓ Declined, items returned to sender' })
      fetchTrades()
    } catch (e) {
      setTradeActionMsg({ id: tradeId, msg: e instanceof Error ? e.message : 'Failed' })
    } finally { setTradeBusy(null) }
  }

  async function handleCancelTrade(tradeId: number) {
    if (tradeBusy) return
    setTradeBusy(tradeId); setTradeActionMsg(null)
    try {
      await api.marketplaceCancelTrade(tradeId)
      setTradeActionMsg({ id: tradeId, msg: '✓ Cancelled, items returned to you' })
      refreshInventory()
      fetchTrades()
    } catch (e) {
      setTradeActionMsg({ id: tradeId, msg: e instanceof Error ? e.message : 'Failed' })
    } finally { setTradeBusy(null) }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const myListedIds = new Set(myActiveListings.map(l => `${l.itemType}:${l.itemId}`))

  function renderInventoryItem(
    item: { id: string; name?: string; tag?: string; tagColor?: string; value?: string; rarity: string },
    type: 'tag' | 'name-color' | 'pfp',
    isEquipped: boolean,
    count = 1,
  ) {
    const itemKey = `${type}:${item.id}`
    const isListed = myListedIds.has(itemKey)
    const listing = myActiveListings.find(l => l.itemType === type && l.itemId === item.id)
    const isListingThis = listingItem?.type === type && listingItem?.id === item.id
    const sellPrice = QUICKSELL_PRICES[item.rarity] ?? 5
    const isQS = quickselling === itemKey

    return (
      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
        {type === 'name-color' && (
          <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: '1px solid var(--border)', background: item.value === 'rainbow' ? 'linear-gradient(135deg,#ff6b6b,#ffd43b,#69db7c,#4dabf7)' : item.value }} />
        )}
        {type === 'pfp' && (
          <div className={pfpClass(item.value)} style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#00C896,#00A3CC)', flexShrink: 0, ...pfpStyle(item.value) }} />
        )}
        {type === 'tag' && (
          <span style={{ fontSize: 14, fontWeight: 700, color: item.tagColor ?? '#6B7280' }}>{item.tag}</span>
        )}
        {type !== 'tag' && (
          <span className={item.value === 'rainbow' ? 'name-rainbow' : ''} style={{ flex: 1, fontSize: 13, fontWeight: 600, ...(type === 'name-color' && item.value !== 'rainbow' ? { color: item.value } : { color: 'var(--text)' }) }}>
            {item.name ?? item.tag}
          </span>
        )}
        {type === 'tag' && <span style={{ flex: 1 }} />}
        <RarityBadge rarity={item.rarity} />
        {count > 1 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 99, padding: '1px 7px' }}>x{count}</span>
        )}

        {isListed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>🪙 {listing?.price}</span>
            <button
              onClick={() => listing && void handleCancelListing(listing.id)}
              disabled={cancellingListing === listing?.id}
              style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid #EF4444', background: 'transparent', color: '#EF4444', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              Delist
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            {type !== 'tag' && (
              <button
                onClick={() => void handleEquip(type as 'name-color' | 'pfp', isEquipped ? null : item.id)}
                disabled={!!equipping}
                style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${isEquipped ? 'var(--border)' : 'var(--primary)'}`, background: isEquipped ? 'var(--surface-2)' : 'transparent', color: isEquipped ? 'var(--text-muted)' : 'var(--primary)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                {isEquipped ? 'Unequip' : 'Equip'}
              </button>
            )}
            <button
              onClick={() => {
                setListingItem({ type, id: item.id, name: item.name ?? item.tag ?? item.id })
                setListingPrice('100'); setListingMsg('')
              }}
              style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              List
            </button>
            <button
              onClick={() => void handleQuicksell(type, item.id)}
              disabled={isQS}
              style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid #EAB30855', background: 'transparent', color: '#EAB308', fontSize: 11, fontWeight: 700, cursor: isQS ? 'not-allowed' : 'pointer', opacity: isQS ? 0.6 : 1 }}
            >
              {isQS ? '…' : `Sell 🪙${sellPrice}`}
            </button>
          </div>
        )}

        {isListingThis && (
          <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number" min={10} value={listingPrice}
              onChange={e => setListingPrice(e.target.value)}
              style={{ width: 72, padding: '4px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 12 }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>fee: 🪙 {Math.floor((parseInt(listingPrice) || 0) * 0.1)}</span>
            <button onClick={() => void handleCreateListing()} disabled={listingBusy}
              style={{ padding: '4px 10px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: '#060D10', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
              {listingBusy ? '…' : 'Confirm'}
            </button>
            <button onClick={() => setListingItem(null)}
              style={{ padding: '4px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        )}
      </div>
    )
  }

  function renderTradeItems(items: TradeItem[]) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <ItemIcon item={{ type: item.type, value: item.value ?? item.tagColor }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{item.name ?? item.tag}</span>
            <RarityBadge rarity={item.rarity} />
          </div>
        ))}
        {items.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nothing</span>}
      </div>
    )
  }

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: 'var(--text-muted)', fontSize: 13 }}>Loading marketplace…</div>
  }

  const pendingIncoming = incomingTrades.filter(t => t.status === 'PENDING').length

  return (
    <div className="fade-up" style={{ maxWidth: 700, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>Spend your coins</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)' }}>Marketplace</h1>
      </div>

      {/* Coin balance */}
      <div className="ns-card" style={{ padding: 18, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 4 }}>Your Balance</p>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#EAB308', letterSpacing: '-0.5px' }}>🪙 {inv?.coins?.toLocaleString() ?? 0}</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>+30 coins every day you log in</p>
        </div>
        {inv?.canClaimToday ? (
          <button onClick={handleDailyClaim} style={{ padding: '12px 20px', borderRadius: 10, border: 'none', background: '#EAB308', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Claim Daily 🪙
          </button>
        ) : (
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ fontSize: 20 }}>✓</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>Claimed today</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {(['boxes', 'shop', 'trade', 'inventory'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none',
            background: tab === t ? 'var(--surface-2)' : 'transparent',
            color: tab === t ? 'var(--text)' : 'var(--text-muted)',
            fontWeight: tab === t ? 700 : 500, fontSize: 13, cursor: 'pointer',
            borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
            position: 'relative' as const,
          }}>
            {t === 'boxes' && '📦 Boxes'}
            {t === 'shop' && '🏪 Shop'}
            {t === 'trade' && (
              <>🔄 Trade{pendingIncoming > 0 && tab !== 'trade' && (
                <span style={{ marginLeft: 4, background: '#EF4444', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '1px 5px' }}>{pendingIncoming}</span>
              )}</>
            )}
            {t === 'inventory' && '🎒 Inventory'}
          </button>
        ))}
      </div>

      {/* ── BOXES TAB ── */}
      {tab === 'boxes' && (
        <>
          {result && !result.dismissed && (() => {
            const isRainbow  = result.won.value === 'rainbow'
            const isMythic   = result.won.rarity === 'Mythic'   && !isRainbow
            const isLegend   = result.won.rarity === 'Legendary'
            const cardClass  = `ns-card box-pop${isRainbow ? ' box-rainbow' : isMythic ? ' box-mythic' : isLegend ? ' box-legendary' : ''}`
            const emoji      = isRainbow ? '🌈' : isMythic ? '👑' : isLegend ? '🌟' : '🎉'
            const borderColor = isRainbow ? '#ff6b6b' : (RARITY_COLOR[result.won.rarity] ?? 'var(--border)')

            const itemPreview = result.won.type === 'tag' ? (
              <div style={{ fontSize: 22, fontWeight: 800, color: result.won.tagColor ?? '#6B7280', marginBottom: 4 }}>
                [{result.won.tag}]
              </div>
            ) : result.won.type === 'name-color' ? (
              <div className={isRainbow ? 'name-rainbow' : ''} style={{ fontSize: 24, fontWeight: 800, color: isRainbow ? undefined : result.won.value, marginBottom: 4 }}>
                {result.won.name}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div
                  className={pfpClass(result.won.value)}
                  style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg,#00C896,#00A3CC)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#060D10', ...pfpStyle(result.won.value) }}
                >✦</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{result.won.name}</div>
              </div>
            )

            // For pfp wins: apply border/glow to the image but strip background fills
            const effectStyle = pfpStyle(result.won.type === 'pfp' ? result.won.value : undefined)
            const dummyImgStyle: React.CSSProperties = {
              ...(effectStyle.border     ? { border:     effectStyle.border }     : {}),
              ...(effectStyle.boxShadow  ? { boxShadow:  effectStyle.boxShadow }  : {}),
            }

            const dummyComment = (
              <div style={{ background: 'var(--surface-2,#1a1a1a)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 4px', border: '1px solid var(--border)', textAlign: 'left' as const }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={DUMMY_PFP}
                  alt="DUMMY"
                  className={result.won.type === 'pfp' ? pfpClass(result.won.value) : ''}
                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' as const, flexShrink: 0, ...dummyImgStyle }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' as const }}>
                    <span
                      className={result.won.type === 'name-color' && isRainbow ? 'name-rainbow' : ''}
                      style={{ fontSize: 13, fontWeight: 700, color: result.won.type === 'name-color' && !isRainbow ? result.won.value : 'var(--text)' }}
                    >
                      DUMMY
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: result.won.type === 'tag' ? (result.won.tagColor ?? '#6B7280') : '#6B7280' }}>
                      [{result.won.type === 'tag' ? result.won.tag : 'DUMMY'}]
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Here&apos;s a preview of your new item ✨</div>
                </div>
              </div>
            )

            return (
            <div className={cardClass} style={{ padding: 24, marginBottom: 20, textAlign: 'center', border: `1px solid ${borderColor}55`, background: `${isRainbow ? '#ff6b6b' : (RARITY_COLOR[result.won.rarity] ?? '#000')}08` }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>{emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>You won!</div>
              {itemPreview}
              {dummyComment}
              <div style={{ fontSize: 13, color: RARITY_COLOR[result.won.rarity] ?? 'var(--text-muted)', fontWeight: 700, marginBottom: 16 }}>
                {result.won.rarity}{result.alreadyHad ? ' · already owned' : ''}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {result.won.type !== 'tag' && (
                  <button
                    onClick={() => void handleEquip(result.won.type === 'name-color' ? 'name-color' : 'pfp', result.won.id)}
                    style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#060D10', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  >
                    Equip Now
                  </button>
                )}
                <button
                  onClick={() => setResult(r => r ? { ...r, dismissed: true } : r)}
                  style={{ padding: '10px 20px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  Nice!
                </button>
              </div>
            </div>
            )
          })()}

          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 12 }}>Open a Box — spend coins to unlock rewards</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {BOX_DEFS.map(box => {
              const isHovered = hoveredBox === box.type
              return (
                <div key={box.type} className="ns-card"
                  onMouseEnter={() => setHoveredBox(box.type)}
                  onMouseLeave={() => setHoveredBox(null)}
                  style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
                  <div style={{ fontSize: 38 }}>{box.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{box.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{box.desc}</div>
                  <button onClick={() => void handleOpenBox(box.type)}
                    disabled={!inv || inv.coins < box.cost || !!opening}
                    style={{ width: '100%', padding: '10px 0', borderRadius: 9, border: 'none', background: opening === box.type ? 'var(--surface-2)' : 'var(--primary)', color: opening === box.type ? 'var(--text-muted)' : '#060D10', fontWeight: 700, fontSize: 13, marginTop: 4, cursor: inv && inv.coins >= box.cost && !opening ? 'pointer' : 'not-allowed', opacity: !inv || inv.coins < box.cost ? 0.45 : 1 }}>
                    {opening === box.type ? 'Opening…' : `🎁 Open — 🪙 ${box.cost}`}
                  </button>
                  {isHovered && (
                    <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 5, textAlign: 'left' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-muted)', marginBottom: 2 }}>Drop Rates</div>
                      {box.drops.map(group => (
                        <div key={group.rarity} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: RARITY_COLOR[group.rarity], minWidth: 36, paddingTop: 1 }}>{group.pct}</span>
                          <div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: RARITY_COLOR[group.rarity] }}>{group.rarity} </span>
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{group.items.join(' · ')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── SHOP TAB ── */}
      {tab === 'shop' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>
              Player Listings — sorted by value
            </p>
            <button onClick={fetchListings} disabled={listingsLoading}
              style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
              {listingsLoading ? 'Refreshing…' : '↻ Refresh'}
            </button>
          </div>

          {listingsLoading && listings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading listings…</div>
          ) : listings.length === 0 ? (
            <div className="ns-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No active listings yet — go to Inventory to list your items
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {listings.map(listing => {
                const isOwn = listing.sellerId === (inv ? -1 : -1) // resolved via myActiveListings
                const isMine = myActiveListings.some(l => l.id === listing.id)
                const msg = buyMsg?.id === listing.id ? buyMsg.msg : null
                return (
                  <div key={listing.id} className="ns-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: `3px solid ${RARITY_COLOR[listing.itemRarity] ?? '#6B7280'}` }}>
                    <ItemIcon item={{ type: listing.itemType, itemValue: listing.itemValue, itemType: listing.itemType, itemId: listing.itemId }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{listing.itemName}</span>
                        <RarityBadge rarity={listing.itemRarity} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' as const }}>{listing.itemType.replace('-', ' ')}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        by{' '}
                        <button
                          onClick={() => void openProfile(listing.seller.id)}
                          className={listing.seller.nameColor === 'rainbow' ? 'name-rainbow' : ''}
                          style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, ...(listing.seller.nameColor && listing.seller.nameColor !== 'rainbow' ? { color: listing.seller.nameColor } : { color: 'var(--text)' }) }}
                        >
                          {listing.seller.name ?? 'Unknown'}
                        </button>
                        {listing.seller.tag && (
                          <span className={listing.seller.tag === 'DEV' ? 'tag-rainbow' : ''} style={{ marginLeft: 6, fontWeight: 700, color: listing.seller.tag === 'DEV' ? undefined : listing.seller.tagColor ?? '#6B7280' }}>[{listing.seller.tag}]</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#EAB308', marginBottom: 4 }}>🪙 {listing.price.toLocaleString()}</div>
                      {msg ? (
                        <div style={{ fontSize: 11, color: msg.startsWith('✓') ? '#22C55E' : '#EF4444', fontWeight: 600 }}>{msg}</div>
                      ) : isMine ? (
                        <button onClick={() => void handleCancelListing(listing.id)} disabled={cancellingListing === listing.id}
                          style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #EF4444', background: 'transparent', color: '#EF4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          {cancellingListing === listing.id ? '…' : 'Delist'}
                        </button>
                      ) : (
                        <button
                          onClick={() => void handleBuyListing(listing.id)}
                          disabled={!!buyingId || !inv || inv.coins < listing.price}
                          style={{ padding: '5px 14px', borderRadius: 8, border: 'none', background: !inv || inv.coins < listing.price ? 'var(--surface-2)' : 'var(--primary)', color: !inv || inv.coins < listing.price ? 'var(--text-muted)' : '#060D10', fontWeight: 700, fontSize: 12, cursor: !inv || inv.coins < listing.price ? 'not-allowed' : 'pointer', opacity: !inv || inv.coins < listing.price ? 0.5 : 1 }}>
                          {buyingId === listing.id ? 'Buying…' : 'Buy'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── TRADE TAB ── */}
      {tab === 'trade' && (
        <>
          {/* Trade sub-tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {(['new', 'incoming', 'sent'] as TradeSubTab[]).map(st => (
              <button key={st} onClick={() => { setTradeSubTab(st); if (st !== 'new') fetchTrades() }}
                style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${tradeSubTab === st ? 'var(--primary)' : 'var(--border)'}`, background: tradeSubTab === st ? 'var(--primary)18' : 'transparent', color: tradeSubTab === st ? 'var(--primary)' : 'var(--text-muted)', fontWeight: tradeSubTab === st ? 700 : 500, fontSize: 13, cursor: 'pointer' }}>
                {st === 'new' && '+ New Trade'}
                {st === 'incoming' && `📥 Incoming${pendingIncoming > 0 ? ` (${pendingIncoming})` : ''}`}
                {st === 'sent' && '📤 Sent'}
              </button>
            ))}
          </div>

          {/* New Trade */}
          {tradeSubTab === 'new' && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Sending a trade costs <strong style={{ color: '#EAB308' }}>🪙 5</strong>. Your offered items are locked until the trade is resolved.
              </div>

              {!tradeTarget ? (
                <>
                  <div style={{ position: 'relative' as const, marginBottom: 12 }}>
                    <input
                      value={tradeSearch}
                      onChange={e => void handleTradeSearch(e.target.value)}
                      placeholder="Search for a user to trade with…"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' as const }}
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="ns-card" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {searchResults.map(u => (
                        <button key={u.id} onClick={() => void handleSelectTradeTarget(u.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text)', cursor: 'pointer', textAlign: 'left' as const }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#00C896,#00A3CC)', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name ?? u.email}</div>
                            {u.tag && <div style={{ fontSize: 11, color: u.tagColor ?? '#6B7280', fontWeight: 700 }}>[{u.tag}]</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {targetLoading && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Loading inventory…</div>}
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#00C896,#00A3CC)' }} />
                    <div style={{ flex: 1 }}>
                      <div className={tradeTarget.user.nameColor === 'rainbow' ? 'name-rainbow' : ''} style={{ fontSize: 13, fontWeight: 700, ...(tradeTarget.user.nameColor && tradeTarget.user.nameColor !== 'rainbow' ? { color: tradeTarget.user.nameColor } : {}) }}>{tradeTarget.user.name ?? 'User'}</div>
                      {tradeTarget.user.tag && <div className={tradeTarget.user.tag === 'DEV' ? 'tag-rainbow' : ''} style={{ fontSize: 11, color: tradeTarget.user.tag === 'DEV' ? undefined : tradeTarget.user.tagColor ?? '#6B7280', fontWeight: 700 }}>[{tradeTarget.user.tag}]</div>}
                    </div>
                    <button onClick={() => { setTradeTarget(null); setSelectedOffer([]); setSelectedRequest([]) }}
                      style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                      Change
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    {/* Their inventory — what you want */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-muted)', marginBottom: 10 }}>
                        Their Items — tap to request
                      </div>
                      {tradeTarget.tags.length === 0 && tradeTarget.nameColors.length === 0 && tradeTarget.pfpEffects.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 12 }}>No tradeable items</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {tradeTarget.tags.map(t => {
                            const item: TradeItem = { type: 'tag', id: t.id, tag: t.tag, tagColor: t.tagColor, rarity: t.rarity }
                            const sel = selectedRequest.some(i => i.id === t.id && i.type === 'tag')
                            return (
                              <div key={t.id} onClick={() => toggleRequest(item)}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1px solid ${sel ? 'var(--primary)' : 'var(--border)'}`, background: sel ? 'var(--primary)12' : 'var(--surface-2)', cursor: 'pointer' }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: t.tagColor }}>{t.tag}</span>
                                <RarityBadge rarity={t.rarity} />
                                {sel && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
                              </div>
                            )
                          })}
                          {tradeTarget.nameColors.map(c => {
                            const item: TradeItem = { type: 'name-color', id: c.id, name: c.name, value: c.value, rarity: c.rarity }
                            const sel = selectedRequest.some(i => i.id === c.id && i.type === 'name-color')
                            return (
                              <div key={c.id} onClick={() => toggleRequest(item)}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1px solid ${sel ? 'var(--primary)' : 'var(--border)'}`, background: sel ? 'var(--primary)12' : 'var(--surface-2)', cursor: 'pointer' }}>
                                <span style={{ width: 16, height: 16, borderRadius: '50%', display: 'inline-block', background: c.value === 'rainbow' ? 'linear-gradient(135deg,#ff6b6b,#ffd43b,#69db7c,#4dabf7)' : c.value, border: '1px solid var(--border)', flexShrink: 0 }} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{c.name}</span>
                                <RarityBadge rarity={c.rarity} />
                                {sel && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
                              </div>
                            )
                          })}
                          {tradeTarget.pfpEffects.map(p => {
                            const item: TradeItem = { type: 'pfp', id: p.id, name: p.name, value: p.value, rarity: p.rarity }
                            const sel = selectedRequest.some(i => i.id === p.id && i.type === 'pfp')
                            return (
                              <div key={p.id} onClick={() => toggleRequest(item)}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1px solid ${sel ? 'var(--primary)' : 'var(--border)'}`, background: sel ? 'var(--primary)12' : 'var(--surface-2)', cursor: 'pointer' }}>
                                <div className={pfpClass(p.value)} style={{ width: 16, height: 16, borderRadius: '50%', background: 'linear-gradient(135deg,#00C896,#00A3CC)', flexShrink: 0, ...pfpStyle(p.value) }} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                                <RarityBadge rarity={p.rarity} />
                                {sel && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Your inventory — what you offer */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-muted)', marginBottom: 10 }}>
                        Your Items — tap to offer
                      </div>
                      {(!inv || ((inv.ownedTags ?? []).length === 0 && inv.ownedNameColors.length === 0 && inv.ownedPfpEffects.length === 0)) ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 12 }}>No items to offer</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {(inv?.ownedTags ?? []).filter(t => !myListedIds.has(`tag:${t.id}`)).map(t => {
                            const item: TradeItem = { type: 'tag', id: t.id, tag: t.tag, tagColor: t.tagColor, rarity: t.rarity }
                            const sel = selectedOffer.some(i => i.id === t.id && i.type === 'tag')
                            return (
                              <div key={t.id} onClick={() => toggleOffer(item)}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1px solid ${sel ? '#22C55E' : 'var(--border)'}`, background: sel ? '#22C55E12' : 'var(--surface-2)', cursor: 'pointer' }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: t.tagColor }}>{t.tag}</span>
                                <RarityBadge rarity={t.rarity} />
                                {sel && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
                              </div>
                            )
                          })}
                          {(inv?.ownedNameColors ?? []).filter(c => !myListedIds.has(`name-color:${c.id}`)).map(c => {
                            const item: TradeItem = { type: 'name-color', id: c.id, name: c.name, value: c.value, rarity: c.rarity }
                            const sel = selectedOffer.some(i => i.id === c.id && i.type === 'name-color')
                            return (
                              <div key={c.id} onClick={() => toggleOffer(item)}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1px solid ${sel ? '#22C55E' : 'var(--border)'}`, background: sel ? '#22C55E12' : 'var(--surface-2)', cursor: 'pointer' }}>
                                <span style={{ width: 16, height: 16, borderRadius: '50%', display: 'inline-block', background: c.value === 'rainbow' ? 'linear-gradient(135deg,#ff6b6b,#ffd43b,#69db7c,#4dabf7)' : c.value, border: '1px solid var(--border)', flexShrink: 0 }} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{c.name}</span>
                                <RarityBadge rarity={c.rarity} />
                                {sel && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
                              </div>
                            )
                          })}
                          {(inv?.ownedPfpEffects ?? []).filter(p => !myListedIds.has(`pfp:${p.id}`)).map(p => {
                            const item: TradeItem = { type: 'pfp', id: p.id, name: p.name, value: p.value, rarity: p.rarity }
                            const sel = selectedOffer.some(i => i.id === p.id && i.type === 'pfp')
                            return (
                              <div key={p.id} onClick={() => toggleOffer(item)}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1px solid ${sel ? '#22C55E' : 'var(--border)'}`, background: sel ? '#22C55E12' : 'var(--surface-2)', cursor: 'pointer' }}>
                                <div className={pfpClass(p.value)} style={{ width: 16, height: 16, borderRadius: '50%', background: 'linear-gradient(135deg,#00C896,#00A3CC)', flexShrink: 0, ...pfpStyle(p.value) }} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                                <RarityBadge rarity={p.rarity} />
                                {sel && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Trade summary + send */}
                  <div className="ns-card" style={{ padding: 16, marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Trade Summary</div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' as const }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>You offer</div>
                        {renderTradeItems(selectedOffer)}
                      </div>
                      <div style={{ alignSelf: 'center', fontSize: 18 }}>⇄</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>You receive</div>
                        {renderTradeItems(selectedRequest)}
                      </div>
                    </div>
                  </div>
                  {tradeMsg && <div style={{ fontSize: 12, color: tradeMsg.startsWith('✓') ? '#22C55E' : '#EF4444', fontWeight: 600, marginBottom: 10 }}>{tradeMsg}</div>}
                  <button onClick={() => void handleSendTrade()}
                    disabled={sendingTrade || selectedOffer.length === 0 || selectedRequest.length === 0 || !inv || inv.coins < 5}
                    style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#060D10', fontWeight: 700, fontSize: 14, cursor: selectedOffer.length > 0 && selectedRequest.length > 0 ? 'pointer' : 'not-allowed', opacity: selectedOffer.length === 0 || selectedRequest.length === 0 ? 0.4 : 1 }}>
                    {sendingTrade ? 'Sending…' : 'Send Trade — 🪙 5'}
                  </button>
                </>
              )}
            </>
          )}

          {/* Incoming Trades */}
          {tradeSubTab === 'incoming' && (
            <>
              {tradesLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
              ) : incomingTrades.length === 0 ? (
                <div className="ns-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No incoming trades</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {incomingTrades.map(trade => {
                    const msg = tradeActionMsg?.id === trade.id ? tradeActionMsg.msg : null
                    return (
                      <div key={trade.id} className="ns-card" style={{ padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#00C896,#00A3CC)' }} />
                          <div>
                            <span className={trade.sender.nameColor === 'rainbow' ? 'name-rainbow' : ''} style={{ fontSize: 13, fontWeight: 700, ...(trade.sender.nameColor && trade.sender.nameColor !== 'rainbow' ? { color: trade.sender.nameColor } : {}) }}>{trade.sender.name ?? 'User'}</span>
                            {trade.sender.tag && <span className={trade.sender.tag === 'DEV' ? 'tag-rainbow' : ''} style={{ fontSize: 11, color: trade.sender.tag === 'DEV' ? undefined : trade.sender.tagColor ?? '#6B7280', fontWeight: 700, marginLeft: 6 }}>[{trade.sender.tag}]</span>}
                          </div>
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{new Date(trade.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>They offer</div>
                            {renderTradeItems(parseTradeItemsClient(trade.senderItems))}
                          </div>
                          <div style={{ fontSize: 16 }}>⇄</div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>They want</div>
                            {renderTradeItems(parseTradeItemsClient(trade.receiverItems))}
                          </div>
                        </div>
                        {msg ? (
                          <div style={{ fontSize: 12, color: msg.startsWith('✓') ? '#22C55E' : '#EF4444', fontWeight: 600, marginBottom: 8 }}>{msg}</div>
                        ) : (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => void handleAcceptTrade(trade.id)} disabled={tradeBusy === trade.id}
                              style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                              {tradeBusy === trade.id ? '…' : '✓ Accept'}
                            </button>
                            <button onClick={() => void handleDeclineTrade(trade.id)} disabled={tradeBusy === trade.id}
                              style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #EF4444', background: 'transparent', color: '#EF4444', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                              ✕ Decline
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Sent Trades */}
          {tradeSubTab === 'sent' && (
            <>
              {tradesLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
              ) : sentTrades.length === 0 ? (
                <div className="ns-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No sent trades yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {sentTrades.map(trade => {
                    const msg = tradeActionMsg?.id === trade.id ? tradeActionMsg.msg : null
                    const statusColor: Record<string, string> = { PENDING: '#EAB308', ACCEPTED: '#22C55E', DECLINED: '#EF4444', CANCELLED: '#6B7280' }
                    return (
                      <div key={trade.id} className="ns-card" style={{ padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#00C896,#00A3CC)' }} />
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>To: </span><span className={trade.receiver.nameColor === 'rainbow' ? 'name-rainbow' : ''} style={{ fontSize: 13, fontWeight: 700, ...(trade.receiver.nameColor && trade.receiver.nameColor !== 'rainbow' ? { color: trade.receiver.nameColor } : {}) }}>{trade.receiver.name ?? 'User'}</span>
                            {trade.receiver.tag && <span className={trade.receiver.tag === 'DEV' ? 'tag-rainbow' : ''} style={{ fontSize: 11, color: trade.receiver.tag === 'DEV' ? undefined : trade.receiver.tagColor ?? '#6B7280', fontWeight: 700, marginLeft: 6 }}>[{trade.receiver.tag}]</span>}
                          </div>
                          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: statusColor[trade.status] ?? '#6B7280', background: `${statusColor[trade.status] ?? '#6B7280'}18`, padding: '2px 8px', borderRadius: 99 }}>
                            {trade.status}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>You offered</div>
                            {renderTradeItems(parseTradeItemsClient(trade.senderItems))}
                          </div>
                          <div style={{ fontSize: 16 }}>⇄</div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>You wanted</div>
                            {renderTradeItems(parseTradeItemsClient(trade.receiverItems))}
                          </div>
                        </div>
                        {msg ? (
                          <div style={{ fontSize: 12, color: msg.startsWith('✓') ? '#22C55E' : '#EF4444', fontWeight: 600 }}>{msg}</div>
                        ) : trade.status === 'PENDING' && (
                          <button onClick={() => void handleCancelTrade(trade.id)} disabled={tradeBusy === trade.id}
                            style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                            {tradeBusy === trade.id ? '…' : 'Cancel Trade'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── INVENTORY TAB ── */}
      {tab === 'inventory' && (
        <>
          {listingMsg && (
            <div style={{ fontSize: 12, color: listingMsg.startsWith('✓') ? '#22C55E' : '#EF4444', fontWeight: 600, marginBottom: 12 }}>{listingMsg}</div>
          )}

          {(inv?.ownedTags ?? []).length === 0 && (inv?.ownedNameColors ?? []).length === 0 && (inv?.ownedPfpEffects ?? []).length === 0 ? (
            <div className="ns-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Your inventory is empty — open boxes to get items
            </div>
          ) : (
            <>
              {(inv?.ownedTags ?? []).length > 0 && (
                <div className="ns-card" style={{ padding: 18, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>🏷️ Tags</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Equip tags from Settings → Profile</div>
                  {groupById(byRarity(inv?.ownedTags ?? [])).map(t =>
                    renderInventoryItem({ id: t.id, tag: t.tag, tagColor: t.tagColor, rarity: t.rarity }, 'tag', false, t.count)
                  )}
                </div>
              )}

              {(inv?.ownedNameColors ?? []).length > 0 && (
                <div className="ns-card" style={{ padding: 18, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>🎨 Name Colors</div>
                  {groupById(byRarity(inv!.ownedNameColors)).map(item =>
                    renderInventoryItem({ id: item.id, name: item.name, value: item.value, rarity: item.rarity }, 'name-color', inv!.nameColor === item.value, item.count)
                  )}
                </div>
              )}

              {(inv?.ownedPfpEffects ?? []).length > 0 && (
                <div className="ns-card" style={{ padding: 18, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>🖼️ Profile Picture Effects</div>
                  {groupById(byRarity(inv!.ownedPfpEffects)).map(item =>
                    renderInventoryItem({ id: item.id, name: item.name, value: item.value, rarity: item.rarity }, 'pfp', inv!.pfpEffect === item.value, item.count)
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Profile Panel ── */}
      {(profilePanel || profilePanelLoading) && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setProfilePanel(null)}
        >
          <div
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '90%', maxWidth: 420, padding: 24, position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setProfilePanel(null)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            {profilePanelLoading && !profilePanel ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>Loading profile…</div>
            ) : profilePanel && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <div
                    className={pfpClass(profilePanel.pfpEffect)}
                    style={{ width: 54, height: 54, borderRadius: '50%', background: 'linear-gradient(135deg,#00C896,#00A3CC)', color: '#060D10', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, flexShrink: 0, ...pfpStyle(profilePanel.pfpEffect), ...(profilePanel.avatarUrl ? { background: 'none', padding: 0, overflow: 'hidden' } : {}) }}
                  >
                    {profilePanel.avatarUrl
                      ? <img src={profilePanel.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : (profilePanel.name ?? profilePanel.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className={profilePanel.nameColor === 'rainbow' ? 'name-rainbow' : ''} style={{ fontSize: 19, fontWeight: 800, marginBottom: 3, ...(profilePanel.nameColor && profilePanel.nameColor !== 'rainbow' ? { color: profilePanel.nameColor } : { color: 'var(--text)' }) }}>
                      {profilePanel.name ?? profilePanel.email}
                    </div>
                    {profilePanel.tag && (
                      <span
                        className={profilePanel.tag === 'DEV' ? 'tag-rainbow' : ''}
                        style={profilePanel.tag === 'DEV' ? { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, border: '1px solid #ff6b6b', color: '#ff6b6b', background: 'rgba(255,107,107,0.12)' } : { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, color: profilePanel.tagColor ?? 'var(--primary)', background: profilePanel.tagColor ? `${profilePanel.tagColor}22` : 'rgba(0,200,150,0.1)', border: `1px solid ${profilePanel.tagColor ?? 'var(--primary)'}` }}
                      >
                        {profilePanel.tag}
                      </span>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{profilePanel.email}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 20, padding: '14px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
                  {[
                    { label: 'Followers', value: profilePanel._count.followers },
                    { label: 'Following', value: profilePanel._count.following },
                    { label: 'Posts', value: profilePanel._count.posts },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── DEV Panel ── */}
      {isDevUser && (
        <div className="ns-card" style={{ marginTop: 28, padding: 20, border: '1px solid rgba(255,107,107,0.4)', background: 'rgba(255,107,107,0.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ff6b6b', marginBottom: 16 }}>🔧 DEV Panel — Grant to Self</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={devCoins} onChange={e => setDevCoins(e.target.value)} placeholder="500"
                style={{ width: 100, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }} />
              <button onClick={() => void handleDevGrant('coins')} disabled={devGranting}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#EAB308', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Grant Coins
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
              <select value={devType} onChange={e => setDevType(e.target.value as 'name-color' | 'pfp')}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}>
                <option value="name-color">Name Color</option>
                <option value="pfp">PFP Effect</option>
              </select>
              <input value={devItemId} onChange={e => setDevItemId(e.target.value)} placeholder="item-id  (e.g. rainbow)"
                style={{ flex: 1, minWidth: 140, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }} />
              <button onClick={() => void handleDevGrant(devType)} disabled={devGranting}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#ff6b6b', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Grant Item
              </button>
            </div>
            {devMsg && <div style={{ fontSize: 12, color: devMsg.startsWith('✓') ? '#22C55E' : '#EF4444', fontWeight: 600 }}>{devMsg}</div>}

            {/* Simulate unlock */}
            <div style={{ borderTop: '1px solid rgba(255,107,107,0.2)', paddingTop: 14, marginTop: 2 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#ff6b6b', marginBottom: 10 }}>🎰 Simulate Unlock</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
                <select value={simBoxType} onChange={e => { setSimBoxType(e.target.value as 'tag' | 'name-color' | 'pfp'); setSimItemId('') }}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}>
                  <option value="tag">Tag Box</option>
                  <option value="name-color">Name Color Box</option>
                  <option value="pfp">PFP Box</option>
                </select>
                <select value={simItemId} onChange={e => setSimItemId(e.target.value)}
                  style={{ flex: 1, minWidth: 160, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}>
                  <option value="">Pick an item…</option>
                  {SIM_ITEMS[simBoxType].map(i => (
                    <option key={i.id} value={i.id}>{i.label}</option>
                  ))}
                </select>
                <button
                  disabled={!simItemId}
                  onClick={() => {
                    const item = SIM_ITEMS[simBoxType].find(i => i.id === simItemId)
                    if (!item) return
                    setResult({
                      coins: inv?.coins ?? 0,
                      won: { id: item.id, name: item.name, tag: item.tag, tagColor: item.tagColor, value: item.value, rarity: item.rarity, type: item.type },
                      alreadyHad: false,
                    })
                    setTab('boxes')
                  }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#8B5CF6', color: '#fff', fontWeight: 700, fontSize: 13, cursor: simItemId ? 'pointer' : 'not-allowed', opacity: simItemId ? 1 : 0.5 }}>
                  Simulate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cooldown purchase modal */}
      {cooldownPopup && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setCooldownPopup(null)}
        >
          <div
            style={{ background: 'var(--surface)', border: '1px solid rgba(234,179,8,0.4)', borderRadius: 16, padding: 28, width: '90%', maxWidth: 360, textAlign: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#EAB308', marginBottom: 8 }}>Too Soon to Buy</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              This item was just listed. You can buy it in{' '}
              <strong style={{ color: 'var(--text)' }}>
                {Math.floor(cooldownPopup.secondsRemaining / 60)}m {cooldownPopup.secondsRemaining % 60}s
              </strong>.
            </div>
            <button
              style={{ width: '100%', padding: '10px 0', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#060D10', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              onClick={() => setCooldownPopup(null)}
            >
              Got it
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function parseTradeItemsClient(raw: unknown): TradeItem[] {
  if (Array.isArray(raw)) return raw as TradeItem[]
  try { return JSON.parse(String(raw ?? '[]')) } catch { return [] }
}
