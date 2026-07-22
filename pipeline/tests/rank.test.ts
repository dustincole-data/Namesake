import { describe, it, expect } from 'vitest';
import type { RawRecord } from '../../src/lib/types.ts';
import { computeRanks, peakRankOf } from '../src/rank.ts';

const recs: RawRecord[] = [
  { name: 'Ann', sex: 'F', year: 1880, count: 100 },
  { name: 'Bea', sex: 'F', year: 1880, count: 300 },
  { name: 'Cyd', sex: 'F', year: 1880, count: 200 },
  { name: 'Ann', sex: 'F', year: 1881, count: 500 },
  { name: 'Bea', sex: 'F', year: 1881, count: 100 },
];
const key = (n: string, s: string) => `${n} ${s}`;

describe('computeRanks', () => {
  const ranks = computeRanks(recs);
  it('ranks within sex per year, 1 = most common', () => {
    expect(ranks.get(key('Bea', 'F'))!.get(1880)).toBe(1); // 300
    expect(ranks.get(key('Cyd', 'F'))!.get(1880)).toBe(2); // 200
    expect(ranks.get(key('Ann', 'F'))!.get(1880)).toBe(3); // 100
    expect(ranks.get(key('Ann', 'F'))!.get(1881)).toBe(1); // 500
  });
  it('peakRankOf returns the best (min) yearly rank', () => {
    expect(peakRankOf('Ann', 'F', ranks)).toBe(1);
    expect(peakRankOf('Cyd', 'F', ranks)).toBe(2);
  });
});
