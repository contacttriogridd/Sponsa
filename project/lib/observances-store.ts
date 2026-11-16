'use client';

import { supabase } from '@/lib/supabase/client';
import { addDays } from '@/lib/star-days';
import { observanceViews, type Observance, type ObservanceInput, type ObservanceKey, type ObservanceView, OBSERVANCE_META } from '@/lib/observances';

const COLUMNS = 'id, date, event_key, event_en, event_ta, is_hidden, override_date, note, source, created_at, updated_at';

/**
 * Events shown between from and to, in one query: rows whose CSV date or
 * override date is in range. The range is widened by 16 days either side
 * only to tell வளர்பிறை from தேய்பிறை near the month's edges.
 * Returns [] if migration 00025 is not applied yet.
 */
export async function loadObservances(from: string, to: string, includeHidden = false): Promise<ObservanceView[]> {
  const lo = addDays(from, -16);
  const hi = addDays(to, 16);
  const { data, error } = await supabase
    .from('monthly_observances')
    .select(COLUMNS)
    .or(`and(date.gte.${lo},date.lte.${hi}),and(override_date.gte.${lo},override_date.lte.${hi})`)
    .order('date');
  if (error) return [];
  return observanceViews((data || []) as Observance[], from, to, includeHidden);
}

/**
 * The events on one date, from the same table the Star Calendar shows
 * (moved and hidden dates applied), with each event's paksha.
 */
export async function getEventsForDate(date: string): Promise<{ event_key: ObservanceKey; paksha: ObservanceView['label']['paksha']; view: ObservanceView }[]> {
  const views = await loadObservances(date, date);
  return views.map((v) => ({ event_key: v.event_key, paksha: v.label.paksha, view: v }));
}

/** Last date with observance data, or null when the table is empty. */
export async function observancesLastDate(): Promise<string | null> {
  const { data, error } = await supabase.from('monthly_observances').select('date').order('date', { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return data.date as string;
}

export async function countObservances(): Promise<{ total: number; first: string | null; last: string | null } | null> {
  const [{ count, error }, first, last] = await Promise.all([
    supabase.from('monthly_observances').select('id', { count: 'exact', head: true }),
    supabase.from('monthly_observances').select('date').order('date').limit(1).maybeSingle(),
    observancesLastDate(),
  ]);
  if (error) return null;
  return { total: count || 0, first: (first.data?.date as string) || null, last };
}

// ---------------------------------------------------------------- admin edits (RLS: admins only)

async function update(id: string, patch: Partial<Observance>): Promise<string | null> {
  const { error } = await supabase.from('monthly_observances').update(patch).eq('id', id);
  return error ? error.message : null;
}

/** Shows the event on another date; moving it back to its CSV date clears the override. */
export const moveObservance = (o: Pick<Observance, 'id' | 'date'>, to: string) => update(o.id, { override_date: to === o.date ? null : to });
export const hideObservance = (id: string) => update(id, { is_hidden: true });
export const setObservanceNote = (id: string, note: string) => update(id, { note: note.trim() || null });
/** Back to the original CSV date, visible again. */
export const restoreObservance = (id: string) => update(id, { override_date: null, is_hidden: false });

export async function deleteObservance(id: string): Promise<string | null> {
  const { error } = await supabase.from('monthly_observances').delete().eq('id', id);
  return error ? error.message : null;
}

export async function addManualObservance(date: string, key: ObservanceKey): Promise<string | null> {
  const meta = OBSERVANCE_META[key];
  const { error } = await supabase.from('monthly_observances').insert({ date, event_key: key, event_en: meta.short, event_ta: meta.ta, source: 'manual' });
  if (error?.code === '23505') return 'This event is already on that date.';
  return error ? error.message : null;
}

/**
 * Adds rows that are not there yet (same date and event = skipped). Existing
 * rows, including admin overrides, are never changed.
 */
export async function importObservances(rows: ObservanceInput[], onProgress?: (done: number) => void): Promise<{ added: number; skipped: number; error: string | null }> {
  let added = 0;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('monthly_observances')
      .upsert(chunk, { onConflict: 'date,event_key', ignoreDuplicates: true })
      .select('id');
    if (error) return { added, skipped: i - added, error: error.message };
    added += (data || []).length;
    onProgress?.(Math.min(i + CHUNK, rows.length));
  }
  return { added, skipped: rows.length - added, error: null };
}

/** Each user's Show / Hide events choice (app_users.show_observances). */
export async function loadShowObservances(userId: string | undefined): Promise<boolean> {
  if (!userId) return true;
  const { data } = await supabase.from('app_users').select('show_observances').eq('id', userId).maybeSingle();
  return (data as { show_observances?: boolean } | null)?.show_observances !== false;
}

export function saveShowObservances(userId: string | undefined, show: boolean): void {
  if (userId) supabase.from('app_users').update({ show_observances: show }).eq('id', userId).then(() => undefined);
}
