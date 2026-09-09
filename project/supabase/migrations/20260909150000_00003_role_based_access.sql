/*
# Role-based write access

Migration 00001 enabled RLS on every table but left every INSERT/UPDATE/DELETE
policy as `USING (true)` — any authenticated user, regardless of role, could
write or delete any row. This migration enforces the role model from the spec:

  - admin      — full access, including permanent delete
  - collector  — can create/update sponsors, occasions, sponsorships,
                 donations, interactions, tasks, WhatsApp messages, reminders
  - staff/viewer — read-only (SELECT policies, added in 00001, are unchanged)

A SECURITY DEFINER helper (`current_app_role`) reads the caller's role from
`app_users` without re-triggering RLS on that table (which would recurse).
*/

CREATE OR REPLACE FUNCTION current_app_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM app_users WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION current_app_role() TO authenticated;

-- ============================================================
-- app_users — self can update own profile, only admin can
-- change anyone's role/active status (self-escalation blocked below)
-- ============================================================
DROP POLICY IF EXISTS "app_users_insert" ON app_users;
CREATE POLICY "app_users_insert" ON app_users FOR INSERT
  TO authenticated WITH CHECK (id = auth.uid() OR current_app_role() = 'admin');

DROP POLICY IF EXISTS "app_users_update" ON app_users;
CREATE POLICY "app_users_update" ON app_users FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR current_app_role() = 'admin')
  WITH CHECK (id = auth.uid() OR current_app_role() = 'admin');

DROP POLICY IF EXISTS "app_users_delete" ON app_users;
CREATE POLICY "app_users_delete" ON app_users FOR DELETE
  TO authenticated USING (current_app_role() = 'admin');

CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() = OLD.id AND current_app_role() <> 'admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Only an admin can change a user role.';
    END IF;
    IF NEW.active IS DISTINCT FROM OLD.active THEN
      RAISE EXCEPTION 'Only an admin can change account active status.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS app_users_role_guard ON app_users;
CREATE TRIGGER app_users_role_guard BEFORE UPDATE ON app_users
  FOR EACH ROW EXECUTE FUNCTION prevent_role_self_escalation();

-- ============================================================
-- organization_settings, message_templates — admin only
-- ============================================================
DROP POLICY IF EXISTS "org_settings_insert" ON organization_settings;
CREATE POLICY "org_settings_insert" ON organization_settings FOR INSERT
  TO authenticated WITH CHECK (current_app_role() = 'admin');
DROP POLICY IF EXISTS "org_settings_update" ON organization_settings;
CREATE POLICY "org_settings_update" ON organization_settings FOR UPDATE
  TO authenticated USING (current_app_role() = 'admin') WITH CHECK (current_app_role() = 'admin');
DROP POLICY IF EXISTS "org_settings_delete" ON organization_settings;
CREATE POLICY "org_settings_delete" ON organization_settings FOR DELETE
  TO authenticated USING (current_app_role() = 'admin');

DROP POLICY IF EXISTS "message_templates_insert" ON message_templates;
CREATE POLICY "message_templates_insert" ON message_templates FOR INSERT
  TO authenticated WITH CHECK (current_app_role() = 'admin');
DROP POLICY IF EXISTS "message_templates_update" ON message_templates;
CREATE POLICY "message_templates_update" ON message_templates FOR UPDATE
  TO authenticated USING (current_app_role() = 'admin') WITH CHECK (current_app_role() = 'admin');
DROP POLICY IF EXISTS "message_templates_delete" ON message_templates;
CREATE POLICY "message_templates_delete" ON message_templates FOR DELETE
  TO authenticated USING (current_app_role() = 'admin');

-- ============================================================
-- Core business tables — admin/collector write, admin-only hard delete
-- ============================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sponsors', 'family_members', 'special_occasions', 'sponsorship_requests',
    'donations', 'interactions', 'tasks', 'whatsapp_messages', 'reminders'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON %I FOR INSERT TO authenticated WITH CHECK (current_app_role() IN (''admin'', ''collector''))',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_update" ON %I FOR UPDATE TO authenticated USING (current_app_role() IN (''admin'', ''collector'')) WITH CHECK (current_app_role() IN (''admin'', ''collector''))',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_delete" ON %I FOR DELETE TO authenticated USING (current_app_role() = ''admin'')',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- notifications — shared team inbox (the UI shows every collector
-- the same feed and lets any of them mark items read), so writes are
-- gated by role only, same as the other business tables
-- ============================================================
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT
  TO authenticated WITH CHECK (current_app_role() IN ('admin', 'collector'));

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE
  TO authenticated
  USING (current_app_role() IN ('admin', 'collector'))
  WITH CHECK (current_app_role() IN ('admin', 'collector'));

DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications FOR DELETE
  TO authenticated USING (current_app_role() = 'admin');

-- ============================================================
-- audit_logs — append-only: any admin/collector session may insert,
-- nobody may update, only admin may delete
-- ============================================================
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (current_app_role() IN ('admin', 'collector'));

DROP POLICY IF EXISTS "audit_logs_update" ON audit_logs;

DROP POLICY IF EXISTS "audit_logs_delete" ON audit_logs;
CREATE POLICY "audit_logs_delete" ON audit_logs FOR DELETE
  TO authenticated USING (current_app_role() = 'admin');
