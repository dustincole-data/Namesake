/**
 * The drawn hand, as geometry — no canvas.
 *
 * Everything here used to live inside the two painters that needed it: the mark's wobbled
 * outline and the letter-block palette inside `src/scripts/foam.ts`, the nib ribbon inside
 * `src/lib/letters.ts`. Both are browser modules — foam.ts reads `window.devicePixelRatio`
 * at module scope — so the share-card generator, which runs in Node under satori, could not
 * import a single line of it and drew a lookalike instead. That is how the cards ended up
 * a whole design language behind the page they advertise.
 *
 * So the hand is points now, and the two renderers are thin: canvas fills them, satori
 * emits them as SVG. Same seed in, same shape out — the John on a share card is the John
 * from the field, not a second implementation of it.
 *
 * Nothing here draws. Nothing here touches `window`.
 */
import { noise1, clamp, type Lch } from './draw.ts';

export type Pt = [number, number];

/** a filled shape, in the alpha it wants — one entry per pass a stroke is laid down in */
export interface InkPart { polys: Pt[][]; evenodd: boolean; alpha: number; }

// --- the palette: hue is the name's FIRST LETTER, in seven alphabet blocks -------------
// Never the era. The pack is already ordered by year of cresting, so era-hue makes hue a
// function of x and the field measures out as seven flat bands; era is carried by position
// and read off the axis instead.
export const LETTERS: [string, string, Lch][] = [
  ['A', 'B', { L: 0.58, C: 0.155, h: 25 }],
  ['C', 'D', { L: 0.68, C: 0.150, h: 72 }],
  ['E', 'I', { L: 0.70, C: 0.145, h: 128 }],
  ['J', 'K', { L: 0.60, C: 0.120, h: 178 }],
  ['L', 'M', { L: 0.58, C: 0.130, h: 232 }],
  ['N', 'S', { L: 0.54, C: 0.155, h: 292 }],
  ['T', 'Z', { L: 0.60, C: 0.165, h: 344 }],
];

export const blockOf = (name: string) => {
  const c0 = name[0].toUpperCase();
  for (let i = 0; i < LETTERS.length; i++) if (c0 >= LETTERS[i][0] && c0 <= LETTERS[i][1]) return i;
  return LETTERS.length - 1;
};

export const hashOf = (str: string, salt: number) => {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

// --- the mark ---------------------------------------------------------------------------
/**
 * One mark's edge. No true circle anywhere on this page — the outline is its own
 * low-frequency noise walk, and the painter lays it twice off-register the way a pencil
 * goes round a form a second time.
 */
export function markOutline(
  cx: number, cy: number, r: number, k: (v: number) => number,
  wob: number, phase = 0, grow = 0,
): Pt[] {
  const steps = clamp(Math.round(r * 2.4), 16, 84);
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const rr = r * (1 + wob * k((a / (Math.PI * 2)) * 6 + phase)) + grow;
    out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return out;
}

/** the wobble a mark of this radius takes — flat below 3px, where it would only read as noise */
export const wobbleFor = (r: number) => (r < 3 ? 0 : clamp(0.058 - r * 0.0007, 0.032, 0.058));

// --- the nib ----------------------------------------------------------------------------
const NIB = 0.62;                    // the nib's angle, radians — held for the whole alphabet

/**
 * One pen stroke as a ribbon: a nib walked along the path and filled, rather than stroked,
 * because a constant-width line is the thing that makes drawn type read as clip art. The
 * width at every step comes from the angle of travel against a fixed nib angle, so a
 * down-right stroke is broad and an up-right one is thin, exactly as a chisel pen behaves.
 *
 * Returns the polygons to fill. A closed form returns two — outer wall and a reversed inner
 * wall — which must be filled even-odd so the counter is punched out.
 */
export function ribbon(
  pts: Pt[], closed: boolean, base: number,
  wob: number, nz: (v: number) => number, phase: number, flat = false,
): { polys: Pt[][]; evenodd: boolean } {
  const n = pts.length;
  if (n < 2) return { polys: [], evenodd: false };
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
  const side = (sign: number, rev: boolean): Pt[] => {
    const acc: Pt[] = [];
    for (let k = 0; k < n; k++) {
      const i = rev ? n - 1 - k : k;
      const a = mid[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
      const b = mid[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
      acc.push([mid[i][0] - ty * half[i] * sign, mid[i][1] + tx * half[i] * sign]);
    }
    return acc;
  };
  // Closed: outer wall, then the inner wall reversed as its own subpath, filled even-odd so
  // the counter is punched out. The inner subpath opens on the centreline's last point —
  // that vertex is load-bearing, it was the `moveTo` the canvas version issued between the
  // two walls, and dropping it shifts the fill.
  return closed
    ? { polys: [side(1, false), [mid[n - 1], ...side(-1, true)]], evenodd: true }
    : { polys: [[...side(1, false), ...side(-1, true)]], evenodd: false };
}

/**
 * An arbitrary path in the same hand as the alphabet — two passes, off-register. `flat`
 * keeps the ends at full weight: a data curve may not taper.
 */
export function pathInk(
  pts: Pt[], alpha: number, width: number,
  opts: { seed?: number; wobble?: number; closed?: boolean; flat?: boolean } = {},
): InkPart[] {
  if (pts.length < 2) return [];
  const nz = noise1((opts.seed ?? 11) >>> 0);
  const wob = opts.wobble ?? 0.5;
  const out: InkPart[] = [];
  for (const [d, aScale, wScale, phase] of
       [[1, 0.38, 0.86, 5.1], [0, 1, 1, 0]] as const) {
    const r = ribbon(pts.map(([x, y]) => [x + d * 0.8, y + d * 0.7] as Pt), !!opts.closed,
      width * wScale, wob, nz, phase, opts.flat !== false);
    if (r.polys.length) out.push({ ...r, alpha: alpha * aScale });
  }
  return out;
}

// Texture (`speckShapes`) lives in draw.ts beside the canvas painter that consumes it —
// putting it here would make draw.ts import ink.ts, which already imports draw.ts.
