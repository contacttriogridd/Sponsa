/*
# Sponsor Management - Initial Schema

1. Purpose
   Core database for a Sponsor Management + Special Occasion Reminder + Food Sponsorship platform.
   A collector manages sponsors, their family members, special occasions (birthdays/anniversaries),
   reminder notifications, sponsorship requests, donations, interactions, and WhatsApp messaging.

2. New Tables
   - `app_users` — extends auth.users with role (admin/collector/staff/viewer) and display info
   - `organization_settings` — single-row org config (name, logo, phone, email, address, timezone, currency)
   - `sponsors` — main sponsor records with contact details, consent, archived status
   - `family_members` — family of each sponsor (name, relationship, DOB, contact)
   - `special_occasions` — recurring occasions (birthday, anniversary, etc.) linked to sponsor or family member
   - `reminders` — generated reminders for upcoming occasions (occasion + year + interval deduplication)
   - `notifications` — in-app notification center entries
   - `message_templates` — reusable message templates with variables
   - `sponsorship_requests` — requests to sponsor food for an occasion (status lifecycle)
   - `donations` — recorded donations/sponsorships with food details and payment info
   - `interactions` — log of contacts (call, whatsapp, email, meeting)
   - `whatsapp_messages` — log of WhatsApp messages sent/attempted with delivery status
   - `tasks` — follow-up tasks for the collector
   - `audit_logs` — audit trail of important actions

3. Security
   - RLS enabled on ALL tables.
   - All authenticated users can SELECT all data (shared workspace model).
   - INSERT/UPDATE/DELETE allowed for authenticated users (role enforcement in app layer).

4. Indexes
   - sponsors: name, phone, whatsapp, email, status
   - family_members: sponsor_id
   - special_occasions: sponsor_id, occasion_date, occasion_type
   - reminders: reminder_date, status, dedup unique
   - donations: donation_date, sponsor_id, status
   - sponsorship_requests: sponsor_id, status
   - notifications: user_id, is_read
   - interactions: sponsor_id
   - whatsapp_messages: sponsor_id, status
   - tasks: sponsor_id, status, due_date

5. Notes
   - All PKs are UUIDs with gen_random_uuid() defaults.
   - All tables have created_at and updated_at timestamps.
   - updated_at auto-updated via trigger on all tables.
*/

-- Helper function: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- app_users (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'collector' CHECK (role IN ('admin', 'collector', 'staff', 'viewer')),
  active boolean NOT NULL DEFAULT true,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_users_select" ON app_users;
CREATE POLICY "app_users_select" ON app_users FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "app_users_insert" ON app_users;
CREATE POLICY "app_users_insert" ON app_users FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "app_users_update" ON app_users;
CREATE POLICY "app_users_update" ON app_users FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "app_users_delete" ON app_users;
CREATE POLICY "app_users_delete" ON app_users FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER app_users_updated_at BEFORE UPDATE ON app_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- organization_settings (single-row)
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Our Organization',
  logo_url text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  currency text NOT NULL DEFAULT 'INR',
  reminder_intervals int[] NOT NULL DEFAULT ARRAY[7, 3, 1, 0],
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  whatsapp_access_token text,
  whatsapp_phone_number_id text,
  whatsapp_business_account_id text,
  whatsapp_verify_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_settings_select" ON organization_settings;
CREATE POLICY "org_settings_select" ON organization_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "org_settings_insert" ON organization_settings;
CREATE POLICY "org_settings_insert" ON organization_settings FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "org_settings_update" ON organization_settings;
CREATE POLICY "org_settings_update" ON organization_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "org_settings_delete" ON organization_settings;
CREATE POLICY "org_settings_delete" ON organization_settings FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER org_settings_updated_at BEFORE UPDATE ON organization_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- sponsors
-- ============================================================
CREATE TABLE IF NOT EXISTS sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id text UNIQUE,
  full_name text NOT NULL,
  preferred_name text,
  dob date,
  phone text,
  whatsapp text,
  email text,
  address text,
  city text,
  district text,
  state text,
  occupation text,
  company text,
  communication_preference text DEFAULT 'whatsapp',
  whatsapp_consent boolean NOT NULL DEFAULT false,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  last_contact_date date,
  total_donations numeric(12,2) DEFAULT 0,
  people_helped int DEFAULT 0,
  created_by uuid REFERENCES app_users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sponsors_select" ON sponsors;
CREATE POLICY "sponsors_select" ON sponsors FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "sponsors_insert" ON sponsors;
CREATE POLICY "sponsors_insert" ON sponsors FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "sponsors_update" ON sponsors;
CREATE POLICY "sponsors_update" ON sponsors FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sponsors_delete" ON sponsors;
CREATE POLICY "sponsors_delete" ON sponsors FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_sponsors_full_name ON sponsors (full_name);
CREATE INDEX IF NOT EXISTS idx_sponsors_phone ON sponsors (phone);
CREATE INDEX IF NOT EXISTS idx_sponsors_whatsapp ON sponsors (whatsapp);
CREATE INDEX IF NOT EXISTS idx_sponsors_email ON sponsors (email);
CREATE INDEX IF NOT EXISTS idx_sponsors_status ON sponsors (status);

CREATE TRIGGER sponsors_updated_at BEFORE UPDATE ON sponsors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- family_members
-- ============================================================
CREATE TABLE IF NOT EXISTS family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relationship text NOT NULL DEFAULT 'Other' CHECK (relationship IN ('Wife', 'Husband', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Other')),
  dob date,
  phone text,
  whatsapp text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "family_members_select" ON family_members;
CREATE POLICY "family_members_select" ON family_members FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "family_members_insert" ON family_members;
CREATE POLICY "family_members_insert" ON family_members FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "family_members_update" ON family_members;
CREATE POLICY "family_members_update" ON family_members FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "family_members_delete" ON family_members;
CREATE POLICY "family_members_delete" ON family_members FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_family_members_sponsor_id ON family_members (sponsor_id);

CREATE TRIGGER family_members_updated_at BEFORE UPDATE ON family_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- special_occasions
-- ============================================================
CREATE TABLE IF NOT EXISTS special_occasions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  family_member_id uuid REFERENCES family_members(id) ON DELETE CASCADE,
  person_name text NOT NULL,
  relationship text,
  occasion_type text NOT NULL CHECK (occasion_type IN ('Birthday', 'Wedding Anniversary', 'Business Anniversary', 'Achievement', 'Celebration', 'Other')),
  occasion_date date NOT NULL,
  recurring_yearly boolean NOT NULL DEFAULT true,
  is_auto_generated boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE special_occasions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "special_occasions_select" ON special_occasions;
CREATE POLICY "special_occasions_select" ON special_occasions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "special_occasions_insert" ON special_occasions;
CREATE POLICY "special_occasions_insert" ON special_occasions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "special_occasions_update" ON special_occasions;
CREATE POLICY "special_occasions_update" ON special_occasions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "special_occasions_delete" ON special_occasions;
CREATE POLICY "special_occasions_delete" ON special_occasions FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_special_occasions_sponsor_id ON special_occasions (sponsor_id);
CREATE INDEX IF NOT EXISTS idx_special_occasions_date ON special_occasions (occasion_date);
CREATE INDEX IF NOT EXISTS idx_special_occasions_type ON special_occasions (occasion_type);

CREATE TRIGGER special_occasions_updated_at BEFORE UPDATE ON special_occasions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- reminders
-- ============================================================
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_id uuid NOT NULL REFERENCES special_occasions(id) ON DELETE CASCADE,
  sponsor_id uuid NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  reminder_date date NOT NULL,
  occurrence_year int NOT NULL,
  days_before int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dismissed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminders_select" ON reminders;
CREATE POLICY "reminders_select" ON reminders FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "reminders_insert" ON reminders;
CREATE POLICY "reminders_insert" ON reminders FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "reminders_update" ON reminders;
CREATE POLICY "reminders_update" ON reminders FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "reminders_delete" ON reminders;
CREATE POLICY "reminders_delete" ON reminders FOR DELETE
  TO authenticated USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_dedup ON reminders (occasion_id, occurrence_year, days_before);
CREATE INDEX IF NOT EXISTS idx_reminders_date ON reminders (reminder_date);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders (status);
CREATE INDEX IF NOT EXISTS idx_reminders_sponsor_id ON reminders (sponsor_id);

CREATE TRIGGER reminders_updated_at BEFORE UPDATE ON reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  sponsor_id uuid REFERENCES sponsors(id) ON DELETE CASCADE,
  occasion_id uuid REFERENCES special_occasions(id) ON DELETE SET NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications (is_read);

CREATE TRIGGER notifications_updated_at BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- message_templates (must come before whatsapp_messages)
-- ============================================================
CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('Birthday Wish', 'Anniversary Wish', 'Child Birthday', 'Sponsorship Request', 'Thank You', 'Follow-up')),
  subject text,
  body text NOT NULL,
  variables text[] DEFAULT '{}',
  is_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_templates_select" ON message_templates;
CREATE POLICY "message_templates_select" ON message_templates FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "message_templates_insert" ON message_templates;
CREATE POLICY "message_templates_insert" ON message_templates FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "message_templates_update" ON message_templates;
CREATE POLICY "message_templates_update" ON message_templates FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "message_templates_delete" ON message_templates;
CREATE POLICY "message_templates_delete" ON message_templates FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER message_templates_updated_at BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- sponsorship_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS sponsorship_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  occasion_id uuid REFERENCES special_occasions(id) ON DELETE SET NULL,
  occasion_name text,
  special_date date,
  requested_amount numeric(12,2),
  food_type text,
  people_count int,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'contacted', 'interested', 'confirmed', 'pending', 'declined', 'completed', 'cancelled')),
  collector_id uuid REFERENCES app_users(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sponsorship_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sponsorship_requests_select" ON sponsorship_requests;
CREATE POLICY "sponsorship_requests_select" ON sponsorship_requests FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "sponsorship_requests_insert" ON sponsorship_requests;
CREATE POLICY "sponsorship_requests_insert" ON sponsorship_requests FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "sponsorship_requests_update" ON sponsorship_requests;
CREATE POLICY "sponsorship_requests_update" ON sponsorship_requests FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sponsorship_requests_delete" ON sponsorship_requests;
CREATE POLICY "sponsorship_requests_delete" ON sponsorship_requests FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_sponsorship_requests_sponsor_id ON sponsorship_requests (sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsorship_requests_status ON sponsorship_requests (status);

CREATE TRIGGER sponsorship_requests_updated_at BEFORE UPDATE ON sponsorship_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- donations
-- ============================================================
CREATE TABLE IF NOT EXISTS donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id text UNIQUE,
  sponsor_id uuid NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  sponsorship_request_id uuid REFERENCES sponsorship_requests(id) ON DELETE SET NULL,
  occasion_id uuid REFERENCES special_occasions(id) ON DELETE SET NULL,
  occasion_name text,
  donation_date date NOT NULL,
  type text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  food_quantity text,
  people_helped int DEFAULT 0,
  location text,
  food_type text,
  food_description text,
  payment_method text,
  transaction_id text,
  receipt_number text,
  notes text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_by uuid REFERENCES app_users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "donations_select" ON donations;
CREATE POLICY "donations_select" ON donations FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "donations_insert" ON donations;
CREATE POLICY "donations_insert" ON donations FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "donations_update" ON donations;
CREATE POLICY "donations_update" ON donations FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "donations_delete" ON donations;
CREATE POLICY "donations_delete" ON donations FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_donations_sponsor_id ON donations (sponsor_id);
CREATE INDEX IF NOT EXISTS idx_donations_date ON donations (donation_date);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations (status);

CREATE TRIGGER donations_updated_at BEFORE UPDATE ON donations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- interactions
-- ============================================================
CREATE TABLE IF NOT EXISTS interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('call', 'whatsapp', 'email', 'meeting', 'visit', 'other')),
  summary text,
  details text,
  interaction_date timestamptz DEFAULT now(),
  conducted_by uuid REFERENCES app_users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "interactions_select" ON interactions;
CREATE POLICY "interactions_select" ON interactions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "interactions_insert" ON interactions;
CREATE POLICY "interactions_insert" ON interactions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "interactions_update" ON interactions;
CREATE POLICY "interactions_update" ON interactions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "interactions_delete" ON interactions;
CREATE POLICY "interactions_delete" ON interactions FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_interactions_sponsor_id ON interactions (sponsor_id);

CREATE TRIGGER interactions_updated_at BEFORE UPDATE ON interactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- whatsapp_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  template_id uuid REFERENCES message_templates(id) ON DELETE SET NULL,
  phone text,
  message_body text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'delivered', 'read', 'failed')),
  provider_message_id text,
  error_message text,
  sent_by uuid REFERENCES app_users(id),
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_messages_select" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_select" ON whatsapp_messages FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "whatsapp_messages_insert" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_insert" ON whatsapp_messages FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "whatsapp_messages_update" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_update" ON whatsapp_messages FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "whatsapp_messages_delete" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_delete" ON whatsapp_messages FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sponsor_id ON whatsapp_messages (sponsor_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages (status);

CREATE TRIGGER whatsapp_messages_updated_at BEFORE UPDATE ON whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- tasks (follow-ups)
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  sponsorship_request_id uuid REFERENCES sponsorship_requests(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('Pending', 'Contacted', 'Interested', 'Not Interested', 'Call Later', 'Completed')),
  due_date date,
  completed_at timestamptz,
  assigned_to uuid REFERENCES app_users(id),
  created_by uuid REFERENCES app_users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_tasks_sponsor_id ON tasks (sponsor_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks (due_date);

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "audit_logs_update" ON audit_logs;
CREATE POLICY "audit_logs_update" ON audit_logs FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "audit_logs_delete" ON audit_logs;
CREATE POLICY "audit_logs_delete" ON audit_logs FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);

-- ============================================================
-- Default data
-- ============================================================
INSERT INTO organization_settings (name, timezone, currency)
VALUES ('Sponsa', 'Asia/Kolkata', 'INR')
ON CONFLICT DO NOTHING;

INSERT INTO message_templates (name, type, body, variables, is_approved) VALUES
('Birthday Wish', 'Birthday Wish',
'Dear {{sponsor_name}},

Wishing you a very Happy Birthday! 🎂

May your special day be filled with happiness, good health and wonderful moments.

Thank you for your kindness and continued support towards helping people in need.

Warm wishes,
{{organization_name}}',
ARRAY['sponsor_name', 'organization_name'],
true),
('Anniversary Wish', 'Anniversary Wish',
'Dear {{sponsor_name}},

Wishing you a very Happy Anniversary! 💍

May this special occasion bring you and your loved ones joy and togetherness.

Thank you for your continued support towards helping people in need.

Warm wishes,
{{organization_name}}',
ARRAY['sponsor_name', 'organization_name'],
true),
('Child Birthday', 'Child Birthday',
'Dear {{sponsor_name}},

Wishing {{person_name}} a very Happy Birthday! 🎂

May this special day bring joy, good health and wonderful moments.

Thank you for your kindness and continued support towards helping people in need.

Warm wishes,
{{organization_name}}',
ARRAY['sponsor_name', 'person_name', 'organization_name'],
true),
('Sponsorship Request', 'Sponsorship Request',
'Dear {{sponsor_name}},

Your {{occasion}} is coming up on {{date}}. We would like to wish you in advance and invite you to celebrate your special day by sponsoring food for people who are in need.

Your kindness can bring happiness and nourishment to someone who truly needs it.

Thank you for your support.

Warm regards,
{{organization_name}}',
ARRAY['sponsor_name', 'occasion', 'date', 'organization_name'],
true),
('Thank You', 'Thank You',
'Dear {{sponsor_name}},

Thank you for your generous contribution. Your support has made a real difference in the lives of people in need.

We are truly grateful for your kindness.

Warm regards,
{{organization_name}}',
ARRAY['sponsor_name', 'organization_name'],
true),
('Follow-up', 'Follow-up',
'Dear {{sponsor_name}},

We wanted to follow up regarding the sponsorship opportunity we shared with you. Your support can make a meaningful difference.

Please let us know if you have any questions.

Warm regards,
{{organization_name}}',
ARRAY['sponsor_name', 'organization_name'],
true)
ON CONFLICT DO NOTHING;