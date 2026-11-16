import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OBSERVANCE_KEYS, observanceViews, parseObservancesCsv, type Observance } from '@/lib/observances';
import {
  DEFAULT_EVENT_WISH_TA, buildEventWishMessage, eventWishTemplatesFrom, eventWishesOn, nextSponsorEvent, sponsorEventsOf,
} from '@/lib/event-wishes';
import { DEFAULT_ORGANIZATION_NAMES } from '@/lib/organization';

const csv = readFileSync(new URL('../data/vp-trust-monthly-events-2026-2036.csv', import.meta.url), 'utf8');
const rows: Observance[] = parseObservancesCsv(csv).rows.map((r, i) => ({ ...r, id: String(i), is_hidden: false, override_date: null, note: null }));
const day = (date: string) => observanceViews(rows, date, date);
const range = (from: string, to: string) => observanceViews(rows, from, to);

const sponsor = (over: Record<string, unknown> = {}) => ({
  id: 's1', name: 'Sathish', status: 'active', start_date: '2026-01-01', monthly_amount: 1000 as number | null, sponsor_events: [] as unknown, ...over,
});
const templates = eventWishTemplatesFrom(null);

test('event keys are the Star Calendar keys, and the migration allows exactly those', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261116130000_00026_monthly_event_sponsorship.sql', import.meta.url), 'utf8');
  const listed = sql.match(/event_key IN \(([^)]+)\)/)![1].match(/'(\w+)'/g)!.map((k) => k.slice(1, -1));
  assert.deepEqual(listed, OBSERVANCE_KEYS);
});

test('saved events are cleaned: unknown keys dropped, one per event, paksha only where it applies', () => {
  assert.deepEqual(sponsorEventsOf({ sponsor_events: null }), []);
  assert.deepEqual(sponsorEventsOf({
    sponsor_events: [
      { event_key: 'pradosham', amount: '300', paksha: 'valarpirai' },
      { event_key: 'pournami', amount: null, paksha: 'theipirai' },
      { event_key: 'pournami', amount: 50 },
      { event_key: 'navaratri' },
      { event_key: 'amavasai', amount: -5 },
    ],
  }), [
    { event_key: 'amavasai', amount: null, paksha: 'both' },
    { event_key: 'pournami', amount: null, paksha: 'both' },
    { event_key: 'pradosham', amount: 300, paksha: 'valarpirai' },
  ]);
});

test('a Pournami sponsor is wished on Pournami, with the monthly amount when no event amount is set', () => {
  const s = sponsor({ sponsor_events: [{ event_key: 'pournami', amount: null, paksha: 'both' }] });
  const [w] = eventWishesOn([s], day('2026-11-24'), '2026-11-24');
  assert.deepEqual(w.events.map((e) => e.event_key), ['pournami']);
  assert.equal(w.amount, 1000);
  assert.deepEqual(eventWishesOn([s], day('2026-11-22'), '2026-11-22'), []);
});

test('paksha: a Valarpirai Pradosham sponsor skips the Theipirai one', () => {
  const s = sponsor({ sponsor_events: [{ event_key: 'pradosham', amount: 250, paksha: 'valarpirai' }] });
  assert.equal(eventWishesOn([s], day('2026-12-21'), '2026-12-21').length, 1); // after Amavasai 8 Dec
  assert.equal(eventWishesOn([s], day('2026-12-06'), '2026-12-06').length, 0); // after Pournami 24 Nov
  const both = sponsor({ sponsor_events: [{ event_key: 'pradosham', amount: 250, paksha: 'both' }] });
  assert.equal(eventWishesOn([both], day('2026-12-06'), '2026-12-06').length, 1);
  // Sashti on 15 Dec 2026 comes after Amavasai (8 Dec): Valarpirai.
  const sashti = sponsor({ sponsor_events: [{ event_key: 'sashti', amount: null, paksha: 'theipirai' }] });
  assert.equal(eventWishesOn([sashti], day('2026-12-15'), '2026-12-15').length, 0);
});

test('two events on one day: one wish, both events, amounts added', () => {
  const s = sponsor({ sponsor_events: [{ event_key: 'pradosham', amount: 300, paksha: 'both' }, { event_key: 'shivaratri', amount: null, paksha: 'both' }] });
  const [w] = eventWishesOn([s], day('2027-01-05'), '2027-01-05');
  assert.deepEqual(w.events.map((e) => e.event_key), ['pradosham', 'shivaratri']);
  assert.equal(w.amount, 1300);
  const text = buildEventWishMessage(templates, s.name, w.events, '2027-01-05', w.amount, DEFAULT_ORGANIZATION_NAMES);
  assert.ok(text.includes('இன்று தேய்பிறை பிரதோஷம் & மாத சிவராத்திரி (Theipirai Pradosham & Maadha Shivaratri) – 5 Jan 2027.'));
});

test('inactive, paused, not-yet-started sponsors and family entries are skipped', () => {
  const events = [{ event_key: 'pournami', amount: null, paksha: 'both' }];
  const list = [
    sponsor({ id: 'a', sponsor_events: events }),
    sponsor({ id: 'b', status: 'paused', sponsor_events: events }),
    sponsor({ id: 'c', status: 'stopped', sponsor_events: events }),
    sponsor({ id: 'd', start_date: '2026-12-01', sponsor_events: events }),
    sponsor({ id: 'e', family_of: { parentId: 'a' }, sponsor_events: events }),
    sponsor({ id: 'f', sponsor_events: [] }),
  ];
  assert.deepEqual(eventWishesOn(list, day('2026-11-24'), '2026-11-24').map((w) => w.sponsor.id), ['a']);
  assert.deepEqual(eventWishesOn(list, day('2026-12-23'), '2026-12-23').map((w) => w.sponsor.id), ['a', 'd']);
});

test('hidden or moved events follow the admin override', () => {
  const s = sponsor({ sponsor_events: [{ event_key: 'pournami', amount: null, paksha: 'both' }] });
  const moved = rows.map((r) => (r.date === '2026-11-24' && r.event_key === 'pournami' ? { ...r, override_date: '2026-11-25' } : r));
  assert.equal(eventWishesOn([s], observanceViews(moved, '2026-11-24', '2026-11-24'), '2026-11-24').length, 0);
  assert.equal(eventWishesOn([s], observanceViews(moved, '2026-11-25', '2026-11-25'), '2026-11-25').length, 1);
});

test('next event for the list: "Next event: Pournami · 24 Nov"', () => {
  const s = sponsor({ sponsor_events: [{ event_key: 'pournami', amount: null, paksha: 'both' }] });
  assert.equal(nextSponsorEvent(s, range('2026-11-16', '2027-01-16'), '2026-11-16')!.on, '2026-11-24');
  assert.equal(nextSponsorEvent(s, range('2026-11-16', '2027-01-16'), '2026-11-25')!.on, '2026-12-23');
  assert.equal(nextSponsorEvent(sponsor(), range('2026-11-16', '2027-01-16'), '2026-11-16'), null);
});

test('the wish: Tamil then English, organization as "VP TRUST – Tamil name", no raw placeholders', () => {
  const s = sponsor({ sponsor_events: [{ event_key: 'pournami', amount: 501, paksha: 'both' }] });
  const [w] = eventWishesOn([s], day('2026-11-24'), '2026-11-24');
  const text = buildEventWishMessage(templates, ' Sathish ', w.events, '2026-11-24', w.amount, DEFAULT_ORGANIZATION_NAMES);
  const [ta, en] = text.split('\n\n');
  assert.equal(ta, 'வணக்கம் Sathish அவர்களே 🙏\nஇன்று பௌர்ணமி (Pournami (Full Moon)) – 24 Nov 2026.\nஉங்கள் அன்பான அன்னதான நன்கொடைக்கு நன்றி. வள்ளலார் அருளால் உங்கள் குடும்பம் எல்லா நலமும் பெற வாழ்த்துகிறோம்.\n– VP TRUST – வள்ளலார் பசியாற்றும் அறக்கட்டளை');
  assert.ok(en.startsWith('Vanakkam Sathish 🙏\nToday is Pournami (Full Moon) (பௌர்ணமி) – 24 Nov 2026.'));
  assert.ok(!/\{\{/.test(text));
  const custom = eventWishTemplatesFrom([{ event_key: 'pournami', body_ta: '{{sponsor_name}} {{amount}} {{unknown}}', body_en: '' }]);
  assert.equal(custom.pournami.body_en.length > 0, true, 'empty English falls back to the default');
  assert.equal(custom.amavasai.body_ta, DEFAULT_EVENT_WISH_TA);
  assert.ok(buildEventWishMessage(custom, 'Sathish', w.events, '2026-11-24', w.amount, DEFAULT_ORGANIZATION_NAMES).startsWith('Sathish ₹501\n\nVanakkam'));
});
