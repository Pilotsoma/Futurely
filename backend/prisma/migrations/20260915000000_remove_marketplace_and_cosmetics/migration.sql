-- Migration: remove_marketplace_and_cosmetics
-- Removes the coins/marketplace/cosmetics economy and the tag/allTags display system.
-- Promotes users who held MOD or DEV tags (via tag/allTags) to the role field
-- before dropping those columns, so no permission information is lost.

-- ── Step 1: Data preservation — promote tag holders to proper roles ────────────

-- Promote MOD tag holders → role = 'MODERATOR'.
-- Excludes TEACHER/COUNSELOR/PARENT too, not just ADMIN/DEV: role is a single
-- field, so a formally-approved educator/parent role must never be silently
-- overwritten by an informal MOD/DEV tag grant — that would break their
-- requireTeacher/requireCounselor/requireParent-gated access.
UPDATE "User"
SET role = 'MODERATOR'
WHERE role NOT IN ('ADMIN', 'DEV', 'TEACHER', 'COUNSELOR', 'PARENT')
  AND ("tag" = 'MOD' OR "allTags"::jsonb @> '[{"tag":"MOD"}]'::jsonb);

-- Promote DEV tag holders → role = 'DEV'. Same exclusion reasoning as above.
UPDATE "User"
SET role = 'DEV'
WHERE role NOT IN ('ADMIN', 'TEACHER', 'COUNSELOR', 'PARENT')
  AND ("tag" = 'DEV' OR "allTags"::jsonb @> '[{"tag":"DEV"}]'::jsonb);

-- ── Step 2: Drop columns from User ────────────────────────────────────────────

ALTER TABLE "User"
  DROP COLUMN IF EXISTS "tag",
  DROP COLUMN IF EXISTS "tagColor",
  DROP COLUMN IF EXISTS "allTags",
  DROP COLUMN IF EXISTS "coins",
  DROP COLUMN IF EXISTS "lastCoinClaim",
  DROP COLUMN IF EXISTS "lastFreeSpin",
  DROP COLUMN IF EXISTS "nameColor",
  DROP COLUMN IF EXISTS "avatarEffect",
  DROP COLUMN IF EXISTS "badge",
  DROP COLUMN IF EXISTS "ownedNameColors",
  DROP COLUMN IF EXISTS "ownedAvatarEffects",
  DROP COLUMN IF EXISTS "marketplaceAccess",
  DROP COLUMN IF EXISTS "marketplaceBanned",
  DROP COLUMN IF EXISTS "loginStreak",
  DROP COLUMN IF EXISTS "traderSellCount",
  DROP COLUMN IF EXISTS "traderSellDate",
  DROP COLUMN IF EXISTS "traderBuyCount",
  DROP COLUMN IF EXISTS "traderBuyDate",
  DROP COLUMN IF EXISTS "traderTradeCount",
  DROP COLUMN IF EXISTS "traderTradeDate",
  DROP COLUMN IF EXISTS "spinCoinsSpent",
  DROP COLUMN IF EXISTS "spinTotalSpins",
  DROP COLUMN IF EXISTS "spinCommon",
  DROP COLUMN IF EXISTS "spinUncommon",
  DROP COLUMN IF EXISTS "spinRare",
  DROP COLUMN IF EXISTS "spinEpic",
  DROP COLUMN IF EXISTS "spinLegendary",
  DROP COLUMN IF EXISTS "spinMythic",
  DROP COLUMN IF EXISTS "spinCurse";

-- ── Step 3: Drop columns from Post ────────────────────────────────────────────

ALTER TABLE "Post"
  DROP COLUMN IF EXISTS "giveawayTag",
  DROP COLUMN IF EXISTS "giveawayTagColor",
  DROP COLUMN IF EXISTS "giveawayCoinAmount",
  DROP COLUMN IF EXISTS "giveawayEndsAt",
  DROP COLUMN IF EXISTS "giveawayWinnerId",
  DROP COLUMN IF EXISTS "giveawayItemType",
  DROP COLUMN IF EXISTS "giveawayItemId",
  DROP COLUMN IF EXISTS "giveawayItemRarity",
  DROP COLUMN IF EXISTS "unboxItemType",
  DROP COLUMN IF EXISTS "unboxItemId",
  DROP COLUMN IF EXISTS "unboxItemName",
  DROP COLUMN IF EXISTS "unboxItemValue",
  DROP COLUMN IF EXISTS "unboxItemRarity",
  DROP COLUMN IF EXISTS "unboxItemEstValue",
  DROP COLUMN IF EXISTS "unboxItemTagColor";

-- ── Step 4: Drop marketplace/economy tables ────────────────────────────────────

DROP TABLE IF EXISTS "EducatorCoinGrant";
DROP TABLE IF EXISTS "GiveawayEntry";
DROP TABLE IF EXISTS "TradeOffer";
DROP TABLE IF EXISTS "ItemPrice";
DROP TABLE IF EXISTS "MarketplaceListing";
