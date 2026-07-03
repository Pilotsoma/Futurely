-- Streak feature removed: drop the login-streak counter from User.
-- lastSeenAt / lastCoinClaim are kept — they back general activity stats and
-- the (now streak-free) daily coin claim, not the streak feature.
ALTER TABLE "User" DROP COLUMN IF EXISTS "loginStreak";
