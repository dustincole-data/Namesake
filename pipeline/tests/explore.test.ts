import { describe, it, expect } from 'vitest';
import type { RawRecord } from '../../src/lib/types.ts';
import { ghosts, comebacks, unisex, nameOfYear, type NameStat } from '../src/explore.ts';

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
  it('comebacks: ranks multiple qualifying candidates by recovery ratio (recentShare/troughAfterPeak) desc', () => {
    const c = comebacks([
      // Deliberately out of order: weakest ratio listed first, strongest in the middle.
      mk({ name: 'Ivy', slug: 'ivy', peakShare: 1, recentShare: 0.6, troughAfterPeak: 0.3 }), // ratio 2.0
      mk({ name: 'Hazel', slug: 'hazel', peakShare: 1, recentShare: 0.8, troughAfterPeak: 0.05 }), // ratio 16
      mk({ name: 'Nora', slug: 'nora', peakShare: 1, recentShare: 0.55, troughAfterPeak: 0.1 }), // ratio 5.5
    ], 5);
    expect(c.map(x => x.slug)).toEqual(['hazel', 'nora', 'ivy']);
  });
  it('unisex: filters skewPct<=65 and sorts survivors by peakShare desc', () => {
    const u = unisex([
      mk({ name: 'Jordan', slug: 'jordan', skewPct: 55, peakShare: 0.5 }),
      mk({ name: 'Riley', slug: 'riley', skewPct: 65, peakShare: 0.9 }), // boundary: 65 is inclusive
      mk({ name: 'Skylar', slug: 'skylar', skewPct: 60, peakShare: 0.3 }),
      mk({ name: 'Mary', slug: 'mary', skewPct: 99, peakShare: 1 }), // excluded: skew above 65
    ], 5);
    expect(u.map(x => x.slug)).toEqual(['riley', 'jordan', 'skylar']);
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
