import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AMOUNT_NOT_SET, amountLabel, dropMissingAmounts, hasAmount, parseOptionalAmount } from '@/lib/amount';
import { buildRequestMessage } from '@/lib/monthly-request';
import { renderTemplate } from '@/lib/templates';
import { DEFAULT_ORGANIZATION_NAMES as ORG } from '@/lib/organization';
import { buildReminderItems, type ReminderSources } from '@/lib/today-reminders';
import { GROUPS, remindersPendingToday, remindersSentByEvent, slotsFor, upcomingEvents, type ReminderRow } from '@/lib/upcoming-sponsorships';

const TODAY = '2026-11-23';

test('optional amount: NULL is "Amount not set", never ₹0', () => {
  assert.equal(amountLabel(null), 'Amount not set / தொகை குறிப்பிடப்படவில்லை');
  assert.equal(amountLabel(undefined), AMOUNT_NOT_SET);
  assert.equal(amountLabel(''), AMOUNT_NOT_SET);
  assert.equal(amountLabel(5000), '₹5,000');
  assert.equal(amountLabel('100000.00'), '₹1,00,000');
  assert.deepEqual([hasAmount(null), hasAmount(''), hasAmount(0), hasAmount('750')], [false, false, true, true]);
  assert.deepEqual(parseOptionalAmount(''), { value: null, error: null }, 'empty saves as NULL');
  assert.deepEqual(parseOptionalAmount(' 1500 '), { value: 1500, error: null });
  assert.match(parseOptionalAmount('0').error!, /greater than 0/);
  assert.match(parseOptionalAmount('-5').error!, /greater than 0/);
  assert.match(parseOptionalAmount('abc').error!, /greater than 0/);
});

// The Phase 2 texts: an admin-edited template using the older placeholders still fills correctly.
const LEGACY = { en: 'Vanakkam {{sponsor_name}}, greetings from {{organization_name}}. Your monthly Annadhanam sponsorship for {{month}} is due on {{sponsor_date}}. Amount: ₹{{amount}}. UPI: {{upi_id}}. Thank you for feeding the hungry with us. – {{organization_name}}, {{contact_number}}', ta: 'வணக்கம் {{sponsor_name}} அவர்களே, {{organization_name}} சார்பாக அன்பான வணக்கங்கள். {{month}} மாதத்திற்கான உங்கள் மாதாந்திர அன்னதான நன்கொடை {{sponsor_date}} அன்று செலுத்த வேண்டியது. தொகை: ₹{{amount}}. UPI: {{upi_id}}. பசித்தவர்களுக்கு உணவளிக்கும் எங்கள் சேவையில் இணைந்திருப்பதற்கு நன்றி. – {{organization_name}}, {{contact_number}}' };

test('a template with no amount leaves the amount sentence out — no "₹", "₹null" or "₹undefined"', () => {
  const pay = { upi_id: 'vptrust@upi', bank_details: '', contact_number: '96295 22777' };
  const s = { name: 'Sudhan', monthly_amount: null, payment_day: 5 };
  const en = buildRequestMessage(LEGACY, s, '2026-12-01', 'en', ORG, pay);
  assert.equal(en, 'Vanakkam Sudhan, greetings from VP TRUST. Your monthly Annadhanam sponsorship for December 2026 is due on 5 Dec 2026. UPI: vptrust@upi. Thank you for feeding the hungry with us. – VP TRUST, 96295 22777');
  const ta = buildRequestMessage(LEGACY, s, '2026-12-01', 'ta', ORG, pay);
  assert.ok(!ta.includes('தொகை') && !ta.includes('₹'), ta);
  for (const text of [en, ta]) assert.ok(!/₹\s*(null|undefined|0)?[.\s]|\{\{/.test(text), text);
  // With an amount, nothing is dropped.
  assert.ok(buildRequestMessage(LEGACY, { ...s, monthly_amount: 1000 }, '2026-12-01', 'en', ORG, pay).includes('Amount: ₹1,000.'));
  // A line that is only the amount goes away; other lines stay.
  assert.equal(dropMissingAmounts('Dear {{name}},\nAmount: ₹{{amount}}\nThank you', { amount: '' }), 'Dear {{name}},\nThank you');
  // Star-day templates: {{monthly_amount}} given as empty drops its sentence; in a preview (not given) it stays.
  assert.equal(renderTemplate('Thanks. You give {{monthly_amount}} monthly. Bye.', { monthly_amount: '' }, ORG), 'Thanks. Bye.');
  assert.equal(renderTemplate('You give {{monthly_amount}}.', {}, ORG), 'You give {{monthly_amount}}.');
});

// ---------------------------------------------------------------- upcoming events
const sponsor = (id: string, name: string, over: Record<string, unknown> = {}) => ({ id, full_name: name, status: 'active', phone: '9876543210', whatsapp: null, dob: null, sponsorship_amount: null, ...over });
const occ = (id: string, sponsorId: string, over: Record<string, unknown>) => ({ id, sponsor_id: sponsorId, active: true, recurring_yearly: true, family_member_id: null, relationship: 'Self', ...over });
const src = {
  sponsors: [
    sponsor('s1', 'Arun', { dob: '1990-11-23' }), // birthday today
    sponsor('s2', 'Bala', { sponsorship_amount: 5000 }),
    sponsor('s3', 'Sadhana N'),
    sponsor('s4', 'Chitra'),
  ],
  occasions: [
    occ('o2', 's2', { person_name: 'Bala', occasion_type: 'Birthday', occasion_type_key: 'self_birthday', occasion_date: '1985-11-24' }), // tomorrow
    occ('o3', 's3', { person_name: 'Sadhana N', occasion_type: 'Wedding Anniversary', occasion_type_key: 'wedding_anniversary', occasion_date: '2010-11-25' }), // in 2 days
    occ('o4', 's4', { person_name: 'Chitra', occasion_type: 'Birthday', occasion_type_key: 'star_birthday', occasion_date: '2026-11-24', yearly_dates: { 2026: '2026-11-24', 2027: '2027-12-12' } }), // star birthday tomorrow
    occ('o5', 's4', { person_name: 'Chitra', occasion_type: 'Birthday', occasion_type_key: 'self_birthday', occasion_date: '1980-12-20' }), // not in 3 days
  ],
  familyMembers: [],
  monthlySponsors: [{ id: 'm1', name: 'B. Sudhan', status: 'active', payment_day: 26, start_date: '2026-01-01', monthly_amount: null, phone: '9123456789', dob: null, sponsor_id: null }], // in 3 days
  donations: [],
  requests: [],
} as unknown as ReminderSources;
const items = buildReminderItems(src, TODAY);
const requests = [
  { id: 'r3', sponsor_id: 's3', occasion_id: 'o3', special_date: '2026-11-25', status: 'completed', requested_amount: null, food_type: 'Breakfast', people_count: 100, category: 'Wedding Anniversary' },
  { id: 'r2', sponsor_id: 's2', occasion_id: 'o2', special_date: '2026-11-24', status: 'confirmed', requested_amount: 2500, food_type: null, people_count: null },
] as never;

test('every event in the next 3 days is listed, in the right group, requested or not', () => {
  const events = upcomingEvents(items, requests, [], TODAY);
  assert.deepEqual(events.map((e) => [e.days, e.name, e.category, e.status]), [
    [0, 'Arun', 'Birthday', 'not_requested'],
    [1, 'Bala', 'Birthday', 'confirmed'],
    [1, 'Chitra', 'Star Birthday', 'not_requested'],
    [2, 'Sadhana N', 'Wedding Anniversary', 'completed'],
    [3, 'B. Sudhan', 'Monthly', 'not_requested'],
  ]);
  assert.deepEqual(GROUPS.map((g) => g.en), ['Today', '1 day before / Tomorrow', '2 days before', '3 days before']);
  const sadhana = events.find((e) => e.name === 'Sadhana N')!;
  assert.deepEqual([sadhana.foodType, sadhana.people, sadhana.amount], ['Breakfast', 100, null], 'Completed record still shown, amount not set');
  assert.equal(events.find((e) => e.name === 'Bala')!.amount, 2500, 'requested amount wins');
  assert.equal(events.find((e) => e.name === 'B. Sudhan')!.date, '2026-11-26');
  assert.equal(events.find((e) => e.name === 'Chitra')!.date, '2026-11-24', 'Star Birthday uses this year\'s date');
});

test('reminder chips: sent with time, missed, due today, pending', () => {
  const reminders: ReminderRow[] = [{ id: 'x', event_key: 'occ:o3', event_date: '2026-11-25', stage: 'D-3', sent_at: '2026-11-22T04:45:00Z', channel: 'whatsapp' }];
  const slots = slotsFor('occ:o3', '2026-11-25', reminders, TODAY);
  assert.deepEqual(slots.map((s) => [s.stage, s.due, s.state]), [['D-3', '2026-11-22', 'sent'], ['D-2', '2026-11-23', 'due'], ['D-1', '2026-11-24', 'pending']]);
  const missed = slotsFor('occ:o3', '2026-11-25', [], TODAY)[0];
  assert.equal(missed.state, 'missed');
});

test('Reminder pending: today\'s stage not sent; sending it clears the event, status unchanged', () => {
  const before = upcomingEvents(items, requests, [], TODAY);
  assert.deepEqual(remindersPendingToday(before).map((e) => [e.name, e.days]), [['Bala', 1], ['Chitra', 1], ['Sadhana N', 2], ['B. Sudhan', 3]]);
  const sent: ReminderRow[] = [{ id: 'y', event_key: 'occ:o2', event_date: '2026-11-24', stage: 'D-1', sent_at: '2026-11-23T05:00:00Z', channel: 'whatsapp' }];
  const after = upcomingEvents(items, requests, sent, TODAY);
  assert.ok(!remindersPendingToday(after).some((e) => e.name === 'Bala'));
  assert.equal(after.find((e) => e.name === 'Bala')!.status, 'confirmed', 'a reminder never changes the status');
  assert.deepEqual(remindersSentByEvent(sent).map((g) => [g.key, g.date, g.rows.length]), [['occ:o2', '2026-11-24', 1]]);
});

test('migration 00030: stage from days left, no status change on resend, undo removes the reminder', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261123120000_00030_sponsorship_reminders.sql', import.meta.url), 'utf8');
  assert.ok(sql.includes("'D-' || days"));
  assert.ok(sql.includes('days NOT BETWEEN 1 AND 3'));
  assert.ok(sql.includes("UNIQUE (event_key, event_date, stage)"));
  assert.ok(sql.includes('DELETE FROM sponsorship_reminders WHERE source_log_id = OLD.id'));
  const requestFn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION message_log_to_request()'));
  assert.ok(requestFn.includes('UPDATE sponsorship_requests SET request_sent_at = NEW.sent_at, channel = NEW.channel WHERE id = existing'));
  assert.ok(!/UPDATE sponsorship_requests SET[^;]*status/.test(requestFn), 'resend does not touch status');
  assert.ok(sql.includes("ALTER TABLE sponsors ALTER COLUMN sponsorship_amount DROP NOT NULL"));
});
