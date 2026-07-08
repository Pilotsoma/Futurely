/**
 * Shared SVG path data for the myFuturely icon system.
 * All paths are designed for a 24×24 viewBox, stroke-based (fill="none"),
 * strokeWidth 2, strokeLinecap round, strokeLinejoin round.
 *
 * This file is the single source of truth for icon geometry.
 * The mobile icon file (nextstep-mobile/src/components/icons/paths.ts)
 * is a copy of this file — keep them in sync manually or via tooling.
 */

export type IconPathData =
  | { type: 'path'; d: string }
  | { type: 'multi'; elements: PathElement[] }

export type PathElement =
  | { tag: 'path'; d: string; fill?: string }
  | { tag: 'circle'; cx: number; cy: number; r: number; fill?: string }
  | { tag: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { tag: 'rect'; x: number; y: number; width: number; height: number; rx?: number }
  | { tag: 'polyline'; points: string }
  | { tag: 'polygon'; points: string }
  | { tag: 'ellipse'; cx: number; cy: number; rx: number; ry: number }

export const ICON_PATHS: Record<string, PathElement[]> = {
  BarChartIcon: [
    { tag: 'line', x1: 18, y1: 20, x2: 18, y2: 10 },
    { tag: 'line', x1: 12, y1: 20, x2: 12, y2: 4 },
    { tag: 'line', x1: 6, y1: 20, x2: 6, y2: 14 },
  ],
  ClipboardIcon: [
    { tag: 'path', d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2' },
    { tag: 'rect', x: 9, y: 3, width: 6, height: 4, rx: 1 },
    { tag: 'line', x1: 9, y1: 12, x2: 15, y2: 12 },
    { tag: 'line', x1: 9, y1: 16, x2: 12, y2: 16 },
  ],
  ClockIcon: [
    { tag: 'circle', cx: 12, cy: 12, r: 10 },
    { tag: 'polyline', points: '12 6 12 12 16 14' },
  ],
  CalculatorIcon: [
    { tag: 'rect', x: 4, y: 2, width: 16, height: 20, rx: 2 },
    { tag: 'line', x1: 8, y1: 6, x2: 16, y2: 6 },
    { tag: 'line', x1: 8, y1: 10, x2: 8, y2: 10 },
    { tag: 'line', x1: 12, y1: 10, x2: 12, y2: 10 },
    { tag: 'line', x1: 16, y1: 10, x2: 16, y2: 10 },
    { tag: 'line', x1: 8, y1: 14, x2: 8, y2: 14 },
    { tag: 'line', x1: 12, y1: 14, x2: 12, y2: 14 },
    { tag: 'line', x1: 16, y1: 14, x2: 16, y2: 14 },
    { tag: 'line', x1: 8, y1: 18, x2: 16, y2: 18 },
  ],
  EnvelopeIcon: [
    { tag: 'path', d: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z' },
    { tag: 'polyline', points: '22,6 12,13 2,6' },
  ],
  TrendingUpIcon: [
    { tag: 'polyline', points: '23 6 13.5 15.5 8.5 10.5 1 18' },
    { tag: 'polyline', points: '17 6 23 6 23 12' },
  ],
  DocumentIcon: [
    { tag: 'path', d: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' },
    { tag: 'polyline', points: '14 2 14 8 20 8' },
    { tag: 'line', x1: 16, y1: 13, x2: 8, y2: 13 },
    { tag: 'line', x1: 16, y1: 17, x2: 8, y2: 17 },
    { tag: 'polyline', points: '10 9 9 9 8 9' },
  ],
  CalendarIcon: [
    { tag: 'rect', x: 3, y: 4, width: 18, height: 18, rx: 2 },
    { tag: 'line', x1: 16, y1: 2, x2: 16, y2: 6 },
    { tag: 'line', x1: 8, y1: 2, x2: 8, y2: 6 },
    { tag: 'line', x1: 3, y1: 10, x2: 21, y2: 10 },
  ],
  MoonIcon: [
    { tag: 'path', d: 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z' },
  ],
  SunIcon: [
    { tag: 'circle', cx: 12, cy: 12, r: 5 },
    { tag: 'line', x1: 12, y1: 1, x2: 12, y2: 3 },
    { tag: 'line', x1: 12, y1: 21, x2: 12, y2: 23 },
    { tag: 'line', x1: 4.22, y1: 4.22, x2: 5.64, y2: 5.64 },
    { tag: 'line', x1: 18.36, y1: 18.36, x2: 19.78, y2: 19.78 },
    { tag: 'line', x1: 1, y1: 12, x2: 3, y2: 12 },
    { tag: 'line', x1: 21, y1: 12, x2: 23, y2: 12 },
    { tag: 'line', x1: 4.22, y1: 19.78, x2: 5.64, y2: 18.36 },
    { tag: 'line', x1: 18.36, y1: 5.64, x2: 19.78, y2: 4.22 },
  ],
  BanIcon: [
    { tag: 'circle', cx: 12, cy: 12, r: 10 },
    { tag: 'line', x1: 4.93, y1: 4.93, x2: 19.07, y2: 19.07 },
  ],
  LightningBoltIcon: [
    { tag: 'polygon', points: '13 2 3 14 12 14 11 22 21 10 12 10 13 2' },
  ],
  LockIcon: [
    { tag: 'rect', x: 3, y: 11, width: 18, height: 11, rx: 2 },
    { tag: 'path', d: 'M7 11V7a5 5 0 0110 0v4' },
  ],
  LockOpenIcon: [
    { tag: 'rect', x: 3, y: 11, width: 18, height: 11, rx: 2 },
    { tag: 'path', d: 'M7 11V7a5 5 0 019.9-1' },
  ],
  RobotIcon: [
    { tag: 'rect', x: 3, y: 8, width: 18, height: 13, rx: 2 },
    { tag: 'path', d: 'M12 2v6' },
    { tag: 'circle', cx: 12, cy: 2, r: 1 },
    { tag: 'line', x1: 8, y1: 21, x2: 8, y2: 21 },
    { tag: 'line', x1: 16, y1: 21, x2: 16, y2: 21 },
    { tag: 'line', x1: 8, y1: 13, x2: 8, y2: 13 },
    { tag: 'line', x1: 16, y1: 13, x2: 16, y2: 13 },
    { tag: 'line', x1: 3, y1: 15, x2: 1, y2: 15 },
    { tag: 'line', x1: 21, y1: 15, x2: 23, y2: 15 },
  ],
  GraduationCapIcon: [
    { tag: 'path', d: 'M22 10l-10-5L2 10l10 5 10-5z' },
    { tag: 'path', d: 'M6 12v5c0 2.21 2.686 4 6 4s6-1.79 6-4v-5' },
    { tag: 'line', x1: 22, y1: 10, x2: 22, y2: 16 },
  ],
  SkullIcon: [
    { tag: 'circle', cx: 12, cy: 11, r: 8 },
    { tag: 'path', d: 'M8 21h8' },
    { tag: 'path', d: 'M10 21v-4' },
    { tag: 'path', d: 'M14 21v-4' },
    { tag: 'circle', cx: 9, cy: 10, r: 1.5, fill: 'currentColor' },
    { tag: 'circle', cx: 15, cy: 10, r: 1.5, fill: 'currentColor' },
  ],
  TrophyIcon: [
    { tag: 'path', d: 'M6 9H4a2 2 0 01-2-2V5h4' },
    { tag: 'path', d: 'M18 9h2a2 2 0 002-2V5h-4' },
    { tag: 'path', d: 'M6 5h12v7a6 6 0 01-6 6 6 6 0 01-6-6V5z' },
    { tag: 'path', d: 'M9 21h6' },
    { tag: 'path', d: 'M12 18v3' },
  ],
  GamepadIcon: [
    { tag: 'line', x1: 6, y1: 12, x2: 10, y2: 12 },
    { tag: 'line', x1: 8, y1: 10, x2: 8, y2: 14 },
    { tag: 'line', x1: 15, y1: 13, x2: 15, y2: 13 },
    { tag: 'line', x1: 18, y1: 11, x2: 18, y2: 11 },
    { tag: 'path', d: 'M17.32 5H6.68a4 4 0 00-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 003 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 019.828 16h4.344a2 2 0 011.414.586L17 18c.5.5 1 1 2 1a3 3 0 003-3c0-1.544-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0017.32 5z' },
  ],
  TargetIcon: [
    { tag: 'circle', cx: 12, cy: 12, r: 10 },
    { tag: 'circle', cx: 12, cy: 12, r: 6 },
    { tag: 'circle', cx: 12, cy: 12, r: 2 },
  ],
  PencilIcon: [
    { tag: 'path', d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7' },
    { tag: 'path', d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z' },
  ],
  ImageIcon: [
    { tag: 'rect', x: 3, y: 3, width: 18, height: 18, rx: 2 },
    { tag: 'circle', cx: 8.5, cy: 8.5, r: 1.5 },
    { tag: 'polyline', points: '21 15 16 10 5 21' },
  ],
  VideoIcon: [
    { tag: 'polygon', points: '23 7 16 12 23 17 23 7' },
    { tag: 'rect', x: 1, y: 5, width: 15, height: 14, rx: 2 },
  ],
  AudioIcon: [
    { tag: 'path', d: 'M9 18V5l12-2v13' },
    { tag: 'circle', cx: 6, cy: 18, r: 3 },
    { tag: 'circle', cx: 18, cy: 16, r: 3 },
  ],
  ArchiveIcon: [
    { tag: 'polyline', points: '21 8 21 21 3 21 3 8' },
    { tag: 'rect', x: 1, y: 3, width: 22, height: 5 },
    { tag: 'line', x1: 10, y1: 12, x2: 14, y2: 12 },
  ],
  FolderIcon: [
    { tag: 'path', d: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z' },
  ],
  QuestionMarkIcon: [
    { tag: 'circle', cx: 12, cy: 12, r: 10 },
    { tag: 'path', d: 'M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3' },
    { tag: 'line', x1: 12, y1: 17, x2: 12.01, y2: 17 },
  ],
  ChatBubbleIcon: [
    { tag: 'path', d: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
  ],
  LinkIcon: [
    { tag: 'path', d: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71' },
    { tag: 'path', d: 'M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71' },
  ],
  WrenchIcon: [
    { tag: 'path', d: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z' },
  ],
  WarningIcon: [
    { tag: 'path', d: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' },
    { tag: 'line', x1: 12, y1: 9, x2: 12, y2: 13 },
    { tag: 'line', x1: 12, y1: 17, x2: 12.01, y2: 17 },
  ],
  CheckCircleIcon: [
    { tag: 'path', d: 'M22 11.08V12a10 10 0 11-5.93-9.14' },
    { tag: 'polyline', points: '22 4 12 14.01 9 11.01' },
  ],
  GiftIcon: [
    { tag: 'polyline', points: '20 12 20 22 4 22 4 12' },
    { tag: 'rect', x: 2, y: 7, width: 20, height: 5 },
    { tag: 'path', d: 'M12 22V7' },
    { tag: 'path', d: 'M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z' },
    { tag: 'path', d: 'M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z' },
  ],
  TagIcon: [
    { tag: 'path', d: 'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z' },
    { tag: 'line', x1: 7, y1: 7, x2: 7.01, y2: 7 },
  ],
  PackageIcon: [
    { tag: 'line', x1: 16.5, y1: 9.4, x2: 7.5, y2: 4.21 },
    { tag: 'path', d: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z' },
    { tag: 'polyline', points: '3.27 6.96 12 12.01 20.73 6.96' },
    { tag: 'line', x1: 12, y1: 22.08, x2: 12, y2: 12 },
  ],
  UsersIcon: [
    { tag: 'path', d: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2' },
    { tag: 'circle', cx: 9, cy: 7, r: 4 },
    { tag: 'path', d: 'M23 21v-2a4 4 0 00-3-3.87' },
    { tag: 'path', d: 'M16 3.13a4 4 0 010 7.75' },
  ],
  MedalIcon: [
    { tag: 'circle', cx: 12, cy: 15, r: 7 },
    { tag: 'polyline', points: '8.21 13.89 7 23 12 20 17 23 15.79 13.88' },
    { tag: 'path', d: 'M12 8V2' },
    { tag: 'path', d: 'M9 5l3-3 3 3' },
  ],
  GoldMedalIcon: [
    { tag: 'circle', cx: 12, cy: 14, r: 7 },
    { tag: 'path', d: 'M9 21l3-2 3 2' },
    { tag: 'path', d: 'M12 7V3' },
    { tag: 'path', d: 'M9 5l3-2 3 2' },
    { tag: 'path', d: 'M11 11v3h2v-3l1.5-1.5-1.5 1.5H12l-1.5-1.5L12 11z' },
  ],
  SilverMedalIcon: [
    { tag: 'circle', cx: 12, cy: 14, r: 7 },
    { tag: 'path', d: 'M9 21l3-2 3 2' },
    { tag: 'path', d: 'M12 7V3' },
    { tag: 'path', d: 'M9 5l3-2 3 2' },
    { tag: 'path', d: 'M10 11h2c.55 0 1 .45 1 1s-.45 1-1 1h-1c-.55 0-1 .45-1 1s.45 1 1 1h2' },
  ],
  BronzeMedalIcon: [
    { tag: 'circle', cx: 12, cy: 14, r: 7 },
    { tag: 'path', d: 'M9 21l3-2 3 2' },
    { tag: 'path', d: 'M12 7V3' },
    { tag: 'path', d: 'M9 5l3-2 3 2' },
    { tag: 'path', d: 'M10 11h1.5a1.5 1.5 0 010 3H10m0-3v3m0 0h1.5a1.5 1.5 0 010 3H10v-3' },
  ],
  CoinIcon: [
    { tag: 'circle', cx: 12, cy: 12, r: 10 },
    { tag: 'path', d: 'M12 6v12' },
    { tag: 'path', d: 'M15 9a3 3 0 00-3-3 3 3 0 000 6 3 3 0 000 6 3 3 0 01-3-3' },
  ],
  FlameIcon: [
    { tag: 'path', d: 'M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 01-7 7 7 7 0 01-7-7c0-1.857.67-3.22 2-4.5' },
  ],
  PartyPopperIcon: [
    { tag: 'path', d: 'M5.8 11.3L2 22l10.7-3.79' },
    { tag: 'path', d: 'M4 3h.01' },
    { tag: 'path', d: 'M22 8h.01' },
    { tag: 'path', d: 'M15 2h.01' },
    { tag: 'path', d: 'M22 20h.01' },
    { tag: 'path', d: 'M22 2l-7.3 14.3-2.4-4.6L8 9.7z' },
  ],
  CrownIcon: [
    { tag: 'path', d: 'M2 19h20' },
    { tag: 'path', d: 'M2 19l3.5-11 5.5 4L12 4l1 8 5.5-4L22 19' },
  ],
  DiamondIcon: [
    { tag: 'path', d: 'M2.7 10.3a2.41 2.41 0 000 3.41l7.59 7.59a2.41 2.41 0 003.41 0l7.59-7.59a2.41 2.41 0 000-3.41l-7.59-7.59a2.41 2.41 0 00-3.41 0z' },
  ],
  StarIcon: [
    { tag: 'polygon', points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' },
  ],
  BooksIcon: [
    { tag: 'path', d: 'M4 19.5A2.5 2.5 0 016.5 17H20' },
    { tag: 'path', d: 'M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z' },
  ],
  RefreshIcon: [
    { tag: 'polyline', points: '23 4 23 10 17 10' },
    { tag: 'polyline', points: '1 20 1 14 7 14' },
    { tag: 'path', d: 'M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15' },
  ],
  TradeArrowsIcon: [
    { tag: 'path', d: 'M17 1l4 4-4 4' },
    { tag: 'path', d: 'M3 11V9a4 4 0 014-4h14' },
    { tag: 'path', d: 'M7 23l-4-4 4-4' },
    { tag: 'path', d: 'M21 13v2a4 4 0 01-4 4H3' },
  ],
  InboxIcon: [
    { tag: 'polyline', points: '22 12 16 12 14 15 10 15 8 12 2 12' },
    { tag: 'path', d: 'M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z' },
  ],
  MailboxIcon: [
    { tag: 'path', d: 'M22 17a2 2 0 01-2 2H4a2 2 0 01-2-2V9.5C2 7 4 5 6.5 5H18c2.2 0 4 1.8 4 4v8z' },
    { tag: 'polyline', points: '15,9 18,9 18,11' },
    { tag: 'path', d: 'M6.5 5C9 5 11 7 11 9.5V17a2 2 0 01-2 2v0' },
    { tag: 'line', x1: 6, y1: 10, x2: 7, y2: 10 },
  ],
  UserIcon: [
    { tag: 'path', d: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2' },
    { tag: 'circle', cx: 12, cy: 7, r: 4 },
  ],
  HeartOutlineIcon: [
    { tag: 'path', d: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z' },
  ],
  HeartFilledIcon: [
    { tag: 'path', d: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z', fill: 'currentColor' },
  ],
  ErrorCircleIcon: [
    { tag: 'circle', cx: 12, cy: 12, r: 10 },
    { tag: 'line', x1: 15, y1: 9, x2: 9, y2: 15 },
    { tag: 'line', x1: 9, y1: 9, x2: 15, y2: 15 },
  ],
  SchoolBuildingIcon: [
    { tag: 'path', d: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
    { tag: 'polyline', points: '9 22 9 12 15 12 15 22' },
  ],
  HandshakeIcon: [
    { tag: 'path', d: 'M20.42 4.58a5.4 5.4 0 00-7.65 0l-.77.78-.77-.78a5.4 5.4 0 00-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z' },
    { tag: 'path', d: 'M12 5.36L8.87 8.5a2.13 2.13 0 000 3l.43.43c.84.84 2.2.84 3.04 0L13.17 11' },
  ],
  GlobeIcon: [
    { tag: 'circle', cx: 12, cy: 12, r: 10 },
    { tag: 'line', x1: 2, y1: 12, x2: 22, y2: 12 },
    { tag: 'path', d: 'M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z' },
  ],
  MuteIcon: [
    { tag: 'polygon', points: '11 5 6 9 2 9 2 15 6 15 11 19 11 5' },
    { tag: 'line', x1: 23, y1: 9, x2: 17, y2: 15 },
    { tag: 'line', x1: 17, y1: 9, x2: 23, y2: 15 },
  ],
  WizardIcon: [
    { tag: 'path', d: 'M15 22V12l-3-9-3 9v10' },
    { tag: 'path', d: 'M9 16l3-1 3 1' },
    { tag: 'path', d: 'M3 22h18' },
    { tag: 'path', d: 'M18 14l2-2' },
    { tag: 'path', d: 'M6 14l-2-2' },
  ],
  BackpackIcon: [
    { tag: 'path', d: 'M4 20V10a4 4 0 014-4h8a4 4 0 014 4v10a2 2 0 01-2 2H6a2 2 0 01-2-2z' },
    { tag: 'path', d: 'M9 6V4a3 3 0 016 0v2' },
    { tag: 'path', d: 'M8 21v-5a2 2 0 012-2h4a2 2 0 012 2v5' },
    { tag: 'line', x1: 4, y1: 14, x2: 20, y2: 14 },
  ],
  ShopIcon: [
    { tag: 'path', d: 'M3 9l1-5h16l1 5' },
    { tag: 'path', d: 'M3 9a1 1 0 000 2h1v9a1 1 0 001 1h14a1 1 0 001-1v-9h1a1 1 0 000-2H3z' },
    { tag: 'path', d: 'M9 9v1a3 3 0 006 0V9' },
  ],
  SlotMachineIcon: [
    { tag: 'rect', x: 3, y: 3, width: 18, height: 18, rx: 2 },
    { tag: 'line', x1: 9, y1: 3, x2: 9, y2: 21 },
    { tag: 'line', x1: 15, y1: 3, x2: 15, y2: 21 },
    { tag: 'line', x1: 3, y1: 9, x2: 21, y2: 9 },
    { tag: 'line', x1: 3, y1: 15, x2: 21, y2: 15 },
  ],
  BookOpenIcon: [
    { tag: 'path', d: 'M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z' },
    { tag: 'path', d: 'M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z' },
  ],
  BellIcon: [
    { tag: 'path', d: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9' },
    { tag: 'path', d: 'M13.73 21a2 2 0 01-3.46 0' },
  ],
  RocketIcon: [
    { tag: 'path', d: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2l.55-.55a6 6 0 00-3-3L4.5 16.5z' },
    { tag: 'path', d: 'M12 8L9.04 15H12l2.96 7L18 8z' },
    { tag: 'path', d: 'M17 3a2 2 0 012 2c0 4-3.5 8.5-10 10' },
  ],
  PaperclipIcon: [
    { tag: 'path', d: 'M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48' },
  ],
  ArcheryBowIcon: [
    { tag: 'path', d: 'M18 2l4 4-14 14H4v-4L18 2z' },
    { tag: 'path', d: 'M2 22l6-6' },
    { tag: 'path', d: 'M14 8l2 2' },
  ],
  XMarkIcon: [
    { tag: 'line', x1: 18, y1: 6, x2: 6, y2: 18 },
    { tag: 'line', x1: 6, y1: 6, x2: 18, y2: 18 },
  ],
  CheckIcon: [
    { tag: 'polyline', points: '20 6 9 17 4 12' },
  ],
  SparklesIcon: [
    { tag: 'path', d: 'M12 3l1.09 3.26L16.5 7.5l-3.41 1.24L12 12l-1.09-3.26L7.5 7.5l3.41-1.24z' },
    { tag: 'path', d: 'M5 3l.55 1.64L8 6l-2.45.86L5 8.5l-.55-1.64L2 6l2.45-.86z' },
    { tag: 'path', d: 'M19 13l.55 1.64L22 16l-2.45.86L19 18.5l-.55-1.64L16 16l2.45-.86z' },
  ],
  TrendUpIcon: [
    { tag: 'polyline', points: '18 15 12 9 6 15' },
  ],
  TrendDownIcon: [
    { tag: 'polyline', points: '6 9 12 15 18 9' },
  ],
  TrendNeutralIcon: [
    { tag: 'line', x1: 5, y1: 12, x2: 19, y2: 12 },
    { tag: 'polyline', points: '14 7 19 12 14 17' },
  ],
  ArrowRightIcon: [
    { tag: 'line', x1: 5, y1: 12, x2: 19, y2: 12 },
    { tag: 'polyline', points: '12 5 19 12 12 19' },
  ],
  ArrowLeftIcon: [
    { tag: 'line', x1: 19, y1: 12, x2: 5, y2: 12 },
    { tag: 'polyline', points: '12 19 5 12 12 5' },
  ],
  ChevronRightIcon: [
    { tag: 'polyline', points: '9 18 15 12 9 6' },
  ],
  ChevronLeftIcon: [
    { tag: 'polyline', points: '15 18 9 12 15 6' },
  ],
  ResetIcon: [
    { tag: 'path', d: 'M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8' },
    { tag: 'path', d: 'M3 3v5h5' },
  ],
  ReplyIcon: [
    { tag: 'polyline', points: '9 17 4 12 9 7' },
    { tag: 'path', d: 'M20 18v-2a4 4 0 00-4-4H4' },
  ],
  SwitchArrowsIcon: [
    { tag: 'path', d: 'M7 16V4m0 0L3 8m4-4l4 4' },
    { tag: 'path', d: 'M17 8v12m0 0l4-4m-4 4l-4-4' },
  ],
  StatusDotGreenIcon: [
    { tag: 'circle', cx: 12, cy: 12, r: 4, fill: '#10B981' },
    { tag: 'circle', cx: 12, cy: 12, r: 8 },
  ],
  StatusDotYellowIcon: [
    { tag: 'circle', cx: 12, cy: 12, r: 4, fill: '#F59E0B' },
    { tag: 'circle', cx: 12, cy: 12, r: 8 },
  ],
  PaintPaletteIcon: [
    { tag: 'circle', cx: 12, cy: 12, r: 10 },
    { tag: 'circle', cx: 8, cy: 14, r: 1.5, fill: 'currentColor' },
    { tag: 'circle', cx: 12, cy: 8, r: 1.5, fill: 'currentColor' },
    { tag: 'circle', cx: 16, cy: 14, r: 1.5, fill: 'currentColor' },
    { tag: 'path', d: 'M12 22v-4a2 2 0 012-2h2' },
  ],
  SparkleStarIcon: [
    { tag: 'path', d: 'M12 2l1.5 4.5H18l-3.75 2.75L15.75 14 12 11.25 8.25 14l1.5-4.75L6 6.5h4.5z' },
  ],
  TrashIcon: [
    { tag: 'polyline', points: '3 6 5 6 21 6' },
    { tag: 'path', d: 'M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6' },
    { tag: 'path', d: 'M10 11v6' },
    { tag: 'path', d: 'M14 11v6' },
    { tag: 'path', d: 'M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2' },
  ],
  IncomingArrowIcon: [
    { tag: 'polyline', points: '22 12 16 12 14 15 10 15 8 12 2 12' },
    { tag: 'path', d: 'M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z' },
  ],
  OutgoingArrowIcon: [
    { tag: 'polyline', points: '22 12 16 12 14 9 10 9 8 12 2 12' },
    { tag: 'path', d: 'M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z' },
  ],
  MagnifyingGlassIcon: [
    { tag: 'circle', cx: 11, cy: 11, r: 8 },
    { tag: 'line', x1: 21, y1: 21, x2: 16.65, y2: 16.65 },
  ],
  StreamingStarIcon: [
    { tag: 'polygon', points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' },
    { tag: 'circle', cx: 12, cy: 12, r: 3, fill: 'currentColor' },
  ],
  TentIcon: [
    { tag: 'path', d: 'M2 20h20M12 4L2 20M12 4L22 20' },
    { tag: 'path', d: 'M9 20V14h6v6' },
  ],
}
