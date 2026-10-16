/*
# Family Events & Reminders

Personal family dates (birthdays, wedding anniversaries, death anniversaries)
that each signed-in user keeps for themselves from the Add Sponsor screen.

Unlike `special_occasions` (sponsor-scoped, shared by the whole team, writable
only by admin/collector), every row here belongs to exactly one user and is
private to them — any role, including staff/viewer, may manage their own.

Dates are stored as separate day / month / optional year so that:
  - the original year (birth year, wedding year) is preserved when known,
  - "year not known" is representable without a fake year,
  - a future reminder job can find today's events with a plain index lookup
    (`WHERE event_month = ? AND event_day = ?`).

The reminder / WhatsApp columns only record the user's preference. Nothing
sends messages from this table yet.
*/

CREATE TABLE IF NOT EXISTS family_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES app_users(id) ON DELETE CASCADE,
  person_name text NOT NULL CHECK (char_length(btrim(person_name)) BETWEEN 1 AND 120),
  event_category text NOT NULL CHECK (event_category IN ('birthday', 'anniversary', 'death_anniversary')),
  event_type text NOT NULL,
  relationship text NOT NULL CHECK (char_length(btrim(relationship)) BETWEEN 1 AND 60),
  event_day smallint NOT NULL CHECK (event_day BETWEEN 1 AND 31),
  event_month smallint NOT NULL CHECK (event_month BETWEEN 1 AND 12),
  event_year smallint CHECK (event_year BETWEEN 1900 AND 2100),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),

  -- Reminder / notification readiness (preferences only, not yet acted on)
  reminder_enabled boolean NOT NULL DEFAULT true,
  reminder_days_before int[] NOT NULL DEFAULT '{1,0}'
    CHECK (0 <= ALL (reminder_days_before) AND 30 >= ALL (reminder_days_before)),
  whatsapp_reminder boolean NOT NULL DEFAULT false,
  last_reminded_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Each event type belongs to exactly one category.
  CONSTRAINT family_events_type_matches_category CHECK (
    (event_category = 'birthday' AND event_type IN (
      'child_birthday', 'father_birthday', 'mother_birthday', 'wife_birthday', 'other_birthday'))
    OR (event_category = 'anniversary' AND event_type IN (
      'wedding_anniversary', 'parents_wedding_anniversary', 'other_wedding_anniversary', 'special_anniversary'))
    OR (event_category = 'death_anniversary' AND event_type IN (
      'father_death_anniversary', 'mother_death_anniversary', 'other_death_anniversary'))
  ),

  -- Reject impossible dates (31 April, 30 Feb, 29 Feb in a known non-leap year).
  CONSTRAINT family_events_valid_date CHECK (
    event_day <= CASE
      WHEN event_month = 2 THEN
        CASE WHEN event_year IS NULL
               OR (event_year % 4 = 0 AND event_year % 100 <> 0)
               OR event_year % 400 = 0
             THEN 29 ELSE 28 END
      WHEN event_month IN (4, 6, 9, 11) THEN 30
      ELSE 31
    END
  )
);

ALTER TABLE family_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "family_events_select_own" ON family_events;
CREATE POLICY "family_events_select_own" ON family_events FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "family_events_insert_own" ON family_events;
CREATE POLICY "family_events_insert_own" ON family_events FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "family_events_update_own" ON family_events;
CREATE POLICY "family_events_update_own" ON family_events FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "family_events_delete_own" ON family_events;
CREATE POLICY "family_events_delete_own" ON family_events FOR DELETE
  TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_family_events_user_id ON family_events (user_id);
CREATE INDEX IF NOT EXISTS idx_family_events_month_day ON family_events (event_month, event_day);

DROP TRIGGER IF EXISTS family_events_updated_at ON family_events;
CREATE TRIGGER family_events_updated_at BEFORE UPDATE ON family_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
