import { normalizeDonationType } from '@/lib/constants';
import type { ReminderItem } from '@/lib/today-reminders';
import type { Donation, MessageLog, MessageType } from '@/lib/types';

// Pure (no Supabase): settings, wording and status rules shared by the app and cron job.

export type SendMode = 'manual' | 'automatic';

export interface MessagingSettings {
  adminNumber: string;
  adminName: string;
  notifyAdminDefault: boolean;
  dailySummaryEnabled: boolean;
  /** HH:MM in IST. */
  dailySummaryTime: string;
  sendMode: SendMode;
}

export const DEFAULT_ADMIN_NUMBER = '919629522777';
export const DEFAULT_ADMIN_NAME = 'UDHAYA KUMAR';

export function messagingSettingsFrom(row: Record<string, unknown> | null | undefined): MessagingSettings {
  return {
    adminNumber: (row?.admin_whatsapp_number as string) || DEFAULT_ADMIN_NUMBER,
    adminName: (row?.admin_name as string) || DEFAULT_ADMIN_NAME,
    notifyAdminDefault: (row?.notify_admin_default as boolean | undefined) ?? true,
    dailySummaryEnabled: (row?.daily_summary_enabled as boolean | undefined) ?? true,
    dailySummaryTime: (row?.daily_summary_time as string) || '08:00',
    sendMode: row?.whatsapp_send_mode === 'automatic' ? 'automatic' : 'manual',
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IST_OFFSET_MS = 330 * 60 * 1000;

/** "31 Oct 2026" from YYYY-MM-DD. */
export function formatDateLabel(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : date;
}

/** "11:30 AM" in IST. */
export function formatTimeIST(at: string | Date): string {
  const d = new Date(new Date(at).getTime() + IST_OFFSET_MS);
  const hours = d.getUTCHours();
  return `${hours % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** "31 Oct 2026, 11:30 AM" in IST. */
export function formatSentAt(at: string | Date): string {
  const d = new Date(new Date(at).getTime() + IST_OFFSET_MS);
  return `${formatDateLabel(d.toISOString().slice(0, 10))}, ${formatTimeIST(at)}`;
}

export const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  birthday_wish: 'Birthday Wish',
  anniversary_wish: 'Anniversary Wish',
  event_wish: 'Event Wish',
  donation_thanks: 'Donation Thanks',
  admin_notification: 'Admin Notification',
  admin_daily_summary: 'Admin Daily Summary',
};

export const CHANNEL_LABELS: Record<MessageLog['channel'], string> = {
  whatsapp_link: 'WhatsApp',
  whatsapp_api: 'WhatsApp (automatic)',
  sms: 'SMS',
  email: 'Email',
  copy: 'Copy',
};

/** Message type for a wish about an occasion. */
export function wishMessageType(occasionType: string | null | undefined): MessageType {
  if (occasionType === 'Birthday') return 'birthday_wish';
  if (occasionType && /Anniversary/.test(occasionType) && occasionType !== 'Death Anniversary') return 'anniversary_wish';
  return 'event_wish';
}

export function buildAdminNotification(input: {
  sponsorName: string; sponsorPhone: string | null; typeLabel: string; occurrenceDate: string;
  message: string; employee: string; sentAt: Date;
  /** For an occasion: e.g. "Arun's Birthday (Son of Ravi Kumar)" and who received it. */
  occasion?: string | null; contactName?: string | null;
}): string {
  const preview = input.message.length > 200 ? `${input.message.slice(0, 200).trimEnd()}…` : input.message;
  return [
    '🔔 *VP TRUST – Message Sent*',
    `👤 Sponsor: ${input.sponsorName}`,
    ...(input.contactName && input.contactName !== input.sponsorName ? [`🙋 Contact: ${input.contactName}`] : []),
    `📞 Number: ${input.sponsorPhone || 'Not saved'}`,
    `🎉 Type: ${input.typeLabel}`,
    ...(input.occasion ? [`🗓️ Occasion: ${input.occasion}`] : []),
    `📅 Date: ${formatDateLabel(input.occurrenceDate)}`,
    `💬 Message: ${preview}`,
    `🧑‍💼 Sent by: ${input.employee} at ${formatTimeIST(input.sentAt)}`,
  ].join('\n');
}

function summaryLine(item: ReminderItem, index: number): string {
  let label: string;
  const own = item.kind === 'birthday' && item.personName === item.name;
  if (item.kind === 'birthday') label = own ? '🎂 Birthday' : `🎂 ${item.occasion}`;
  else if (item.calm) label = `🪔 ${item.occasion}`;
  else if (/anniversary/i.test(item.occasion)) label = `💍 ${item.occasion}`;
  else if (item.kind === 'donation' || item.key.startsWith('mspay:') || item.key.startsWith('req:')) {
    const details = [item.donationType ? normalizeDonationType(item.donationType) : null, item.key.startsWith('mspay:') ? 'Monthly' : null].filter(Boolean);
    label = `🍛 Donation Day${details.length ? ` (${details.join(', ')})` : ''}`;
  } else label = `📅 ${item.occasion}`;
  return `${index + 1}. ${item.contactName || item.name} – ${item.phone || 'No number'} – ${label}`;
}

/** The morning list of today's reminders for the admin. */
export function buildDailySummary(items: ReminderItem[], today: string): string {
  const todayItems = items.filter((i) => i.group === 'today');
  const title = `🌅 *VP TRUST – Today's Reminders (${formatDateLabel(today)})*`;
  if (todayItems.length === 0) return `${title}\nNo sponsor events today 🙏`;
  return [title, ...todayItems.map(summaryLine), `Total: ${todayItems.length} reminders`].join('\n');
}

export interface ThanksStatus {
  sent: boolean;
  /** WhatsApp was opened but nobody has confirmed the message went. */
  awaitingConfirm: boolean;
  at: string | null;
  by: string | null;
}

/** A donation's thanks status: from the message log, else the older thank_you_* columns. */
export function thanksStatus(donation: Pick<Donation, 'id' | 'thank_you_sent' | 'thank_you_sent_at'>, logs: MessageLog[]): ThanksStatus {
  const own = logs.filter((l) => l.message_type === 'donation_thanks' && l.related_donation_id === donation.id);
  const sent = own.filter((l) => l.status === 'sent' || l.status === 'delivered')
    .sort((a, b) => b.sent_at.localeCompare(a.sent_at))[0];
  if (sent) return { sent: true, awaitingConfirm: false, at: sent.sent_at, by: sent.sent_by_name };
  if (own.some((l) => l.status === 'opened')) return { sent: false, awaitingConfirm: true, at: null, by: null };
  if (donation.thank_you_sent) return { sent: true, awaitingConfirm: false, at: donation.thank_you_sent_at || null, by: null };
  return { sent: false, awaitingConfirm: false, at: null, by: null };
}

/** True when the summary is overdue: an hour past its time and not yet sent. */
export function isSummaryOverdue(settings: MessagingSettings, sentAlready: boolean, now: Date = new Date()): boolean {
  if (!settings.dailySummaryEnabled || sentAlready) return false;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const [h, m] = settings.dailySummaryTime.split(':').map(Number);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes() >= (h || 0) * 60 + (m || 0) + 60;
}
