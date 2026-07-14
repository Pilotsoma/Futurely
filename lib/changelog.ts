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
    title: 'Fresh Look',
    changes: [
      {
        emoji: '🌌',
        headline: 'New Login Background',
        detail: 'The login screen now has a fully redesigned cosmic backdrop — a dense starfield, naturalistic planets, and an astronaut drifting among them (desktop only).',
      },
      {
        emoji: '🧹',
        headline: 'Cleaner Landing Page',
        detail: 'Trimmed the marketing site to focus on the core product — removed the gamification/marketplace pitch and the competitor comparison table in favor of a straightforward "why myFuturely" feature grid.',
      },
      {
        emoji: '✉️',
        headline: 'Streamlined Sign Up',
        detail: 'Simplified the account creation options shown on the login screen.',
      },
    ],
  },
]

export const CURRENT_VERSION = CHANGELOG[0].version
