export interface ChangelogEntry {
  version: string
  date: string
  title: string
  changes: Array<{
    emoji: string
    headline: string
    detail: string
  }>
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.01',
    date: 'July 14, 2026',
    title: 'Core Feature Update',
    changes: [
      {
        emoji: '✨',
        headline: 'New Core Features',
        detail: 'Added new core features across the app to help you stay on top of your coursework, along with a variety of behind-the-scenes improvements.',
      },
      {
        emoji: '🎨',
        headline: 'Refreshed Look',
        detail: 'Polished the look and feel across the app, including a redesigned login screen and a cleaner marketing site.',
      },
      {
        emoji: '🛠️',
        headline: 'Bug Fixes & Improvements',
        detail: 'Fixed a number of bugs and made general performance and reliability improvements throughout the app.',
      },
    ],
  },
]

export const CURRENT_VERSION = CHANGELOG[0].version
