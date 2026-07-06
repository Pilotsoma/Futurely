import { prisma } from './prisma'

const PATCHES: string[] = [
  // ── User columns ─────────────────────────────────────────────────────
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

  // ── Post columns ─────────────────────────────────────────────────────
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

  // ── Unique constraint on User.name ───────────────────────────────────
  // Deduplicate only if duplicates actually exist (avoids a full table scan every cold start).
  `DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM "User" WHERE name IS NOT NULL
      GROUP BY name HAVING COUNT(*) > 1 LIMIT 1
    ) THEN
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS rn
        FROM "User" WHERE name IS NOT NULL
      )
      UPDATE "User" SET name = NULL FROM ranked
      WHERE "User".id = ranked.id AND ranked.rn > 1;
    END IF;
  END $$`,

  // IF NOT EXISTS avoids the AccessExclusiveLock when the constraint already exists.
  `ALTER TABLE "User" ADD CONSTRAINT IF NOT EXISTS "User_name_key" UNIQUE ("name")`,

  // ── Tables ───────────────────────────────────────────────────────────
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

  // ── Spin stats columns ───────────────────────────────────────────────
  `ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "spinCoinsSpent"  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "spinTotalSpins"  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "spinCommon"      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "spinUncommon"    INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "spinRare"        INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "spinEpic"        INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "spinLegendary"   INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "spinMythic"      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "spinCurse"       INTEGER NOT NULL DEFAULT 0`,

  // ── COPPA compliance columns ─────────────────────────────────────────
  `ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "dateOfBirth"           DATE        DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS "coppaConsentStatus"    TEXT        NOT NULL DEFAULT 'not_required',
    ADD COLUMN IF NOT EXISTS "coppaConsentTimestamp" TIMESTAMP(3) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS "coppaParentEmail"      TEXT        DEFAULT NULL`,
]

// Data-level repairs that are always idempotent and safe to re-run on every cold start.
// These fix rows that became inconsistent before code-level guards were in place.
const DATA_REPAIRS: string[] = [
  // Clear stale badge values: user sold their verified tag without un-equipping it.
  `UPDATE "User"
   SET badge = NULL
   WHERE badge IN ('verified-yellow', 'verified-blue')
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(
         CASE
           WHEN jsonb_typeof("allTags") = 'string' THEN ("allTags"#>>'{}')::jsonb
           WHEN jsonb_typeof("allTags") = 'array'  THEN "allTags"
           ELSE '[]'::jsonb
         END
       ) AS t
       WHERE t->>'tagColor' = "User".badge
     )`,

  // Clear stale equipped tagColor / tag values for the same reason.
  `UPDATE "User"
   SET tag = 'Student', "tagColor" = NULL
   WHERE "tagColor" IN ('verified-yellow', 'verified-blue')
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(
         CASE
           WHEN jsonb_typeof("allTags") = 'string' THEN ("allTags"#>>'{}')::jsonb
           WHEN jsonb_typeof("allTags") = 'array'  THEN "allTags"
           ELSE '[]'::jsonb
         END
       ) AS t
       WHERE t->>'tagColor' = "User"."tagColor"
     )`,
]

let patchPromise: Promise<void> | null = null

export function ensureSchema(): Promise<void> {
  if (patchPromise) return patchPromise
  patchPromise = (async () => {
    // Probe checks the two newest schema additions. If both exist, schema patches are skipped.
    // IMPORTANT: update this probe whenever a new column/table is added to PATCHES above.
    try {
      await prisma.$queryRawUnsafe(`SELECT "coppaConsentStatus" FROM "User" LIMIT 0`)
      await prisma.$queryRawUnsafe(`SELECT 1 FROM "EmailOTP" LIMIT 0`)
    } catch {
      // Schema is incomplete — run patches below.
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
    }

    // Always run data repairs — they are idempotent and fast.
    for (const sql of DATA_REPAIRS) {
      try {
        await prisma.$executeRawUnsafe(sql)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[startup] data repair failed:', sql.slice(0, 80), msg)
      }
    }
  })()
  return patchPromise
}
