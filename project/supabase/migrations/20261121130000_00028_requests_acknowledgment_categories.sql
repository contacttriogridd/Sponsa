-- ============================================================
-- Phase 2: monthly sponsorship requests, acknowledgment to the admin,
-- automatic sponsorship records, and category-based sponsors.
--
--   organization_settings  UPI ID, bank details, and the acknowledgment
--                          recipient (name / WhatsApp / email; Udhaya Sir).
--   message_templates      "Monthly Sponsorship Request" in Tamil and English
--                          (language column), editable by an admin.
--   message_logs           new types: sponsorship_request, donation_acknowledgment.
--   sponsorship_requests   statuses Requested → Confirmed → Paid / Declined /
--                          No response; monthly sponsor link, category,
--                          request_sent_at, channel, linked donation.
--     • Sending a request (an occasion wish before its day, or a monthly
--       sponsorship request) creates or updates ONE record per sponsor,
--       occasion and date, automatically (trigger on message_logs).
--     • Recording the donation for it marks it Paid and links it.
--   sponsors               category, sponsorship amount, payment mode,
--                          reminder days before, preferred language.
--   special_occasions      Star Birthday (Tamil month + star) and Thithi
--                          memorials (Tamil month + thithi) with a date per year.
--   monthly_sponsors       end_date.
-- Safe to re-run. Nothing is deleted.
-- ============================================================

-- Organization: payment details and acknowledgment recipient ---------------
ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS upi_id text,
  ADD COLUMN IF NOT EXISTS bank_details text,
  ADD COLUMN IF NOT EXISTS ack_name text,
  ADD COLUMN IF NOT EXISTS ack_whatsapp text,
  ADD COLUMN IF NOT EXISTS ack_email text;
UPDATE organization_settings SET
  ack_name = coalesce(ack_name, admin_name, 'Udhaya Sir'),
  ack_whatsapp = coalesce(ack_whatsapp, admin_whatsapp_number, '919629522777');

-- Monthly Sponsorship Request template ------------------------------------
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS language text CHECK (language IN ('en', 'ta'));
ALTER TABLE message_templates DROP CONSTRAINT IF EXISTS message_templates_type_check;
ALTER TABLE message_templates ADD CONSTRAINT message_templates_type_check CHECK (type IN (
  'Birthday Wish', 'Anniversary Wish', 'Child Birthday', 'Sponsorship Request', 'Thank You', 'Follow-up',
  'Star Day Wish', 'Star Day Upcoming', 'Star Day Today',
  'Occasion: Own Birthday', 'Occasion: Family Birthday', 'Occasion: Anniversary', 'Occasion: Remembrance', 'Occasion: Other',
  'Monthly Sponsorship Request'
));

INSERT INTO message_templates (name, type, language, body, variables, is_approved)
SELECT v.name, 'Monthly Sponsorship Request', v.lang, v.body,
  ARRAY['sponsor_name', 'organization_name', 'month', 'sponsor_date', 'amount', 'upi_id', 'bank_details', 'contact_number'], true
FROM (VALUES
  ('Monthly Sponsorship Request (English)', 'en', $en$Vanakkam {{sponsor_name}}, greetings from {{organization_name}}. Your monthly Annadhanam sponsorship for {{month}} is due on {{sponsor_date}}. Amount: ₹{{amount}}. UPI: {{upi_id}}. Thank you for feeding the hungry with us. – {{organization_name}}, {{contact_number}}$en$),
  ('மாதாந்திர நன்கொடை கோரிக்கை (Tamil)', 'ta', $ta$வணக்கம் {{sponsor_name}} அவர்களே, {{organization_name}} சார்பாக அன்பான வணக்கங்கள். {{month}} மாதத்திற்கான உங்கள் மாதாந்திர அன்னதான நன்கொடை {{sponsor_date}} அன்று செலுத்த வேண்டியது. தொகை: ₹{{amount}}. UPI: {{upi_id}}. பசித்தவர்களுக்கு உணவளிக்கும் எங்கள் சேவையில் இணைந்திருப்பதற்கு நன்றி. – {{organization_name}}, {{contact_number}}$ta$)
) AS v(name, lang, body)
WHERE NOT EXISTS (SELECT 1 FROM message_templates t WHERE t.type = 'Monthly Sponsorship Request' AND t.language = v.lang);

-- Message types ------------------------------------------------------------
ALTER TABLE message_logs DROP CONSTRAINT IF EXISTS message_logs_message_type_check;
ALTER TABLE message_logs ADD CONSTRAINT message_logs_message_type_check CHECK (message_type IN (
  'birthday_wish', 'anniversary_wish', 'event_wish', 'donation_thanks', 'admin_notification', 'admin_daily_summary', 'festival_wish',
  'sponsorship_request', 'donation_acknowledgment'
));

-- Sponsorship requests -----------------------------------------------------
ALTER TABLE sponsorship_requests
  ADD COLUMN IF NOT EXISTS monthly_sponsor_id uuid REFERENCES monthly_sponsors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS request_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS related_event_id text,
  ADD COLUMN IF NOT EXISTS donation_id uuid REFERENCES donations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_log_id uuid;
ALTER TABLE sponsorship_requests ALTER COLUMN sponsor_id DROP NOT NULL;
ALTER TABLE sponsorship_requests DROP CONSTRAINT IF EXISTS sponsorship_requests_who_check;
ALTER TABLE sponsorship_requests ADD CONSTRAINT sponsorship_requests_who_check CHECK (sponsor_id IS NOT NULL OR monthly_sponsor_id IS NOT NULL);
ALTER TABLE sponsorship_requests DROP CONSTRAINT IF EXISTS sponsorship_requests_status_check;
ALTER TABLE sponsorship_requests ADD CONSTRAINT sponsorship_requests_status_check CHECK (status IN (
  'requested', 'confirmed', 'paid', 'declined', 'no_response',
  'draft', 'contacted', 'interested', 'pending', 'completed', 'cancelled'
));
CREATE INDEX IF NOT EXISTS idx_sponsorship_requests_monthly ON sponsorship_requests (monthly_sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsorship_requests_date ON sponsorship_requests (special_date);

/** Donation category for a request, from the occasion. */
CREATE OR REPLACE FUNCTION request_category(p_occasion uuid, p_monthly boolean) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN p_monthly THEN 'Monthly'
    WHEN o.occasion_type_key = 'star_birthday' THEN 'Star Birthday'
    WHEN o.occasion_type_key IN ('self_birthday', 'family_birthday') OR o.occasion_type = 'Birthday' THEN 'Birthday'
    WHEN o.occasion_type_key = 'wedding_anniversary' OR o.occasion_type = 'Wedding Anniversary' THEN 'Wedding Anniversary'
    WHEN o.occasion_type_key = 'death_anniversary' OR o.occasion_type = 'Death Anniversary' THEN 'Memorial (Thithi)'
    ELSE 'General' END
  FROM (SELECT 1) one LEFT JOIN special_occasions o ON o.id = p_occasion;
$$;

-- A request sent to a sponsor → one sponsorship record (created or updated).
CREATE OR REPLACE FUNCTION message_log_to_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing uuid;
  sent_day date := (NEW.sent_at AT TIME ZONE 'Asia/Kolkata')::date;
  is_monthly boolean := NEW.message_type = 'sponsorship_request' AND NEW.monthly_sponsor_id IS NOT NULL;
  occ_name text;
BEGIN
  IF NEW.recipient <> 'sponsor' OR NEW.status = 'failed' THEN RETURN NULL; END IF;
  IF NEW.message_type = 'sponsorship_request' THEN
    NULL; -- always a request
  ELSIF NEW.message_type IN ('birthday_wish', 'anniversary_wish', 'event_wish')
        AND NEW.occurrence_date > sent_day
        AND coalesce(NEW.related_event_id, '') NOT LIKE 'star:%'
        AND coalesce(NEW.related_event_id, '') NOT LIKE 'obs:%'
        AND NEW.sponsor_id IS NOT NULL THEN
    NULL; -- a wish sent before the day is the sponsorship request
  ELSE
    RETURN NULL;
  END IF;

  SELECT id INTO existing FROM sponsorship_requests r
  WHERE r.special_date = NEW.occurrence_date
    AND ((is_monthly AND r.monthly_sponsor_id = NEW.monthly_sponsor_id)
      OR (NOT is_monthly AND r.sponsor_id = NEW.sponsor_id
          AND (r.occasion_id IS NOT DISTINCT FROM NEW.occasion_id OR r.related_event_id = NEW.related_event_id)))
  ORDER BY r.created_at LIMIT 1;

  IF existing IS NOT NULL THEN
    -- Sent again: same record, latest send time; a final status is left alone.
    UPDATE sponsorship_requests SET request_sent_at = NEW.sent_at, channel = NEW.channel,
      status = CASE WHEN status IN ('draft', 'contacted', 'pending', 'no_response') THEN 'requested' ELSE status END
    WHERE id = existing;
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
    NEW.sent_at, NEW.channel, NEW.related_event_id, NEW.id, NEW.sent_by,
    'Created automatically when the request was sent.'
  );
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS message_log_to_request ON message_logs;
CREATE TRIGGER message_log_to_request AFTER INSERT ON message_logs
  FOR EACH ROW EXECUTE FUNCTION message_log_to_request();

-- "Did you send it?" → No removes the log; an untouched record it created goes too.
CREATE OR REPLACE FUNCTION message_log_unsent() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM sponsorship_requests WHERE source_log_id = OLD.id AND status = 'requested' AND donation_id IS NULL;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS message_log_unsent ON message_logs;
CREATE TRIGGER message_log_unsent AFTER DELETE ON message_logs
  FOR EACH ROW EXECUTE FUNCTION message_log_unsent();

-- A donation for a requested occasion → that record becomes Paid and is linked.
CREATE OR REPLACE FUNCTION donation_marks_request_paid() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target uuid := NEW.sponsorship_request_id;
  for_day date := coalesce(NEW.occasion_date, NEW.donation_date);
BEGIN
  IF target IS NULL AND NEW.monthly_sponsor_id IS NOT NULL THEN
    SELECT id INTO target FROM sponsorship_requests
    WHERE monthly_sponsor_id = NEW.monthly_sponsor_id AND donation_id IS NULL
      AND status NOT IN ('paid', 'completed', 'declined', 'cancelled')
      AND date_trunc('month', special_date) = date_trunc('month', for_day)
    ORDER BY special_date LIMIT 1;
  ELSIF target IS NULL AND NEW.sponsor_id IS NOT NULL THEN
    SELECT id INTO target FROM sponsorship_requests
    WHERE sponsor_id = NEW.sponsor_id AND donation_id IS NULL
      AND status NOT IN ('paid', 'completed', 'declined', 'cancelled')
      AND (occasion_id IS NOT DISTINCT FROM NEW.occasion_id OR NEW.occasion_id IS NULL)
      AND abs(special_date - for_day) <= 7
    ORDER BY abs(special_date - for_day) LIMIT 1;
  END IF;
  IF target IS NOT NULL THEN
    UPDATE sponsorship_requests SET status = 'paid', donation_id = NEW.id WHERE id = target AND donation_id IS DISTINCT FROM NEW.id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS donation_marks_request_paid ON donations;
CREATE TRIGGER donation_marks_request_paid AFTER INSERT ON donations
  FOR EACH ROW EXECUTE FUNCTION donation_marks_request_paid();

-- Requests linked to a donation before this migration count as Paid.
UPDATE sponsorship_requests r SET donation_id = d.id
FROM donations d WHERE d.sponsorship_request_id = r.id AND r.donation_id IS NULL;

-- Monthly "Mark paid" donations start with the acknowledgment pending.
CREATE OR REPLACE FUNCTION sync_monthly_payment_donation(p monthly_payments) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing uuid;
  sponsor monthly_sponsors;
  mode text := CASE p.mode WHEN 'Bank' THEN 'Bank Transfer' ELSE p.mode END;
BEGIN
  IF p.status <> 'paid' OR coalesce(p.amount, 0) <= 0 THEN
    DELETE FROM donations WHERE monthly_payment_id = p.id;
    RETURN;
  END IF;
  SELECT * INTO sponsor FROM monthly_sponsors WHERE id = p.monthly_sponsor_id;

  SELECT id INTO existing FROM donations WHERE monthly_payment_id = p.id;
  IF existing IS NULL THEN
    SELECT id INTO existing FROM donations
    WHERE monthly_payment_id IS NULL AND monthly_sponsor_id = p.monthly_sponsor_id AND amount = p.amount
      AND date_trunc('month', coalesce(occasion_date, donation_date)) = date_trunc('month', p.month)
    ORDER BY created_at LIMIT 1;
    IF existing IS NOT NULL THEN
      UPDATE donations SET monthly_payment_id = p.id, sponsor_category = 'Monthly', occasion_date = coalesce(occasion_date, p.month) WHERE id = existing;
      RETURN;
    END IF;
    INSERT INTO donations (
      sponsor_type, monthly_sponsor_id, sponsor_name, sponsor_category, type, amount, donation_date, occasion_date,
      occasion_name, payment_method, monthly_payment_id, status, notes, created_by, acknowledgment_status
    ) VALUES (
      'monthly', p.monthly_sponsor_id, sponsor.name, 'Monthly', 'Money', p.amount, coalesce(p.paid_on, p.month), p.month,
      'Monthly sponsorship – ' || to_char(p.month, 'Mon YYYY'), mode, p.id, 'completed', p.notes, p.recorded_by, 'pending'
    );
  ELSE
    UPDATE donations SET amount = p.amount, donation_date = coalesce(p.paid_on, p.month), occasion_date = p.month,
      payment_method = coalesce(mode, payment_method)
    WHERE id = existing;
  END IF;
END;
$$;

-- Sponsors: category and the common fields --------------------------------
ALTER TABLE sponsors
  ADD COLUMN IF NOT EXISTS sponsor_category text,
  ADD COLUMN IF NOT EXISTS sponsorship_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS payment_mode text,
  ADD COLUMN IF NOT EXISTS reminder_days_before int NOT NULL DEFAULT 3 CHECK (reminder_days_before BETWEEN 0 AND 30),
  ADD COLUMN IF NOT EXISTS preferred_language text CHECK (preferred_language IN ('ta', 'en'));
ALTER TABLE sponsors DROP CONSTRAINT IF EXISTS sponsors_sponsor_category_check;
ALTER TABLE sponsors ADD CONSTRAINT sponsors_sponsor_category_check CHECK (sponsor_category IS NULL OR sponsor_category IN (
  'Monthly', 'Birthday', 'Star Birthday', 'Wedding Anniversary', 'Memorial (Thithi)', 'General', 'Annadhanam', 'Other'
));

-- Existing sponsors: category from their first occasion (nothing else changes).
UPDATE sponsors s SET sponsor_category = x.category
FROM (
  SELECT DISTINCT ON (o.sponsor_id) o.sponsor_id, request_category(o.id, false) AS category
  FROM special_occasions o WHERE o.active ORDER BY o.sponsor_id, o.created_at
) x
WHERE x.sponsor_id = s.id AND s.sponsor_category IS NULL;
UPDATE sponsors s SET sponsor_category = 'Monthly'
WHERE s.sponsor_category IS NULL AND EXISTS (SELECT 1 FROM monthly_sponsors m WHERE m.sponsor_id = s.id);

-- Star Birthday and Thithi memorials --------------------------------------
ALTER TABLE special_occasions
  ADD COLUMN IF NOT EXISTS star smallint CHECK (star BETWEEN 0 AND 26),
  ADD COLUMN IF NOT EXISTS tamil_month smallint CHECK (tamil_month BETWEEN 0 AND 11),
  ADD COLUMN IF NOT EXISTS thithi smallint CHECK (thithi BETWEEN 0 AND 29),
  -- { "2026": "2026-12-05", "2027": "2027-11-24" } — the English date each year.
  ADD COLUMN IF NOT EXISTS yearly_dates jsonb;

INSERT INTO occasion_types (key, name_en, name_ta, icon, category, needs_person_name, sort_order) VALUES
  ('star_birthday', 'Star Birthday (Natchathiram)', 'நட்சத்திர பிறந்தநாள்', '⭐', 'birthday', false, 25)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE monthly_sponsors ADD COLUMN IF NOT EXISTS end_date date;
