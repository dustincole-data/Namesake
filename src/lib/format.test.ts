import { describe, it, expect } from 'vitest';
import { slugify, shardKey, rankLabel, pct, oneInLabel } from './format.ts';

describe('format', () => {
  it('slugify lowercases and dashes', () => { expect(slugify('Mary Jo')).toBe('mary-jo'); });
  it('shardKey takes first two slug chars', () => { expect(shardKey('dustin')).toBe('du'); });
  it('rankLabel prefixes #', () => { expect(rankLabel(123)).toBe('#123'); });
  it('pct rounds to given decimals', () => { expect(pct(0.992, 1)).toBe('99.2%'); });
  it('oneInLabel frames a share as 1 in N with thousands separators', () => {
    expect(oneInLabel(0.02)).toBe('1 in 50');
    expect(oneInLabel(0.0001)).toBe('1 in 10,000');
  });
  it('oneInLabel handles zero and vanishingly small shares', () => {
    expect(oneInLabel(0)).toBe('no recorded use');
    expect(oneInLabel(-1)).toBe('no recorded use');
    expect(oneInLabel(0.0000001)).toBe('fewer than 1 in a million');
  });
});
