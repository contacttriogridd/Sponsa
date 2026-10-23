-- ============================================================
-- Monthly Sponsors with Tamil Natchathiram (star day) reminders.
--
--   monthly_sponsors           people who give every month, with Raasi/Star
--   monthly_payments           one row per sponsor per month (Paid / Pending)
--   star_calendar              cached daily star at Coimbatore sunrise
--   monthly_sponsor_reminders  de-duplicates star-day / payment-due reminders
--
-- Raasi and star are stored as 0-based indexes into the lists in
-- lib/natchathiram.ts (Raasi 0 = மேஷம், star 0 = அஸ்வினி).
-- ============================================================

CREATE TABLE IF NOT EXISTS monthly_sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  dob date,
  raasi smallint CHECK (raasi BETWEEN 0 AND 11),
  star smallint CHECK (star BETWEEN 0 AND 26),
  monthly_amount numeric(12, 2) CHECK (monthly_amount >= 0),
  payment_day smallint CHECK (payment_day BETWEEN 1 AND 31),
  start_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped')),
  notes text,
  sponsor_id uuid REFERENCES sponsors(id) ON DELETE SET NULL,
  relationship text,
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS monthly_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_sponsor_id uuid NOT NULL REFERENCES monthly_sponsors(id) ON DELETE CASCADE,
  month date NOT NULL CHECK (extract(day FROM month) = 1),
  amount numeric(12, 2) CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('paid', 'pending')),
  paid_on date,
  mode text CHECK (mode IN ('Cash', 'UPI', 'Bank')),
  notes text,
  recorded_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (monthly_sponsor_id, month)
);

CREATE TABLE IF NOT EXISTS star_calendar (
  date date PRIMARY KEY,
  sunrise timestamptz NOT NULL,
  star smallint NOT NULL CHECK (star BETWEEN 0 AND 26),
  star_start timestamptz NOT NULL,
  star_end timestamptz NOT NULL,
  extra_star smallint CHECK (extra_star BETWEEN 0 AND 26),
  extra_start timestamptz,
  extra_end timestamptz,
  computed_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS monthly_sponsor_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_sponsor_id uuid NOT NULL REFERENCES monthly_sponsors(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('star_day', 'payment_due')),
  target_date date NOT NULL,
  days_before int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (monthly_sponsor_id, kind, target_date, days_before)
);

CREATE INDEX IF NOT EXISTS idx_monthly_sponsors_status ON monthly_sponsors (status);
CREATE INDEX IF NOT EXISTS idx_monthly_payments_month ON monthly_payments (month);

DROP TRIGGER IF EXISTS monthly_sponsors_updated_at ON monthly_sponsors;
CREATE TRIGGER monthly_sponsors_updated_at BEFORE UPDATE ON monthly_sponsors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS monthly_payments_updated_at ON monthly_payments;
CREATE TRIGGER monthly_payments_updated_at BEFORE UPDATE ON monthly_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Same access as the other business tables: every signed-in user reads,
-- admins and collectors write, only admins delete. star_calendar is computed
-- data that any of them may refresh from the app.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['monthly_sponsors', 'monthly_payments', 'star_calendar', 'monthly_sponsor_reminders']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I', t, t);
    EXECUTE format('CREATE POLICY "%s_select" ON %I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON %I FOR INSERT TO authenticated WITH CHECK (current_app_role() IN (''admin'', ''collector''))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_update" ON %I FOR UPDATE TO authenticated USING (current_app_role() IN (''admin'', ''collector'')) WITH CHECK (current_app_role() IN (''admin'', ''collector''))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON %I', t, t);
    EXECUTE format('CREATE POLICY "%s_delete" ON %I FOR DELETE TO authenticated USING (current_app_role() = ''admin'')', t, t);
  END LOOP;
END $$;

-- How many days before a star day (and payment day) to remind; also on the day.
ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS star_reminder_days int NOT NULL DEFAULT 2 CHECK (star_reminder_days BETWEEN 0 AND 15);

-- "Star Day Wish" template type and template.
ALTER TABLE message_templates DROP CONSTRAINT IF EXISTS message_templates_type_check;
ALTER TABLE message_templates ADD CONSTRAINT message_templates_type_check CHECK (type IN (
  'Birthday Wish', 'Anniversary Wish', 'Child Birthday', 'Sponsorship Request', 'Thank You', 'Follow-up', 'Star Day Wish'
));

INSERT INTO message_templates (name, type, body, variables, is_approved)
SELECT 'நட்சத்திர நாள் வாழ்த்து (Star Day Wish)', 'Star Day Wish',
'அன்புள்ள {{sponsor_name}} அவர்களுக்கு,

உங்கள் நட்சத்திர நாளான {{star_date}} அன்று ({{star_name}} நட்சத்திரம், {{raasi_name}} ராசி), இறைவன் அருளால் நீங்களும் உங்கள் குடும்பத்தினரும் நலமும் மகிழ்ச்சியும் பெற்று வாழ வாழ்த்துகிறோம். தங்களின் தொடர்ந்த மாதாந்திர உதவிக்கு மனமார்ந்த நன்றி.

Dear {{sponsor_name}},

Warm wishes on your star day, {{star_date}}. May you and your family be blessed with good health and happiness. Thank you for your continued monthly support.

With gratitude,
{{organization_name}}',
ARRAY['sponsor_name', 'star_date', 'star_name', 'raasi_name', 'organization_name'],
true
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE type = 'Star Day Wish');

-- Sample monthly sponsors.
INSERT INTO monthly_sponsors (name, dob, raasi, star, status)
SELECT v.name, v.dob, v.raasi, v.star, 'active'
FROM (VALUES
  ('B. Harshad', DATE '2014-07-26', 3, 6),  -- கடகம் (Kadagam), புனர்பூசம் (Punarpoosam)
  ('B. Sudhan',  DATE '2016-05-06', 0, 0)   -- மேஷம் (Mesham), அஸ்வினி (Ashwini)
) AS v(name, dob, raasi, star)
WHERE NOT EXISTS (SELECT 1 FROM monthly_sponsors m WHERE m.name = v.name);
