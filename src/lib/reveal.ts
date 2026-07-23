// Birth-year reveal logic — shared by the server page (BirthYearReveal.astro),
// the client long-tail render (lookup.ts), and tests. Pure functions only.
// `curve` is the payload curve: per-year share normalized to the name's own max,
// ints 0..1000, so curve[peakIdx] === 1000.

export type BadgeKey = 'peak' | 'revival' | 'early' | 'late';

export const BADGES: Record<BadgeKey, { label: string; line: string }> = {
  peak:    { label: 'Peak',    line: 'You rode the crest.' },
  revival: { label: 'Revival', line: 'You caught the comeback.' },
  early:   { label: 'Early',   line: 'You were an early adopter.' },
  late:    { label: 'Late',    line: 'It was a classic by your time.' },
};

/** Classify a birth year against the name's curve. Ordered; first match wins. */
export function badgeFor(curve: number[], startYear: number, peakYear: number, birthYear: number): BadgeKey {
  const i = birthYear - startYear;
  const c = (curve[i] ?? 0) / 1000;                       // 0..1 relative to the name's own peak
  if (c >= 0.80 || Math.abs(birthYear - peakYear) <= 2) return 'peak';
  if (birthYear > peakYear) {
    const between = curve.slice(peakYear - startYear, i + 1);
    const trough = between.length ? Math.min(...between) : 0;
    if (c >= 0.45 && trough <= 350) return 'revival';     // dipped to <=0.35 then back up by birth year
    return 'late';
  }
  return 'early';
}

/**
 * Reconstruct approximate U.S. births of this name in `year` from data that
 * already ships: normalized curve + the name's peak share + the global per-year
 * total-births array. count(y) = share(y) * births(y), share(y) = curve/1000 * maxShare.
 */
export function countInYear(curve: number[], maxShare: number, births: number[], startYear: number, year: number): number {
  const i = year - startYear;
  const share = ((curve[i] ?? 0) / 1000) * maxShare;
  return Math.round(share * (births[i] ?? 0));
}

/** Modern rank-equivalent: which name holds this name's best historical rank today. */
export function rankEquivName(equiv: { M: string[]; F: string[] }, sex: 'M' | 'F', peakRank: number): string | null {
  if (!Number.isFinite(peakRank) || peakRank < 1) return null;
  return equiv[sex][peakRank - 1] ?? null;   // null => outside today's top 1000
}
