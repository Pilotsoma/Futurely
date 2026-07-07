/**
 * Futurely Icon System — Web (Next.js)
 *
 * All icons are stroke-based SVGs, 24×24 viewBox.
 * strokeWidth 2, strokeLinecap round, strokeLinejoin round.
 *
 * Props:
 *   size     — pixel dimension (default 24)
 *   color    — stroke/fill color (default 'currentColor')
 *   gradient — applies brand gradient stroke: #00E5FF → #2979FF → #7C3AED
 *              Reserved for primary/emphasis contexts only (active nav, primary CTAs).
 *   className — optional Tailwind/CSS class
 *
 * Usage:
 *   import { CheckIcon, FlameIcon } from '@/components/icons'
 *   <CheckIcon size={16} color="#10B981" />
 *   <FlameIcon size={20} gradient />   // primary CTA / active nav only
 */

'use client'

import React, { useId } from 'react'
import { ICON_PATHS, PathElement } from './paths'

export interface IconProps {
  size?: number
  color?: string
  gradient?: boolean
  className?: string
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function renderElement(el: PathElement, stroke: string, idx: number): React.ReactElement {
  switch (el.tag) {
    case 'path': {
      const hasFill = Boolean(el.fill)
      return (
        <path
          key={idx}
          d={el.d}
          stroke={hasFill ? 'none' : stroke}
          fill={el.fill ?? 'none'}
          strokeWidth={hasFill ? 0 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    }
    case 'circle': {
      const hasFill = Boolean(el.fill)
      return (
        <circle
          key={idx}
          cx={el.cx}
          cy={el.cy}
          r={el.r}
          stroke={hasFill ? 'none' : stroke}
          fill={el.fill ?? 'none'}
          strokeWidth={hasFill ? 0 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    }
    case 'line':
      return (
        <line
          key={idx}
          stroke={stroke}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          x1={el.x1}
          y1={el.y1}
          x2={el.x2}
          y2={el.y2}
        />
      )
    case 'rect':
      return (
        <rect
          key={idx}
          stroke={stroke}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          x={el.x}
          y={el.y}
          width={el.width}
          height={el.height}
          rx={el.rx ?? 0}
        />
      )
    case 'polyline':
      return (
        <polyline
          key={idx}
          stroke={stroke}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={el.points}
        />
      )
    case 'polygon':
      return (
        <polygon
          key={idx}
          stroke={stroke}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={el.points}
        />
      )
    case 'ellipse':
      return (
        <ellipse
          key={idx}
          stroke={stroke}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          cx={el.cx}
          cy={el.cy}
          rx={el.rx}
          ry={el.ry}
        />
      )
  }
}

// ---------------------------------------------------------------------------
// Icon factory
// ---------------------------------------------------------------------------

function makeIcon(name: string): React.FC<IconProps> {
  const elements = ICON_PATHS[name]
  if (!elements) {
    throw new Error(`[Icons] No path data found for icon: "${name}"`)
  }

  const IconComponent: React.FC<IconProps> = ({
    size = 24,
    color = 'currentColor',
    gradient = false,
    className,
  }) => {
    const uid = useId()
    const gradId = `icon-grad-${uid}`
    const stroke = gradient ? `url(#${gradId})` : color

    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={className}
      >
        {gradient && (
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00E5FF" />
              <stop offset="50%" stopColor="#2979FF" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
          </defs>
        )}
        {elements.map((el, i) => renderElement(el, stroke, i))}
      </svg>
    )
  }

  IconComponent.displayName = name
  return IconComponent
}

// ---------------------------------------------------------------------------
// Named exports — one per icon in the ICON_INVENTORY.md reference table
// ---------------------------------------------------------------------------

export const BarChartIcon = makeIcon('BarChartIcon')
export const ClipboardIcon = makeIcon('ClipboardIcon')
export const ClockIcon = makeIcon('ClockIcon')
export const CalculatorIcon = makeIcon('CalculatorIcon')
export const EnvelopeIcon = makeIcon('EnvelopeIcon')
export const TrendingUpIcon = makeIcon('TrendingUpIcon')
export const DocumentIcon = makeIcon('DocumentIcon')
export const CalendarIcon = makeIcon('CalendarIcon')
export const MoonIcon = makeIcon('MoonIcon')
export const SunIcon = makeIcon('SunIcon')
export const BanIcon = makeIcon('BanIcon')
export const LightningBoltIcon = makeIcon('LightningBoltIcon')
export const LockIcon = makeIcon('LockIcon')
export const LockOpenIcon = makeIcon('LockOpenIcon')
export const RobotIcon = makeIcon('RobotIcon')
export const GraduationCapIcon = makeIcon('GraduationCapIcon')
export const SkullIcon = makeIcon('SkullIcon')
export const TrophyIcon = makeIcon('TrophyIcon')
export const GamepadIcon = makeIcon('GamepadIcon')
export const TargetIcon = makeIcon('TargetIcon')
export const PencilIcon = makeIcon('PencilIcon')
export const ImageIcon = makeIcon('ImageIcon')
export const VideoIcon = makeIcon('VideoIcon')
export const AudioIcon = makeIcon('AudioIcon')
export const ArchiveIcon = makeIcon('ArchiveIcon')
export const FolderIcon = makeIcon('FolderIcon')
export const QuestionMarkIcon = makeIcon('QuestionMarkIcon')
export const ChatBubbleIcon = makeIcon('ChatBubbleIcon')
export const LinkIcon = makeIcon('LinkIcon')
export const WrenchIcon = makeIcon('WrenchIcon')
export const WarningIcon = makeIcon('WarningIcon')
export const CheckCircleIcon = makeIcon('CheckCircleIcon')
export const GiftIcon = makeIcon('GiftIcon')
export const TagIcon = makeIcon('TagIcon')
export const PackageIcon = makeIcon('PackageIcon')
export const UsersIcon = makeIcon('UsersIcon')
export const MedalIcon = makeIcon('MedalIcon')
export const GoldMedalIcon = makeIcon('GoldMedalIcon')
export const SilverMedalIcon = makeIcon('SilverMedalIcon')
export const BronzeMedalIcon = makeIcon('BronzeMedalIcon')
export const CoinIcon = makeIcon('CoinIcon')
export const FlameIcon = makeIcon('FlameIcon')
export const PartyPopperIcon = makeIcon('PartyPopperIcon')
export const CrownIcon = makeIcon('CrownIcon')
export const DiamondIcon = makeIcon('DiamondIcon')
export const StarIcon = makeIcon('StarIcon')
export const BooksIcon = makeIcon('BooksIcon')
export const RefreshIcon = makeIcon('RefreshIcon')
export const TradeArrowsIcon = makeIcon('TradeArrowsIcon')
export const InboxIcon = makeIcon('InboxIcon')
export const MailboxIcon = makeIcon('MailboxIcon')
export const UserIcon = makeIcon('UserIcon')
export const HeartOutlineIcon = makeIcon('HeartOutlineIcon')
export const HeartFilledIcon = makeIcon('HeartFilledIcon')
export const ErrorCircleIcon = makeIcon('ErrorCircleIcon')
export const SchoolBuildingIcon = makeIcon('SchoolBuildingIcon')
export const HandshakeIcon = makeIcon('HandshakeIcon')
export const GlobeIcon = makeIcon('GlobeIcon')
export const MuteIcon = makeIcon('MuteIcon')
export const WizardIcon = makeIcon('WizardIcon')
export const BackpackIcon = makeIcon('BackpackIcon')
export const ShopIcon = makeIcon('ShopIcon')
export const SlotMachineIcon = makeIcon('SlotMachineIcon')
export const BookOpenIcon = makeIcon('BookOpenIcon')
export const BellIcon = makeIcon('BellIcon')
export const RocketIcon = makeIcon('RocketIcon')
export const PaperclipIcon = makeIcon('PaperclipIcon')
export const ArcheryBowIcon = makeIcon('ArcheryBowIcon')
export const XMarkIcon = makeIcon('XMarkIcon')
export const CheckIcon = makeIcon('CheckIcon')
export const SparklesIcon = makeIcon('SparklesIcon')
export const TrendUpIcon = makeIcon('TrendUpIcon')
export const TrendDownIcon = makeIcon('TrendDownIcon')
export const TrendNeutralIcon = makeIcon('TrendNeutralIcon')
export const ArrowRightIcon = makeIcon('ArrowRightIcon')
export const ArrowLeftIcon = makeIcon('ArrowLeftIcon')
export const ChevronRightIcon = makeIcon('ChevronRightIcon')
export const ChevronLeftIcon = makeIcon('ChevronLeftIcon')
export const ResetIcon = makeIcon('ResetIcon')
export const ReplyIcon = makeIcon('ReplyIcon')
export const SwitchArrowsIcon = makeIcon('SwitchArrowsIcon')
export const StatusDotGreenIcon = makeIcon('StatusDotGreenIcon')
export const StatusDotYellowIcon = makeIcon('StatusDotYellowIcon')
export const PaintPaletteIcon = makeIcon('PaintPaletteIcon')
export const SparkleStarIcon = makeIcon('SparkleStarIcon')
export const TrashIcon = makeIcon('TrashIcon')
export const IncomingArrowIcon = makeIcon('IncomingArrowIcon')
export const OutgoingArrowIcon = makeIcon('OutgoingArrowIcon')
export const MagnifyingGlassIcon = makeIcon('MagnifyingGlassIcon')
export const StreamingStarIcon = makeIcon('StreamingStarIcon')
export const TentIcon = makeIcon('TentIcon')
