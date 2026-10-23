-- ============================================================
-- Organization name in English and Tamil.
--
-- {{organization_name}} in message templates renders as
--   VP TRUST
--   வள்ளலார் பசியாற்றும் அறக்கட்டளை
-- read from these two columns (editable by an admin in Settings →
-- Organization Details). Every template is also given a sign-off that
-- uses {{organization_name}} if its last line doesn't already have one.
-- ============================================================

ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS org_name_en text NOT NULL DEFAULT 'VP TRUST',
  ADD COLUMN IF NOT EXISTS org_name_ta text NOT NULL DEFAULT 'வள்ளலார் பசியாற்றும் அறக்கட்டளை';

-- Make sure the single settings row exists so the names have somewhere to live.
INSERT INTO organization_settings (name)
SELECT 'VP Trust'
WHERE NOT EXISTS (SELECT 1 FROM organization_settings);

-- Append the sign-off to templates whose last line doesn't mention {{organization_name}}.
UPDATE message_templates
SET body = rtrim(body, E' \t\r\n') || E'\n\nWith gratitude,\n{{organization_name}}',
    variables = CASE
      WHEN 'organization_name' = ANY(coalesce(variables, '{}')) THEN variables
      ELSE array_append(coalesce(variables, '{}'), 'organization_name')
    END,
    updated_at = now()
WHERE rtrim(body, E' \t\r\n') !~ '\{\{\s*organization_name\s*\}\}[^\n]*$';
