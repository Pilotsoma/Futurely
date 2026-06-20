-- Idempotent schema patches — safe to run on every deployment.
-- Use IF NOT EXISTS so re-runs are no-ops.

-- ── User table patches ───────────────────────────────────────────────────────
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hacName" TEXT;
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastCoinClaim" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nameColor" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pfpEffect" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ownedNameColors" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ownedPfpEffects" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "allTags" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "chatBanned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "chatMutedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationExpiry" TIMESTAMP(3);

-- ── Post table patches ───────────────────────────────────────────────────────
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "giveawayTag" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "giveawayTagColor" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "giveawayCoinAmount" INTEGER;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "giveawayEndsAt" TIMESTAMP(3);
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "giveawayWinnerId" INTEGER;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "giveawayItemType" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "giveawayItemId" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "giveawayItemRarity" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "unboxItemType" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "unboxItemId" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "unboxItemName" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "unboxItemValue" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "unboxItemRarity" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "unboxItemEstValue" INTEGER;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "unboxItemTagColor" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "pinnedUntil" TIMESTAMP(3);

-- Foreign key for giveawayWinnerId (safe — only adds if constraint missing)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Post_giveawayWinnerId_fkey'
  ) THEN
    ALTER TABLE "Post" ADD CONSTRAINT "Post_giveawayWinnerId_fkey"
      FOREIGN KEY ("giveawayWinnerId") REFERENCES "User"("id");
  END IF;
END $$;

-- ── GiveawayEntry table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "GiveawayEntry" (
  "id"        SERIAL PRIMARY KEY,
  "postId"    INTEGER NOT NULL REFERENCES "Post"("id") ON DELETE CASCADE,
  "userId"    INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiveawayEntry_postId_userId_key" UNIQUE ("postId", "userId")
);

-- ── CommentLike table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CommentLike" (
  "id"        SERIAL PRIMARY KEY,
  "commentId" INTEGER NOT NULL REFERENCES "Comment"("id") ON DELETE CASCADE,
  "userId"    INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommentLike_commentId_userId_key" UNIQUE ("commentId", "userId")
);

-- ── OAuth / OTP tables ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "OAuthAccount" (
  "id"         SERIAL PRIMARY KEY,
  "userId"     INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "provider"   TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "email"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthAccount_provider_providerId_key" UNIQUE ("provider", "providerId")
);

CREATE TABLE IF NOT EXISTS "EmailOTP" (
  "id"        SERIAL PRIMARY KEY,
  "email"     TEXT NOT NULL,
  "codeHash"  TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
