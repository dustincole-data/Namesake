/** Canvas craft primitives for the foam field. Colour in OKLCH so chroma can be rationed
 *  without lightness drifting, plus the texture and noise the marks are drawn with. */

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

/** low-frequency value noise, 1D — nothing on a drawn page is true */
export function noise1(seed: number) {
  const r = rng(seed), n = 256, t = new Float64Array(n);
  for (let i = 0; i < n; i++) t[i] = r() * 2 - 1;
  return (x: number) => {
    const i = Math.floor(x), f = x - i;
    const a = t[((i % n) + n) % n], b = t[(((i + 1) % n) + n) % n];
    const u = f * f * (3 - 2 * f);
    return a * (1 - u) + b * u;
  };
}

export interface Lch { L: number; C: number; h: number; }

const srgb = (v: number) => {
  v = clamp(v, 0, 1);
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
};

export function oklch(L: number, C: number, hDeg: number, alpha = 1): string {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const B = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const c = (v: number) => Math.round(srgb(v) * 255);
  return alpha >= 1 ? `rgb(${c(R)},${c(G)},${c(B)})` : `rgba(${c(R)},${c(G)},${c(B)},${alpha})`;
}

/** mix one oklch triple toward another — how chroma gets rationed toward the ground */
export function towards(a: Lch, b: Lch, t: number): Lch {
  let dh = b.h - a.h;
  while (dh > 180) dh -= 360;
  while (dh < -180) dh += 360;
  return { L: a.L + (b.L - a.L) * t, C: a.C + (b.C - a.C) * t, h: a.h + dh * t };
}

export const css = (o: Lch, alpha = 1) => oklch(o.L, o.C, o.h, alpha);

export interface Speck { poly: [number, number][]; alpha: number; }

/** many translucent irregular marks, never a flat fill — as geometry, so the share card
 *  (satori, no canvas) grains its marks from the same generator the page does */
export function speckShapes(
  cx: number, cy: number, r: number, count: number, rand: () => number,
  { rMin = 0.6, rMax = 2.4, aMin = 0.06, aMax = 0.34 } = {},
): Speck[] {
  const out: Speck[] = [];
  for (let i = 0; i < count; i++) {
    const t = rand(), ang = rand() * Math.PI * 2;
    const rr = r * Math.sqrt(t);
    const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
    const s = rMin + rand() * (rMax - rMin);
    const alpha = aMin + rand() * (aMax - aMin);
    const poly: [number, number][] = [];
    const pts = 5 + ((rand() * 3) | 0);
    for (let p = 0; p <= pts; p++) {
      const a2 = (p / pts) * Math.PI * 2, rad = s * (0.62 + rand() * 0.72);
      poly.push([x + Math.cos(a2) * rad, y + Math.sin(a2) * rad]);
    }
    out.push({ poly, alpha });
  }
  return out;
}

export function speckle(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, count: number,
  colour: string, rand: () => number,
  opts: { rMin?: number; rMax?: number; aMin?: number; aMax?: number } = {},
) {
  ctx.fillStyle = colour;
  for (const { poly, alpha } of speckShapes(cx, cy, r, count, rand, opts)) {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (let p = 0; p < poly.length; p++) p ? ctx.lineTo(poly[p][0], poly[p][1]) : ctx.moveTo(poly[p][0], poly[p][1]);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** grain over everything, so no area of the page is perfectly flat */
export function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount = 9, seed = 7) {
  const img = ctx.createImageData(w, h), d = img.data, r = rng(seed);
  for (let i = 0; i < d.length; i += 4) {
    const v = (r() * 2 - 1) * amount;
    d[i] = d[i + 1] = d[i + 2] = 128 + v;
    d[i + 3] = 15;
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d')!.putImageData(img, 0, 0);
  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(c, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}
