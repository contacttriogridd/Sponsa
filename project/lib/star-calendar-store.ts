'use client';

import { supabase } from '@/lib/supabase/client';
import { addDays, type StarCalendarDay } from '@/lib/star-days';

/**
 * Daily stars for [from, to] (inclusive). Reads the star_calendar cache
 * (filled for the next 12 months by the daily cron job); any days it lacks
 * are calculated in the browser and written back to the cache.
 */
export async function loadStarCalendar(from: string, to: string): Promise<StarCalendarDay[]> {
  const { data, error } = await supabase
    .from('star_calendar')
    .select('date, sunrise, star, star_start, star_end, extra_star, extra_start, extra_end')
    .gte('date', from)
    .lte('date', to)
    .order('date');

  const byDate = new Map<string, StarCalendarDay>((error ? [] : data || []).map((r) => [r.date, r as StarCalendarDay]));
  const missing: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (!byDate.has(d)) missing.push(d);

  if (missing.length) {
    // Loaded on demand: the astronomy library is only needed when the cache is incomplete.
    const { computeStarDay } = await import('@/lib/star-calendar');
    const computed = missing.map(computeStarDay);
    computed.forEach((r) => byDate.set(r.date, r));
    if (!error) {
      // Best effort; a viewer without write access simply skips caching.
      await supabase.from('star_calendar').upsert(computed.map((r) => ({ ...r, computed_at: new Date().toISOString() })));
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}
