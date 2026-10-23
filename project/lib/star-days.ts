/**
 * Star-calendar row shape and date helpers that don't need the astronomy
 * library, so pages can use them without bundling it (see star-calendar.ts
 * for the calculation itself).
 */

export interface StarCalendarDay {
  /** IST calendar date, YYYY-MM-DD. */
  date: string;
  sunrise: string;
  /** Star at sunrise (0–26). */
  star: number;
  star_start: string;
  star_end: string;
  /**
   * A star that begins after this sunrise and ends before the next one, so it
   * never prevails at a sunrise. Its star day is this date.
   */
  extra_star: number | null;
  extra_start: string | null;
  extra_end: string | null;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export interface StarDayOccurrence {
  date: string;
  /** When the star runs from and to (it can start the evening before). */
  start: string;
  end: string;
  /** The star also prevails at the next day's sunrise. */
  alsoNextDay: boolean;
}

/**
 * A person's star days in the given calendar rows (sorted by date). The star
 * day is the date whose sunrise falls in the star; when the star covers two
 * sunrises the first date is used (and flagged), and when it covers none it
 * is the date it occurs on.
 */
export function starDaysFor(star: number, rows: StarCalendarDay[]): StarDayOccurrence[] {
  const out: StarDayOccurrence[] = [];
  rows.forEach((row, i) => {
    if (row.extra_star === star) {
      out.push({ date: row.date, start: row.extra_start!, end: row.extra_end!, alsoNextDay: false });
    } else if (row.star === star) {
      const prev = rows[i - 1];
      if (prev && prev.star === star && prev.date === addDays(row.date, -1)) {
        out[out.length - 1].alsoNextDay = true;
        return;
      }
      out.push({ date: row.date, start: row.star_start, end: row.star_end, alsoNextDay: false });
    }
  });
  return out;
}
