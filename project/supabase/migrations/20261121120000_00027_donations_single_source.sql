-- ============================================================
-- One source of truth for donations (Phase 1).
--
-- Every rupee received is one row in `donations`; every screen computes its
-- totals from it. This migration:
--
--   1. donations: adds sponsor_name, sponsor_category, occasion_date,
--      monthly_payment_id, acknowledgment_status / _sent_at, and allows
--      walk-in donations (no sponsor record, just a name).
--   2. Keeps donation history when a sponsor is deleted: the sponsor links
--      become ON DELETE SET NULL (they were CASCADE, which erased donations)
--      and the sponsor's name is stored on the donation.
--   3. Receipt numbers: filled automatically (VPT-2026-00001) when empty.
--   4. Monthly "Mark paid" (monthly_payments) now writes a matching donation
--      row, so monthly money shows in Donations, Reports and the Dashboard.
--      Existing paid months are copied in once; a donation already recorded
--      for the same sponsor, month and amount is linked instead of copied.
--   5. sponsors.total_donations / people_helped are recalculated from
--      donations and kept in step by a trigger (no app-side running totals).
--   6. Monthly sponsors: delete_monthly_sponsor() — deletes a sponsor with no
--      donations, otherwise marks them Stopped + deleted_at so history stays.
--   7. Ends with the reconciliation: amount per category and the total.
--
-- Safe to re-run. No donation, sponsor or payment is removed.
-- ============================================================

-- 1. New columns ------------------------------------------------------------
ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS sponsor_name text,
  ADD COLUMN IF NOT EXISTS sponsor_category text,
  ADD COLUMN IF NOT EXISTS occasion_date date,
  ADD COLUMN IF NOT EXISTS monthly_payment_id uuid,
  ADD COLUMN IF NOT EXISTS acknowledgment_status text,
  ADD COLUMN IF NOT EXISTS acknowledgment_sent_at timestamptz;

ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_sponsor_category_check;
ALTER TABLE donations ADD CONSTRAINT donations_sponsor_category_check CHECK (sponsor_category IS NULL OR sponsor_category IN (
  'Monthly', 'Birthday', 'Star Birthday', 'Wedding Anniversary', 'Memorial (Thithi)', 'General', 'Annadhanam', 'Other'
));
ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_acknowledgment_status_check;
ALTER TABLE donations ADD CONSTRAINT donations_acknowledgment_status_check
  CHECK (acknowledgment_status IS NULL OR acknowledgment_status IN ('pending', 'sent', 'failed'));

ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_monthly_payment_id_fkey;
ALTER TABLE donations ADD CONSTRAINT donations_monthly_payment_id_fkey
  FOREIGN KEY (monthly_payment_id) REFERENCES monthly_payments(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS donations_monthly_payment_id_key ON donations (monthly_payment_id) WHERE monthly_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_donations_category ON donations (sponsor_category);

-- Walk-in / anonymous donations.
ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_sponsor_type_check;
ALTER TABLE donations ADD CONSTRAINT donations_sponsor_type_check CHECK (sponsor_type IN ('regular', 'monthly', 'walkin'));

-- 2. Names first, so history keeps a name once a sponsor is gone -------------
UPDATE donations d SET sponsor_name = s.full_name FROM sponsors s WHERE d.sponsor_id = s.id AND d.sponsor_name IS NULL;
UPDATE donations d SET sponsor_name = m.name FROM monthly_sponsors m WHERE d.monthly_sponsor_id = m.id AND d.sponsor_name IS NULL;

ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_sponsor_link_check;
ALTER TABLE donations ADD CONSTRAINT donations_sponsor_link_check CHECK (
  sponsor_id IS NOT NULL OR monthly_sponsor_id IS NOT NULL OR coalesce(btrim(sponsor_name), '') <> ''
);

ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_sponsor_id_fkey;
ALTER TABLE donations ADD CONSTRAINT donations_sponsor_id_fkey
  FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE SET NULL;
ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_monthly_sponsor_id_fkey;
ALTER TABLE donations ADD CONSTRAINT donations_monthly_sponsor_id_fkey
  FOREIGN KEY (monthly_sponsor_id) REFERENCES monthly_sponsors(id) ON DELETE SET NULL;

-- Category for existing donations, from the linked occasion or the occasion name.
UPDATE donations d SET sponsor_category = CASE
    WHEN d.sponsor_type = 'monthly' OR d.monthly_sponsor_id IS NOT NULL THEN 'Monthly'
    WHEN x.occasion_type_key IN ('self_birthday', 'family_birthday') OR x.occasion_type = 'Birthday' THEN 'Birthday'
    WHEN x.occasion_type_key = 'wedding_anniversary' OR x.occasion_type = 'Wedding Anniversary' THEN 'Wedding Anniversary'
    WHEN x.occasion_type_key = 'death_anniversary' THEN 'Memorial (Thithi)'
    WHEN d.occasion_name ~* '(star|natchathiram|nakshatra|நட்சத்திர)' THEN 'Star Birthday'
    WHEN d.occasion_name ~* '(remembrance|memorial|thithi|death|நினைவு)' THEN 'Memorial (Thithi)'
    WHEN d.occasion_name ~* '(wedding|anniversary|திருமண)' THEN 'Wedding Anniversary'
    WHEN d.occasion_name ~* '(birthday|பிறந்த)' THEN 'Birthday'
    WHEN d.type = 'Food' THEN 'Annadhanam'
    ELSE 'General'
  END
FROM (SELECT d2.id, o.occasion_type_key, o.occasion_type FROM donations d2 LEFT JOIN special_occasions o ON o.id = d2.occasion_id) x
WHERE x.id = d.id AND d.sponsor_category IS NULL;

-- 3. Receipt numbers ----------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS donation_receipt_seq;

-- Names, category and receipt number filled in on every new or edited donation.
CREATE OR REPLACE FUNCTION donations_fill_defaults() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sponsor_name IS NULL AND NEW.sponsor_id IS NOT NULL THEN
    SELECT full_name INTO NEW.sponsor_name FROM sponsors WHERE id = NEW.sponsor_id;
  END IF;
  IF NEW.sponsor_name IS NULL AND NEW.monthly_sponsor_id IS NOT NULL THEN
    SELECT name INTO NEW.sponsor_name FROM monthly_sponsors WHERE id = NEW.monthly_sponsor_id;
  END IF;
  IF NEW.sponsor_category IS NULL THEN
    NEW.sponsor_category := CASE WHEN NEW.monthly_sponsor_id IS NOT NULL THEN 'Monthly' WHEN NEW.type = 'Food' THEN 'Annadhanam' ELSE 'General' END;
  END IF;
  IF coalesce(btrim(NEW.receipt_number), '') = '' THEN
    NEW.receipt_number := 'VPT-' || to_char(coalesce(NEW.donation_date, current_date), 'YYYY') || '-' || lpad(nextval('donation_receipt_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS donations_fill_defaults ON donations;
CREATE TRIGGER donations_fill_defaults BEFORE INSERT OR UPDATE ON donations
  FOR EACH ROW EXECUTE FUNCTION donations_fill_defaults();

-- Existing donations without a receipt number get one, oldest first.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM donations WHERE coalesce(btrim(receipt_number), '') = '' ORDER BY donation_date, created_at LOOP
    UPDATE donations SET receipt_number = NULL WHERE id = r.id;  -- the trigger assigns the next number
  END LOOP;
END $$;

-- 5. sponsors.total_donations / people_helped from donations -----------------
CREATE OR REPLACE FUNCTION refresh_sponsor_totals(p_sponsor uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE sponsors s SET
    total_donations = coalesce((SELECT sum(amount) FROM donations WHERE sponsor_id = p_sponsor), 0),
    people_helped = coalesce((SELECT sum(people_helped) FROM donations WHERE sponsor_id = p_sponsor), 0)
  WHERE s.id = p_sponsor;
$$;

CREATE OR REPLACE FUNCTION donations_refresh_sponsor_totals() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.sponsor_id IS NOT NULL THEN PERFORM refresh_sponsor_totals(OLD.sponsor_id); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.sponsor_id IS NOT NULL THEN PERFORM refresh_sponsor_totals(NEW.sponsor_id); END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS donations_refresh_sponsor_totals ON donations;
CREATE TRIGGER donations_refresh_sponsor_totals AFTER INSERT OR UPDATE OR DELETE ON donations
  FOR EACH ROW EXECUTE FUNCTION donations_refresh_sponsor_totals();

-- 4. Monthly payments → donations ---------------------------------------------
-- Paid with an amount: one linked donation (created, or an existing matching
-- one linked). Set back to Pending: the linked donation is removed.
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
    -- Already recorded with Record Donation for this month and amount: link it, don't copy.
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
      occasion_name, payment_method, monthly_payment_id, status, notes, created_by
    ) VALUES (
      'monthly', p.monthly_sponsor_id, sponsor.name, 'Monthly', 'Money', p.amount, coalesce(p.paid_on, p.month), p.month,
      'Monthly sponsorship – ' || to_char(p.month, 'Mon YYYY'), mode, p.id, 'completed', p.notes, p.recorded_by
    );
  ELSE
    UPDATE donations SET amount = p.amount, donation_date = coalesce(p.paid_on, p.month), occasion_date = p.month,
      payment_method = coalesce(mode, payment_method)
    WHERE id = existing;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION monthly_payments_to_donations() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM sync_monthly_payment_donation(NEW);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS monthly_payments_to_donations ON monthly_payments;
CREATE TRIGGER monthly_payments_to_donations AFTER INSERT OR UPDATE ON monthly_payments
  FOR EACH ROW EXECUTE FUNCTION monthly_payments_to_donations();

-- Copy existing paid months in once (re-running only refreshes the linked rows).
SELECT sync_monthly_payment_donation(mp) FROM monthly_payments mp WHERE mp.status = 'paid';

-- Recalculate every sponsor's totals from donations.
SELECT refresh_sponsor_totals(id) FROM sponsors;

-- 6. Monthly sponsor delete ---------------------------------------------------
ALTER TABLE monthly_sponsors ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION delete_monthly_sponsor(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF current_app_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an admin can delete monthly sponsors';
  END IF;
  IF EXISTS (SELECT 1 FROM donations WHERE monthly_sponsor_id = p_id) THEN
    -- Has donation history: keep it, hide the sponsor.
    UPDATE monthly_sponsors SET status = 'stopped', deleted_at = now() WHERE id = p_id;
    RETURN 'archived';
  END IF;
  DELETE FROM monthly_sponsors WHERE id = p_id;
  RETURN 'deleted';
END;
$$;
GRANT EXECUTE ON FUNCTION delete_monthly_sponsor(uuid) TO authenticated;

-- 7. Reconciliation: amount per category, then the overall total --------------
SELECT
  CASE WHEN GROUPING(sponsor_category) = 1 THEN 'TOTAL' ELSE coalesce(sponsor_category, '(no category)') END AS category,
  count(*) AS donations,
  sum(amount) AS amount
FROM donations
GROUP BY ROLLUP (sponsor_category)
ORDER BY GROUPING(sponsor_category), sponsor_category;
