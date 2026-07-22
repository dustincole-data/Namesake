import { describe, it, expect } from 'vitest';
import { shapeVector, cosine, topTwins } from '../src/twins.ts';

describe('twins', () => {
  it('shapeVector L2-normalizes (unit length)', () => {
    const v = shapeVector([3, 4]);
    expect(v[0]).toBeCloseTo(0.6);
    expect(v[1]).toBeCloseTo(0.8);
  });
  it('cosine of identical shapes is 1, orthogonal is 0', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it('topTwins returns nearest others, excluding self, sorted desc', () => {
    const vectors = new Map<string, number[]>([
      ['a', shapeVector([1, 0, 0])],
      ['b', shapeVector([0.9, 0.1, 0])],
      ['c', shapeVector([0, 0, 1])],
    ]);
    const t = topTwins('a', vectors, 2);
    expect(t[0].slug).toBe('b');
    expect(t.map(x => x.slug)).not.toContain('a');
    expect(t[0].sim).toBeGreaterThan(t[1].sim);
  });
});
