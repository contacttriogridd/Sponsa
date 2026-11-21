import { Body, GeoVector, Observer, RotateVector, Rotation_EQJ_ECL, SearchRiseSet, SphereFromVector } from 'astronomy-engine';
import { COIMBATORE, computeStarDay, istMidnight, moonSiderealLongitude } from '@/lib/star-calendar';
import { addDays } from '@/lib/star-days';

/**
 * Tamil solar month and thithi, the same way the Star Calendar works out the
 * Natchathiram: positions in the fixed J2000 ecliptic minus the Lahiri
 * ayanamsa, at sunrise in Coimbatore.
 *
 *   Tamil month = the Sun's sidereal sign at sunset (Mesham = Chithirai).
 *   Thithi      = (Moon − Sun) / 12°, 0 = Valarpirai Prathamai … 14 = Pournami,
 *                 15 = Theipirai Prathamai … 29 = Amavasai.
 *
 * Used to fill in the English date of a Star Birthday or a Thithi memorial for
 * each year. Local panchangams can differ by a day, so the dates stay editable.
 */

export { TAMIL_MONTHS, THITHIS } from '@/lib/tamil-month-names';

const LAHIRI_AYANAMSA_J2000 = 23.857092;
const observer = new Observer(COIMBATORE.latitude, COIMBATORE.longitude, COIMBATORE.elevation);
const eqjToEcl = Rotation_EQJ_ECL();

export function sunSiderealLongitude(time: Date): number {
  const ecl = SphereFromVector(RotateVector(eqjToEcl, GeoVector(Body.Sun, time, true)));
  return (((ecl.lon - LAHIRI_AYANAMSA_J2000) % 360) + 360) % 360;
}

function sunrise(date: string): Date {
  const rise = SearchRiseSet(Body.Sun, observer, +1, istMidnight(date), 1);
  if (!rise) throw new Error(`No sunrise found for ${date}`);
  return rise.date;
}

function sunset(date: string): Date {
  const set = SearchRiseSet(Body.Sun, observer, -1, istMidnight(date), 1);
  if (!set) throw new Error(`No sunset found for ${date}`);
  return set.date;
}

/**
 * Tamil month (0 = Chithirai) of an IST date. Tamil calendars start the month
 * on the day the Sun enters the sign if that happens before sunset, so the
 * Sun's sign at sunset decides (Chithirai 1 = 14 April, Thai 1 = Pongal).
 */
export function tamilMonthOn(date: string): number {
  return Math.floor(sunSiderealLongitude(sunset(date)) / 30) % 12;
}

/** Thithi (0–29) at a moment. */
export function thithiAt(time: Date): number {
  const diff = (((moonSiderealLongitude(time) - sunSiderealLongitude(time)) % 360) + 360) % 360;
  return Math.floor(diff / 12) % 30;
}

/**
 * The days of Tamil month `month` that begins in Gregorian year `year`
 * (Thai of 2027 is Jan–Feb 2027; Margazhi of 2027 runs Dec 2027 – Jan 2028).
 */
export function tamilMonthDays(year: number, month: number): string[] {
  // The Sun moves ~0.9856°/day; start from an estimate and step to the exact first day.
  const jan1 = `${year}-01-01`;
  const lon = sunSiderealLongitude(sunrise(jan1));
  let day = addDays(jan1, Math.floor((((month * 30 - lon) % 360) + 360) % 360 / 0.9856) - 3);
  for (let i = 0; i < 10 && tamilMonthOn(day) !== month; i++) day = addDays(day, 1);
  while (tamilMonthOn(addDays(day, -1)) === month) day = addDays(day, -1);
  const days: string[] = [];
  for (let d = day; tamilMonthOn(d) === month && days.length < 33; d = addDays(d, 1)) days.push(d);
  return days;
}

export interface YearDate {
  date: string | null;
  /** Other matching days in the same month, when the star or thithi comes twice. */
  others: string[];
}

/**
 * Star Birthday: the day in that Tamil month whose star (at sunrise, or one
 * that starts and ends between sunrises — the Star Calendar's "+") is the
 * person's star. If it comes twice, the first is used and the second listed.
 */
export function starBirthdayDate(year: number, month: number, star: number): YearDate {
  const hits = tamilMonthDays(year, month).filter((d) => {
    const row = computeStarDay(d);
    return row.star === star || row.extra_star === star;
  });
  return { date: hits[0] || null, others: hits.slice(1) };
}

/**
 * Thithi memorial (thivasam): the day in that Tamil month when the thithi
 * prevails in the afternoon (aparahna, ~sunrise + 8½ h), as is usual for a
 * remembrance. If none, the day it prevails at sunrise.
 */
export function thithiMemorialDate(year: number, month: number, thithi: number): YearDate {
  const days = tamilMonthDays(year, month);
  const afternoon = days.filter((d) => thithiAt(new Date(sunrise(d).getTime() + 8.5 * 3600 * 1000)) === thithi);
  const hits = afternoon.length ? afternoon : days.filter((d) => thithiAt(sunrise(d)) === thithi);
  return { date: hits[0] || null, others: hits.slice(1) };
}

/** Dates for `count` years from `fromYear`, as { "2026": "2026-12-05", … }. Missing years are left out. */
export function yearlyDates(kind: 'star' | 'thithi', month: number, value: number, fromYear: number, count = 5): Record<string, string> {
  const out: Record<string, string> = {};
  for (let y = fromYear; y < fromYear + count; y++) {
    const r = kind === 'star' ? starBirthdayDate(y, month, value) : thithiMemorialDate(y, month, value);
    if (r.date) out[String(y)] = r.date;
  }
  return out;
}
