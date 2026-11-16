-- ============================================================
-- "Monthly Event" sponsorship for monthly sponsors.
--
--   monthly_sponsors.sponsor_events   jsonb array of
--       { "event_key": "pournami", "amount": 500 | null, "paksha": "both" | "valarpirai" | "theipirai" }
--     event_key uses the Star Calendar's keys (monthly_observances.event_key):
--     amavasai, pournami, ekadashi, pradosham, sankatahara, sashti, shivaratri.
--     amount null = the sponsor's monthly amount. paksha only matters for
--     Ekadashi, Pradosham and Sashti. Existing sponsors get [] — no change.
--   create_monthly_sponsor_with_family   now also saves sponsor_events.
--   event_wish_logs        one row per sponsor, event and date once a wish is
--                          sent (WhatsApp) or copied, so the row shows "✓ Sent".
--   event_wish_templates   one editable Tamil + English wish per event
--                          (Settings -> Message Templates -> Event Wishes).
-- ============================================================

ALTER TABLE monthly_sponsors
  ADD COLUMN IF NOT EXISTS sponsor_events jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE monthly_sponsors DROP CONSTRAINT IF EXISTS monthly_sponsors_sponsor_events_array;
ALTER TABLE monthly_sponsors ADD CONSTRAINT monthly_sponsors_sponsor_events_array
  CHECK (jsonb_typeof(sponsor_events) = 'array');
CREATE INDEX IF NOT EXISTS idx_monthly_sponsors_sponsor_events ON monthly_sponsors USING gin (sponsor_events);

CREATE OR REPLACE FUNCTION create_monthly_sponsor_with_family(p_sponsor jsonb, p_members jsonb DEFAULT '[]'::jsonb)
RETURNS monthly_sponsors
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  s monthly_sponsors;
BEGIN
  INSERT INTO monthly_sponsors (
    name, phone, dob, raasi, star, monthly_amount, payment_day, start_date, status, notes,
    sponsor_id, relationship, address, payment_mode, created_by, sponsor_events
  ) VALUES (
    p_sponsor->>'name',
    p_sponsor->>'phone',
    (p_sponsor->>'dob')::date,
    (p_sponsor->>'raasi')::smallint,
    (p_sponsor->>'star')::smallint,
    (p_sponsor->>'monthly_amount')::numeric,
    (p_sponsor->>'payment_day')::smallint,
    (p_sponsor->>'start_date')::date,
    coalesce(p_sponsor->>'status', 'active'),
    p_sponsor->>'notes',
    (p_sponsor->>'sponsor_id')::uuid,
    p_sponsor->>'relationship',
    p_sponsor->>'address',
    p_sponsor->>'payment_mode',
    (p_sponsor->>'created_by')::uuid,
    CASE WHEN jsonb_typeof(p_sponsor->'sponsor_events') = 'array' THEN p_sponsor->'sponsor_events' ELSE '[]'::jsonb END
  )
  RETURNING * INTO s;

  INSERT INTO monthly_family_members (monthly_sponsor_id, name, relationship, relationship_other, star, raasi, dob, phone, address, notes)
  SELECT s.id, m.name, m.relationship, m.relationship_other, m.star, m.raasi, m.dob, m.phone, m.address, m.notes
  FROM jsonb_to_recordset(coalesce(p_members, '[]'::jsonb)) AS m(
    name text, relationship text, relationship_other text, star smallint, raasi smallint,
    dob date, phone text, address text, notes text
  );

  RETURN s;
END;
$$;

GRANT EXECUTE ON FUNCTION create_monthly_sponsor_with_family(jsonb, jsonb) TO authenticated;

CREATE TABLE IF NOT EXISTS event_wish_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_sponsor_id uuid NOT NULL REFERENCES monthly_sponsors(id) ON DELETE CASCADE,
  event_key text NOT NULL CHECK (event_key IN ('amavasai', 'pournami', 'ekadashi', 'pradosham', 'sankatahara', 'sashti', 'shivaratri')),
  date date NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'copy')),
  message text,
  sent_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (monthly_sponsor_id, event_key, date)
);
CREATE INDEX IF NOT EXISTS idx_event_wish_logs_date ON event_wish_logs (date);

CREATE TABLE IF NOT EXISTS event_wish_templates (
  event_key text PRIMARY KEY CHECK (event_key IN ('amavasai', 'pournami', 'ekadashi', 'pradosham', 'sankatahara', 'sashti', 'shivaratri')),
  body_ta text NOT NULL,
  body_en text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS event_wish_templates_updated_at ON event_wish_templates;
CREATE TRIGGER event_wish_templates_updated_at BEFORE UPDATE ON event_wish_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE event_wish_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_wish_logs_select" ON event_wish_logs;
CREATE POLICY "event_wish_logs_select" ON event_wish_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "event_wish_logs_insert" ON event_wish_logs;
CREATE POLICY "event_wish_logs_insert" ON event_wish_logs FOR INSERT TO authenticated
  WITH CHECK (current_app_role() IN ('admin', 'collector'));
DROP POLICY IF EXISTS "event_wish_logs_update" ON event_wish_logs;
CREATE POLICY "event_wish_logs_update" ON event_wish_logs FOR UPDATE TO authenticated
  USING (current_app_role() IN ('admin', 'collector')) WITH CHECK (current_app_role() IN ('admin', 'collector'));
DROP POLICY IF EXISTS "event_wish_logs_delete" ON event_wish_logs;
CREATE POLICY "event_wish_logs_delete" ON event_wish_logs FOR DELETE TO authenticated USING (current_app_role() = 'admin');

ALTER TABLE event_wish_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_wish_templates_select" ON event_wish_templates;
CREATE POLICY "event_wish_templates_select" ON event_wish_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "event_wish_templates_insert" ON event_wish_templates;
CREATE POLICY "event_wish_templates_insert" ON event_wish_templates FOR INSERT TO authenticated WITH CHECK (current_app_role() = 'admin');
DROP POLICY IF EXISTS "event_wish_templates_update" ON event_wish_templates;
CREATE POLICY "event_wish_templates_update" ON event_wish_templates FOR UPDATE TO authenticated
  USING (current_app_role() = 'admin') WITH CHECK (current_app_role() = 'admin');

-- Default wish for every event (same text as "Reset to default"); saved edits are kept on re-run.
INSERT INTO event_wish_templates (event_key, body_ta, body_en)
SELECT k, $ta$வணக்கம் {{sponsor_name}} அவர்களே 🙏
இன்று {{event_name_ta}} ({{event_name_en}}) – {{date}}.
உங்கள் அன்பான அன்னதான நன்கொடைக்கு நன்றி. வள்ளலார் அருளால் உங்கள் குடும்பம் எல்லா நலமும் பெற வாழ்த்துகிறோம்.
– {{organization_name}}$ta$, $en$Vanakkam {{sponsor_name}} 🙏
Today is {{event_name_en}} ({{event_name_ta}}) – {{date}}.
Thank you for your kind Annadhanam donation. By Vallalar's grace, we wish your family every happiness and good health.
– {{organization_name}}$en$
FROM unnest(ARRAY['amavasai', 'pournami', 'ekadashi', 'pradosham', 'sankatahara', 'sashti', 'shivaratri']) AS k
ON CONFLICT (event_key) DO NOTHING;
