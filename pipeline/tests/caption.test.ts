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
