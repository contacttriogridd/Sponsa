-- ============================================================
-- Occasion types, contact person per occasion, occasion messages.
--
--   occasion_types                  admin-editable list (Settings → Occasion Types)
--   sponsors.title                  Mr / Mrs / Ms / Dr
--   special_occasions.*             who to contact, linked donation, reminder days
--   message_templates               five "Occasion: ..." English + Tamil templates
--   message_logs.occasion_id/_type  which occasion a message was for
-- Existing occasions stay where they are and are only given a type key.
-- ============================================================

CREATE TABLE IF NOT EXISTS occasion_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_ta text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '✨',
  category text NOT NULL CHECK (category IN ('birthday', 'anniversary', 'remembrance', 'other')),
  needs_person_name boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE occasion_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "occasion_types_select" ON occasion_types;
CREATE POLICY "occasion_types_select" ON occasion_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "occasion_types_insert" ON occasion_types;
CREATE POLICY "occasion_types_insert" ON occasion_types FOR INSERT TO authenticated WITH CHECK (current_app_role() = 'admin');
DROP POLICY IF EXISTS "occasion_types_update" ON occasion_types;
CREATE POLICY "occasion_types_update" ON occasion_types FOR UPDATE TO authenticated
  USING (current_app_role() = 'admin') WITH CHECK (current_app_role() = 'admin');
DROP POLICY IF EXISTS "occasion_types_delete" ON occasion_types;
CREATE POLICY "occasion_types_delete" ON occasion_types FOR DELETE TO authenticated USING (current_app_role() = 'admin');

INSERT INTO occasion_types (key, name_en, name_ta, icon, category, needs_person_name, sort_order) VALUES
  ('self_birthday', 'Sponsor''s Own Birthday', 'சொந்த பிறந்தநாள்', '🎂', 'birthday', false, 10),
  ('family_birthday', 'Family Member''s Birthday', 'குடும்பத்தினர் பிறந்தநாள்', '🎂', 'birthday', true, 20),
  ('wedding_anniversary', 'Wedding Anniversary', 'திருமண நாள்', '💍', 'anniversary', true, 30),
  ('death_anniversary', 'Death Anniversary (Remembrance)', 'நினைவு நாள்', '🪔', 'remembrance', true, 40),
  ('other', 'Other Occasion', 'பிற நிகழ்வு', '✨', 'other', false, 50),
  -- Types already used by existing records.
  ('business_anniversary', 'Business Anniversary', 'தொழில் ஆண்டு விழா', '🏢', 'other', false, 60),
  ('achievement', 'Achievement', 'சாதனை', '🏆', 'other', false, 70),
  ('celebration', 'Celebration', 'கொண்டாட்டம்', '🎉', 'other', false, 80)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE sponsors
  ADD COLUMN IF NOT EXISTS title text CHECK (title IN ('Mr', 'Mrs', 'Ms', 'Dr'));

ALTER TABLE special_occasions
  ADD COLUMN IF NOT EXISTS occasion_type_key text,
  ADD COLUMN IF NOT EXISTS occasion_name_en text,
  ADD COLUMN IF NOT EXISTS occasion_name_ta text,
  ADD COLUMN IF NOT EXISTS remind_days_before int[],
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_title text CHECK (contact_title IN ('Mr', 'Mrs', 'Ms', 'Dr')),
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_relation text,
  ADD COLUMN IF NOT EXISTS linked_donation_type text,
  ADD COLUMN IF NOT EXISTS linked_donation_details text,
  ADD COLUMN IF NOT EXISTS thithi_note text;

-- Existing occasions keep every value; empty contact means "the sponsor".
UPDATE special_occasions SET occasion_type_key = CASE
    WHEN occasion_type = 'Birthday' AND (family_member_id IS NOT NULL OR (relationship IS NOT NULL AND lower(btrim(relationship)) NOT IN ('', 'self')))
      THEN 'family_birthday'
    WHEN occasion_type = 'Birthday' THEN 'self_birthday'
    WHEN occasion_type = 'Wedding Anniversary' THEN 'wedding_anniversary'
    WHEN occasion_type = 'Death Anniversary' THEN 'death_anniversary'
    WHEN occasion_type = 'Business Anniversary' THEN 'business_anniversary'
    WHEN occasion_type = 'Achievement' THEN 'achievement'
    WHEN occasion_type = 'Celebration' THEN 'celebration'
    ELSE 'other'
  END
WHERE occasion_type_key IS NULL;

ALTER TABLE message_logs
  ADD COLUMN IF NOT EXISTS occasion_id uuid REFERENCES special_occasions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS occasion_type text;

ALTER TABLE message_templates DROP CONSTRAINT IF EXISTS message_templates_type_check;
ALTER TABLE message_templates ADD CONSTRAINT message_templates_type_check CHECK (type IN (
  'Birthday Wish', 'Anniversary Wish', 'Child Birthday', 'Sponsorship Request', 'Thank You', 'Follow-up',
  'Star Day Wish', 'Star Day Upcoming', 'Star Day Today',
  'Occasion: Own Birthday', 'Occasion: Family Birthday', 'Occasion: Anniversary', 'Occasion: Remembrance', 'Occasion: Other'
));

INSERT INTO message_templates (name, type, body, variables, is_approved)
SELECT v.name, v.type, v.body, ARRAY['contact_name', 'contact_title_ta', 'person_name', 'relation_en', 'relation_ta', 'donation_line_en', 'donation_line_ta', 'organization_name', 'organization_name_ta'], true
FROM (VALUES
('Sponsor''s Own Birthday', 'Occasion: Own Birthday',
'Dear {{contact_name}},
Wishing you a very Happy Birthday!
May Vallalar''s blessings fill your life with good health, happiness and prosperity.
{{donation_line_en}}
With warm wishes,
{{organization_name}}

அருட்பெருஞ்ஜோதி அருட்பெருஞ்ஜோதி தனிப்பெருங்கருணை அருட்பெருஞ்ஜோதி

அன்புள்ள {{contact_title_ta}} {{contact_name}} அவர்களுக்கு,
உங்களுக்கு எங்களின் மனமார்ந்த பிறந்தநாள் வாழ்த்துகள்!
எல்லாம் வல்ல இறையாற்றலின் கருணையினால் நீங்கள் நீடூழி நலமுடனும் மகிழ்ச்சியுடனும் வாழ்க வளமுடன்.
{{donation_line_ta}}
அன்புடன்,
{{organization_name}}
({{organization_name_ta}})'),
('Family Member''s Birthday', 'Occasion: Family Birthday',
'Dear {{contact_name}},
Warm birthday wishes to your beloved {{relation_en}}, {{person_name}}!
May Vallalar''s blessings bring {{person_name}} good health, happiness and a bright future, and may your family be blessed with joy always.
{{donation_line_en}}
With warm wishes,
{{organization_name}}

அருட்பெருஞ்ஜோதி அருட்பெருஞ்ஜோதி தனிப்பெருங்கருணை அருட்பெருஞ்ஜோதி

அன்புள்ள {{contact_title_ta}} {{contact_name}} அவர்களுக்கு,
இன்று பிறந்தநாள் காணும் உங்கள் அன்பு {{relation_ta}} {{person_name}} அவர்களுக்கு எங்களின் மனமார்ந்த பிறந்தநாள் வாழ்த்துகள்!
எல்லாம் வல்ல இறையாற்றலின் கருணையினால் {{person_name}} அவர்கள் நீடூழி நலமுடனும் மகிழ்ச்சியுடனும் வாழவும், உங்கள் குடும்பம் என்றும் மகிழ்வுடன் திகழவும் வாழ்த்துகிறோம்.
{{donation_line_ta}}
அன்புடன்,
{{organization_name}}
({{organization_name_ta}})'),
('Wedding Anniversary', 'Occasion: Anniversary',
'Dear {{contact_name}},
Heartfelt wishes on {{anniversary_of_en}}!
May Vallalar''s blessings fill the couple''s life with love, togetherness and happiness for many more years.
{{donation_line_en}}
With warm wishes,
{{organization_name}}

அருட்பெருஞ்ஜோதி அருட்பெருஞ்ஜோதி தனிப்பெருங்கருணை அருட்பெருஞ்ஜோதி

அன்புள்ள {{contact_title_ta}} {{contact_name}} அவர்களுக்கு,
{{anniversary_of_ta}} எங்களின் மனமார்ந்த திருமண நாள் வாழ்த்துகள்!
எல்லாம் வல்ல இறையாற்றலின் கருணையினால் தம்பதியர் இருவரும் என்றும் அன்புடனும் ஒற்றுமையுடனும் நீடூழி வாழ்க வளமுடன்.
{{donation_line_ta}}
அன்புடன்,
{{organization_name}}
({{organization_name_ta}})'),
('Remembrance Day', 'Occasion: Remembrance',
'Dear {{contact_name}},
On this remembrance day of your beloved {{relation_en}}, Late {{person_name}}, we join you and your family in remembering them with love and respect.
{{donation_line_en}}
May their soul rest in peace in the eternal grace of Arutperunjothi.
With prayers,
{{organization_name}}

அருட்பெருஞ்ஜோதி அருட்பெருஞ்ஜோதி தனிப்பெருங்கருணை அருட்பெருஞ்ஜோதி

அன்புள்ள {{contact_title_ta}} {{contact_name}} அவர்களுக்கு,
உங்கள் அன்பு {{relation_ta}} அமரர் {{person_name}} அவர்களின் நினைவு நாளில், அவர்களை நாங்களும் உங்களுடன் இணைந்து அன்புடனும் மரியாதையுடனும் நினைவுகூர்கிறோம்.
{{donation_line_ta}}
அவர்களின் ஆன்மா அருட்பெருஞ்ஜோதி ஆண்டவரின் திருவருளில் சாந்தியடைய இறைவனைப் பிரார்த்திக்கிறோம்.
பிரார்த்தனைகளுடன்,
{{organization_name}}
({{organization_name_ta}})'),
('Other Occasion', 'Occasion: Other',
'Dear {{contact_name}},
Warm wishes on the occasion of {{occasion_name_en}}!
May Vallalar''s blessings fill your life with good health, happiness and prosperity.
{{donation_line_en}}
With warm wishes,
{{organization_name}}

அருட்பெருஞ்ஜோதி அருட்பெருஞ்ஜோதி தனிப்பெருங்கருணை அருட்பெருஞ்ஜோதி

அன்புள்ள {{contact_title_ta}} {{contact_name}} அவர்களுக்கு,
{{occasion_name_ta}} நன்னாளில் எங்களின் மனமார்ந்த வாழ்த்துகள்!
எல்லாம் வல்ல இறையாற்றலின் கருணையினால் நீங்கள் நீடூழி நலமுடனும் மகிழ்ச்சியுடனும் வாழ்க வளமுடன்.
{{donation_line_ta}}
அன்புடன்,
{{organization_name}}
({{organization_name_ta}})')
) AS v(name, type, body)
WHERE NOT EXISTS (SELECT 1 FROM message_templates t WHERE t.type = v.type);
