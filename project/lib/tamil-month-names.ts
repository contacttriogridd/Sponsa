/** Tamil month and thithi names (no astronomy code, so forms can load them cheaply). */

export const TAMIL_MONTHS = [
  { ta: 'சித்திரை', en: 'Chithirai' }, { ta: 'வைகாசி', en: 'Vaikasi' }, { ta: 'ஆனி', en: 'Aani' },
  { ta: 'ஆடி', en: 'Aadi' }, { ta: 'ஆவணி', en: 'Aavani' }, { ta: 'புரட்டாசி', en: 'Purattasi' },
  { ta: 'ஐப்பசி', en: 'Aippasi' }, { ta: 'கார்த்திகை', en: 'Karthigai' }, { ta: 'மார்கழி', en: 'Margazhi' },
  { ta: 'தை', en: 'Thai' }, { ta: 'மாசி', en: 'Maasi' }, { ta: 'பங்குனி', en: 'Panguni' },
];

const THITHI_NAMES = [
  { ta: 'பிரதமை', en: 'Prathamai' }, { ta: 'துவிதியை', en: 'Dwitiyai' }, { ta: 'திருதியை', en: 'Tritiyai' },
  { ta: 'சதுர்த்தி', en: 'Chaturthi' }, { ta: 'பஞ்சமி', en: 'Panchami' }, { ta: 'சஷ்டி', en: 'Sashti' },
  { ta: 'சப்தமி', en: 'Saptami' }, { ta: 'அஷ்டமி', en: 'Ashtami' }, { ta: 'நவமி', en: 'Navami' },
  { ta: 'தசமி', en: 'Dasami' }, { ta: 'ஏகாதசி', en: 'Ekadasi' }, { ta: 'துவாதசி', en: 'Dwadasi' },
  { ta: 'திரயோதசி', en: 'Trayodasi' }, { ta: 'சதுர்த்தசி', en: 'Chaturdasi' },
];

/** All 30 thithis in order, with their paksha. */
export const THITHIS = Array.from({ length: 30 }, (_, i) => {
  if (i === 14) return { index: i, ta: 'பௌர்ணமி', en: 'Pournami', paksha: 'valarpirai' as const };
  if (i === 29) return { index: i, ta: 'அமாவாசை', en: 'Amavasai', paksha: 'theipirai' as const };
  const n = THITHI_NAMES[i % 15];
  return i < 15
    ? { index: i, ta: `வளர்பிறை ${n.ta}`, en: `Valarpirai ${n.en}`, paksha: 'valarpirai' as const }
    : { index: i, ta: `தேய்பிறை ${n.ta}`, en: `Theipirai ${n.en}`, paksha: 'theipirai' as const };
});
