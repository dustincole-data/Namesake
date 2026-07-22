import type { RawRecord, NameAgg, Sex } from '../../src/lib/types.ts';
import { START_YEAR, END_YEAR } from '../../src/lib/types.ts';

export function indexRecords(records: RawRecord[]) {
  const aggs = new Map<string, NameAgg>();
  const totalBirthsByYear = new Map<number, number>();
  for (const r of records) {
    let a = aggs.get(r.name);
    if (!a) { a = { name: r.name, bySexYear: { M: new Map(), F: new Map() }, totalBySex: { M: 0, F: 0 } }; aggs.set(r.name, a); }
    a.bySexYear[r.sex].set(r.year, (a.bySexYear[r.sex].get(r.year) ?? 0) + r.count);
    a.totalBySex[r.sex] += r.count;
    totalBirthsByYear.set(r.year, (totalBirthsByYear.get(r.year) ?? 0) + r.count);
  }
  return { aggs, totalBirthsByYear };
}

const nYears = END_YEAR - START_YEAR + 1;

function totalByYear(agg: NameAgg, year: number): number {
  return (agg.bySexYear.M.get(year) ?? 0) + (agg.bySexYear.F.get(year) ?? 0);
}

export function shareCurve(agg: NameAgg, totalBirthsByYear: Map<number, number>): number[] {
  const out = new Array(nYears).fill(0);
  for (let i = 0; i < nYears; i++) {
    const y = START_YEAR + i;
    const denom = totalBirthsByYear.get(y) ?? 0;
    out[i] = denom ? totalByYear(agg, y) / denom : 0;
  }
  return out;
}

export function normalizeCurve(shares: number[]): number[] {
  const max = Math.max(...shares, 0);
  if (max === 0) return shares.map(() => 0);
  return shares.map(v => Math.round((v / max) * 1000));
}

export function peakYearOf(shares: number[]): number {
  let bi = 0;
  for (let i = 1; i < shares.length; i++) if (shares[i] > shares[bi]) bi = i;
  return START_YEAR + bi;
}

export function medianBirthYear(agg: NameAgg): number {
  const total = agg.totalBySex.M + agg.totalBySex.F;
  const half = total / 2;
  let cum = 0;
  for (let y = START_YEAR; y <= END_YEAR; y++) {
    cum += totalByYear(agg, y);
    if (cum >= half) return y;
  }
  return END_YEAR;
}

export function skewOf(agg: NameAgg): { dominantSex: Sex; pct: number; total: number } {
  const { M, F } = agg.totalBySex;
  const total = M + F;
  const dominantSex: Sex = F >= M ? 'F' : 'M';
  const pct = total ? Math.round((agg.totalBySex[dominantSex] / total) * 1000) / 10 : 0;
  return { dominantSex, pct, total };
}
