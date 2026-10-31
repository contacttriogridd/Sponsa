import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextOccurrence, occurrencesBetween, occursOn, recurrenceBadge } from '@/lib/recurrence';
import { buildReminderItems, type ReminderSources } from '@/lib/today-reminders';

const TODAY = '2026-10-31'; // Saturday
const TOMORROW = '2026-11-01';

test('1. daily from 1 Oct, no end: today and tomorrow', () => {
  const e = { recurrence: 'daily' as const, start_date: '2026-10-01' };
  assert.equal(occursOn(e, TODAY), true);
  assert.equal(occursOn(e, TOMORROW), true);
  assert.equal(occursOn(e, '2026-09-30'), false);
});

test('2. weekly every Saturday: today, not tomorrow', () => {
  const e = { recurrence: 'weekly' as const, weekdays: [6], start_date: '2026-10-01' };
  assert.equal(occursOn(e, TODAY), true);
  assert.equal(occursOn(e, TOMORROW), false);
  assert.equal(occursOn({ recurrence: 'weekly', start_date: '2026-10-24' }, TODAY), true, 'no weekdays: same weekday as start');
});

test('3. monthly on day 31: 31 Oct, and 30 Nov as the last day', () => {
  const e = { recurrence: 'monthly' as const, day_of_month: 31, start_date: '2026-01-01' };
  assert.equal(occursOn(e, TODAY), true);
  assert.equal(occursOn(e, '2026-11-30'), true);
  assert.equal(occursOn(e, '2026-11-29'), false);
  assert.equal(occursOn(e, '2027-02-28'), true);
});

test('4. monthly sponsor with donation day 1: tomorrow, not today', () => {
  const e = { recurrence: 'monthly' as const, day_of_month: 1, start_date: null };
  assert.equal(occursOn(e, TODAY), false);
  assert.equal(occursOn(e, TOMORROW), true);
});

test('5. one-time today: today only', () => {
  const e = { recurrence: 'none' as const, date: TODAY };
  assert.equal(occursOn(e, TODAY), true);
  assert.equal(occursOn(e, TOMORROW), false);
});

test('6. daily ended 30 Oct: does not show', () => {
  const e = { recurrence: 'daily' as const, start_date: '2026-10-01', end_date: '2026-10-30' };
  assert.equal(occursOn(e, '2026-10-30'), true);
  assert.equal(occursOn(e, TODAY), false);
  assert.equal(nextOccurrence(e, TODAY), null);
});

test('yearly, inactive, badges and next dates', () => {
  assert.equal(occursOn({ recurrence: 'yearly', start_date: '2016-02-29' }, '2027-02-28'), true);
  assert.equal(occursOn({ recurrence: 'yearly', start_date: '2016-02-29' }, '2028-02-28'), false);
  assert.equal(occursOn({ recurrence: 'daily', start_date: '2026-10-01', active: false }, TODAY), false);
  assert.equal(recurrenceBadge({ recurrence: 'daily' }), '🔁 Daily');
  assert.equal(recurrenceBadge({ recurrence: 'weekly', weekdays: [0] }), '🔁 Every Sunday');
  assert.equal(recurrenceBadge({ recurrence: 'monthly', day_of_month: 5 }), '🔁 Monthly (5th)');
  assert.equal(recurrenceBadge({ recurrence: 'monthly', day_of_month: 22 }), '🔁 Monthly (22nd)');
  assert.equal(recurrenceBadge({ recurrence: 'yearly' }), '🔁 Yearly');
  assert.equal(recurrenceBadge({ recurrence: 'none' }), null);
  assert.equal(nextOccurrence({ recurrence: 'weekly', weekdays: [0] }, TODAY), TOMORROW);
  assert.equal(occurrencesBetween({ recurrence: 'daily', start_date: TODAY }, TODAY, '2026-11-02').length, 3);
});

const sponsor = (id: string) => ({ id, full_name: `Sponsor ${id}`, dob: null, phone: '9629522777', whatsapp: null, status: 'active' });
const occasion = (id: string, extra: object) => ({
  id, sponsor_id: 'a', family_member_id: null, person_name: 'Sponsor a', relationship: 'Self', occasion_type: 'Celebration',
  occasion_date: '2026-10-01', recurring_yearly: false, active: true, ...extra,
});

function items(today: string) {
  const sources = {
    sponsors: [sponsor('a')],
    occasions: [
      occasion('daily', { recurrence: 'daily', start_date: '2026-10-01' }),
      occasion('sat', { recurrence: 'weekly', weekdays: [6] }),
      occasion('m31', { recurrence: 'monthly', day_of_month: 31 }),
      occasion('once', { occasion_date: TODAY }),
      occasion('ended', { recurrence: 'daily', start_date: '2026-10-01', end_date: '2026-10-30' }),
    ],
    familyMembers: [],
    monthlySponsors: [{ id: 'ms', name: 'Monthly', dob: null, status: 'active', phone: null, sponsor_id: null, payment_day: 1, start_date: null }],
    donations: [],
    requests: [{ id: 'req', sponsor_id: 'a', occasion_id: null, occasion_name: 'Food', special_date: '2026-10-01', status: 'confirmed', recurrence: 'daily' }],
  } as unknown as ReminderSources;
  return buildReminderItems(sources, today);
}
const todayKeys = (today: string) => items(today).filter((i) => i.group === 'today' && i.kind !== 'birthday').map((i) => i.key).sort();

test('dashboard today: all the test records', () => {
  assert.deepEqual(todayKeys(TODAY), ['occ:daily', 'occ:m31', 'occ:once', 'occ:sat', 'req:req']);
});

test('dashboard tomorrow: daily and the monthly sponsor', () => {
  assert.deepEqual(todayKeys(TOMORROW), ['mspay:ms', 'occ:daily', 'req:req']);
});

test('a daily event shows once in Upcoming, and never piles up under Past', () => {
  const all = items(TODAY);
  const daily = all.filter((i) => i.key.startsWith('occ:daily'));
  assert.deepEqual(daily.map((i) => i.group), ['today', 'upcoming']);
  assert.equal(daily[1].date, TOMORROW);
  assert.equal(daily[1].recurrenceBadge, '🔁 Daily');
  assert.equal(all.filter((i) => i.group === 'past' && i.key === 'occ:daily').length, 0);
});

test('Past: finished one-time events and ended recurring events only', () => {
  const past = items(TOMORROW).filter((i) => i.group === 'past').map((i) => i.key).sort();
  assert.deepEqual(past, ['occ:ended', 'occ:once']);
  assert.equal(items(TOMORROW).find((i) => i.key === 'occ:ended')!.date, '2026-10-30');
});

test('7. done today, pending tomorrow: completions are kept per date', () => {
  const key = items(TODAY).find((i) => i.key === 'occ:daily' && i.group === 'today')!.key;
  const completions = new Set([`${key}|${TODAY}`]); // reminder_completions: (item_key, reminder_date)
  const isDone = (today: string) => {
    const item = items(today).find((i) => i.key === key && i.group === 'today')!;
    return completions.has(`${item.key}|${today}`);
  };
  assert.equal(isDone(TODAY), true);
  assert.equal(isDone(TOMORROW), false);
});
