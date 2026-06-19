-- Idempotent schema patches — safe to run on every deployment.
-- Use IF NOT EXISTS so re-runs are no-ops.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hacName" TEXT;
