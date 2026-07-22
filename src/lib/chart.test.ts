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
  it('produces a path scaled to its own max', () => {
    expect(buildSparkPath([0, 500, 1000], 46, 18).startsWith('M')).toBe(true);
  });
});
