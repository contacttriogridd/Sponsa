'use client';

import { supabase } from '@/lib/supabase/client';
import { organizationNamesFrom, type OrganizationNames } from '@/lib/organization';
import { eventWishTemplatesFrom, type EventWishTemplate } from '@/lib/event-wishes';
import type { ObservanceKey } from '@/lib/observances';

export interface EventWishContext {
  templates: Record<ObservanceKey, EventWishTemplate>;
  organizationNames: OrganizationNames;
}

/** Event wish templates (defaults where none is saved, or before migration 00026) and the organization names. */
export async function loadEventWishContext(): Promise<EventWishContext> {
  const [{ data: rows }, { data: org }] = await Promise.all([
    supabase.from('event_wish_templates').select('event_key, body_ta, body_en'),
    supabase.from('organization_settings').select('*').limit(1).maybeSingle(),
  ]);
  return { templates: eventWishTemplatesFrom(rows as EventWishTemplate[] | null), organizationNames: organizationNamesFrom(org) };
}

/** "sponsorId|date" → event keys already wished, for the given dates. */
export async function loadEventWishSent(dates: string[]): Promise<Set<string>> {
  const { data } = await supabase.from('event_wish_logs').select('monthly_sponsor_id, event_key, date').in('date', dates);
  return new Set((data || []).map((r) => `${r.monthly_sponsor_id}|${r.event_key}|${r.date}`));
}

export const sentKey = (sponsorId: string, key: ObservanceKey, date: string) => `${sponsorId}|${key}|${date}`;

/** Records the wish for every event in it, so each shows "✓ Sent". Sending again updates the time. */
export async function logEventWish(input: { sponsorId: string; eventKeys: ObservanceKey[]; date: string; channel: 'whatsapp' | 'copy'; message: string; userId?: string | null }): Promise<string | null> {
  const { error } = await supabase.from('event_wish_logs').upsert(
    input.eventKeys.map((event_key) => ({
      monthly_sponsor_id: input.sponsorId, event_key, date: input.date, channel: input.channel, message: input.message,
      sent_by: input.userId || null, sent_at: new Date().toISOString(),
    })),
    { onConflict: 'monthly_sponsor_id,event_key,date' },
  );
  return error ? error.message : null;
}
