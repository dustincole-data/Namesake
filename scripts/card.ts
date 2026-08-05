/**
 * The share card: the page's own object, at 1200×630.
 *
 * The old card was a whole design language behind the page it advertised — manila ground, a
 * Gelasio serif name, a 5px plotted blue line. The site has shipped "no serif, anywhere" and
 * a hand-inked field of colour marks since; someone shared a card, clicked, and landed on a
 * different piece entirely. That happened because the card could not import a line of the
 * page: the mark's geometry lived inside `src/scripts/foam.ts`, which reads `window` at
 * module scope, so this file drew a lookalike instead.
 *
 * The hand is in `src/lib/ink.ts` now, so this draws the REAL mark — same palette, same
 * seeded wobble, same nib ribbon, same grain. The John on a share card is the John from the
 * field, down to the noise walk on its edge.
 *
 * Satori has no canvas, so every drawn thing is an SVG path built from the same point arrays
 * the canvas painter fills. One full-bleed <svg> carries the drawing; the type sits over it
 * in absolutely-positioned divs, because satori lays text out and we want it placed.
 *
 * Rendered two ways:
 *   - build time: scripts/og.ts  -> static per-name og/<slug>.png, plus the brand card
 *   - runtime:    api/og.ts      -> personalized name+year card
 */
import { rng, noise1, towards, css, speckShapes, type Lch } from '../src/lib/draw.ts';
import {
  LETTERS, blockOf, hashOf, markOutline, wobbleFor, pathInk, type Pt, type InkPart,
} from '../src/lib/ink.ts';
import { glyphInk } from '../src/lib/letters.ts';

export interface CardOpts {
  name: string;
  caption: string;
  startYear: number;
  endYear: number;
  curve: number[];             // 0..1000, length endYear-startYear+1
  peakYear: number;
  peakCount: number;
  peakShare: number;           // percent of a year's births — the number the mark's AREA is
  spanYears: number;           // years above half its own peak — the number the ARC is
  archetypeLabel: string;
  year?: number;               // personalized card only
  badgeLabel?: string;
  countInYear?: number;
}

export interface BrandOpts {
  startYear: number; endYear: number; nameCount: number;
  big: { name: string; peakYear: number; peakShare: number; spanYears: number };
  small: { name: string; peakYear: number; peakShare: number; spanYears: number };
}

const W = 1200, H = 630;
const PAPER: Lch = { L: 0.988, C: 0.004, h: 250 };   // the page's ground — never a cream
const INK = '#1d2430', SOFT = '#5b6472', MUTE = '#98a1ae';

/**
 * The biggest share any American name ever took of a year's births: John, 1880. The field
 * scales every mark against it, so the card scales against it too — otherwise a card's mark
 * would be sized against itself and the page's one claim, that the big names got small,
 * would not survive being shared.
 */
const MAXPS = 4.81;
/** the field's own rule — radius from the square root of share, so AREA is the quantity */
const rFor = (ps: number, min: number, span: number) => min + span * Math.sqrt(Math.max(0, ps) / MAXPS);

const d = (poly: Pt[]) =>
  poly.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join('') + 'Z';
const path = (dd: string, fill: string, opacity = 1, evenodd = false): any => ({
  type: 'path',
  props: { d: dd, fill, fillOpacity: opacity, ...(evenodd ? { fillRule: 'evenodd' } : {}) },
});
const inked = (ps: InkPart[], fill: string) =>
  ps.map((p) => path(p.polys.map(d).join(''), fill, p.alpha, p.evenodd));

/**
 * Grain, as a handful of paths instead of hundreds.
 *
 * Every speck carries its own alpha, so the obvious emit is one <path> per speck — which for
 * one card is 740 nodes, a 330 KB SVG and ~250ms, and this runs 5,001 times in a build that
 * used to take four minutes. Quantising alpha into a few buckets and merging each bucket's
 * specks into ONE path with many subpaths keeps the tonal variation the texture is for and
 * collapses the node count by two orders of magnitude.
 */
const grain = (specks: { poly: Pt[]; alpha: number }[], fill: string, levels = 6): any[] => {
  const buckets = new Map<number, string[]>();
  for (const s of specks) {
    const q = Math.max(1, Math.round(s.alpha * levels));
    (buckets.get(q) ?? buckets.set(q, []).get(q)!).push(d(s.poly));
  }
  return [...buckets].map(([q, ds]) => path(ds.join(''), fill, q / levels));
};

/** chroma rationed by coverage, exactly as the field rations it */
const fillOf = (r: number, base: Lch) => {
  const strength = Math.min(1, Math.max(0, (r - 2.4) / 16));
  return towards(base, { L: 0.955, C: 0.012, h: base.h }, 1 - (0.54 + strength * 0.46));
};
const inkOf = (base: Lch) => towards(base, { L: 0.26, C: base.C, h: base.h }, 0.66);

/**
 * One mark, at card scale — the same object the field draws: a wobbled edge laid twice
 * off-register, chroma rationed by coverage, grain inside it, and the arc that counts the
 * years the name held above half its own peak.
 */
function mark(name: string, peakYear: number, spanYears: number, cx: number, cy: number, r: number): any[] {
  const base = LETTERS[blockOf(name)][2];
  const seed = hashOf(name, peakYear);
  const k = noise1(seed);
  const wob = wobbleFor(r);
  const ink = css(inkOf(base));
  const strength = Math.min(1, Math.max(0, (r - 2.4) / 16));
  const out: any[] = [path(d(markOutline(cx, cy, r, k, wob)), css(fillOf(r, base)), 0.94)];

  // the edge, twice: a soft underdraw laid wide of the mark, then the stroke itself. A ring
  // is an annulus here — outer ring minus inner, filled even-odd — because satori strokes
  // do not take the wobble the way a filled ribbon does.
  for (const [ph, grow, alpha, wRaw] of [
    [2.7, Math.min(1.2, r * 0.035), 0.20 + strength * 0.16, r * 0.07],
    [0, 0, 0.50 + strength * 0.34, r * 0.055],
  ] as const) {
    const wobP = ph ? wob * 1.5 : wob;
    const w = Math.max(0.7, Math.min(2.4, wRaw));
    const outer = markOutline(cx, cy, r, k, wobP, ph, grow + w / 2);
    const inner = markOutline(cx, cy, r, k, wobP, ph, grow - w / 2);
    out.push(path(d(outer) + d(inner), ink, alpha, true));
  }

  // Grain — no area of this page is perfectly flat. Sown inside 0.74r, which is well within
  // the mark's own edge, so this needs no clip path: the specks cannot reach the rim.
  out.push(...grain(speckShapes(cx, cy, r * 0.74, Math.round(r * 0.85), rng(seed),
    { rMin: r * 0.018, rMax: Math.min(r * 0.085, 5.5), aMin: 0.05, aMax: 0.19 }), ink));

  // The subject is names, and a name is made of letters, so the letter is drawn — in the
  // hand-inked alphabet the field debosses its own landmarks with, not set in the page face.
  // Clipped to the mark, because a letter that overruns its own circle is a sticker.
  const gid = 'gl' + (seed % 99961);
  out.push({ type: 'clipPath', props: { id: gid, children: [path(d(markOutline(cx, cy, r, k, wob * 0.6)), '#000')] } });
  out.push({
    type: 'g',
    props: {
      clipPath: `url(#${gid})`,
      children: glyphInk(name[0], cx, cy + r * 0.04, r * 1.54, 0.46, { seed, weight: 0.165 }).parts
        .map((p) => path(p.polys.map(d).join(''), ink, p.alpha, p.evenodd)),
    },
  });

  // the arc: a full turn is a century. The second quantity the marks carry, and the finding
  // this study did NOT make — peak share falls sevenfold across the page and this does not.
  if (spanYears) {
    const turn = Math.min(1, spanYears / 100) * Math.PI * 2, st = -Math.PI / 2;
    const rr = r * 0.8, steps = 120, arc: Pt[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = st + (i / steps) * turn;
      arc.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    out.push(...inked(pathInk(arc, 0.46, Math.max(1.4, r * 0.05), { seed: seed ^ 0x2f, wobble: 0.25 }), ink));
  }
  return out;
}

/**
 * The name's life, inked — the same two-pass nib stroke as the alphabet, filled with the
 * mark's own grain rather than a solid tint, so the curve reads as a bigger version of the
 * mark beside it. Annotated at the peak only: that is the number the mark's area encodes,
 * and a chart with one annotation is making a point rather than presenting a dataset.
 */
function story(o: { name: string; peakYear: number; curve: number[]; startYear: number; year?: number },
               x0: number, y0: number, w: number, h: number) {
  const base = LETTERS[blockOf(o.name)][2];
  const ink = css(inkOf(base));
  const seed = hashOf(o.name, o.peakYear);
  const n = o.curve.length, peak = Math.max(...o.curve, 1);
  const sx = (i: number) => x0 + (i / (n - 1)) * w;
  const sy = (v: number) => y0 + h - (v / peak) * h;
  const line: Pt[] = o.curve.map((v, i) => [sx(i), sy(v)]);
  const out: any[] = [];

  const area: Pt[] = [...line, [x0 + w, y0 + h], [x0, y0 + h]];
  const cid = 'cv' + (seed % 99989);
  out.push({ type: 'clipPath', props: { id: cid, children: [path(d(area), '#000')] } });
  out.push(path(d(area), css(towards(base, { L: 0.97, C: 0.01, h: base.h }, 0.56)), 0.9));
  out.push({
    type: 'g',
    props: {
      clipPath: `url(#${cid})`,
      children: grain(speckShapes(x0 + w / 2, y0 + h, w * 0.62, 380, rng(seed ^ 0x9e3779b9),
        { rMin: 0.5, rMax: 2.2, aMin: 0.04, aMax: 0.16 }), ink),
    },
  });
  out.push(...inked(pathInk([[x0, y0 + h], [x0 + w, y0 + h]], 0.34, 1.8, { seed: seed ^ 0x77, wobble: 0.5 }), ink));
  out.push(...inked(pathInk(line, 0.92, 3.2, { seed, wobble: 0.42 }), ink));

  const pi = o.curve.indexOf(peak);
  const cxp = sx(pi), cyp = sy(peak);
  out.push(...inked(pathInk([[cxp - 7, cyp], [cxp, cyp - 7], [cxp + 7, cyp], [cxp, cyp + 7]], 0.95, 3.4,
    { seed: seed ^ 0x2b, wobble: 0.35, closed: true }), ink));

  // a personalized card is about one year, so that year is dropped onto the curve it belongs to
  if (o.year != null) {
    const i = Math.max(0, Math.min(n - 1, o.year - o.startYear));
    const mx = sx(i), my = sy(o.curve[i] ?? 0);
    out.push(...inked(pathInk([[mx, my + 2], [mx, y0 + h]], 0.45, 2.2, { seed: seed ^ 0x41, wobble: 0.25 }), ink));
    out.push(path(d(markOutline(mx, my, 10, noise1(seed ^ 0x9), 0.05)), ink, 0.95));
  }
  return { nodes: out, peakX: cxp, peakY: cyp };
}

// --- type ---------------------------------------------------------------------------------
const abs = (left: number, top: number, children: any, extra: Record<string, unknown> = {}): any => ({
  type: 'div',
  props: { style: { position: 'absolute', left, top, display: 'flex', ...extra }, children },
});
const caps = (s: string, size: number, colour: string, ls = 1.7): any => ({
  type: 'div',
  props: {
    style: {
      fontFamily: 'Archivo Narrow', fontWeight: 600, fontSize: size, letterSpacing: ls,
      textTransform: 'uppercase', color: colour, whiteSpace: 'pre',
    },
    children: s,
  },
});
const shell = (children: any[]): any => ({
  type: 'div',
  props: {
    style: {
      position: 'relative', width: W, height: H, display: 'flex',
      background: css(PAPER), color: INK, fontFamily: 'Outfit',
    },
    children,
  },
});
const frame = (svg: any[]): any => ({
  type: 'svg',
  props: { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: { position: 'absolute', left: 0, top: 0 }, children: svg },
});
const header = (o: { startYear: number; endYear: number }) => [
  abs(56, 46, caps(`U.S. Social Security · ${o.startYear}–${o.endYear}`, 19, SOFT)),
  abs(0, 46, caps('namesake.dustincoledata.com', 17, MUTE), { width: W - 56, justifyContent: 'flex-end' }),
];

// --- the per-name card --------------------------------------------------------------------
export function cardTree(o: CardOpts) {
  // Area true to share, on the field's own rule, floored so a rare name still reads. RMAX is
  // what fixes the type's left edge: the mark is drawn from the data and the column beside it
  // is not, so the column clears the LARGEST mark the card can produce, not this one.
  const RMAX = 112;
  const R = rFor(o.peakShare, 38, RMAX - 38);
  const MX = 56 + RMAX, MY = 228;
  const TX = 56 + RMAX * 2 + 44;

  const st = story(o, 56, 408, W - 112, 114);
  const svg = [...st.nodes, ...mark(o.name, o.peakYear, o.spanYears, MX, MY, R)];

  const stamp = o.year != null && o.badgeLabel && o.countInYear != null
    ? `Born ${o.year} · ${o.badgeLabel} · ≈${o.countInYear.toLocaleString('en-US')} that year`
    : `${o.archetypeLabel} · ${o.peakCount.toLocaleString('en-US')} babies at its peak · ${o.spanYears} years above half of it`;

  // The peak label rides its own crosshair and flips side near the right edge. Its top is
  // floored clear of the mark, because a name that peaked in its first year puts the
  // crosshair at the very top-left, directly under the biggest mark the card draws.
  const flip = st.peakX > W - 320;
  const peakLabel = abs(flip ? 0 : st.peakX + 16, Math.max(364, st.peakY - 40), [
    { type: 'div', props: { style: { fontSize: 26, fontWeight: 500, color: INK }, children: `${o.peakShare.toFixed(2)}%` } },
    { type: 'div', props: { style: { fontFamily: 'Archivo Narrow', fontWeight: 400, fontSize: 17, color: SOFT, marginTop: 2 }, children: `peak · ${o.peakYear}` } },
  ], flip
    ? { flexDirection: 'column', alignItems: 'flex-end', width: st.peakX - 16 }
    : { flexDirection: 'column' });

  return shell([
    frame(svg),
    ...header(o),
    abs(TX, 150, {
      type: 'div',
      props: { style: { fontSize: 94, fontWeight: 700, letterSpacing: -3, lineHeight: 1, color: INK }, children: o.name },
    }),
    abs(TX, 262, {
      type: 'div',
      props: {
        style: { fontSize: 25, fontWeight: 300, color: SOFT, lineHeight: 1.35, width: W - TX - 56 },
        children: o.caption,
      },
    }),
    peakLabel,
    abs(56, 556, caps(stamp, 19, SOFT)),
  ]);
}

// --- the homepage card --------------------------------------------------------------------
/**
 * The site's own card states the site's own claim, with the two marks it is about, area-true
 * against each other. It used to be the first name in the file wearing the word "Namesake" —
 * which meant the homepage card asserted that Namesake peaked in 1880 with 5,949 babies.
 */
export function brandTree(o: BrandOpts) {
  const RMAX = 104;
  const rBig = rFor(o.big.peakShare, 24, RMAX - 24), rSmall = rFor(o.small.peakShare, 24, RMAX - 24);
  // one centre line and one label line for both, so the pair reads as a comparison rather
  // than two objects that happen to be near each other — the size gap IS the sentence
  const cy = 424, labelY = cy + RMAX + 18;
  const bigX = 56 + rBig, smallX = 56 + rBig * 2 + 132 + rSmall;
  const svg = [
    ...mark(o.big.name, o.big.peakYear, o.big.spanYears, bigX, cy, rBig),
    ...mark(o.small.name, o.small.peakYear, o.small.spanYears, smallX, cy, rSmall),
  ];
  const under = (x: number, r: number, pct: string, who: string) => [
    abs(x - 120, labelY, {
      type: 'div', props: { style: { fontSize: 30, fontWeight: 500, color: INK }, children: pct },
    }, { width: 240, justifyContent: 'center' }),
    abs(x - 120, labelY + 38, caps(who, 17, SOFT), { width: 240, justifyContent: 'center' }),
  ];
  return shell([
    frame(svg),
    ...header(o),
    abs(56, 92, {
      type: 'div',
      props: {
        style: { fontSize: 74, fontWeight: 700, letterSpacing: -2.4, lineHeight: 1.05, color: INK, whiteSpace: 'pre' },
        children: 'The big names got small.',
      },
    }),
    abs(56, 196, {
      type: 'div',
      props: {
        style: { fontSize: 25, fontWeight: 300, color: SOFT, lineHeight: 1.4, width: 700 },
        children: `Every American name that ever took 0.04% of a year's births — ${o.nameCount.toLocaleString('en-US')} of them, one bubble each, sized by the biggest share it ever held.`,
      },
    }),
    ...under(bigX, rBig, `${o.big.peakShare.toFixed(2)}%`, `${o.big.name} · ${o.big.peakYear}`),
    ...under(smallX, rSmall, `${o.small.peakShare.toFixed(2)}%`, `${o.small.name} · ${o.small.peakYear}`),
  ]);
}
