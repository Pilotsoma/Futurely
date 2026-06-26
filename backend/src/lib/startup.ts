import { prisma } from './prisma'

// Grouped into as few round-trips as possible: one ALTER TABLE per target table,
// plus individual CREATE TABLE IF NOT EXISTS statements.
const PATCHES: string[] = [
  // ── User columns (single round-trip) ─────────────────────────────
  `ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "hacName"                  TEXT,
    ADD COLUMN IF NOT EXISTS "coins"                    INTEGER      NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "lastCoinClaim"            TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "nameColor"                TEXT,
    ADD COLUMN IF NOT EXISTS "avatarEffect"             TEXT,
    ADD COLUMN IF NOT EXISTS "avatarUrl"                TEXT,
    ADD COLUMN IF NOT EXISTS "ownedNameColors"          JSONB        NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS "ownedAvatarEffects"       JSONB        NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS "allTags"                  JSONB        NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS "loginStreak"              INTEGER      NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "marketplaceAccess"        BOOLEAN      NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "lastSeenAt"               TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "chatBanned"               BOOLEAN      NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "marketplaceBanned"        BOOLEAN      NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "chatMutedUntil"           TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "failedLoginAttempts"      INTEGER      NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "lockedUntil"              TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "emailVerified"            BOOLEAN      NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "emailVerificationToken"   TEXT,
    ADD COLUMN IF NOT EXISTS "emailVerificationExpiry"  TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "deletedAt"                TIMESTAMP(3)`,

  // ALTER COLUMN must be its own statement
  `ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL`,

  // ── Post columns (single round-trip) ─────────────────────────────
  `ALTER TABLE "Post"
    ADD COLUMN IF NOT EXISTS "type"                TEXT  NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN IF NOT EXISTS "giveawayTag"         TEXT,
    ADD COLUMN IF NOT EXISTS "giveawayTagColor"    TEXT,
    ADD COLUMN IF NOT EXISTS "giveawayCoinAmount"  INTEGER,
    ADD COLUMN IF NOT EXISTS "giveawayEndsAt"      TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "giveawayWinnerId"    INTEGER,
    ADD COLUMN IF NOT EXISTS "giveawayItemType"    TEXT,
    ADD COLUMN IF NOT EXISTS "giveawayItemId"      TEXT,
    ADD COLUMN IF NOT EXISTS "giveawayItemRarity"  TEXT,
    ADD COLUMN IF NOT EXISTS "unboxItemType"       TEXT,
    ADD COLUMN IF NOT EXISTS "unboxItemId"         TEXT,
    ADD COLUMN IF NOT EXISTS "unboxItemName"       TEXT,
    ADD COLUMN IF NOT EXISTS "unboxItemValue"      TEXT,
    ADD COLUMN IF NOT EXISTS "unboxItemRarity"     TEXT,
    ADD COLUMN IF NOT EXISTS "unboxItemEstValue"   INTEGER,
    ADD COLUMN IF NOT EXISTS "unboxItemTagColor"   TEXT,
    ADD COLUMN IF NOT EXISTS "pinnedUntil"         TIMESTAMP(3)`,

  // ── Unique constraint on User.name ───────────────────────────────
  // Deduplicate first (keeps the row with the lowest id per name).
  `WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS rn
    FROM "User" WHERE name IS NOT NULL
  )
  UPDATE "User" SET name = NULL FROM ranked
  WHERE "User".id = ranked.id AND ranked.rn > 1`,

  `ALTER TABLE "User" ADD CONSTRAINT "User_name_key" UNIQUE ("name")`,

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
    // Single probe: if the most recently added column and table both exist,
    // schema is already fully patched — skip all work.
    try {
      await prisma.$queryRawUnsafe(`SELECT "deletedAt" FROM "User" LIMIT 0`)
      await prisma.$queryRawUnsafe(`SELECT 1 FROM "EmailOTP" LIMIT 0`)
      return
    } catch {
      // Schema is incomplete — run patches below.
    }
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
