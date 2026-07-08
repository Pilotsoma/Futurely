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
    version: '1.0.3',
    date: 'June 18, 2025',
    title: 'Marketplace Overhaul',
    changes: [
      {
        emoji: '🎰',
        headline: 'Spin Wheel',
        detail: 'Opening a box now launches a spin wheel — segments sized by drop rate, with a 4-second deceleration animation landing on what you won.',
      },
      {
        emoji: '📖',
        headline: 'Item Catalog',
        detail: 'New Catalog tab lists every item in the game. Click any item to see its full sales history chart and all current owners.',
      },
      {
        emoji: '🏆',
        headline: 'Leaderboards',
        detail: 'New Leaderboard tab with three rankings: richest by coins, richest by inventory value, and highest login streak.',
      },
      {
        emoji: '🐐',
        headline: 'GOAT Tag Now Tradeable',
        detail: 'The day-100 streak GOAT tag can now be listed on the marketplace and traded with other players. Lower streak tags (Novice, Pro, Veteran, Legend) remain soulbound.',
      },
      {
        emoji: '🏷️',
        headline: 'Tag Rebalance',
        detail: 'Genius is now Epic (pink), Prodigy is now Legendary (black), and Valedictorian\'s color is updated to white.',
      },
      {
        emoji: '🎨',
        headline: 'Rarity Borders Everywhere',
        detail: 'Items in your inventory, the shop, and trade offers now show rarity-colored borders. Unbox result cards also use rarity color instead of item color.',
      },
    ],
  },
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
        detail: 'Removed old auto-scraped HAC assignments that were cluttering your planner and confusing the AI. myFuturely AI now only references your real Canvas and manually added work.',
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
        detail: 'Gold Fill and Void Fill avatar effects now animate in real time.',
      },
      {
        emoji: '🪙',
        headline: 'Daily Streak Coin Cap',
        detail: 'Daily streak coin bonuses are now capped at 275 coins to keep the economy balanced.',
      },
      {
        emoji: '🤖',
        headline: 'Faster AI Responses',
        detail: 'Switched to a faster AI model so myFuturely AI responds more quickly.',
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
        headline: 'myFuturely is Live',
        detail: 'GPA tracking, planner, AI academic companion, social feed, marketplace, college tools, and Canvas grade integration — all in one place.',
      },
    ],
  },
]

export const CURRENT_VERSION = CHANGELOG[0].version
