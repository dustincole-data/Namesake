import type { RawRecord, Sex } from '../../src/lib/types.ts';

const key = (name: string, sex: Sex) => `${name} ${sex}`;

export function computeRanks(records: RawRecord[]): Map<string, Map<number, number>> {
  // group counts by year+sex
  const byYearSex = new Map<string, { name: string; count: number }[]>();
  for (const r of records) {
    const k = `${r.year} ${r.sex}`;
    (byYearSex.get(k) ?? byYearSex.set(k, []).get(k)!).push({ name: r.name, count: r.count });
  }
  const ranks = new Map<string, Map<number, number>>();
  for (const [k, arr] of byYearSex) {
    const [yearStr, sex] = k.split(' ');
    const year = Number(yearStr);
    arr.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    arr.forEach((e, i) => {
      const kk = key(e.name, sex as Sex);
      (ranks.get(kk) ?? ranks.set(kk, new Map()).get(kk)!).set(year, i + 1);
    });
  }
  return ranks;
}

export function peakRankOf(name: string, sex: Sex, ranks: Map<string, Map<number, number>>): number {
  const m = ranks.get(key(name, sex));
  if (!m) return Infinity;
  return Math.min(...m.values());
}

/**
 * rank (1-based) -> name for a single year, per sex, top k. Same tie-break as
 * computeRanks (count desc, then name asc) so equiv[peakRank-1] aligns with the
 * rank a name earned. Powers the modern rank-equivalent lookup.
 */
export function rankNamesForYear(records: RawRecord[], year: number, k = 1000): { M: string[]; F: string[] } {
  const bySex: Record<Sex, { name: string; count: number }[]> = { M: [], F: [] };
  for (const r of records) if (r.year === year) bySex[r.sex].push({ name: r.name, count: r.count });
  const top = (arr: { name: string; count: number }[]) =>
    arr.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, k).map(e => e.name);
  return { M: top(bySex.M), F: top(bySex.F) };
}
