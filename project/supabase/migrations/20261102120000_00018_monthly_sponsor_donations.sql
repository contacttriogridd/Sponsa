-- ============================================================
-- Donations from monthly sponsors.
--
-- A donation now belongs to either a regular sponsor (sponsor_id) or a
-- monthly sponsor (monthly_sponsor_id), marked by sponsor_type. Existing
-- donations are all 'regular' and keep their sponsor_id.
-- ============================================================

ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS sponsor_type text NOT NULL DEFAULT 'regular' CHECK (sponsor_type IN ('regular', 'monthly')),
  ADD COLUMN IF NOT EXISTS monthly_sponsor_id uuid REFERENCES monthly_sponsors(id) ON DELETE CASCADE;

ALTER TABLE donations ALTER COLUMN sponsor_id DROP NOT NULL;

ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_sponsor_link_check;
ALTER TABLE donations ADD CONSTRAINT donations_sponsor_link_check CHECK (
  (sponsor_type = 'regular' AND sponsor_id IS NOT NULL) OR
  (sponsor_type = 'monthly' AND monthly_sponsor_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_donations_monthly_sponsor ON donations (monthly_sponsor_id);
