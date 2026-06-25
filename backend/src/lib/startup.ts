import { prisma } from './prisma'

// Each entry is one idempotent SQL statement.
// Runs once per cold start. Errors are caught per-statement so one
// failure doesn't block the rest. "already exists" errors are silently
// ignored (expected on re-runs after the first deploy that adds them).
const PATCHES: string[] = [
  // ── User columns ─────────────────────────────────────────────────
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hacName" TEXT`,
  `ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coins" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastCoinClaim" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nameColor" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarEffect" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ownedNameColors" JSONB NOT NULL DEFAULT '[]'`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ownedAvatarEffects" JSONB NOT NULL DEFAULT '[]'`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "allTags" JSONB NOT NULL DEFAULT '[]'`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginStreak" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketplaceAccess" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "chatBanned" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "chatMutedUntil" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationExpiry" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`,
  // Deduplicate names before adding unique constraint (keeps lowest id per name)
  `WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS rn
    FROM "User" WHERE name IS NOT NULL
  )
  UPDATE "User" SET name = NULL FROM ranked
  WHERE "User".id = ranked.id AND ranked.rn > 1`,
  `ALTER TABLE "User" ADD CONSTRAINT "User_name_key" UNIQUE ("name")`,

  // ── Post columns ─────────────────────────────────────────────────
  `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'NORMAL'`,
  `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "giveawayTag" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "giveawayTagColor" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "giveawayCoinAmount" INTEGER`,
  `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "giveawayEndsAt" TIMESTAMP(3)`,
  `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "giveawayWinnerId" INTEGER`,
  `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "giveawayItemType" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "giveawayItemId" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "giveawayItemRarity" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "unboxItemType" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "unboxItemId" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "unboxItemName" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "unboxItemValue" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "unboxItemRarity" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "unboxItemEstValue" INTEGER`,
  `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "unboxItemTagColor" TEXT`,
  `ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "pinnedUntil" TIMESTAMP(3)`,

  // ── Tables ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "GiveawayEntry" (
    "id"        SERIAL PRIMARY KEY,
    "postId"    INTEGER NOT NULL REFERENCES "Post"("id") ON DELETE CASCADE,
    "userId"    INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GiveawayEntry_postId_userId_key" UNIQUE ("postId", "userId")
  )`,
  `CREATE TABLE IF NOT EXISTS "CommentLike" (
    "id"        SERIAL PRIMARY KEY,
    "commentId" INTEGER NOT NULL REFERENCES "Comment"("id") ON DELETE CASCADE,
    "userId"    INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommentLike_commentId_userId_key" UNIQUE ("commentId", "userId")
  )`,
  `CREATE TABLE IF NOT EXISTS "OAuthAccount" (
    "id"         SERIAL PRIMARY KEY,
    "userId"     INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "provider"   TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "email"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthAccount_provider_providerId_key" UNIQUE ("provider", "providerId")
  )`,
  `CREATE TABLE IF NOT EXISTS "EmailOTP" (
    "id"        SERIAL PRIMARY KEY,
    "email"     TEXT NOT NULL,
    "codeHash"  TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
]

let patchPromise: Promise<void> | null = null

export function ensureSchema(): Promise<void> {
  if (patchPromise) return patchPromise
  patchPromise = (async () => {
    for (const sql of PATCHES) {
      try {
        await prisma.$executeRawUnsafe(sql)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (!msg.includes('already exists') && !msg.includes('does not exist')) {
          console.error('[startup] patch failed:', sql.slice(0, 80), msg)
        }
      }
    }
    console.log('[startup] schema patches complete')
  })()
  return patchPromise
}
