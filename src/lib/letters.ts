/**
 * A hand-inked alphabet, drawn — not set.
 *
 * The page is about names, and a name is made of letters, so the letter is the one thing on
 * this page that had to be made rather than rendered. A font glyph filled at 5% is not a
 * drawn object; it is a watermark, and it reads as one.
 *
 * Each capital is a skeleton — the path a pen actually takes, one entry per pen-down — and
 * it is inked by a nib walked along that path: the width at every step comes from the angle
 * of travel against a fixed nib angle, so a down-right stroke is broad and an up-right one
 * is thin, exactly as a chisel pen behaves. The centreline is displaced by low-frequency
 * noise, so no two instances of the same letter are the same shape, and every letter is
 * struck twice slightly off-register the way a hand goes round a form a second time.
 *
 * The same letterforms carry the key at the foot of the page and the deboss inside the
 * largest marks: the key is the mark, at mark size, saying what its colour means.
 */
import { noise1, clamp } from './draw.ts';

type Pt = [number, number];
/** c: 0 polyline (corners stay corners) · 1 smooth open · 2 smooth closed */
interface Stroke { p: Pt[]; c?: 0 | 1 | 2; }

const L = (p: Pt[]): Stroke => ({ p, c: 0 });
const S = (p: Pt[]): Stroke => ({ p, c: 1 });
const O = (p: Pt[]): Stroke => ({ p, c: 2 });

/** skeletons in a unit cap box: x from 0, y 0 = cap line, y 1 = baseline */
const GLYPHS: Record<string, Stroke[]> = {
  A: [L([[0.03, 1], [0.35, 0.02]]), L([[0.35, 0.02], [0.67, 1]]), L([[0.14, 0.68], [0.56, 0.68]])],
  B: [L([[0.10, 0.02], [0.10, 0.99]]),
      S([[0.10, 0.02], [0.42, 0.04], [0.55, 0.24], [0.40, 0.47], [0.10, 0.50]]),
      S([[0.10, 0.50], [0.48, 0.53], [0.62, 0.74], [0.44, 0.97], [0.10, 0.99]])],
  C: [S([[0.66, 0.19], [0.52, 0.04], [0.28, 0.02], [0.09, 0.24], [0.07, 0.60], [0.22, 0.93], [0.50, 0.99], [0.68, 0.86]])],
  D: [L([[0.10, 0.02], [0.10, 0.99]]),
      S([[0.10, 0.02], [0.40, 0.05], [0.60, 0.28], [0.60, 0.72], [0.40, 0.96], [0.10, 0.99]])],
  E: [L([[0.11, 0.02], [0.11, 0.99]]), L([[0.11, 0.03], [0.60, 0.00]]),
      L([[0.11, 0.51], [0.50, 0.49]]), L([[0.11, 0.98], [0.63, 1.00]])],
  F: [L([[0.11, 0.02], [0.11, 0.99]]), L([[0.11, 0.03], [0.60, 0.00]]), L([[0.11, 0.51], [0.49, 0.49]])],
  G: [S([[0.66, 0.19], [0.52, 0.04], [0.28, 0.02], [0.09, 0.24], [0.07, 0.62], [0.24, 0.95], [0.52, 0.98], [0.68, 0.80], [0.68, 0.60]]),
      L([[0.68, 0.60], [0.44, 0.60]])],
  H: [L([[0.09, 0.01], [0.09, 0.99]]), L([[0.61, 0.01], [0.61, 0.99]]), L([[0.09, 0.52], [0.61, 0.49]])],
  I: [L([[0.17, 0.01], [0.17, 0.99]])],
  J: [S([[0.58, 0.01], [0.58, 0.72], [0.46, 0.96], [0.24, 0.98], [0.11, 0.82]])],
  K: [L([[0.10, 0.01], [0.10, 0.99]]), L([[0.62, 0.02], [0.12, 0.58]]), L([[0.29, 0.44], [0.66, 0.99]])],
  L: [L([[0.12, 0.01], [0.12, 0.98]]), L([[0.12, 0.98], [0.60, 1.00]])],
  M: [L([[0.05, 0.99], [0.09, 0.02]]), L([[0.09, 0.02], [0.38, 0.70]]),
      L([[0.38, 0.70], [0.66, 0.02]]), L([[0.66, 0.02], [0.71, 0.99]])],
  N: [L([[0.09, 0.99], [0.09, 0.01]]), L([[0.09, 0.01], [0.62, 0.97]]), L([[0.62, 0.97], [0.62, 0.02]])],
  O: [O([[0.36, 0.01], [0.58, 0.13], [0.67, 0.46], [0.58, 0.85], [0.35, 0.99], [0.13, 0.86], [0.05, 0.50], [0.13, 0.14]])],
  P: [L([[0.10, 0.02], [0.10, 0.99]]),
      S([[0.10, 0.02], [0.44, 0.04], [0.58, 0.25], [0.42, 0.50], [0.10, 0.52]])],
  Q: [O([[0.36, 0.01], [0.58, 0.13], [0.67, 0.46], [0.58, 0.85], [0.35, 0.99], [0.13, 0.86], [0.05, 0.50], [0.13, 0.14]]),
      S([[0.44, 0.70], [0.60, 0.90], [0.74, 1.05]])],
  R: [L([[0.10, 0.02], [0.10, 0.99]]),
      S([[0.10, 0.02], [0.44, 0.04], [0.57, 0.25], [0.41, 0.49], [0.10, 0.51]]),
      L([[0.32, 0.51], [0.65, 0.99]])],
  S: [S([[0.63, 0.17], [0.46, 0.02], [0.22, 0.05], [0.12, 0.24], [0.28, 0.43], [0.50, 0.54], [0.62, 0.74], [0.50, 0.95], [0.24, 0.98], [0.08, 0.85]])],
  T: [L([[0.04, 0.03], [0.66, 0.00]]), L([[0.35, 0.02], [0.35, 0.99]])],
  U: [S([[0.09, 0.01], [0.09, 0.68], [0.24, 0.94], [0.48, 0.97], [0.63, 0.71], [0.63, 0.01]])],
  V: [L([[0.04, 0.01], [0.35, 0.99]]), L([[0.35, 0.99], [0.66, 0.01]])],
  W: [L([[0.03, 0.01], [0.19, 0.99]]), L([[0.19, 0.99], [0.39, 0.30]]),
      L([[0.39, 0.30], [0.59, 0.99]]), L([[0.59, 0.99], [0.76, 0.01]])],
  X: [L([[0.07, 0.01], [0.63, 0.99]]), L([[0.63, 0.01], [0.07, 0.99]])],
  Y: [L([[0.06, 0.01], [0.35, 0.50]]), L([[0.64, 0.01], [0.35, 0.50]]), L([[0.35, 0.50], [0.35, 0.99]])],
  Z: [L([[0.07, 0.03], [0.63, 0.01]]), L([[0.63, 0.01], [0.09, 0.97]]), L([[0.09, 0.97], [0.66, 0.99]])],
};

/** advance width of a glyph in cap units — measured off its own skeleton, never assumed */
const widths = new Map<string, number>();
export function glyphWidth(ch: string): number {
  const k = ch.toUpperCase();
  if (widths.has(k)) return widths.get(k)!;
  const g = GLYPHS[k];
  let w = 0.6;
  if (g) { w = 0; for (const s of g) for (const [x] of s.p) if (x > w) w = x; w += 0.05; }
  widths.set(k, w);
  return w;
}
export const hasGlyph = (ch: string) => !!GLYPHS[ch.toUpperCase()];

const catmull = (a: Pt, b: Pt, c: Pt, d: Pt, t: number, i: 0 | 1) => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * b[i]) + (-a[i] + c[i]) * t +
    (2 * a[i] - 5 * b[i] + 4 * c[i] - d[i]) * t2 + (-a[i] + 3 * b[i] - 3 * c[i] + d[i]) * t3);
};

/** the pen's path, resampled: curves smoothed through their control points, polylines left
 *  with their corners — a hand does not round the apex of an A */
function samples(st: Stroke, per: number): Pt[] {
  const p = st.p, n = p.length, out: Pt[] = [];
  if (st.c) {
    const closed = st.c === 2;
    const at = (i: number) => closed ? p[((i % n) + n) % n] : p[clamp(i, 0, n - 1)];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const steps = Math.max(3, Math.round(Math.hypot(at(i + 1)[0] - at(i)[0], at(i + 1)[1] - at(i)[1]) * per));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        out.push([catmull(at(i - 1), at(i), at(i + 1), at(i + 2), t, 0),
                  catmull(at(i - 1), at(i), at(i + 1), at(i + 2), t, 1)]);
      }
    }
    if (!closed) out.push(p[n - 1]);
  } else {
    for (let i = 0; i < n - 1; i++) {
      const steps = Math.max(2, Math.round(Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]) * per));
      for (let s = 0; s < steps; s++) out.push([p[i][0] + (p[i + 1][0] - p[i][0]) * (s / steps),
                                                p[i][1] + (p[i + 1][1] - p[i][1]) * (s / steps)]);
    }
    out.push(p[n - 1]);
  }
  return out;
}

const NIB = 0.62;                    // the nib's angle, radians — held for the whole alphabet

/** ink one pen stroke: a nib walked along the path, filled as a ribbon rather than stroked,
 *  because a constant-width line is the thing that makes drawn type read as clip art */
function inkStroke(
  ctx: CanvasRenderingContext2D, pts: Pt[], closed: boolean, base: number,
  wob: number, nz: (v: number) => number, phase: number, flat = false,
) {
  const n = pts.length;
  if (n < 2) return;
  const mid: Pt[] = [], half: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
    const t = i / (n - 1);
    // taper: the pen lands and lifts. A closed form never lifts, so it keeps its weight, and
    // neither does a data line — a curve whose ends thin out is a curve claiming its first
    // and last years matter less. Asymmetric otherwise: it lands with weight and lifts off
    // it, which is what a real stroke does and what stops every stroke reading as a leaf.
    const taper = closed || flat ? 1
      : 0.44 + 0.56 * Math.pow(Math.sin(Math.PI * clamp(t * 0.86 + 0.10, 0.02, 0.98)), 0.34);
    const nib = 0.44 + 0.56 * Math.abs(Math.sin(Math.atan2(ty, tx) - NIB));
    const breathe = 0.86 + 0.28 * (nz(t * 4 + phase * 3) * 0.5 + 0.5);
    half.push(Math.max(0.28, base * taper * nib * breathe * 0.5));
    const d = wob * nz(t * 3.1 + phase);
    mid.push([pts[i][0] - ty * d, pts[i][1] + tx * d]);
  }
  const side = (sign: number, rev: boolean) => {
    for (let k = 0; k < n; k++) {
      const i = rev ? n - 1 - k : k;
      const a = mid[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
      const b = mid[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
      const x = mid[i][0] - ty * half[i] * sign, y = mid[i][1] + tx * half[i] * sign;
      (k === 0 && rev === false) ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
  };
  ctx.beginPath();
  if (closed) {
    side(1, false); ctx.closePath();
    ctx.moveTo(mid[n - 1][0], mid[n - 1][1]);       // inner wall, reversed, punches the counter
    side(-1, true); ctx.closePath();
    ctx.fill('evenodd');
  } else {
    side(1, false); side(-1, true); ctx.closePath();
    ctx.fill();
  }
}

/**
 * Ink an arbitrary path in the same hand as the alphabet — two passes, off-register, nib
 * width from the angle of travel. Used for the one line on this page that carries data, so
 * that line is a made object rather than a plotted one. `flat` keeps the ends at full
 * weight: a data curve may not taper.
 */
export function inkPath(
  ctx: CanvasRenderingContext2D, pts: number[][], colour: string, alpha: number,
  width: number, opts: { seed?: number; wobble?: number; closed?: boolean; flat?: boolean } = {},
) {
  if (pts.length < 2) return;
  const nz = noise1((opts.seed ?? 11) >>> 0);
  const wob = opts.wobble ?? 0.5;
  ctx.save();
  ctx.fillStyle = colour;
  for (const [d, aScale, wScale, phase] of
       [[1, 0.38, 0.86, 5.1], [0, 1, 1, 0]] as const) {
    ctx.globalAlpha = alpha * aScale;
    inkStroke(ctx, pts.map(([x, y]) => [x + d * 0.8, y + d * 0.7] as Pt), !!opts.closed,
      width * wScale, wob, nz, phase, opts.flat !== false);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export interface GlyphOpts {
  seed?: number;      // same letter, same seed → same shape; different seed → a different hand
  weight?: number;    // nib width as a fraction of cap height
  align?: 'center' | 'left';
}

/**
 * Draw one capital, inked twice off-register.
 * `x`,`y` is the centre of its cap box (or its left edge when aligned left).
 * Returns the advance width in px so a caller can lay a row out from real geometry.
 */
export function inkGlyph(
  ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, cap: number,
  colour: string, alpha: number, opts: GlyphOpts = {},
): number {
  const k = ch.toUpperCase();
  const g = GLYPHS[k];
  const adv = glyphWidth(k) * cap;
  if (!g) return adv;
  const seed = opts.seed ?? 1;
  const nz = noise1((seed ^ (k.charCodeAt(0) * 2654435761)) >>> 0);
  const base = cap * (opts.weight ?? 0.155);
  const wob = Math.min(cap * 0.022, 2.2);
  const off = clamp(cap * 0.016, 0.35, 1.1);
  const x0 = opts.align === 'left' ? x : x - adv / 2;
  const y0 = y - cap / 2;
  const per = clamp(cap * 0.5, 6, 26);        // samples per unit of skeleton length

  ctx.save();
  ctx.fillStyle = colour;
  // two passes: a lighter underdraw laid slightly wide of the mark, then the stroke itself
  for (const [dx, dy, aScale, wScale, phase] of
       [[-1.0, 0.85, 0.40, 0.84, 6.3], [0.6, -0.55, 1, 1, 0]] as const) {
    ctx.globalAlpha = alpha * aScale;
    for (const st of g) {
      const pts = samples(st, per).map(([px, py]) =>
        [x0 + px * cap + dx * off, y0 + py * cap + dy * off] as Pt);
      inkStroke(ctx, pts, st.c === 2, base * wScale, wob, nz, phase, false);
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  return adv;
}
