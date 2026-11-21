import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DONATION_CATEGORIES, categoryOf, donationMonth, receivedInMonth, sumDonations, totalsByCategory, totalsBySponsor } from '@/lib/donations';
import { boardCategoryOf, windowOf } from '@/lib/dates-board';

const d = (over: Record<string, unknown>) => ({ amount: 0, donation_date: '2026-11-10', ...over });

test('every category adds up to the total', () => {
  const list = [
    d({ amount: 5000, sponsor_category: 'Birthday' }),
    d({ amount: '1200.00', sponsor_category: 'Monthly' }),
    d({ amount: 2000, monthly_sponsor_id: 'm1' }), // before migration 00027: Monthly
    d({ amount: 3000, type: 'Food' }), // Annadhanam
    d({ amount: 1000, type: 'Money' }), // General
    d({ amount: null, sponsor_category: 'Other' }),
  ];
  const t = totalsByCategory(list);
  assert.equal(t.total, 12200);
  assert.equal(t.rows.reduce((a, r) => a + r.amount, 0), t.total);
  assert.equal(t.rows.reduce((a, r) => a + r.count, 0), list.length);
  assert.deepEqual(t.rows.filter((r) => r.count).map((r) => [r.category, r.amount]), [
    ['Monthly', 3200], ['Birthday', 5000], ['General', 1000], ['Annadhanam', 3000], ['Other', 0],
  ]);
  assert.equal(t.rows.length, DONATION_CATEGORIES.length, 'empty categories are listed too');
});

test('category falls back the same way as the migration', () => {
  assert.equal(categoryOf(d({ sponsor_category: 'Star Birthday' })), 'Star Birthday');
  assert.equal(categoryOf(d({ sponsor_category: 'nonsense', sponsor_type: 'monthly' })), 'Monthly');
  assert.equal(categoryOf(d({ type: 'Food' })), 'Annadhanam');
  assert.equal(categoryOf(d({})), 'General');
});

test('the migration allows exactly the app categories', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261121120000_00027_donations_single_source.sql', import.meta.url), 'utf8');
  const check = sql.match(/sponsor_category IN \(([\s\S]*?)\)\);/)![1];
  assert.deepEqual(check.match(/'([^']+)'/g)!.map((x) => x.slice(1, -1)), [...DONATION_CATEGORIES]);
});

test('a monthly donation counts towards the month it is for', () => {
  assert.equal(donationMonth(d({ donation_date: '2026-11-28', occasion_date: '2026-12-01' })), '2026-12-01');
  assert.equal(donationMonth(d({ donation_date: '2026-11-28' })), '2026-11-01');
  const list = [d({ donation_date: '2026-10-31', amount: 1 }), d({ donation_date: '2026-11-01', amount: 2 }), d({ donation_date: '2026-11-30', amount: 4 })];
  assert.equal(sumDonations(receivedInMonth(list, '2026-11-01')), 6);
});

test('sponsor totals are calculated from donation rows', () => {
  const totals = totalsBySponsor([
    d({ sponsor_id: 's1', amount: 1000 }), d({ sponsor_id: 's1', amount: 500 }), d({ monthly_sponsor_id: 'm1', amount: 700 }), d({ amount: 300 }),
  ]);
  assert.deepEqual(Object.fromEntries(totals), { s1: 1500, m1: 700 });
});

test('dashboard windows: Today, Next 3 days, This week, This month', () => {
  assert.deepEqual([0, 1, 3, 4, 7, 8, 30, 31, -1].map(windowOf), ['today', 'next3', 'next3', 'week', 'week', 'month', 'month', null, null]);
});

test('dashboard categories for reminders', () => {
  const base = { kind: 'event' as const, calm: false, occasionRecord: null };
  assert.equal(boardCategoryOf({ ...base, key: 'mspay:1' }), 'monthly');
  assert.equal(boardCategoryOf({ ...base, key: 'occ:1', calm: true }), 'memorial');
  assert.equal(boardCategoryOf({ ...base, key: 'dob:1', kind: 'birthday' }), 'birthday');
  assert.equal(boardCategoryOf({ ...base, key: 'occ:2', occasionRecord: { occasion_type: 'Wedding Anniversary' } as never }), 'anniversary');
  assert.equal(boardCategoryOf({ ...base, key: 'req:1' }), null);
});
