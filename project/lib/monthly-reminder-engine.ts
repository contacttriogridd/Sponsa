import { supabase } from '@/lib/supabase/client';
import { STARS } from '@/lib/natchathiram';
import { addDays } from '@/lib/star-days';
import { loadStarCalendar } from '@/lib/star-calendar-store';
import { formatCurrency } from '@/lib/constants';
import {
  familyStarSubjects, parentIdOf, subjectLabel,
  DEFAULT_STAR_REMINDER_DAYS, formatIstTime, formatStarDate, monthKey, paymentsDue, shiftMonth, todayIst, upcomingStarDays,
} from '@/lib/monthly-sponsors';
import type { MonthlyFamilyMember, MonthlyPayment, MonthlySponsor } from '@/lib/types';

function inDays(n: number): string {
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  return `in ${n} days`;
}

/**
 * Creates Notifications for monthly sponsors' star days and payment due
 * dates, `star_reminder_days` before (default 2) and on the day. Each is
 * recorded in monthly_sponsor_reminders first, so it's created only once.
 */
export async function runMonthlySponsorReminders(currentUserId: string): Promise<number> {
  const today = todayIst();
  const thisMonth = monthKey(today);
  const [{ data: org }, { data: sponsors, error }, { data: payments }] = await Promise.all([
    supabase.from('organization_settings').select('*').limit(1).maybeSingle(),
    supabase.from('monthly_sponsors').select('*').eq('status', 'active'),
    supabase.from('monthly_payments').select('*').in('month', [thisMonth, shiftMonth(thisMonth, 1)]),
  ]);
  if (error || !sponsors?.length) return 0; // table not created yet, or nobody to remind about

  const lead: number = org?.star_reminder_days ?? DEFAULT_STAR_REMINDER_DAYS;
  const remindOn = new Set([lead, 0]);
  const list = sponsors as MonthlySponsor[];
  const { data: members } = await supabase.from('monthly_family_members').select('*');
  const withFamily = [...list, ...familyStarSubjects(list, (members || []) as MonthlyFamilyMember[])];
  const reminders: { sponsorId: string; familyMemberId?: string; kind: 'star_day' | 'payment_due'; target: string; daysBefore: number; title: string; message: string }[] = [];

  const calendar = await loadStarCalendar(addDays(today, -1), addDays(today, lead));
  for (const u of upcomingStarDays(withFamily, calendar, today, lead + 1)) {
    if (!remindOn.has(u.daysUntil)) continue;
    const star = STARS[u.sponsor.star!];
    reminders.push({
      sponsorId: parentIdOf(u.sponsor), familyMemberId: u.sponsor.family_of?.memberId, kind: 'star_day', target: u.occurrence.date, daysBefore: u.daysUntil,
      title: u.sponsor.family_of
        ? `⭐ ${inDays(u.daysUntil) === 'today' ? 'Today is' : `${inDays(u.daysUntil)[0].toUpperCase()}${inDays(u.daysUntil).slice(1)}:`} the star day of ${subjectLabel(u.sponsor)} (${star.ta} ${star.en})`
        : `⭐ ${u.sponsor.name}'s star day (${star.ta} ${star.en}) is ${inDays(u.daysUntil)}`,
      message: `${formatStarDate(u.occurrence.date)} · star from ${formatIstTime(u.occurrence.start)} to ${formatIstTime(u.occurrence.end)}. Send a wish from Monthly Sponsors.`,
    });
  }

  for (const p of paymentsDue(list, (payments || []) as MonthlyPayment[], today, lead)) {
    if (!remindOn.has(p.daysUntil)) continue;
    const amount = p.sponsor.monthly_amount != null ? `${formatCurrency(Number(p.sponsor.monthly_amount))} ` : '';
    reminders.push({
      sponsorId: p.sponsor.id, kind: 'payment_due', target: p.dueDate, daysBefore: p.daysUntil,
      title: `💰 Monthly contribution from ${p.sponsor.name} is due ${inDays(p.daysUntil)}`,
      message: `${amount}due on ${formatStarDate(p.dueDate)}. Mark it paid in Monthly Sponsors once received.`,
    });
  }

  let created = 0;
  for (const r of reminders) {
    const { error: dup } = await supabase.from('monthly_sponsor_reminders').insert({
      monthly_sponsor_id: r.sponsorId, ...(r.familyMemberId ? { family_member_id: r.familyMemberId } : {}), kind: r.kind, target_date: r.target, days_before: r.daysBefore,
    });
    if (dup) continue; // already reminded
    created += 1;
    await supabase.from('notifications').insert({ user_id: currentUserId, type: r.kind, title: r.title, message: r.message });
  }
  return created;
}
