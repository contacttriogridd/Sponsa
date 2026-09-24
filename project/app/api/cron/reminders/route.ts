import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Sponsor, SpecialOccasion } from '@/lib/types';
import { DEFAULT_INTERVALS, getDueReminders } from '@/lib/due-reminders';
import { isPushConfigured, sendPush, type PushPayload } from '@/lib/push-server';

export const dynamic = 'force-dynamic';

// Above this many reminders in a day, send one summary instead of a burst of notifications.
const MAX_INDIVIDUAL = 3;

/**
 * Daily phone-notification job, triggered by Vercel Cron (see vercel.json,
 * 02:30 UTC = 08:00 IST). Vercel sends `Authorization: Bearer $CRON_SECRET`.
 *
 * It only reads occasions and sends pushes — it does not create `reminders`
 * or `notifications` rows, so the in-app reminder engine (and its automatic
 * WhatsApp wishes) keeps working exactly as before.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey || !isPushConfigured()) {
    return NextResponse.json({ error: 'Push notifications are not configured on the server.' }, { status: 500 });
  }

  // Service role: the job runs with no signed-in user, so it must bypass RLS.
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const [{ data: org }, { data: occasions }, { data: sponsors }, { data: subs }] = await Promise.all([
    supabase.from('organization_settings').select('reminder_intervals').limit(1).maybeSingle(),
    supabase.from('special_occasions').select('*').eq('active', true),
    supabase.from('sponsors').select('*').eq('status', 'active'),
    supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth, app_users!inner(active)').eq('app_users.active', true),
  ]);

  const intervals: number[] = org?.reminder_intervals?.length ? org.reminder_intervals : DEFAULT_INTERVALS;
  // Server clock is UTC; at 02:30 UTC the IST calendar date is the same day.
  const due = getDueReminders((occasions || []) as SpecialOccasion[], (sponsors || []) as Sponsor[], intervals);

  if (!due.length || !subs?.length) {
    return NextResponse.json({ due: due.length, devices: subs?.length || 0, sent: 0 });
  }

  const payloads: PushPayload[] = due.length <= MAX_INDIVIDUAL
    ? due.map((r) => ({
        title: r.title,
        body: r.message,
        url: `/sponsors/${r.sponsor.id}`,
        tag: `occasion-${r.occasion.id}-${r.daysBefore}`,
      }))
    : [{
        title: `${due.length} special occasions coming up`,
        body: due.slice(0, 4).map((r) => r.title).join('\n') + (due.length > 4 ? `\n+${due.length - 4} more` : ''),
        url: '/reminders',
        tag: 'daily-reminders',
      }];

  const result = await sendPush(supabase, subs, payloads);
  return NextResponse.json({ due: due.length, devices: subs.length, ...result });
}
