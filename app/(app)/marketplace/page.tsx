'use client'

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import CoinIcon from '../../../components/ui/CoinIcon'
import VerifiedBadge from '../../../components/ui/VerifiedBadge'
import { DevAdminPanel, ModPanel } from '../../../components/ui/DevAdminPanel'
import {
  api, ApiError, InventoryData, BoxResult, MarketplaceItem, TagInventoryItem,
  MarketplaceListing, TradeOffer, TradeItem, UserPublicInventory, FeedUserProfile,
  getApiToken, ItemSalePoint, ItemOwner, LeaderboardData, LeaderboardEntry,
  FeedPost,
} from '../../../lib/api'

// ── Tag helpers ───────────────────────────────────────────────────────────────
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

const AVATAR_BORDER_MAP: Record<string, string> = {
  'border-green': '#22C55E', 'border-blue': '#3B82F6', 'border-red': '#EF4444',
  'border-navy': '#1D4ED8', 'border-teal': '#14B8A6', 'border-orange': '#F97316',
  'border-violet': '#7C3AED', 'border-cyan': '#06B6D4', 'border-hotpink': '#EC4899',
  'border-gold': '#D97706', 'border-lime': '#84CC16',
  'border-yellow': '#EAB308', 'border-pink': '#F472B6', 'border-gray': '#6B7280',
  'border-brown': '#92400E', 'border-rose': '#F43F5E', 'border-sky': '#0EA5E9',
  'border-silver': '#C0C0C0',
}
const AVATAR_GLOW_MAP: Record<string, [string, string]> = {
  'glow-pink':   ['#EC4899', '#EC489955'],
  'glow-purple': ['#8B5CF6', '#8B5CF655'],
  'glow-blue':   ['#3B82F6', '#3B82F655'],
  'glow-orange': ['#F97316', '#F9731655'],
}
function avatarStyle(effect: string | null | undefined): React.CSSProperties {
  if (!effect) return {}
  if (effect === 'rainbow') return { background: '#ff0000', border: '3px solid #ff0000', boxShadow: '0 0 14px #ff000088', color: '#fff' }
  if (effect === 'glow-gold')           return {}
  if (effect === 'frame-black')         return {}
  if (effect === 'fill-white')          return {}
  if (effect === 'unobtainable-curse')  return {}
  if (AVATAR_BORDER_MAP[effect]) return { border: `2px solid ${AVATAR_BORDER_MAP[effect]}` }
  if (AVATAR_GLOW_MAP[effect]) return { border: `2px solid ${AVATAR_GLOW_MAP[effect][0]}`, boxShadow: `0 0 12px ${AVATAR_GLOW_MAP[effect][1]}` }
  return {}
}
function avatarClass(effect: string | null | undefined): string {
  if (effect === 'rainbow')           return 'avatar-rainbow'
  if (effect === 'glow-gold')         return 'avatar-gold-fill'
  if (effect === 'frame-black')       return 'avatar-void-fill'
  if (effect === 'fill-white')        return 'avatar-white-fill'
  if (effect === 'unobtainable-curse') return 'avatar-curse'
  return ''
}

type DropGroup = { rarity: string; pct: string; items: string[] }
type BoxType = 'cosmetics' | 'dev-curse'

// ── Box card cycling previews ──────────────────────────────────────────────────

type PreviewItemDef = { type: 'tag' | 'name-color' | 'avatar'; tag?: string; tagColor?: string; name?: string; value?: string; rarity: string }

const BOX_CYCLE_PREVIEWS: Record<string, PreviewItemDef[]> = {
  'cosmetics': [
    { type: 'tag',        tag: 'Valedictorian', tagColor: '#FFFFFF',  rarity: 'Legendary' },
    { type: 'name-color', name: 'Magenta',      value: '#C026D3',     rarity: 'Epic'      },
    { type: 'avatar',        name: 'Gold Fill',    value: 'glow-gold',   rarity: 'Legendary' },
    { type: 'tag',        tag: 'VIP',           tagColor: '#111111',  rarity: 'Mythic'    },
    { type: 'name-color', name: 'Rainbow RGB',  value: 'rainbow',     rarity: 'Mythic'    },
    { type: 'avatar',        name: 'Pink Glow',    value: 'glow-pink',   rarity: 'Epic'      },
    { type: 'tag',        tag: 'Ace',           tagColor: '#F97316',  rarity: 'Epic'      },
    { type: 'avatar',        name: 'Rainbow',      value: 'rainbow',     rarity: 'Mythic'    },
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
                className={tagCssClass(item.tag, item.tagColor)}
                style={isAnimatedTag(item.tag) ? { fontSize: 15, fontWeight: 900, padding: '5px 10px', borderRadius: 8 } : item.tagColor === 'curse' ? { fontSize: 14, fontWeight: 800, padding: '5px 10px', borderRadius: 8 } : {
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
        {item.type === 'avatar' && (
          <div
            className={avatarClass(item.value)}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 15, flexShrink: 0,
              ...avatarStyle(item.value),
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
      { rarity: 'Rare',      pct: '10.2%',  items: ['Tags · Name Colors · PFP Borders'] },
      { rarity: 'Epic',      pct: '3.95%',  items: ['Tags · Name Colors · PFP Glows'] },
      { rarity: 'Legendary', pct: '0.8%',   items: ['Tags · Name Colors · PFP Fills'] },
      { rarity: 'Mythic',    pct: '0.05%',  items: ['GOD · Verified · Rainbow'] },
    ],
  },
  {
    type: 'dev-curse', icon: '💀', label: "The Curse", desc: '1 coin · mostly Common · 0.001% chance at The Curse', cost: 1,
    drops: [
      { rarity: 'Common', pct: '99.997%', items: ['Learner', 'C Student', 'Bottom 100'] },
      { rarity: 'Curse',  pct: '0.001%',  items: ['The Curse'] },
      { rarity: 'Curse',  pct: '0.001%',  items: ['The Curse'] },
      { rarity: 'Curse',  pct: '0.001%',  items: ['The Curse'] },
    ],
  },
]

type SimItem = { id: string; label: string; rarity: string; type: 'tag' | 'name-color' | 'avatar'; tag?: string; tagColor?: string; value?: string; name?: string }
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
    { id: 'mastermind',     label: 'Valedictorian (Legendary)', rarity: 'Legendary', type: 'tag', tag: 'Valedictorian',   tagColor: '#FFFFFF' },
    { id: 'prodigy',        label: 'Prodigy (Legendary)',       rarity: 'Legendary', type: 'tag', tag: 'Prodigy',         tagColor: '#111111' },
    { id: 'god',            label: 'VIP (Mythic)',              rarity: 'Mythic',    type: 'tag', tag: 'VIP',             tagColor: '#111111' },
    { id: 'verified',      label: 'Verified ✓ Yellow (Mythic)', rarity: 'Mythic',   type: 'tag', tag: 'Verified',         tagColor: 'verified-yellow' },
    { id: 'verified-blue', label: 'Partner ✓ Blue (Mythic)',   rarity: 'Mythic',   type: 'tag', tag: 'Verified',         tagColor: 'verified-blue' },
  ],
  'name-color': [
    { id: 'forest-green',  label: 'Forest Green (Common)',    rarity: 'Common',    type: 'name-color', name: 'Forest Green',  value: '#15803D' },
    { id: 'navy-blue',     label: 'Navy Blue (Common)',       rarity: 'Common',    type: 'name-color', name: 'Navy Blue',      value: '#1D4ED8' },
    { id: 'hot-pink',      label: 'Hot Pink (Rare)',          rarity: 'Rare',      type: 'name-color', name: 'Hot Pink',       value: '#DB2777' },
    { id: 'electric-blue', label: 'Electric Blue (Epic)',     rarity: 'Epic',      type: 'name-color', name: 'Electric Blue',  value: '#2563EB' },
    { id: 'magenta',       label: 'Magenta (Epic)',           rarity: 'Epic',      type: 'name-color', name: 'Magenta',        value: '#C026D3' },
    { id: 'platinum',    label: 'Platinum (Legendary)',   rarity: 'Legendary', type: 'name-color', name: 'Platinum',     value: '#C0C0C0' },
    { id: 'black',         label: 'Black (Legendary)',        rarity: 'Legendary', type: 'name-color', name: 'Black',          value: '#111111' },
    { id: 'rainbow',       label: 'Rainbow RGB ✨ (Mythic)',  rarity: 'Mythic',    type: 'name-color', name: 'Rainbow RGB',    value: 'rainbow' },
  ],
  avatar: [
    { id: 'border-blue',    label: 'Blue Border (Common)',       rarity: 'Common',    type: 'avatar', name: 'Blue Border',      value: 'border-blue' },
    { id: 'border-red',     label: 'Red Border (Common)',        rarity: 'Common',    type: 'avatar', name: 'Red Border',       value: 'border-red' },
    { id: 'border-navy',    label: 'Navy Border (Common)',       rarity: 'Common',    type: 'avatar', name: 'Navy Border',      value: 'border-navy' },
    { id: 'border-teal',    label: 'Teal Border (Common)',       rarity: 'Common',    type: 'avatar', name: 'Teal Border',      value: 'border-teal' },
    { id: 'glow-purple',    label: 'Purple Glow (Common)',       rarity: 'Common',    type: 'avatar', name: 'Purple Glow',      value: 'glow-purple' },
    { id: 'border-yellow',  label: 'Yellow Border (Common)',     rarity: 'Common',    type: 'avatar', name: 'Yellow Border',    value: 'border-yellow' },
    { id: 'border-pink',    label: 'Pink Border (Common)',       rarity: 'Common',    type: 'avatar', name: 'Pink Border',      value: 'border-pink' },
    { id: 'border-gray',    label: 'Gray Border (Common)',       rarity: 'Common',    type: 'avatar', name: 'Gray Border',      value: 'border-gray' },
    { id: 'border-brown',   label: 'Brown Border (Common)',      rarity: 'Common',    type: 'avatar', name: 'Brown Border',     value: 'border-brown' },
    { id: 'border-orange',  label: 'Orange Border (Uncommon)',   rarity: 'Uncommon',  type: 'avatar', name: 'Orange Border',    value: 'border-orange' },
    { id: 'border-violet',  label: 'Violet Border (Uncommon)',   rarity: 'Uncommon',  type: 'avatar', name: 'Violet Border',    value: 'border-violet' },
    { id: 'border-cyan',    label: 'Cyan Border (Uncommon)',     rarity: 'Uncommon',  type: 'avatar', name: 'Cyan Border',      value: 'border-cyan' },
    { id: 'border-rose',    label: 'Rose Border (Uncommon)',     rarity: 'Uncommon',  type: 'avatar', name: 'Rose Border',      value: 'border-rose' },
    { id: 'border-sky',     label: 'Sky Border (Uncommon)',      rarity: 'Uncommon',  type: 'avatar', name: 'Sky Border',       value: 'border-sky' },
    { id: 'border-hotpink', label: 'Hot Pink Border (Rare)',     rarity: 'Rare',      type: 'avatar', name: 'Hot Pink Border',  value: 'border-hotpink' },
    { id: 'border-gold',    label: 'Gold Border (Rare)',         rarity: 'Rare',      type: 'avatar', name: 'Gold Border',      value: 'border-gold' },
    { id: 'border-lime',    label: 'Lime Border (Rare)',         rarity: 'Rare',      type: 'avatar', name: 'Lime Border',      value: 'border-lime' },
    { id: 'border-silver',  label: 'Silver Border (Rare)',       rarity: 'Rare',      type: 'avatar', name: 'Silver Border',    value: 'border-silver' },
    { id: 'glow-blue',      label: 'Blue Glow (Rare)',           rarity: 'Rare',      type: 'avatar', name: 'Blue Glow',        value: 'glow-blue' },
    { id: 'border-green',   label: 'Green Border (Epic)',        rarity: 'Epic',      type: 'avatar', name: 'Green Border',     value: 'border-green' },
    { id: 'glow-pink',      label: 'Pink Glow (Epic)',           rarity: 'Epic',      type: 'avatar', name: 'Pink Glow',        value: 'glow-pink' },
    { id: 'glow-orange',    label: 'Orange Glow (Epic)',         rarity: 'Epic',      type: 'avatar', name: 'Orange Glow',      value: 'glow-orange' },
    { id: 'glow-gold',      label: 'Gold Fill (Legendary)',      rarity: 'Legendary', type: 'avatar', name: 'Gold Fill',        value: 'glow-gold' },
    { id: 'frame-black',    label: 'Void Fill (Legendary)',      rarity: 'Legendary', type: 'avatar', name: 'Void Fill',        value: 'frame-black' },
    { id: 'fill-white',     label: 'White Fill (Legendary)',     rarity: 'Legendary', type: 'avatar', name: 'White Fill',       value: 'fill-white' },
    { id: 'rainbow',        label: 'Rainbow Animated ✨ (Mythic)', rarity: 'Mythic',  type: 'avatar', name: 'Rainbow Animated', value: 'rainbow' },
  ],
  'cosmetics': [
    { id: 'grinder',        label: 'Grinder (Common)',          rarity: 'Common',    type: 'tag',        tag: 'Grinder',        tagColor: '#6B7280' },
    { id: 'focused',        label: 'Focused (Common)',          rarity: 'Common',    type: 'tag',        tag: 'Focused',        tagColor: '#6B7280' },
    { id: 'scholar',        label: 'Scholar (Common)',          rarity: 'Common',    type: 'tag',        tag: 'Scholar',        tagColor: '#6B7280' },
    { id: 'curious',        label: 'Curious (Common)',          rarity: 'Common',    type: 'tag',        tag: 'Curious',        tagColor: '#6B7280' },
    { id: 'motivated',      label: 'Motivated (Common)',        rarity: 'Common',    type: 'tag',        tag: 'Motivated',      tagColor: '#6B7280' },
    { id: 'consistent',     label: 'Consistent (Common)',       rarity: 'Common',    type: 'tag',        tag: 'Consistent',     tagColor: '#6B7280' },
    { id: 'hardworker',     label: 'Hardworker (Common)',       rarity: 'Common',    type: 'tag',        tag: 'Hardworker',     tagColor: '#6B7280' },
    { id: 'determined',     label: 'Determined (Common)',       rarity: 'Common',    type: 'tag',        tag: 'Determined',     tagColor: '#6B7280' },
    { id: 'forest-green',   label: 'Forest Green (Common)',     rarity: 'Common',    type: 'name-color', name: 'Forest Green',  value: '#15803D' },
    { id: 'navy-blue',      label: 'Navy Blue (Common)',        rarity: 'Common',    type: 'name-color', name: 'Navy Blue',     value: '#1D4ED8' },
    { id: 'dark-red',       label: 'Dark Red (Common)',         rarity: 'Common',    type: 'name-color', name: 'Dark Red',      value: '#991B1B' },
    { id: 'slate-blue',     label: 'Slate Blue (Common)',       rarity: 'Common',    type: 'name-color', name: 'Slate Blue',    value: '#4338CA' },
    { id: 'teal',           label: 'Teal (Common)',             rarity: 'Common',    type: 'name-color', name: 'Teal',          value: '#0F766E' },
    { id: 'maroon',         label: 'Maroon (Common)',           rarity: 'Common',    type: 'name-color', name: 'Maroon',        value: '#7F1D1D' },
    { id: 'olive',          label: 'Olive (Common)',            rarity: 'Common',    type: 'name-color', name: 'Olive',         value: '#4D7C0F' },
    { id: 'brown',          label: 'Brown (Common)',            rarity: 'Common',    type: 'name-color', name: 'Brown',         value: '#92400E' },
    { id: 'steel',          label: 'Steel (Common)',            rarity: 'Common',    type: 'name-color', name: 'Steel',         value: '#64748B' },
    { id: 'midnight',       label: 'Midnight (Common)',         rarity: 'Common',    type: 'name-color', name: 'Midnight',      value: '#172554' },
    { id: 'border-blue',    label: 'Blue Border (Common)',      rarity: 'Common',    type: 'avatar',     name: 'Blue Border',   value: 'border-blue' },
    { id: 'border-red',     label: 'Red Border (Common)',       rarity: 'Common',    type: 'avatar',     name: 'Red Border',    value: 'border-red' },
    { id: 'border-navy',    label: 'Navy Border (Common)',      rarity: 'Common',    type: 'avatar',     name: 'Navy Border',   value: 'border-navy' },
    { id: 'border-teal',    label: 'Teal Border (Common)',      rarity: 'Common',    type: 'avatar',     name: 'Teal Border',   value: 'border-teal' },
    { id: 'glow-purple',    label: 'Purple Glow (Common)',      rarity: 'Common',    type: 'avatar',     name: 'Purple Glow',   value: 'glow-purple' },
    { id: 'border-yellow',  label: 'Yellow Border (Common)',    rarity: 'Common',    type: 'avatar',     name: 'Yellow Border', value: 'border-yellow' },
    { id: 'border-pink',    label: 'Pink Border (Common)',      rarity: 'Common',    type: 'avatar',     name: 'Pink Border',   value: 'border-pink' },
    { id: 'border-gray',    label: 'Gray Border (Common)',      rarity: 'Common',    type: 'avatar',     name: 'Gray Border',   value: 'border-gray' },
    { id: 'border-brown',   label: 'Brown Border (Common)',     rarity: 'Common',    type: 'avatar',     name: 'Brown Border',  value: 'border-brown' },
    { id: 'honors-student', label: 'Honors Student (Uncommon)', rarity: 'Uncommon',  type: 'tag',        tag: 'Honors Student', tagColor: '#3B82F6' },
    { id: 'ap-student',     label: 'AP Student (Uncommon)',     rarity: 'Uncommon',  type: 'tag',        tag: 'AP Student',     tagColor: '#06B6D4' },
    { id: 'study-buddy',    label: 'Study Buddy (Uncommon)',    rarity: 'Uncommon',  type: 'tag',        tag: 'Study Buddy',    tagColor: '#3B82F6' },
    { id: 'night-owl',      label: 'Night Owl (Uncommon)',      rarity: 'Uncommon',  type: 'tag',        tag: 'Night Owl',      tagColor: '#6366F1' },
    { id: 'early-bird',     label: 'Early Bird (Uncommon)',     rarity: 'Uncommon',  type: 'tag',        tag: 'Early Bird',     tagColor: '#F59E0B' },
    { id: 'bright-orange',  label: 'Bright Orange (Uncommon)',  rarity: 'Uncommon',  type: 'name-color', name: 'Bright Orange', value: '#EA580C' },
    { id: 'violet',         label: 'Violet (Uncommon)',         rarity: 'Uncommon',  type: 'name-color', name: 'Violet',        value: '#7C3AED' },
    { id: 'cyan',           label: 'Cyan (Uncommon)',           rarity: 'Uncommon',  type: 'name-color', name: 'Cyan',          value: '#0891B2' },
    { id: 'coral',          label: 'Coral (Uncommon)',          rarity: 'Uncommon',  type: 'name-color', name: 'Coral',         value: '#F87171' },
    { id: 'mint',           label: 'Mint (Uncommon)',           rarity: 'Uncommon',  type: 'name-color', name: 'Mint',          value: '#10B981' },
    { id: 'amber',          label: 'Amber (Uncommon)',          rarity: 'Uncommon',  type: 'name-color', name: 'Amber',         value: '#B45309' },
    { id: 'border-orange',  label: 'Orange Border (Uncommon)',  rarity: 'Uncommon',  type: 'avatar',     name: 'Orange Border', value: 'border-orange' },
    { id: 'border-violet',  label: 'Violet Border (Uncommon)',  rarity: 'Uncommon',  type: 'avatar',     name: 'Violet Border', value: 'border-violet' },
    { id: 'border-cyan',    label: 'Cyan Border (Uncommon)',    rarity: 'Uncommon',  type: 'avatar',     name: 'Cyan Border',   value: 'border-cyan' },
    { id: 'border-rose',    label: 'Rose Border (Uncommon)',    rarity: 'Uncommon',  type: 'avatar',     name: 'Rose Border',   value: 'border-rose' },
    { id: 'border-sky',     label: 'Sky Border (Uncommon)',     rarity: 'Uncommon',  type: 'avatar',     name: 'Sky Border',    value: 'border-sky' },
    { id: 'deans-list',     label: "Dean's List (Rare)",        rarity: 'Rare',      type: 'tag',        tag: "Dean's List",    tagColor: '#8B5CF6' },
    { id: 'top-performer',  label: 'Top Performer (Rare)',      rarity: 'Rare',      type: 'tag',        tag: 'Top Performer',  tagColor: '#8B5CF6' },
    { id: 'overachiever',   label: 'Overachiever (Rare)',       rarity: 'Rare',      type: 'tag',        tag: 'Overachiever',   tagColor: '#8B5CF6' },
    { id: 'class-rep',      label: 'Class Rep (Rare)',          rarity: 'Rare',      type: 'tag',        tag: 'Class Rep',      tagColor: '#EC4899' },
    { id: 'hot-pink',       label: 'Hot Pink (Rare)',           rarity: 'Rare',      type: 'name-color', name: 'Hot Pink',      value: '#DB2777' },
    { id: 'gold',           label: 'Gold (Rare)',               rarity: 'Rare',      type: 'name-color', name: 'Gold',          value: '#D97706' },
    { id: 'lime-green',     label: 'Lime Green (Rare)',         rarity: 'Rare',      type: 'name-color', name: 'Lime Green',    value: '#65A30D' },
    { id: 'crimson',        label: 'Crimson (Rare)',            rarity: 'Rare',      type: 'name-color', name: 'Crimson',       value: '#B91C1C' },
    { id: 'sky-blue',       label: 'Sky Blue (Rare)',           rarity: 'Rare',      type: 'name-color', name: 'Sky Blue',      value: '#0284C7' },
    { id: 'border-hotpink', label: 'Hot Pink Border (Rare)',    rarity: 'Rare',      type: 'avatar',     name: 'Hot Pink Border', value: 'border-hotpink' },
    { id: 'border-gold',    label: 'Gold Border (Rare)',        rarity: 'Rare',      type: 'avatar',     name: 'Gold Border',   value: 'border-gold' },
    { id: 'border-lime',    label: 'Lime Border (Rare)',        rarity: 'Rare',      type: 'avatar',     name: 'Lime Border',   value: 'border-lime' },
    { id: 'border-silver',  label: 'Silver Border (Rare)',      rarity: 'Rare',      type: 'avatar',     name: 'Silver Border', value: 'border-silver' },
    { id: 'glow-blue',      label: 'Blue Glow (Rare)',          rarity: 'Rare',      type: 'avatar',     name: 'Blue Glow',     value: 'glow-blue' },
    { id: 'ace',            label: 'Ace (Epic)',                rarity: 'Epic',      type: 'tag',        tag: 'Ace',            tagColor: '#F97316' },
    { id: 'genius',         label: 'Genius (Epic)',             rarity: 'Epic',      type: 'tag',        tag: 'Genius',         tagColor: '#EC4899' },
    { id: 'valiant',        label: 'Valiant (Epic)',            rarity: 'Epic',      type: 'tag',        tag: 'Valiant',        tagColor: '#F97316' },
    { id: 'electric-blue',  label: 'Electric Blue (Epic)',      rarity: 'Epic',      type: 'name-color', name: 'Electric Blue', value: '#2563EB' },
    { id: 'magenta',        label: 'Magenta (Epic)',            rarity: 'Epic',      type: 'name-color', name: 'Magenta',       value: '#C026D3' },
    { id: 'rose',           label: 'Rose (Epic)',               rarity: 'Epic',      type: 'name-color', name: 'Rose',          value: '#F43F5E' },
    { id: 'glow-pink',      label: 'Pink Glow (Epic)',          rarity: 'Epic',      type: 'avatar',     name: 'Pink Glow',     value: 'glow-pink' },
    { id: 'border-green',   label: 'Green Border (Epic)',       rarity: 'Epic',      type: 'avatar',     name: 'Green Border',  value: 'border-green' },
    { id: 'glow-orange',    label: 'Orange Glow (Epic)',        rarity: 'Epic',      type: 'avatar',     name: 'Orange Glow',   value: 'glow-orange' },
    { id: 'mastermind',     label: 'Valedictorian (Legendary)', rarity: 'Legendary', type: 'tag',        tag: 'Valedictorian',  tagColor: '#FFFFFF' },
    { id: 'prodigy',        label: 'Prodigy (Legendary)',       rarity: 'Legendary', type: 'tag',        tag: 'Prodigy',        tagColor: '#111111' },
    { id: 'platinum',       label: 'Platinum (Legendary)',      rarity: 'Legendary', type: 'name-color', name: 'Platinum',      value: '#C0C0C0' },
    { id: 'black',          label: 'Black (Legendary)',         rarity: 'Legendary', type: 'name-color', name: 'Black',         value: '#111111' },
    { id: 'glow-gold',      label: 'Gold Fill (Legendary)',     rarity: 'Legendary', type: 'avatar',     name: 'Gold Fill',     value: 'glow-gold' },
    { id: 'frame-black',    label: 'Void Fill (Legendary)',     rarity: 'Legendary', type: 'avatar',     name: 'Void Fill',     value: 'frame-black' },
    { id: 'fill-white',     label: 'White Fill (Legendary)',    rarity: 'Legendary', type: 'avatar',     name: 'White Fill',    value: 'fill-white' },
    { id: 'god',            label: 'VIP (Mythic)',              rarity: 'Mythic',    type: 'tag',        tag: 'VIP',            tagColor: '#111111' },
    { id: 'verified',       label: 'Verified ✓ Yellow (Mythic)', rarity: 'Mythic',  type: 'tag',        tag: 'Verified',       tagColor: 'verified-yellow' },
    { id: 'rainbow',        label: 'Rainbow RGB ✨ (Mythic)',   rarity: 'Mythic',    type: 'name-color', name: 'Rainbow RGB',   value: 'rainbow' },
    { id: 'rainbow-pfp',    label: 'Rainbow Animated ✨ (Mythic)', rarity: 'Mythic', type: 'avatar',     name: 'Rainbow Animated', value: 'rainbow' },
  ],
  'dev-curse': [
    { id: 'learner',      label: 'Learner (Common)',        rarity: 'Common', type: 'tag',        tag: 'Learner',    tagColor: '#94A3B8' },
    { id: 'c-student',    label: 'C Student (Common)',      rarity: 'Common', type: 'tag',        tag: 'C Student',  tagColor: '#78716C' },
    { id: 'bottom-100',   label: 'Bottom 100 (Common)',     rarity: 'Common', type: 'tag',        tag: 'Bottom 100', tagColor: '#6B7280' },
    { id: 'curse-tag',    label: 'The Curse',               rarity: 'Curse',  type: 'tag',        tag: 'CURSE',      tagColor: 'curse' },
    { id: 'curse-name',   label: 'The Curse',               rarity: 'Curse',  type: 'name-color', name: 'The Curse', value: 'curse' },
    { id: 'curse',        label: 'The Curse',               rarity: 'Curse',  type: 'avatar',        name: 'The Curse', value: 'unobtainable-curse' },
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

// Every item that exists in the app — mirrors backend TAG_BOX_ITEMS / NAME_COLOR_BOX_ITEMS / AVATAR_EFFECT_BOX_ITEMS
type CatalogItem = { id: string; type: 'tag' | 'name-color' | 'avatar'; name: string; rarity: string; value?: string; tagColor?: string; tag?: string }
const CATALOG_ALL_ITEMS: CatalogItem[] = [
  // ── Tags ──
  { id: 'grinder',        type: 'tag', name: 'Grinder',        rarity: 'Common',    tagColor: '#6B7280' },
  { id: 'focused',        type: 'tag', name: 'Focused',         rarity: 'Common',    tagColor: '#6B7280' },
  { id: 'scholar',        type: 'tag', name: 'Scholar',         rarity: 'Common',    tagColor: '#6B7280' },
  { id: 'curious',        type: 'tag', name: 'Curious',         rarity: 'Common',    tagColor: '#6B7280' },
  { id: 'motivated',      type: 'tag', name: 'Motivated',       rarity: 'Common',    tagColor: '#6B7280' },
  { id: 'consistent',     type: 'tag', name: 'Consistent',      rarity: 'Common',    tagColor: '#6B7280' },
  { id: 'hardworker',     type: 'tag', name: 'Hardworker',      rarity: 'Common',    tagColor: '#6B7280' },
  { id: 'determined',     type: 'tag', name: 'Determined',      rarity: 'Common',    tagColor: '#6B7280' },
  { id: 'honors-student', type: 'tag', name: 'Honors Student',  rarity: 'Uncommon',  tagColor: '#3B82F6' },
  { id: 'ap-student',     type: 'tag', name: 'AP Student',      rarity: 'Uncommon',  tagColor: '#06B6D4' },
  { id: 'study-buddy',    type: 'tag', name: 'Study Buddy',     rarity: 'Uncommon',  tagColor: '#3B82F6' },
  { id: 'night-owl',      type: 'tag', name: 'Night Owl',       rarity: 'Uncommon',  tagColor: '#6366F1' },
  { id: 'early-bird',     type: 'tag', name: 'Early Bird',      rarity: 'Uncommon',  tagColor: '#F59E0B' },
  { id: 'deans-list',     type: 'tag', name: "Dean's List",     rarity: 'Rare',      tagColor: '#8B5CF6' },
  { id: 'top-performer',  type: 'tag', name: 'Top Performer',   rarity: 'Rare',      tagColor: '#8B5CF6' },
  { id: 'overachiever',   type: 'tag', name: 'Overachiever',    rarity: 'Rare',      tagColor: '#8B5CF6' },
  { id: 'class-rep',      type: 'tag', name: 'Class Rep',       rarity: 'Rare',      tagColor: '#EC4899' },
  { id: 'ace',            type: 'tag', name: 'Ace',             rarity: 'Epic',      tagColor: '#F97316' },
  { id: 'genius',         type: 'tag', name: 'Genius',          rarity: 'Epic',      tagColor: '#EC4899' },
  { id: 'valiant',        type: 'tag', name: 'Valiant',         rarity: 'Epic',      tagColor: '#F97316' },
  { id: 'mastermind',     type: 'tag', name: 'Valedictorian',  rarity: 'Legendary', tagColor: '#FFFFFF' },
  { id: 'prodigy',        type: 'tag', name: 'Prodigy',        rarity: 'Legendary', tagColor: '#111111' },
  { id: 'god',            type: 'tag', name: 'VIP',             rarity: 'Mythic',    tagColor: '#111111' },
  { id: 'GOAT',           type: 'tag', name: 'GOAT',            rarity: 'Mythic',    tagColor: '#EAB308' },
  { id: 'verified',       type: 'tag', name: 'Verified',        rarity: 'Mythic',    tagColor: 'verified-yellow' },
  { id: 'verified-blue',  type: 'tag', name: 'Partner', rarity: 'Mythic',    tagColor: 'verified-blue' },
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
  { id: 'maroon',        type: 'name-color', name: 'Maroon',         rarity: 'Common',    value: '#7F1D1D' },
  { id: 'olive',         type: 'name-color', name: 'Olive',          rarity: 'Common',    value: '#4D7C0F' },
  { id: 'brown',         type: 'name-color', name: 'Brown',          rarity: 'Common',    value: '#92400E' },
  { id: 'steel',         type: 'name-color', name: 'Steel',          rarity: 'Common',    value: '#64748B' },
  { id: 'midnight',      type: 'name-color', name: 'Midnight',       rarity: 'Common',    value: '#172554' },
  { id: 'bright-orange', type: 'name-color', name: 'Bright Orange',  rarity: 'Uncommon',  value: '#EA580C' },
  { id: 'violet',        type: 'name-color', name: 'Violet',         rarity: 'Uncommon',  value: '#7C3AED' },
  { id: 'cyan',          type: 'name-color', name: 'Cyan',           rarity: 'Uncommon',  value: '#0891B2' },
  { id: 'coral',         type: 'name-color', name: 'Coral',          rarity: 'Uncommon',  value: '#F87171' },
  { id: 'mint',          type: 'name-color', name: 'Mint',           rarity: 'Uncommon',  value: '#10B981' },
  { id: 'amber',         type: 'name-color', name: 'Amber',          rarity: 'Uncommon',  value: '#B45309' },
  { id: 'hot-pink',      type: 'name-color', name: 'Hot Pink',       rarity: 'Rare',      value: '#DB2777' },
  { id: 'gold',          type: 'name-color', name: 'Gold',           rarity: 'Rare',      value: '#D97706' },
  { id: 'lime-green',    type: 'name-color', name: 'Lime Green',     rarity: 'Rare',      value: '#65A30D' },
  { id: 'crimson',       type: 'name-color', name: 'Crimson',        rarity: 'Rare',      value: '#B91C1C' },
  { id: 'sky-blue',      type: 'name-color', name: 'Sky Blue',       rarity: 'Rare',      value: '#0284C7' },
  { id: 'electric-blue', type: 'name-color', name: 'Electric Blue',  rarity: 'Epic',      value: '#2563EB' },
  { id: 'magenta',       type: 'name-color', name: 'Magenta',        rarity: 'Epic',      value: '#C026D3' },
  { id: 'rose',          type: 'name-color', name: 'Rose',           rarity: 'Epic',      value: '#F43F5E' },
  { id: 'platinum',      type: 'name-color', name: 'Platinum',       rarity: 'Legendary', value: '#C0C0C0' },
  { id: 'black',         type: 'name-color', name: 'Black',          rarity: 'Legendary', value: '#111111' },
  { id: 'rainbow',       type: 'name-color', name: 'Rainbow RGB ✨', rarity: 'Mythic',    value: 'rainbow' },
  // ── PFP Effects ──
  { id: 'border-blue',    type: 'avatar', name: 'Blue Border',       rarity: 'Common',    value: 'border-blue'    },
  { id: 'border-red',     type: 'avatar', name: 'Red Border',        rarity: 'Common',    value: 'border-red'     },
  { id: 'border-navy',    type: 'avatar', name: 'Navy Border',       rarity: 'Common',    value: 'border-navy'    },
  { id: 'border-teal',    type: 'avatar', name: 'Teal Border',       rarity: 'Common',    value: 'border-teal'    },
  { id: 'glow-purple',    type: 'avatar', name: 'Purple Glow',       rarity: 'Common',    value: 'glow-purple'    },
  { id: 'border-yellow',  type: 'avatar', name: 'Yellow Border',     rarity: 'Common',    value: 'border-yellow'  },
  { id: 'border-pink',    type: 'avatar', name: 'Pink Border',       rarity: 'Common',    value: 'border-pink'    },
  { id: 'border-gray',    type: 'avatar', name: 'Gray Border',       rarity: 'Common',    value: 'border-gray'    },
  { id: 'border-brown',   type: 'avatar', name: 'Brown Border',      rarity: 'Common',    value: 'border-brown'   },
  { id: 'border-orange',  type: 'avatar', name: 'Orange Border',     rarity: 'Uncommon',  value: 'border-orange'  },
  { id: 'border-violet',  type: 'avatar', name: 'Violet Border',     rarity: 'Uncommon',  value: 'border-violet'  },
  { id: 'border-cyan',    type: 'avatar', name: 'Cyan Border',       rarity: 'Uncommon',  value: 'border-cyan'    },
  { id: 'border-rose',    type: 'avatar', name: 'Rose Border',       rarity: 'Uncommon',  value: 'border-rose'    },
  { id: 'border-sky',     type: 'avatar', name: 'Sky Border',        rarity: 'Uncommon',  value: 'border-sky'     },
  { id: 'border-hotpink', type: 'avatar', name: 'Hot Pink Border',   rarity: 'Rare',      value: 'border-hotpink' },
  { id: 'border-gold',    type: 'avatar', name: 'Gold Border',       rarity: 'Rare',      value: 'border-gold'    },
  { id: 'border-lime',    type: 'avatar', name: 'Lime Border',       rarity: 'Rare',      value: 'border-lime'    },
  { id: 'border-silver',  type: 'avatar', name: 'Silver Border',     rarity: 'Rare',      value: 'border-silver'  },
  { id: 'glow-blue',      type: 'avatar', name: 'Blue Glow',         rarity: 'Rare',      value: 'glow-blue'      },
  { id: 'border-green',   type: 'avatar', name: 'Green Border',      rarity: 'Epic',      value: 'border-green'   },
  { id: 'glow-pink',      type: 'avatar', name: 'Pink Glow',         rarity: 'Epic',      value: 'glow-pink'      },
  { id: 'glow-orange',    type: 'avatar', name: 'Orange Glow',       rarity: 'Epic',      value: 'glow-orange'    },
  { id: 'glow-gold',      type: 'avatar', name: 'Gold Fill',         rarity: 'Legendary', value: 'glow-gold'      },
  { id: 'frame-black',    type: 'avatar', name: 'Void Fill',         rarity: 'Legendary', value: 'frame-black'    },
  { id: 'fill-white',     type: 'avatar', name: 'White Fill',        rarity: 'Legendary', value: 'fill-white'     },
  { id: 'rainbow',        type: 'avatar', name: 'Rainbow Animated ✨', rarity: 'Mythic',       value: 'rainbow'              },
  { id: 'curse',         type: 'avatar',        name: 'The Curse',         rarity: 'Curse', value: 'unobtainable-curse' },
  { id: 'curse-tag',    type: 'tag',        name: 'The Curse',         rarity: 'Curse', tagColor: 'curse' },
  { id: 'curse-name',   type: 'name-color', name: 'The Curse',         rarity: 'Curse', value: 'curse' },
  // Developer's Curse exclusives (Common, zero-quicksell)
  { id: 'Learner',    type: 'tag', name: 'Learner',    rarity: 'Common', tagColor: '#94A3B8' },
  { id: 'C Student',  type: 'tag', name: 'C Student',  rarity: 'Common', tagColor: '#78716C' },
  { id: 'Bottom 100', type: 'tag', name: 'Bottom 100', rarity: 'Common', tagColor: '#6B7280' },
]

type Tab = 'boxes' | 'shop' | 'trade' | 'trader' | 'inventory' | 'leaderboard' | 'catalog'
type TradeSubTab = 'new' | 'incoming' | 'sent' | 'history'
type TraderSubTab = 'sell' | 'buy' | 'trade'

interface TraderCatalogItem {
  type: 'tag' | 'name-color' | 'avatar'
  id: string
  name: string
  rarity: string
  traderPrice: number
  tag?: string
  tagColor?: string
  value?: string
}

function ncStyle(color: string | null | undefined, fallback?: string): React.CSSProperties {
  if (!color || color === 'rainbow' || color === 'curse') return fallback ? { color: fallback } : {}
  if (color === '#111111') return { color, textShadow: '0 0 6px rgba(180,180,180,0.65)' }
  if (color === '#C0C0C0') return { color: '#E8E8FF', textShadow: '0 0 4px rgba(255,255,255,1), 0 0 8px rgba(255,255,255,0.95), 0 0 18px rgba(255,255,255,0.7), 0 0 35px rgba(210,220,255,0.35)' }
  return { color }
}

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
        border: isRainbow ? '2px solid transparent' : `2px solid ${borderColor}44`,
        background: isRainbow
          ? 'linear-gradient(var(--surface-2), var(--surface-2)) padding-box, linear-gradient(135deg, #ff6b6b, #ffd43b, #69db7c, #4dabf7, #cc5de8, #ff6b6b) border-box'
          : 'var(--surface-2)',
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
  if (type === 'avatar') {
    return (
      <span className={avatarClass(value)} style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-block', flexShrink: 0, background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', ...avatarStyle(value) }} />
    )
  }
  return <span style={{ fontSize: 18 }}>📦</span>
}

// ── Item Preview Modal ────────────────────────────────────────────────────────

type PreviewItem = { type: 'tag' | 'name-color' | 'avatar'; id: string; name: string; rarity: string; value?: string; tagColor?: string }

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

function ItemPreviewModal({ item, estValue, onClose, onViewProfile }: { item: PreviewItem; estValue?: number; onClose: () => void; onViewProfile: (id: number) => void }) {
  const [tab, setTab] = useState<'history' | 'owners'>('history')
  const [history, setHistory] = useState<ItemSalePoint[] | null>(null)
  const [owners, setOwners] = useState<ItemOwner[] | null>(null)
  const [circulation, setCirculation] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch circulation count eagerly on mount so it shows on both tabs
  useEffect(() => {
    api.marketplaceItemOwners(item.type, item.id)
      .then(d => { setOwners(d.owners); setCirculation(d.total) })
      .catch(() => { setOwners([]); setCirculation(0) })
  }, [item.type, item.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'history') {
      if (history !== null) return
      setLoading(true)
      api.marketplaceItemHistory(item.type, item.id)
        .then(d => setHistory(d))
        .catch(() => setHistory([]))
        .finally(() => setLoading(false))
    } else {
      if (owners !== null) { return }
      setLoading(true)
      api.marketplaceItemOwners(item.type, item.id)
        .then(d => { setOwners(d.owners); setCirculation(d.total) })
        .catch(() => { setOwners([]); setCirculation(0) })
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
              <RarityBadge rarity={item.rarity} itemId={item.id} />
              {circulation !== null && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                  {circulation} in circulation
                </span>
              )}
              {estValue != null && estValue > 0 && (
                <span style={{ fontSize: 11, color: '#EAB308', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <CoinIcon size={10} />Est. {estValue.toLocaleString()}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: 4, lineHeight: 1 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['history', 'owners'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px 0', border: 'none', background: 'transparent', color: tab === t ? 'var(--primary)' : 'var(--text-muted)', fontWeight: tab === t ? 700 : 500, fontSize: 13, cursor: 'pointer', borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent' }}>
              {t === 'history' ? '📈 Price History' : `👥 Owners${circulation !== null ? ` (${(owners ?? []).length})` : ''}`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
          ) : tab === 'history' ? (
            <>
              {circulation !== null && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 12 }}>
                  <span style={{ color: 'var(--text)' }}>{circulation}</span> in circulation
                </div>
              )}
              <SalesChart data={history ?? []} />
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(owners ?? []).length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No owners found</div>
              ) : (owners ?? []).map(owner => (
                <div key={owner.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ width: 28, fontSize: 11, fontWeight: 700, color: owner.rank === 1 ? '#EAB308' : 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>
                    {owner.rank === 1 ? '🥇' : `#${owner.rank}`}
                  </span>
                  <div className={avatarClass(owner.avatarEffect)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', flexShrink: 0, ...avatarStyle(owner.avatarEffect) }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button onClick={() => { onViewProfile(owner.id); onClose() }}
                      className={owner.nameColor === 'rainbow' ? 'name-rainbow' : owner.nameColor === 'curse' ? 'name-curse' : ''}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', ...ncStyle(owner.nameColor, 'var(--text)') }}>
                      {owner.name ?? 'Unknown'}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {owner.tag && (
                        (owner.tagColor === 'verified-yellow' || owner.tagColor === 'verified-blue')
                          ? <VerifiedBadge variant={owner.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} />
                          : <span className={tagCssClass(owner.tag, owner.tagColor)} style={{ fontSize: 11, fontWeight: 700, color: isAnimatedTag(owner.tag) || owner.tagColor === 'curse' ? undefined : owner.tagColor ?? '#6B7280' }}>[{owner.tag}]</span>
                      )}
                      {(owner.badge === 'verified-yellow' || owner.badge === 'verified-blue') && <VerifiedBadge variant={owner.badge === 'verified-yellow' ? 'yellow' : 'blue'} size={14} />}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                    {owner.rank === 1 && <span style={{ fontSize: 10, color: '#EAB308', fontWeight: 700, background: '#EAB30818', borderRadius: 99, padding: '2px 6px' }}>First</span>}
                    {owner.qty > 1 && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, background: 'var(--surface-2)', borderRadius: 99, padding: '2px 6px' }}>×{owner.qty}</span>}
                  </div>
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

function MultiSpinResultOverlay({ result, onClose, userName }: { result: MultiBoxResult; onClose: () => void; userName?: string | null }) {
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
                  : <span className={tagCssClass(current.tag, current.tagColor)} style={{ color: isAnimatedTag(current.tag) || current.tagColor === 'curse' ? undefined : current.tagColor ?? carouselColor }}>[{current.tag}]</span>
                : current.type === 'name-color'
                  ? <span className={current.value === 'rainbow' ? 'name-rainbow' : current.value === 'curse' ? 'name-curse' : ''} style={{ color: (current.value === 'rainbow' || current.value === 'curse') ? undefined : current.value ?? carouselColor }}>{userName ?? 'Username'}</span>
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
                  : g.won.tag
                    ? `[${g.won.tag}]`
                    : g.won.type === 'name-color'
                      ? <span className={g.won.value === 'rainbow' ? 'name-rainbow' : g.won.value === 'curse' ? 'name-curse' : ''} style={{ color: (g.won.value === 'rainbow' || g.won.value === 'curse') ? undefined : g.won.value }}>{userName ?? 'Username'}</span>
                      : (g.won.name ?? g.won.id)}
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

const FREE_SPIN_SEGMENTS = [
  { rarity: 'Common',    coins: 25,    weight: 60,    color: '#22C55E' },
  { rarity: 'Uncommon',  coins: 50,    weight: 25,    color: '#3B82F6' },
  { rarity: 'Rare',      coins: 100,   weight: 10.25, color: '#8B5CF6' },
  { rarity: 'Epic',      coins: 300,   weight: 3.95,  color: '#F97316' },
  { rarity: 'Legendary', coins: 1000,  weight: 0.75,  color: '#FACC15' },
  { rarity: 'Mythic',    coins: 2500,  weight: 0.05,  color: '#EAB308' },
]

function FreeSpinModal({ onClose, onDone }: { onClose: () => void; onDone: (reward: number, rarity: string) => void }) {
  const [phase, setPhase] = useState<'ready' | 'spinning'>('ready')
  const [pointerAngle, setPointerAngle] = useState(0)
  const [spinDuration, setSpinDuration] = useState(0)

  const segments = useMemo(() => {
    let cum = 0
    return FREE_SPIN_SEGMENTS.map(s => {
      const sweep = (s.weight / 100) * 360
      const seg = { ...s, start: cum, end: cum + sweep }
      cum += sweep
      return seg
    })
  }, [])

  const CX = 150, CY = 150, R = 130

  function segPath(start: number, end: number) {
    const toXY = (deg: number) => {
      const rad = (deg - 90) * (Math.PI / 180)
      return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) }
    }
    const s = toXY(start), e = toXY(end)
    const large = end - start > 180 ? 1 : 0
    return `M ${CX} ${CY} L ${s.x.toFixed(3)} ${s.y.toFixed(3)} A ${R} ${R} 0 ${large} 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)} Z`
  }

  async function handleSpin() {
    if (phase !== 'ready') return
    setPhase('spinning')
    try {
      const r = await api.marketplaceFreeSpin()
      const wonSeg = segments.find(s => s.rarity === r.rarity) ?? segments[0]
      const segSize = wonSeg.end - wonSeg.start
      const margin = Math.min(segSize * 0.15, 5)
      const landAngle = wonSeg.start + margin + Math.random() * Math.max(0, segSize - margin * 2)
      setSpinDuration(4000)
      setPointerAngle(prev => {
        const currentPos = prev % 360
        const delta = (landAngle - currentPos + 360) % 360
        return prev + 5 * 360 + delta
      })
      setTimeout(() => { onDone(r.reward, r.rarity); onClose() }, 4300)
    } catch {
      setPhase('ready')
    }
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={phase === 'ready' ? onClose : undefined}>
      <div className="ns-card" style={{ padding: 32, maxWidth: 380, width: '92%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>🎰 Free Spin</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Win coins — available every 6 hours</div>

        <div style={{ width: 300, height: 300 }}>
          <svg width={300} height={300} viewBox="0 0 300 300">
            {segments.map(seg => (
              <path key={seg.rarity} d={segPath(seg.start, seg.end)} fill={seg.color} />
            ))}
            <g style={{ transformOrigin: `${CX}px ${CY}px`, transform: `rotate(${pointerAngle}deg)`, transition: spinDuration > 0 ? `transform ${spinDuration}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)` : 'none' }}>
              <polygon points={`${CX},${CY - 42} ${CX - 9},${CY - 24} ${CX + 9},${CY - 24}`} fill="#EF4444" style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.6))' }} />
            </g>
            <circle cx={CX} cy={CY} r={27} fill="#EF4444" stroke="#000" strokeWidth={2} />
          </svg>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', justifyContent: 'center' }}>
          {segments.map(seg => (
            <div key={seg.rarity} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: seg.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: seg.color, fontWeight: 700 }}>{seg.rarity}</span>
              <span style={{ color: 'var(--text-muted)' }}>{seg.coins.toLocaleString()} 🪙</span>
            </div>
          ))}
        </div>

        <button onClick={() => void handleSpin()} disabled={phase === 'spinning'}
          style={{ padding: '13px 44px', borderRadius: 12, border: 'none', background: phase === 'ready' ? '#EAB308' : 'var(--surface-2)', color: phase === 'ready' ? '#000' : 'var(--text-muted)', fontWeight: 800, fontSize: 16, cursor: phase === 'ready' ? 'pointer' : 'not-allowed' }}>
          {phase === 'spinning' ? 'Spinning…' : 'Spin!'}
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
  prices,
  onEquip,
}: {
  box: (typeof BOX_DEFS)[0]
  inv: InventoryData | null
  onClose: () => void
  onSpin: (boxType: BoxType, quantity: number) => Promise<BoxResult | MultiBoxResult | null>
  onDone: (result: BoxResult | MultiBoxResult) => void
  prices: Record<string, number>
  onEquip: (type: 'name-color' | 'avatar' | 'tag', itemId: string | null) => void
}) {
  const [phase, setPhase] = useState<'ready' | 'spinning' | 'done'>('ready')
  const [wonResult, setWonResult] = useState<BoxResult | null>(null)
  const [pointerAngle, setPointerAngle] = useState(0)
  const [spinDuration, setSpinDuration] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [spinError, setSpinError] = useState<string | null>(null)
  const [multiArrows, setMultiArrows] = useState<Array<{ finalAngle: number; color: string }>>([])
  const [arrowsLanded, setArrowsLanded] = useState(false)
  const [canDismiss, setCanDismiss] = useState(true)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      setSpinDuration(4000)
      setPointerAngle(prev => {
        const currentPos = prev % 360
        const delta = (landAngle - currentPos + 360) % 360
        return prev + 5 * 360 + delta
      })
      setTimeout(() => {
        setWonResult(singleResult)
        setPhase('done')
        const HIGH_RARITIES = new Set(['Legendary', 'Mythic', 'Unobtainable', 'Curse'])
        if (HIGH_RARITIES.has(singleResult.won.rarity)) {
          setCanDismiss(false)
          if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
          dismissTimerRef.current = setTimeout(() => setCanDismiss(true), 3000)
        } else {
          setCanDismiss(true)
        }
      }, 4300)
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
      onClick={phase === 'ready' ? onClose : (phase === 'done' && canDismiss) ? () => { setPhase('ready'); setWonResult(null) } : undefined}
    >
      <div
        className="ns-card"
        style={{ padding: 32, maxWidth: 380, width: '92%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{box.icon} {box.label}</div>

        {phase === 'done' && wonResult ? (() => {
          const r = wonResult
          const isRainbow = r.won.value === 'rainbow'
          const isMythic  = r.won.rarity === 'Mythic'
          const isLegend  = r.won.rarity === 'Legendary'
          const emoji     = isMythic ? '👑' : isLegend ? '🌟' : '🎉'
          const borderColor = getRarityColor(r.won.rarity, r.won.id)
          const AVATAR_FILL_EFFECTS = new Set(['rainbow', 'glow-gold', 'frame-black', 'fill-white', 'unobtainable-curse'])
          const isPfpFill = r.won.type === 'avatar' && AVATAR_FILL_EFFECTS.has(r.won.value ?? '')
          const effectStyle = avatarStyle(r.won.type === 'avatar' ? r.won.value : undefined)
          const dummyImgStyle: React.CSSProperties = {
            ...(effectStyle.border    ? { border:    effectStyle.border }    : {}),
            ...(effectStyle.boxShadow ? { boxShadow: effectStyle.boxShadow } : {}),
          }
          const wonPrice = prices[`${r.won.type}:${r.won.id}`]

          const itemPreview = r.won.type === 'tag' ? (
            (r.won.tagColor === 'verified-yellow' || r.won.tagColor === 'verified-blue')
              ? <div style={{ marginBottom: 4 }}><VerifiedBadge variant={r.won.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} size={64} /></div>
              : <div className={tagCssClass(r.won.tag, r.won.tagColor)} style={{ fontSize: 22, fontWeight: 800, color: isAnimatedTag(r.won.tag) || r.won.tagColor === 'curse' ? undefined : r.won.tagColor ?? '#6B7280', marginBottom: 4 }}>
                  {r.won.tag}
                </div>
          ) : r.won.type === 'name-color' ? (
            <div className={isRainbow ? 'name-rainbow' : r.won.value === 'curse' ? 'name-curse' : ''} style={{ fontSize: 24, fontWeight: 800, color: (isRainbow || r.won.value === 'curse') ? undefined : r.won.value, marginBottom: 4 }}>
              {r.won.name}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div className={avatarClass(r.won.value)} style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#FFFFFF', ...avatarStyle(r.won.value) }}>✦</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{r.won.name}</div>
            </div>
          )

          const dummyComment = (
            <div style={{ background: 'var(--surface-2,#1a1a1a)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 4px', border: '1px solid var(--border)', textAlign: 'left' as const }}>
              {isPfpFill ? (
                <div className={avatarClass(r.won.value)} style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, ...effectStyle }} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={DUMMY_PFP} alt={inv?.name ?? 'User'} className={r.won.type === 'avatar' ? avatarClass(r.won.value) : ''} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' as const, flexShrink: 0, ...dummyImgStyle }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' as const }}>
                  <span
                    className={r.won.type === 'name-color' && isRainbow ? 'name-rainbow' : r.won.type === 'name-color' && r.won.value === 'curse' ? 'name-curse' : ''}
                    style={{ fontSize: 13, fontWeight: 700, color: r.won.type === 'name-color' && !isRainbow && r.won.value !== 'curse' ? r.won.value : 'var(--text)' }}
                  >
                    {inv?.name ?? 'Username'}
                  </span>
                  {r.won.type === 'tag' ? (
                    (r.won.tagColor === 'verified-yellow' || r.won.tagColor === 'verified-blue')
                      ? <VerifiedBadge variant={r.won.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} size={20} />
                      : <span className={tagCssClass(r.won.tag, r.won.tagColor)} style={{ fontSize: 12, fontWeight: 700, color: isAnimatedTag(r.won.tag) || r.won.tagColor === 'curse' ? undefined : (r.won.tagColor ?? '#6B7280') }}>{r.won.tag}</span>
                  ) : inv?.tag ? (
                    (inv.tagColor === 'verified-yellow' || inv.tagColor === 'verified-blue')
                      ? <VerifiedBadge variant={inv.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} size={16} />
                      : <span style={{ fontSize: 12, fontWeight: 700, color: inv.tagColor ?? '#6B7280' }}>[{inv.tag}]</span>
                  ) : null}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Here&apos;s a preview of your new item ✨</div>
              </div>
            </div>
          )

          return (
            <div style={{ width: '100%', textAlign: 'center', border: `1px solid ${borderColor}55`, borderRadius: 12, padding: '20px 16px', background: `${borderColor}08` }}>
              <div style={{ fontSize: 44, marginBottom: 8 }}>{emoji}</div>
              {!r.alreadyHad && (
                <div style={{ display: 'inline-block', background: '#22C55E', color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: '1px', borderRadius: 6, padding: '2px 8px', marginBottom: 6 }}>NEW</div>
              )}
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>You won!</div>
              {itemPreview}
              {dummyComment}
              <div style={{ fontSize: 13, color: getRarityColor(r.won.rarity, r.won.id), fontWeight: 700, marginBottom: wonPrice ? 4 : 14 }}>
                {r.won.rarity}{r.alreadyHad ? ' · already owned' : ''}
              </div>
              {wonPrice && (
                <div style={{ fontSize: 12, color: '#EAB308', fontWeight: 700, marginBottom: 14 }}>
                  <CoinIcon size={12} style={{ marginRight: 3 }} />Est. {wonPrice.toLocaleString()}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {r.won.type !== 'tag' && (
                  <button
                    onClick={() => { onEquip(r.won.type === 'name-color' ? 'name-color' : 'avatar', r.won.id); setPhase('ready'); setWonResult(null) }}
                    style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#FFFFFF', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  >
                    Equip Now
                  </button>
                )}
                <button
                  onClick={() => { setPhase('ready'); setWonResult(null) }}
                  style={{ padding: '10px 20px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  Nice!
                </button>
              </div>
            </div>
          )
        })() : (
          <>
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
                      points={`${CX},${CY - 42} ${CX - 9},${CY - 24} ${CX + 9},${CY - 24}`}
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
                      points={`${CX},${CY - 42} ${CX - 9},${CY - 24} ${CX + 9},${CY - 24}`}
                      fill="#EF4444"
                      fillOpacity={multiArrows.length <= 10 ? 0.9 : multiArrows.length <= 50 ? 0.6 : 0.4}
                      style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))' }}
                    />
                  </g>
                ))}
                {/* Center hub: anchors all arrow bases */}
                <circle cx={CX} cy={CY} r={27} fill="#EF4444" stroke="#000" strokeWidth={2} />
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
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Trader sub-components (memoized to avoid parent re-render cost) ───────────

const SELL_SKIP = new Set(['GOAT', 'Novice', 'Pro', 'Veteran', 'Legend'])

function TraderItemPreview({ type, id, name, tagColor, value, rarity }: {
  type: 'tag' | 'name-color' | 'avatar'
  id: string
  name: string
  tagColor?: string
  value?: string
  rarity: string
}) {
  const rarityColor = getRarityColor(rarity, id)
  if (type === 'tag') {
    if (tagColor === 'verified-yellow') return <VerifiedBadge variant="yellow" size={20} />
    if (tagColor === 'verified-blue')   return <VerifiedBadge variant="blue"   size={20} />
    const cls = tagCssClass(name, tagColor)
    const base: React.CSSProperties = isAnimatedTag(name) || tagColor === 'curse'
      ? { fontSize: 10, fontWeight: 900, padding: '2px 6px', borderRadius: 5 }
      : { fontSize: 10, fontWeight: 800, color: tagColor, padding: '2px 6px', borderRadius: 5, background: `${rarityColor}1A`, border: `1px solid ${rarityColor}44` }
    return <span className={cls} style={base}>{name}</span>
  }
  if (type === 'name-color') {
    const isRainbow = value === 'rainbow'
    const isCurse   = value === 'curse'
    return (
      <span
        className={isRainbow ? 'name-rainbow' : isCurse ? 'name-curse' : ''}
        style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.2px', ...(!isRainbow && !isCurse ? ncStyle(value) : {}) }}
      >
        Name
      </span>
    )
  }
  return (
    <div
      className={avatarClass(value)}
      style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 11, flexShrink: 0, ...avatarStyle(value) }}
    >
      A
    </div>
  )
}
const TRADER_RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic']

const TraderSellGrid = React.memo(function TraderSellGrid({
  inv, prices, onSell,
}: {
  inv: InventoryData | null
  prices: Record<string, number>
  onSell: (item: { type: 'tag' | 'name-color' | 'avatar'; id: string; name: string; rarity: string; payout: number }) => void
}) {
  const items = useMemo(() => {
    const raw = [
      ...(inv?.ownedTags ?? []).map(t => ({ type: 'tag' as const, id: t.id, name: t.tag, rarity: t.rarity, tagColor: t.tagColor, value: undefined as string | undefined })),
      ...(inv?.ownedNameColors ?? []).map(c => ({ type: 'name-color' as const, id: c.id, name: c.name, rarity: c.rarity, tagColor: undefined as string | undefined, value: c.value })),
      ...(inv?.ownedAvatarEffects ?? []).map(p => ({ type: 'avatar' as const, id: p.id, name: p.name, rarity: p.rarity, tagColor: undefined as string | undefined, value: p.value })),
    ].filter(i => !SELL_SKIP.has(i.id))
    const seen = new Map<string, { type: 'tag' | 'name-color' | 'avatar'; id: string; name: string; rarity: string; tagColor?: string; value?: string; count: number }>()
    for (const item of raw) {
      const key = `${item.type}:${item.id}`
      const ex = seen.get(key)
      if (ex) ex.count++
      else seen.set(key, { ...item, count: 1 })
    }
    return Array.from(seen.values())
  }, [inv])

  if (items.length === 0) {
    return <div className="ns-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Your inventory is empty — nothing to sell.</div>
  }
  return (
    <>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, padding: '8px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        The trader pays <strong style={{ color: '#EAB308' }}>50% of est value</strong> for any item. Limit: 5 sells/day.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 8 }}>
        {items.map(item => {
          const payout = Math.floor((prices[`${item.type}:${item.id}`] ?? 0) * 0.5)
          const color = getRarityBorderColor(item.rarity, item.id)
          return (
            <button
              key={`${item.type}:${item.id}`}
              onClick={() => onSell({ type: item.type, id: item.id, name: item.name, rarity: item.rarity, payout })}
              style={{ width: '100%', padding: '10px 6px', borderRadius: 10, border: `2px solid ${color}44`, background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
            >
              <TraderItemPreview type={item.type} id={item.id} name={item.name} tagColor={item.tagColor} value={item.value} rarity={item.rarity} />
              {item.count > 1 && (
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface)', padding: '1px 6px', borderRadius: 99 }}>
                  x{item.count.toLocaleString()}
                </div>
              )}
              <div style={{ fontSize: 10, color: '#EAB308', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CoinIcon size={9} />{payout > 0 ? payout.toLocaleString() : '—'}
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
})

const TraderBuyGrid = React.memo(function TraderBuyGrid({
  catalog, catalogLoaded, coins, search, rarityFilter, onSearchChange, onRarityChange, onBuy,
}: {
  catalog: TraderCatalogItem[]
  catalogLoaded: boolean
  coins: number
  search: string
  rarityFilter: string
  onSearchChange: (v: string) => void
  onRarityChange: (v: string) => void
  onBuy: (item: TraderCatalogItem) => void
}) {
  const filtered = useMemo(() => catalog
    .filter(i => rarityFilter === 'All' || i.rarity === rarityFilter)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => TRADER_RARITY_ORDER.indexOf(a.rarity) - TRADER_RARITY_ORDER.indexOf(b.rarity)),
  [catalog, rarityFilter, search])

  return (
    <>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        The trader marks up all prices. The rarer, the pricier. Limit: 5 purchases/day.
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' as const }}>
        <input value={search} onChange={e => onSearchChange(e.target.value)} placeholder="Search items…"
          style={{ flex: 1, minWidth: 140, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }} />
        <select value={rarityFilter} onChange={e => onRarityChange(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}>
          <option value="All">All Rarities</option>
          {TRADER_RARITY_ORDER.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      {!catalogLoaded ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>Loading catalog…</div>
      ) : filtered.length === 0 ? (
        <div className="ns-card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No items match</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
          {filtered.map(item => {
            const color = getRarityBorderColor(item.rarity, item.id)
            const canAfford = coins >= item.traderPrice
            return (
              <button key={`${item.type}:${item.id}`} onClick={() => onBuy(item)}
                style={{ width: '100%', padding: '10px 6px', borderRadius: 10, border: `2px solid ${color}${canAfford ? '66' : '22'}`, background: 'var(--surface-2)', cursor: canAfford ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, opacity: canAfford ? 1 : 0.5 }}>
                <TraderItemPreview type={item.type} id={item.id} name={item.name} tagColor={item.tagColor} value={item.value} rarity={item.rarity} />
                <div style={{ fontSize: 10, color: canAfford ? '#EAB308' : 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CoinIcon size={9} />{item.traderPrice.toLocaleString()}
                </div>
                <div style={{ fontSize: 9, color, fontWeight: 600 }}>{item.rarity}</div>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
})

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
    itemType: 'tag' | 'name-color' | 'avatar'
    itemId: string
    itemName: string
    rarity: string
    coins: number
    isLastCopy: boolean
    isRare: boolean
  } | null>(null)

  // Sell all duplicates confirmation
  const [sellDupsConfirm, setSellDupsConfirm] = useState<{
    items: Array<{ type: 'tag' | 'name-color' | 'avatar'; id: string; name: string; rarity: string; count: number; coinsEach: number }>
    totalCoins: number
    hasRare: boolean
  } | null>(null)
  const [sellingDups, setSellingDups] = useState(false)
  const [dupExcluded, setDupExcluded] = useState<Set<string>>(new Set())

  const [currentUserId, setCurrentUserId] = useState<number | null>(null)

  // DEV panel
  const [isDevUser, setIsDevUser] = useState(false)
  const [devCoins, setDevCoins] = useState('500')
  const [devType, setDevType] = useState<'name-color' | 'avatar' | 'tag'>('name-color')
  const [devItemId, setDevItemId] = useState('')
  const [devGranting, setDevGranting] = useState(false)
  const [devMsg, setDevMsg] = useState('')
  const [simBoxType, setSimBoxType] = useState<'tag' | 'name-color' | 'avatar'>('name-color')
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
  const [shopSubTab, setShopSubTab] = useState<'browse' | 'my-listings'>('browse')

  // Trade — new
  const [tradeSearch, setTradeSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: number; name: string | null; tag: string | null; tagColor: string | null; badge?: string | null }>>([])
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
  const [profileFollowing, setProfileFollowing] = useState(false)
  const [profilePosts, setProfilePosts] = useState<FeedPost[]>([])
  const [profilePostsLoading, setProfilePostsLoading] = useState(false)

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

  // Wandering Trader
  const [traderSubTab, setTraderSubTab] = useState<TraderSubTab>('sell')
  const [traderStatus, setTraderStatus] = useState<{ sellsUsed: number; sellsRemaining: number; buysUsed: number; buysRemaining: number; tradesUsed: number; tradesRemaining: number } | null>(null)
  const [traderCatalog, setTraderCatalog] = useState<TraderCatalogItem[]>([])
  const [traderCatalogLoaded, setTraderCatalogLoaded] = useState(false)
  const [traderSearch, setTraderSearch] = useState('')
  const [traderRarityFilter, setTraderRarityFilter] = useState<string>('All')
  const [traderSellConfirm, setTraderSellConfirm] = useState<{ type: 'tag' | 'name-color' | 'avatar'; id: string; name: string; rarity: string; payout: number } | null>(null)
  const [traderBuyConfirm, setTraderBuyConfirm] = useState<TraderCatalogItem | null>(null)
  const [traderBusy, setTraderBusy] = useState(false)
  const [traderMsg, setTraderMsg] = useState('')
  // Item-for-item trade state
  const [tradeOfferItems, setTradeOfferItems] = useState<Array<{ type: 'tag' | 'name-color' | 'avatar'; id: string; name: string; rarity: string }>>([])
  const [tradeWantItems, setTradeWantItems] = useState<TraderCatalogItem[]>([])

  // Free spin
  const [freeSpinCooldownUntil, setFreeSpinCooldownUntil] = useState<Date | null>(null)
  const [freeSpinResult, setFreeSpinResult] = useState<{ reward: number; rarity: string } | null>(null)
  const [freeSpinOpen, setFreeSpinOpen] = useState(false)
  const [freeSpinCountdown, setFreeSpinCountdown] = useState('')

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
        if (d.nextFreeSpin) setFreeSpinCooldownUntil(new Date(d.nextFreeSpin))
        setLoading(false)
      })
      .catch(() => setLoading(false))

    api.getItemPrices().then(setPrices).catch(() => {})
    api.traderStatus().then(setTraderStatus).catch(() => {})

    // Use cached catalog for instant load, then refresh in background
    const CATALOG_KEY = 'ns_trader_catalog_v13'
    try {
      const cached = JSON.parse(localStorage.getItem(CATALOG_KEY) ?? 'null')
      if (Array.isArray(cached) && cached.length > 0) {
        setTraderCatalog(cached)
        setTraderCatalogLoaded(true)
      }
    } catch {}
    api.traderCatalog().then(r => {
      setTraderCatalog(r)
      setTraderCatalogLoaded(true)
      try { localStorage.setItem(CATALOG_KEY, JSON.stringify(r)) } catch {}
    }).catch(() => {})

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

  useEffect(() => {
    function fmt(ms: number) {
      const s = Math.floor(ms / 1000)
      const h = Math.floor(s / 3600)
      const m = Math.floor((s % 3600) / 60)
      const sec = s % 60
      if (h > 0) return `${h}h ${m}m ${sec}s`
      if (m > 0) return `${m}m ${sec}s`
      return `${sec}s`
    }
    const tick = () => {
      if (!freeSpinCooldownUntil) { setFreeSpinCountdown(''); return }
      const ms = freeSpinCooldownUntil.getTime() - Date.now()
      if (ms <= 0) { setFreeSpinCooldownUntil(null); setFreeSpinCountdown(''); return }
      setFreeSpinCountdown(fmt(ms))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [freeSpinCooldownUntil])

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

  useEffect(() => {
    if (tab !== 'trader') return
    api.traderStatus().then(setTraderStatus).catch(() => {})
  }, [tab])

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
    setProfilePosts([]); setProfilePostsLoading(true)
    try {
      const p = await api.feedUserProfile(userId)
      setProfilePanel(p)
      setProfileFollowing(p.isFollowing)
    } catch { /* ignore */ }
    finally { setProfilePanelLoading(false) }
    try {
      const postsData = await api.feedUserPosts(userId)
      setProfilePosts(postsData.posts)
    } catch { /* ignore */ }
    finally { setProfilePostsLoading(false) }
  }

  async function handleDailyClaim() {
    try {
      const r = await api.marketplaceDailyClaim()
      setInv(prev => prev ? { ...prev, coins: r.coins, canClaimToday: false } : prev)
    } catch { /* ignore */ }
  }

  function handleFreeSpinDone(reward: number, rarity: string) {
    setFreeSpinResult({ reward, rarity })
    setFreeSpinCooldownUntil(new Date(Date.now() + 6 * 60 * 60 * 1000))
    api.marketplaceInventory().then(d => setInv(d)).catch(() => {})
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
        if (r.won.type === 'avatar' && r.won.value) {
          const item: MarketplaceItem = { id: r.won.id, name: r.won.name ?? r.won.id, value: r.won.value, rarity: r.won.rarity, weight: 0 }
          next.ownedAvatarEffects = prev.ownedAvatarEffects.some(i => i.id === r.won.id) ? prev.ownedAvatarEffects : [...prev.ownedAvatarEffects, item]
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

  async function handleEquip(type: 'name-color' | 'avatar' | 'tag', itemId: string | null) {
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
        return { ...prev, avatarEffect: itemId ? prev.ownedAvatarEffects.find(i => i.id === itemId)?.value ?? null : null }
      })
    } catch { /* ignore */ }
    finally { setEquipping(null) }
  }

  async function handleEquipBadge(itemId: string | null) {
    if (equipping || !inv) return
    setEquipping('badge' + (itemId ?? 'null'))
    try {
      const r = await api.equipBadge(itemId)
      setInv(prev => prev ? { ...prev, badge: r.badge } : prev)
    } catch { /* ignore */ }
    finally { setEquipping(null) }
  }

  async function doQuicksell(itemType: 'tag' | 'name-color' | 'avatar', itemId: string) {
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
        const items = [...prev.ownedAvatarEffects]
        const idx = items.findIndex(i => i.id === itemId)
        if (idx !== -1) items.splice(idx, 1)
        return { ...prev, coins: res.coins, ownedAvatarEffects: items }
      })
    } catch { /* ignore */ }
    finally { setQuickselling(null) }
  }

  function handleQuicksell(itemType: 'tag' | 'name-color' | 'avatar', itemId: string) {
    if (!inv) return
    const allOfType = itemType === 'tag'
      ? (inv.ownedTags ?? [])
      : itemType === 'name-color'
        ? inv.ownedNameColors
        : inv.ownedAvatarEffects
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
    const result: Array<{ type: 'tag' | 'name-color' | 'avatar'; id: string; name: string; rarity: string; count: number; coinsEach: number }> = []

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
    const avatarMap = new Map<string, number>()
    for (const p of inv.ownedAvatarEffects) avatarMap.set(p.id, (avatarMap.get(p.id) ?? 0) + 1)
    for (const [id, cnt] of avatarMap) {
      if (cnt > 1) {
        const p = inv.ownedAvatarEffects.find(x => x.id === id)!
        result.push({ type: 'avatar', id, name: p.name, rarity: p.rarity, count: cnt - 1, coinsEach: QUICKSELL_PRICES[p.rarity] ?? 5 })
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

  async function handleDevGrant(grantType: 'coins' | 'name-color' | 'avatar' | 'tag') {
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

  function addOffer(item: TradeItem, maxQty: number) {
    setSelectedOffer(prev => {
      const selected = prev.filter(i => i.id === item.id && i.type === item.type).length
      if (selected >= maxQty) return prev
      return [...prev, item]
    })
  }

  function removeOffer(item: TradeItem) {
    setSelectedOffer(prev => {
      const idx = prev.findLastIndex(i => i.id === item.id && i.type === item.type)
      if (idx === -1) return prev
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)]
    })
  }

  function addRequest(item: TradeItem, maxQty: number) {
    setSelectedRequest(prev => {
      const selected = prev.filter(i => i.id === item.id && i.type === item.type).length
      if (selected >= maxQty) return prev
      return [...prev, item]
    })
  }

  function removeRequest(item: TradeItem) {
    setSelectedRequest(prev => {
      const idx = prev.findLastIndex(i => i.id === item.id && i.type === item.type)
      if (idx === -1) return prev
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)]
    })
  }

  async function handleSendTrade() {
    if (!tradeTarget || (selectedOffer.length === 0 && selectedRequest.length === 0) || sendingTrade) return
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
    ? tradeTarget.avatarEffects.filter(p => !tradeInvQ || p.name.toLowerCase().includes(tradeInvQ))
    : []

  function renderInventoryItem(
    item: { id: string; name?: string; tag?: string; tagColor?: string; value?: string; rarity: string },
    type: 'tag' | 'name-color' | 'avatar',
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
          {type === 'avatar' && (
            <div className={avatarClass(item.value)} style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', ...avatarStyle(item.value) }} />
          )}
          {type === 'tag' && (
            (item.tagColor === 'verified-yellow' || item.tagColor === 'verified-blue')
              ? <VerifiedBadge variant={item.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} />
              : <span
                  className={tagCssClass(item.tag, item.tagColor)}
                  style={item.tagColor === 'curse'
                    ? { fontSize: 11, fontWeight: 800, padding: '1px 3px', borderRadius: 4, border: '1.5px solid #ff0000' }
                    : { fontSize: 13, fontWeight: 700, color: isAnimatedTag(item.tag) ? undefined : item.tagColor ?? '#6B7280' }}
                >{truncateTag(item.tag ?? '')}</span>
          )}
        </button>
        {type !== 'tag' && (
          <span className={item.value === 'rainbow' ? 'name-rainbow' : item.value === 'curse' ? 'name-curse' : ''} style={{ flex: 1, fontSize: 13, fontWeight: 600, ...(type === 'name-color' ? ncStyle(item.value, 'var(--text)') : { color: 'var(--text)' }) }}>
            {item.name ?? item.tag}
          </span>
        )}
        {type === 'tag' && (
          (item.tagColor === 'verified-yellow' || item.tagColor === 'verified-blue')
            ? <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7 }}>
                <VerifiedBadge variant={item.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} />
                <span style={{ fontSize: 13, fontWeight: 700, color: item.tagColor === 'verified-yellow' ? '#EAB308' : '#1D9BF0' }}>
                  {item.tagColor === 'verified-yellow' ? 'Verified' : 'Partner'}
                </span>
              </span>
            : <span
                className={tagCssClass(item.tag, item.tagColor)}
                style={item.tagColor === 'curse'
                  ? { flex: 1, fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '2px 7px', borderRadius: 4, border: '1.5px solid #ff0000', display: 'inline-block', maxWidth: 'max-content' }
                  : { flex: 1, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isAnimatedTag(item.tag) ? undefined : item.tagColor ?? '#6B7280' }}
              >{item.tag}</span>
        )}
        <RarityBadge rarity={item.rarity} itemId={item.id} />
        {count > 1 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 99, padding: '1px 7px' }}>x{count}</span>
        )}

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const, justifyContent: 'flex-end' }}>
          {/* "X listed" info chip — no delist here, go to My Listings tab */}
          {isListed && (
            <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, background: '#6366f115', border: '1px solid #6366f133', borderRadius: 99, padding: '2px 7px', whiteSpace: 'nowrap' as const }}>
              {myActiveListings.filter(l => l.itemType === type && l.itemId === item.id).length} listed
            </span>
          )}
          {count > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            {type === 'tag' && item.tagColor === 'verified-yellow' ? (
              <button
                onClick={() => void handleEquipBadge(inv?.badge === 'verified-yellow' ? null : 'verified')}
                disabled={!!equipping}
                style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${inv?.badge === 'verified-yellow' ? 'var(--border)' : '#EAB308'}`, background: inv?.badge === 'verified-yellow' ? 'var(--surface-2)' : '#EAB30818', color: inv?.badge === 'verified-yellow' ? 'var(--text-muted)' : '#EAB308', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                {inv?.badge === 'verified-yellow' ? 'Unequip Badge' : 'Equip Badge'}
              </button>
            ) : type === 'tag' && item.tagColor === 'verified-blue' ? (
              <button
                onClick={() => void handleEquipBadge(inv?.badge === 'verified-blue' ? null : 'verified-blue')}
                disabled={!!equipping}
                style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${inv?.badge === 'verified-blue' ? 'var(--border)' : '#1D9BF0'}`, background: inv?.badge === 'verified-blue' ? 'var(--surface-2)' : '#1D9BF018', color: inv?.badge === 'verified-blue' ? 'var(--text-muted)' : '#1D9BF0', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                {inv?.badge === 'verified-blue' ? 'Unequip Badge' : 'Equip Badge'}
              </button>
            ) : (
              <button
                onClick={() => void handleEquip(type, isEquipped ? null : item.id)}
                disabled={!!equipping}
                style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${isEquipped ? 'var(--border)' : 'var(--primary)'}`, background: isEquipped ? 'var(--surface-2)' : 'transparent', color: isEquipped ? 'var(--text-muted)' : 'var(--primary)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                {isEquipped ? 'Unequip' : 'Equip'}
              </button>
            )}
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
                  <span className={tagCssClass(item.tag, item.tagColor)} style={{ fontSize: 12, fontWeight: 800, color: isAnimatedTag(item.tag) || item.tagColor === 'curse' ? undefined : item.tagColor ?? '#6B7280' }}>[{item.tag}]</span>
                ) : item.type === 'name-color' ? (
                  <span className={item.value === 'rainbow' ? 'name-rainbow' : item.value === 'curse' ? 'name-curse' : ''} style={{ fontSize: 12, fontWeight: 800, color: (item.value === 'rainbow' || item.value === 'curse') ? undefined : item.value }}>{inv?.name ?? 'Username'}</span>
                ) : (
                  <div className={avatarClass(item.value)} style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, ...avatarStyle(item.value) }} />
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

      {/* Free Spin */}
      {(() => {
        const onCooldown = !!freeSpinCooldownUntil && new Date() < freeSpinCooldownUntil
        const RARITY_COLORS: Record<string, string> = { Common: '#6B7280', Uncommon: '#3B82F6', Rare: '#8B5CF6', Epic: '#F97316', Legendary: '#FACC15', Mythic: '#EAB308' }
        const rc = freeSpinResult ? (RARITY_COLORS[freeSpinResult.rarity] ?? '#EAB308') : '#EAB308'
        return (
          <div className="ns-card" style={{ padding: 18, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: '1px solid rgba(234,179,8,0.2)' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.8px', color: '#EAB308', marginBottom: 2 }}>Free Spin</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Win coins • Every 6 hours</p>
              {freeSpinResult && (
                <p style={{ fontSize: 13, fontWeight: 700, color: rc, marginTop: 4 }}>
                  +{freeSpinResult.reward.toLocaleString()} coins — {freeSpinResult.rarity}!
                </p>
              )}
              {onCooldown && freeSpinCountdown && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Next spin in <strong style={{ color: 'var(--text)' }}>{freeSpinCountdown}</strong>
                </p>
              )}
            </div>
            <button
              onClick={() => { setFreeSpinResult(null); setFreeSpinOpen(true) }}
              disabled={onCooldown}
              style={{ padding: '12px 20px', borderRadius: 10, border: 'none', background: onCooldown ? 'var(--surface-2)' : '#EAB308', color: onCooldown ? 'var(--text-muted)' : '#000', fontWeight: 700, fontSize: 14, cursor: onCooldown ? 'not-allowed' : 'pointer', opacity: onCooldown ? 0.6 : 1, flexShrink: 0 }}
            >
              {onCooldown ? 'On Cooldown' : '🎰 Free Spin'}
            </button>
          </div>
        )
      })()}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {(['boxes', 'shop', 'trade', 'trader', 'inventory', 'leaderboard', 'catalog'] as Tab[]).map(t => (
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
            {t === 'trader' && '🧙 Trader'}
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
                : <div className={tagCssClass(result.won.tag, result.won.tagColor)} style={{ fontSize: 22, fontWeight: 800, color: isAnimatedTag(result.won.tag) || result.won.tagColor === 'curse' ? undefined : result.won.tagColor ?? '#6B7280', marginBottom: 4 }}>
                    {result.won.tag}
                  </div>
            ) : result.won.type === 'name-color' ? (
              <div className={isRainbow ? 'name-rainbow' : result.won.value === 'curse' ? 'name-curse' : ''} style={{ fontSize: 24, fontWeight: 800, color: (isRainbow || result.won.value === 'curse') ? undefined : result.won.value, marginBottom: 4 }}>
                {result.won.name}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div
                  className={avatarClass(result.won.value)}
                  style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#FFFFFF', ...avatarStyle(result.won.value) }}
                >✦</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{result.won.name}</div>
              </div>
            )

            // Fill effects replace the entire circle — show a pure div, no image
            const AVATAR_FILL_EFFECTS = new Set(['rainbow', 'glow-gold', 'frame-black', 'fill-white', 'unobtainable-curse'])
            const isPfpFill = result.won.type === 'avatar' && AVATAR_FILL_EFFECTS.has(result.won.value ?? '')
            const effectStyle = avatarStyle(result.won.type === 'avatar' ? result.won.value : undefined)
            const dummyImgStyle: React.CSSProperties = {
              ...(effectStyle.border     ? { border:     effectStyle.border }     : {}),
              ...(effectStyle.boxShadow  ? { boxShadow:  effectStyle.boxShadow }  : {}),
            }

            const dummyComment = (
              <div style={{ background: 'var(--surface-2,#1a1a1a)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 4px', border: '1px solid var(--border)', textAlign: 'left' as const }}>
                {isPfpFill ? (
                  <div
                    className={avatarClass(result.won.value)}
                    style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, ...effectStyle }}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={DUMMY_PFP}
                    alt={inv?.name ?? 'User'}
                    className={result.won.type === 'avatar' ? avatarClass(result.won.value) : ''}
                    style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' as const, flexShrink: 0, ...dummyImgStyle }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' as const }}>
                    <span
                      className={result.won.type === 'name-color' && isRainbow ? 'name-rainbow' : result.won.type === 'name-color' && result.won.value === 'curse' ? 'name-curse' : ''}
                      style={{ fontSize: 13, fontWeight: 700, color: result.won.type === 'name-color' && !isRainbow && result.won.value !== 'curse' ? result.won.value : 'var(--text)' }}
                    >
                      {inv?.name ?? 'Username'}
                    </span>
                    {result.won.type === 'tag' ? (
                      (result.won.tagColor === 'verified-yellow' || result.won.tagColor === 'verified-blue')
                        ? <VerifiedBadge variant={result.won.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} size={20} />
                        : <span className={tagCssClass(result.won.tag, result.won.tagColor)} style={{ fontSize: 12, fontWeight: 700, color: isAnimatedTag(result.won.tag) || result.won.tagColor === 'curse' ? undefined : (result.won.tagColor ?? '#6B7280') }}>
                            {result.won.tag}
                          </span>
                    ) : inv?.tag ? (
                      (inv.tagColor === 'verified-yellow' || inv.tagColor === 'verified-blue')
                        ? <VerifiedBadge variant={inv.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} size={16} />
                        : <span style={{ fontSize: 12, fontWeight: 700, color: inv.tagColor ?? '#6B7280' }}>[{inv.tag}]</span>
                    ) : null}
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
              {!result.alreadyHad && (
                <div style={{ display: 'inline-block', background: '#22C55E', color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: '1px', borderRadius: 6, padding: '2px 8px', marginBottom: 6 }}>NEW</div>
              )}
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
                    onClick={() => void handleEquip(result.won.type === 'name-color' ? 'name-color' : 'avatar', result.won.id)}
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
          {/* Sub-tab nav */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
            {(['browse', 'my-listings'] as const).map(st => (
              <button
                key={st}
                onClick={() => setShopSubTab(st)}
                style={{ padding: '8px 18px', borderRadius: '8px 8px 0 0', border: 'none', borderBottom: shopSubTab === st ? '2px solid var(--primary)' : '2px solid transparent', background: 'transparent', color: shopSubTab === st ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: -1 }}
              >
                {st === 'browse' ? '🏪 Browse' : `📋 My Listings${myActiveListings.length > 0 ? ` (${myActiveListings.length})` : ''}`}
              </button>
            ))}
          </div>

          {shopSubTab === 'browse' && (
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
                      <div
                        className="ns-card"
                        style={{ padding: '12px 12px 10px', display: 'flex', flexDirection: 'column', gap: 8, border: `1px solid ${rarityColor}33`, borderTop: `3px solid ${rarityColor}`, cursor: 'pointer' }}
                        onClick={() => setPreviewItem({ type: listing.itemType as 'tag' | 'name-color' | 'avatar', id: listing.itemId, name: listing.itemName, rarity: listing.itemRarity, value: listing.itemValue })}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <ItemIcon item={{ type: listing.itemType, itemValue: listing.itemValue, itemType: listing.itemType, itemId: listing.itemId }} />
                          <RarityBadge rarity={listing.itemRarity} itemId={listing.itemId} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{listing.itemName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          by{' '}
                          <button
                            onClick={e => { e.stopPropagation(); void openProfile(listing.seller.id) }}
                            className={listing.seller.nameColor === 'rainbow' ? 'name-rainbow' : listing.seller.nameColor === 'curse' ? 'name-curse' : ''}
                            style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, ...ncStyle(listing.seller.nameColor, 'var(--text)') }}
                          >
                            {listing.seller.name ?? 'Unknown'}
                          </button>
                        </div>
                        <div style={{ marginTop: 'auto' as const, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 15, fontWeight: 800, color: '#EAB308' }}>
                            <CoinIcon size={13} />{listing.price.toLocaleString()}
                          </div>
                          {msg ? (
                            <div style={{ fontSize: 10, color: msg.startsWith('✓') ? '#22C55E' : '#EF4444', fontWeight: 700 }}>{msg}</div>
                          ) : isMine ? (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>Your listing</span>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); void handleBuyListing(listing.id) }}
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

          {shopSubTab === 'my-listings' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>
                  Your active listings
                </p>
                <button onClick={() => { fetchMyActiveListings(); fetchListings() }} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                  ↻ Refresh
                </button>
              </div>

              {myActiveListings.length === 0 ? (
                <div className="ns-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  You have no active listings. Go to <strong>Inventory</strong> to list an item.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {myActiveListings.map(listing => {
                    const rarityColor = getRarityColor(listing.itemRarity, listing.itemId)
                    return (
                      <div key={listing.id} className="ns-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: `1px solid ${rarityColor}33`, borderLeft: `4px solid ${rarityColor}` }}>
                        <ItemIcon item={{ type: listing.itemType, itemValue: listing.itemValue, itemType: listing.itemType, itemId: listing.itemId }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{listing.itemName}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <RarityBadge rarity={listing.itemRarity} itemId={listing.itemId} />
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{listing.itemType}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 15, fontWeight: 800, color: '#EAB308', flexShrink: 0 }}>
                          <CoinIcon size={13} />{listing.price.toLocaleString()}
                        </div>
                        <button
                          onClick={() => void handleCancelListing(listing.id)}
                          disabled={cancellingListing === listing.id}
                          style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #EF4444', background: 'transparent', color: '#EF4444', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                        >
                          {cancellingListing === listing.id ? '…' : 'Delist'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
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
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name ?? 'Unknown'}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {u.tag && <div className={tagCssClass(u.tag, u.tagColor)} style={{ fontSize: 11, color: isAnimatedTag(u.tag) || u.tagColor === 'curse' ? undefined : u.tagColor ?? '#6B7280', fontWeight: 700 }}>[{u.tag}]</div>}
                              {(u.badge === 'verified-yellow' || u.badge === 'verified-blue') && <VerifiedBadge variant={u.badge === 'verified-yellow' ? 'yellow' : 'blue'} size={14} />}
                            </div>
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
                      <div className={tradeTarget.user.nameColor === 'rainbow' ? 'name-rainbow' : tradeTarget.user.nameColor === 'curse' ? 'name-curse' : ''} style={{ fontSize: 13, fontWeight: 700, ...ncStyle(tradeTarget.user.nameColor) }}>{tradeTarget.user.name ?? 'Unknown'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {tradeTarget.user.tag && <div className={tagCssClass(tradeTarget.user.tag, tradeTarget.user.tagColor)} style={{ fontSize: 11, color: isAnimatedTag(tradeTarget.user.tag) || tradeTarget.user.tagColor === 'curse' ? undefined : tradeTarget.user.tagColor ?? '#6B7280', fontWeight: 700 }}>[{tradeTarget.user.tag}]</div>}
                        {(tradeTarget.user.badge === 'verified-yellow' || tradeTarget.user.badge === 'verified-blue') && <VerifiedBadge variant={tradeTarget.user.badge === 'verified-yellow' ? 'yellow' : 'blue'} size={14} />}
                      </div>
                    </div>
                    <button onClick={() => { setTradeTarget(null); setSelectedOffer([]); setSelectedRequest([]) }}
                      style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                      Change
                    </button>
                  </div>

                  {/* ── Trade inventory grids ── */}
                  {(() => {
                    // Deduplicate items by type:id, counting quantity
                    function dedup<T extends { id: string; rarity: string }>(arr: T[]): Array<T & { qty: number }> {
                      const map = new Map<string, T & { qty: number }>()
                      for (const item of arr) {
                        const key = item.id
                        const ex = map.get(key)
                        if (ex) ex.qty++
                        else map.set(key, { ...item, qty: 1 })
                      }
                      return [...map.values()]
                    }

                    // Tile renderer shared by both columns
                    function TradeGrid({ items, accentColor, selectedList, onAdd, onRemove }: {
                      items: Array<TradeItem & { qty: number }>
                      accentColor: string
                      selectedList: TradeItem[]
                      onAdd: (item: TradeItem, maxQty: number) => void
                      onRemove: (item: TradeItem) => void
                    }) {
                      if (items.length === 0) return null
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 6 }}>
                          {items.map(item => {
                            const selCount = selectedList.filter(i => i.id === item.id && i.type === item.type).length
                            const available = item.qty - selCount
                            const borderColor = getRarityBorderColor(item.rarity, item.id)
                            const isRainbowRarity = RARITY_COLOR[item.rarity] === 'rainbow'
                            return (
                              <div key={`${item.type}:${item.id}`} style={{ position: 'relative' as const }}>
                                <div
                                  style={{
                                    position: 'relative' as const,
                                    borderRadius: 8,
                                    border: selCount > 0 ? `2px solid ${accentColor}` : isRainbowRarity ? '2px solid transparent' : `2px solid ${borderColor}44`,
                                    background: selCount > 0
                                      ? `${accentColor}18`
                                      : isRainbowRarity
                                      ? 'linear-gradient(var(--surface-2), var(--surface-2)) padding-box, linear-gradient(135deg, #ff6b6b, #ffd43b, #69db7c, #4dabf7, #cc5de8, #ff6b6b) border-box'
                                      : 'var(--surface-2)',
                                    padding: '8px 4px 6px',
                                    display: 'flex',
                                    flexDirection: 'column' as const,
                                    alignItems: 'center',
                                    gap: 4,
                                    cursor: available > 0 ? 'pointer' : 'default',
                                    opacity: available === 0 ? 0.5 : 1,
                                    minHeight: 76,
                                  }}
                                  onClick={() => onAdd(item, item.qty)}
                                >
                                  {/* Available qty badge (top-right) — shown when > 1 or some are selected */}
                                  {(item.qty > 1 || selCount > 0) && (
                                    <span style={{ position: 'absolute' as const, top: 3, right: 3, fontSize: 9, fontWeight: 800, background: 'var(--surface)', color: available === 0 ? '#EF4444' : 'var(--text-muted)', borderRadius: 99, padding: '1px 4px', border: `1px solid ${available === 0 ? '#EF444466' : 'var(--border)'}`, lineHeight: 1.4 }}>×{available}</span>
                                  )}
                                  {/* Selected count badge (top-left) — shown when any are selected */}
                                  {selCount > 0 && (
                                    <button
                                      style={{ position: 'absolute' as const, top: 2, left: 2, fontSize: 9, fontWeight: 800, color: accentColor, background: `${accentColor}22`, border: `1px solid ${accentColor}66`, borderRadius: 99, padding: '1px 4px', lineHeight: 1.4, cursor: 'pointer' }}
                                      onClick={e => { e.stopPropagation(); onRemove(item) }}
                                      title="Remove one"
                                    >{selCount}✕</button>
                                  )}
                                  {/* Visual */}
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 28, width: '100%' }}>
                                    {item.type === 'tag' ? (
                                      <span
                                        className={tagCssClass(item.tag, item.tagColor)}
                                        style={{ fontSize: 9, fontWeight: 800, padding: '1px 4px', borderRadius: 3, border: `1px solid ${item.tagColor === 'curse' ? '#ff0000' : isAnimatedTag(item.tag) ? undefined : `${item.tagColor ?? '#6B7280'}66`}`, color: isAnimatedTag(item.tag) || item.tagColor === 'curse' ? undefined : item.tagColor ?? '#6B7280', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}
                                      >{item.tag ?? item.id}</span>
                                    ) : item.type === 'name-color' ? (
                                      <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'block', flexShrink: 0, border: '2px solid var(--border)', background: item.value === 'rainbow' ? 'linear-gradient(135deg,#ff6b6b,#ffd43b,#69db7c,#4dabf7)' : item.value === 'curse' ? 'rgba(255,0,0,0.25)' : item.value }} />
                                    ) : (
                                      <div className={avatarClass(item.value)} style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', flexShrink: 0, ...avatarStyle(item.value) }} />
                                    )}
                                  </div>
                                  {/* Name */}
                                  <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: '100%', padding: '0 2px' }}>
                                    {item.name ?? item.tag ?? item.id}
                                  </div>
                                  <RarityBadge rarity={item.rarity} itemId={item.id} />
                                </div>
                                {/* Preview button */}
                                <button
                                  style={{ position: 'absolute' as const, bottom: 4, right: 3, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer', padding: 1, lineHeight: 1, opacity: 0.7 }}
                                  onClick={e => { e.stopPropagation(); setPreviewItem({ type: item.type, id: item.id, name: item.name ?? item.tag ?? item.id, rarity: item.rarity, value: item.value, tagColor: item.tagColor }) }}
                                  title="View item details"
                                >ⓘ</button>
                              </div>
                            )
                          })}
                        </div>
                      )
                    }

                    // Deduplicated item lists for their inventory
                    const theirTagsDedup = dedup(filteredTradeTargetTags.map(t => ({ type: 'tag' as const, id: t.id, tag: t.tag, tagColor: t.tagColor, rarity: t.rarity, name: t.tag })))
                    const theirColorsDedup = dedup(filteredTradeTargetColors.map(c => ({ type: 'name-color' as const, id: c.id, name: c.name, value: c.value, rarity: c.rarity })))
                    const theirPfpDedup = dedup(filteredTradeTargetPfp.map(p => ({ type: 'avatar' as const, id: p.id, name: p.name, value: p.value, rarity: p.rarity })))

                    // Deduplicated item lists for my inventory
                    const myTagsRaw = (inv?.ownedTags ?? []).filter(t => !myListedIds.has(`tag:${t.id}`) && !NON_TRADEABLE_TAG_IDS.has(t.tag) && !NON_TRADEABLE_TAG_IDS.has(t.id) && (!tradeMyQ || t.tag.toLowerCase().includes(tradeMyQ)))
                    const myColorsRaw = (inv?.ownedNameColors ?? []).filter(c => !myListedIds.has(`name-color:${c.id}`) && (!tradeMyQ || c.name.toLowerCase().includes(tradeMyQ)))
                    const myPfpRaw = (inv?.ownedAvatarEffects ?? []).filter(p => !myListedIds.has(`avatar:${p.id}`) && (!tradeMyQ || p.name.toLowerCase().includes(tradeMyQ)))
                    const myTagsDedup = dedup(myTagsRaw.map(t => ({ type: 'tag' as const, id: t.id, tag: t.tag, tagColor: t.tagColor, rarity: t.rarity, name: t.tag })))
                    const myColorsDedup = dedup(myColorsRaw.map(c => ({ type: 'name-color' as const, id: c.id, name: c.name, value: c.value, rarity: c.rarity })))
                    const myPfpDedup = dedup(myPfpRaw.map(p => ({ type: 'avatar' as const, id: p.id, name: p.name, value: p.value, rarity: p.rarity })))

                    const selectedRequestTotal = selectedRequest.reduce((s, i) => s + (prices[`${i.type}:${i.id}`] ?? 0), 0)
                    const selectedOfferTotal = selectedOffer.reduce((s, i) => s + (prices[`${i.type}:${i.id}`] ?? 0), 0)

                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                        {/* Their inventory */}
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.7px', color: 'var(--text-muted)', marginBottom: 6 }}>
                            Their Items — tap to request
                          </div>
                          <input
                            className="ns-input"
                            style={{ width: '100%', height: 30, fontSize: 11, marginBottom: 8, boxSizing: 'border-box' as const, padding: '0 10px' }}
                            placeholder="Search their items…"
                            value={tradeInvSearch}
                            onChange={e => setTradeInvSearch(e.target.value)}
                          />
                          {theirTagsDedup.length === 0 && theirColorsDedup.length === 0 && theirPfpDedup.length === 0 ? (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 12 }}>{tradeInvQ ? 'No matching items' : 'No tradeable items'}</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                              {theirTagsDedup.length > 0 && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)' }}>🏷️ Tags</div>}
                              <TradeGrid items={theirTagsDedup} accentColor="var(--primary)" selectedList={selectedRequest} onAdd={(item, max) => addRequest(item, max)} onRemove={item => removeRequest(item)} />
                              {theirColorsDedup.length > 0 && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)' }}>🎨 Colors</div>}
                              <TradeGrid items={theirColorsDedup} accentColor="var(--primary)" selectedList={selectedRequest} onAdd={(item, max) => addRequest(item, max)} onRemove={item => removeRequest(item)} />
                              {theirPfpDedup.length > 0 && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)' }}>🖼️ PFP</div>}
                              <TradeGrid items={theirPfpDedup} accentColor="var(--primary)" selectedList={selectedRequest} onAdd={(item, max) => addRequest(item, max)} onRemove={item => removeRequest(item)} />
                              {selectedRequest.length > 0 && selectedRequestTotal > 0 && (
                                <div style={{ fontSize: 11, color: '#EAB308', fontWeight: 700, paddingTop: 6, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <CoinIcon size={11} />Selected: {selectedRequestTotal.toLocaleString()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Your inventory */}
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.7px', color: 'var(--text-muted)', marginBottom: 6 }}>
                            Your Items — tap to offer
                          </div>
                          <input
                            className="ns-input"
                            style={{ width: '100%', height: 30, fontSize: 11, marginBottom: 8, boxSizing: 'border-box' as const, padding: '0 10px' }}
                            placeholder="Search your items…"
                            value={tradeMySearch}
                            onChange={e => setTradeMySearch(e.target.value)}
                          />
                          {myTagsDedup.length === 0 && myColorsDedup.length === 0 && myPfpDedup.length === 0 ? (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 12 }}>No items to offer</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                              {myTagsDedup.length > 0 && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)' }}>🏷️ Tags</div>}
                              <TradeGrid items={myTagsDedup} accentColor="#22C55E" selectedList={selectedOffer} onAdd={(item, max) => addOffer(item, max)} onRemove={item => removeOffer(item)} />
                              {myColorsDedup.length > 0 && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)' }}>🎨 Colors</div>}
                              <TradeGrid items={myColorsDedup} accentColor="#22C55E" selectedList={selectedOffer} onAdd={(item, max) => addOffer(item, max)} onRemove={item => removeOffer(item)} />
                              {myPfpDedup.length > 0 && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)' }}>🖼️ PFP</div>}
                              <TradeGrid items={myPfpDedup} accentColor="#22C55E" selectedList={selectedOffer} onAdd={(item, max) => addOffer(item, max)} onRemove={item => removeOffer(item)} />
                              {selectedOffer.length > 0 && selectedOfferTotal > 0 && (
                                <div style={{ fontSize: 11, color: '#EAB308', fontWeight: 700, paddingTop: 6, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <CoinIcon size={11} />Selected: {selectedOfferTotal.toLocaleString()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}

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
                  {selectedOffer.length === 0 && selectedRequest.length > 0 && (
                    <div style={{ fontSize: 12, color: '#F97316', fontWeight: 600, marginBottom: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)' }}>
                      ⚠️ You're offering nothing — this is a gift request
                    </div>
                  )}
                  {selectedOffer.length > 0 && selectedRequest.length === 0 && (
                    <div style={{ fontSize: 12, color: '#F97316', fontWeight: 600, marginBottom: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)' }}>
                      ⚠️ You're asking for nothing — this is a free gift
                    </div>
                  )}
                  <button onClick={() => void handleSendTrade()}
                    disabled={sendingTrade || (selectedOffer.length === 0 && selectedRequest.length === 0) || !inv || inv.coins < 5}
                    style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#FFFFFF', fontWeight: 700, fontSize: 14, cursor: (selectedOffer.length > 0 || selectedRequest.length > 0) ? 'pointer' : 'not-allowed', opacity: (selectedOffer.length === 0 && selectedRequest.length === 0) ? 0.4 : 1 }}>
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
                            <span className={trade.sender.nameColor === 'rainbow' ? 'name-rainbow' : trade.sender.nameColor === 'curse' ? 'name-curse' : ''} style={{ fontSize: 13, fontWeight: 700, ...ncStyle(trade.sender.nameColor) }}>{trade.sender.name ?? 'Unknown'}</span>
                            {trade.sender.tag && <span className={tagCssClass(trade.sender.tag, trade.sender.tagColor)} style={{ fontSize: 11, color: isAnimatedTag(trade.sender.tag) || trade.sender.tagColor === 'curse' ? undefined : trade.sender.tagColor ?? '#6B7280', fontWeight: 700, marginLeft: 6 }}>[{trade.sender.tag}]</span>}
                            {(trade.sender.badge === 'verified-yellow' || trade.sender.badge === 'verified-blue') && <VerifiedBadge variant={trade.sender.badge === 'verified-yellow' ? 'yellow' : 'blue'} size={14} />}
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
                            <span style={{ fontSize: 13, fontWeight: 700 }}>To: </span><span className={trade.receiver.nameColor === 'rainbow' ? 'name-rainbow' : trade.receiver.nameColor === 'curse' ? 'name-curse' : ''} style={{ fontSize: 13, fontWeight: 700, ...ncStyle(trade.receiver.nameColor) }}>{trade.receiver.name ?? 'Unknown'}</span>
                            {trade.receiver.tag && <span className={tagCssClass(trade.receiver.tag, trade.receiver.tagColor)} style={{ fontSize: 11, color: isAnimatedTag(trade.receiver.tag) || trade.receiver.tagColor === 'curse' ? undefined : trade.receiver.tagColor ?? '#6B7280', fontWeight: 700, marginLeft: 6 }}>[{trade.receiver.tag}]</span>}
                            {(trade.receiver.badge === 'verified-yellow' || trade.receiver.badge === 'verified-blue') && <VerifiedBadge variant={trade.receiver.badge === 'verified-yellow' ? 'yellow' : 'blue'} size={14} />}
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
                  {historyTrades.map(trade => {
                    const isTraderTrade = trade.note === 'WANDERING_TRADER'
                    const iAmSender = trade.senderId === currentUserId
                    const otherUser = iAmSender ? trade.receiver : trade.sender
                    const myItems = parseTradeItemsClient(iAmSender ? trade.senderItems : trade.receiverItems)
                    const theirItems = parseTradeItemsClient(iAmSender ? trade.receiverItems : trade.senderItems)
                    const otherLabel = isTraderTrade ? 'Wandering Trader' : (otherUser.name ?? 'User')
                    return (
                    <div key={trade.id} className="ns-card" style={{ padding: 16, borderLeft: `3px solid ${isTraderTrade ? '#A855F7' : '#22C55E'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 16 }}>{isTraderTrade ? '🏕️' : '✅'}</span>
                        <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                          You
                          <span style={{ margin: '0 6px' }}>⇄</span>
                          {otherLabel}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {new Date(trade.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>You gave</div>
                          {renderTradeItems(myItems)}
                        </div>
                        <div style={{ fontSize: 16 }}>⇄</div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>{otherLabel} gave</div>
                          {renderTradeItems(theirItems)}
                        </div>
                      </div>
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

          {(inv?.ownedTags ?? []).length === 0 && (inv?.ownedNameColors ?? []).length === 0 && (inv?.ownedAvatarEffects ?? []).length === 0 && myActiveListings.length === 0 ? (
            <div className="ns-card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Your inventory is empty — spin to get items
            </div>
          ) : (
            <>
              {Object.keys(prices).length > 0 && (() => {
                let worth = 0
                for (const t of (inv?.ownedTags ?? [])) worth += prices[`tag:${t.id}`] ?? 0
                for (const c of (inv?.ownedNameColors ?? [])) worth += prices[`name-color:${c.id}`] ?? 0
                for (const p of (inv?.ownedAvatarEffects ?? [])) worth += prices[`avatar:${p.id}`] ?? 0
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

              {(() => {
                const badgeTags = (inv?.ownedTags ?? []).filter(t => t.tagColor === 'verified-yellow' || t.tagColor === 'verified-blue')
                const badgeListings = myActiveListings.filter(l => l.itemType === 'tag' && !(inv?.ownedTags ?? []).some(t => t.id === l.itemId) && (l.itemValue === 'verified-yellow' || l.itemValue === 'verified-blue'))
                if (badgeTags.length === 0 && badgeListings.length === 0) return null
                return (
                  <div className="ns-card" style={{ padding: 18, marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>🏅 Badges</div>
                    {groupById(byRarity(badgeTags)).map(t =>
                      renderInventoryItem({ id: t.id, tag: t.tag, tagColor: t.tagColor, rarity: t.rarity }, 'tag', false, t.count)
                    )}
                    {badgeListings
                      .filter((l, i, arr) => arr.findIndex(x => x.itemId === l.itemId) === i)
                      .map(l => renderInventoryItem({ id: l.itemId, tag: l.itemName, tagColor: l.itemValue, rarity: l.itemRarity }, 'tag', false, 0))
                    }
                  </div>
                )
              })()}

              {(() => {
                const regularTags = (inv?.ownedTags ?? []).filter(t => t.tagColor !== 'verified-yellow' && t.tagColor !== 'verified-blue')
                const regularTagListings = myActiveListings.filter(l => l.itemType === 'tag' && !(inv?.ownedTags ?? []).some(t => t.id === l.itemId) && l.itemValue !== 'verified-yellow' && l.itemValue !== 'verified-blue')
                if (regularTags.length === 0 && regularTagListings.length === 0) return null
                return (
                  <div className="ns-card" style={{ padding: 18, marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>🏷️ Tags</div>
                    {groupById(byRarity(regularTags)).map(t =>
                      renderInventoryItem({ id: t.id, tag: t.tag, tagColor: t.tagColor, rarity: t.rarity }, 'tag', inv?.tag === t.tag, t.count)
                    )}
                    {regularTagListings
                      .filter((l, i, arr) => arr.findIndex(x => x.itemId === l.itemId) === i)
                      .map(l => renderInventoryItem({ id: l.itemId, tag: l.itemName, tagColor: l.itemValue, rarity: l.itemRarity }, 'tag', false, 0))
                    }
                  </div>
                )
              })()}

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

              {((inv?.ownedAvatarEffects ?? []).length > 0 || myActiveListings.some(l => l.itemType === 'avatar')) && (
                <div className="ns-card" style={{ padding: 18, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>🖼️ Profile Picture Effects</div>
                  {groupById(byRarity(inv!.ownedAvatarEffects)).map(item =>
                    renderInventoryItem({ id: item.id, name: item.name, value: item.value, rarity: item.rarity }, 'avatar', inv!.avatarEffect === item.value, item.count)
                  )}
                  {myActiveListings
                    .filter(l => l.itemType === 'avatar' && !(inv?.ownedAvatarEffects ?? []).some(p => p.id === l.itemId))
                    .filter((l, i, arr) => arr.findIndex(x => x.itemId === l.itemId) === i)
                    .map(l => renderInventoryItem({ id: l.itemId, name: l.itemName, value: l.itemValue, rarity: l.itemRarity }, 'avatar', false, 0))
                  }
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── WANDERING TRADER TAB ── */}
      {tab === 'trader' && (
        <>
          {/* NPC header */}
          <div className="ns-card" style={{ padding: '20px 22px', marginBottom: 18, background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(234,179,8,0.06) 100%)', border: '1px solid rgba(139,92,246,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 48, lineHeight: 1 }}>🧙</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>The Wandering Trader</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 10 }}>
                  I travel far and wide collecting rarities. I'll buy your items — but don't expect full value.
                  And yes, I have <em>everything</em>, but my prices reflect my trouble.
                </div>
                {traderStatus && (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ padding: '4px 12px', borderRadius: 99, background: traderStatus.sellsRemaining > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', border: `1px solid ${traderStatus.sellsRemaining > 0 ? '#22C55E55' : '#6B728055'}`, fontSize: 11, fontWeight: 700, color: traderStatus.sellsRemaining > 0 ? '#22C55E' : 'var(--text-muted)' }}>
                      Sells: {traderStatus.sellsRemaining}/3 left today
                    </div>
                    <div style={{ padding: '4px 12px', borderRadius: 99, background: traderStatus.buysRemaining > 0 ? 'rgba(59,130,246,0.12)' : 'rgba(107,114,128,0.12)', border: `1px solid ${traderStatus.buysRemaining > 0 ? '#3B82F655' : '#6B728055'}`, fontSize: 11, fontWeight: 700, color: traderStatus.buysRemaining > 0 ? '#3B82F6' : 'var(--text-muted)' }}>
                      Buys: {traderStatus.buysRemaining}/3 left today
                    </div>
                    <div style={{ padding: '4px 12px', borderRadius: 99, background: traderStatus.tradesRemaining > 0 ? 'rgba(139,92,246,0.12)' : 'rgba(107,114,128,0.12)', border: `1px solid ${traderStatus.tradesRemaining > 0 ? '#8B5CF655' : '#6B728055'}`, fontSize: 11, fontWeight: 700, color: traderStatus.tradesRemaining > 0 ? '#8B5CF6' : 'var(--text-muted)' }}>
                      Trades: {traderStatus.tradesRemaining}/3 left today
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {(['sell', 'buy', 'trade'] as TraderSubTab[]).map(st => (
              <button key={st} onClick={() => { setTraderSubTab(st); setTraderMsg(''); setTradeOfferItems([]); setTradeWantItems([]) }}
                style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: `1px solid ${traderSubTab === st ? 'var(--primary)' : 'var(--border)'}`, background: traderSubTab === st ? 'var(--primary)18' : 'transparent', color: traderSubTab === st ? 'var(--primary)' : 'var(--text-muted)', fontWeight: traderSubTab === st ? 700 : 500, fontSize: 13, cursor: 'pointer' }}>
                {st === 'sell' ? '💰 Sell' : st === 'buy' ? '🛒 Buy' : '🔄 Trade'}
              </button>
            ))}
          </div>

          {traderMsg && (
            <div style={{ fontSize: 13, fontWeight: 600, color: traderMsg.startsWith('✓') ? '#22C55E' : '#EF4444', marginBottom: 14, padding: '10px 14px', borderRadius: 9, background: traderMsg.startsWith('✓') ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${traderMsg.startsWith('✓') ? '#22C55E44' : '#EF444444'}` }}>
              {traderMsg}
            </div>
          )}

          {/* SELL sub-tab */}
          {traderSubTab === 'sell' && <TraderSellGrid inv={inv} prices={prices} onSell={setTraderSellConfirm} />}

          {/* BUY sub-tab */}
          {traderSubTab === 'buy' && (
            <TraderBuyGrid
              catalog={traderCatalog}
              catalogLoaded={traderCatalogLoaded}
              coins={inv?.coins ?? 0}
              search={traderSearch}
              rarityFilter={traderRarityFilter}
              onSearchChange={setTraderSearch}
              onRarityChange={setTraderRarityFilter}
              onBuy={setTraderBuyConfirm}
            />
          )}

          {/* TRADE sub-tab — item-for-item swap */}
          {traderSubTab === 'trade' && (() => {
            const offerEstTotal = tradeOfferItems.reduce((s, i) => s + (prices[`${i.type}:${i.id}`] ?? 0), 0)
            const wantPriceTotal = tradeWantItems.reduce((s, i) => s + i.traderPrice, 0)
            const canTrade = tradeOfferItems.length > 0 && tradeWantItems.length > 0 && offerEstTotal >= wantPriceTotal

            // Deduplicated sell-able inventory
            const invItems: Array<{ type: 'tag' | 'name-color' | 'avatar'; id: string; name: string; rarity: string; tagColor?: string; value?: string; count: number }> = (() => {
              const raw = [
                ...(inv?.ownedTags ?? []).map(t => ({ type: 'tag' as const, id: t.id, name: t.tag, rarity: t.rarity, tagColor: t.tagColor, value: undefined as string | undefined })),
                ...(inv?.ownedNameColors ?? []).map(c => ({ type: 'name-color' as const, id: c.id, name: c.name, rarity: c.rarity, tagColor: undefined as string | undefined, value: c.value })),
                ...(inv?.ownedAvatarEffects ?? []).map(p => ({ type: 'avatar' as const, id: p.id, name: p.name, rarity: p.rarity, tagColor: undefined as string | undefined, value: p.value })),
              ].filter(i => !SELL_SKIP.has(i.id))
              const seen = new Map<string, { type: 'tag' | 'name-color' | 'avatar'; id: string; name: string; rarity: string; tagColor?: string; value?: string; count: number }>()
              for (const item of raw) {
                const key = `${item.type}:${item.id}`
                const ex = seen.get(key)
                if (ex) ex.count++
                else seen.set(key, { ...item, count: 1 })
              }
              return Array.from(seen.values())
            })()

            return (
              <>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, padding: '8px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  Offer items from your inventory. The trader accepts if your total est value covers his prices.
                </div>

                {/* Offer section */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                    Your Offer — Est Value: <span style={{ color: offerEstTotal >= wantPriceTotal && tradeOfferItems.length > 0 ? '#22C55E' : '#EAB308' }}>{offerEstTotal.toLocaleString()} coins</span>
                  </div>
                  {tradeOfferItems.length > 0 && (() => {
                    const chipGroups = Array.from(
                      tradeOfferItems.reduce((m, i) => {
                        const k = `${i.type}:${i.id}`
                        const ex = m.get(k)
                        if (ex) ex.count++; else m.set(k, { ...i, count: 1 })
                        return m
                      }, new Map<string, { type: 'tag' | 'name-color' | 'avatar'; id: string; name: string; rarity: string; count: number }>()).values()
                    )
                    return (
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 10 }}>
                        {chipGroups.map(item => {
                          const color = getRarityBorderColor(item.rarity, item.id)
                          return (
                            <div key={`${item.type}:${item.id}`}
                              onClick={() => {
                                // remove the last occurrence of this item
                                setTradeOfferItems(prev => {
                                  const idx = [...prev].reverse().findIndex(x => x.type === item.type && x.id === item.id)
                                  if (idx === -1) return prev
                                  const realIdx = prev.length - 1 - idx
                                  return prev.filter((_, i) => i !== realIdx)
                                })
                              }}
                              style={{ padding: '5px 10px', borderRadius: 8, border: `1.5px solid ${color}66`, background: `${color}18`, cursor: 'pointer', fontSize: 11, fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 5 }}>
                              {item.type === 'tag' ? `[${item.name}]` : item.name}
                              {item.count > 1 && <span style={{ fontSize: 10, opacity: 0.9 }}>×{item.count}</span>}
                              <span style={{ fontSize: 10, opacity: 0.7 }}>✕</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 6 }}>
                    {invItems.map(item => {
                      const offerCount = tradeOfferItems.filter(x => x.type === item.type && x.id === item.id).length
                      const isFull = offerCount >= item.count
                      const color = getRarityBorderColor(item.rarity, item.id)
                      const estVal = prices[`${item.type}:${item.id}`] ?? 0
                      return (
                        <button key={`${item.type}:${item.id}`}
                          onClick={() => {
                            if (!isFull) setTradeOfferItems(prev => [...prev, { type: item.type, id: item.id, name: item.name, rarity: item.rarity }])
                          }}
                          style={{ padding: '8px 4px', borderRadius: 9, border: `2px solid ${offerCount > 0 ? color : color + '33'}`, background: offerCount > 0 ? `${color}22` : 'var(--surface-2)', cursor: isFull ? 'not-allowed' : 'pointer', opacity: isFull ? 0.5 : 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4 }}>
                          <TraderItemPreview type={item.type} id={item.id} name={item.name} tagColor={item.tagColor} value={item.value} rarity={item.rarity} />
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>
                            {offerCount > 0 ? `${offerCount}/${item.count}` : `x${item.count.toLocaleString()}`}
                          </div>
                          <div style={{ fontSize: 9, color: '#EAB308', fontWeight: 600 }}>{estVal > 0 ? estVal.toLocaleString() : '—'}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Want section */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                    You Want — Trader Price: <span style={{ color: wantPriceTotal > offerEstTotal && tradeWantItems.length > 0 ? '#EF4444' : '#8B5CF6' }}>{wantPriceTotal.toLocaleString()} coins</span>
                  </div>
                  {tradeWantItems.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 10 }}>
                      {tradeWantItems.map(item => {
                        const color = getRarityBorderColor(item.rarity, item.id)
                        return (
                          <div key={`${item.type}:${item.id}`} onClick={() => setTradeWantItems(prev => prev.filter(x => !(x.type === item.type && x.id === item.id)))}
                            style={{ padding: '5px 10px', borderRadius: 8, border: `1.5px solid ${color}66`, background: `${color}18`, cursor: 'pointer', fontSize: 11, fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 5 }}>
                            {item.type === 'tag' ? `[${item.name}]` : item.name}
                            <span style={{ fontSize: 10, opacity: 0.7 }}>✕</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {!traderCatalogLoaded ? (
                    <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>Loading catalog…</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 6 }}>
                      {traderCatalog.map(item => {
                        const isSelected = tradeWantItems.some(x => x.type === item.type && x.id === item.id)
                        const color = getRarityBorderColor(item.rarity, item.id)
                        return (
                          <button key={`${item.type}:${item.id}`}
                            onClick={() => {
                              if (isSelected) setTradeWantItems(prev => prev.filter(x => !(x.type === item.type && x.id === item.id)))
                              else setTradeWantItems(prev => [...prev, item])
                            }}
                            style={{ padding: '8px 4px', borderRadius: 9, border: `2px solid ${isSelected ? color : color + '33'}`, background: isSelected ? `${color}22` : 'var(--surface-2)', cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4 }}>
                            <TraderItemPreview type={item.type} id={item.id} name={item.name} tagColor={item.tagColor} value={item.value} rarity={item.rarity} />
                            <div style={{ fontSize: 9, color: '#8B5CF6', fontWeight: 600 }}>{item.traderPrice.toLocaleString()}</div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Value balance bar */}
                {(tradeOfferItems.length > 0 || tradeWantItems.length > 0) && (
                  <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--surface-2)', border: `1px solid ${canTrade ? '#22C55E44' : '#EF444444'}`, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <div style={{ color: 'var(--text-muted)' }}>
                      Offer est: <strong style={{ color: '#EAB308' }}>{offerEstTotal.toLocaleString()}</strong>
                    </div>
                    <div style={{ color: canTrade ? '#22C55E' : '#EF4444', fontWeight: 700, fontSize: 13 }}>
                      {canTrade ? '✓ Deal accepted' : offerEstTotal < wantPriceTotal ? `↑ Need ${(wantPriceTotal - offerEstTotal).toLocaleString()} more` : 'Select items'}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      Trader asks: <strong style={{ color: '#8B5CF6' }}>{wantPriceTotal.toLocaleString()}</strong>
                    </div>
                  </div>
                )}

                <button
                  disabled={!canTrade || traderBusy}
                  onClick={async () => {
                    if (!canTrade || traderBusy) return
                    setTraderBusy(true)
                    setTraderMsg('')
                    try {
                      const r = await api.traderTrade(
                        tradeOfferItems.map(i => ({ type: i.type, id: i.id })),
                        tradeWantItems.map(i => ({ type: i.type, id: i.id })),
                      )
                      setTradeOfferItems([])
                      setTradeWantItems([])
                      setTraderMsg(`✓ Trade complete! ${r.tradesRemaining} trades left today.`)
                      api.traderStatus().then(setTraderStatus).catch(() => {})
                      refreshInventory()
                    } catch (e) {
                      setTraderMsg(e instanceof ApiError ? e.message : 'Trade failed')
                    } finally {
                      setTraderBusy(false)
                    }
                  }}
                  style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: canTrade && !traderBusy ? 'linear-gradient(135deg,#8B5CF6,#6D28D9)' : 'var(--surface-2)', color: canTrade && !traderBusy ? '#fff' : 'var(--text-muted)', fontWeight: 700, fontSize: 14, cursor: canTrade && !traderBusy ? 'pointer' : 'not-allowed', opacity: traderBusy ? 0.6 : 1 }}>
                  {traderBusy ? 'Trading…' : '🔄 Confirm Trade'}
                </button>
              </>
            )
          })()}
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
                    <div className={avatarClass(entry.avatarEffect)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', flexShrink: 0, ...avatarStyle(entry.avatarEffect) }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => openProfile(entry.id)}
                          className={entry.nameColor === 'rainbow' ? 'name-rainbow' : entry.nameColor === 'curse' ? 'name-curse' : ''}
                          style={{ background: 'none', border: 'none', padding: 0, fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', ...ncStyle(entry.nameColor, 'var(--text)') }}>
                          {entry.name ?? `User #${entry.id}`}
                        </button>
                        {isMe && <span style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.15)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>YOU</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {entry.tag && (
                          entry.tagColor === 'verified-yellow' || entry.tagColor === 'verified-blue'
                            ? <VerifiedBadge variant={entry.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} size={14} />
                            : <span
                                className={tagCssClass(entry.tag, entry.tagColor)}
                                style={{ fontSize: 11, fontWeight: 700, color: isAnimatedTag(entry.tag) || entry.tagColor === 'curse' ? undefined : entry.tagColor ?? '#6B7280' }}
                              >[{entry.tag}]</span>
                        )}
                        {(entry.badge === 'verified-yellow' || entry.badge === 'verified-blue') && <VerifiedBadge variant={entry.badge === 'verified-yellow' ? 'yellow' : 'blue'} size={14} />}
                      </div>
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
        const isBadge = (i: CatalogItem) => i.type === 'tag' && (i.tagColor === 'verified-yellow' || i.tagColor === 'verified-blue')
        const sections: Array<{ label: string; id: string; filter: (i: CatalogItem) => boolean }> = [
          { label: '🏅 Badges',                  id: 'badge',      filter: i => isBadge(i) },
          { label: '🏷️ Tags',                    id: 'tag',        filter: i => i.type === 'tag' && !isBadge(i) },
          { label: '🎨 Name Colors',             id: 'name-color', filter: i => i.type === 'name-color' },
          { label: '🖼️ Profile Picture Effects', id: 'avatar',        filter: i => i.type === 'avatar' },
        ]
        const rarityOrder: Record<string, number> = { Mythic: 0, Legendary: 1, Epic: 2, Rare: 3, Uncommon: 4, Common: 5 }
        return (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, marginTop: -8 }}>Every single item — click any item to see who owns it.</p>
            {sections.map(sec => {
              const items = CATALOG_ALL_ITEMS
                .filter(i => sec.filter(i))
                .sort((a, b) => (rarityOrder[a.rarity] ?? 9) - (rarityOrder[b.rarity] ?? 9))
              if (items.length === 0) return null
              return (
                <div key={sec.id} className="ns-card" style={{ padding: 18, marginBottom: 16 }}>
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
                            {item.type === 'avatar' && (
                              <div className={avatarClass(item.value)} style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', ...avatarStyle(item.value) }} />
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
                                      className={tagCssClass(item.name, item.tagColor)}
                                      style={{ fontSize: 11, fontWeight: 800, color: isAnimatedTag(item.name) ? undefined : item.tagColor ?? '#6B7280' }}
                                    >{truncateTag(item.name ?? '')}</span>
                            )}
                          </div>
                          {/* Name */}
                          <span
                            className={item.type === 'name-color' && item.value === 'rainbow' ? 'name-rainbow' : item.type === 'name-color' && item.value === 'curse' ? 'name-curse' : ''}
                            style={{ flex: 1, fontSize: 13, fontWeight: 600, ...ncStyle(item.type === 'name-color' ? item.value : null, 'var(--text)'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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
        <ItemPreviewModal item={previewItem} estValue={prices[`${previewItem.type}:${previewItem.id}`]} onClose={() => setPreviewItem(null)} onViewProfile={openProfile} />
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
          prices={prices}
          onEquip={handleEquip}
        />
      )}
      {multiResult && (
        <MultiSpinResultOverlay result={multiResult} onClose={() => setMultiResult(null)} userName={inv?.name} />
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
              <div style={{ maxHeight: '80vh', overflowY: 'auto', paddingRight: 2 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div
                    className={avatarClass(profilePanel.avatarEffect)}
                    style={{ width: 54, height: 54, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, flexShrink: 0, ...avatarStyle(profilePanel.avatarEffect), ...(profilePanel.avatarUrl ? { background: 'none', padding: 0, overflow: 'hidden' } : {}) }}
                  >
                    {profilePanel.avatarUrl
                      ? <img src={profilePanel.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : (profilePanel.name ?? 'Us').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className={profilePanel.nameColor === 'rainbow' ? 'name-rainbow' : profilePanel.nameColor === 'curse' ? 'name-curse' : ''} style={{ fontSize: 19, fontWeight: 800, marginBottom: 3, ...ncStyle(profilePanel.nameColor, 'var(--text)') }}>
                      {profilePanel.name ?? 'User'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(profilePanel.chatBanned || (profilePanel.chatMutedUntil && new Date(profilePanel.chatMutedUntil) > new Date())) && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, display: 'inline-block', ...(profilePanel.chatBanned ? { color: '#EF4444', background: '#EF444422', border: '1px solid #EF4444' } : { color: '#f97316', background: '#f9731622', border: '1px solid #f97316' }) }}>
                          {profilePanel.chatBanned ? 'BANNED' : 'MUTED'}
                        </span>
                      )}
                      {profilePanel.tag && (
                        profilePanel.tagColor === 'verified-yellow' || profilePanel.tagColor === 'verified-blue'
                          ? <VerifiedBadge variant={profilePanel.tagColor === 'verified-yellow' ? 'yellow' : 'blue'} />
                          : <span
                              className={tagCssClass(profilePanel.tag, profilePanel.tagColor)}
                              style={isAnimatedTag(profilePanel.tag) ? { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4 } : profilePanel.tagColor === 'curse' ? { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, border: '1.5px solid #ff0000' } : { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, color: profilePanel.tagColor ?? 'var(--primary)', background: profilePanel.tagColor ? `${profilePanel.tagColor}22` : 'var(--primary-dim)', border: `1px solid ${profilePanel.tagColor ?? 'var(--primary)'}` }}
                            >
                              {profilePanel.tag}
                            </span>
                      )}
                      {(profilePanel.badge === 'verified-yellow' || profilePanel.badge === 'verified-blue') && <VerifiedBadge variant={profilePanel.badge === 'verified-yellow' ? 'yellow' : 'blue'} size={18} />}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 16, padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
                  {[
                    { label: 'Followers', value: profilePanel._count.followers },
                    { label: 'Following', value: profilePanel._count.following },
                    { label: 'Posts', value: profilePanel._count.posts },
                    { label: 'Likes', value: profilePanel.totalLikes },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Follow button */}
                {currentUserId !== null && profilePanel.id !== currentUserId && (
                  <button
                    className={profileFollowing ? 'ns-btn-ghost' : 'ns-btn-primary'}
                    style={{ width: '100%', height: 38, marginBottom: 12, fontSize: 14 }}
                    onClick={async () => {
                      try {
                        const result = await api.feedToggleFollow(profilePanel.id)
                        setProfileFollowing(result.following)
                        setProfilePanel(prev => prev ? { ...prev, isFollowing: result.following, _count: { ...prev._count, followers: result.following ? prev._count.followers + 1 : prev._count.followers - 1 } } : prev)
                      } catch { /* ignore */ }
                    }}
                  >
                    {profileFollowing ? 'Following' : 'Follow'}
                  </button>
                )}

                {/* Send Coins — visible to all users on other profiles */}
                {currentUserId !== null && profilePanel.id !== currentUserId && (() => {
                  const amt = parseInt(profileSendAmount)
                  const tax = (!isNaN(amt) && amt > 0) ? Math.ceil(amt * 0.05) : 0
                  return (
                    <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#EAB308', marginBottom: 8 }}>🪙 Send Coins</div>
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
                            if (isNaN(amt) || amt <= 0 || profileSendBusy) return
                            setProfileSendBusy(true); setProfileSendMsg('')
                            try {
                              await api.sendCoins(profilePanel.id, amt)
                              setProfileSendMsg(`✓ Sent ${amt} coins (−${tax} tax)`)
                              setProfileSendAmount('')
                            } catch (e: unknown) {
                              const msg = (e instanceof Error ? e.message : '') || 'Failed'
                              setProfileSendMsg(msg.includes('INSUFFICIENT') ? 'Not enough coins' : 'Failed')
                            } finally { setProfileSendBusy(false) }
                          }}
                        >{profileSendBusy ? '…' : 'Send'}</button>
                      </div>
                      {tax > 0 && !profileSendMsg && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                          5% tax — you pay <strong style={{ color: '#EAB308' }}>{amt + tax}</strong> total ({amt} + {tax} tax)
                        </div>
                      )}
                      {profileSendMsg && <div style={{ fontSize: 11, color: profileSendMsg.startsWith('✓') ? '#22C55E' : '#EF4444', fontWeight: 600, marginTop: 6 }}>{profileSendMsg}</div>}
                    </div>
                  )
                })()}

                {/* Full DEV + MOD panels */}
                {currentUserId !== null && (
                  <>
                    <DevAdminPanel
                      profile={profilePanel}
                      userId={profilePanel.id}
                      currentUserId={currentUserId}
                      onUpdateTag={u => setProfilePanel(prev => prev ? { ...prev, tag: u.tag, tagColor: u.tagColor, allTags: u.allTags ?? prev.allTags } : prev)}
                      onUpdateBan={banned => setProfilePanel(prev => prev ? { ...prev, chatBanned: banned } : prev)}
                      onUpdateMute={mu => setProfilePanel(prev => prev ? { ...prev, chatMutedUntil: mu } : prev)}
                      onUpdateRole={role => setProfilePanel(prev => prev ? { ...prev, role } : prev)}
                      onDeleted={() => setProfilePanel(null)}
                    />
                    <ModPanel
                      userId={profilePanel.id}
                      currentUserId={currentUserId}
                      profile={profilePanel}
                      onUpdateMute={mu => setProfilePanel(prev => prev ? { ...prev, chatMutedUntil: mu } : prev)}
                    />
                  </>
                )}

                {/* Posts */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Posts</p>
                  {profilePostsLoading ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading posts…</div>
                  ) : profilePosts.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No posts yet.</div>
                  ) : profilePosts.map(post => (
                    <div key={post.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text)', whiteSpace: 'pre-wrap' as const }}>{post.body}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 11 }}>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {Math.floor((Date.now() - new Date(post.createdAt).getTime()) / 86400000) === 0
                            ? Math.floor((Date.now() - new Date(post.createdAt).getTime()) / 3600000) === 0
                              ? `${Math.floor((Date.now() - new Date(post.createdAt).getTime()) / 60000)}m ago`
                              : `${Math.floor((Date.now() - new Date(post.createdAt).getTime()) / 3600000)}h ago`
                            : `${Math.floor((Date.now() - new Date(post.createdAt).getTime()) / 86400000)}d ago`}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>♡ {post._count.likes}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
              <select value={devType} onChange={e => { setDevType(e.target.value as 'name-color' | 'avatar' | 'tag'); setDevItemId('') }}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}>
                <option value="name-color">Name Color</option>
                <option value="avatar">Avatar Effect</option>
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
                <select value={simBoxType} onChange={e => { setSimBoxType(e.target.value as 'tag' | 'name-color' | 'avatar'); setSimItemId('') }}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}>
                  <option value="tag">Tag Box</option>
                  <option value="name-color">Name Color Box</option>
                  <option value="avatar">Avatar Box</option>
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

      {/* Trader sell confirmation */}
      {traderSellConfirm && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setTraderSellConfirm(null)}>
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(234,179,8,0.4)', borderRadius: 16, padding: 28, width: '90%', maxWidth: 360, textAlign: 'center' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🧙</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Sell to Trader?</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>{traderSellConfirm.type === 'tag' ? `[${traderSellConfirm.name}]` : traderSellConfirm.name}</div>
            <div style={{ fontSize: 12, color: getRarityColor(traderSellConfirm.rarity, traderSellConfirm.id), fontWeight: 700, marginBottom: 16 }}>{traderSellConfirm.rarity}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              The trader will pay <strong style={{ color: '#EAB308', display: 'inline-flex', alignItems: 'center', gap: 3 }}><CoinIcon size={12} />{traderSellConfirm.payout > 0 ? traderSellConfirm.payout.toLocaleString() : 0}</strong>
              {traderSellConfirm.payout === 0 && <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#EF4444' }}>This item has no est value</span>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                disabled={traderBusy}
                onClick={async () => {
                  setTraderBusy(true)
                  try {
                    const r = await api.traderSell(traderSellConfirm.type, traderSellConfirm.id)
                    setTraderSellConfirm(null)
                    refreshInventory()
                    api.traderStatus().then(setTraderStatus).catch(() => {})
                    setTraderMsg(`✓ Sold! You received ${r.payout.toLocaleString()} coins.`)
                  } catch (e) {
                    setTraderMsg(e instanceof Error ? e.message : 'Failed to sell')
                    setTraderSellConfirm(null)
                  } finally { setTraderBusy(false) }
                }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', background: '#EAB308', color: '#060D10', fontWeight: 700, fontSize: 13, cursor: traderBusy ? 'not-allowed' : 'pointer', opacity: traderBusy ? 0.6 : 1 }}>
                {traderBusy ? 'Selling…' : 'Confirm Sell'}
              </button>
              <button onClick={() => setTraderSellConfirm(null)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Trader buy confirmation */}
      {traderBuyConfirm && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setTraderBuyConfirm(null)}>
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 16, padding: 28, width: '90%', maxWidth: 360, textAlign: 'center' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🧙</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Buy from Trader?</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>{traderBuyConfirm.type === 'tag' ? `[${traderBuyConfirm.name}]` : traderBuyConfirm.name}</div>
            <div style={{ fontSize: 12, color: getRarityColor(traderBuyConfirm.rarity, traderBuyConfirm.id), fontWeight: 700, marginBottom: 16 }}>{traderBuyConfirm.rarity}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
              Trader's price: <strong style={{ color: '#8B5CF6', display: 'inline-flex', alignItems: 'center', gap: 3 }}><CoinIcon size={12} />{traderBuyConfirm.traderPrice.toLocaleString()}</strong>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>
              You have <strong style={{ color: '#EAB308' }}>{(inv?.coins ?? 0).toLocaleString()}</strong> coins
              {(inv?.coins ?? 0) < traderBuyConfirm.traderPrice && <span style={{ display: 'block', color: '#EF4444', marginTop: 2 }}>Not enough coins</span>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                disabled={traderBusy || (inv?.coins ?? 0) < traderBuyConfirm.traderPrice}
                onClick={async () => {
                  setTraderBusy(true)
                  try {
                    const r = await api.traderBuy(traderBuyConfirm.type, traderBuyConfirm.id)
                    setTraderBuyConfirm(null)
                    refreshInventory()
                    api.traderStatus().then(setTraderStatus).catch(() => {})
                    setTraderMsg(`✓ Purchased ${traderBuyConfirm.name} for ${r.price.toLocaleString()} coins!`)
                  } catch (e) {
                    setTraderMsg(e instanceof Error ? e.message : 'Failed to buy')
                    setTraderBuyConfirm(null)
                  } finally { setTraderBusy(false) }
                }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', background: '#8B5CF6', color: '#FFFFFF', fontWeight: 700, fontSize: 13, cursor: (traderBusy || (inv?.coins ?? 0) < traderBuyConfirm.traderPrice) ? 'not-allowed' : 'pointer', opacity: (traderBusy || (inv?.coins ?? 0) < traderBuyConfirm.traderPrice) ? 0.5 : 1 }}>
                {traderBusy ? 'Buying…' : 'Confirm Purchase'}
              </button>
              <button onClick={() => setTraderBuyConfirm(null)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
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

      {freeSpinOpen && (
        <FreeSpinModal
          onClose={() => setFreeSpinOpen(false)}
          onDone={handleFreeSpinDone}
        />
      )}
    </div>
  )
}

function parseTradeItemsClient(raw: unknown): TradeItem[] {
  if (Array.isArray(raw)) return raw as TradeItem[]
  try { return JSON.parse(String(raw ?? '[]')) } catch { return [] }
}
