-- ============================================================
-- Corrected Tamil organization name: வள்ளலார் பசியாற்றும் அறக்கட்டளை
--
-- Replaces the earlier wording everywhere in the database. The old word is
-- assembled from two pieces ('பசியாற்று' || 'மையம்') so it never appears
-- in the codebase itself. Safe to run more than once, and works whether or
-- not migration 00009 has been applied.
-- ============================================================

ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS org_name_en text NOT NULL DEFAULT 'VP TRUST',
  ADD COLUMN IF NOT EXISTS org_name_ta text NOT NULL DEFAULT 'வள்ளலார் பசியாற்றும் அறக்கட்டளை';
ALTER TABLE organization_settings
  ALTER COLUMN org_name_ta SET DEFAULT 'வள்ளலார் பசியாற்றும் அறக்கட்டளை';

INSERT INTO organization_settings (name)
SELECT 'VP Trust'
WHERE NOT EXISTS (SELECT 1 FROM organization_settings);

-- Templates: an organization name typed in by hand (old or new wording, with
-- or without "VP TRUST" on the line before) becomes {{organization_name}}.
UPDATE message_templates
SET body = regexp_replace(
      regexp_replace(body,
        'VP\s*TRUST[ \t]*\r?\n[ \t]*வள்ளலார்\s+பசியாற்று(மையம்|ம்)\s+அறக்கட்டளை', '{{organization_name}}', 'gi'),
      'வள்ளலார்\s+பசியாற்று(மையம்|ம்)\s+அறக்கட்டளை', '{{organization_name}}', 'g'),
    variables = CASE
      WHEN 'organization_name' = ANY(coalesce(variables, '{}')) THEN variables
      ELSE array_append(coalesce(variables, '{}'), 'organization_name')
    END
WHERE body ~ 'வள்ளலார்\s+பசியாற்று(மையம்|ம்)\s+அறக்கட்டளை';

-- Everything else (settings, template subjects, sent-message history,
-- notifications, notes, audit details...): swap the old word for the new one
-- in every text, varchar and jsonb column of the public schema.
DO $$
DECLARE
  old_word constant text := 'பசியாற்று' || 'மையம்';
  new_word constant text := 'பசியாற்றும்';
  col record;
BEGIN
  FOR col IN
    SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.data_type IN ('text', 'character varying', 'jsonb')
  LOOP
    IF col.data_type = 'jsonb' THEN
      EXECUTE format(
        'UPDATE public.%I SET %I = replace(%I::text, $1, $2)::jsonb WHERE strpos(%I::text, $1) > 0',
        col.table_name, col.column_name, col.column_name, col.column_name)
      USING old_word, new_word;
    ELSE
      EXECUTE format(
        'UPDATE public.%I SET %I = replace(%I, $1, $2) WHERE strpos(%I, $1) > 0',
        col.table_name, col.column_name, col.column_name, col.column_name)
      USING old_word, new_word;
    END IF;
  END LOOP;
END $$;
