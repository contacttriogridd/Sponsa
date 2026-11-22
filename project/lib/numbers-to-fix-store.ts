'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useDrawerDataChanged } from '@/lib/drawer-store';
import { PHONE_SOURCE_QUERIES, findPhoneIssues, type PhoneIssue, type PhoneSources } from '@/lib/numbers-to-fix';

/** Loads every phone column the app uses and returns the invalid numbers. */
export async function loadPhoneIssues(): Promise<PhoneIssue[]> {
  const keys = Object.keys(PHONE_SOURCE_QUERIES) as (keyof PhoneSources)[];
  const results = await Promise.all(keys.map((t) => supabase.from(t).select(PHONE_SOURCE_QUERIES[t])));
  const src: PhoneSources = {};
  keys.forEach((t, i) => { src[t] = (results[i].error ? [] : results[i].data || []) as never; });
  return findPhoneIssues(src);
}

let cached: { at: number; count: number } | null = null;

/** Count for the menu badge (admins only): cached for a minute, refreshed when data changes. */
export function useNumbersToFixCount(enabled: boolean): number {
  const [count, setCount] = useState(cached?.count ?? 0);
  const refresh = useCallback((force = false) => {
    if (!enabled) return;
    if (!force && cached && Date.now() - cached.at < 60_000) { setCount(cached.count); return; }
    loadPhoneIssues().then((l) => { cached = { at: Date.now(), count: l.length }; setCount(l.length); }).catch(() => {});
  }, [enabled]);
  useEffect(() => { refresh(); }, [refresh]);
  const onChange = useCallback(() => refresh(true), [refresh]);
  useDrawerDataChanged(onChange);
  return count;
}
