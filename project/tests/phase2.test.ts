import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACK_TEMPLATE, ackRecipientFrom, buildAckMessage } from '@/lib/acknowledgment';
import { DEFAULT_REQUEST_EN, DEFAULT_REQUEST_TA, buildRequestMessage, requestDueDate, requestValues } from '@/lib/monthly-request';
import { occasionEvent, pickYearlyDate } from '@/lib/recurrence';
import { DEFAULT_OCCASION_TYPES, draftToRow, missingYears, newDraft, validateDraft } from '@/lib/occasion-draft';
import { boardCategoryOf } from '@/lib/dates-board';
import { SPONSORSHIP_STATUSES } from '@/lib/constants';
import { computeStarDay } from '@/lib/star-calendar';
import { starBirthdayDate, tamilMonthDays, tamilMonthOn, thithiAt, thithiMemorialDate } from '@/lib/tamil-calendar';
import { DEFAULT_ORGANIZATION_NAMES as ORG } from '@/lib/organization';

const sql = readFileSync(new URL('../supabase/migrations/20261121130000_00028_requests_acknowledgment_categories.sql', import.meta.url), 'utf8');

test('acknowledgment message for Udhaya Sir', () => {
  const text = buildAckMessage(
    { amount: 5000, donation_date: '2026-11-21', payment_method: 'UPI', receipt_number: 'VPT-2026-00012', sponsor_category: 'Birthday' },
    'Ravi Kumar', 'Priya',
  );
  assert.equal(text, 'Donation received: ₹5,000 from Ravi Kumar (Birthday) on 21 Nov 2026 via UPI. Receipt No: VPT-2026-00012. Recorded by Priya.');
  assert.ok(ACK_TEMPLATE.includes('{{receipt_no}}'));
  assert.equal(buildAckMessage({ amount: 100, donation_date: '2026-11-21', type: 'Food' }, '', '').includes('from Anonymous (Annadhanam)'), true);
});

test('acknowledgment recipient defaults to Udhaya Sir', () => {
  assert.deepEqual(ackRecipientFrom(null), { name: 'Udhaya Sir', whatsapp: '919629522777', email: '' });
  assert.deepEqual(ackRecipientFrom({ ack_name: 'Udhaya', ack_whatsapp: '98765 43210', ack_email: 'u@x.in' }), { name: 'Udhaya', whatsapp: '919876543210', email: 'u@x.in' });
  assert.equal(ackRecipientFrom({ admin_name: 'UDHAYA KUMAR', admin_whatsapp_number: '919629522777' }).name, 'UDHAYA KUMAR');
});

test('monthly request: due date, Tamil month, amount and organization name per language', () => {
  assert.equal(requestDueDate({ payment_day: 31 }, '2027-02-01'), '2027-02-28');
  assert.equal(requestDueDate({ payment_day: null }, '2026-12-01'), '2026-12-01');
  const pay = { upi_id: 'vptrust@upi', bank_details: '', contact_number: '96295 22777' };
  const s = { name: 'Sudhan', monthly_amount: 1000, payment_day: 5 };
  assert.deepEqual(requestValues(s, '2026-12-01', 'en', ORG, pay), {
    sponsor_name: 'Sudhan', organization_name: 'VP TRUST', month: 'December 2026', sponsor_date: '5 Dec 2026',
    amount: '1,000', upi_id: 'vptrust@upi', bank_details: '', contact_number: '96295 22777',
  });
  assert.equal(requestValues(s, '2026-12-01', 'ta', ORG, pay).month, 'டிசம்பர் 2026');
  assert.equal(requestValues(s, '2026-12-01', 'ta', ORG, pay).organization_name, 'வள்ளலார் பசியாற்றும் அறக்கட்டளை');
  const en = buildRequestMessage({ ta: DEFAULT_REQUEST_TA, en: DEFAULT_REQUEST_EN }, s, '2026-12-01', 'en', ORG, pay);
  assert.equal(en, 'Vanakkam Sudhan, greetings from VP TRUST. Your monthly Annadhanam sponsorship for December 2026 is due on 5 Dec 2026. Amount: ₹1,000. UPI: vptrust@upi. Thank you for feeding the hungry with us. – VP TRUST, 96295 22777');
  const both = buildRequestMessage({ ta: '', en: '' }, s, '2026-12-01', 'both', ORG, pay);
  assert.ok(both.startsWith('வணக்கம் Sudhan அவர்களே'));
  assert.ok(both.includes('\n\nVanakkam Sudhan'));
  assert.ok(!/\{\{/.test(both));
});

test('the migration seeds the same request templates the app falls back to', () => {
  assert.ok(sql.includes(DEFAULT_REQUEST_EN));
  assert.ok(sql.includes(DEFAULT_REQUEST_TA));
});

test('sponsorship statuses: the app and the migration agree', () => {
  const check = sql.match(/sponsorship_requests_status_check CHECK \(status IN \(([\s\S]*?)\)\);/)![1];
  const allowed = check.match(/'(\w+)'/g)!.map((x) => x.slice(1, -1)).sort();
  assert.deepEqual([...SPONSORSHIP_STATUSES].sort(), allowed);
  for (const s of ['requested', 'confirmed', 'paid', 'declined', 'no_response']) assert.ok(allowed.includes(s));
});

test('yearly dates: next one from a week ago, else the last', () => {
  const dates = { 2026: '2026-12-05', 2027: '2027-11-24', 2025: '2025-12-16' };
  assert.equal(pickYearlyDate(dates, '2026-11-21'), '2026-12-05');
  assert.equal(pickYearlyDate(dates, '2026-12-10'), '2026-12-05'); // 5 days ago: still shown as Past
  assert.equal(pickYearlyDate(dates, '2026-12-20'), '2027-11-24');
  assert.equal(pickYearlyDate(dates, '2028-01-01'), '2027-11-24');
  assert.equal(pickYearlyDate(null, '2026-11-21'), null);
  const e = occasionEvent({ occasion_date: '2020-01-01', recurring_yearly: true, yearly_dates: dates }, '2026-11-21');
  assert.deepEqual([e.date, e.recurrence], ['2026-12-05', 'none']);
  assert.equal(occasionEvent({ occasion_date: '2020-01-01', recurring_yearly: true }, '2026-11-21').recurrence, 'yearly');
});

test('Star Birthday needs Tamil month, star and at least one date; saved with its yearly dates', () => {
  const type = DEFAULT_OCCASION_TYPES.find((t) => t.key === 'star_birthday');
  const d = newDraft('star_birthday');
  const sponsor = { name: 'Ravi', phone: '9876543210' };
  assert.match(validateDraft(d, type, sponsor)!, /Tamil month/);
  d.tamil_month = 7;
  assert.match(validateDraft(d, type, sponsor)!, /star/);
  d.star = 2;
  assert.match(validateDraft(d, type, sponsor)!, /date/);
  d.yearly_dates = { 2026: '2026-11-24', 2099: '2099-11-20' };
  assert.equal(validateDraft(d, type, sponsor), null);
  const row = draftToRow(d, type, 's1', sponsor);
  assert.equal(row.occasion_type, 'Birthday');
  assert.equal(row.star, 2);
  assert.equal(row.tamil_month, 7);
  assert.deepEqual(row.yearly_dates, d.yearly_dates);
  assert.equal(missingYears({ yearly_dates: { 2026: '2026-11-24' } }, '2026-11-21').join(','), '2027,2028,2029,2030');
});

test('Thithi memorial: Tamil month + thithi instead of an English date', () => {
  const type = DEFAULT_OCCASION_TYPES.find((t) => t.key === 'death_anniversary');
  const d = { ...newDraft('death_anniversary'), relationship: 'Father', person_name: 'Muthusamy', date_mode: 'tamil' as const };
  const sponsor = { name: 'Ravi', phone: '9876543210' };
  assert.match(validateDraft(d, type, sponsor)!, /Tamil month/);
  d.tamil_month = 8; d.thithi = 29; d.yearly_dates = { 2026: '2027-01-07' };
  assert.equal(validateDraft(d, type, sponsor), null);
  const row = draftToRow(d, type, 's1', sponsor);
  assert.deepEqual([row.thithi, row.tamil_month, row.star], [29, 8, null]);
  // English-date memorials are unchanged.
  const plain = { ...newDraft('death_anniversary'), relationship: 'Father', person_name: 'M', occasion_date: '2010-05-04' };
  assert.equal(validateDraft(plain, type, sponsor), null);
  assert.equal('thithi' in draftToRow(plain, type, 's1', sponsor), false);
});

test('dashboard: a Star Birthday occasion is listed under Star Birthday', () => {
  assert.equal(boardCategoryOf({ key: 'occ:1', kind: 'birthday', calm: false, occasionRecord: { occasion_type: 'Birthday', occasion_type_key: 'star_birthday' } as never }), 'star');
});

test('Tamil months start on the known days (Puthandu, Pongal, Margazhi)', () => {
  assert.equal(tamilMonthDays(2026, 0)[0], '2026-04-14');
  assert.equal(tamilMonthDays(2027, 0)[0], '2027-04-14');
  assert.equal(tamilMonthDays(2026, 9)[0], '2026-01-14');
  assert.equal(tamilMonthDays(2026, 8)[0], '2026-12-16');
  assert.equal(tamilMonthOn('2026-11-21'), 7); // Karthigai
});

test('thithi matches the observance CSV (Pournami 24 Nov, Amavasai 8 Dec 2026)', () => {
  assert.equal(thithiAt(new Date('2026-11-24T06:30:00+05:30')), 14);
  assert.equal(thithiAt(new Date('2026-12-08T06:30:00+05:30')), 29);
  const amavasai = thithiMemorialDate(2026, 7, 29).date!; // Karthigai Amavasai
  assert.equal(tamilMonthOn(amavasai), 7);
});

test('star birthday date is in the Tamil month and has that star', () => {
  for (const [month, star] of [[7, 2], [9, 10], [0, 26]] as const) {
    const r = starBirthdayDate(2027, month, star);
    assert.ok(r.date, `month ${month} star ${star}`);
    assert.equal(tamilMonthOn(r.date!), month);
    const day = computeStarDay(r.date!);
    assert.ok(day.star === star || day.extra_star === star);
  }
});
