import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_REQUEST, buildRequestMessage, monthName, requestAmount } from '@/lib/monthly-request';
import { inRequestWindow, invalidPhoneRows, requestCounts, requestStatuses, sendAllQueue, type MonthlyRequestRow } from '@/lib/monthly-requests';
import { DEFAULT_ORGANIZATION_NAMES as ORG } from '@/lib/organization';
import { BOTH_DIVIDER } from '@/lib/thank-you';

const NL = String.fromCharCode(10);
const lines = (...l: string[]) => l.join(NL);
const PAY = { payment_details: 'UPI: vptrust@upi' };
const SATHISH = { name: 'Sathish', monthly_amount: 1100, payment_day: 5 };
const DEC = '2026-12-01';

const TA_FULL = lines(
  '🙏 மக்கள் சேவையே மகேசன் சேவை',
  'மதிப்பிற்குரிய Sathish அவர்களுக்கு வணக்கம்,',
  '',
  'வள்ளலார் பசியாற்றும் அறக்கட்டளை சார்பாக உங்களின் தொடர்ந்த ஆதரவிற்கு எங்கள் மனமார்ந்த நன்றி. வள்ளலார் காட்டிய வழியில் பசித்தவர்களுக்கு உணவளிக்கும் எங்கள் சேவை, உங்களைப் போன்ற அன்புள்ளங்களின் உதவியால் தொடர்ந்து நடைபெற்று வருகிறது.',
  '',
  'இந்த டிசம்பர் 2026 மாதத்திற்கான உங்களின் மாதாந்திர நன்கொடை ₹1,100 வழங்கி, எங்கள் அன்னதான சேவையைத் தொடர உதவுமாறு அன்புடன் கேட்டுக்கொள்கிறோம்.',
  '',
  'நன்கொடை அனுப்ப: UPI: vptrust@upi',
  '',
  'நன்றியுடன்,',
  'வள்ளலார் பசியாற்றும் அறக்கட்டளை',
);
const EN_FULL = lines(
  '🙏 Vanakkam Sathish,',
  '',
  'On behalf of VP TRUST, thank you for your continued support. Our service of feeding the hungry, in the path shown by Vallalar, goes on every day because of kind hearts like yours.',
  '',
  'We humbly request your monthly contribution of ₹1,100 for December 2026 to help us continue our Annadhanam service.',
  '',
  'To donate: UPI: vptrust@upi',
  '',
  'With heartfelt gratitude,',
  'VP TRUST',
);

test('Tamil, English and Both, filled exactly', () => {
  assert.equal(buildRequestMessage(DEFAULT_REQUEST, SATHISH, DEC, 'ta', ORG, PAY), TA_FULL);
  assert.equal(buildRequestMessage(DEFAULT_REQUEST, SATHISH, DEC, 'en', ORG, PAY), EN_FULL);
  assert.equal(buildRequestMessage(DEFAULT_REQUEST, SATHISH, DEC, 'both', ORG, PAY), [TA_FULL, BOTH_DIVIDER, EN_FULL].join(NL + NL));
  // Empty saved templates fall back to the defaults.
  assert.equal(buildRequestMessage({ ta: '', en: ' ' }, SATHISH, DEC, 'en', ORG, PAY), EN_FULL);
});

test('no amount set: Tamil drops " {{amount}}", English says "your monthly contribution for"', () => {
  const s = { ...SATHISH, monthly_amount: null };
  const ta = buildRequestMessage(DEFAULT_REQUEST, s, DEC, 'ta', ORG, PAY);
  assert.ok(ta.includes('…'.slice(1) + 'உங்களின் மாதாந்திர நன்கொடை வழங்கி, எங்கள்'), ta);
  const en = buildRequestMessage(DEFAULT_REQUEST, s, DEC, 'en', ORG, PAY);
  assert.ok(en.includes('We humbly request your monthly contribution for December 2026 to help us'), en);
  for (const t of [ta, en]) assert.ok(!/₹|\{\{|null|undefined/.test(t), t);
});

test('no payment details: the "நன்கொடை அனுப்ப / To donate" line goes, with no gap left behind', () => {
  const ta = buildRequestMessage(DEFAULT_REQUEST, SATHISH, DEC, 'ta', ORG, { payment_details: '' });
  const en = buildRequestMessage(DEFAULT_REQUEST, SATHISH, DEC, 'en', ORG, {});
  assert.ok(!ta.includes('நன்கொடை அனுப்ப') && !en.includes('To donate'));
  assert.ok(en.includes(`Annadhanam service.${NL}${NL}With heartfelt gratitude,`), en);
  for (const t of [ta, en]) assert.ok(!t.includes(NL + NL + NL) && !/\{\{/.test(t), t);
  // Multi-line payment details stay as typed.
  const multi = buildRequestMessage(DEFAULT_REQUEST, SATHISH, DEC, 'en', ORG, { payment_details: `UPI: vptrust@upi${NL}A/c: 123 · IFSC: ABCD0123` });
  assert.ok(multi.includes(`To donate: UPI: vptrust@upi${NL}A/c: 123 · IFSC: ABCD0123`));
});

test('month names and the ₹ amount', () => {
  assert.deepEqual([monthName(DEC, 'ta'), monthName(DEC, 'en'), monthName('2027-01-01', 'ta'), monthName('2027-08-01', 'ta')], ['டிசம்பர் 2026', 'December 2026', 'ஜனவரி 2027', 'ஆகஸ்ட் 2027']);
  assert.deepEqual([requestAmount(1100), requestAmount('100000'), requestAmount(null), requestAmount('')], ['₹1,100', '₹1,00,000', '', '']);
});

test('sending window: the 1st to the 3rd (IST)', () => {
  assert.deepEqual(['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-11-30'].map(inRequestWindow), [true, true, true, false, false]);
});

const sponsor = (id: string, over: Record<string, unknown> = {}) => ({ id, name: id, phone: '9876543210', monthly_amount: 1000, payment_day: 5, status: 'active', start_date: '2026-01-01', ...over });
const req = (id: string, status: 'opened' | 'sent'): MonthlyRequestRow => ({ id: `r-${id}`, monthly_sponsor_id: id, year: 2026, month: 12, status });

test('statuses: active sponsors only; Already donated; one request per sponsor per month', () => {
  const sponsors = [
    sponsor('Arun'), sponsor('Bala'), sponsor('Chitra'), sponsor('Devi'),
    sponsor('Paused', { status: 'paused' }), sponsor('Stopped', { status: 'stopped' }), sponsor('Deleted', { deleted_at: '2026-11-01' }),
    sponsor('Later', { start_date: '2027-01-01' }), sponsor('NoStar', { star: null, sponsor_events: null }),
    sponsor('BadPhone', { phone: '12345' }),
  ];
  const requests = [req('Bala', 'sent'), req('Chitra', 'opened'), { ...req('Arun', 'sent'), month: 11 }];
  const rows = requestStatuses(sponsors, requests, new Set(['Devi']), DEC);
  assert.deepEqual(rows.map((r) => [r.sponsor.name, r.state]), [
    ['Arun', 'pending'], ['BadPhone', 'pending'], ['Bala', 'sent'], ['Chitra', 'opened'], ['Devi', 'donated'], ['NoStar', 'pending'],
  ]);
  assert.deepEqual(requestCounts(rows), { pending: 4, sent: 1, opened: 1, donated: 1, total: 6 });
  assert.deepEqual(sendAllQueue(rows).map((r) => r.sponsor.name), ['Arun', 'Chitra', 'NoStar'], 'Send All: not sent, not donated, valid number');
  assert.deepEqual(invalidPhoneRows(rows).map((r) => r.sponsor.name), ['BadPhone']);
});

test('migration 00031: optional star / event, payment details, one request per sponsor per month', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261128120000_00031_monthly_sponsorship_requests.sql', import.meta.url), 'utf8');
  for (const s of ['ALTER COLUMN star DROP NOT NULL', 'ALTER COLUMN sponsor_events DROP NOT NULL', 'ADD COLUMN IF NOT EXISTS payment_details text',
    'UNIQUE (monthly_sponsor_id, year, month)', 'CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key ON notifications (dedupe_key);']) {
    assert.ok(sql.includes(s), s);
  }
  assert.ok(sql.includes(DEFAULT_REQUEST.ta) && sql.includes(DEFAULT_REQUEST.en), 'seeded exactly');
});
