import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  observanceKeyFromEnglish, observanceLabel, observanceViews, parseObservancesCsv, shortDay,
  type Observance, type ObservanceInput,
} from '@/lib/observances';

const csv = readFileSync(new URL('../data/vp-trust-monthly-events-2026-2036.csv', import.meta.url), 'utf8');
const parsed = parseObservancesCsv(csv);

/** What the database holds after the seed: the CSV rows with ids and no overrides. */
const asRows = (rows: ObservanceInput[]): Observance[] =>
  rows.map((r, i) => ({ ...r, id: String(i), is_hidden: false, override_date: null, note: null }));
const rows = asRows(parsed.rows);

/** "day key" pairs shown in a month, e.g. "20 ekadashi". */
const month = (list: Observance[], from: string, to: string) =>
  observanceViews(list, from, to).map((v) => `${Number(v.on.slice(8))} ${v.event_key}`);

test('the CSV imports all 1,113 rows with the right counts per event', () => {
  assert.equal(csv.charCodeAt(0), 0xfeff, 'file starts with a BOM');
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.duplicates, 0);
  assert.equal(parsed.rows.length, 1113);
  const counts: Record<string, number> = {};
  for (const r of parsed.rows) counts[r.event_key] = (counts[r.event_key] || 0) + 1;
  assert.deepEqual(counts, { ekadashi: 248, pradosham: 247, pournami: 124, sashti: 124, sankatahara: 124, amavasai: 123, shivaratri: 123 });
  assert.equal(parsed.rows[0].date, '2026-11-15');
  assert.equal(parsed.rows[parsed.rows.length - 1].date, '2036-11-14');
});

test('BOM is stripped and Tamil is read intact', () => {
  assert.deepEqual(parsed.rows[0], { date: '2026-11-15', event_key: 'sashti', event_en: 'Sashti', event_ta: 'சஷ்டி', source: 'csv' });
  assert.ok(parsed.rows.every((r) => !/à®|Ã/.test(r.event_ta)));
});

test('event_en maps to event_key', () => {
  assert.equal(observanceKeyFromEnglish('Sankatahara Chaturthi'), 'sankatahara');
  assert.equal(observanceKeyFromEnglish('Maadha Shivaratri'), 'shivaratri');
  assert.equal(observanceKeyFromEnglish(' amavasai '), 'amavasai');
  assert.equal(observanceKeyFromEnglish('Navaratri'), null);
});

test('November 2026 (data starts on 15 Nov)', () => {
  assert.deepEqual(month(rows, '2026-11-01', '2026-11-30'), ['15 sashti', '20 ekadashi', '22 pradosham', '24 pournami', '27 sankatahara']);
});

test('December 2026', () => {
  assert.deepEqual(month(rows, '2026-12-01', '2026-12-31'), [
    '4 ekadashi', '6 pradosham', '7 shivaratri', '8 amavasai', '15 sashti', '20 ekadashi', '21 pradosham', '23 pournami', '26 sankatahara',
  ]);
});

test('two events on one day are both shown (Pradosham + Maadha Shivaratri, 5 Jan 2027)', () => {
  assert.deepEqual(month(rows, '2027-01-05', '2027-01-05'), ['5 pradosham', '5 shivaratri']);
});

test('labels: Soma / Shani Pradosham and வளர்பிறை / தேய்பிறை', () => {
  const dec = observanceViews(rows, '2026-12-01', '2026-12-31');
  const on = (day: number, key: string) => dec.find((v) => v.on === `2026-12-${String(day).padStart(2, '0')}` && v.event_key === key)!.label;
  // After Pournami (24 Nov): waning.
  assert.deepEqual([on(4, 'ekadashi').ta, on(4, 'ekadashi').en], ['தேய்பிறை ஏகாதசி', 'Theipirai Ekadashi']);
  assert.equal(on(6, 'pradosham').en, 'Theipirai Pradosham');
  // After Amavasai (8 Dec): waxing; 21 Dec is a Monday.
  assert.equal(on(20, 'ekadashi').en, 'Valarpirai Ekadashi');
  assert.deepEqual([on(21, 'pradosham').ta, on(21, 'pradosham').en], ['வளர்பிறை சோம பிரதோஷம்', 'Valarpirai Soma Pradosham']);
  assert.equal(on(8, 'amavasai').en, 'Amavasai (New Moon)');
  assert.equal(on(15, 'sashti').ta, 'சஷ்டி விரதம்');
  // 22 Nov 2026: no new/full moon before it in the data, so the next one (Pournami 24 Nov) decides.
  const nov22 = observanceViews(rows, '2026-11-22', '2026-11-22')[0];
  assert.equal(nov22.label.en, 'Valarpirai Pradosham');
  assert.equal(shortDay(nov22.on), 'Sun 22 Nov');
  // A Saturday Pradosham.
  const sat = rows.find((r) => r.event_key === 'pradosham' && new Date(`${r.date}T00:00:00Z`).getUTCDay() === 6)!;
  assert.match(observanceLabel(sat, rows).en, /Shani Pradosham$/);
});

test('admin move shows the event on the new date; restore puts it back', () => {
  const moved = rows.map((r) => (r.date === '2026-12-08' && r.event_key === 'amavasai' ? { ...r, override_date: '2026-12-09' } : r));
  assert.ok(!month(moved, '2026-12-08', '2026-12-08').includes('8 amavasai'));
  const view = observanceViews(moved, '2026-12-09', '2026-12-09');
  assert.deepEqual(view.map((v) => [v.event_key, v.edited]), [['amavasai', true]]);
  // Moved into another month: found by override_date.
  const toJan = rows.map((r) => (r.date === '2026-12-23' && r.event_key === 'pournami' ? { ...r, override_date: '2027-01-01' } : r));
  assert.ok(month(toJan, '2027-01-01', '2027-01-01').includes('1 pournami'));
  const restored = moved.map((r) => ({ ...r, override_date: null }));
  assert.ok(month(restored, '2026-12-08', '2026-12-08').includes('8 amavasai'));
});

test('hidden events are left out, except for admins', () => {
  const hidden = rows.map((r) => (r.date === '2026-12-15' ? { ...r, is_hidden: true } : r));
  assert.deepEqual(observanceViews(hidden, '2026-12-15', '2026-12-15'), []);
  assert.equal(observanceViews(hidden, '2026-12-15', '2026-12-15', true).length, 1);
});

test('nothing is shown past the last loaded date (Dec 2036)', () => {
  assert.deepEqual(month(rows, '2036-12-01', '2036-12-31'), []);
});

test('importing again adds nothing: same date + event is skipped', () => {
  const db = new Map<string, Observance>();
  const upsert = (input: ObservanceInput[]) => {
    let added = 0;
    for (const r of input) {
      const key = `${r.date}|${r.event_key}`;
      if (!db.has(key)) { db.set(key, { ...r, id: key, is_hidden: false, override_date: null, note: null }); added++; }
    }
    return added;
  };
  assert.equal(upsert(parsed.rows), 1113);
  db.get('2026-12-08|amavasai')!.override_date = '2026-12-09';
  assert.equal(upsert(parseObservancesCsv(csv).rows), 0);
  assert.equal(db.size, 1113);
  assert.equal(db.get('2026-12-08|amavasai')!.override_date, '2026-12-09', 'admin override kept');
});

test('bad rows are reported with their row number; the rest still import', () => {
  const text = '﻿date,day,event_en,event_ta\r\n'
    + '2036-11-15,Sat,Sashti,சஷ்டி\r\n'
    + '2036-13-01,Mon,Ekadashi,ஏகாதசி\r\n'
    + '2036-11-16,Sun,Navaratri,நவராத்திரி\r\n'
    + '2036-11-17,Fri,Pradosham,பிரதோஷம்\r\n'
    + '2036-11-18,Tue,Amavasai,\r\n'
    + '2036-11-15,Sat,Sashti,சஷ்டி\r\n'
    + '\r\n';
  const r = parseObservancesCsv(text);
  assert.equal(r.rows.length, 1);
  assert.equal(r.duplicates, 1);
  assert.deepEqual(r.errors.map((e) => e.row), [3, 4, 5, 6]);
  assert.match(r.errors[2].message, /Mon, not Fri/);
  assert.match(parseObservancesCsv('when,what\n2036-01-01,x').errors[0].message, /missing date, event_en, event_ta/);
});
