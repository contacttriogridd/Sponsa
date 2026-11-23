-- ============================================================
-- Sponsorship reminders (3 / 2 / 1 day before an event), and optional amounts.
--
--   sponsorship_reminders   one row per event occurrence and stage
--                           (D-3, D-2, D-1): when it was sent, by whom, how.
--     event_key   the dashboard's id for the event (occ:<id>, dob:<id>,
--                 mspay:<id>, req:<id>, …) and event_date its date.
--     • Recorded automatically when a message for an upcoming event is sent
--       (trigger on message_logs): the stage is the number of days left.
--     • Or by hand ("Mark reminder sent") for messages sent outside the app.
--     • "Did you send it?" → No removes a reminder that send recorded.
--   Sending a reminder never changes a sponsorship's status. The first
--   request still creates the record as Requested (migration 00028); sending
--   again now only updates request_sent_at / channel, not the status.
--
--   Amounts: sponsors.sponsorship_amount, monthly_sponsors.monthly_amount and
--   sponsorship_requests.requested_amount are nullable (NULL = "Amount not
--   set"). They already were; this only makes sure. No data is changed.
-- Safe to re-run.
-- ============================================================

ALTER TABLE sponsors ALTER COLUMN sponsorship_amount DROP NOT NULL;
ALTER TABLE monthly_sponsors ALTER COLUMN monthly_amount DROP NOT NULL;
ALTER TABLE sponsorship_requests ALTER COLUMN requested_amount DROP NOT NULL;

CREATE TABLE IF NOT EXISTS sponsorship_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsorship_id uuid REFERENCES sponsorship_requests(id) ON DELETE SET NULL,
  sponsor_id uuid REFERENCES sponsors(id) ON DELETE CASCADE,
  monthly_sponsor_id uuid REFERENCES monthly_sponsors(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  event_date date NOT NULL,
  stage text NOT NULL CHECK (stage IN ('D-3', 'D-2', 'D-1')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  sent_by_name text,
  channel text NOT NULL DEFAULT 'manual' CHECK (channel IN ('whatsapp', 'sms', 'call', 'email', 'manual')),
  message_preview text,
  source_log_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_key, event_date, stage)
);
CREATE INDEX IF NOT EXISTS idx_sponsorship_reminders_date ON sponsorship_reminders (event_date);
CREATE INDEX IF NOT EXISTS idx_sponsorship_reminders_sponsor ON sponsorship_reminders (sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsorship_reminders_monthly ON sponsorship_reminders (monthly_sponsor_id);

ALTER TABLE sponsorship_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sponsorship_reminders_select" ON sponsorship_reminders;
CREATE POLICY "sponsorship_reminders_select" ON sponsorship_reminders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sponsorship_reminders_insert" ON sponsorship_reminders;
CREATE POLICY "sponsorship_reminders_insert" ON sponsorship_reminders FOR INSERT TO authenticated
  WITH CHECK (current_app_role() IN ('admin', 'collector'));
DROP POLICY IF EXISTS "sponsorship_reminders_update" ON sponsorship_reminders;
CREATE POLICY "sponsorship_reminders_update" ON sponsorship_reminders FOR UPDATE TO authenticated
  USING (current_app_role() IN ('admin', 'collector')) WITH CHECK (current_app_role() IN ('admin', 'collector'));
DROP POLICY IF EXISTS "sponsorship_reminders_delete" ON sponsorship_reminders;
CREATE POLICY "sponsorship_reminders_delete" ON sponsorship_reminders FOR DELETE TO authenticated
  USING (current_app_role() IN ('admin', 'collector'));

-- A message for an event 1–3 days away → that day's reminder slot.
-- Named to run after message_log_to_request, so the sponsorship it created can be linked.
CREATE OR REPLACE FUNCTION message_log_to_request_reminder() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sent_day date := (NEW.sent_at AT TIME ZONE 'Asia/Kolkata')::date;
  days int := NEW.occurrence_date - (NEW.sent_at AT TIME ZONE 'Asia/Kolkata')::date;
  ev_key text := regexp_replace(coalesce(NEW.related_event_id, ''), '#next$', '');
  rec uuid;
BEGIN
  IF NEW.recipient <> 'sponsor' OR NEW.status = 'failed' OR ev_key = '' OR ev_key LIKE 'obs:%' OR days NOT BETWEEN 1 AND 3 THEN
    RETURN NULL;
  END IF;
  SELECT id INTO rec FROM sponsorship_requests r
  WHERE r.special_date = NEW.occurrence_date
    AND ((NEW.monthly_sponsor_id IS NOT NULL AND r.monthly_sponsor_id = NEW.monthly_sponsor_id)
      OR (NEW.sponsor_id IS NOT NULL AND r.sponsor_id = NEW.sponsor_id))
  ORDER BY r.created_at LIMIT 1;
  INSERT INTO sponsorship_reminders (
    sponsorship_id, sponsor_id, monthly_sponsor_id, event_key, event_date, stage, sent_at, sent_by, sent_by_name, channel, message_preview, source_log_id
  ) VALUES (
    rec, NEW.sponsor_id, NEW.monthly_sponsor_id, ev_key, NEW.occurrence_date, 'D-' || days, NEW.sent_at, NEW.sent_by, NEW.sent_by_name,
    CASE WHEN NEW.channel IN ('whatsapp_link', 'whatsapp_api') THEN 'whatsapp' WHEN NEW.channel IN ('sms', 'email') THEN NEW.channel ELSE 'manual' END,
    left(NEW.message_text, 200), NEW.id
  )
  ON CONFLICT (event_key, event_date, stage) DO NOTHING;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS message_log_to_request_reminder ON message_logs;
CREATE TRIGGER message_log_to_request_reminder AFTER INSERT ON message_logs
  FOR EACH ROW EXECUTE FUNCTION message_log_to_request_reminder();

-- "Did you send it?" → No: also remove the reminder that send recorded.
CREATE OR REPLACE FUNCTION message_log_unsent() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM sponsorship_requests WHERE source_log_id = OLD.id AND status = 'requested' AND donation_id IS NULL;
  DELETE FROM sponsorship_reminders WHERE source_log_id = OLD.id;
  RETURN NULL;
END;
$$;

-- Sending again must not change the status (only request_sent_at / channel).
CREATE OR REPLACE FUNCTION message_log_to_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing uuid;
  sent_day date := (NEW.sent_at AT TIME ZONE 'Asia/Kolkata')::date;
  is_monthly boolean := NEW.message_type = 'sponsorship_request' AND NEW.monthly_sponsor_id IS NOT NULL;
  ev_key text := regexp_replace(coalesce(NEW.related_event_id, ''), '#next$', '');
  occ_name text;
BEGIN
  IF NEW.recipient <> 'sponsor' OR NEW.status = 'failed' THEN RETURN NULL; END IF;
  IF NEW.message_type = 'sponsorship_request' THEN
    NULL; -- always a request
  ELSIF NEW.message_type IN ('birthday_wish', 'anniversary_wish', 'event_wish')
        AND NEW.occurrence_date > sent_day
        AND ev_key NOT LIKE 'star:%'
        AND ev_key NOT LIKE 'obs:%'
        AND NEW.sponsor_id IS NOT NULL THEN
    NULL; -- a wish sent before the day is the sponsorship request
  ELSE
    RETURN NULL;
  END IF;

  SELECT id INTO existing FROM sponsorship_requests r
  WHERE r.special_date = NEW.occurrence_date
    AND ((is_monthly AND r.monthly_sponsor_id = NEW.monthly_sponsor_id)
      OR (NOT is_monthly AND r.sponsor_id = NEW.sponsor_id
          AND (r.occasion_id IS NOT DISTINCT FROM NEW.occasion_id OR r.related_event_id = ev_key)))
  ORDER BY r.created_at LIMIT 1;

  IF existing IS NOT NULL THEN
    UPDATE sponsorship_requests SET request_sent_at = NEW.sent_at, channel = NEW.channel WHERE id = existing;
    RETURN NULL;
  END IF;

  SELECT coalesce(o.occasion_name_en, o.occasion_type) INTO occ_name FROM special_occasions o WHERE o.id = NEW.occasion_id;
  INSERT INTO sponsorship_requests (
    sponsor_id, monthly_sponsor_id, occasion_id, occasion_name, special_date, status, category,
    request_sent_at, channel, related_event_id, source_log_id, collector_id, notes
  ) VALUES (
    CASE WHEN is_monthly THEN NULL ELSE NEW.sponsor_id END,
    CASE WHEN is_monthly THEN NEW.monthly_sponsor_id ELSE NULL END,
    NEW.occasion_id,
    coalesce(occ_name, NEW.type_label, CASE WHEN is_monthly THEN 'Monthly sponsorship' ELSE 'Sponsorship' END),
    NEW.occurrence_date, 'requested', request_category(NEW.occasion_id, is_monthly),
    NEW.sent_at, NEW.channel, nullif(ev_key, ''), NEW.id, NEW.sent_by,
    'Created automatically when the request was sent.'
  );
  RETURN NULL;
END;
$$;
