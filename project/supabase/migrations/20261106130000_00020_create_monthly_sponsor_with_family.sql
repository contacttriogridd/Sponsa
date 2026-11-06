-- ============================================================
-- Add a monthly sponsor together with their family members, all or nothing.
--
-- A function call runs in one transaction, so if any family member fails
-- to save, the sponsor isn't saved either. SECURITY INVOKER: the caller's
-- own permissions (row-level security) apply, exactly as for direct inserts.
-- Existing data is not touched.
-- ============================================================

CREATE OR REPLACE FUNCTION create_monthly_sponsor_with_family(p_sponsor jsonb, p_members jsonb DEFAULT '[]'::jsonb)
RETURNS monthly_sponsors
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  s monthly_sponsors;
BEGIN
  INSERT INTO monthly_sponsors (
    name, phone, dob, raasi, star, monthly_amount, payment_day, start_date, status, notes,
    sponsor_id, relationship, address, payment_mode, created_by
  ) VALUES (
    p_sponsor->>'name',
    p_sponsor->>'phone',
    (p_sponsor->>'dob')::date,
    (p_sponsor->>'raasi')::smallint,
    (p_sponsor->>'star')::smallint,
    (p_sponsor->>'monthly_amount')::numeric,
    (p_sponsor->>'payment_day')::smallint,
    (p_sponsor->>'start_date')::date,
    coalesce(p_sponsor->>'status', 'active'),
    p_sponsor->>'notes',
    (p_sponsor->>'sponsor_id')::uuid,
    p_sponsor->>'relationship',
    p_sponsor->>'address',
    p_sponsor->>'payment_mode',
    (p_sponsor->>'created_by')::uuid
  )
  RETURNING * INTO s;

  INSERT INTO monthly_family_members (monthly_sponsor_id, name, relationship, relationship_other, star, raasi, dob, phone, address, notes)
  SELECT s.id, m.name, m.relationship, m.relationship_other, m.star, m.raasi, m.dob, m.phone, m.address, m.notes
  FROM jsonb_to_recordset(coalesce(p_members, '[]'::jsonb)) AS m(
    name text, relationship text, relationship_other text, star smallint, raasi smallint,
    dob date, phone text, address text, notes text
  );

  RETURN s;
END;
$$;

GRANT EXECUTE ON FUNCTION create_monthly_sponsor_with_family(jsonb, jsonb) TO authenticated;
