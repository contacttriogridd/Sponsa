import { supabase } from '@/lib/supabase/client';
import type { MessageTemplate, Sponsor, SpecialOccasion } from '@/lib/types';
import { getNextOccurrence } from '@/lib/date-utils';
import { OCCASION_ICONS } from '@/lib/constants';
import { buildMessageFromTemplate, sendWhatsAppMessage } from '@/lib/whatsapp';

const DEFAULT_INTERVALS = [7, 3, 1, 0];

/** Maps an occasion to the approved template type used to wish the sponsor. */
function templateTypeFor(occasion: SpecialOccasion): string | null {
  if (occasion.occasion_type === 'Birthday') {
    return occasion.family_member_id ? 'Child Birthday' : 'Birthday Wish';
  }
  if (occasion.occasion_type === 'Wedding Anniversary' || occasion.occasion_type === 'Business Anniversary') {
    return 'Anniversary Wish';
  }
  return null;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function reminderLabel(daysBefore: number): string {
  if (daysBefore === 0) return 'is today';
  if (daysBefore === 1) return 'is tomorrow';
  return `is in ${daysBefore} days`;
}

/**
 * Scans active special occasions, and for any whose next occurrence lands on
 * one of the organization's configured reminder intervals (7/3/1/0 days by
 * default) as of today, creates a `reminders` row (deduplicated in the DB by
 * occasion + occurrence year + interval) and, only for newly-created
 * reminders, a matching `notifications` row so the collector sees it once.
 */
export async function runReminderEngine(currentUserId: string): Promise<{ created: number }> {
  const [{ data: org }, { data: occasions }, { data: sponsors }, { data: templates }] = await Promise.all([
    supabase.from('organization_settings').select('name, reminder_intervals, whatsapp_enabled').limit(1).maybeSingle(),
    supabase.from('special_occasions').select('*').eq('active', true),
    supabase.from('sponsors').select('*').eq('status', 'active'),
    supabase.from('message_templates').select('*').eq('is_approved', true),
  ]);

  const intervals: number[] = org?.reminder_intervals?.length ? org.reminder_intervals : DEFAULT_INTERVALS;
  const organizationName = org?.name || 'Sponsa';
  const sponsorMap = new Map((sponsors || []).map((s: Sponsor) => [s.id, s]));
  const templateByType = new Map((templates || []).map((t: MessageTemplate) => [t.type, t]));
  const today = new Date();
  const todayKey = toDateKey(today);

  let created = 0;

  for (const occasion of (occasions || []) as SpecialOccasion[]) {
    const sponsor = sponsorMap.get(occasion.sponsor_id);
    if (!sponsor) continue;

    const next = getNextOccurrence(occasion.occasion_date, occasion.recurring_yearly, today);
    if (!next) continue;

    for (const daysBefore of intervals) {
      const reminderDate = new Date(next.date);
      reminderDate.setDate(reminderDate.getDate() - daysBefore);
      if (toDateKey(reminderDate) !== todayKey) continue;

      const { error: insertError } = await supabase.from('reminders').insert({
        occasion_id: occasion.id,
        sponsor_id: sponsor.id,
        reminder_date: todayKey,
        occurrence_year: next.occurrenceYear,
        days_before: daysBefore,
        status: 'pending',
      });

      if (insertError) continue; // already exists for this occasion/year/interval

      created += 1;
      const icon = OCCASION_ICONS[occasion.occasion_type] || '⭐';
      await supabase.from('notifications').insert({
        user_id: currentUserId,
        type: 'occasion_reminder',
        title: `${icon} ${occasion.person_name}'s ${occasion.occasion_type} ${reminderLabel(daysBefore)}`,
        message: `${sponsor.full_name} — consider reaching out about a food sponsorship.`,
        sponsor_id: sponsor.id,
        occasion_id: occasion.id,
      });

      // On the day itself, send the approved wish automatically if the
      // sponsor has WhatsApp + consent and the API is configured — falls
      // back to a draft message otherwise (handled inside sendWhatsAppMessage).
      if (daysBefore === 0) {
        const templateType = templateTypeFor(occasion);
        const template = templateType ? templateByType.get(templateType) : null;
        if (org?.whatsapp_enabled && template && sponsor.whatsapp && sponsor.whatsapp_consent) {
          const body = buildMessageFromTemplate(template, {
            sponsor_name: sponsor.preferred_name || sponsor.full_name,
            person_name: occasion.person_name,
            organization_name: organizationName,
          });
          await sendWhatsAppMessage(sponsor, body, template.id, currentUserId);
        }
      }
    }
  }

  return { created };
}

const RUN_KEY = 'sponsorcare_reminder_engine_last_run';

/** Runs the reminder engine at most once per calendar day per browser. */
export async function runReminderEngineOncePerDay(currentUserId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const todayKey = toDateKey(new Date());
  try {
    if (window.localStorage.getItem(RUN_KEY) === todayKey) return;
    await runReminderEngine(currentUserId);
    window.localStorage.setItem(RUN_KEY, todayKey);
  } catch {
    // Non-critical background task; a failed run will simply retry on next load.
  }
}
