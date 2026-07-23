import { describe, it, expect } from 'vitest';
import { classifyArchetype } from '../src/archetype.ts';
import { START_YEAR, END_YEAR } from '../../src/lib/types.ts';

const n = END_YEAR - START_YEAR + 1;
function gauss(mu: number, s: number) {
  return Array.from({ length: n }, (_, i) => Math.exp(-(((START_YEAR + i) - mu) ** 2) / (2 * s * s)));
}

describe('classifyArchetype', () => {
  it('a narrow, long-gone fad spike is a Meteor', () => {
    expect(classifyArchetype(gauss(1955, 3), 1955)).toBe('meteor');
  });
  it('a broad old peak that vanished is a Ghost', () => {
    expect(classifyArchetype(gauss(1920, 8), 1920)).toBe('ghost');
  });
  it('an old peak with a deep trough and a recent revival is a Comeback', () => {
    const main = gauss(1940, 8);
    const revival = gauss(2018, 10).map((v) => v * 0.6);
    expect(classifyArchetype(main.map((v, i) => v + revival[i]), 1940)).toBe('comeback');
  });
  it('a name near its all-time high now is a Riser', () => {
    expect(classifyArchetype(gauss(2020, 12), 2020)).toBe('riser');
  });
  it('a wide, shallow multi-decade decline is a Faller', () => {
    expect(classifyArchetype(gauss(1970, 25), 1970)).toBe('faller');
  });
  it('a flat, unchanging share is an Evergreen', () => {
    expect(classifyArchetype(Array(n).fill(1), 1950)).toBe('evergreen');
  });
});
