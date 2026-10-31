import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTodayIST } from '@/lib/dateHelpers';
import { buildDailySummary, messagingSettingsFrom } from '@/lib/messaging';
import { shiftDate } from '@/lib/recurrence';
import { buildReminderItems } from '@/lib/today-reminders';
import { sendWhatsAppText } from '@/lib/whatsapp-server';
import type { Donation, FamilyMember, MonthlySponsor, SpecialOccasion, Sponsor, SponsorshipRequest } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Morning summary to the admin (Vercel Cron, 02:30 UTC = 8:00 AM IST). Sends
 * only in Automatic mode; in Manual mode the dashboard has a button instead.
 * Checks the log first, so a day's summary never goes out twice.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase service role is not configured on the server.' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: org } = await supabase.from('organization_settings').select('*').limit(1).maybeSingle();
  const settings = messagingSettingsFrom(org);
  if (settings.sendMode !== 'automatic' || !settings.dailySummaryEnabled) {
    return NextResponse.json({ skipped: 'Automatic daily summary is off.' });
  }

  const today = getTodayIST();
  const { data: existing } = await supabase.from('message_logs').select('id')
    .eq('message_type', 'admin_daily_summary').eq('occurrence_date', today).in('status', ['opened', 'sent', 'delivered']).limit(1);
  if (existing?.length) return NextResponse.json({ skipped: 'Already sent today.' });

  const [s, o, f, m, d, r] = await Promise.all([
    supabase.from('sponsors').select('*').eq('status', 'active'),
    supabase.from('special_occasions').select('*').eq('active', true),
    supabase.from('family_members').select('*'),
    supabase.from('monthly_sponsors').select('*').eq('status', 'active'),
    supabase.from('donations').select('*').eq('donation_date', today),
    supabase.from('sponsorship_requests').select('*').or(`special_date.gte.${shiftDate(today, -7)},recurrence.in.(daily,weekly,monthly,yearly)`),
  ]);
  const items = buildReminderItems({
    sponsors: (s.data || []) as Sponsor[],
    occasions: (o.data || []) as SpecialOccasion[],
    familyMembers: (f.data || []) as FamilyMember[],
    monthlySponsors: (m.data || []) as MonthlySponsor[],
    donations: (d.data || []) as Donation[],
    requests: (r.data || []) as SponsorshipRequest[],
  }, today);

  const message = buildDailySummary(items, today);
  const result = await sendWhatsAppText(settings.adminNumber, message);
  await supabase.from('message_logs').insert({
    message_type: 'admin_daily_summary',
    type_label: 'Admin Daily Summary',
    occurrence_date: today,
    message_text: message,
    recipient: 'admin',
    recipient_phone: settings.adminNumber,
    channel: 'whatsapp_api',
    status: result.success ? 'sent' : 'failed',
    error_message: result.error || null,
    provider_message_id: result.messageId || null,
    sent_by_name: 'Automatic',
  });
  return NextResponse.json({ sent: result.success, error: result.error });
}
