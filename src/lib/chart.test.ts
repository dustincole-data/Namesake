import { describe, it, expect } from 'vitest';
import { buildLinePath, buildSparkPath, xAtIndex, yAtValue, xToIndex, shareAt } from './chart.ts';

describe('buildLinePath', () => {
  it('starts with M, uses L for subsequent points, closes the area', () => {
    const { line, area } = buildLinePath([0, 1000], 1000, 380, 6);
    expect(line.startsWith('M')).toBe(true);
    expect(line).toContain('L');
    expect(area.trim().endsWith('Z')).toBe(true);
  });
  it('maps value 1000 near the top (small y) and 0 near the baseline', () => {
    const { line } = buildLinePath([0, 1000], 1000, 380, 6);
    const ys = [...line.matchAll(/[ML][\d.]+ ([\d.]+)/g)].map(m => Number(m[1]));
    expect(ys[1]).toBeLessThan(ys[0]); // 1000 -> higher up
  });
});

describe('buildSparkPath', () => {
  it('produces a path scaled to its own max, maps values correctly, and contains no NaN', () => {
    const path = buildSparkPath([0, 500, 1000], 46, 18);
    expect(path.startsWith('M')).toBe(true);
    expect(path).not.toContain('NaN');
    // Parse y-coordinates and verify max value (1000, 3rd point) is near top (small y ≈ 1.5)
    // and 0 value (1st point) is near bottom (y ≈ 16.5)
    const ys = [...path.matchAll(/[ML][\d.]+ ([\d.]+)/g)].map(m => Number(m[1]));
    expect(ys[2]).toBeLessThan(3); // 1000 near top
    expect(ys[0]).toBeGreaterThan(15); // 0 near bottom
    expect(ys[2]).toBeLessThan(ys[0]); // last point y < first point y
  });
  it('handles all-zero series without NaN', () => {
    const path = buildSparkPath([0, 0, 0], 46, 18);
    expect(path).not.toContain('NaN');
  });
  it('handles single-point series without NaN', () => {
    const { line, area } = buildLinePath([500], 1000, 380, 6);
    expect(line).not.toContain('NaN');
    expect(area).not.toContain('NaN');
  });
});

describe('scrub geometry helpers', () => {
  it('xToIndex is the inverse of xAtIndex across the series', () => {
    const n = 146, W = 1000, pad = 6;
    for (const i of [0, 1, 42, 100, n - 1]) {
      expect(xToIndex(xAtIndex(i, n, W, pad), n, W, pad)).toBe(i);
    }
  });
  it('xToIndex clamps out-of-range x to the endpoints', () => {
    expect(xToIndex(-500, 146, 1000, 6)).toBe(0);
    expect(xToIndex(9999, 146, 1000, 6)).toBe(145);
  });
  it('xToIndex returns 0 for a single-point series', () => {
    expect(xToIndex(500, 1, 1000, 6)).toBe(0);
  });
  it('yAtValue puts the max value near the top and 0 at the baseline', () => {
    expect(yAtValue(1000, 380, 6)).toBeLessThan(yAtValue(0, 380, 6));
    expect(yAtValue(0, 380, 6)).toBeCloseTo(380 - 6);
  });
  it('shareAt scales the normalized curve value by peak share', () => {
    expect(shareAt(1000, 0.02)).toBeCloseTo(0.02); // peak year = peak share
    expect(shareAt(500, 0.02)).toBeCloseTo(0.01);
    expect(shareAt(0, 0.02)).toBe(0);
  });
});
