import { START_YEAR, END_YEAR } from '../../src/lib/types.ts';
import type { ArchetypeKey } from '../../src/lib/archetype.ts';

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

/**
 * Name-level archetype from the full per-year share series. Ordered checks,
 * first match wins (Sensor-Trust style). Thresholds are tunable after the first
 * 2025 run — mirror the pipeline's other "tune after first run" constants.
 */
export function classifyArchetype(shares: number[], peakYear: number): ArchetypeKey {
  const peak = Math.max(...shares, 0);
  if (peak === 0) return 'evergreen';
  const len = shares.length;
  const peakIdx = peakYear - START_YEAR;
  const recent = mean(shares.slice(-15));
  const early = mean(shares.slice(0, 15));
  const last = shares[len - 1];
  const window = shares.slice(Math.max(0, peakIdx - 3), peakIdx + 4);   // peakYear ± 3
  const concentration = sum(window) / (sum(shares) || 1);
  const troughAfter = Math.min(...shares.slice(peakIdx, Math.max(peakIdx + 1, len - 15)));

  if (recent < 0.10 * peak && concentration >= 0.50) return 'meteor';
  if (recent < 0.05 * peak && peakYear <= END_YEAR - 45) return 'ghost';
  if (recent >= 0.40 * peak && troughAfter <= 0.35 * peak && peakYear <= END_YEAR - 20) return 'comeback';
  if (last >= 0.80 * peak && recent > early) return 'riser';
  if (recent < 0.50 * peak) return 'faller';
  return 'evergreen';
}
