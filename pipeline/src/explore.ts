import type { RawRecord, Sex } from '../../src/lib/types.ts';

export interface NameStat {
  name: string; slug: string; shares: number[];
  peakYear: number; peakShare: number; recentShare: number;
  troughAfterPeak: number; skewPct: number;
}

export function ghosts(names: NameStat[], k: number): NameStat[] {
  return names
    .filter(n => n.recentShare < 0.05 * n.peakShare && n.peakYear <= 1965)
    .sort((a, b) => b.peakShare - a.peakShare)
    .slice(0, k);
}

export function comebacks(names: NameStat[], k: number): NameStat[] {
  return names
    .filter(n => n.recentShare >= 0.5 * n.peakShare && n.troughAfterPeak < 0.35 * n.peakShare)
    .sort((a, b) => (b.recentShare / (b.troughAfterPeak || 1e-9)) - (a.recentShare / (a.troughAfterPeak || 1e-9)))
    .slice(0, k);
}

export function unisex(names: NameStat[], k: number): NameStat[] {
  return names
    .filter(n => n.skewPct <= 65)
    .sort((a, b) => b.peakShare - a.peakShare)
    .slice(0, k);
}

export function nameOfYear(records: RawRecord[]): Record<number, { M: string[]; F: string[] }> {
  const byYearSex = new Map<string, { name: string; count: number }[]>();
  for (const r of records) {
    const k = `${r.year} ${r.sex}`;
    (byYearSex.get(k) ?? byYearSex.set(k, []).get(k)!).push({ name: r.name, count: r.count });
  }
  const out: Record<number, { M: string[]; F: string[] }> = {};
  for (const [k, arr] of byYearSex) {
    const [yearStr, sex] = k.split(' ');
    const year = Number(yearStr);
    arr.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    (out[year] ??= { M: [], F: [] })[sex as Sex] = arr.slice(0, 3).map(e => e.name);
  }
  return out;
}
