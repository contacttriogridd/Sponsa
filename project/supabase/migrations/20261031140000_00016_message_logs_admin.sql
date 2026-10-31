-- ============================================================
-- Message log and admin WhatsApp notifications.
--
--   message_logs             every wish, thank-you and admin message
--   organization_settings    admin number and name, notify default,
--                            daily summary, WhatsApp sending mode
-- ============================================================

CREATE TABLE IF NOT EXISTS message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid REFERENCES sponsors(id) ON DELETE SET NULL,
  sponsor_name text,
  sponsor_phone text,
  message_type text NOT NULL CHECK (message_type IN (
    'birthday_wish', 'anniversary_wish', 'event_wish', 'donation_thanks', 'admin_notification', 'admin_daily_summary'
  )),
  type_label text,
  -- The reminder this was for, e.g. occ:<id> or dob:<id>, as used on the dashboard.
  related_event_id text,
  related_donation_id uuid REFERENCES donations(id) ON DELETE SET NULL,
  occurrence_date date NOT NULL,
  message_text text NOT NULL,
  recipient text NOT NULL CHECK (recipient IN ('sponsor', 'admin')),
  recipient_phone text,
  channel text NOT NULL CHECK (channel IN ('whatsapp_link', 'whatsapp_api', 'sms', 'email', 'copy')),
  status text NOT NULL CHECK (status IN ('opened', 'sent', 'delivered', 'failed')),
  error_message text,
  provider_message_id text,
  admin_notified boolean NOT NULL DEFAULT false,
  sent_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  sent_by_name text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_logs_sponsor ON message_logs (sponsor_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_logs_donation ON message_logs (related_donation_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_occurrence ON message_logs (occurrence_date);
CREATE INDEX IF NOT EXISTS idx_message_logs_sent_at ON message_logs (sent_at DESC);

-- A day's summary can only go out once (failed attempts don't count).
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_logs_one_summary_per_day ON message_logs (occurrence_date)
  WHERE message_type = 'admin_daily_summary' AND status IN ('opened', 'sent', 'delivered');

ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "message_logs_select" ON message_logs;
CREATE POLICY "message_logs_select" ON message_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "message_logs_insert" ON message_logs;
CREATE POLICY "message_logs_insert" ON message_logs FOR INSERT TO authenticated
  WITH CHECK (current_app_role() IN ('admin', 'collector'));
DROP POLICY IF EXISTS "message_logs_update" ON message_logs;
CREATE POLICY "message_logs_update" ON message_logs FOR UPDATE TO authenticated
  USING (current_app_role() IN ('admin', 'collector')) WITH CHECK (current_app_role() IN ('admin', 'collector'));
-- "No, I didn't send it" removes an unconfirmed entry; sent messages stay on record.
DROP POLICY IF EXISTS "message_logs_delete" ON message_logs;
CREATE POLICY "message_logs_delete" ON message_logs FOR DELETE TO authenticated
  USING (current_app_role() = 'admin' OR (current_app_role() = 'collector' AND status = 'opened'));

ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS admin_whatsapp_number text NOT NULL DEFAULT '919629522777',
  ADD COLUMN IF NOT EXISTS admin_name text NOT NULL DEFAULT 'UDHAYA KUMAR',
  ADD COLUMN IF NOT EXISTS notify_admin_default boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS daily_summary_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS daily_summary_time text NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS whatsapp_send_mode text NOT NULL DEFAULT 'manual' CHECK (whatsapp_send_mode IN ('manual', 'automatic'));
