-- ============================================================
-- Monthly Sponsorship Requests (sent on the 1st–3rd of every month), and an
-- optional star / event for monthly sponsors.
--
--   monthly_sponsors.star / raasi / sponsor_events   nullable (a sponsor may
--     have no star and no event). Existing values are not changed.
--   organization_settings.payment_details   "Donation payment details"
--     (UPI ID, bank account, payment link; multi-line) for {{payment_details}}.
--     Filled once from the earlier UPI ID / bank details if they were saved.
--   message_templates   the "Monthly Sponsorship Request" Tamil and English
--     texts are set to the new defaults. A template an admin already edited
--     is kept as it is.
--   monthly_sponsorship_requests   one row per monthly sponsor per month
--     (unique sponsor + year + month): Pending → WhatsApp opened → Sent, with
--     who sent it and when. Resending updates the same row.
--   notifications.dedupe_key   so "Monthly sponsorship requests are ready to
--     send" is posted once a month, however many people open the app.
-- Safe to re-run.
-- ============================================================

ALTER TABLE monthly_sponsors ALTER COLUMN star DROP NOT NULL;
ALTER TABLE monthly_sponsors ALTER COLUMN raasi DROP NOT NULL;
ALTER TABLE monthly_sponsors ALTER COLUMN sponsor_events DROP NOT NULL;

ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS payment_details text;
UPDATE organization_settings
SET payment_details = nullif(concat_ws(E'\n',
      CASE WHEN coalesce(btrim(upi_id), '') <> '' THEN 'UPI: ' || btrim(upi_id) END,
      nullif(btrim(coalesce(bank_details, '')), '')), '')
WHERE payment_details IS NULL;

-- New default texts (exactly as approved), unless an admin has edited the template.
UPDATE message_templates SET body = $ta$🙏 மக்கள் சேவையே மகேசன் சேவை
மதிப்பிற்குரிய {{sponsor_name}} அவர்களுக்கு வணக்கம்,

{{organization_name}} சார்பாக உங்களின் தொடர்ந்த ஆதரவிற்கு எங்கள் மனமார்ந்த நன்றி. வள்ளலார் காட்டிய வழியில் பசித்தவர்களுக்கு உணவளிக்கும் எங்கள் சேவை, உங்களைப் போன்ற அன்புள்ளங்களின் உதவியால் தொடர்ந்து நடைபெற்று வருகிறது.

இந்த {{month_name}} மாதத்திற்கான உங்களின் மாதாந்திர நன்கொடை {{amount}} வழங்கி, எங்கள் அன்னதான சேவையைத் தொடர உதவுமாறு அன்புடன் கேட்டுக்கொள்கிறோம்.

நன்கொடை அனுப்ப: {{payment_details}}

நன்றியுடன்,
{{organization_name}}$ta$,
  variables = ARRAY['sponsor_name', 'amount', 'month_name', 'organization_name', 'payment_details']
WHERE type = 'Monthly Sponsorship Request' AND language = 'ta'
  AND body = $old$வணக்கம் {{sponsor_name}} அவர்களே, {{organization_name}} சார்பாக அன்பான வணக்கங்கள். {{month}} மாதத்திற்கான உங்கள் மாதாந்திர அன்னதான நன்கொடை {{sponsor_date}} அன்று செலுத்த வேண்டியது. தொகை: ₹{{amount}}. UPI: {{upi_id}}. பசித்தவர்களுக்கு உணவளிக்கும் எங்கள் சேவையில் இணைந்திருப்பதற்கு நன்றி. – {{organization_name}}, {{contact_number}}$old$;

UPDATE message_templates SET body = $en$🙏 Vanakkam {{sponsor_name}},

On behalf of {{organization_name}}, thank you for your continued support. Our service of feeding the hungry, in the path shown by Vallalar, goes on every day because of kind hearts like yours.

We humbly request your monthly contribution of {{amount}} for {{month_name}} to help us continue our Annadhanam service.

To donate: {{payment_details}}

With heartfelt gratitude,
{{organization_name}}$en$,
  variables = ARRAY['sponsor_name', 'amount', 'month_name', 'organization_name', 'payment_details']
WHERE type = 'Monthly Sponsorship Request' AND language = 'en'
  AND body = $old$Vanakkam {{sponsor_name}}, greetings from {{organization_name}}. Your monthly Annadhanam sponsorship for {{month}} is due on {{sponsor_date}}. Amount: ₹{{amount}}. UPI: {{upi_id}}. Thank you for feeding the hungry with us. – {{organization_name}}, {{contact_number}}$old$;

-- If a language has no template at all (e.g. it was deleted), add the default.
INSERT INTO message_templates (name, type, language, body, variables, is_approved)
SELECT v.name, 'Monthly Sponsorship Request', v.lang, v.body, ARRAY['sponsor_name', 'amount', 'month_name', 'organization_name', 'payment_details'], true
FROM (VALUES
  ('மாதாந்திர நன்கொடை கோரிக்கை (Tamil)', 'ta', $ta$🙏 மக்கள் சேவையே மகேசன் சேவை
மதிப்பிற்குரிய {{sponsor_name}} அவர்களுக்கு வணக்கம்,

{{organization_name}} சார்பாக உங்களின் தொடர்ந்த ஆதரவிற்கு எங்கள் மனமார்ந்த நன்றி. வள்ளலார் காட்டிய வழியில் பசித்தவர்களுக்கு உணவளிக்கும் எங்கள் சேவை, உங்களைப் போன்ற அன்புள்ளங்களின் உதவியால் தொடர்ந்து நடைபெற்று வருகிறது.

இந்த {{month_name}} மாதத்திற்கான உங்களின் மாதாந்திர நன்கொடை {{amount}} வழங்கி, எங்கள் அன்னதான சேவையைத் தொடர உதவுமாறு அன்புடன் கேட்டுக்கொள்கிறோம்.

நன்கொடை அனுப்ப: {{payment_details}}

நன்றியுடன்,
{{organization_name}}$ta$),
  ('Monthly Sponsorship Request (English)', 'en', $en$🙏 Vanakkam {{sponsor_name}},

On behalf of {{organization_name}}, thank you for your continued support. Our service of feeding the hungry, in the path shown by Vallalar, goes on every day because of kind hearts like yours.

We humbly request your monthly contribution of {{amount}} for {{month_name}} to help us continue our Annadhanam service.

To donate: {{payment_details}}

With heartfelt gratitude,
{{organization_name}}$en$)
) AS v(name, lang, body)
WHERE NOT EXISTS (SELECT 1 FROM message_templates t WHERE t.type = 'Monthly Sponsorship Request' AND t.language = v.lang);

-- One request per monthly sponsor per month.
CREATE TABLE IF NOT EXISTS monthly_sponsorship_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_sponsor_id uuid NOT NULL REFERENCES monthly_sponsors(id) ON DELETE CASCADE,
  year int NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'opened' CHECK (status IN ('opened', 'sent')),
  channel text CHECK (channel IN ('whatsapp', 'sms', 'copy', 'manual')),
  language text CHECK (language IN ('en', 'ta', 'both')),
  message text,
  opened_at timestamptz,
  sent_at timestamptz,
  sent_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  sent_by_name text,
  send_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (monthly_sponsor_id, year, month)
);
CREATE INDEX IF NOT EXISTS idx_monthly_sponsorship_requests_month ON monthly_sponsorship_requests (year, month);
DROP TRIGGER IF EXISTS monthly_sponsorship_requests_updated_at ON monthly_sponsorship_requests;
CREATE TRIGGER monthly_sponsorship_requests_updated_at BEFORE UPDATE ON monthly_sponsorship_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE monthly_sponsorship_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "monthly_sponsorship_requests_select" ON monthly_sponsorship_requests;
CREATE POLICY "monthly_sponsorship_requests_select" ON monthly_sponsorship_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "monthly_sponsorship_requests_insert" ON monthly_sponsorship_requests;
CREATE POLICY "monthly_sponsorship_requests_insert" ON monthly_sponsorship_requests FOR INSERT TO authenticated
  WITH CHECK (current_app_role() IN ('admin', 'collector'));
DROP POLICY IF EXISTS "monthly_sponsorship_requests_update" ON monthly_sponsorship_requests;
CREATE POLICY "monthly_sponsorship_requests_update" ON monthly_sponsorship_requests FOR UPDATE TO authenticated
  USING (current_app_role() IN ('admin', 'collector')) WITH CHECK (current_app_role() IN ('admin', 'collector'));
DROP POLICY IF EXISTS "monthly_sponsorship_requests_delete" ON monthly_sponsorship_requests;
CREATE POLICY "monthly_sponsorship_requests_delete" ON monthly_sponsorship_requests FOR DELETE TO authenticated
  USING (current_app_role() = 'admin');

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
-- A plain unique index (NULLs never clash), so the app can insert with ON CONFLICT (dedupe_key) DO NOTHING.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key ON notifications (dedupe_key);
