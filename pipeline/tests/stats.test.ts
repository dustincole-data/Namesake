import { describe, it, expect } from 'vitest';
import type { RawRecord } from '../../src/lib/types.ts';
import { indexRecords, shareCurve, normalizeCurve, peakYearOf, medianBirthYear, skewOf } from '../src/stats.ts';

// Minimal 3-year world (pretend START_YEAR..START_YEAR+2 by using real years near start)
const recs: RawRecord[] = [
  { name: 'Ann', sex: 'F', year: 1880, count: 100 },
  { name: 'Ann', sex: 'F', year: 1881, count: 300 },
  { name: 'Ann', sex: 'M', year: 1881, count: 100 },
  { name: 'Bob', sex: 'M', year: 1880, count: 900 },
  { name: 'Bob', sex: 'M', year: 1881, count: 600 },
];

describe('indexRecords', () => {
  it('aggregates per-name per-sex per-year and yearly totals', () => {
    const { aggs, totalBirthsByYear } = indexRecords(recs);
    expect(aggs.get('Ann')!.totalBySex).toEqual({ M: 100, F: 400 });
    expect(totalBirthsByYear.get(1880)).toBe(1000); // 100 + 900
    expect(totalBirthsByYear.get(1881)).toBe(1000); // 300 + 100 + 600
  });
});

describe('stats', () => {
  const { aggs, totalBirthsByYear } = indexRecords(recs);
  it('shareCurve = name total / all births that year', () => {
    const c = shareCurve(aggs.get('Ann')!, totalBirthsByYear);
    expect(c[0]).toBeCloseTo(100 / 1000);   // 1880
    expect(c[1]).toBeCloseTo(400 / 1000);   // 1881 (300F+100M)
  });
  it('normalizeCurve scales own max to 1000', () => {
    expect(normalizeCurve([0.1, 0.4, 0])).toEqual([250, 1000, 0]);
  });
  it('peakYearOf returns the year of max share', () => {
    expect(peakYearOf(shareCurve(aggs.get('Ann')!, totalBirthsByYear))).toBe(1881);
  });
  it('medianBirthYear is the year crossing half of cumulative births', () => {
    // Ann totals: 1880=100, 1881=400; cumulative half=250 -> reached in 1881
    expect(medianBirthYear(aggs.get('Ann')!)).toBe(1881);
  });
  it('skewOf picks the dominant sex and its percentage', () => {
    const s = skewOf(aggs.get('Ann')!);
    expect(s.dominantSex).toBe('F');
    expect(s.pct).toBeCloseTo(80.0); // 400 / 500
    expect(s.total).toBe(500);
  });
});
