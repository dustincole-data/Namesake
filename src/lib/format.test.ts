import { describe, it, expect } from 'vitest';
import { slugify, shardKey, rankLabel, pct } from './format.ts';

describe('format', () => {
  it('slugify lowercases and dashes', () => { expect(slugify('Mary Jo')).toBe('mary-jo'); });
  it('shardKey takes first two slug chars', () => { expect(shardKey('dustin')).toBe('du'); });
  it('rankLabel prefixes #', () => { expect(rankLabel(123)).toBe('#123'); });
  it('pct rounds to given decimals', () => { expect(pct(0.992, 1)).toBe('99.2%'); });
});
