import { describe, it, expect } from 'vitest';
import { classifyTrajectory, eraCaption } from '../src/caption.ts';
import { START_YEAR, END_YEAR } from '../../src/lib/types.ts';

const n = END_YEAR - START_YEAR + 1;
function gauss(mu: number, s: number) {
  return Array.from({ length: n }, (_, i) => Math.exp(-(((START_YEAR + i) - mu) ** 2) / (2 * s * s)));
}

describe('classifyTrajectory', () => {
  it('flags a mid-century bloom that vanished as faded', () => {
    const s = gauss(1935, 8);
    expect(classifyTrajectory(s, 1935)).toBe('faded');
  });
  it('flags a name still near its peak at the end as rising', () => {
    const s = gauss(2020, 12);
    expect(classifyTrajectory(s, 2020)).toBe('rising');
  });
  it('flags an old peak with a deep post-peak trough and a recent revival as comeback', () => {
    // Peak in 1940 (well before the ~2005 comeback cutoff), decays to near-zero
    // through the mid-century trough window, then a smaller recent bump (~2018)
    // pulls the last-15-year average back up to >=50% of the 1940 peak.
    const main = gauss(1940, 8);
    const revival = gauss(2018, 10).map((v) => v * 0.6);
    const s = main.map((v, i) => v + revival[i]);
    expect(classifyTrajectory(s, 1940)).toBe('comeback');
  });
  it('flags a slow multi-decade decline that never goes near-zero as falling', () => {
    // Wide, shallow gaussian: recent average drops below 50% of peak but the
    // peak isn't more than ~30 years before the end, so the faded branch (which
    // needs recent < 10% of peak) doesn't trigger.
    const s = gauss(1970, 25);
    expect(classifyTrajectory(s, 1970)).toBe('falling');
  });
  it('flags a flat, unchanging share as steady', () => {
    const s = Array(n).fill(1);
    expect(classifyTrajectory(s, 1950)).toBe('steady');
  });
});

describe('eraCaption', () => {
  it('names the peak decade and the arc', () => {
    expect(eraCaption(1985, 'faded')).toMatch(/1980s/);
    expect(eraCaption(1985, 'faded')).toMatch(/faded|since/i);
  });
  it('always returns a non-empty sentence', () => {
    for (const t of ['rising', 'falling', 'comeback', 'faded', 'steady'] as const) {
      expect(eraCaption(1950, t).length).toBeGreaterThan(10);
    }
  });
});
