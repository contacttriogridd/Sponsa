-- ============================================================
-- sponsorship_requests.type: what is being requested (Food, Money,
-- Clothes, ...), matching the donation types. Existing rows stay NULL
-- and are shown as 'Food', since every request so far was for food.
-- ============================================================
ALTER TABLE sponsorship_requests ADD COLUMN IF NOT EXISTS type text;
