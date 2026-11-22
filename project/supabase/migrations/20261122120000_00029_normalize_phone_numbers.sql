-- ============================================================
-- Phone numbers: one stored format, +91XXXXXXXXXX (E.164).
--
-- Some numbers were saved without the country code ("98765 43210",
-- "098765 43210", "91 98765 43210"), which made WhatsApp say "missing a
-- country code" or open the "Send to…" picker. This converts every valid
-- number in every phone column to +91XXXXXXXXXX, using the same rules as the
-- app (lib/phone.ts → normalizePhone):
--
--   • spaces, dashes, dots, brackets, letters, invisible characters removed
--   • a leading +, 00 or 0 dropped
--   • 10 digits starting 6–9 → +91 added; 91 + 10 digits starting 6–9 → kept
--   • a number written with + (or 00) and another country code → kept,
--     if it has 8–15 digits
--   • anything else is invalid and LEFT UNCHANGED — fix those on the
--     Admin "Numbers to fix" page (Settings → Numbers to fix)
--
-- Safe to run again: the second run updates 0 rows. The last statement
-- shows the summary per column: updated / already correct / needs manual fix.
-- ============================================================

CREATE OR REPLACE FUNCTION normalize_phone(p text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  raw text := btrim(regexp_replace(coalesce(p, ''), '[​-‏‪-‮⁠-⁤﻿ ]', ' ', 'g'));
  d text;
  intl boolean;
BEGIN
  IF raw = '' THEN RETURN NULL; END IF;
  d := regexp_replace(raw, '\D', '', 'g');
  intl := left(raw, 1) = '+';
  IF left(d, 2) = '00' THEN d := substr(d, 3); intl := true; END IF;
  IF intl AND left(d, 2) <> '91' THEN
    RETURN CASE WHEN length(d) BETWEEN 8 AND 15 THEN '+' || d ELSE NULL END;
  END IF;
  IF NOT intl AND length(d) = 11 AND left(d, 1) = '0' THEN d := substr(d, 2); END IF;
  IF length(d) = 10 AND d ~ '^[6-9]' THEN RETURN '+91' || d; END IF;
  IF length(d) = 12 AND d ~ '^91[6-9]' THEN RETURN '+' || d; END IF;
  RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION normalize_phone(text) TO authenticated;

ALTER TABLE organization_settings ALTER COLUMN admin_whatsapp_number SET DEFAULT '+919629522777';

CREATE TEMP TABLE IF NOT EXISTS phone_fix_summary (
  table_name text, column_name text, updated int, already_correct int, needs_manual_fix int
) ON COMMIT PRESERVE ROWS;
TRUNCATE phone_fix_summary;

DO $$
DECLARE
  c record;
  n_updated int; n_correct int; n_invalid int;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      ('sponsors', 'phone'), ('sponsors', 'whatsapp'),
      ('family_members', 'phone'), ('family_members', 'whatsapp'),
      ('monthly_sponsors', 'phone'), ('monthly_family_members', 'phone'),
      ('special_occasions', 'contact_phone'),
      ('app_users', 'phone'),
      ('organization_settings', 'phone'), ('organization_settings', 'admin_whatsapp_number'), ('organization_settings', 'ack_whatsapp'),
      -- Copies kept with sent messages.
      ('message_logs', 'sponsor_phone'), ('message_logs', 'recipient_phone'),
      ('whatsapp_messages', 'phone')
    ) AS v(t, col)
    WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v.t AND column_name = v.col)
  LOOP
    EXECUTE format(
      'SELECT count(*) FILTER (WHERE normalize_phone(%1$I) IS NOT NULL AND %1$I IS DISTINCT FROM normalize_phone(%1$I)),
              count(*) FILTER (WHERE normalize_phone(%1$I) IS NOT NULL AND %1$I = normalize_phone(%1$I)),
              count(*) FILTER (WHERE normalize_phone(%1$I) IS NULL)
       FROM %2$I WHERE coalesce(btrim(%1$I), '''') <> ''''', c.col, c.t)
      INTO n_updated, n_correct, n_invalid;
    EXECUTE format(
      'UPDATE %2$I SET %1$I = normalize_phone(%1$I)
       WHERE coalesce(btrim(%1$I), '''') <> '''' AND normalize_phone(%1$I) IS NOT NULL AND %1$I IS DISTINCT FROM normalize_phone(%1$I)', c.col, c.t);
    INSERT INTO phone_fix_summary VALUES (c.t, c.col, n_updated, n_correct, n_invalid);
    RAISE NOTICE '%.%: updated %, already correct %, needs manual fix %', c.t, c.col, n_updated, n_correct, n_invalid;
  END LOOP;
END $$;

SELECT table_name, column_name, updated, already_correct, needs_manual_fix FROM phone_fix_summary
UNION ALL
SELECT 'TOTAL', '', sum(updated)::int, sum(already_correct)::int, sum(needs_manual_fix)::int FROM phone_fix_summary;
