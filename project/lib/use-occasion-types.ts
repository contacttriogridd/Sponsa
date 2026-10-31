'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { DEFAULT_OCCASION_TYPES, type OccasionTypeRow } from '@/lib/occasion-draft';

/** Occasion types from Settings, in order; the built-in list until the table exists. */
export function useOccasionTypes(): OccasionTypeRow[] {
  const [types, setTypes] = useState<OccasionTypeRow[]>(DEFAULT_OCCASION_TYPES);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('occasion_types').select('*').order('sort_order');
      if (!cancelled && !error && data?.length) setTypes(data as OccasionTypeRow[]);
    })();
    return () => { cancelled = true; };
  }, []);

  return types;
}
