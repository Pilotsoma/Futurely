/**
 * Futurely Icon System — Mobile (React Native / Expo)
 *
 * All icons are stroke-based SVGs, 24×24 viewBox.
 * strokeWidth 2, strokeLinecap round, strokeLinejoin round.
 *
 * Props:
 *   size     — pixel dimension (default 24)
 *   color    — stroke/fill color (default 'currentColor')
 *   gradient — applies brand gradient stroke: #00E5FF → #2979FF → #7C3AED
 *              Reserved for primary/emphasis contexts only (active nav, primary CTAs).
 *
 * Usage:
 *   import { CheckIcon, FlameIcon } from '@/components/icons'
 *   <CheckIcon size={16} color="#10B981" />
 *   <FlameIcon size={20} gradient />   // primary CTA / active nav only
 *
 * Requires: react-native-svg@15.12.1 (installed via expo install)
 */

import React from 'react'
import Svg, {
  Path,
  Circle,
  Line,
  Rect,
  Polyline,
  Polygon,
  Ellipse,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg'
import { ICON_PATHS, PathElement } from './paths'

export interface IconProps {
  size?: number
  color?: string
  gradient?: boolean
}

// ---------------------------------------------------------------------------
// Gradient ID counter — React Native doesn't have useId, so we use a module
// counter to ensure unique gradient IDs per rendered icon.
// ---------------------------------------------------------------------------
let _gradCounter = 0
function nextGradId(): string {
  _gradCounter += 1
  return `ig${_gradCounter}`
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function renderElement(
  el: PathElement,
  stroke: string,
  idx: number,
): React.ReactElement | null {
  switch (el.tag) {
    case 'path': {
      const hasFill = Boolean(el.fill)
      return (
        <Path
          key={idx}
          d={el.d}
          stroke={hasFill ? undefined : stroke}
          fill={el.fill ?? 'none'}
          strokeWidth={hasFill ? undefined : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    }
    case 'circle': {
      const hasFill = Boolean(el.fill)
      return (
        <Circle
          key={idx}
          cx={el.cx}
          cy={el.cy}
          r={el.r}
          stroke={hasFill ? undefined : stroke}
          fill={el.fill ?? 'none'}
          strokeWidth={hasFill ? undefined : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    }
    case 'line':
      return (
        <Line
          key={idx}
          x1={el.x1}
          y1={el.y1}
          x2={el.x2}
          y2={el.y2}
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    case 'rect':
      return (
        <Rect
          key={idx}
          x={el.x}
          y={el.y}
          width={el.width}
          height={el.height}
          rx={el.rx ?? 0}
          stroke={stroke}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    case 'polyline':
      return (
        <Polyline
          key={idx}
          points={el.points}
          stroke={stroke}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    case 'polygon':
      return (
        <Polygon
          key={idx}
          points={el.points}
          stroke={stroke}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    case 'ellipse':
      return (
        <Ellipse
          key={idx}
          cx={el.cx}
          cy={el.cy}
          rx={el.rx}
          ry={el.ry}
          stroke={stroke}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    default:
      return null
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
  }) => {
    // Gradient IDs must be stable per render — we generate one per instance.
    // Using React.useRef so the ID doesn't change across re-renders.
    const gradIdRef = React.useRef<string | null>(null)
    if (gradIdRef.current === null) {
      gradIdRef.current = nextGradId()
    }
    const gradId = gradIdRef.current

    const stroke = gradient ? `url(#${gradId})` : color

    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {gradient && (
          <Defs>
            <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#00E5FF" />
              <Stop offset="50%" stopColor="#2979FF" />
              <Stop offset="100%" stopColor="#7C3AED" />
            </LinearGradient>
          </Defs>
        )}
        {elements.map((el, i) => renderElement(el, stroke, i))}
      </Svg>
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
export const GridIcon = makeIcon('GridIcon')
export const SettingsIcon = makeIcon('SettingsIcon')
export const ChevronDownIcon = makeIcon('ChevronDownIcon')
export const ChevronUpIcon = makeIcon('ChevronUpIcon')
export const EyeIcon = makeIcon('EyeIcon')
export const EyeOffIcon = makeIcon('EyeOffIcon')
export const SendIcon = makeIcon('SendIcon')
export const MenuIcon = makeIcon('MenuIcon')
export const ShieldCheckmarkIcon = makeIcon('ShieldCheckmarkIcon')
export const MapIcon = makeIcon('MapIcon')
export const CircleIcon = makeIcon('CircleIcon')
export const XCircleIcon = makeIcon('XCircleIcon')
