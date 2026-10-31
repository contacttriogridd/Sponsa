-- ============================================================
-- Dashboard "Mark as Done" and the new donation thank-you template.
--
--   reminder_completions            today's reminders marked done, per day
--   organization_settings.thank_you_template
--     one bilingual template (NULL = the built-in text in lib/thank-you.ts);
--     replaces the separate English / Tamil columns from 00013.
-- ============================================================

CREATE TABLE IF NOT EXISTS reminder_completions (
  item_key text NOT NULL,
  reminder_date date NOT NULL,
  done_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  done_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_key, reminder_date)
);

ALTER TABLE reminder_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reminder_completions_select" ON reminder_completions;
CREATE POLICY "reminder_completions_select" ON reminder_completions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "reminder_completions_insert" ON reminder_completions;
CREATE POLICY "reminder_completions_insert" ON reminder_completions FOR INSERT TO authenticated
  WITH CHECK (current_app_role() IN ('admin', 'collector'));
DROP POLICY IF EXISTS "reminder_completions_update" ON reminder_completions;
CREATE POLICY "reminder_completions_update" ON reminder_completions FOR UPDATE TO authenticated
  USING (current_app_role() IN ('admin', 'collector')) WITH CHECK (current_app_role() IN ('admin', 'collector'));
DROP POLICY IF EXISTS "reminder_completions_delete" ON reminder_completions;
CREATE POLICY "reminder_completions_delete" ON reminder_completions FOR DELETE TO authenticated
  USING (current_app_role() IN ('admin', 'collector'));

ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS thank_you_template text;
ALTER TABLE organization_settings
  DROP COLUMN IF EXISTS thank_you_template_en,
  DROP COLUMN IF EXISTS thank_you_template_ta;

-- The old generic "Thank You" template, only if still in its original wording.
DELETE FROM message_templates
WHERE type = 'Thank You' AND body LIKE '%Thank you for your generous contribution%';
