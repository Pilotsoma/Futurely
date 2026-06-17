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
    version: '1.0.2',
    date: 'June 17, 2025',
    title: 'Security & Social Updates',
    changes: [
      {
        emoji: '🔒',
        headline: 'Account Lockout Protection',
        detail: 'Your account now locks for 2 hours after 5 incorrect password attempts. You\'ll see how many tries remain before lockout.',
      },
      {
        emoji: '🙈',
        headline: 'Email Privacy',
        detail: 'Other students\' email addresses are no longer visible anywhere in the app — not on profiles, not in search results.',
      },
      {
        emoji: '🎓',
        headline: 'Full Canvas Dashboard',
        detail: 'Your Grades page now has a complete Canvas experience built in — modules, assignments, announcements, files, and grades all in one place.',
      },
      {
        emoji: '🧹',
        headline: 'Cleaner Planner & AI',
        detail: 'Removed old auto-scraped HAC assignments that were cluttering your planner and confusing the AI. Futurely AI now only references your real Canvas and manually added work.',
      },
      {
        emoji: '🔔',
        headline: 'Tap Notifications to View Profiles',
        detail: 'Clicking a username in your notification bell now takes you straight to that person\'s profile — no more dead clicks.',
      },
      {
        emoji: '💬',
        headline: 'View Full Posts from Profiles',
        detail: 'Tap any post on a user\'s profile to read the full post and all its comments, even older ones that no longer appear in the main feed.',
      },
    ],
  },
  {
    version: '1.0.1',
    date: 'June 2025',
    title: 'Polish & Performance',
    changes: [
      {
        emoji: '✨',
        headline: 'Animated Profile Effects',
        detail: 'Gold Fill and Void Fill profile picture effects now animate in real time.',
      },
      {
        emoji: '🪙',
        headline: 'Daily Streak Coin Cap',
        detail: 'Daily streak coin bonuses are now capped at 275 coins to keep the economy balanced.',
      },
      {
        emoji: '🤖',
        headline: 'Faster AI Responses',
        detail: 'Switched to a faster AI model so Futurely AI responds more quickly.',
      },
    ],
  },
  {
    version: '1.0.0',
    date: 'May 2025',
    title: 'Initial Launch',
    changes: [
      {
        emoji: '🚀',
        headline: 'Futurely is Live',
        detail: 'GPA tracking, planner, AI academic companion, social feed, marketplace, college tools, and Canvas grade integration — all in one place.',
      },
    ],
  },
]

export const CURRENT_VERSION = CHANGELOG[0].version
