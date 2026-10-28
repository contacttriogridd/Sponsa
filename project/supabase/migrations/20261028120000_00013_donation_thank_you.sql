-- ============================================================
-- Thank-you messages after a donation.
--
--   donations.thank_you_sent / _sent_at / _channel   whether and how a
--     thank-you went out (shown as "Thanked ✓ via WhatsApp" on the card)
--   organization_settings.thank_you_template_en / _ta   admin-editable
--     English and Tamil text; NULL means use the built-in default.
-- The signature always comes from {{organization_name}} (org_name_en /
-- org_name_ta), the same source as every other template.
-- ============================================================

ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS thank_you_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS thank_you_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS thank_you_channel text CHECK (thank_you_channel IN ('whatsapp', 'sms', 'email', 'copy'));

ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS thank_you_template_en text,
  ADD COLUMN IF NOT EXISTS thank_you_template_ta text;
