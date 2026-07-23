import { describe, it, expect } from 'vitest';
import { badgeFor, countInYear, rankEquivName } from './reveal.ts';

// rise → peak(2005) → fall, startYear 2000
const rf = [0, 200, 400, 600, 800, 1000, 700, 400, 200, 100, 50];
// peak(2005) → deep dip → second rise (revival by 2010)
const rev = [0, 300, 600, 800, 900, 1000, 300, 150, 150, 500, 600];

describe('badgeFor', () => {
  it('the peak year itself is Peak', () => { expect(badgeFor(rf, 2000, 2005, 2005)).toBe('peak'); });
  it('within 2 years of the peak is Peak', () => { expect(badgeFor(rf, 2000, 2005, 2003)).toBe('peak'); });
  it('well before the peak is Early', () => { expect(badgeFor(rf, 2000, 2005, 2001)).toBe('early'); });
  it('well after the peak on the decline is Late', () => { expect(badgeFor(rf, 2000, 2005, 2009)).toBe('late'); });
  it('a post-peak second rise is Revival', () => { expect(badgeFor(rev, 2000, 2005, 2010)).toBe('revival'); });
});

describe('countInYear', () => {
  const births = Array(11).fill(1_000_000);
  it('reconstructs the peak-year count from curve × maxShare × births', () => {
    // curve/1000 = 1.0 at peak, maxShare 0.05, births 1e6 → 50,000
    expect(countInYear(rf, 0.05, births, 2000, 2005)).toBe(50_000);
  });
  it('scales down off-peak', () => {
    expect(countInYear(rf, 0.05, births, 2000, 2001)).toBe(10_000); // 0.2 × 0.05 × 1e6
  });
});

describe('rankEquivName', () => {
  const equiv = { M: ['Liam', 'Noah'], F: ['Olivia', 'Emma'] };
  it('maps a 1-based rank to today’s name', () => { expect(rankEquivName(equiv, 'M', 1)).toBe('Liam'); });
  it('returns null past the top-1000 table', () => { expect(rankEquivName(equiv, 'F', 3)).toBeNull(); });
  it('returns null for a non-finite peak rank', () => { expect(rankEquivName(equiv, 'M', Infinity)).toBeNull(); });
});
