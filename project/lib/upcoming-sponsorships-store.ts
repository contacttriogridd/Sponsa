'use client';

import { supabase } from '@/lib/supabase/client';
import { shiftDate } from '@/lib/recurrence';
import { loadReminderData } from '@/lib/today-reminders-store';
import { notifyDrawerDataChanged } from '@/lib/drawer-store';
import { upcomingEvents, type ReminderRow, type Stage, type UpcomingEvent } from '@/lib/upcoming-sponsorships';
import type { SponsorshipRequest } from '@/lib/types';

export type SentReminder = ReminderRow & {
  sponsors?: { full_name: string } | null;
  monthly_sponsors?: { name: string } | null;
};

/** Events in the next 3 days with their sponsorship record and reminder slots. */
export async function loadUpcomingEvents(force = false): Promise<{ today: string; events: UpcomingEvent[]; ready: boolean }> {
  const data = await loadReminderData(force);
  const today = data.today;
  const until = shiftDate(today, 3);
  const [{ data: reqs }, { data: rems, error }] = await Promise.all([
    supabase.from('sponsorship_requests').select('*').gte('special_date', today).lte('special_date', until),
    supabase.from('sponsorship_reminders').select('*').gte('event_date', today).lte('event_date', until),
  ]);
  // Reminder requests by id too (req:<id> events can be any date).
  const reqIds = data.items.filter((i) => i.key.startsWith('req:')).map((i) => i.key.replace(/#next$/, '').slice(4));
  const extra = reqIds.length ? (await supabase.from('sponsorship_requests').select('*').in('id', reqIds)).data || [] : [];
  const requests = [...(reqs || []), ...extra] as SponsorshipRequest[];
  return { today, events: upcomingEvents(data.items, requests, (error ? [] : rems || []) as ReminderRow[], today), ready: !error };
}

/** Every reminder sent, newest first, with the sponsor's name. */
export async function loadSentReminders(): Promise<SentReminder[]> {
  const { data, error } = await supabase.from('sponsorship_reminders')
    .select('*, sponsors(full_name), monthly_sponsors(name)')
    .order('event_date', { ascending: false }).order('sent_at', { ascending: false }).limit(1000);
  return error ? [] : (data || []) as SentReminder[];
}

/** "Mark reminder sent" for a message sent outside the app. Does not change the sponsorship status. */
export async function markReminderSent(e: UpcomingEvent, stage: Stage, channel: ReminderRow['channel'], by: { id?: string | null; name?: string | null }): Promise<string | null> {
  const { error } = await supabase.from('sponsorship_reminders').upsert({
    sponsorship_id: e.record?.id || null,
    sponsor_id: e.item.sponsor?.id || null,
    monthly_sponsor_id: e.item.monthlySponsor?.id || (e.key.startsWith('mspay:') ? e.key.slice(6) : null),
    event_key: e.key, event_date: e.date, stage, channel,
    sent_at: new Date().toISOString(), sent_by: by.id || null, sent_by_name: by.name || null,
    message_preview: 'Marked as sent by hand',
  }, { onConflict: 'event_key,event_date,stage' });
  if (error) return error.code === '42P01' || error.code === 'PGRST205' ? 'Reminder tracking needs database migration 00030.' : error.message;
  notifyDrawerDataChanged();
  return null;
}

/** Undo a reminder marked by mistake. */
export async function clearReminder(id: string): Promise<void> {
  await supabase.from('sponsorship_reminders').delete().eq('id', id);
  notifyDrawerDataChanged();
}

/**
 * Status change from the Upcoming view. An event without a sponsorship
 * record gets one (Requested, or whatever was chosen), like a sent request.
 */
export async function setEventStatus(e: UpcomingEvent, status: string, userId?: string | null): Promise<string | null> {
  if (e.record) {
    const { error } = await supabase.from('sponsorship_requests').update({ status }).eq('id', e.record.id);
    return error ? error.message : null;
  }
  const monthlyId = e.item.monthlySponsor?.id || (e.key.startsWith('mspay:') ? e.key.slice(6) : null);
  const { error } = await supabase.from('sponsorship_requests').insert({
    sponsor_id: e.item.sponsor?.id || null,
    monthly_sponsor_id: e.item.sponsor ? null : monthlyId,
    occasion_id: e.item.occasionRecord?.id || null,
    occasion_name: e.occasion,
    special_date: e.date,
    status,
    category: e.category,
    related_event_id: e.key,
    collector_id: userId || null,
  });
  return error ? error.message : null;
}
