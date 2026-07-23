import { describe, it, expect } from 'vitest';
import { buildLinePath, buildSparkPath } from './chart.ts';

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
