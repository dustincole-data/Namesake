import { START_YEAR, END_YEAR } from '../../src/lib/types.ts';

export type Trajectory = 'rising' | 'falling' | 'comeback' | 'faded' | 'steady';

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

export function classifyTrajectory(shares: number[], peakYear: number): Trajectory {
  const len = shares.length;
  const peak = Math.max(...shares, 0);
  if (peak === 0) return 'steady';
  const peakIdx = peakYear - START_YEAR;
  const recent = mean(shares.slice(-15));
  const early = mean(shares.slice(0, 15));
  const last = shares[len - 1];

  if (recent < 0.10 * peak && peakIdx < len - 30) return 'faded';
  const trough = Math.min(...shares.slice(peakIdx, len - 15));
  if (recent >= 0.5 * peak && trough < 0.35 * peak && peakIdx < len - 20) return 'comeback';
  if (last >= 0.85 * peak && recent > early) return 'rising';
  if (recent < 0.5 * peak) return 'falling';
  return 'steady';
}

function decade(year: number): string { return `${Math.floor(year / 10) * 10}s`; }

export function eraCaption(peakYear: number, trajectory: Trajectory): string {
  const d = decade(peakYear);
  switch (trajectory) {
    case 'faded':    return `A name that crested in the ${d} and has all but disappeared since.`;
    case 'falling':  return `A name that peaked in the ${d} and has been fading ever since.`;
    case 'comeback': return `A name that crested in the ${d}, fell away, and is climbing again.`;
    case 'rising':   return `A name on the rise, most common in the ${d} and still climbing.`;
    default:         return `A steady name, most common around the ${d}.`;
  }
}
