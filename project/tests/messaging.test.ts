import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdminNotification, buildDailySummary, formatSentAt, formatTimeIST, isSummaryOverdue, messagingSettingsFrom, thanksStatus, wishMessageType,
} from '@/lib/messaging';
import { normalizeIndianNumber, whatsappNumber } from '@/lib/phone';
import { buildReminderItems, type ReminderSources } from '@/lib/today-reminders';
import type { MessageLog } from '@/lib/types';

test('admin number is validated and normalised to 91XXXXXXXXXX', () => {
  assert.equal(normalizeIndianNumber('96295 22777'), '919629522777');
  assert.equal(normalizeIndianNumber('+91 96295 22777'), '919629522777');
  assert.equal(normalizeIndianNumber('096295 22777'), '919629522777');
  assert.equal(normalizeIndianNumber('12345'), null);
  assert.equal(normalizeIndianNumber('1234567890'), null);
  assert.equal(whatsappNumber('0091 96295 22777'), '919629522777');
});

test('settings default to UDHAYA KUMAR, notify on, manual mode', () => {
  const s = messagingSettingsFrom(null);
  assert.deepEqual([s.adminNumber, s.adminName, s.notifyAdminDefault, s.sendMode, s.dailySummaryTime], ['919629522777', 'UDHAYA KUMAR', true, 'manual', '08:00']);
  assert.equal(messagingSettingsFrom({ notify_admin_default: false, whatsapp_send_mode: 'automatic' }).notifyAdminDefault, false);
  assert.equal(messagingSettingsFrom({ whatsapp_send_mode: 'automatic' }).sendMode, 'automatic');
});

test('times are shown in IST', () => {
  assert.equal(formatTimeIST('2026-10-31T06:00:00Z'), '11:30 AM');
  assert.equal(formatSentAt('2026-10-31T06:00:00Z'), '31 Oct 2026, 11:30 AM');
  assert.equal(formatTimeIST('2026-10-30T18:45:00Z'), '12:15 AM');
});

test('admin notification has every field and survives URL encoding', () => {
  const text = buildAdminNotification({
    sponsorName: 'Dakshinesh S', sponsorPhone: '96295 22777', typeLabel: 'Birthday Wish', occurrenceDate: '2026-10-31',
    message: 'அன்புள்ள Dakshinesh S', employee: 'Staff One', sentAt: new Date('2026-10-31T06:00:00Z'),
  });
  assert.equal(text, [
    '🔔 *VP TRUST – Message Sent*', '👤 Sponsor: Dakshinesh S', '📞 Number: 96295 22777', '🎉 Type: Birthday Wish',
    '📅 Date: 31 Oct 2026', '💬 Message: அன்புள்ள Dakshinesh S', '🧑‍💼 Sent by: Staff One at 11:30 AM',
  ].join('\n'));
  assert.equal(decodeURIComponent(encodeURIComponent(text)), text);
});

test('long messages are shortened in the admin notification', () => {
  const text = buildAdminNotification({
    sponsorName: 'A', sponsorPhone: null, typeLabel: 'T', occurrenceDate: '2026-10-31', message: 'x'.repeat(500), employee: 'E', sentAt: new Date(),
  });
  assert.ok(text.includes('x'.repeat(200) + '…') && !text.includes('x'.repeat(201)));
  assert.ok(text.includes('Not saved'));
});

test('daily summary lists birthdays, anniversaries and recurring donation days', () => {
  const sponsor = (id: string, full_name: string, dob: string | null = null) => ({ id, full_name, dob, phone: '9629522777', whatsapp: null, status: 'active' });
  const sources = {
    sponsors: [sponsor('a', 'Birthday Person', '1990-10-31'), sponsor('b', 'Married Person')],
    occasions: [{ id: 'o', sponsor_id: 'b', family_member_id: null, person_name: 'Married Person', relationship: 'Self', occasion_type: 'Wedding Anniversary', occasion_date: '2010-10-31', recurring_yearly: true, active: true }],
    familyMembers: [],
    monthlySponsors: [{ id: 'm', name: 'Monthly Giver', dob: null, status: 'active', phone: '9000000000', sponsor_id: null, payment_day: 31, start_date: null }],
    donations: [],
    requests: [],
  } as unknown as ReminderSources;
  const text = buildDailySummary(buildReminderItems(sources, '2026-10-31'), '2026-10-31');
  assert.ok(text.startsWith("🌅 *VP TRUST – Today's Reminders (31 Oct 2026)*"));
  assert.ok(text.includes('Birthday Person – 9629522777 – 🎂 Birthday'));
  assert.ok(/Married Person – 9629522777 – 💍/.test(text));
  assert.ok(text.includes('Monthly Giver – 9000000000 – 🍛 Donation Day (Monthly)'));
  assert.ok(text.endsWith('Total: 3 reminders'));
  assert.equal(buildDailySummary([], '2026-10-31'), "🌅 *VP TRUST – Today's Reminders (31 Oct 2026)*\nNo sponsor events today 🙏");
});

const log = (extra: Partial<MessageLog>) => ({
  id: 'l', message_type: 'donation_thanks', related_donation_id: 'd', status: 'sent', sent_at: '2026-10-31T06:00:00Z', sent_by_name: 'Staff One', ...extra,
}) as MessageLog;

test('thanks status comes from the log, with the older columns as a fallback', () => {
  const d = { id: 'd', thank_you_sent: false, thank_you_sent_at: null };
  assert.equal(thanksStatus(d, []).sent, false);
  assert.deepEqual(thanksStatus(d, [log({})]), { sent: true, awaitingConfirm: false, at: '2026-10-31T06:00:00Z', by: 'Staff One' });
  assert.deepEqual(thanksStatus(d, [log({ status: 'opened' })]), { sent: false, awaitingConfirm: true, at: null, by: null });
  assert.equal(thanksStatus(d, [log({ status: 'failed' })]).sent, false);
  assert.equal(thanksStatus(d, [log({ related_donation_id: 'other' })]).sent, false);
  assert.equal(thanksStatus({ ...d, thank_you_sent: true, thank_you_sent_at: '2026-10-01T00:00:00Z' }, []).sent, true);
});

test('wish message types', () => {
  assert.equal(wishMessageType('Birthday'), 'birthday_wish');
  assert.equal(wishMessageType('Wedding Anniversary'), 'anniversary_wish');
  assert.equal(wishMessageType('Death Anniversary'), 'event_wish');
  assert.equal(wishMessageType('Other'), 'event_wish');
});

test('summary reminder appears an hour after its time, unless already sent', () => {
  const s = messagingSettingsFrom(null);
  assert.equal(isSummaryOverdue(s, false, new Date('2026-10-31T03:29:00Z')), false); // 8:59 AM IST
  assert.equal(isSummaryOverdue(s, false, new Date('2026-10-31T03:30:00Z')), true); // 9:00 AM IST
  assert.equal(isSummaryOverdue(s, true, new Date('2026-10-31T03:30:00Z')), false);
});
