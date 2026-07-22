export function buildLinePath(values: number[], W: number, H: number, pad: number) {
  const n = values.length;
  const xAt = (i: number) => pad + (i / (n - 1)) * (W - pad * 2);
  const yAt = (v: number) => H - pad - (v / 1000) * (H - pad * 2);
  let line = '';
  values.forEach((v, i) => { line += (i ? 'L' : 'M') + xAt(i).toFixed(1) + ' ' + yAt(v).toFixed(1) + ' '; });
  const area = line + 'L' + xAt(n - 1).toFixed(1) + ' ' + (H - pad) + ' L' + xAt(0).toFixed(1) + ' ' + (H - pad) + ' Z';
  return { line, area };
}

export function buildSparkPath(values: number[], w: number, h: number): string {
  const n = values.length;
  const max = Math.max(...values, 1);
  let d = '';
  values.forEach((v, i) => {
    const x = (i / (n - 1)) * w;
    const y = h - (v / max) * (h - 3) - 1.5;
    d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
  });
  return d;
}
