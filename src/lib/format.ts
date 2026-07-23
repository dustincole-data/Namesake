export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
/** First two slug chars, padded, for detail sharding. Non-letters -> '_'. */
export function shardKey(slug: string): string {
  const a = slug[0] ?? '_';
  const b = slug[1] ?? '_';
  return (/[a-z0-9]/.test(a) ? a : '_') + (/[a-z0-9]/.test(b) ? b : '_');
}

export function rankLabel(rank: number): string { return `#${rank}`; }
export function pct(x: number, dp = 1): string { return `${(x * 100).toFixed(dp)}%`; }

/** "1 in N" framing of a per-year birth share, for the chart scrub readout. */
export function oneInLabel(share: number): string {
  if (share <= 0) return 'no recorded use';
  const n = Math.round(1 / share);
  if (n >= 1_000_000) return 'fewer than 1 in a million';
  return `1 in ${n.toLocaleString('en-US')}`;
}
