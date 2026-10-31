'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getTodayIST, msUntilNextMidnightIST } from '@/lib/dateHelpers';
import { buildReminderItems, type ReminderItem } from '@/lib/today-reminders';
import { shiftDate } from '@/lib/recurrence';
import type { Donation, FamilyMember, MessageLog, MonthlySponsor, SpecialOccasion, Sponsor, SponsorshipRequest } from '@/lib/types';

export interface ReminderData {
  today: string;
  items: ReminderItem[];
  /** Latest donation per sponsor, for "Send Thanks" on non-donation reminders. */
  latestDonation: Map<string, Donation>;
  done: Set<string>;
  /** Today's sponsor messages by reminder key (newest first). Resets each day via occurrence_date. */
  messagesByKey: Map<string, MessageLog[]>;
  /** Today's summary to the admin, if it went out. */
  summaryLog: MessageLog | null;
}

const LOCAL_DONE_KEY = 'vp_reminders_done';

function localDone(today: string): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(LOCAL_DONE_KEY) || '{}');
    return raw.date === today ? raw.keys || [] : [];
  } catch {
    return [];
  }
}

let cache: { at: number; today: string; promise: Promise<ReminderData> } | null = null;

async function fetchData(today: string): Promise<ReminderData> {
  const [s, o, f, m, d, r, c, l] = await Promise.all([
    supabase.from('sponsors').select('*').eq('status', 'active'),
    supabase.from('special_occasions').select('*').eq('active', true),
    supabase.from('family_members').select('*'),
    supabase.from('monthly_sponsors').select('*').eq('status', 'active'),
    supabase.from('donations').select('*').order('donation_date', { ascending: false }).limit(500),
    supabase.from('sponsorship_requests').select('*').or(`special_date.gte.${shiftDate(today, -7)},recurrence.in.(daily,weekly,monthly,yearly)`),
    supabase.from('reminder_completions').select('item_key').eq('reminder_date', today),
    supabase.from('message_logs').select('*').eq('occurrence_date', today).order('sent_at', { ascending: false }),
  ]);
  // Before migration 00015 there is no recurrence column to filter on.
  const requests = r.error
    ? (await supabase.from('sponsorship_requests').select('*').gte('special_date', shiftDate(today, -7))).data
    : r.data;
  const donations = (d.data || []) as Donation[];
  const latestDonation = new Map<string, Donation>();
  for (const x of donations) if (!latestDonation.has(x.sponsor_id)) latestDonation.set(x.sponsor_id, x);
  const logs = (l.error ? [] : l.data || []) as MessageLog[];
  const messagesByKey = new Map<string, MessageLog[]>();
  for (const x of logs) {
    if (x.recipient !== 'sponsor' || x.status === 'failed') continue;
    const key = x.related_event_id || (x.related_donation_id ? `don:${x.related_donation_id}` : null);
    if (key) messagesByKey.set(key, [...(messagesByKey.get(key) || []), x]);
  }
  return {
    today,
    messagesByKey,
    summaryLog: logs.find((x) => x.message_type === 'admin_daily_summary' && x.status !== 'failed') || null,
    items: buildReminderItems({
      sponsors: (s.data || []) as Sponsor[],
      occasions: (o.data || []) as SpecialOccasion[],
      familyMembers: (f.data || []) as FamilyMember[],
      monthlySponsors: m.error ? [] : (m.data || []) as MonthlySponsor[],
      donations,
      requests: (requests || []) as SponsorshipRequest[],
    }, today),
    latestDonation,
    done: new Set([...(c.error ? [] : (c.data || []).map((x) => x.item_key as string)), ...localDone(today)]),
  };
}

/** Reminder data, shared for a minute between the dashboard and the navbar badge. */
export function loadReminderData(force = false): Promise<ReminderData> {
  const today = getTodayIST();
  if (!force && cache && cache.today === today && Date.now() - cache.at < 55_000) return cache.promise;
  const promise = fetchData(today);
  cache = { at: Date.now(), today, promise };
  promise.catch(() => { cache = null; });
  return promise;
}

/** Saves or clears "Mark as Done"; kept on this device if migration 00014 hasn't run. */
export async function setReminderDone(key: string, today: string, done: boolean, userId?: string): Promise<void> {
  const { error } = done
    ? await supabase.from('reminder_completions').upsert({ item_key: key, reminder_date: today, done_by: userId || null })
    : await supabase.from('reminder_completions').delete().eq('item_key', key).eq('reminder_date', today);
  if (error || !done) {
    try {
      const keys = new Set(localDone(today));
      if (done) keys.add(key); else keys.delete(key);
      window.localStorage.setItem(LOCAL_DONE_KEY, JSON.stringify({ date: today, keys: Array.from(keys) }));
    } catch {
      // Storage unavailable: the state simply isn't remembered.
    }
  }
  cache = null;
}

/**
 * Calls `refresh` every 60 seconds, when the tab becomes visible again, and at
 * midnight IST. Returns today's IST date, which rolls over at midnight.
 */
export function useLiveRefresh(refresh: () => void): string {
  const [today, setToday] = useState(() => getTodayIST());
  const latest = useRef(refresh);
  latest.current = refresh;

  useEffect(() => {
    const run = () => { setToday(getTodayIST()); latest.current(); };
    const interval = setInterval(run, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVisible);
    let timer: ReturnType<typeof setTimeout>;
    const armMidnight = () => {
      timer = setTimeout(() => { run(); armMidnight(); }, msUntilNextMidnightIST() + 1000);
    };
    armMidnight();
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return today;
}
