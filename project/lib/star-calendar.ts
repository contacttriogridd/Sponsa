import { Body, GeoMoon, Observer, RotateVector, Rotation_EQJ_ECL, SearchRiseSet, SphereFromVector } from 'astronomy-engine';
import { addDays, type StarCalendarDay } from '@/lib/star-days';

export * from '@/lib/star-days';

/**
 * Daily Natchathiram (Moon's nakshatra) calculation, following the Tamil
 * panchangam convention: the star of a day is the one prevailing at sunrise
 * in Coimbatore. Kept free of Supabase so both the browser and the server
 * cron job can use it.
 *
 * Moon position: astronomy-engine, rotated to the fixed J2000 mean ecliptic.
 * In that fixed frame the Lahiri (Chitrapaksha) ayanamsa is a constant —
 * precession is already accounted for by not using the moving equinox — so
 * sidereal longitude = J2000 ecliptic longitude − 23.857092°. (Swiss
 * Ephemeris defines Lahiri as 23.245524743° on 1956-03-21, which precesses to
 * 23°51'25.5" at J2000.) Each star spans 13°20'.
 */

export const COIMBATORE = { latitude: 11.0168, longitude: 76.9558, elevation: 411 };
const LAHIRI_AYANAMSA_J2000 = 23.857092;
const STAR_SPAN = 360 / 27;
const IST_OFFSET_MS = 330 * 60 * 1000;
const HOUR_MS = 3600 * 1000;

const observer = new Observer(COIMBATORE.latitude, COIMBATORE.longitude, COIMBATORE.elevation);
const eqjToEcl = Rotation_EQJ_ECL();

/** Moon's sidereal (Lahiri) ecliptic longitude in degrees, 0–360. */
export function moonSiderealLongitude(time: Date): number {
  const ecl = SphereFromVector(RotateVector(eqjToEcl, GeoMoon(time)));
  return (((ecl.lon - LAHIRI_AYANAMSA_J2000) % 360) + 360) % 360;
}

export function starAt(time: Date): number {
  return Math.floor(moonSiderealLongitude(time) / STAR_SPAN) % 27;
}

/** Signed angle a − b folded into (−180, 180]. */
function angleDiff(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

/**
 * Time the Moon crosses `boundary` degrees within [from, to]. The Moon always
 * moves forward, so the angle to the boundary rises monotonically: bisect.
 */
function findCrossing(boundary: number, from: Date, to: Date): Date {
  let lo = from.getTime();
  let hi = to.getTime();
  for (let i = 0; i < 40 && hi - lo > 1000; i++) {
    const mid = (lo + hi) / 2;
    if (angleDiff(moonSiderealLongitude(new Date(mid)), boundary) < 0) lo = mid;
    else hi = mid;
  }
  return new Date(Math.round((lo + hi) / 2));
}

/** A star lasts ~21–27 hours, so its boundaries are within 30 h of any moment inside it. */
function starPeriod(star: number, inside: Date): { start: Date; end: Date } {
  const t = inside.getTime();
  return {
    start: findCrossing(star * STAR_SPAN, new Date(t - 30 * HOUR_MS), inside),
    end: findCrossing(((star + 1) % 27) * STAR_SPAN, inside, new Date(t + 30 * HOUR_MS)),
  };
}

/** Midnight IST at the start of an IST calendar date (YYYY-MM-DD). */
export function istMidnight(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS);
}

/** IST calendar date (YYYY-MM-DD) of an instant. */
export function istDateKey(time: Date): string {
  return new Date(time.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function sunriseOn(date: string): Date {
  const rise = SearchRiseSet(Body.Sun, observer, +1, istMidnight(date), 1);
  if (!rise) throw new Error(`No sunrise found for ${date}`);
  return rise.date;
}

export function computeStarDay(date: string): StarCalendarDay {
  const sunrise = sunriseOn(date);
  const nextSunrise = sunriseOn(addDays(date, 1));
  const star = starAt(sunrise);
  const { start, end } = starPeriod(star, sunrise);

  let extra: { star: number; start: Date; end: Date } | null = null;
  if (end < nextSunrise) {
    const next = (star + 1) % 27;
    const nextPeriod = starPeriod(next, new Date(end.getTime() + 60 * 1000));
    if (nextPeriod.end < nextSunrise) extra = { star: next, start: end, end: nextPeriod.end };
  }

  return {
    date,
    sunrise: sunrise.toISOString(),
    star,
    star_start: start.toISOString(),
    star_end: end.toISOString(),
    extra_star: extra?.star ?? null,
    extra_start: extra?.start.toISOString() ?? null,
    extra_end: extra?.end.toISOString() ?? null,
  };
}

/** One row per IST date from `from` for `days` days. */
export function computeStarCalendar(from: string, days: number): StarCalendarDay[] {
  return Array.from({ length: days }, (_, i) => computeStarDay(addDays(from, i)));
}
