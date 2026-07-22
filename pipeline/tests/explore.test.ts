import { describe, it, expect } from 'vitest';
import type { RawRecord } from '../../src/lib/types.ts';
import { ghosts, comebacks, nameOfYear, type NameStat } from '../src/explore.ts';

const mk = (over: Partial<NameStat>): NameStat => ({
  name: 'X', slug: 'x', shares: [], peakYear: 1900, peakShare: 1,
  recentShare: 0, troughAfterPeak: 0, skewPct: 100, ...over,
});

describe('explore', () => {
  it('ghosts: big old peak, ~zero now', () => {
    const g = ghosts([
      mk({ name: 'Bertha', slug: 'bertha', peakYear: 1900, peakShare: 1, recentShare: 0.01 }),
      mk({ name: 'Emma', slug: 'emma', peakYear: 2005, peakShare: 1, recentShare: 0.9 }),
    ], 5);
    expect(g.map(x => x.slug)).toEqual(['bertha']);
  });
  it('comebacks: fell to a trough then recovered', () => {
    const c = comebacks([
      mk({ name: 'Hazel', slug: 'hazel', peakShare: 1, recentShare: 0.8, troughAfterPeak: 0.05 }),
      mk({ name: 'Gary', slug: 'gary', peakShare: 1, recentShare: 0.1, troughAfterPeak: 0.05 }),
    ], 5);
    expect(c.map(x => x.slug)).toEqual(['hazel']);
  });
  it('nameOfYear: top 3 names per sex per year, count desc', () => {
    const recs: RawRecord[] = [
      { name: 'Mary', sex: 'F', year: 1880, count: 100 },
      { name: 'Anna', sex: 'F', year: 1880, count: 90 },
      { name: 'John', sex: 'M', year: 1880, count: 80 },
    ];
    expect(nameOfYear(recs)[1880]).toEqual({ M: ['John'], F: ['Mary', 'Anna'] });
  });
});
