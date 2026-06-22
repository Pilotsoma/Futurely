'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import CoinIcon from '../../../components/ui/CoinIcon'
import {
  api, ApiError, InventoryData, BoxResult, MarketplaceItem, TagInventoryItem,
  MarketplaceListing, TradeOffer, TradeItem, UserPublicInventory, FeedUserProfile,
  getApiToken, ItemSalePoint, ItemOwner, LeaderboardData, LeaderboardEntry,
} from '../../../lib/api'

const VERIFIED_BADGE_URL = 'https://static.vecteezy.com/system/resources/thumbnails/047/309/918/small/verified-badge-profile-icon-png.png'
function VerifiedBadge({ variant, size = 18 }: { variant: 'yellow' | 'blue'; size?: number }) {
  return (
    <img
      src={VERIFIED_BADGE_URL}
      alt="Verified"
      style={{ width: size, height: size, verticalAlign: 'middle', flexShrink: 0, display: 'inline-block',
        filter: variant === 'yellow' ? 'hue-rotate(195deg) saturate(2) brightness(1.3)' : undefined }}
    />
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DUMMY_PFP = 'https://i.pinimg.com/474x/13/74/20/137420f5b9c39bc911e472f5d20f053e.jpg'

const RARITY_COLOR: Record<string, string> = {
  Common: '#22C55E', Uncommon: '#3B82F6', Rare: '#F97316',
  Epic: '#8B5CF6', Legendary: '#EAB308', Mythic: 'rainbow', Unobtainable: '#7C3AED', Curse: '#ff0000',
}
// Per-item display color overrides — take precedence over rarity color everywhere
const ITEM_COLOR_OVERRIDE: Record<string, string> = {}
function truncateWords(str: string, max = 4): string {
  const words = str.trim().split(/\s+/)
  return words.length <= max ? str : words.slice(0, max).join(' ') + '…'
}

// Character-based truncation for the small icon boxes in inventory/catalog
function truncateTag(str: string, max = 4): string {
  return str.length <= max ? str : str.slice(0, max)
}

function getRarityColor(rarity: string, itemId?: string | null): string {
  if (itemId && ITEM_COLOR_OVERRIDE[itemId]) return ITEM_COLOR_OVERRIDE[itemId]
  const c = RARITY_COLOR[rarity]
  if (c === 'rainbow') return '#FFD700'
  return c ?? '#22C55E'
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
  if (effect === 'glow-gold')           return {}
  if (effect === 'frame-black')         return {}
  if (effect === 'fill-white')          return {}
  if (effect === 'unobtainable-curse')  return {}
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

type DropGroup = { rarity: string; pct: string; items: string[] }
type BoxType = 'cosmetics' | 'dev-curse'

// ── Box card cycling previews ──────────────────────────────────────────────────

type PreviewItemDef = { type: 'tag' | 'name-color' | 'pfp'; tag?: string; tagColor?: string; name?: string; value?: string; rarity: string }

const BOX_CYCLE_PREVIEWS: Record<string, PreviewItemDef[]> = {
  'cosmetics': [
    { type: 'tag',        tag: 'Valedictorian', tagColor: '#F8FAFC',  rarity: 'Legendary' },
    { type: 'name-color', name: 'Magenta',      value: '#C026D3',     rarity: 'Epic'      },
    { type: 'pfp',        name: 'Gold Fill',    value: 'glow-gold',   rarity: 'Legendary' },
    { type: 'tag',        tag: 'VIP',           tagColor: '#111111',  rarity: 'Mythic'    },
    { type: 'name-color', name: 'Rainbow RGB',  value: 'rainbow',     rarity: 'Mythic'    },
    { type: 'pfp',        name: 'Pink Glow',    value: 'glow-pink',   rarity: 'Epic'      },
    { type: 'tag',        tag: 'Ace',           tagColor: '#F97316',  rarity: 'Epic'      },
    { type: 'pfp',        name: 'Rainbow',      value: 'rainbow',     rarity: 'Mythic'    },
  ],
}

function BoxCardPreview({ boxType }: { boxType: BoxType }) {
  const [idx, setIdx] = useState(0)
  const items = BOX_CYCLE_PREVIEWS[boxType]

  useEffect(() => {
    if (!items) return
    const t = setInterval(() => setIdx(i => (i + 1) % items.length), 3500)
    return () => clearInterval(t)
  }, [items])

  if (!items) return <div style={{ fontSize: 38 }}>💀</div>

  const item = items[idx]
  const rarityColor = RARITY_COLOR[item.rarity] === 'rainbow' ? '#FFD700' : (RARITY_COLOR[item.rarity] ?? '#22C55E')

  return (
    <div style={{ width: 60, height: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <div key={`${boxType}-${idx}`} style={{ animation: 'boxPreviewFadeIn 0.4s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {item.type === 'tag' && (
          item.tagColor === 'verified-yellow' || item.tagColor === 'verified-blue'
            ? <VerifiedBadge variant={item.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} size={26} />
            : <span
                className={item.tag === 'VIP' ? 'tag-mythic' : item.tag === 'GOAT' ? 'tag-god' : item.tag === 'DEV' ? 'tag-rainbow' : item.tagColor === 'curse' ? 'tag-curse' : ''}
                style={(item.tag === 'VIP' || item.tag === 'GOAT' || item.tag === 'DEV') ? { fontSize: 15, fontWeight: 900, padding: '5px 10px', borderRadius: 8 } : item.tagColor === 'curse' ? { fontSize: 14, fontWeight: 800, padding: '5px 10px', borderRadius: 8 } : {
                  fontSize: 14, fontWeight: 800,
                  color: item.tagColor,
                  textShadow: item.rarity === 'Legendary' ? `0 0 10px ${rarityColor}88` : undefined,
                  padding: '5px 10px', borderRadius: 8,
                  background: `${rarityColor}1A`,
                  border: `1.5px solid ${rarityColor}55`,
                }}
              >
                {item.tag}
              </span>
        )}
        {item.type === 'name-color' && (
          <span
            className={item.value === 'rainbow' ? 'name-rainbow' : item.value === 'curse' ? 'name-curse' : ''}
            style={{
              fontSize: 16, fontWeight: 800, letterSpacing: '0.3px',
              color: (item.value !== 'rainbow' && item.value !== 'curse') ? item.value : undefined,
              textShadow: item.rarity === 'Legendary' ? `0 0 10px ${item.value}88` : undefined,
            }}
          >
            Username
          </span>
        )}
        {item.type === 'pfp' && (
          <div
            className={pfpClass(item.value)}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 15, flexShrink: 0,
              ...pfpStyle(item.value),
            }}
          >
            A
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {items.map((it, i) => {
          const rc = RARITY_COLOR[it.rarity] === 'rainbow' ? '#FFD700' : (RARITY_COLOR[it.rarity] ?? '#22C55E')
          return (
            <div key={i} style={{
              width: i === idx ? 6 : 4, height: i === idx ? 6 : 4, borderRadius: '50%',
              background: i === idx ? rc : `${rc}55`,
              transition: 'all 0.3s ease',
            }} />
          )
        })}
      </div>
    </div>
  )
}

const BOX_DEFS: { type: BoxType; icon: string; label: string; desc: string; cost: number; drops: DropGroup[] }[] = [
  {
    type: 'cosmetics', icon: '🎁', label: 'Cosmetics Spin', desc: 'Any cosmetic — tags, name colors & PFP effects', cost: 25,
    drops: [
      { rarity: 'Common',    pct: '60%',    items: ['Tags · Name Colors · PFP Borders'] },
      { rarity: 'Uncommon',  pct: '25%',    items: ['Tags · Name Colors · PFP Borders'] },
      { rarity: 'Rare',      pct: '10.25%', items: ['Tags · Name Colors · PFP Borders'] },
      { rarity: 'Epic',      pct: '3.95%',  items: ['Tags · Name Colors · PFP Glows'] },
      { rarity: 'Legendary', pct: '0.75%',  items: ['Tags · Name Colors · PFP Fills'] },
      { rarity: 'Mythic',    pct: '0.05%',  items: ['GOD · Verified · Rainbow'] },
    ],
  },
  {
    type: 'dev-curse', icon: '💀', label: "Developer's Curse", desc: '1 coin · mostly Common · 0.001% each: Curse Tag, Curse Name, Curse PFP', cost: 1,
    drops: [
      { rarity: 'Common', pct: '99.997%', items: ['Learner', 'C Student', 'Bottom 100'] },
      { rarity: 'Curse',  pct: '0.001%',  items: ['CURSE tag'] },
      { rarity: 'Curse',  pct: '0.001%',  items: ['Curse Name Color'] },
      { rarity: 'Curse',  pct: '0.001%',  items: ['The Curse PFP'] },
    ],
  },
]

type SimItem = { id: string; label: string; rarity: string; type: 'tag' | 'name-color' | 'pfp'; tag?: string; tagColor?: string; value?: string; name?: string }
const SIM_ITEMS: Record<string, SimItem[]> = {
  tag: [
    { id: 'grinder',        label: 'Grinder (Common)',          rarity: 'Common',    type: 'tag', tag: 'Grinder',        tagColor: '#6B7280' },
    { id: 'focused',        label: 'Focused (Common)',          rarity: 'Common',    type: 'tag', tag: 'Focused',         tagColor: '#6B7280' },
    { id: 'scholar',        label: 'Scholar (Common)',          rarity: 'Common',    type: 'tag', tag: 'Scholar',         tagColor: '#6B7280' },
    { id: 'honors-student', label: 'Honors Student (Uncommon)', rarity: 'Uncommon',  type: 'tag', tag: 'Honors Student',  tagColor: '#3B82F6' },
    { id: 'ap-student',     label: 'AP Student (Uncommon)',     rarity: 'Uncommon',  type: 'tag', tag: 'AP Student',      tagColor: '#06B6D4' },
    { id: 'deans-list',     label: "Dean's List (Rare)",        rarity: 'Rare',      type: 'tag', tag: "Dean's List",     tagColor: '#8B5CF6' },
    { id: 'top-performer',  label: 'Top Performer (Rare)',      rarity: 'Rare',      type: 'tag', tag: 'Top Performer',   tagColor: '#8B5CF6' },
    { id: 'ace',            label: 'Ace (Epic)',                rarity: 'Epic',      type: 'tag', tag: 'Ace',             tagColor: '#F97316' },
    { id: 'genius',         label: 'Genius (Epic)',             rarity: 'Epic',      type: 'tag', tag: 'Genius',          tagColor: '#EC4899' },
    { id: 'mastermind',     label: 'Valedictorian (Legendary)', rarity: 'Legendary', type: 'tag', tag: 'Valedictorian',   tagColor: '#F8FAFC' },
    { id: 'prodigy',        label: 'Prodigy (Legendary)',       rarity: 'Legendary', type: 'tag', tag: 'Prodigy',         tagColor: '#111111' },
    { id: 'god',            label: 'VIP (Mythic)',              rarity: 'Mythic',    type: 'tag', tag: 'VIP',             tagColor: '#111111' },
    { id: 'verified',      label: 'Verified ✓ Yellow (Mythic)', rarity: 'Mythic',   type: 'tag', tag: 'Verified',         tagColor: 'verified-yellow' },
    { id: 'verified-blue', label: 'Verified ✓ Blue (Mythic)',   rarity: 'Mythic',   type: 'tag', tag: 'Verified',         tagColor: 'verified-blue' },
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
    { id: 'fill-white',     label: 'White Fill (Legendary)',     rarity: 'Legendary', type: 'pfp', name: 'White Fill',       value: 'fill-white' },
    { id: 'rainbow',        label: 'Rainbow Animated ✨ (Mythic)', rarity: 'Mythic',  type: 'pfp', name: 'Rainbow Animated', value: 'rainbow' },
  ],
  'cosmetics': [
    { id: 'grinder',        label: 'Grinder (Common)',          rarity: 'Common',    type: 'tag',        tag: 'Grinder',        tagColor: '#6B7280' },
    { id: 'focused',        label: 'Focused (Common)',          rarity: 'Common',    type: 'tag',        tag: 'Focused',        tagColor: '#6B7280' },
    { id: 'scholar',        label: 'Scholar (Common)',          rarity: 'Common',    type: 'tag',        tag: 'Scholar',        tagColor: '#6B7280' },
    { id: 'forest-green',   label: 'Forest Green (Common)',     rarity: 'Common',    type: 'name-color', name: 'Forest Green',  value: '#15803D' },
    { id: 'navy-blue',      label: 'Navy Blue (Common)',        rarity: 'Common',    type: 'name-color', name: 'Navy Blue',     value: '#1D4ED8' },
    { id: 'dark-red',       label: 'Dark Red (Common)',         rarity: 'Common',    type: 'name-color', name: 'Dark Red',      value: '#991B1B' },
    { id: 'slate-blue',     label: 'Slate Blue (Common)',       rarity: 'Common',    type: 'name-color', name: 'Slate Blue',    value: '#4338CA' },
    { id: 'teal',           label: 'Teal (Common)',             rarity: 'Common',    type: 'name-color', name: 'Teal',          value: '#0F766E' },
    { id: 'border-green',   label: 'Green Border (Common)',     rarity: 'Common',    type: 'pfp',        name: 'Green Border',  value: 'border-green' },
    { id: 'border-blue',    label: 'Blue Border (Common)',      rarity: 'Common',    type: 'pfp',        name: 'Blue Border',   value: 'border-blue' },
    { id: 'border-red',     label: 'Red Border (Common)',       rarity: 'Common',    type: 'pfp',        name: 'Red Border',    value: 'border-red' },
    { id: 'border-navy',    label: 'Navy Border (Common)',      rarity: 'Common',    type: 'pfp',        name: 'Navy Border',   value: 'border-navy' },
    { id: 'border-teal',    label: 'Teal Border (Common)',      rarity: 'Common',    type: 'pfp',        name: 'Teal Border',   value: 'border-teal' },
    { id: 'honors-student', label: 'Honors Student (Uncommon)', rarity: 'Uncommon',  type: 'tag',        tag: 'Honors Student', tagColor: '#3B82F6' },
    { id: 'ap-student',     label: 'AP Student (Uncommon)',     rarity: 'Uncommon',  type: 'tag',        tag: 'AP Student',     tagColor: '#06B6D4' },
    { id: 'bright-orange',  label: 'Bright Orange (Uncommon)',  rarity: 'Uncommon',  type: 'name-color', name: 'Bright Orange', value: '#EA580C' },
    { id: 'violet',         label: 'Violet (Uncommon)',         rarity: 'Uncommon',  type: 'name-color', name: 'Violet',        value: '#7C3AED' },
    { id: 'cyan',           label: 'Cyan (Uncommon)',           rarity: 'Uncommon',  type: 'name-color', name: 'Cyan',          value: '#0891B2' },
    { id: 'border-orange',  label: 'Orange Border (Uncommon)',  rarity: 'Uncommon',  type: 'pfp',        name: 'Orange Border', value: 'border-orange' },
    { id: 'border-violet',  label: 'Violet Border (Uncommon)',  rarity: 'Uncommon',  type: 'pfp',        name: 'Violet Border', value: 'border-violet' },
    { id: 'border-cyan',    label: 'Cyan Border (Uncommon)',    rarity: 'Uncommon',  type: 'pfp',        name: 'Cyan Border',   value: 'border-cyan' },
    { id: 'deans-list',     label: "Dean's List (Rare)",        rarity: 'Rare',      type: 'tag',        tag: "Dean's List",    tagColor: '#8B5CF6' },
    { id: 'top-performer',  label: 'Top Performer (Rare)',      rarity: 'Rare',      type: 'tag',        tag: 'Top Performer',  tagColor: '#8B5CF6' },
    { id: 'hot-pink',       label: 'Hot Pink (Rare)',           rarity: 'Rare',      type: 'name-color', name: 'Hot Pink',      value: '#DB2777' },
    { id: 'gold',           label: 'Gold (Rare)',               rarity: 'Rare',      type: 'name-color', name: 'Gold',          value: '#D97706' },
    { id: 'lime-green',     label: 'Lime Green (Rare)',         rarity: 'Rare',      type: 'name-color', name: 'Lime Green',    value: '#65A30D' },
    { id: 'border-hotpink', label: 'Hot Pink Border (Rare)',    rarity: 'Rare',      type: 'pfp',        name: 'Hot Pink Border', value: 'border-hotpink' },
    { id: 'border-gold',    label: 'Gold Border (Rare)',        rarity: 'Rare',      type: 'pfp',        name: 'Gold Border',   value: 'border-gold' },
    { id: 'border-lime',    label: 'Lime Border (Rare)',        rarity: 'Rare',      type: 'pfp',        name: 'Lime Border',   value: 'border-lime' },
    { id: 'ace',            label: 'Ace (Epic)',                rarity: 'Epic',      type: 'tag',        tag: 'Ace',            tagColor: '#F97316' },
    { id: 'genius',         label: 'Genius (Epic)',             rarity: 'Epic',      type: 'tag',        tag: 'Genius',         tagColor: '#EC4899' },
    { id: 'electric-blue',  label: 'Electric Blue (Epic)',      rarity: 'Epic',      type: 'name-color', name: 'Electric Blue', value: '#2563EB' },
    { id: 'magenta',        label: 'Magenta (Epic)',            rarity: 'Epic',      type: 'name-color', name: 'Magenta',       value: '#C026D3' },
    { id: 'glow-pink',      label: 'Pink Glow (Epic)',          rarity: 'Epic',      type: 'pfp',        name: 'Pink Glow',     value: 'glow-pink' },
    { id: 'glow-purple',    label: 'Purple Glow (Epic)',        rarity: 'Epic',      type: 'pfp',        name: 'Purple Glow',   value: 'glow-purple' },
    { id: 'mastermind',     label: 'Valedictorian (Legendary)', rarity: 'Legendary', type: 'tag',        tag: 'Valedictorian',  tagColor: '#F8FAFC' },
    { id: 'prodigy',        label: 'Prodigy (Legendary)',       rarity: 'Legendary', type: 'tag',        tag: 'Prodigy',        tagColor: '#111111' },
    { id: 'pure-white',     label: 'Pure White (Legendary)',    rarity: 'Legendary', type: 'name-color', name: 'Pure White',    value: '#F8FAFC' },
    { id: 'black',          label: 'Black (Legendary)',         rarity: 'Legendary', type: 'name-color', name: 'Black',         value: '#111111' },
    { id: 'glow-gold',      label: 'Gold Fill (Legendary)',     rarity: 'Legendary', type: 'pfp',        name: 'Gold Fill',     value: 'glow-gold' },
    { id: 'frame-black',    label: 'Void Fill (Legendary)',     rarity: 'Legendary', type: 'pfp',        name: 'Void Fill',     value: 'frame-black' },
    { id: 'fill-white',     label: 'White Fill (Legendary)',    rarity: 'Legendary', type: 'pfp',        name: 'White Fill',    value: 'fill-white' },
    { id: 'god',            label: 'VIP (Mythic)',              rarity: 'Mythic',    type: 'tag',        tag: 'VIP',            tagColor: '#111111' },
    { id: 'verified',       label: 'Verified ✓ Yellow (Mythic)', rarity: 'Mythic',  type: 'tag',        tag: 'Verified',       tagColor: 'verified-yellow' },
    { id: 'rainbow',        label: 'Rainbow RGB ✨ (Mythic)',   rarity: 'Mythic',    type: 'name-color', name: 'Rainbow RGB',   value: 'rainbow' },
    { id: 'rainbow-pfp',    label: 'Rainbow Animated ✨ (Mythic)', rarity: 'Mythic', type: 'pfp',       name: 'Rainbow Animated', value: 'rainbow' },
  ],
  'dev-curse': [
    { id: 'learner',      label: 'Learner (Common)',        rarity: 'Common', type: 'tag',        tag: 'Learner',    tagColor: '#94A3B8' },
    { id: 'c-student',    label: 'C Student (Common)',      rarity: 'Common', type: 'tag',        tag: 'C Student',  tagColor: '#78716C' },
    { id: 'bottom-100',   label: 'Bottom 100 (Common)',     rarity: 'Common', type: 'tag',        tag: 'Bottom 100', tagColor: '#6B7280' },
    { id: 'curse-tag',    label: 'CURSE tag',               rarity: 'Curse',  type: 'tag',        tag: 'CURSE',      tagColor: 'curse' },
    { id: 'curse-name',   label: 'Curse Name Color',        rarity: 'Curse',  type: 'name-color', name: 'Curse Name Color', value: 'curse' },
    { id: 'curse',        label: 'The Curse PFP',           rarity: 'Curse',  type: 'pfp',        name: 'The Curse', value: 'unobtainable-curse' },
  ],
}

const QUICKSELL_PRICES: Record<string, number> = {
  Common: 3, Uncommon: 7, Rare: 13, Epic: 27, Legendary: 100, Mythic: 667, Unobtainable: 5000, Curse: 0,
}

const RARITY_RANK: Record<string, number> = {
  Curse: -2, Unobtainable: -1, Mythic: 0, Legendary: 1, Epic: 2, Rare: 3, Uncommon: 4, Common: 5,
}

function byRarity<T extends { rarity: string; id: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const diff = (RARITY_RANK[a.rarity] ?? 99) - (RARITY_RANK[b.rarity] ?? 99)
    if (diff !== 0) return diff
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
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

// Untradeable + unlistable (all soulbound tags). Also used to filter trade UI.
const NON_TRADEABLE_TAG_IDS = new Set([
  'Novice', 'Pro', 'Veteran', 'Legend',
  'Learner', 'C Student', 'Bottom 100',
])
// Dev-curse exclusives: quicksell IS allowed but yields 0 coins
const ZERO_QUICKSELL_TAG_IDS = new Set(['Learner', 'C Student', 'Bottom 100'])

// Every item that exists in the app — mirrors backend TAG_BOX_ITEMS / NAME_COLOR_BOX_ITEMS / PFP_EFFECT_BOX_ITEMS
type CatalogItem = { id: string; type: 'tag' | 'name-color' | 'pfp'; name: string; rarity: string; value?: string; tagColor?: string; tag?: string }
const CATALOG_ALL_ITEMS: CatalogItem[] = [
  // ── Tags ──
  { id: 'grinder',        type: 'tag', name: 'Grinder',       rarity: 'Common',    tagColor: '#6B7280' },
  { id: 'focused',        type: 'tag', name: 'Focused',        rarity: 'Common',    tagColor: '#6B7280' },
  { id: 'scholar',        type: 'tag', name: 'Scholar',        rarity: 'Common',    tagColor: '#6B7280' },
  { id: 'honors-student', type: 'tag', name: 'Honors Student', rarity: 'Uncommon',  tagColor: '#3B82F6' },
  { id: 'ap-student',     type: 'tag', name: 'AP Student',     rarity: 'Uncommon',  tagColor: '#06B6D4' },
  { id: 'deans-list',     type: 'tag', name: "Dean's List",    rarity: 'Rare',      tagColor: '#8B5CF6' },
  { id: 'top-performer',  type: 'tag', name: 'Top Performer',  rarity: 'Rare',      tagColor: '#8B5CF6' },
  { id: 'ace',            type: 'tag', name: 'Ace',            rarity: 'Epic',      tagColor: '#F97316' },
  { id: 'genius',         type: 'tag', name: 'Genius',         rarity: 'Epic',      tagColor: '#EC4899' },
  { id: 'mastermind',     type: 'tag', name: 'Valedictorian',  rarity: 'Legendary', tagColor: '#F8FAFC' },
  { id: 'prodigy',        type: 'tag', name: 'Prodigy',        rarity: 'Legendary', tagColor: '#111111' },
  { id: 'god',            type: 'tag', name: 'VIP',             rarity: 'Mythic',    tagColor: '#111111' },
  { id: 'GOAT',           type: 'tag', name: 'GOAT',            rarity: 'Mythic',    tagColor: '#EAB308' },
  { id: 'verified',       type: 'tag', name: 'Verified',        rarity: 'Mythic',    tagColor: 'verified-yellow' },
  { id: 'verified-blue',  type: 'tag', name: 'Verified (Blue)', rarity: 'Mythic',    tagColor: 'verified-blue' },
  // ── Streak Tags (soulbound) ──
  { id: 'novice',   type: 'tag', name: 'Novice',   rarity: 'Streak', tagColor: '#22C55E' },
  { id: 'pro',      type: 'tag', name: 'Pro',      rarity: 'Streak', tagColor: '#3B82F6' },
  { id: 'veteran',  type: 'tag', name: 'Veteran',  rarity: 'Streak', tagColor: '#F97316' },
  { id: 'legend',   type: 'tag', name: 'Legend',   rarity: 'Streak', tagColor: '#EC4899' },
  // ── Staff / Secret Tags ──
  { id: 'dev',   type: 'tag', name: 'DEV',   rarity: 'Staff', tagColor: '#ff6b6b' },
  { id: 'admin', type: 'tag', name: 'Admin', rarity: 'Staff', tagColor: '#EF4444' },
  { id: 'mod',   type: 'tag', name: 'MOD',   rarity: 'Staff', tagColor: '#3B82F6' },
  { id: 'vip',   type: 'tag', name: 'GOD',   rarity: 'Staff', tagColor: '#A855F7' },
  { id: 'bot',   type: 'tag', name: 'BOT',   rarity: 'Staff', tagColor: '#6B7280' },
  // ── Name Colors ──
  { id: 'forest-green',  type: 'name-color', name: 'Forest Green',  rarity: 'Common',    value: '#15803D' },
  { id: 'navy-blue',     type: 'name-color', name: 'Navy Blue',      rarity: 'Common',    value: '#1D4ED8' },
  { id: 'dark-red',      type: 'name-color', name: 'Dark Red',       rarity: 'Common',    value: '#991B1B' },
  { id: 'slate-blue',    type: 'name-color', name: 'Slate Blue',     rarity: 'Common',    value: '#4338CA' },
  { id: 'teal',          type: 'name-color', name: 'Teal',           rarity: 'Common',    value: '#0F766E' },
  { id: 'bright-orange', type: 'name-color', name: 'Bright Orange',  rarity: 'Uncommon',  value: '#EA580C' },
  { id: 'violet',        type: 'name-color', name: 'Violet',         rarity: 'Uncommon',  value: '#7C3AED' },
  { id: 'cyan',          type: 'name-color', name: 'Cyan',           rarity: 'Uncommon',  value: '#0891B2' },
  { id: 'hot-pink',      type: 'name-color', name: 'Hot Pink',       rarity: 'Rare',      value: '#DB2777' },
  { id: 'gold',          type: 'name-color', name: 'Gold',           rarity: 'Rare',      value: '#D97706' },
  { id: 'lime-green',    type: 'name-color', name: 'Lime Green',     rarity: 'Rare',      value: '#65A30D' },
  { id: 'electric-blue', type: 'name-color', name: 'Electric Blue',  rarity: 'Epic',      value: '#2563EB' },
  { id: 'magenta',       type: 'name-color', name: 'Magenta',        rarity: 'Epic',      value: '#C026D3' },
  { id: 'pure-white',    type: 'name-color', name: 'Pure White',     rarity: 'Legendary', value: '#F8FAFC' },
  { id: 'black',         type: 'name-color', name: 'Black',          rarity: 'Legendary', value: '#111111' },
  { id: 'rainbow',       type: 'name-color', name: 'Rainbow RGB ✨', rarity: 'Mythic',    value: 'rainbow' },
  // ── PFP Effects ──
  { id: 'border-green',   type: 'pfp', name: 'Green Border',      rarity: 'Common',    value: 'border-green'   },
  { id: 'border-blue',    type: 'pfp', name: 'Blue Border',       rarity: 'Common',    value: 'border-blue'    },
  { id: 'border-red',     type: 'pfp', name: 'Red Border',        rarity: 'Common',    value: 'border-red'     },
  { id: 'border-navy',    type: 'pfp', name: 'Navy Border',       rarity: 'Common',    value: 'border-navy'    },
  { id: 'border-teal',    type: 'pfp', name: 'Teal Border',       rarity: 'Common',    value: 'border-teal'    },
  { id: 'border-orange',  type: 'pfp', name: 'Orange Border',     rarity: 'Uncommon',  value: 'border-orange'  },
  { id: 'border-violet',  type: 'pfp', name: 'Violet Border',     rarity: 'Uncommon',  value: 'border-violet'  },
  { id: 'border-cyan',    type: 'pfp', name: 'Cyan Border',       rarity: 'Uncommon',  value: 'border-cyan'    },
  { id: 'border-hotpink', type: 'pfp', name: 'Hot Pink Border',   rarity: 'Rare',      value: 'border-hotpink' },
  { id: 'border-gold',    type: 'pfp', name: 'Gold Border',       rarity: 'Rare',      value: 'border-gold'    },
  { id: 'border-lime',    type: 'pfp', name: 'Lime Border',       rarity: 'Rare',      value: 'border-lime'    },
  { id: 'glow-pink',      type: 'pfp', name: 'Pink Glow',         rarity: 'Epic',      value: 'glow-pink'      },
  { id: 'glow-purple',    type: 'pfp', name: 'Purple Glow',       rarity: 'Epic',      value: 'glow-purple'    },
  { id: 'glow-gold',      type: 'pfp', name: 'Gold Fill',         rarity: 'Legendary', value: 'glow-gold'      },
  { id: 'frame-black',    type: 'pfp', name: 'Void Fill',         rarity: 'Legendary', value: 'frame-black'    },
  { id: 'fill-white',     type: 'pfp', name: 'White Fill',        rarity: 'Legendary', value: 'fill-white'     },
  { id: 'rainbow',        type: 'pfp', name: 'Rainbow Animated ✨', rarity: 'Mythic',       value: 'rainbow'              },
  { id: 'curse',         type: 'pfp',        name: 'The Curse PFP',     rarity: 'Curse', value: 'unobtainable-curse' },
  { id: 'curse-tag',    type: 'tag',        name: 'CURSE tag',         rarity: 'Curse', tagColor: 'curse' },
  { id: 'curse-name',   type: 'name-color', name: 'Curse Name Color',  rarity: 'Curse', value: 'curse' },
  // Developer's Curse exclusives (Common, zero-quicksell)
  { id: 'Learner',    type: 'tag', name: 'Learner',    rarity: 'Common', tagColor: '#94A3B8' },
  { id: 'C Student',  type: 'tag', name: 'C Student',  rarity: 'Common', tagColor: '#78716C' },
  { id: 'Bottom 100', type: 'tag', name: 'Bottom 100', rarity: 'Common', tagColor: '#6B7280' },
]

type Tab = 'boxes' | 'shop' | 'trade' | 'inventory' | 'leaderboard' | 'catalog'
type TradeSubTab = 'new' | 'incoming' | 'sent' | 'history'

function PriceTooltip({ children, price }: { children: React.ReactNode; price?: number }) {
  const [show, setShow] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleEnter() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setShow(true), 120)
  }
  function handleLeave() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setShow(false)
  }

  if (!price) return <>{children}</>
  return (
    <div style={{ position: 'relative' }} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {children}
      {show && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 5, background: '#0d1117', border: '1px solid #EAB30866',
          borderRadius: 6, padding: '3px 9px', whiteSpace: 'nowrap',
          fontSize: 11, color: '#EAB308', fontWeight: 700, zIndex: 1000,
          pointerEvents: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.6)',
        }}>
          <CoinIcon size={11} style={{ marginRight: 3 }} />Est. {price.toLocaleString()}
        </div>
      )}
    </div>
  )
}

function RarityBadge({ rarity, itemId }: { rarity: string; itemId?: string }) {
  const color = getRarityColor(rarity, itemId)
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`, padding: '2px 7px', borderRadius: 99, border: `1px solid ${color}44` }}>
      {rarity}
    </span>
  )
}

function getRarityBorderColor(rarity: string, itemId?: string): string {
  if (itemId && ITEM_COLOR_OVERRIDE[itemId]) return ITEM_COLOR_OVERRIDE[itemId]
  const c = RARITY_COLOR[rarity]
  if (!c || c === 'rainbow') return 'linear-gradient(135deg, #ff6b6b, #ffd43b, #69db7c, #4dabf7, #cc5de8, #ff6b6b)'
  return c
}

function ItemBox({ children, rarity, itemId, style, onClick }: { children: React.ReactNode; rarity: string; itemId?: string; style?: React.CSSProperties; onClick?: () => void }) {
  const borderColor = getRarityBorderColor(rarity, itemId)
  const isRainbow = RARITY_COLOR[rarity] === 'rainbow'
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 8,
        background: 'var(--surface-2)',
        border: isRainbow ? '2px solid transparent' : `2px solid ${borderColor}44`,
        ...(isRainbow ? { backgroundImage: borderColor, backgroundOrigin: 'border-box', backgroundClip: 'padding-box' } : {}),
        ...style,
      }}
    >
      {children}
    </div>
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
      <span className={pfpClass(value)} style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-block', flexShrink: 0, background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', ...pfpStyle(value) }} />
    )
  }
  return <span style={{ fontSize: 18 }}>📦</span>
}

// ── Item Preview Modal ────────────────────────────────────────────────────────

type PreviewItem = { type: 'tag' | 'name-color' | 'pfp'; id: string; name: string; rarity: string; value?: string; tagColor?: string }

function SalesChart({ data }: { data: ItemSalePoint[] }) {
  if (data.length === 0) return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No sales recorded yet</div>
  )
  const prices = data.map(d => d.price)
  const minP = Math.min(...prices), maxP = Math.max(...prices)
  const range = maxP - minP || 1
  const W = 320, H = 120, PAD = 8
  const pts = data.map((d, i) => ({
    x: PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2),
    y: PAD + (1 - (d.price - minP) / range) * (H - PAD * 2),
    price: d.price,
    date: new Date(d.soldAt).toLocaleDateString(),
  }))
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const fillD = `${pathD} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={W} height={H} style={{ display: 'block', margin: '0 auto' }}>
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2979FF" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#2979FF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={fillD} fill="url(#chartFill)" />
        <path d={pathD} fill="none" stroke="#2979FF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#2979FF" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', padding: '4px 8px 0' }}>
        <span>{pts[0]?.date}</span>
        <span style={{ color: '#EAB308', fontWeight: 700, fontSize: 12 }}>{data.length} sale{data.length !== 1 ? 's' : ''}</span>
        <span>{pts[pts.length - 1]?.date}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', padding: '8px 8px 0' }}>
        <div>Low: <strong style={{ color: 'var(--text)' }}>{minP.toLocaleString()}</strong></div>
        <div>High: <strong style={{ color: 'var(--text)' }}>{maxP.toLocaleString()}</strong></div>
        <div>Last: <strong style={{ color: '#EAB308' }}>{prices[prices.length - 1].toLocaleString()}</strong></div>
      </div>
    </div>
  )
}

function ItemPreviewModal({ item, onClose, onViewProfile }: { item: PreviewItem; onClose: () => void; onViewProfile: (id: number) => void }) {
  const [tab, setTab] = useState<'history' | 'owners'>('history')
  const [history, setHistory] = useState<ItemSalePoint[] | null>(null)
  const [owners, setOwners] = useState<ItemOwner[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    if (tab === 'history') {
      api.marketplaceItemHistory(item.type, item.id)
        .then(d => setHistory(d))
        .catch(() => setHistory([]))
        .finally(() => setLoading(false))
    } else {
      if (owners !== null) { setLoading(false); return }
      api.marketplaceItemOwners(item.type, item.id)
        .then(d => setOwners(d))
        .catch(() => setOwners([]))
        .finally(() => setLoading(false))
    }
  }, [tab, item.type, item.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const rarityColor = getRarityColor(item.rarity, item.id)

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div className="ns-card" style={{ width: '92%', maxWidth: 420, display: 'flex', flexDirection: 'column', maxHeight: '85vh', overflow: 'hidden', border: `1px solid ${rarityColor}44` }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <ItemIcon item={{ type: item.type, value: item.value }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
            <RarityBadge rarity={item.rarity} itemId={item.id} />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: 4, lineHeight: 1 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['history', 'owners'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px 0', border: 'none', background: 'transparent', color: tab === t ? 'var(--primary)' : 'var(--text-muted)', fontWeight: tab === t ? 700 : 500, fontSize: 13, cursor: 'pointer', borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent' }}>
              {t === 'history' ? '📈 Price History' : '👥 Owners'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
          ) : tab === 'history' ? (
            <SalesChart data={history ?? []} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(owners ?? []).length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No owners found</div>
              ) : (owners ?? []).map(owner => (
                <div key={owner.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ width: 28, fontSize: 11, fontWeight: 700, color: owner.rank === 1 ? '#EAB308' : 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>
                    {owner.rank === 1 ? '🥇' : `#${owner.rank}`}
                  </span>
                  <div className={pfpClass(owner.pfpEffect)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', flexShrink: 0, ...pfpStyle(owner.pfpEffect) }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button onClick={() => { onViewProfile(owner.id); onClose() }}
                      className={owner.nameColor === 'rainbow' ? 'name-rainbow' : owner.nameColor === 'curse' ? 'name-curse' : ''}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', ...(owner.nameColor && owner.nameColor !== 'rainbow' && owner.nameColor !== 'curse' ? { color: owner.nameColor } : { color: 'var(--text)' }) }}>
                      {owner.name ?? 'Unknown'}
                    </button>
                    {owner.tag && (
                      (owner.tagColor === 'verified-yellow' || owner.tagColor === 'verified-blue')
                        ? <VerifiedBadge variant={owner.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} />
                        : <span className={owner.tag === 'DEV' ? 'tag-rainbow' : owner.tag === 'VIP' ? 'tag-mythic' : owner.tag === 'GOAT' ? 'tag-god' : owner.tagColor === 'curse' ? 'tag-curse' : ''} style={{ fontSize: 11, fontWeight: 700, color: (owner.tag === 'DEV' || owner.tag === 'VIP' || owner.tag === 'GOAT' || owner.tagColor === 'curse') ? undefined : owner.tagColor ?? '#6B7280' }}>[{owner.tag}]</span>
                    )}
                  </div>
                  {owner.rank === 1 && <span style={{ fontSize: 10, color: '#EAB308', fontWeight: 700, background: '#EAB30818', borderRadius: 99, padding: '2px 6px', flexShrink: 0 }}>First</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Spin Wheel ────────────────────────────────────────────────────────────────

function getRarityWheelColor(rarity: string): string {
  const c = RARITY_COLOR[rarity]
  if (!c || c === 'rainbow') return '#FFD700'
  return c
}

type MultiBoxResult = { coins: number; results: Array<{ won: BoxResult['won']; alreadyHad: boolean }> }

function sampleEvenly<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr
  const step = arr.length / n
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)])
}

const HIGHLIGHT_RARITIES = ['Curse', 'Unobtainable', 'Mythic', 'Legendary']

function MultiSpinResultOverlay({ result, onClose }: { result: MultiBoxResult; onClose: () => void }) {
  const [cardIdx, setCardIdx] = useState(0)

  const qty = result.results.length

  // Build full summary grouped by item (always)
  const summaryMap = new Map<string, { won: BoxResult['won']; count: number }>()
  for (const r of result.results) {
    const key = `${r.won.type}:${r.won.id}`
    const ex = summaryMap.get(key)
    if (ex) ex.count++
    else summaryMap.set(key, { won: r.won, count: 1 })
  }
  const summaryRows = [...summaryMap.values()].sort((a, b) => (RARITY_RANK[a.won.rarity] ?? 99) - (RARITY_RANK[b.won.rarity] ?? 99))
  const highlight = summaryRows.find(g => HIGHLIGHT_RARITIES.includes(g.won.rarity))

  // Build carousel of each Legendary+ result (always)
  const carouselCards: BoxResult['won'][] | null = (() => {
    const good = result.results.filter(r => HIGHLIGHT_RARITIES.includes(r.won.rarity)).map(r => r.won)
    if (good.length > 0) return good
    const best = [...result.results].sort((a, b) => (RARITY_RANK[a.won.rarity] ?? 99) - (RARITY_RANK[b.won.rarity] ?? 99))[0]
    return best ? [best.won] : []
  })()

  const safeIdx = carouselCards ? Math.min(cardIdx, carouselCards.length - 1) : 0
  const current = carouselCards?.[safeIdx] ?? null
  const carouselColor = current ? getRarityColor(current.rarity, current.id) : 'var(--primary)'

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 14, padding: '24px 0 32px', overflowY: 'auto' }}
      onClick={onClose}
    >
      {/* Carousel section — only for >10 spins */}
      {carouselCards && current && (
        <>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>
            {carouselCards.length > 1
              ? `✨ ${safeIdx + 1} of ${carouselCards.length} highlights  ·  ${result.coins.toLocaleString()} coins left`
              : `✨ Best result  ·  ${result.coins.toLocaleString()} coins left`}
          </div>
          <div
            className="ns-card"
            style={{ padding: '32px 28px', width: '88%', maxWidth: 360, textAlign: 'center', border: `2px solid ${carouselColor}`, boxShadow: `0 0 40px ${carouselColor}55`, flexShrink: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: carouselColor, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>
              {current.rarity}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 8, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              {current.tag
                ? (current.tagColor === 'verified-yellow' || current.tagColor === 'verified-blue')
                  ? <VerifiedBadge variant={current.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} size={48} />
                  : <span className={current.tag === 'VIP' ? 'tag-mythic' : current.tag === 'GOAT' ? 'tag-god' : current.tag === 'DEV' ? 'tag-rainbow' : current.tagColor === 'curse' ? 'tag-curse' : ''} style={{ color: (current.tag === 'VIP' || current.tag === 'GOAT' || current.tag === 'DEV' || current.tagColor === 'curse') ? undefined : current.tagColor ?? carouselColor }}>[{current.tag}]</span>
                : <span>{current.name}</span>
              }
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {current.type === 'tag' ? 'Tag' : current.type === 'name-color' ? 'Name Color' : 'PFP Effect'}
            </div>
          </div>
          {carouselCards.length > 1 && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              <button disabled={safeIdx === 0} onClick={() => setCardIdx(i => Math.max(0, i - 1))}
                style={{ padding: '9px 20px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', cursor: safeIdx === 0 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14, opacity: safeIdx === 0 ? 0.35 : 1 }}
              >← Prev</button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 56, textAlign: 'center' }}>{safeIdx + 1} / {carouselCards.length}</span>
              <button disabled={safeIdx === carouselCards.length - 1} onClick={() => setCardIdx(i => Math.min(carouselCards.length - 1, i + 1))}
                style={{ padding: '9px 20px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', cursor: safeIdx === carouselCards.length - 1 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14, opacity: safeIdx === carouselCards.length - 1 ? 0.35 : 1 }}
              >Next →</button>
            </div>
          )}
        </>
      )}

      {/* Full summary card — always shown */}
      <div
        className="ns-card"
        style={{ width: '88%', maxWidth: 420, padding: 22, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>🎰 {qty} Spins — Summary</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-muted)' }}>
            <CoinIcon size={13} />{result.coins.toLocaleString()} left
          </div>
        </div>
        {highlight && (
          <div style={{ background: `${getRarityColor(highlight.won.rarity, highlight.won.id)}22`, border: `1px solid ${getRarityColor(highlight.won.rarity, highlight.won.id)}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>✨</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: getRarityColor(highlight.won.rarity, highlight.won.id) }}>{highlight.won.rarity}!</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {(highlight.won.tagColor === 'verified-yellow' || highlight.won.tagColor === 'verified-blue')
                  ? <><VerifiedBadge variant={highlight.won.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} size={20} /> Verified</>
                  : (highlight.won.name ?? highlight.won.tag)}
              </div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 320, overflowY: 'auto' }}>
          {summaryRows.map((g, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 8, background: 'var(--surface-2)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: getRarityColor(g.won.rarity, g.won.id), flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                {(g.won.tagColor === 'verified-yellow' || g.won.tagColor === 'verified-blue')
                  ? <><VerifiedBadge variant={g.won.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} size={16} /> Verified</>
                  : g.won.tag ? `[${g.won.tag}]` : (g.won.name ?? g.won.id)}
              </div>
              <div style={{ fontSize: 11, color: getRarityColor(g.won.rarity, g.won.id), fontWeight: 700, flexShrink: 0 }}>{g.won.rarity}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', flexShrink: 0, minWidth: 32, textAlign: 'right' }}>×{g.count}</div>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ padding: '10px 0', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#060D10', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          Nice!
        </button>
      </div>
    </div>,
    document.body
  )
}

function SpinWheelModal({
  box,
  inv,
  onClose,
  onSpin,
  onDone,
}: {
  box: (typeof BOX_DEFS)[0]
  inv: InventoryData | null
  onClose: () => void
  onSpin: (boxType: BoxType, quantity: number) => Promise<BoxResult | MultiBoxResult | null>
  onDone: (result: BoxResult | MultiBoxResult) => void
}) {
  const [phase, setPhase] = useState<'ready' | 'spinning'>('ready')
  const [pointerAngle, setPointerAngle] = useState(0)
  const [spinDuration, setSpinDuration] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [spinError, setSpinError] = useState<string | null>(null)
  const [multiArrows, setMultiArrows] = useState<Array<{ finalAngle: number; color: string }>>([])
  const [arrowsLanded, setArrowsLanded] = useState(false)

  const segments = useMemo(() => {
    let cum = 0
    return box.drops.map(drop => {
      const pct = parseFloat(drop.pct)
      const sweep = (pct / 100) * 360
      const seg = { rarity: drop.rarity, pct, start: cum, end: cum + sweep }
      cum += sweep
      return seg
    })
  }, [box])

  const totalCost = box.cost * quantity

  async function handleSpin() {
    if (phase !== 'ready') return
    setSpinError(null)
    setPhase('spinning')
    setMultiArrows([])
    setArrowsLanded(false)
    const result = await onSpin(box.type, quantity)
    if (!result) { setPhase('ready'); return }

    if (quantity === 1 && !('results' in result)) {
      const singleResult = result as BoxResult
      const wonSeg = segments.find(s => s.rarity === singleResult.won.rarity) ?? segments[0]
      const segSize = wonSeg.end - wonSeg.start
      const margin = Math.min(segSize * 0.15, 5)
      const landAngle = wonSeg.start + margin + Math.random() * Math.max(0, segSize - margin * 2)
      const finalPointerAngle = 5 * 360 + landAngle
      setSpinDuration(4000)
      setPointerAngle(finalPointerAngle)
      setTimeout(() => { onDone(singleResult); onClose() }, 4300)
      return
    }

    // Multi-spin: show N arrows spinning to their individual results
    const multiResult = result as MultiBoxResult
    const sampled = sampleEvenly(multiResult.results, Math.min(multiResult.results.length, 100))
    const arrows = sampled.map(r => {
      const seg = segments.find(s => s.rarity === r.won.rarity) ?? segments[0]
      const segSize = seg.end - seg.start
      const margin = Math.min(segSize * 0.15, 5)
      const landAngle = seg.start + margin + Math.random() * Math.max(0, segSize - margin * 2)
      const spins = 3 + Math.floor(Math.random() * 3)
      return { finalAngle: spins * 360 + landAngle, color: getRarityWheelColor(r.won.rarity) }
    })
    setMultiArrows(arrows)
    // After first paint (arrows at 0), trigger the spin animation
    setTimeout(() => setArrowsLanded(true), 60)
    setTimeout(() => { onDone(multiResult); onClose() }, 3600)
  }

  const CX = 150, CY = 150, R = 130

  function segmentPath(start: number, end: number): string {
    const toXY = (deg: number) => {
      const rad = (deg - 90) * (Math.PI / 180)
      return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) }
    }
    const s = toXY(start), e = toXY(end)
    const large = end - start > 180 ? 1 : 0
    return `M ${CX} ${CY} L ${s.x.toFixed(3)} ${s.y.toFixed(3)} A ${R} ${R} 0 ${large} 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)} Z`
  }

  const canSpin = phase === 'ready' && !!inv && inv.coins >= totalCost

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={phase === 'ready' ? onClose : undefined}
    >
      <div
        className="ns-card"
        style={{ padding: 32, maxWidth: 380, width: '92%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{box.icon} {box.label}</div>

        {/* Wheel (static) + orbiting arrow */}
        <div style={{ width: 300, height: 300 }}>
          <svg width={300} height={300} viewBox="0 0 300 300">
            {segments.map(seg => (
              <path
                key={seg.rarity}
                d={segmentPath(seg.start, seg.end)}
                fill={seg.rarity === 'Mythic' || seg.rarity === 'Unobtainable' || seg.rarity === 'Curse' ? '#ff0000' : getRarityWheelColor(seg.rarity)}
                stroke="none"
                className={seg.rarity === 'Mythic' ? 'mythic-hue' : (seg.rarity === 'Unobtainable' || seg.rarity === 'Curse') ? 'unobtainable-hue' : undefined}
              />
            ))}
            {/* Single arrow — only for qty=1 */}
            {quantity === 1 && multiArrows.length === 0 && (
              <g style={{
                transformOrigin: `${CX}px ${CY}px`,
                transform: `rotate(${pointerAngle}deg)`,
                transition: spinDuration > 0 ? `transform ${spinDuration}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)` : 'none',
              }}>
                <polygon
                  points={`${CX},${CY - 32} ${CX - 7},${CY - 20} ${CX + 7},${CY - 20}`}
                  fill="#EF4444"
                  style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.6))' }}
                />
              </g>
            )}
            {/* Multi arrows — one per spin (capped at 100), all animate simultaneously */}
            {multiArrows.map((arrow, i) => (
              <g key={i} style={{
                transformOrigin: `${CX}px ${CY}px`,
                transform: `rotate(${arrowsLanded ? arrow.finalAngle : 0}deg)`,
                transition: arrowsLanded ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
              }}>
                <polygon
                  points={`${CX},${CY - 34} ${CX - 8},${CY - 21} ${CX + 8},${CY - 21}`}
                  fill="#EF4444"
                  fillOpacity={multiArrows.length <= 10 ? 0.9 : multiArrows.length <= 50 ? 0.6 : 0.4}
                  style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))' }}
                />
              </g>
            ))}
            {/* Center hub: anchors all arrow bases */}
            <circle cx={CX} cy={CY} r={22} fill="#EF4444" stroke="#000" strokeWidth={2} />
          </svg>
        </div>

        {/* Rarity legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', justifyContent: 'center' }}>
          {segments.map(seg => (
            <div key={seg.rarity} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              <span className={seg.rarity === 'Mythic' ? 'mythic-hue' : (seg.rarity === 'Unobtainable' || seg.rarity === 'Curse') ? 'unobtainable-hue' : undefined} style={{ width: 10, height: 10, borderRadius: 2, background: (seg.rarity === 'Mythic' || seg.rarity === 'Unobtainable' || seg.rarity === 'Curse') ? '#ff0000' : getRarityWheelColor(seg.rarity), display: 'inline-block', flexShrink: 0 }} />
              <span className={seg.rarity === 'Mythic' ? 'mythic-hue' : (seg.rarity === 'Unobtainable' || seg.rarity === 'Curse') ? 'unobtainable-hue' : undefined} style={{ color: (seg.rarity === 'Mythic' || seg.rarity === 'Unobtainable' || seg.rarity === 'Curse') ? '#ff0000' : getRarityWheelColor(seg.rarity), fontWeight: 700 }}>{seg.rarity}</span>
              <span style={{ color: 'var(--text-muted)' }}>{seg.pct}%</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => void handleSpin()}
          disabled={!canSpin}
          style={{
            padding: '13px 44px', borderRadius: 12, border: 'none',
            background: canSpin ? 'var(--primary)' : 'var(--surface-2)',
            color: canSpin ? '#060D10' : 'var(--text-muted)',
            fontWeight: 800, fontSize: 16,
            cursor: canSpin ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {phase === 'spinning'
            ? 'Spinning…'
            : <><CoinIcon size={15} />{totalCost} — Spin{quantity > 1 ? ` ×${quantity}` : ''}!</>
          }
        </button>

        {/* Quantity input */}
        {phase === 'ready' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Quantity:</span>
              <input
                type="number"
                min={1}
                max={box.type === 'dev-curse' ? 5000 : 100}
                value={quantity}
                onChange={e => {
                  const maxQ = box.type === 'dev-curse' ? 5000 : 100
                  const v = Math.max(1, Math.min(maxQ, parseInt(e.target.value) || 1))
                  setQuantity(v)
                  setSpinError(null)
                }}
                style={{ width: 64, padding: '5px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 14, textAlign: 'center' }}
              />
              {quantity > 1 && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  = <CoinIcon size={11} /> {totalCost.toLocaleString()} total
                </span>
              )}
            </div>
            {spinError && (
              <div style={{ fontSize: 12, color: '#EF4444', textAlign: 'center', padding: '4px 10px', background: '#EF444420', borderRadius: 6 }}>
                {spinError}
              </div>
            )}
            {inv && inv.coins < totalCost && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                You can afford up to {Math.floor(inv.coins / box.cost)} spin{Math.floor(inv.coins / box.cost) !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {phase === 'ready' && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', padding: '4px 10px' }}>
            Cancel
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [streak, setStreak] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('boxes')
  const [tradeSubTab, setTradeSubTab] = useState<TradeSubTab>('new')

  // Inventory & coins
  const [inv, setInv] = useState<InventoryData | null>(null)
  const [loading, setLoading] = useState(true)

  // Box opening
  const [opening, setOpening] = useState<BoxType | null>(null)
  const [multiResult, setMultiResult] = useState<MultiBoxResult | null>(null)
  const [spinnerBox, setSpinnerBox] = useState<BoxType | null>(null)
  const [hoveredBox, setHoveredBox] = useState<BoxType | null>(null)
  const [result, setResult] = useState<(BoxResult & { dismissed?: boolean }) | null>(null)
  const [resultId, setResultId] = useState(0)
  const resultCardRef = useRef<HTMLDivElement>(null)
  const [dismissCountdown, setDismissCountdown] = useState(0)
  const [equipping, setEquipping] = useState<string | null>(null)
  const [quickselling, setQuickselling] = useState<string | null>(null)

  // Quicksell confirmation (last copy or legendary/mythic)
  const [quicksellConfirm, setQuicksellConfirm] = useState<{
    itemType: 'tag' | 'name-color' | 'pfp'
    itemId: string
    itemName: string
    rarity: string
    coins: number
    isLastCopy: boolean
    isRare: boolean
  } | null>(null)

  // Sell all duplicates confirmation
  const [sellDupsConfirm, setSellDupsConfirm] = useState<{
    items: Array<{ type: 'tag' | 'name-color' | 'pfp'; id: string; name: string; rarity: string; count: number; coinsEach: number }>
    totalCoins: number
    hasRare: boolean
  } | null>(null)
  const [sellingDups, setSellingDups] = useState(false)
  const [dupExcluded, setDupExcluded] = useState<Set<string>>(new Set())

  const [currentUserId, setCurrentUserId] = useState<number | null>(null)

  // DEV panel
  const [isDevUser, setIsDevUser] = useState(false)
  const [devCoins, setDevCoins] = useState('500')
  const [devType, setDevType] = useState<'name-color' | 'pfp' | 'tag'>('name-color')
  const [devItemId, setDevItemId] = useState('')
  const [devGranting, setDevGranting] = useState(false)
  const [devMsg, setDevMsg] = useState('')
  const [simBoxType, setSimBoxType] = useState<'tag' | 'name-color' | 'pfp'>('name-color')
  const [simItemId, setSimItemId] = useState('')
  const [devMarketUserId, setDevMarketUserId] = useState('')
  const [devMarketGranting, setDevMarketGranting] = useState(false)
  const [devMarketMsg, setDevMarketMsg] = useState('')
  const [profileMarketGranting, setProfileMarketGranting] = useState(false)
  const [profileMarketMsg, setProfileMarketMsg] = useState('')

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
  const [searchResults, setSearchResults] = useState<Array<{ id: number; name: string | null; tag: string | null; tagColor: string | null }>>([])
  const [tradeTarget, setTradeTarget] = useState<UserPublicInventory | null>(null)
  const [targetLoading, setTargetLoading] = useState(false)
  const [tradeInvSearch, setTradeInvSearch] = useState('')
  const [tradeMySearch, setTradeMySearch] = useState('')
  const [selectedOffer, setSelectedOffer] = useState<TradeItem[]>([])
  const [selectedRequest, setSelectedRequest] = useState<TradeItem[]>([])
  const [sendingTrade, setSendingTrade] = useState(false)
  const [tradeMsg, setTradeMsg] = useState('')

  // Profile panel
  const [profilePanel, setProfilePanel] = useState<FeedUserProfile | null>(null)
  const [profilePanelLoading, setProfilePanelLoading] = useState(false)
  const [profileSendAmount, setProfileSendAmount] = useState('')
  const [profileSendBusy, setProfileSendBusy] = useState(false)
  const [profileSendMsg, setProfileSendMsg] = useState('')

  // Item preview
  const [previewItem, setPreviewItem] = useState<PreviewItem | null>(null)

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null)
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [leaderboardSub, setLeaderboardSub] = useState<'coins' | 'streak' | 'inventory'>('coins')

  // Trade — lists
  const [incomingTrades, setIncomingTrades] = useState<TradeOffer[]>([])
  const [sentTrades, setSentTrades] = useState<TradeOffer[]>([])
  const [historyTrades, setHistoryTrades] = useState<TradeOffer[]>([])
  const [tradesLoading, setTradesLoading] = useState(false)
  const [tradeBusy, setTradeBusy] = useState<number | null>(null)
  const [tradeActionMsg, setTradeActionMsg] = useState<{ id: number; msg: string } | null>(null)

  // Item prices for hover tooltips
  const [prices, setPrices] = useState<Record<string, number>>({})

  // ── Data fetching ─────────────────────────────────────────────────────────

  const refreshInventory = useCallback(() => {
    api.marketplaceInventory()
      .then(d => setInv(d))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const nsUser = (() => { try { return JSON.parse(localStorage.getItem('ns_user') ?? 'null') as { id?: number } | null } catch { return null } })()
    const uid = nsUser?.id ?? 'anon'
    setCurrentUserId(nsUser?.id ?? null)
    setStreak(parseInt(localStorage.getItem(`ns_streak_${uid}`) ?? '0', 10))

    api.marketplaceInventory()
      .then(d => {
        setInv(d)
        if (d.marketplaceAccess) setStreak(prev => Math.max(prev ?? 0, 3))
        setLoading(false)
      })
      .catch(() => setLoading(false))

    api.getItemPrices().then(setPrices).catch(() => {})

    try {
      const token = getApiToken()
      if (token) {
        const uid = JSON.parse(atob(token.split('.')[1])).sub
        if (uid) {
          api.feedUserProfile(uid)
            .then(p => setIsDevUser(p.role === 'DEV' || p.role === 'ADMIN' || p.tag === 'DEV' || (p.allTags ?? []).some(t => t.tag === 'DEV')))
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
          const token = getApiToken()
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
      api.marketplaceGetTradesHistory(),
    ]).then(([inc, sent, hist]) => {
      setIncomingTrades(inc)
      setSentTrades(sent)
      setHistoryTrades(hist)
    }).catch(() => {})
      .finally(() => setTradesLoading(false))
  }, [])

  useEffect(() => {
    if (tab === 'shop') { fetchListings(); fetchMyActiveListings() }
    if (tab === 'trade') fetchTrades()
    if (tab === 'inventory') { fetchMyActiveListings(); refreshInventory() }
    if (tab === 'leaderboard' && !leaderboard) {
      setLeaderboardLoading(true)
      api.marketplaceLeaderboard()
        .then(d => setLeaderboard(d))
        .catch(() => {})
        .finally(() => setLeaderboardLoading(false))
    }
  }, [tab, fetchListings, fetchMyActiveListings, fetchTrades])

  // Scroll result card into view when a new single result appears
  useEffect(() => {
    if (result && !result.dismissed) {
      setTimeout(() => resultCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
    }
  }, [resultId]) // eslint-disable-line react-hooks/exhaustive-deps

  // 3-second mandatory hold for Legendary/Mythic unbox results
  useEffect(() => {
    if (!result || result.dismissed) { setDismissCountdown(0); return }
    const isHighRarity = result.won.rarity === 'Legendary' || result.won.rarity === 'Mythic'
    if (!isHighRarity) { setDismissCountdown(0); return }
    setDismissCountdown(2)
    const interval = setInterval(() => {
      setDismissCountdown(c => {
        if (c <= 1) { clearInterval(interval); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [resultId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function openProfile(userId: number) {
    setProfilePanelLoading(true); setProfilePanel(null)
    setProfileMarketGranting(false); setProfileMarketMsg('')
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

  async function doOpenBoxAPI(boxType: BoxType, quantity = 1): Promise<BoxResult | MultiBoxResult | null> {
    const boxDef = BOX_DEFS.find(b => b.type === boxType)
    if (!boxDef) return null
    const totalCost = boxDef.cost * quantity
    if (opening || !inv || inv.coins < totalCost) return null
    setOpening(boxType)
    try {
      const r = await api.marketplaceOpenBox(boxType, quantity)
      if (r.results) {
        // Multi-spin: just update coin balance; inventory refreshes on next load
        setInv(prev => prev ? { ...prev, coins: r.coins } : prev)
        return { coins: r.coins, results: r.results } as MultiBoxResult
      }
      // Single spin: update inventory optimistically
      setInv(prev => {
        if (!prev) return prev
        const next = { ...prev, coins: r.coins }
        if (r.won.type === 'name-color' && r.won.value) {
          const item: MarketplaceItem = { id: r.won.id, name: r.won.name ?? r.won.id, value: r.won.value, rarity: r.won.rarity, weight: 0 }
          next.ownedNameColors = prev.ownedNameColors.some(i => i.id === r.won.id) ? prev.ownedNameColors : [...prev.ownedNameColors, item]
        }
        if (r.won.type === 'pfp' && r.won.value) {
          const item: MarketplaceItem = { id: r.won.id, name: r.won.name ?? r.won.id, value: r.won.value, rarity: r.won.rarity, weight: 0 }
          next.ownedPfpEffects = prev.ownedPfpEffects.some(i => i.id === r.won.id) ? prev.ownedPfpEffects : [...prev.ownedPfpEffects, item]
        }
        if (r.won.type === 'tag' && r.won.tag) {
          const item: TagInventoryItem = { id: r.won.id, tag: r.won.tag, tagColor: r.won.tagColor ?? '#6B7280', rarity: r.won.rarity }
          next.ownedTags = (prev.ownedTags ?? []).some(i => i.id === r.won.id) ? (prev.ownedTags ?? []) : [...(prev.ownedTags ?? []), item]
        }
        return next
      })
      return r
    } catch {
      return null
    } finally {
      setOpening(null)
    }
  }

  async function handleOpenBox(boxType: BoxType, quantity = 1) {
    setResult(null)
    setMultiResult(null)
    const r = await doOpenBoxAPI(boxType, quantity)
    if (r) {
      if ('results' in r) {
        setMultiResult(r as MultiBoxResult)
      } else {
        setResult(r as BoxResult)
        setResultId(id => id + 1)
      }
    }
  }

  async function handleEquip(type: 'name-color' | 'pfp' | 'tag', itemId: string | null) {
    if (equipping || !inv) return
    setEquipping(type + (itemId ?? 'null'))
    try {
      await api.marketplaceEquip(type, itemId)
      setInv(prev => {
        if (!prev) return prev
        if (type === 'name-color') {
          return { ...prev, nameColor: itemId ? prev.ownedNameColors.find(i => i.id === itemId)?.value ?? null : null }
        }
        if (type === 'tag') {
          const owned = prev.ownedTags.find(t => t.id === itemId)
          return { ...prev, tag: owned?.tag ?? 'Student', tagColor: owned?.tagColor ?? 'grey' }
        }
        return { ...prev, pfpEffect: itemId ? prev.ownedPfpEffects.find(i => i.id === itemId)?.value ?? null : null }
      })
    } catch { /* ignore */ }
    finally { setEquipping(null) }
  }

  async function doQuicksell(itemType: 'tag' | 'name-color' | 'pfp', itemId: string) {
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

  function handleQuicksell(itemType: 'tag' | 'name-color' | 'pfp', itemId: string) {
    if (!inv) return
    const allOfType = itemType === 'tag'
      ? (inv.ownedTags ?? [])
      : itemType === 'name-color'
        ? inv.ownedNameColors
        : inv.ownedPfpEffects
    const count = allOfType.filter((i: { id: string }) => i.id === itemId).length
    const first = allOfType.find((i: { id: string }) => i.id === itemId) as { id: string; rarity: string; tag?: string; name?: string } | undefined
    if (!first) return
    const rarity = first.rarity
    const itemName = itemType === 'tag' ? ((first as { tag?: string }).tag ?? itemId) : ((first as { name?: string }).name ?? itemId)
    const isLastCopy = count === 1
    const isRare = rarity === 'Legendary' || rarity === 'Mythic'
    const coins = ZERO_QUICKSELL_TAG_IDS.has((first as { tag?: string }).tag ?? '') ? 0 : (QUICKSELL_PRICES[rarity] ?? 5)

    if (isLastCopy || isRare) {
      setQuicksellConfirm({ itemType, itemId, itemName, rarity, coins, isLastCopy, isRare })
      return
    }
    void doQuicksell(itemType, itemId)
  }

  function computeDuplicates() {
    if (!inv) return []
    const result: Array<{ type: 'tag' | 'name-color' | 'pfp'; id: string; name: string; rarity: string; count: number; coinsEach: number }> = []

    const tagMap = new Map<string, number>()
    for (const t of (inv.ownedTags ?? [])) tagMap.set(t.id, (tagMap.get(t.id) ?? 0) + 1)
    for (const [id, cnt] of tagMap) {
      if (cnt > 1) {
        const t = (inv.ownedTags ?? []).find(x => x.id === id)!
        result.push({ type: 'tag', id, name: t.tag, rarity: t.rarity, count: cnt - 1, coinsEach: ZERO_QUICKSELL_TAG_IDS.has(t.tag) ? 0 : (QUICKSELL_PRICES[t.rarity] ?? 5) })
      }
    }
    const colorMap = new Map<string, number>()
    for (const c of inv.ownedNameColors) colorMap.set(c.id, (colorMap.get(c.id) ?? 0) + 1)
    for (const [id, cnt] of colorMap) {
      if (cnt > 1) {
        const c = inv.ownedNameColors.find(x => x.id === id)!
        result.push({ type: 'name-color', id, name: c.name, rarity: c.rarity, count: cnt - 1, coinsEach: QUICKSELL_PRICES[c.rarity] ?? 5 })
      }
    }
    const pfpMap = new Map<string, number>()
    for (const p of inv.ownedPfpEffects) pfpMap.set(p.id, (pfpMap.get(p.id) ?? 0) + 1)
    for (const [id, cnt] of pfpMap) {
      if (cnt > 1) {
        const p = inv.ownedPfpEffects.find(x => x.id === id)!
        result.push({ type: 'pfp', id, name: p.name, rarity: p.rarity, count: cnt - 1, coinsEach: QUICKSELL_PRICES[p.rarity] ?? 5 })
      }
    }
    return result
  }

  function handleSellAllDuplicatesClick() {
    const dups = computeDuplicates()
    if (dups.length === 0) return
    const totalCoins = dups.reduce((s, d) => s + d.count * d.coinsEach, 0)
    const hasRare = dups.some(d => d.rarity === 'Legendary' || d.rarity === 'Mythic')
    setDupExcluded(new Set())
    setSellDupsConfirm({ items: dups, totalCoins, hasRare })
  }

  async function handleSellAllDuplicatesConfirm() {
    if (sellingDups || !sellDupsConfirm) return
    setSellingDups(true)
    try {
      await api.marketplaceQuicksellDuplicates(Array.from(dupExcluded))
      setSellDupsConfirm(null)
      setDupExcluded(new Set())
      refreshInventory()
    } catch { /* ignore */ }
    finally { setSellingDups(false) }
  }

  async function handleDevGrant(grantType: 'coins' | 'name-color' | 'pfp' | 'tag') {
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
        const r = await api.marketplaceAdminGrant({ type: grantType, itemId: devItemId.trim() })
        if (grantType === 'tag') {
          setDevMsg(`✓ Granted tag: ${r.granted?.tag ?? devItemId}`)
        } else {
          setDevMsg(`✓ Granted: ${r.granted?.name ?? devItemId}`)
          refreshInventory()
        }
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
  const tradeInvQ = tradeInvSearch.trim().toLowerCase()
  const tradeMyQ = tradeMySearch.trim().toLowerCase()
  const filteredTradeTargetTags = tradeTarget
    ? tradeTarget.tags.filter(t => !NON_TRADEABLE_TAG_IDS.has(t.tag) && !NON_TRADEABLE_TAG_IDS.has(t.id) && (!tradeInvQ || t.tag.toLowerCase().includes(tradeInvQ)))
    : []
  const filteredTradeTargetColors = tradeTarget
    ? tradeTarget.nameColors.filter(c => !tradeInvQ || c.name.toLowerCase().includes(tradeInvQ))
    : []
  const filteredTradeTargetPfp = tradeTarget
    ? tradeTarget.pfpEffects.filter(p => !tradeInvQ || p.name.toLowerCase().includes(tradeInvQ))
    : []

  function renderInventoryItem(
    item: { id: string; name?: string; tag?: string; tagColor?: string; value?: string; rarity: string },
    type: 'tag' | 'name-color' | 'pfp',
    isEquipped: boolean,
    count = 1,
  ) {
    const itemKey = `${type}:${item.id}`
    const isNonTradeable = type === 'tag' && (NON_TRADEABLE_TAG_IDS.has(item.id) || NON_TRADEABLE_TAG_IDS.has(item.tag ?? ''))
    const isListed = myListedIds.has(itemKey)
    const listing = myActiveListings.find(l => l.itemType === type && l.itemId === item.id)
    const isListingThis = listingItem?.type === type && listingItem?.id === item.id
    const sellPrice = ZERO_QUICKSELL_TAG_IDS.has(item.tag ?? '') ? 0 : (QUICKSELL_PRICES[item.rarity] ?? 5)
    const isQS = quickselling === itemKey

    const rarityBorderColor = getRarityColor(item.rarity, item.id)

    return (
      <PriceTooltip key={item.id} price={prices[`${type}:${item.id}`]}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setPreviewItem({ type, id: item.id, name: item.name ?? item.tag ?? item.id, rarity: item.rarity, value: item.value, tagColor: item.tagColor })}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${rarityBorderColor}55`, background: `${rarityBorderColor}0A`, cursor: 'pointer', flexShrink: 0, transition: 'border-color 0.15s' }}
          title="Preview item"
        >
          {type === 'name-color' && (
            <span className={item.value === 'curse' ? 'name-curse' : ''} style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--border)', background: item.value === 'rainbow' ? 'linear-gradient(135deg,#ff6b6b,#ffd43b,#69db7c,#4dabf7)' : item.value === 'curse' ? undefined : item.value }} />
          )}
          {type === 'pfp' && (
            <div className={pfpClass(item.value)} style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', ...pfpStyle(item.value) }} />
          )}
          {type === 'tag' && (
            (item.tagColor === 'verified-yellow' || item.tagColor === 'verified-blue')
              ? <VerifiedBadge variant={item.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} />
              : <span
                  className={item.tag === 'VIP' ? 'tag-mythic' : item.tag === 'GOAT' ? 'tag-god' : item.tag === 'DEV' ? 'tag-rainbow' : item.tagColor === 'curse' ? 'tag-curse' : ''}
                  style={item.tagColor === 'curse'
                    ? { fontSize: 11, fontWeight: 800, padding: '1px 3px', borderRadius: 4, border: '1.5px solid #ff0000' }
                    : { fontSize: 13, fontWeight: 700, color: (item.tag === 'VIP' || item.tag === 'GOAT' || item.tag === 'DEV') ? undefined : item.tagColor ?? '#6B7280' }}
                >{truncateTag(item.tag ?? '')}</span>
          )}
        </button>
        {type !== 'tag' && (
          <span className={item.value === 'rainbow' ? 'name-rainbow' : item.value === 'curse' ? 'name-curse' : ''} style={{ flex: 1, fontSize: 13, fontWeight: 600, ...(type === 'name-color' && item.value !== 'rainbow' && item.value !== 'curse' ? { color: item.value } : { color: 'var(--text)' }) }}>
            {item.name ?? item.tag}
          </span>
        )}
        {type === 'tag' && (
          (item.tagColor === 'verified-yellow' || item.tagColor === 'verified-blue')
            ? <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7 }}>
                <VerifiedBadge variant={item.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} />
                <span style={{ fontSize: 13, fontWeight: 700, color: item.tagColor === 'verified-yellow' ? '#EAB308' : '#1D9BF0' }}>
                  {item.tagColor === 'verified-yellow' ? 'Verified' : 'Verified (Blue)'}
                </span>
              </span>
            : <span
                className={item.tag === 'VIP' ? 'tag-mythic' : item.tag === 'GOAT' ? 'tag-god' : item.tag === 'DEV' ? 'tag-rainbow' : item.tagColor === 'curse' ? 'tag-curse' : ''}
                style={item.tagColor === 'curse'
                  ? { flex: 1, fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '2px 7px', borderRadius: 4, border: '1.5px solid #ff0000', display: 'inline-block', maxWidth: 'max-content' }
                  : { flex: 1, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: (item.tag === 'VIP' || item.tag === 'GOAT' || item.tag === 'DEV') ? undefined : item.tagColor ?? '#6B7280' }}
              >{item.tag}</span>
        )}
        <RarityBadge rarity={item.rarity} itemId={item.id} />
        {count > 1 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 99, padding: '1px 7px' }}>x{count}</span>
        )}

        {isListed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}><CoinIcon size={11} />{listing?.price}</span>
            {/* If user still has an unlisted copy, let them equip it */}
            {count >= 1 && (
              <button
                onClick={() => void handleEquip(type, isEquipped ? null : item.id)}
                disabled={!!equipping}
                style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${isEquipped ? 'var(--border)' : 'var(--primary)'}`, background: isEquipped ? 'var(--surface-2)' : 'transparent', color: isEquipped ? 'var(--text-muted)' : 'var(--primary)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                {isEquipped ? 'Unequip' : 'Equip'}
              </button>
            )}
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
            <button
              onClick={() => void handleEquip(type, isEquipped ? null : item.id)}
              disabled={!!equipping}
              style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${isEquipped ? 'var(--border)' : 'var(--primary)'}`, background: isEquipped ? 'var(--surface-2)' : 'transparent', color: isEquipped ? 'var(--text-muted)' : 'var(--primary)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              {isEquipped ? 'Unequip' : 'Equip'}
            </button>
            {!isNonTradeable && (
              <button
                onClick={() => {
                  setListingItem({ type, id: item.id, name: item.name ?? item.tag ?? item.id })
                  setListingPrice('100'); setListingMsg('')
                }}
                style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                List
              </button>
            )}
            <button
              onClick={() => handleQuicksell(type, item.id)}
              disabled={isQS}
              style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid #EAB30855', background: 'transparent', color: '#EAB308', fontSize: 11, fontWeight: 700, cursor: isQS ? 'not-allowed' : 'pointer', opacity: isQS ? 0.6 : 1 }}
            >
              {isQS ? '…' : <><CoinIcon size={11} style={{ marginRight: 2 }} />{sellPrice}</>}
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
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 2 }}>fee: <CoinIcon size={11} />{Math.floor((parseInt(listingPrice) || 0) * 0.1)}</span>
            <button onClick={() => void handleCreateListing()} disabled={listingBusy}
              style={{ padding: '4px 10px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: '#FFFFFF', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
              {listingBusy ? '…' : 'Confirm'}
            </button>
            <button onClick={() => setListingItem(null)}
              style={{ padding: '4px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        )}
      </div>
      </PriceTooltip>
    )
  }

  function renderTradeItems(items: TradeItem[]) {
    const total = items.reduce((s, i) => s + (prices[`${i.type}:${i.id}`] ?? 0), 0)
    return (
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
          {items.map((item, i) => {
            return (
              <PriceTooltip key={i} price={prices[`${item.type}:${item.id}`]}>
              <ItemBox rarity={item.rarity} itemId={item.id} onClick={() => setPreviewItem({ type: item.type, id: item.id, name: item.name ?? item.tag ?? item.id, rarity: item.rarity, value: item.value, tagColor: item.tagColor })} style={{ cursor: 'pointer' }}>
                <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {item.type === 'tag' ? '🏷️' : item.type === 'name-color' ? '🎨' : '🖼️'}
                </span>
                {item.type === 'tag' ? (
                  <span className={item.tag === 'VIP' ? 'tag-mythic' : item.tag === 'GOAT' ? 'tag-god' : item.tag === 'DEV' ? 'tag-rainbow' : item.tagColor === 'curse' ? 'tag-curse' : ''} style={{ fontSize: 12, fontWeight: 800, color: (item.tag === 'GOAT' || item.tag === 'VIP' || item.tag === 'DEV' || item.tagColor === 'curse') ? undefined : item.tagColor ?? '#6B7280' }}>[{item.tag}]</span>
                ) : item.type === 'name-color' ? (
                  <span className={item.value === 'rainbow' ? 'name-rainbow' : item.value === 'curse' ? 'name-curse' : ''} style={{ fontSize: 12, fontWeight: 800, color: (item.value === 'rainbow' || item.value === 'curse') ? undefined : item.value }}>DUMMY</span>
                ) : (
                  <div className={pfpClass(item.value)} style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, ...pfpStyle(item.value) }} />
                )}
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{item.name ?? item.tag}</span>
                <RarityBadge rarity={item.rarity} itemId={item.id} />
              </ItemBox>
              </PriceTooltip>
            )
          })}
          {items.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nothing</span>}
        </div>
        {items.length > 0 && total > 0 && (
          <div style={{ fontSize: 11, color: '#EAB308', fontWeight: 700, marginTop: 5, display: 'flex', alignItems: 'center', gap: 3 }}><CoinIcon size={11} />Est. {total.toLocaleString()}</div>
        )}
      </div>
    )
  }

  if (streak !== null && streak < 3 && !isDevUser) {
    return (
      <div className="fade-up" style={{ maxWidth: 700, margin: '0 auto', paddingBottom: 40 }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>Spend your coins</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)' }}>Marketplace</h1>
        </div>
        <div className="ns-card" style={{ padding: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 52 }}>🔒</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>Marketplace Locked</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 320 }}>
            You need a <strong style={{ color: '#EAB308' }}>3-day login streak</strong> to access the Marketplace.
            Keep logging in every day to unlock it!
          </div>
          <div style={{ marginTop: 8, padding: '10px 20px', borderRadius: 99, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', fontSize: 13, fontWeight: 700, color: '#EAB308' }}>
            🔥 Current streak: {streak} / 3 day{streak === 1 ? '' : 's'}
          </div>
        </div>
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
          <div style={{ fontSize: 28, fontWeight: 800, color: '#EAB308', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 8 }}><CoinIcon size={24} />{inv?.coins?.toLocaleString() ?? 0}</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>+30 coins every day you log in</p>
        </div>
        {inv?.canClaimToday ? (
          <button onClick={handleDailyClaim} style={{ padding: '12px 20px', borderRadius: 10, border: 'none', background: '#EAB308', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Claim Daily <CoinIcon size={14} style={{ marginLeft: 4 }} />
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
        {(['boxes', 'shop', 'trade', 'inventory', 'leaderboard', 'catalog'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none',
            background: tab === t ? 'var(--surface-2)' : 'transparent',
            color: tab === t ? 'var(--text)' : 'var(--text-muted)',
            fontWeight: tab === t ? 700 : 500, fontSize: 13, cursor: 'pointer',
            borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
            position: 'relative' as const,
          }}>
            {t === 'boxes' && '🎰 Spins'}
            {t === 'shop' && '🏪 Shop'}
            {t === 'trade' && (
              <>🔄 Trade{pendingIncoming > 0 && tab !== 'trade' && (
                <span style={{ marginLeft: 4, background: '#EF4444', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '1px 5px' }}>{pendingIncoming}</span>
              )}</>
            )}
            {t === 'inventory' && '🎒 Inventory'}
            {t === 'leaderboard' && '🏆 Leaderboard'}
            {t === 'catalog' && '📖 Catalog'}
          </button>
        ))}
      </div>

      {/* ── BOXES TAB ── */}
      {tab === 'boxes' && (
        <>
          {result && !result.dismissed && (() => {
            const isRainbow  = result.won.value === 'rainbow'  // only for item preview rendering
            const isMythic   = result.won.rarity === 'Mythic'
            const isLegend   = result.won.rarity === 'Legendary'
            const cardClass  = `ns-card box-pop${isMythic ? ' box-rainbow box-mythic' : isLegend ? ' box-legendary' : ''}`
            const emoji      = isMythic ? '👑' : isLegend ? '🌟' : '🎉'
            const borderColor = getRarityColor(result.won.rarity, result.won.id)

            const itemPreview = result.won.type === 'tag' ? (
              (result.won.tagColor === 'verified-yellow' || result.won.tagColor === 'verified-blue')
                ? <div style={{ marginBottom: 4 }}><VerifiedBadge variant={result.won.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} size={64} /></div>
                : <div className={result.won.tag === 'VIP' ? 'tag-mythic' : result.won.tag === 'GOAT' ? 'tag-god' : result.won.tag === 'DEV' ? 'tag-rainbow' : result.won.tagColor === 'curse' ? 'tag-curse' : ''} style={{ fontSize: 22, fontWeight: 800, color: (result.won.tag === 'GOAT' || result.won.tag === 'VIP' || result.won.tag === 'DEV' || result.won.tagColor === 'curse') ? undefined : result.won.tagColor ?? '#6B7280', marginBottom: 4 }}>
                    [{result.won.tag}]
                  </div>
            ) : result.won.type === 'name-color' ? (
              <div className={isRainbow ? 'name-rainbow' : result.won.value === 'curse' ? 'name-curse' : ''} style={{ fontSize: 24, fontWeight: 800, color: (isRainbow || result.won.value === 'curse') ? undefined : result.won.value, marginBottom: 4 }}>
                {result.won.name}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div
                  className={pfpClass(result.won.value)}
                  style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#FFFFFF', ...pfpStyle(result.won.value) }}
                >✦</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{result.won.name}</div>
              </div>
            )

            // Fill effects replace the entire circle — show a pure div, no image
            const PFP_FILL_EFFECTS = new Set(['rainbow', 'glow-gold', 'frame-black', 'fill-white', 'unobtainable-curse'])
            const isPfpFill = result.won.type === 'pfp' && PFP_FILL_EFFECTS.has(result.won.value ?? '')
            const effectStyle = pfpStyle(result.won.type === 'pfp' ? result.won.value : undefined)
            const dummyImgStyle: React.CSSProperties = {
              ...(effectStyle.border     ? { border:     effectStyle.border }     : {}),
              ...(effectStyle.boxShadow  ? { boxShadow:  effectStyle.boxShadow }  : {}),
            }

            const dummyComment = (
              <div style={{ background: 'var(--surface-2,#1a1a1a)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 4px', border: '1px solid var(--border)', textAlign: 'left' as const }}>
                {isPfpFill ? (
                  <div
                    className={pfpClass(result.won.value)}
                    style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, ...effectStyle }}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={DUMMY_PFP}
                    alt="DUMMY"
                    className={result.won.type === 'pfp' ? pfpClass(result.won.value) : ''}
                    style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' as const, flexShrink: 0, ...dummyImgStyle }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' as const }}>
                    <span
                      className={result.won.type === 'name-color' && isRainbow ? 'name-rainbow' : result.won.type === 'name-color' && result.won.value === 'curse' ? 'name-curse' : ''}
                      style={{ fontSize: 13, fontWeight: 700, color: result.won.type === 'name-color' && !isRainbow && result.won.value !== 'curse' ? result.won.value : 'var(--text)' }}
                    >
                      DUMMY
                    </span>
                    {result.won.type === 'tag' && (
                      (result.won.tagColor === 'verified-yellow' || result.won.tagColor === 'verified-blue')
                        ? <VerifiedBadge variant={result.won.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} size={20} />
                        : <span className={result.won.tag === 'VIP' ? 'tag-mythic' : result.won.tag === 'GOAT' ? 'tag-god' : result.won.tag === 'DEV' ? 'tag-rainbow' : result.won.tagColor === 'curse' ? 'tag-curse' : ''} style={{ fontSize: 12, fontWeight: 700, color: (result.won.tag === 'GOAT' || result.won.tag === 'VIP' || result.won.tag === 'DEV' || result.won.tagColor === 'curse') ? undefined : (result.won.tagColor ?? '#6B7280') }}>
                            [{result.won.tag}]
                          </span>
                    )}
                    {result.won.type !== 'tag' && (
                      <span>[DUMMY]</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Here&apos;s a preview of your new item ✨</div>
                </div>
              </div>
            )

            const wonPrice = prices[`${result.won.type}:${result.won.id}`]
            return (
            <PriceTooltip price={wonPrice}>
            <div ref={resultCardRef} className={cardClass} onClick={() => { if (dismissCountdown === 0) setResult(r => r ? { ...r, dismissed: true } : r) }} style={{ padding: 24, marginBottom: 20, textAlign: 'center', border: `1px solid ${borderColor}55`, background: `${borderColor}08`, cursor: dismissCountdown > 0 ? 'default' : 'pointer' }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>{emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>You won!</div>
              {itemPreview}
              {dummyComment}
              <div style={{ fontSize: 13, color: getRarityColor(result.won.rarity, result.won.id), fontWeight: 700, marginBottom: wonPrice ? 4 : 16 }}>
                {result.won.rarity}{result.alreadyHad ? ' · already owned' : ''}
              </div>
              {wonPrice && (
                <div style={{ fontSize: 12, color: '#EAB308', fontWeight: 700, marginBottom: 16 }}>
                  <CoinIcon size={12} style={{ marginRight: 3 }} />Est. {wonPrice.toLocaleString()}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {result.won.type !== 'tag' && (
                  <button
                    onClick={() => void handleEquip(result.won.type === 'name-color' ? 'name-color' : 'pfp', result.won.id)}
                    style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#FFFFFF', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  >
                    Equip Now
                  </button>
                )}
                <button
                  onClick={() => { if (dismissCountdown === 0) setResult(r => r ? { ...r, dismissed: true } : r) }}
                  disabled={dismissCountdown > 0}
                  style={{ padding: '10px 20px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: dismissCountdown > 0 ? getRarityColor(result.won.rarity, result.won.id) : 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: dismissCountdown > 0 ? 'not-allowed' : 'pointer', opacity: dismissCountdown > 0 ? 0.8 : 1, transition: 'all 0.3s' }}
                >
                  {dismissCountdown > 0 ? `⏳ ${dismissCountdown}s` : 'Nice!'}
                </button>
              </div>
            </div>
            </PriceTooltip>
            )
          })()}

          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 12 }}>Spin — spend coins to unlock rewards</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {BOX_DEFS.map(box => {
              const isHovered = hoveredBox === box.type
              return (
                <div key={box.type} className="ns-card"
                  onMouseEnter={() => setHoveredBox(box.type)}
                  onMouseLeave={() => setHoveredBox(null)}
                  style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
                  <BoxCardPreview boxType={box.type} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{box.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{box.desc}</div>
                  <button onClick={() => setSpinnerBox(box.type)}
                    disabled={!inv || inv.coins < box.cost || !!spinnerBox}
                    style={{ width: '100%', padding: '10px 0', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#060D10', fontWeight: 700, fontSize: 13, marginTop: 4, cursor: inv && inv.coins >= box.cost && !spinnerBox ? 'pointer' : 'not-allowed', opacity: !inv || inv.coins < box.cost ? 0.45 : 1 }}>
                    Spin — <CoinIcon size={13} style={{ margin: '0 3px' }} />{box.cost}
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
              User Listings — sorted by value
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {listings.map(listing => {
                const isMine = myActiveListings.some(l => l.id === listing.id)
                const msg = buyMsg?.id === listing.id ? buyMsg.msg : null
                const rarityColor = getRarityColor(listing.itemRarity, listing.itemId)
                const canAfford = !!inv && inv.coins >= listing.price
                return (
                  <PriceTooltip key={listing.id} price={prices[`${listing.itemType}:${listing.itemId}`]}>
                  <div className="ns-card" style={{ padding: '12px 12px 10px', display: 'flex', flexDirection: 'column', gap: 8, border: `1px solid ${rarityColor}33`, borderTop: `3px solid ${rarityColor}` }}>
                    {/* Icon + preview button */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <button onClick={() => setPreviewItem({ type: listing.itemType as 'tag' | 'name-color' | 'pfp', id: listing.itemId, name: listing.itemName, rarity: listing.itemRarity, value: listing.itemValue })} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} title="Preview item">
                        <ItemIcon item={{ type: listing.itemType, itemValue: listing.itemValue, itemType: listing.itemType, itemId: listing.itemId }} />
                      </button>
                      <RarityBadge rarity={listing.itemRarity} itemId={listing.itemId} />
                    </div>
                    {/* Item name */}
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{listing.itemName}</div>
                    {/* Seller */}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                      by{' '}
                      <button
                        onClick={() => void openProfile(listing.seller.id)}
                        className={listing.seller.nameColor === 'rainbow' ? 'name-rainbow' : listing.seller.nameColor === 'curse' ? 'name-curse' : ''}
                        style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, ...(listing.seller.nameColor && listing.seller.nameColor !== 'rainbow' && listing.seller.nameColor !== 'curse' ? { color: listing.seller.nameColor } : { color: 'var(--text)' }) }}
                      >
                        {listing.seller.name ?? 'Unknown'}
                      </button>
                    </div>
                    {/* Price + action */}
                    <div style={{ marginTop: 'auto' as const, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 15, fontWeight: 800, color: '#EAB308' }}>
                        <CoinIcon size={13} />{listing.price.toLocaleString()}
                      </div>
                      {msg ? (
                        <div style={{ fontSize: 10, color: msg.startsWith('✓') ? '#22C55E' : '#EF4444', fontWeight: 700 }}>{msg}</div>
                      ) : isMine ? (
                        <button onClick={() => void handleCancelListing(listing.id)} disabled={cancellingListing === listing.id}
                          style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid #EF4444', background: 'transparent', color: '#EF4444', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          {cancellingListing === listing.id ? '…' : 'Delist'}
                        </button>
                      ) : (
                        <button
                          onClick={() => void handleBuyListing(listing.id)}
                          disabled={!!buyingId || !canAfford}
                          style={{ padding: '4px 10px', borderRadius: 7, border: 'none', background: !canAfford ? 'var(--surface-2)' : 'var(--primary)', color: !canAfford ? 'var(--text-muted)' : '#060D10', fontWeight: 700, fontSize: 11, cursor: !canAfford ? 'not-allowed' : 'pointer', opacity: !canAfford ? 0.5 : 1 }}>
                          {buyingId === listing.id ? '…' : 'Buy'}
                        </button>
                      )}
                    </div>
                  </div>
                  </PriceTooltip>
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
            {(['new', 'incoming', 'sent', 'history'] as TradeSubTab[]).map(st => (
              <button key={st} onClick={() => { setTradeSubTab(st); if (st !== 'new') fetchTrades() }}
                style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${tradeSubTab === st ? 'var(--primary)' : 'var(--border)'}`, background: tradeSubTab === st ? 'var(--primary)18' : 'transparent', color: tradeSubTab === st ? 'var(--primary)' : 'var(--text-muted)', fontWeight: tradeSubTab === st ? 700 : 500, fontSize: 13, cursor: 'pointer' }}>
                {st === 'new' && '+ New Trade'}
                {st === 'incoming' && `📥 Incoming${pendingIncoming > 0 ? ` (${pendingIncoming})` : ''}`}
                {st === 'sent' && '📤 Sent'}
                {st === 'history' && '📋 History'}
              </button>
            ))}
          </div>

          {/* New Trade */}
          {tradeSubTab === 'new' && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Sending a trade costs <strong style={{ color: '#EAB308', display: 'inline-flex', alignItems: 'center', gap: 3 }}><CoinIcon size={12} />5</strong>. Your offered items are locked until the trade is resolved.
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
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name ?? 'User'}</div>
                            {u.tag && <div className={u.tag === 'DEV' ? 'tag-rainbow' : u.tag === 'VIP' ? 'tag-mythic' : u.tag === 'GOAT' ? 'tag-god' : u.tagColor === 'curse' ? 'tag-curse' : ''} style={{ fontSize: 11, color: (u.tag === 'DEV' || u.tag === 'VIP' || u.tag === 'GOAT' || u.tagColor === 'curse') ? undefined : u.tagColor ?? '#6B7280', fontWeight: 700 }}>[{u.tag}]</div>}
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
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)' }} />
                    <div style={{ flex: 1 }}>
                      <div className={tradeTarget.user.nameColor === 'rainbow' ? 'name-rainbow' : tradeTarget.user.nameColor === 'curse' ? 'name-curse' : ''} style={{ fontSize: 13, fontWeight: 700, ...(tradeTarget.user.nameColor && tradeTarget.user.nameColor !== 'rainbow' && tradeTarget.user.nameColor !== 'curse' ? { color: tradeTarget.user.nameColor } : {}) }}>{tradeTarget.user.name ?? 'User'}</div>
                      {tradeTarget.user.tag && <div className={tradeTarget.user.tag === 'DEV' ? 'tag-rainbow' : tradeTarget.user.tag === 'VIP' ? 'tag-mythic' : tradeTarget.user.tag === 'GOAT' ? 'tag-god' : tradeTarget.user.tagColor === 'curse' ? 'tag-curse' : ''} style={{ fontSize: 11, color: (tradeTarget.user.tag === 'DEV' || tradeTarget.user.tag === 'GOAT' || tradeTarget.user.tag === 'VIP' || tradeTarget.user.tagColor === 'curse') ? undefined : tradeTarget.user.tagColor ?? '#6B7280', fontWeight: 700 }}>[{tradeTarget.user.tag}]</div>}
                    </div>
                    <button onClick={() => { setTradeTarget(null); setSelectedOffer([]); setSelectedRequest([]) }}
                      style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                      Change
                    </button>
                  </div>

                  {/* Search their inventory */}
                  <input
                    className="ns-input"
                    style={{ width: '100%', height: 34, fontSize: 12, marginBottom: 12, boxSizing: 'border-box' as const }}
                    placeholder="Search their inventory…"
                    value={tradeInvSearch}
                    onChange={e => setTradeInvSearch(e.target.value)}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    {/* Their inventory — what you want */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-muted)', marginBottom: 10 }}>
                        Their Items — tap to request
                      </div>
                      {filteredTradeTargetTags.length === 0 && filteredTradeTargetColors.length === 0 && filteredTradeTargetPfp.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 12 }}>{tradeInvQ ? 'No matching items' : 'No tradeable items'}</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {filteredTradeTargetTags.length > 0 && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)', marginTop: 2 }}>🏷️ Tags</div>}
                          {filteredTradeTargetTags.map(t => {
                            const item: TradeItem = { type: 'tag', id: t.id, tag: t.tag, tagColor: t.tagColor, rarity: t.rarity }
                            const sel = selectedRequest.some(i => i.id === t.id && i.type === 'tag')
                            return (
                              <PriceTooltip key={t.id} price={prices[`tag:${t.id}`]}>
                              <ItemBox rarity={t.rarity} itemId={t.id} style={{ cursor: 'pointer', border: `1px solid ${sel ? 'var(--primary)' : 'var(--border)'}`, background: sel ? 'var(--primary)12' : 'var(--surface-2)' }} onClick={() => toggleRequest(item)}>
                                <span className={t.tag === 'VIP' ? 'tag-mythic' : t.tag === 'GOAT' ? 'tag-god' : t.tag === 'DEV' ? 'tag-rainbow' : t.tagColor === 'curse' ? 'tag-curse' : ''} style={{ fontSize: 13, fontWeight: 800, color: (t.tag === 'GOAT' || t.tag === 'VIP' || t.tag === 'DEV' || t.tagColor === 'curse') ? undefined : t.tagColor }}>[{t.tag}]</span>
                                <RarityBadge rarity={t.rarity} itemId={t.id} />
                                {sel && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
                              </ItemBox>
                              </PriceTooltip>
                            )
                          })}
                          {filteredTradeTargetColors.length > 0 && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)', marginTop: 4 }}>🎨 Name Colors</div>}
                          {filteredTradeTargetColors.map(c => {
                            const item: TradeItem = { type: 'name-color', id: c.id, name: c.name, value: c.value, rarity: c.rarity }
                            const sel = selectedRequest.some(i => i.id === c.id && i.type === 'name-color')
                            return (
                              <PriceTooltip key={c.id} price={prices[`name-color:${c.id}`]}>
                              <ItemBox rarity={c.rarity} itemId={c.id} style={{ cursor: 'pointer', border: `1px solid ${sel ? 'var(--primary)' : 'var(--border)'}`, background: sel ? 'var(--primary)12' : 'var(--surface-2)' }} onClick={() => toggleRequest(item)}>
                                <span className={c.value === 'rainbow' ? 'name-rainbow' : c.value === 'curse' ? 'name-curse' : ''} style={{ fontSize: 13, fontWeight: 800, color: (c.value === 'rainbow' || c.value === 'curse') ? undefined : c.value, flexShrink: 0 }}>DUMMY</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{c.name}</span>
                                <RarityBadge rarity={c.rarity} itemId={c.id} />
                                {sel && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
                              </ItemBox>
                              </PriceTooltip>
                            )
                          })}
                          {filteredTradeTargetPfp.length > 0 && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)', marginTop: 4 }}>🖼️ PFP Effects</div>}
                          {filteredTradeTargetPfp.map(p => {
                            const item: TradeItem = { type: 'pfp', id: p.id, name: p.name, value: p.value, rarity: p.rarity }
                            const sel = selectedRequest.some(i => i.id === p.id && i.type === 'pfp')
                            return (
                              <PriceTooltip key={p.id} price={prices[`pfp:${p.id}`]}>
                              <ItemBox rarity={p.rarity} itemId={p.id} style={{ cursor: 'pointer', border: `1px solid ${sel ? 'var(--primary)' : 'var(--border)'}`, background: sel ? 'var(--primary)12' : 'var(--surface-2)' }} onClick={() => toggleRequest(item)}>
                                <div className={pfpClass(p.value)} style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, ...pfpStyle(p.value) }} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                                <RarityBadge rarity={p.rarity} itemId={p.id} />
                                {sel && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
                              </ItemBox>
                              </PriceTooltip>
                            )
                          })}
                          {selectedRequest.length > 0 && (() => {
                            const t = selectedRequest.reduce((s, i) => s + (prices[`${i.type}:${i.id}`] ?? 0), 0)
                            return t > 0 ? (
                              <div style={{ fontSize: 11, color: '#EAB308', fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                                <CoinIcon size={11} style={{ marginRight: 3 }} />Selected: {t.toLocaleString()}
                              </div>
                            ) : null
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Your inventory — what you offer */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-muted)', marginBottom: 6 }}>
                        Your Items — tap to offer
                      </div>
                      <input
                        className="ns-input"
                        style={{ width: '100%', height: 30, fontSize: 11, marginBottom: 8, boxSizing: 'border-box' as const, padding: '0 10px' }}
                        placeholder="Search your items…"
                        value={tradeMySearch}
                        onChange={e => setTradeMySearch(e.target.value)}
                      />
                      {(!inv || ((inv.ownedTags ?? []).length === 0 && inv.ownedNameColors.length === 0 && inv.ownedPfpEffects.length === 0)) ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 12 }}>No items to offer</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {(inv?.ownedTags ?? []).filter(t => !myListedIds.has(`tag:${t.id}`) && !NON_TRADEABLE_TAG_IDS.has(t.tag) && !NON_TRADEABLE_TAG_IDS.has(t.id) && (!tradeMyQ || t.tag.toLowerCase().includes(tradeMyQ))).length > 0 && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)', marginTop: 2 }}>🏷️ Tags</div>}
                          {(inv?.ownedTags ?? []).filter(t => !myListedIds.has(`tag:${t.id}`) && !NON_TRADEABLE_TAG_IDS.has(t.tag) && !NON_TRADEABLE_TAG_IDS.has(t.id) && (!tradeMyQ || t.tag.toLowerCase().includes(tradeMyQ))).map(t => {
                            const item: TradeItem = { type: 'tag', id: t.id, tag: t.tag, tagColor: t.tagColor, rarity: t.rarity }
                            const sel = selectedOffer.some(i => i.id === t.id && i.type === 'tag')
                            return (
                              <PriceTooltip key={t.id} price={prices[`tag:${t.id}`]}>
                              <ItemBox rarity={t.rarity} itemId={t.id} style={{ cursor: 'pointer', border: `1px solid ${sel ? '#22C55E' : 'var(--border)'}`, background: sel ? '#22C55E12' : 'var(--surface-2)' }} onClick={() => toggleOffer(item)}>
                                <span className={t.tag === 'VIP' ? 'tag-mythic' : t.tag === 'GOAT' ? 'tag-god' : t.tag === 'DEV' ? 'tag-rainbow' : t.tagColor === 'curse' ? 'tag-curse' : ''} style={{ fontSize: 13, fontWeight: 800, color: (t.tag === 'GOAT' || t.tag === 'VIP' || t.tag === 'DEV' || t.tagColor === 'curse') ? undefined : t.tagColor }}>[{t.tag}]</span>
                                <RarityBadge rarity={t.rarity} itemId={t.id} />
                                {sel && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
                              </ItemBox>
                              </PriceTooltip>
                            )
                          })}
                          {(inv?.ownedNameColors ?? []).filter(c => !myListedIds.has(`name-color:${c.id}`) && (!tradeMyQ || c.name.toLowerCase().includes(tradeMyQ))).length > 0 && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)', marginTop: 4 }}>🎨 Name Colors</div>}
                          {(inv?.ownedNameColors ?? []).filter(c => !myListedIds.has(`name-color:${c.id}`) && (!tradeMyQ || c.name.toLowerCase().includes(tradeMyQ))).map(c => {
                            const item: TradeItem = { type: 'name-color', id: c.id, name: c.name, value: c.value, rarity: c.rarity }
                            const sel = selectedOffer.some(i => i.id === c.id && i.type === 'name-color')
                            return (
                              <PriceTooltip key={c.id} price={prices[`name-color:${c.id}`]}>
                              <ItemBox rarity={c.rarity} itemId={c.id} style={{ cursor: 'pointer', border: `1px solid ${sel ? '#22C55E' : 'var(--border)'}`, background: sel ? '#22C55E12' : 'var(--surface-2)' }} onClick={() => toggleOffer(item)}>
                                <span className={c.value === 'rainbow' ? 'name-rainbow' : c.value === 'curse' ? 'name-curse' : ''} style={{ fontSize: 13, fontWeight: 800, color: (c.value === 'rainbow' || c.value === 'curse') ? undefined : c.value, flexShrink: 0 }}>DUMMY</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{c.name}</span>
                                <RarityBadge rarity={c.rarity} itemId={c.id} />
                                {sel && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
                              </ItemBox>
                              </PriceTooltip>
                            )
                          })}
                          {(inv?.ownedPfpEffects ?? []).filter(p => !myListedIds.has(`pfp:${p.id}`) && (!tradeMyQ || p.name.toLowerCase().includes(tradeMyQ))).length > 0 && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)', marginTop: 4 }}>🖼️ PFP Effects</div>}
                          {(inv?.ownedPfpEffects ?? []).filter(p => !myListedIds.has(`pfp:${p.id}`) && (!tradeMyQ || p.name.toLowerCase().includes(tradeMyQ))).map(p => {
                            const item: TradeItem = { type: 'pfp', id: p.id, name: p.name, value: p.value, rarity: p.rarity }
                            const sel = selectedOffer.some(i => i.id === p.id && i.type === 'pfp')
                            return (
                              <PriceTooltip key={p.id} price={prices[`pfp:${p.id}`]}>
                              <ItemBox rarity={p.rarity} itemId={p.id} style={{ cursor: 'pointer', border: `1px solid ${sel ? '#22C55E' : 'var(--border)'}`, background: sel ? '#22C55E12' : 'var(--surface-2)' }} onClick={() => toggleOffer(item)}>
                                <div className={pfpClass(p.value)} style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, ...pfpStyle(p.value) }} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                                <RarityBadge rarity={p.rarity} itemId={p.id} />
                                {sel && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
                              </ItemBox>
                              </PriceTooltip>
                            )
                          })}
                          {selectedOffer.length > 0 && (() => {
                            const t = selectedOffer.reduce((s, i) => s + (prices[`${i.type}:${i.id}`] ?? 0), 0)
                            return t > 0 ? (
                              <div style={{ fontSize: 11, color: '#EAB308', fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                                <CoinIcon size={11} style={{ marginRight: 3 }} />Selected: {t.toLocaleString()}
                              </div>
                            ) : null
                          })()}
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
                    style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#FFFFFF', fontWeight: 700, fontSize: 14, cursor: selectedOffer.length > 0 && selectedRequest.length > 0 ? 'pointer' : 'not-allowed', opacity: selectedOffer.length === 0 || selectedRequest.length === 0 ? 0.4 : 1 }}>
                    {sendingTrade ? 'Sending…' : <>Send Trade — <CoinIcon size={13} style={{ margin: '0 3px' }} />5</>}
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
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)' }} />
                          <div>
                            <span className={trade.sender.nameColor === 'rainbow' ? 'name-rainbow' : trade.sender.nameColor === 'curse' ? 'name-curse' : ''} style={{ fontSize: 13, fontWeight: 700, ...(trade.sender.nameColor && trade.sender.nameColor !== 'rainbow' && trade.sender.nameColor !== 'curse' ? { color: trade.sender.nameColor } : {}) }}>{trade.sender.name ?? 'User'}</span>
                            {trade.sender.tag && <span className={trade.sender.tag === 'DEV' ? 'tag-rainbow' : trade.sender.tag === 'VIP' ? 'tag-mythic' : trade.sender.tag === 'GOAT' ? 'tag-god' : trade.sender.tagColor === 'curse' ? 'tag-curse' : ''} style={{ fontSize: 11, color: (trade.sender.tag === 'DEV' || trade.sender.tag === 'GOAT' || trade.sender.tag === 'VIP' || trade.sender.tagColor === 'curse') ? undefined : trade.sender.tagColor ?? '#6B7280', fontWeight: 700, marginLeft: 6 }}>[{trade.sender.tag}]</span>}
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
                <div className="ns-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No pending sent trades</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {sentTrades.map(trade => {
                    const msg = tradeActionMsg?.id === trade.id ? tradeActionMsg.msg : null
                    return (
                      <div key={trade.id} className="ns-card" style={{ padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)' }} />
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>To: </span><span className={trade.receiver.nameColor === 'rainbow' ? 'name-rainbow' : trade.receiver.nameColor === 'curse' ? 'name-curse' : ''} style={{ fontSize: 13, fontWeight: 700, ...(trade.receiver.nameColor && trade.receiver.nameColor !== 'rainbow' && trade.receiver.nameColor !== 'curse' ? { color: trade.receiver.nameColor } : {}) }}>{trade.receiver.name ?? 'User'}</span>
                            {trade.receiver.tag && <span className={trade.receiver.tag === 'DEV' ? 'tag-rainbow' : trade.receiver.tag === 'VIP' ? 'tag-mythic' : trade.receiver.tag === 'GOAT' ? 'tag-god' : trade.receiver.tagColor === 'curse' ? 'tag-curse' : ''} style={{ fontSize: 11, color: (trade.receiver.tag === 'DEV' || trade.receiver.tag === 'GOAT' || trade.receiver.tag === 'VIP' || trade.receiver.tagColor === 'curse') ? undefined : trade.receiver.tagColor ?? '#6B7280', fontWeight: 700, marginLeft: 6 }}>[{trade.receiver.tag}]</span>}
                          </div>
                          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#EAB308', background: '#EAB30818', padding: '2px 8px', borderRadius: 99 }}>
                            PENDING
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
                        ) : (
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

          {tradeSubTab === 'history' && (
            <>
              {tradesLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
              ) : historyTrades.length === 0 ? (
                <div className="ns-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No completed trades yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {historyTrades.map(trade => (
                    <div key={trade.id} className="ns-card" style={{ padding: 16, borderLeft: '3px solid #22C55E' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 16 }}>✅</span>
                        <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                          {trade.sender.name ?? 'User'}
                          <span style={{ margin: '0 6px' }}>⇄</span>
                          {trade.receiver.name ?? 'User'}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {new Date(trade.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>{trade.sender.name ?? 'User'} gave</div>
                          {renderTradeItems(parseTradeItemsClient(trade.senderItems))}
                        </div>
                        <div style={{ fontSize: 16 }}>⇄</div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>{trade.receiver.name ?? 'User'} gave</div>
                          {renderTradeItems(parseTradeItemsClient(trade.receiverItems))}
                        </div>
                      </div>
                    </div>
                  ))}
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

          {(inv?.ownedTags ?? []).length === 0 && (inv?.ownedNameColors ?? []).length === 0 && (inv?.ownedPfpEffects ?? []).length === 0 && myActiveListings.length === 0 ? (
            <div className="ns-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Your inventory is empty — spin to get items
            </div>
          ) : (
            <>
              {Object.keys(prices).length > 0 && (() => {
                let worth = 0
                for (const t of (inv?.ownedTags ?? [])) worth += prices[`tag:${t.id}`] ?? 0
                for (const c of (inv?.ownedNameColors ?? [])) worth += prices[`name-color:${c.id}`] ?? 0
                for (const p of (inv?.ownedPfpEffects ?? [])) worth += prices[`pfp:${p.id}`] ?? 0
                return (
                  <div className="ns-card" style={{ padding: 16, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 4 }}>Est. Inventory Worth</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#EAB308', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 8 }}><CoinIcon size={20} />{worth.toLocaleString()}</div>
                    </div>
                    <div style={{ fontSize: 28 }}>💰</div>
                  </div>
                )
              })()}

              {(() => {
                const dups = computeDuplicates()
                if (dups.length === 0) return null
                const total = dups.reduce((s, d) => s + d.count * d.coinsEach, 0)
                return (
                  <div style={{ marginBottom: 14 }}>
                    <button
                      onClick={handleSellAllDuplicatesClick}
                      style={{ width: '100%', padding: '11px 0', borderRadius: 9, border: '1px solid #EAB30866', background: '#EAB30810', color: '#EAB308', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                    >
                      Sell All Duplicates — <CoinIcon size={13} style={{ margin: '0 3px' }} />{total.toLocaleString()}
                    </button>
                  </div>
                )
              })()}

              {((inv?.ownedTags ?? []).length > 0 || myActiveListings.some(l => l.itemType === 'tag')) && (
                <div className="ns-card" style={{ padding: 18, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>🏷️ Tags</div>
                  {groupById(byRarity(inv?.ownedTags ?? [])).map(t =>
                    renderInventoryItem({ id: t.id, tag: t.tag, tagColor: t.tagColor, rarity: t.rarity }, 'tag',
                      inv?.tag === t.tag && (
                        (t.tagColor === 'verified-yellow' || t.tagColor === 'verified-blue')
                          ? inv?.tagColor === t.tagColor
                          : true
                      ), t.count)
                  )}
                  {myActiveListings
                    .filter(l => l.itemType === 'tag' && !(inv?.ownedTags ?? []).some(t => t.id === l.itemId))
                    .filter((l, i, arr) => arr.findIndex(x => x.itemId === l.itemId) === i)
                    .map(l => renderInventoryItem({ id: l.itemId, tag: l.itemName, tagColor: l.itemValue, rarity: l.itemRarity }, 'tag', false, 0))
                  }
                </div>
              )}

              {((inv?.ownedNameColors ?? []).length > 0 || myActiveListings.some(l => l.itemType === 'name-color')) && (
                <div className="ns-card" style={{ padding: 18, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>🎨 Name Colors</div>
                  {groupById(byRarity(inv!.ownedNameColors)).map(item =>
                    renderInventoryItem({ id: item.id, name: item.name, value: item.value, rarity: item.rarity }, 'name-color', inv!.nameColor === item.value, item.count)
                  )}
                  {myActiveListings
                    .filter(l => l.itemType === 'name-color' && !(inv?.ownedNameColors ?? []).some(c => c.id === l.itemId))
                    .filter((l, i, arr) => arr.findIndex(x => x.itemId === l.itemId) === i)
                    .map(l => renderInventoryItem({ id: l.itemId, name: l.itemName, value: l.itemValue, rarity: l.itemRarity }, 'name-color', false, 0))
                  }
                </div>
              )}

              {((inv?.ownedPfpEffects ?? []).length > 0 || myActiveListings.some(l => l.itemType === 'pfp')) && (
                <div className="ns-card" style={{ padding: 18, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>🖼️ Profile Picture Effects</div>
                  {groupById(byRarity(inv!.ownedPfpEffects)).map(item =>
                    renderInventoryItem({ id: item.id, name: item.name, value: item.value, rarity: item.rarity }, 'pfp', inv!.pfpEffect === item.value, item.count)
                  )}
                  {myActiveListings
                    .filter(l => l.itemType === 'pfp' && !(inv?.ownedPfpEffects ?? []).some(p => p.id === l.itemId))
                    .filter((l, i, arr) => arr.findIndex(x => x.itemId === l.itemId) === i)
                    .map(l => renderInventoryItem({ id: l.itemId, name: l.itemName, value: l.itemValue, rarity: l.itemRarity }, 'pfp', false, 0))
                  }
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── LEADERBOARD TAB ── */}
      {tab === 'leaderboard' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {(['coins', 'streak', 'inventory'] as const).map(sub => (
              <button key={sub} onClick={() => setLeaderboardSub(sub)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid var(--border)', background: leaderboardSub === sub ? 'var(--primary)' : 'var(--surface-2)', color: leaderboardSub === sub ? '#060D10' : 'var(--text-muted)', fontWeight: leaderboardSub === sub ? 700 : 500, fontSize: 12, cursor: 'pointer' }}>
                {sub === 'coins' ? '💰 Richest' : sub === 'streak' ? '🔥 Streak' : '💼 Inventory'}
              </button>
            ))}
          </div>
          {leaderboardLoading ? (
            <div className="ns-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading leaderboard…</div>
          ) : !leaderboard ? (
            <div className="ns-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Failed to load leaderboard</div>
          ) : (() => {
            const rows: LeaderboardEntry[] = leaderboard[leaderboardSub] ?? []
            if (rows.length === 0) return (
              <div className="ns-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No data yet</div>
            )
            return (
              <div className="ns-card" style={{ padding: 0, overflow: 'hidden' }}>
                {rows.map((entry, i) => {
                  const isMe = currentUserId !== null && entry.id === currentUserId
                  return (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', background: isMe ? 'rgba(59,130,246,0.08)' : i === 0 ? '#EAB30808' : 'transparent' }}>
                    <span style={{ width: 32, textAlign: 'center', fontSize: i < 3 ? 18 : 12, fontWeight: 700, color: i === 0 ? '#EAB308' : i === 1 ? '#94A3B8' : i === 2 ? '#CD7F32' : 'var(--text-muted)', flexShrink: 0 }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${entry.rank}`}
                    </span>
                    <div className={pfpClass(entry.pfpEffect)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', flexShrink: 0, ...pfpStyle(entry.pfpEffect) }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => openProfile(entry.id)}
                          className={entry.nameColor === 'rainbow' ? 'name-rainbow' : entry.nameColor === 'curse' ? 'name-curse' : ''}
                          style={{ background: 'none', border: 'none', padding: 0, fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', ...(entry.nameColor && entry.nameColor !== 'rainbow' && entry.nameColor !== 'curse' ? { color: entry.nameColor } : { color: 'var(--text)' }) }}>
                          {entry.name ?? `User #${entry.id}`}
                        </button>
                        {isMe && <span style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.15)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>YOU</span>}
                      </div>
                      {entry.tag && (
                        entry.tagColor === 'verified-yellow' || entry.tagColor === 'verified-blue'
                          ? <VerifiedBadge variant={entry.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} size={14} />
                          : <span
                              className={entry.tag === 'DEV' ? 'tag-rainbow' : entry.tag === 'VIP' ? 'tag-mythic' : entry.tag === 'GOAT' ? 'tag-god' : entry.tagColor === 'curse' ? 'tag-curse' : ''}
                              style={{ fontSize: 11, fontWeight: 700, color: (entry.tag === 'DEV' || entry.tag === 'VIP' || entry.tag === 'GOAT' || entry.tagColor === 'curse') ? undefined : entry.tagColor ?? '#6B7280' }}
                            >[{entry.tag}]</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {leaderboardSub === 'coins' && <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#EAB308', fontWeight: 700, fontSize: 14 }}><CoinIcon size={14} />{entry.value.toLocaleString()}</div>}
                      {leaderboardSub === 'streak' && <div style={{ color: '#F97316', fontWeight: 700, fontSize: 14 }}>🔥 {entry.value.toLocaleString()}</div>}
                      {leaderboardSub === 'inventory' && <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#A855F7', fontWeight: 700, fontSize: 14 }}><CoinIcon size={14} />{entry.value.toLocaleString()}</div>}
                    </div>
                  </div>
                  )
                })}
              </div>
            )
          })()}
        </>
      )}

      {/* ── CATALOG TAB ── */}
      {tab === 'catalog' && (() => {
        const sections: Array<{ label: string; type: 'tag' | 'name-color' | 'pfp' }> = [
          { label: '🏷️ Tags', type: 'tag' },
          { label: '🎨 Name Colors', type: 'name-color' },
          { label: '🖼️ Profile Picture Effects', type: 'pfp' },
        ]
        const rarityOrder: Record<string, number> = { Mythic: 0, Legendary: 1, Epic: 2, Rare: 3, Uncommon: 4, Common: 5 }
        return (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, marginTop: -8 }}>Every single item — click any item to see who owns it.</p>
            {sections.map(sec => {
              const items = CATALOG_ALL_ITEMS
                .filter(i => i.type === sec.type)
                .sort((a, b) => (rarityOrder[a.rarity] ?? 9) - (rarityOrder[b.rarity] ?? 9))
              return (
                <div key={sec.type} className="ns-card" style={{ padding: 18, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{sec.label}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {items.map((item, i) => {
                      const borderColor = getRarityColor(item.rarity, item.id)
                      return (
                        <button
                          key={item.id}
                          onClick={() => setPreviewItem({ type: item.type, id: item.id, name: item.name, rarity: item.rarity, value: item.value, tagColor: item.tagColor })}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                        >
                          {/* Rarity-bordered icon box */}
                          <div style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${borderColor}55`, background: `${borderColor}0A`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {item.type === 'name-color' && (
                              <span style={{ width: 20, height: 20, borderRadius: '50%', display: 'inline-block', border: '1px solid var(--border)', background: item.value === 'rainbow' ? 'linear-gradient(135deg,#ff6b6b,#ffd43b,#69db7c,#4dabf7)' : item.value }} />
                            )}
                            {item.type === 'pfp' && (
                              <div className={pfpClass(item.value)} style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', ...pfpStyle(item.value) }} />
                            )}
                            {item.type === 'tag' && (
                              (item.tagColor === 'verified-yellow' || item.tagColor === 'verified-blue')
                                ? <VerifiedBadge variant={item.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} size={20} />
                                : item.tagColor === 'curse'
                                  ? <span
                                      className="tag-curse"
                                      style={{ fontSize: 11, fontWeight: 800, padding: '1px 3px', borderRadius: 4, border: '1.5px solid #ff0000' }}
                                    >CURSE</span>
                                  : <span
                                      className={item.name === 'VIP' ? 'tag-mythic' : item.name === 'GOAT' ? 'tag-god' : item.name === 'DEV' ? 'tag-rainbow' : ''}
                                      style={{ fontSize: 11, fontWeight: 800, color: (item.name === 'VIP' || item.name === 'GOAT' || item.name === 'DEV') ? undefined : item.tagColor ?? '#6B7280' }}
                                    >{truncateTag(item.name ?? '')}</span>
                            )}
                          </div>
                          {/* Name */}
                          <span
                            className={item.type === 'name-color' && item.value === 'rainbow' ? 'name-rainbow' : item.type === 'name-color' && item.value === 'curse' ? 'name-curse' : ''}
                            style={{ flex: 1, fontSize: 13, fontWeight: 600, color: item.type === 'name-color' && item.value && item.value !== 'rainbow' && item.value !== 'curse' ? item.value : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >{item.name}</span>
                          <RarityBadge rarity={item.rarity} itemId={item.id} />
                          {(item.id === 'GOAT' || item.name === 'GOAT') && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#EAB308', background: '#EAB30818', border: '1px solid #EAB30844', borderRadius: 99, padding: '2px 6px', flexShrink: 0 }}>Streak</span>
                          )}
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>→</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </>
        )
      })()}

      {/* ── Item Preview Modal ── */}
      {previewItem && (
        <ItemPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} onViewProfile={openProfile} />
      )}

      {/* ── Spin Wheel Modal ── */}
      {spinnerBox && (
        <SpinWheelModal
          box={BOX_DEFS.find(b => b.type === spinnerBox)!}
          inv={inv}
          onClose={() => setSpinnerBox(null)}
          onSpin={doOpenBoxAPI}
          onDone={r => {
            if ('results' in r) {
              setMultiResult(r as MultiBoxResult)
            } else {
              setResult(r as BoxResult)
              setResultId(id => id + 1)
            }
          }}
        />
      )}
      {multiResult && (
        <MultiSpinResultOverlay result={multiResult} onClose={() => setMultiResult(null)} />
      )}

      {/* ── Profile Panel ── */}
      {(profilePanel || profilePanelLoading) && createPortal(
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
                    style={{ width: 54, height: 54, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, flexShrink: 0, ...pfpStyle(profilePanel.pfpEffect), ...(profilePanel.avatarUrl ? { background: 'none', padding: 0, overflow: 'hidden' } : {}) }}
                  >
                    {profilePanel.avatarUrl
                      ? <img src={profilePanel.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : (profilePanel.name ?? 'Us').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className={profilePanel.nameColor === 'rainbow' ? 'name-rainbow' : profilePanel.nameColor === 'curse' ? 'name-curse' : ''} style={{ fontSize: 19, fontWeight: 800, marginBottom: 3, ...(profilePanel.nameColor && profilePanel.nameColor !== 'rainbow' && profilePanel.nameColor !== 'curse' ? { color: profilePanel.nameColor } : { color: 'var(--text)' }) }}>
                      {profilePanel.name ?? 'User'}
                    </div>
                    {profilePanel.tag && (
                      <span
                        className={profilePanel.tag === 'DEV' ? 'tag-rainbow' : profilePanel.tag === 'VIP' ? 'tag-mythic' : profilePanel.tag === 'GOAT' ? 'tag-god' : profilePanel.tagColor === 'curse' ? 'tag-curse' : ''}
                        style={profilePanel.tag === 'DEV' ? { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, border: '1px solid #ff6b6b', color: '#ff6b6b', background: 'rgba(255,107,107,0.12)' } : profilePanel.tag === 'VIP' ? { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4 } : profilePanel.tag === 'GOAT' ? { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, border: '1px solid #b8860b', color: '#b8860b', background: 'rgba(184,134,11,0.10)' } : profilePanel.tagColor === 'curse' ? { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, border: '1.5px solid #ff0000' } : { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, color: profilePanel.tagColor ?? 'var(--primary)', background: profilePanel.tagColor ? `${profilePanel.tagColor}22` : 'var(--primary-dim)', border: `1px solid ${profilePanel.tagColor ?? 'var(--primary)'}` }}
                      >
                        {profilePanel.tag}
                      </span>
                    )}

                  </div>
                </div>
                <div style={{ display: 'flex', gap: 20, padding: '14px 0', borderTop: '1px solid var(--border)', borderBottom: isDevUser ? 'none' : '1px solid var(--border)', marginBottom: 0 }}>
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

                {/* Send Coins — visible to all users on other profiles */}
                {currentUserId !== null && profilePanel.id !== currentUserId && (
                  <div style={{ borderTop: '1px solid rgba(234,179,8,0.2)', paddingTop: 14, marginTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#EAB308', marginBottom: 8 }}>🪙 Send Coins</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        className="ns-input"
                        style={{ flex: 1, height: 34, fontSize: 13 }}
                        type="number"
                        min="1"
                        placeholder="Amount"
                        value={profileSendAmount}
                        onChange={e => { setProfileSendAmount(e.target.value); setProfileSendMsg('') }}
                      />
                      <button
                        style={{ background: '#EAB308', color: '#000', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 700, fontSize: 13, cursor: profileSendBusy ? 'not-allowed' : 'pointer', opacity: profileSendBusy ? 0.6 : 1 }}
                        disabled={profileSendBusy}
                        onClick={async () => {
                          const amt = parseInt(profileSendAmount)
                          if (isNaN(amt) || amt <= 0 || profileSendBusy) return
                          setProfileSendBusy(true); setProfileSendMsg('')
                          try {
                            await api.sendCoins(profilePanel.id, amt)
                            setProfileSendMsg(`✓ Sent ${amt} coins`)
                            setProfileSendAmount('')
                          } catch (e: unknown) {
                            const msg = (e instanceof Error ? e.message : '') || 'Failed'
                            setProfileSendMsg(msg.includes('INSUFFICIENT') ? 'Not enough coins' : 'Failed')
                          } finally { setProfileSendBusy(false) }
                        }}
                      >{profileSendBusy ? '…' : 'Send'}</button>
                    </div>
                    {profileSendMsg && <div style={{ fontSize: 11, color: profileSendMsg.startsWith('✓') ? '#22C55E' : '#EF4444', fontWeight: 600, marginTop: 6 }}>{profileSendMsg}</div>}
                  </div>
                )}

                {isDevUser && (
                  <div style={{ borderTop: '1px solid rgba(255,107,107,0.25)', paddingTop: 14, marginTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#ff6b6b', marginBottom: 10 }}>🔧 DEV Actions</div>
                    <button
                      disabled={profileMarketGranting}
                      onClick={async () => {
                        setProfileMarketGranting(true); setProfileMarketMsg('')
                        try {
                          await api.adminGrantMarketAccess(profilePanel.id)
                          setProfileMarketMsg('✓ Market access granted')
                        } catch { setProfileMarketMsg('Failed') }
                        finally { setProfileMarketGranting(false) }
                      }}
                      style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#22C55E', color: '#000', fontWeight: 700, fontSize: 12, cursor: profileMarketGranting ? 'not-allowed' : 'pointer', opacity: profileMarketGranting ? 0.6 : 1 }}
                    >
                      {profileMarketGranting ? '…' : '🔓 Grant Market Access'}
                    </button>
                    {profileMarketMsg && (
                      <div style={{ fontSize: 11, color: profileMarketMsg.startsWith('✓') ? '#22C55E' : '#EF4444', fontWeight: 600, marginTop: 8 }}>{profileMarketMsg}</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>,
        document.body
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
              <select value={devType} onChange={e => { setDevType(e.target.value as 'name-color' | 'pfp' | 'tag'); setDevItemId('') }}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}>
                <option value="name-color">Name Color</option>
                <option value="pfp">PFP Effect</option>
                <option value="tag">Tag</option>
              </select>
              {devType === 'tag' ? (
                <select value={devItemId} onChange={e => setDevItemId(e.target.value)}
                  style={{ flex: 1, minWidth: 160, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}>
                  <option value="">Pick a tag…</option>
                  <optgroup label="— Staff Tags —">
                    <option value="dev">DEV (rainbow)</option>
                    <option value="admin">Admin (red)</option>
                    <option value="mod">MOD (blue)</option>
                    <option value="vip">VIP (purple)</option>
                    <option value="bot">BOT (gray)</option>
                  </optgroup>
                  <optgroup label="— Marketplace Tags —">
                    {SIM_ITEMS.tag.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </optgroup>
                </select>
              ) : (
                <input value={devItemId} onChange={e => setDevItemId(e.target.value)} placeholder="item-id  (e.g. rainbow)"
                  style={{ flex: 1, minWidth: 140, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }} />
              )}
              <button onClick={() => void handleDevGrant(devType)} disabled={devGranting || !devItemId.trim()}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#ff6b6b', color: '#fff', fontWeight: 700, fontSize: 13, cursor: devItemId.trim() ? 'pointer' : 'not-allowed', opacity: devItemId.trim() ? 1 : 0.5 }}>
                Grant Item
              </button>
            </div>
            {devMsg && <div style={{ fontSize: 12, color: devMsg.startsWith('✓') ? '#22C55E' : '#EF4444', fontWeight: 600 }}>{devMsg}</div>}

            {/* Grant Market Access to any user */}
            <div style={{ borderTop: '1px solid rgba(255,107,107,0.2)', paddingTop: 14, marginTop: 2 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#ff6b6b', marginBottom: 10 }}>🔓 Grant Market Access</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  value={devMarketUserId}
                  onChange={e => setDevMarketUserId(e.target.value)}
                  placeholder="User ID"
                  type="number"
                  style={{ width: 110, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}
                />
                <button
                  disabled={devMarketGranting || !devMarketUserId.trim()}
                  onClick={async () => {
                    const uid = parseInt(devMarketUserId)
                    if (isNaN(uid)) { setDevMarketMsg('Invalid user ID'); return }
                    setDevMarketGranting(true); setDevMarketMsg('')
                    try {
                      await api.adminGrantMarketAccess(uid)
                      setDevMarketMsg(`✓ Market access granted to user ${uid}`)
                    } catch { setDevMarketMsg('Failed') }
                    finally { setDevMarketGranting(false) }
                  }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#22C55E', color: '#000', fontWeight: 700, fontSize: 13, cursor: devMarketUserId.trim() ? 'pointer' : 'not-allowed', opacity: devMarketUserId.trim() ? 1 : 0.5 }}
                >
                  {devMarketGranting ? '…' : 'Grant'}
                </button>
              </div>
              {devMarketMsg && <div style={{ fontSize: 12, color: devMarketMsg.startsWith('✓') ? '#22C55E' : '#EF4444', fontWeight: 600, marginTop: 6 }}>{devMarketMsg}</div>}
            </div>

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
                    setResultId(id => id + 1)
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
              style={{ width: '100%', padding: '10px 0', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#FFFFFF', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              onClick={() => setCooldownPopup(null)}
            >
              Got it
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Quicksell confirmation modal (last copy / legendary / mythic) */}
      {quicksellConfirm && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setQuicksellConfirm(null)}
        >
          <div
            style={{ background: 'var(--surface)', border: '1px solid rgba(234,179,8,0.35)', borderRadius: 16, padding: 28, width: '90%', maxWidth: 360, textAlign: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>Are you sure?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
              {quicksellConfirm.isLastCopy && (
                <div style={{ fontSize: 13, color: '#EF4444', fontWeight: 600, background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: '8px 12px' }}>
                  This is your last copy of <strong>{quicksellConfirm.itemName}</strong>!
                </div>
              )}
              {quicksellConfirm.isRare && (
                <div style={{ fontSize: 13, color: getRarityColor(quicksellConfirm.rarity, quicksellConfirm.itemId), fontWeight: 600, background: `${getRarityColor(quicksellConfirm.rarity, quicksellConfirm.itemId)}12`, borderRadius: 8, padding: '8px 12px' }}>
                  This is a <strong>{quicksellConfirm.rarity}</strong> rarity item!
                </div>
              )}
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                You will receive <strong style={{ color: '#EAB308', display: 'inline-flex', alignItems: 'center', gap: 3 }}><CoinIcon size={12} />{quicksellConfirm.coins}</strong> for selling it.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  const { itemType, itemId } = quicksellConfirm
                  setQuicksellConfirm(null)
                  void doQuicksell(itemType, itemId)
                }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', background: '#EF4444', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Yes, Sell It
              </button>
              <button
                onClick={() => setQuicksellConfirm(null)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                No, Keep It
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Sell All Duplicates confirmation modal */}
      {sellDupsConfirm && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => !sellingDups && setSellDupsConfirm(null)}
        >
          <div
            style={{ background: 'var(--surface)', border: '1px solid rgba(234,179,8,0.35)', borderRadius: 16, padding: 24, width: '90%', maxWidth: 440 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Sell All Duplicates</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Keeps 1 copy of each item. Toggle any row to keep all copies of it.</div>

            {sellDupsConfirm.hasRare && (
              <div style={{ fontSize: 12, color: RARITY_COLOR['Legendary'], fontWeight: 600, background: `${RARITY_COLOR['Legendary']}12`, borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
                ⚠️ Some duplicates are Legendary or Mythic — consider opting out below!
              </div>
            )}

            <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {sellDupsConfirm.items.map(d => {
                const key = `${d.type}:${d.id}`
                const kept = dupExcluded.has(key)
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: kept ? 'var(--surface)' : 'var(--surface-2)', border: `1px solid ${kept ? 'var(--border)' : 'var(--border)'}`, opacity: kept ? 0.5 : 1, transition: 'opacity 0.15s' }}>
                    <span style={{ fontSize: 11 }}>{d.type === 'tag' ? '🏷️' : d.type === 'name-color' ? '🎨' : '🖼️'}</span>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)', textDecoration: kept ? 'line-through' : 'none' }}>{d.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: getRarityColor(d.rarity, d.id), background: `${getRarityColor(d.rarity, d.id)}18`, padding: '2px 6px', borderRadius: 99 }}>{d.rarity}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>×{d.count}</span>
                    {!kept && <span style={{ fontSize: 11, fontWeight: 700, color: '#EAB308', display: 'inline-flex', alignItems: 'center', gap: 2 }}><CoinIcon size={11} />{(d.count * d.coinsEach).toLocaleString()}</span>}
                    <button
                      onClick={() => setDupExcluded(prev => {
                        const next = new Set(prev)
                        if (next.has(key)) next.delete(key); else next.add(key)
                        return next
                      })}
                      style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, border: `1px solid ${kept ? 'var(--primary)' : '#6B728055'}`, background: kept ? 'var(--primary-dim)' : 'transparent', color: kept ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0 }}
                    >
                      {kept ? 'Keeping all' : 'Keep all'}
                    </button>
                  </div>
                )
              })}
            </div>

            {(() => {
              const activeItems = sellDupsConfirm.items.filter(d => !dupExcluded.has(`${d.type}:${d.id}`))
              const liveTotal = activeItems.reduce((s, d) => s + d.count * d.coinsEach, 0)
              const noneSelected = activeItems.length === 0
              return (
                <>
                  <div style={{ padding: '10px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: 16, textAlign: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Selling {activeItems.length} of {sellDupsConfirm.items.length} item type{sellDupsConfirm.items.length !== 1 ? 's' : ''} — </span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: noneSelected ? 'var(--text-muted)' : '#EAB308', display: 'inline-flex', alignItems: 'center', gap: 6 }}><CoinIcon size={16} />{liveTotal.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => void handleSellAllDuplicatesConfirm()}
                      disabled={sellingDups || noneSelected}
                      style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', background: noneSelected ? 'var(--surface-2)' : '#EAB308', color: noneSelected ? 'var(--text-muted)' : '#060D10', fontWeight: 700, fontSize: 13, cursor: (sellingDups || noneSelected) ? 'not-allowed' : 'pointer', opacity: sellingDups ? 0.6 : 1 }}
                    >
                      {sellingDups ? 'Selling…' : noneSelected ? 'Nothing to sell' : <>Sell — <CoinIcon size={13} style={{ margin: '0 3px' }} />{liveTotal.toLocaleString()}</>}
                    </button>
                    <button
                      onClick={() => { setSellDupsConfirm(null); setDupExcluded(new Set()) }}
                      disabled={sellingDups}
                      style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )
            })()}
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
