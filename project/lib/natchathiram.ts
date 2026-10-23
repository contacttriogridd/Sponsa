/**
 * Tamil astrology reference data: the 12 Raasis and 27 Natchathirams.
 * Indexes (0-based) are what the database stores in monthly_sponsors.raasi /
 * .star and star_calendar.star.
 *
 * Each star is 4 padams (quarters) and each Raasi is 9 padams, so a star can
 * straddle two Raasis (e.g. Punarpoosam: padams 1–3 in Mithunam, padam 4 in
 * Kadagam).
 */

export interface AstroName {
  index: number;
  ta: string;
  en: string;
  /** Extra spellings people type when searching. */
  aliases: string[];
}

export const RAASIS: AstroName[] = [
  { index: 0, ta: 'மேஷம்', en: 'Mesham', aliases: ['mesha', 'aries'] },
  { index: 1, ta: 'ரிஷபம்', en: 'Rishabam', aliases: ['rishabha', 'vrishabha', 'taurus'] },
  { index: 2, ta: 'மிதுனம்', en: 'Mithunam', aliases: ['mithuna', 'gemini'] },
  { index: 3, ta: 'கடகம்', en: 'Kadagam', aliases: ['karka', 'karkata', 'cancer'] },
  { index: 4, ta: 'சிம்மம்', en: 'Simmam', aliases: ['simha', 'leo'] },
  { index: 5, ta: 'கன்னி', en: 'Kanni', aliases: ['kanya', 'virgo'] },
  { index: 6, ta: 'துலாம்', en: 'Thulaam', aliases: ['thulam', 'tula', 'libra'] },
  { index: 7, ta: 'விருச்சிகம்', en: 'Viruchigam', aliases: ['vrischika', 'scorpio'] },
  { index: 8, ta: 'தனுசு', en: 'Dhanusu', aliases: ['dhanus', 'dhanu', 'sagittarius'] },
  { index: 9, ta: 'மகரம்', en: 'Magaram', aliases: ['makara', 'makaram', 'capricorn'] },
  { index: 10, ta: 'கும்பம்', en: 'Kumbam', aliases: ['kumbha', 'aquarius'] },
  { index: 11, ta: 'மீனம்', en: 'Meenam', aliases: ['meena', 'pisces'] },
];

export const STARS: AstroName[] = [
  { index: 0, ta: 'அஸ்வினி', en: 'Ashwini', aliases: ['aswini', 'asvini'] },
  { index: 1, ta: 'பரணி', en: 'Bharani', aliases: ['barani'] },
  { index: 2, ta: 'கார்த்திகை', en: 'Karthigai', aliases: ['krittika', 'karthika', 'kartigai'] },
  { index: 3, ta: 'ரோகிணி', en: 'Rohini', aliases: [] },
  { index: 4, ta: 'மிருகசீரிடம்', en: 'Mirugasirisham', aliases: ['mrigashira', 'mirugaseeridam', 'mrigasira'] },
  { index: 5, ta: 'திருவாதிரை', en: 'Thiruvathirai', aliases: ['ardra', 'arudra', 'thiruvadhirai'] },
  { index: 6, ta: 'புனர்பூசம்', en: 'Punarpoosam', aliases: ['punarvasu', 'punarpusam'] },
  { index: 7, ta: 'பூசம்', en: 'Poosam', aliases: ['pushya', 'pusam'] },
  { index: 8, ta: 'ஆயில்யம்', en: 'Ayilyam', aliases: ['ashlesha', 'aayilyam', 'ayilyam'] },
  { index: 9, ta: 'மகம்', en: 'Magam', aliases: ['magha', 'makam'] },
  { index: 10, ta: 'பூரம்', en: 'Pooram', aliases: ['purva phalguni', 'puram'] },
  { index: 11, ta: 'உத்திரம்', en: 'Uthiram', aliases: ['uttara phalguni', 'uthram'] },
  { index: 12, ta: 'அஸ்தம்', en: 'Hastham', aliases: ['hasta', 'astham'] },
  { index: 13, ta: 'சித்திரை', en: 'Chithirai', aliases: ['chitra', 'chithra'] },
  { index: 14, ta: 'சுவாதி', en: 'Swathi', aliases: ['swati', 'suvathi'] },
  { index: 15, ta: 'விசாகம்', en: 'Visakam', aliases: ['vishakha', 'visakha', 'vishakam'] },
  { index: 16, ta: 'அனுஷம்', en: 'Anusham', aliases: ['anuradha', 'anusam'] },
  { index: 17, ta: 'கேட்டை', en: 'Kettai', aliases: ['jyeshtha', 'jyeshta'] },
  { index: 18, ta: 'மூலம்', en: 'Moolam', aliases: ['mula', 'moola'] },
  { index: 19, ta: 'பூராடம்', en: 'Pooradam', aliases: ['purva ashadha', 'puradam'] },
  { index: 20, ta: 'உத்திராடம்', en: 'Uthiradam', aliases: ['uttara ashadha', 'uthradam'] },
  { index: 21, ta: 'திருவோணம்', en: 'Thiruvonam', aliases: ['shravana', 'sravana', 'onam'] },
  { index: 22, ta: 'அவிட்டம்', en: 'Avittam', aliases: ['dhanishta', 'dhanishtha'] },
  { index: 23, ta: 'சதயம்', en: 'Sadhayam', aliases: ['shatabhisha', 'sathayam', 'chathayam'] },
  { index: 24, ta: 'பூரட்டாதி', en: 'Poorattathi', aliases: ['purva bhadrapada', 'purattathi'] },
  { index: 25, ta: 'உத்திரட்டாதி', en: 'Uthirattathi', aliases: ['uttara bhadrapada', 'uthrattathi'] },
  { index: 26, ta: 'ரேவதி', en: 'Revathi', aliases: ['revati'] },
];

const PADAMS_PER_STAR = 4;
const PADAMS_PER_RAASI = 9;

/** Display form used everywhere: Tamil first, English in brackets. */
export function astroLabel(item: AstroName | undefined | null): string {
  return item ? `${item.ta} (${item.en})` : '';
}

export const starName = (index: number | null | undefined) => (index == null ? undefined : STARS[index]);
export const raasiName = (index: number | null | undefined) => (index == null ? undefined : RAASIS[index]);

/** Padams (1–4) of `star` that fall inside `raasi`; empty if the star isn't in that Raasi. */
export function padamsInRaasi(star: number, raasi: number): number[] {
  const out: number[] = [];
  for (let p = 0; p < PADAMS_PER_STAR; p++) {
    const global = star * PADAMS_PER_STAR + p;
    if (Math.floor(global / PADAMS_PER_RAASI) === raasi) out.push(p + 1);
  }
  return out;
}

export function isValidCombination(raasi: number | null | undefined, star: number | null | undefined): boolean {
  if (raasi == null || star == null) return true;
  return padamsInRaasi(star, raasi).length > 0;
}

/** Stars that fall (fully or partly) in a Raasi, in order. */
export function starsInRaasi(raasi: number): AstroName[] {
  return STARS.filter((s) => padamsInRaasi(s.index, raasi).length > 0);
}

/** Raasis a star belongs to (one, or two when it straddles a boundary). */
export function raasisOfStar(star: number): number[] {
  return RAASIS.filter((r) => padamsInRaasi(star, r.index).length > 0).map((r) => r.index);
}

const ORDINAL = ['1st', '2nd', '3rd', '4th'];

/** e.g. "4th padam" or "padams 1–3"; empty when the whole star is in the Raasi. */
export function padamNote(star: number, raasi: number): string {
  const p = padamsInRaasi(star, raasi);
  if (p.length === 0 || p.length === PADAMS_PER_STAR) return '';
  if (p.length === 1) return `${ORDINAL[p[0] - 1]} padam`;
  return `padams ${p[0]}–${p[p.length - 1]}`;
}

/** Lower-cased text a search box matches against (Tamil, English and aliases). */
export function searchText(item: AstroName): string {
  return [item.ta, item.en, ...item.aliases].join(' ').toLowerCase();
}
