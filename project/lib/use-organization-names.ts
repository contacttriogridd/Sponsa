'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { DEFAULT_ORGANIZATION_NAMES, organizationNamesFrom, type OrganizationNames } from '@/lib/organization';

/** Loads the organization's English and Tamil names from organization_settings. */
export function useOrganizationNames(): OrganizationNames {
  const [names, setNames] = useState<OrganizationNames>(DEFAULT_ORGANIZATION_NAMES);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // select('*') so this still works before migration 00009 adds the columns.
      const { data } = await supabase.from('organization_settings').select('*').limit(1).maybeSingle();
      if (!cancelled) setNames(organizationNamesFrom(data));
    })();
    return () => { cancelled = true; };
  }, []);

  return names;
}
