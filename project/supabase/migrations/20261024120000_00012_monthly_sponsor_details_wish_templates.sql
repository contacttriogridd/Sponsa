-- ============================================================
-- Monthly sponsor details, wish history and star-day templates.
--
--   monthly_sponsors.address / .payment_mode   shown in the detail drawer
--   monthly_wish_log                           every star-day wish sent or copied
--   "Star Day Upcoming" / "Star Day Today"     templates picked by Send Wish
-- ============================================================

ALTER TABLE monthly_sponsors
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS payment_mode text CHECK (payment_mode IN ('Cash', 'UPI', 'Bank'));

CREATE TABLE IF NOT EXISTS monthly_wish_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_sponsor_id uuid NOT NULL REFERENCES monthly_sponsors(id) ON DELETE CASCADE,
  star_date date,
  template_type text,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'copy')),
  message text NOT NULL,
  sent_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_monthly_wish_log_sponsor ON monthly_wish_log (monthly_sponsor_id, sent_at DESC);

ALTER TABLE monthly_wish_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "monthly_wish_log_select" ON monthly_wish_log;
CREATE POLICY "monthly_wish_log_select" ON monthly_wish_log FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "monthly_wish_log_insert" ON monthly_wish_log;
CREATE POLICY "monthly_wish_log_insert" ON monthly_wish_log FOR INSERT TO authenticated
  WITH CHECK (current_app_role() IN ('admin', 'collector'));
DROP POLICY IF EXISTS "monthly_wish_log_delete" ON monthly_wish_log;
CREATE POLICY "monthly_wish_log_delete" ON monthly_wish_log FOR DELETE TO authenticated
  USING (current_app_role() = 'admin');

ALTER TABLE message_templates DROP CONSTRAINT IF EXISTS message_templates_type_check;
ALTER TABLE message_templates ADD CONSTRAINT message_templates_type_check CHECK (type IN (
  'Birthday Wish', 'Anniversary Wish', 'Child Birthday', 'Sponsorship Request', 'Thank You', 'Follow-up',
  'Star Day Wish', 'Star Day Upcoming', 'Star Day Today'
));

INSERT INTO message_templates (name, type, body, variables, is_approved)
SELECT 'நட்சத்திர நாள் வருகிறது (Star day upcoming)', 'Star Day Upcoming',
'அன்புள்ள {{sponsor_name}} அவர்களுக்கு,

இன்னும் {{days_left}} நாளில், {{star_day_date}} அன்று உங்கள் நட்சத்திர நாள் ({{star_tamil}}) வருகிறது. இறைவன் அருளால் நீங்களும் உங்கள் குடும்பத்தினரும் நலமும் மகிழ்ச்சியும் பெற முன்கூட்டியே வாழ்த்துகிறோம். தங்களின் தொடர்ந்த மாதாந்திர உதவிக்கு மனமார்ந்த நன்றி.

Dear {{sponsor_name}},

Your star day ({{star_english}}) is on {{star_day_weekday}}, {{star_day_date}} — just {{days_left}} day(s) away. Warm wishes to you and your family in advance, and thank you for your continued monthly support.

Contact: {{contact_phone}}

With gratitude,
{{organization_name}}',
ARRAY['sponsor_name', 'days_left', 'star_day_date', 'star_tamil', 'star_english', 'star_day_weekday', 'contact_phone', 'organization_name'],
true
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE type = 'Star Day Upcoming');

INSERT INTO message_templates (name, type, body, variables, is_approved)
SELECT 'இன்று நட்சத்திர நாள் (Star day today)', 'Star Day Today',
'அன்புள்ள {{sponsor_name}} அவர்களுக்கு,

இன்று ({{star_day_date}}) உங்கள் நட்சத்திர நாள் — {{star_tamil}}. இறைவன் அருளால் நீங்களும் உங்கள் குடும்பத்தினரும் நலமும் மகிழ்ச்சியும் பெற்று வாழ வாழ்த்துகிறோம். தங்களின் தொடர்ந்த மாதாந்திர உதவிக்கு மனமார்ந்த நன்றி.

Dear {{sponsor_name}},

Happy star day! Today, {{star_day_weekday}} {{star_day_date}}, is your star day ({{star_english}}). May you and your family be blessed with good health and happiness. Thank you for your continued monthly support.

With gratitude,
{{organization_name}}',
ARRAY['sponsor_name', 'star_day_date', 'star_tamil', 'star_day_weekday', 'star_english', 'organization_name'],
true
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE type = 'Star Day Today');

-- Organization contact number for {{contact_phone}} (only if none is saved yet).
UPDATE organization_settings
SET phone = '+91 96295 22777'
WHERE phone IS NULL OR btrim(phone) = '';
