/** x-pixel of data index i within the plot area (inverse: {@link xToIndex}). */
export function xAtIndex(i: number, n: number, W: number, pad: number): number {
  const denom = n > 1 ? n - 1 : 1;
  return pad + (i / denom) * (W - pad * 2);
}
/** y-pixel of a curve value (ints 0..1000); 1000 sits near the top. */
export function yAtValue(v: number, H: number, pad: number): number {
  return H - pad - (v / 1000) * (H - pad * 2);
}
/** Nearest data index for an x-pixel in viewBox coords (inverse of {@link xAtIndex}). */
export function xToIndex(px: number, n: number, W: number, pad: number): number {
  if (n <= 1) return 0;
  const frac = (px - pad) / (W - pad * 2);
  return Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))));
}
/** Per-year share of all U.S. births: normalized curve value × the name's peak share. */
export function shareAt(curveVal: number, maxShare: number): number {
  return (curveVal / 1000) * maxShare;
}

export function buildLinePath(values: number[], W: number, H: number, pad: number) {
  const n = values.length;
  const xAt = (i: number) => xAtIndex(i, n, W, pad);
  const yAt = (v: number) => yAtValue(v, H, pad);
  let line = '';
  values.forEach((v, i) => { line += (i ? 'L' : 'M') + xAt(i).toFixed(1) + ' ' + yAt(v).toFixed(1) + ' '; });
  const area = line + 'L' + xAt(n - 1).toFixed(1) + ' ' + (H - pad).toFixed(1) + ' L' + xAt(0).toFixed(1) + ' ' + (H - pad).toFixed(1) + ' Z';
  return { line, area };
}

export function buildSparkPath(values: number[], w: number, h: number): string {
  const n = values.length;
  const denom = n > 1 ? n - 1 : 1;
  const max = Math.max(...values, 1);
  let d = '';
  values.forEach((v, i) => {
    const x = (i / denom) * w;
    const y = h - (v / max) * (h - 3) - 1.5;
    d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
  });
  return d;
}
