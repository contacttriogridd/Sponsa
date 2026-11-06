-- ============================================================
-- Festival Wishes, and family members of monthly sponsors.
--
--   monthly_family_members   people under a monthly sponsor (a separate
--                            table: family_members already holds general
--                            sponsors' families)
--   festivals                Deepavali first; more added as rows
--   festival_templates       per festival × category × language, with
--                            the default text kept for "Reset to default"
--   message_logs.*           festival sends are logged here like every
--                            other message, so "Sent ✓" and the
--                            "Did you send?" prompt work the same way
--   monthly_sponsor_reminders.family_member_id   star-day reminders for
--                            family members, de-duplicated per person
-- ============================================================

CREATE TABLE IF NOT EXISTS monthly_family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_sponsor_id uuid NOT NULL REFERENCES monthly_sponsors(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) > 0),
  relationship text NOT NULL CHECK (relationship IN (
    'Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Grandfather', 'Grandmother', 'Brother', 'Sister', 'Other'
  )),
  relationship_other text,
  star smallint CHECK (star BETWEEN 0 AND 26),
  raasi smallint CHECK (raasi BETWEEN 0 AND 11),
  dob date,
  phone text,
  address text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_monthly_family_members_sponsor ON monthly_family_members (monthly_sponsor_id);
DROP TRIGGER IF EXISTS monthly_family_members_updated_at ON monthly_family_members;
CREATE TRIGGER monthly_family_members_updated_at BEFORE UPDATE ON monthly_family_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS festivals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_ta text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS festival_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('general', 'monthly')),
  language text NOT NULL CHECK (language IN ('en', 'ta')),
  body text NOT NULL,
  default_body text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (festival_id, category, language)
);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['monthly_family_members', 'festivals', 'festival_templates'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I', t, t);
    EXECUTE format('CREATE POLICY "%s_select" ON %I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON %I', t, t);
    EXECUTE format('CREATE POLICY "%s_insert" ON %I FOR INSERT TO authenticated WITH CHECK (current_app_role() IN (''admin'', ''collector''))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON %I', t, t);
    EXECUTE format('CREATE POLICY "%s_update" ON %I FOR UPDATE TO authenticated USING (current_app_role() IN (''admin'', ''collector'')) WITH CHECK (current_app_role() IN (''admin'', ''collector''))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON %I', t, t);
    EXECUTE format('CREATE POLICY "%s_delete" ON %I FOR DELETE TO authenticated USING (current_app_role() IN (''admin'', ''collector''))', t, t);
  END LOOP;
END $$;

-- Festival sends in the message log.
ALTER TABLE message_logs
  ADD COLUMN IF NOT EXISTS monthly_sponsor_id uuid REFERENCES monthly_sponsors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS festival_key text,
  ADD COLUMN IF NOT EXISTS festival_year int,
  ADD COLUMN IF NOT EXISTS sponsor_category text CHECK (sponsor_category IN ('general', 'monthly')),
  ADD COLUMN IF NOT EXISTS language text CHECK (language IN ('en', 'ta', 'both'));
ALTER TABLE message_logs DROP CONSTRAINT IF EXISTS message_logs_message_type_check;
ALTER TABLE message_logs ADD CONSTRAINT message_logs_message_type_check CHECK (message_type IN (
  'birthday_wish', 'anniversary_wish', 'event_wish', 'donation_thanks', 'admin_notification', 'admin_daily_summary', 'festival_wish'
));
CREATE INDEX IF NOT EXISTS idx_message_logs_festival ON message_logs (festival_key, festival_year);

-- Star-day reminders for family members: one per person, not one per sponsor.
ALTER TABLE monthly_sponsor_reminders
  ADD COLUMN IF NOT EXISTS family_member_id uuid REFERENCES monthly_family_members(id) ON DELETE CASCADE;
DO $$
DECLARE
  c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
  WHERE conrelid = 'monthly_sponsor_reminders'::regclass AND contype = 'u';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE monthly_sponsor_reminders DROP CONSTRAINT %I', c); END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_sponsor_reminders_dedup ON monthly_sponsor_reminders
  (monthly_sponsor_id, kind, target_date, days_before, coalesce(family_member_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Deepavali and its four templates.
INSERT INTO festivals (key, name_en, name_ta, sort_order) VALUES ('deepavali', 'Deepavali', 'தீபாவளி', 10)
ON CONFLICT (key) DO NOTHING;

INSERT INTO festival_templates (festival_id, category, language, body, default_body)
SELECT f.id, v.category, v.language, v.body, v.body
FROM festivals f
CROSS JOIN (VALUES
('general', 'en',
'Dear {{sponsor_name}},

Warm Deepavali greetings from {{organization_name}}! 🪔

May the light of this Deepavali fill your home with happiness, good health and prosperity. Your kind support helps us serve food to those in hunger, and we are truly grateful for it.

As Vallalar taught us, may compassion for all lives light up our hearts this festival.

Wishing you and your family a safe and joyful Deepavali.

With gratitude,
{{organization_name}}'),
('general', 'ta',
'அன்புள்ள {{sponsor_name}} அவர்களுக்கு,

{{organization_name}} சார்பாக இனிய தீபாவளி நல்வாழ்த்துகள்! 🪔

இந்த தீபத் திருநாள் உங்கள் இல்லத்தில் மகிழ்ச்சி, நல்ல உடல்நலம், செல்வச் செழிப்பு ஆகியவற்றை நிறைக்கட்டும். பசித்தோருக்கு உணவளிக்கும் எங்கள் பணிக்கு நீங்கள் அளிக்கும் ஆதரவுக்கு எங்கள் மனமார்ந்த நன்றி.

"வாடிய பயிரைக் கண்டபோதெல்லாம் வாடினேன்" என்ற வள்ளலாரின் கருணை உள்ளம் நம் அனைவரின் மனதிலும் ஒளி ஏற்றட்டும்.

உங்களுக்கும் உங்கள் குடும்பத்தினருக்கும் பாதுகாப்பான, மகிழ்ச்சியான தீபாவளி வாழ்த்துகள்.

நன்றியுடன்,
{{organization_name}}'),
('monthly', 'en',
'Dear {{sponsor_name}} and family,

Heartfelt Deepavali greetings from {{organization_name}}! 🪔

Your continued monthly support is what keeps our annadhanam going every single month. Thank you for your love, trust and generosity.

Our special Deepavali wishes to {{family_member_names}}.

May this festival of lights bring joy, good health and prosperity to your entire family.

Arutperunjothi Arutperunjothi Thanipperunkarunai Arutperunjothi!

With gratitude,
{{organization_name}}'),
('monthly', 'ta',
'அன்புள்ள {{sponsor_name}} அவர்களுக்கும் அவர்தம் குடும்பத்தினருக்கும்,

{{organization_name}} சார்பாக இனிய தீபாவளி நல்வாழ்த்துகள்! 🪔

மாதந்தோறும் நீங்கள் அளித்து வரும் தொடர் ஆதரவால் தான், ஒவ்வொரு மாதமும் பசித்தோருக்கு அன்னம் வழங்கும் எங்கள் பணி தடையின்றி நடைபெறுகிறது. உங்கள் அன்பிற்கும் நம்பிக்கைக்கும் எங்கள் நெஞ்சார்ந்த நன்றி.

{{family_member_names}} உட்பட உங்கள் குடும்பத்தினர் அனைவருக்கும் எங்கள் சிறப்பு தீபாவளி வாழ்த்துகள்.

இந்த தீபத் திருநாள் உங்கள் குடும்பத்திற்கு மகிழ்ச்சி, ஆரோக்கியம், வளம் நிறைந்ததாக அமையட்டும்.

அருட்பெருஞ்ஜோதி அருட்பெருஞ்ஜோதி தனிப்பெருங்கருணை அருட்பெருஞ்ஜோதி!

நன்றியுடன்,
{{organization_name}}')
) AS v(category, language, body)
WHERE f.key = 'deepavali'
ON CONFLICT (festival_id, category, language) DO NOTHING;
