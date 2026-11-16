/**
 * Monthly Hindu observances (Amavasai, Pournami, Ekadashi, Pradosham,
 * Sankatahara Chaturthi, Sashti, Maadha Shivaratri) shown on the Star
 * Calendar. Rows live in the monthly_observances table, imported from a CSV
 * (date,day,event_en,event_ta). Kept free of Supabase so it can be tested.
 */

export type ObservanceKey = 'amavasai' | 'pournami' | 'ekadashi' | 'pradosham' | 'sankatahara' | 'sashti' | 'shivaratri';
export type Paksha = 'valarpirai' | 'theipirai';

export interface Observance {
  id: string;
  date: string;
  event_key: ObservanceKey;
  event_en: string;
  event_ta: string;
  is_hidden: boolean;
  override_date: string | null;
  note: string | null;
  source: 'csv' | 'manual';
  created_at?: string;
  updated_at?: string;
}

/** Legend order. */
export const OBSERVANCE_KEYS: ObservanceKey[] = ['amavasai', 'pournami', 'ekadashi', 'pradosham', 'sankatahara', 'sashti', 'shivaratri'];

export const OBSERVANCE_META: Record<ObservanceKey, { en: string; ta: string; short: string; icon: string }> = {
  amavasai: { en: 'Amavasai (New Moon)', ta: 'அமாவாசை', short: 'Amavasai', icon: '🌑' },
  pournami: { en: 'Pournami (Full Moon)', ta: 'பௌர்ணமி', short: 'Pournami', icon: '🌕' },
  ekadashi: { en: 'Ekadashi', ta: 'ஏகாதசி', short: 'Ekadashi', icon: '🙏' },
  pradosham: { en: 'Pradosham', ta: 'பிரதோஷம்', short: 'Pradosham', icon: '🪔' },
  sankatahara: { en: 'Sankatahara Chaturthi', ta: 'சங்கடஹர சதுர்த்தி', short: 'Sankatahara Chaturthi', icon: '🐘' },
  sashti: { en: 'Sashti Viratham', ta: 'சஷ்டி விரதம்', short: 'Sashti', icon: '🦚' },
  shivaratri: { en: 'Maadha Shivaratri', ta: 'மாத சிவராத்திரி', short: 'Maadha Shivaratri', icon: '🔱' },
};

/** Events that come twice a month, once in each paksha. */
export const PAKSHA_EVENTS: ObservanceKey[] = ['ekadashi', 'pradosham', 'sashti'];

/** CSV event_en → event_key. */
const KEY_BY_ENGLISH: Record<string, ObservanceKey> = {
  amavasai: 'amavasai',
  pournami: 'pournami',
  ekadashi: 'ekadashi',
  pradosham: 'pradosham',
  'sankatahara chaturthi': 'sankatahara',
  sashti: 'sashti',
  'maadha shivaratri': 'shivaratri',
};

export function observanceKeyFromEnglish(name: string): ObservanceKey | null {
  return KEY_BY_ENGLISH[name.trim().replace(/\s+/g, ' ').toLowerCase()] ?? null;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** The date the event is shown on: the admin's override, else the CSV date. */
export function effectiveDate(o: Pick<Observance, 'date' | 'override_date'>): string {
  return o.override_date || o.date;
}

/**
 * Waxing (வளர்பிறை) within 15 days after an Amavasai, waning (தேய்பிறை) within
 * 15 days after a Pournami. At the start of the data, where there is no earlier
 * new or full moon, the next one decides: a Pournami ahead means waxing.
 */
export function pakshaOf(o: Pick<Observance, 'date' | 'override_date'>, all: Pick<Observance, 'date' | 'override_date' | 'event_key'>[]): Paksha | null {
  const on = effectiveDate(o);
  let before: { key: ObservanceKey; gap: number } | null = null;
  let after: { key: ObservanceKey; gap: number } | null = null;
  for (const m of all) {
    if (m.event_key !== 'amavasai' && m.event_key !== 'pournami') continue;
    const gap = daysBetween(effectiveDate(m), on);
    if (gap >= 1 && gap <= 15 && (!before || gap < before.gap)) before = { key: m.event_key, gap };
    if (gap <= -1 && gap >= -15 && (!after || -gap < after.gap)) after = { key: m.event_key, gap: -gap };
  }
  if (before) return before.key === 'amavasai' ? 'valarpirai' : 'theipirai';
  if (after) return after.key === 'pournami' ? 'valarpirai' : 'theipirai';
  return null;
}

export interface ObservanceLabel {
  ta: string;
  en: string;
  icon: string;
  paksha: Paksha | null;
}

/**
 * Display name. Pradosham on a Monday is Soma Pradosham, on a Saturday Shani
 * Pradosham; Ekadashi and Pradosham get வளர்பிறை / தேய்பிறை in front.
 */
export function observanceLabel(o: Pick<Observance, 'date' | 'override_date' | 'event_key'>, all: Pick<Observance, 'date' | 'override_date' | 'event_key'>[] = []): ObservanceLabel {
  const meta = OBSERVANCE_META[o.event_key];
  let ta = meta.ta;
  let en = meta.en;
  if (o.event_key === 'pradosham') {
    const day = weekday(effectiveDate(o));
    if (day === 1) { ta = 'சோம பிரதோஷம்'; en = 'Soma Pradosham'; }
    if (day === 6) { ta = 'சனி பிரதோஷம்'; en = 'Shani Pradosham'; }
  }
  // Sashti's phase is worked out too (sponsors can pick waxing or waning Sashti), but its label stays as is.
  const paksha = PAKSHA_EVENTS.includes(o.event_key) ? pakshaOf(o, all) : null;
  if (o.event_key !== 'sashti') {
    if (paksha === 'valarpirai') { ta = `வளர்பிறை ${ta}`; en = `Valarpirai ${en}`; }
    if (paksha === 'theipirai') { ta = `தேய்பிறை ${ta}`; en = `Theipirai ${en}`; }
  }
  return { ta, en, icon: meta.icon, paksha };
}

export interface ObservanceView extends Observance {
  /** Date it is shown on (override_date when set). */
  on: string;
  label: ObservanceLabel;
  /** Moved by an admin. */
  edited: boolean;
}

/**
 * The events to show between from and to (inclusive), by the date they are
 * shown on. Hidden rows are left out unless includeHidden (admins see them
 * faded, to restore). `rows` may reach further either side: the extra rows
 * only help decide வளர்பிறை / தேய்பிறை.
 */
export function observanceViews(rows: Observance[], from: string, to: string, includeHidden = false): ObservanceView[] {
  return rows
    .map((o) => ({ ...o, on: effectiveDate(o), label: observanceLabel(o, rows), edited: !!o.override_date && o.override_date !== o.date }))
    .filter((o) => o.on >= from && o.on <= to && (includeHidden || !o.is_hidden))
    .sort((a, b) => a.on.localeCompare(b.on) || OBSERVANCE_KEYS.indexOf(a.event_key) - OBSERVANCE_KEYS.indexOf(b.event_key));
}

/** "Sun 22 Nov" */
export function shortDay(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${WEEKDAYS[weekday(date)]} ${d} ${months[m - 1]}`;
}

// ---------------------------------------------------------------- CSV import

export interface ObservanceInput {
  date: string;
  event_key: ObservanceKey;
  event_en: string;
  event_ta: string;
  source: 'csv';
}

export interface CsvRowError {
  /** Line in the file; the header is row 1. */
  row: number;
  message: string;
}

export interface ParsedObservances {
  rows: ObservanceInput[];
  errors: CsvRowError[];
  /** Rows repeated inside the file (same date and event), counted as skipped. */
  duplicates: number;
}

/** One CSV line; handles "quoted, fields" and "" escapes. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function isRealDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const t = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === date;
}

/**
 * Reads date,day,event_en,event_ta (header required, any column order).
 * The UTF-8 BOM is stripped. Bad rows are reported with their row number and
 * left out; the rest can still be imported.
 */
export function parseObservancesCsv(text: string): ParsedObservances {
  const lines = text.replace(/^﻿/, '').split(/\r\n|\n|\r/);
  const errors: CsvRowError[] = [];
  const rows: ObservanceInput[] = [];
  const header = splitCsvLine(lines[0] || '').map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const missing = ['date', 'event_en', 'event_ta'].filter((c) => col(c) < 0);
  if (missing.length) return { rows, errors: [{ row: 1, message: `Header must have date, day, event_en, event_ta (missing ${missing.join(', ')})` }], duplicates: 0 };

  const seen = new Set<string>();
  let duplicates = 0;
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const row = i + 1;
    const cells = splitCsvLine(lines[i]);
    const date = cells[col('date')] || '';
    const day = col('day') >= 0 ? cells[col('day')] || '' : '';
    const en = cells[col('event_en')] || '';
    const ta = cells[col('event_ta')] || '';
    if (!isRealDate(date)) { errors.push({ row, message: `"${date}" is not a date (use YYYY-MM-DD)` }); continue; }
    const key = observanceKeyFromEnglish(en);
    if (!key) { errors.push({ row, message: `Unknown event "${en}"` }); continue; }
    if (!ta) { errors.push({ row, message: 'Tamil name (event_ta) is empty' }); continue; }
    if (day && day.slice(0, 3).toLowerCase() !== WEEKDAYS[weekday(date)].toLowerCase()) {
      errors.push({ row, message: `${date} is a ${WEEKDAYS[weekday(date)]}, not ${day}` });
      continue;
    }
    const id = `${date}|${key}`;
    if (seen.has(id)) { duplicates++; continue; }
    seen.add(id);
    rows.push({ date, event_key: key, event_en: en, event_ta: ta, source: 'csv' });
  }
  return { rows, errors, duplicates };
}
