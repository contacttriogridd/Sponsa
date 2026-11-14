-- ============================================================
-- "Both" (Tamil + English) option in Send Thanks, and remembered languages.
--
--   organization_settings.thank_you_language   default for everyone, set in
--     Settings -> Message Templates -> Thank-You Note ('en' / 'ta' / 'both')
--   app_users.thank_you_language               the language each user last
--     picked in Send Thanks; it wins over the default for that user
--
-- Users may already update their own app_users row (migration 00003), so
-- remembering the choice works for collectors as well as admins.
-- Existing data is not changed.
-- ============================================================

ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS thank_you_language text NOT NULL DEFAULT 'ta';
ALTER TABLE organization_settings DROP CONSTRAINT IF EXISTS organization_settings_thank_you_language_check;
ALTER TABLE organization_settings ADD CONSTRAINT organization_settings_thank_you_language_check
  CHECK (thank_you_language IN ('en', 'ta', 'both'));

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS thank_you_language text;
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_thank_you_language_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_thank_you_language_check
  CHECK (thank_you_language IS NULL OR thank_you_language IN ('en', 'ta', 'both'));
