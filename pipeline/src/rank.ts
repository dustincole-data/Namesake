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
