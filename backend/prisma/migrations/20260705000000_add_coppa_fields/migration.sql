-- COPPA compliance: add age-gate fields to User.
-- All columns are nullable / have safe defaults so existing rows are unaffected.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "dateOfBirth"           DATE        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "coppaConsentStatus"    TEXT        NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS "coppaConsentTimestamp" TIMESTAMP(3) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "coppaParentEmail"      TEXT        DEFAULT NULL;
