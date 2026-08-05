/**
 * The homepage field: 1,572 names, one mark each, packed at build time (pipeline/src/foam.ts).
 *
 * Hue is the letter a name starts with, in seven alphabet blocks. It used to be the era it
 * crested in, which reads well in the abstract and fails in fact: the pack is already
 * ordered by that same year, so hue became a function of x and the field measured out as
 * seven flat bands. Era is carried by position and read off the axis instead.
 *
 * At rest the field is a browsable surface. The moment you want one name out of 1,572 it
 * would be unreadable, so that is paid for at focus: everything else drops to a ghost and
 * the chosen mark keeps full chroma and draws its own life — the share of all American
 * births it held every year since 1880.
 *
 * TWO PACKS, ONE FIELD. A phone is not a narrow desktop: the wide pack rendered into 390px
 * is 3.3px a mark, which is why the page used to hide it behind a sideways scrollbar. The
 * build solves the same 1,572 names a second time into a portrait band, and below the
 * breakpoint the page loads that one instead — ~9px a mark, the same size the wide field
 * has on a desktop. Everything downstream of the fetch reads its geometry off the data, so
 * there is one drawing routine and no second implementation to drift.
 *
 * What changes with it is where the WORDS go. On the wide page the hero text is an overlay
 * and the key block is drawn into the canvas; on the narrow one both are markup, because
 * canvas-space type scales with the artwork rather than the viewport and lands off-screen
 * (the text) or at 6.7px (the keys). The canvas keeps the field and its era axis. See
 * Foam.astro.
 */
import { rng, noise1, towards, css, speckle, grain, clamp, type Lch } from '../lib/draw.ts';
import { inkGlyph, inkPath } from '../lib/letters.ts';
import { LETTERS, blockOf, hashOf, markOutline, wobbleFor } from '../lib/ink.ts';
import { publishField, type FieldMark } from '../lib/field.ts';

interface Mark { n: string; slug: string; py: number; ps: number; w: number; x: number; y: number; r: number; }
interface Foam {
  k: number; rMin: number; page: { w: number; h: number }; vertical: boolean;
  band: { x0: number; x1: number; y0: number; y1: number };
  cy: number; y0: number; y1: number; yearEdge: number[]; yearH: number[]; marks: Mark[];
}
interface Placed { x: number; y: number; r: number; m: Mark; }

const DPR = Math.min(2, window.devicePixelRatio || 1);
const PAPER: Lch = { L: 0.988, C: 0.004, h: 250 };
/** Below this the page takes the portrait pack. Foam.astro's breakpoint is the same number. */
const NARROW = '(max-width: 720px)';

// LETTERS / blockOf / hashOf / markOutline now live in ../lib/ink.ts, so the share card can
// draw the same mark from the same generators instead of a lookalike.
// the fourth field is the portrait label: the gutter is 84 units wide and a range does not
// fit in it, so the narrow axis names each era by where it starts
const ERAS: [number, number, string, string][] = [
  [1880, 1904, '1880s–1900s', '1880s'], [1905, 1929, '1900s–20s', '1900s'],
  [1930, 1949, '1930s–40s', '1930s'], [1950, 1969, '1950s–60s', '1950s'],
  [1970, 1989, '1970s–80s', '1970s'], [1990, 2009, '1990s–2000s', '1990s'],
  [2010, 2030, '2010s–now', '2010s'],
];
/** every listener this mount owns, so a breakpoint crossing can remount without doubling up */
let live: AbortController | null = null;

export async function mountFoam(root: HTMLElement) {
  live?.abort();
  const ac = new AbortController();
  live = ac;
  const { signal } = ac;

  const base = root.dataset.base || '';
  const narrow = window.matchMedia(NARROW);
  const [foam] = await Promise.all([
    fetch(`${base}/data/foam${narrow.matches ? '-portrait' : ''}.json`).then((r) => r.json() as Promise<Foam>),
    // Canvas does not wait for a webfont — it silently falls back mid-draw, and the fallback
    // for an unresolved family is a serif. Every fitted label is measured against the font,
    // so resolving first is correctness, not polish. Every WEIGHT the page draws has to be
    // named here too: loading 600 and then setting 400 falls back exactly the same way, and
    // that is what put the source line in a stray grotesque.
    Promise.all([
      document.fonts.load('300 12px Outfit'), document.fonts.load('500 12px Outfit'),
      document.fonts.load('700 22px Outfit'),
      document.fonts.load('400 10px "Archivo Narrow"'), document.fonts.load('600 10px "Archivo Narrow"'),
    ]),
  ]);
  await document.fonts.ready;
  if (signal.aborted) return;

  const portrait = foam.vertical;
  const W = foam.page.w, H = foam.page.h;
  // Apparatus type is specified at the size it should READ at, then corrected into page
  // units: the portrait page is 560 units across ~390px of glass, so a 9.5px label drawn at
  // face value arrives at 6.6px. One on the wide page, where the two are already the same.
  const UIS = portrait ? 1.45 : 1;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  canvas.width = W * DPR; canvas.height = H * DPR;
  // the stage's ratio comes off the pack, so CSS and data can never disagree about it
  const stage = canvas.parentElement as HTMLElement;
  stage.style.aspectRatio = `${W} / ${H}`;
  const alt = canvas.dataset.alt;
  if (portrait && alt) canvas.setAttribute('aria-label', alt);
  const deck = root.querySelector<HTMLElement>('.deck');
  if (portrait && deck?.dataset.alt) deck.textContent = deck.dataset.alt;

  const view = canvas.getContext('2d')!;
  const buf = document.createElement('canvas');
  buf.width = W * DPR; buf.height = H * DPR;
  const bctx = buf.getContext('2d')!;

  const { x0: BX0, x1: BX1 } = foam.band, CY = foam.cy;
  const placed: Placed[] = foam.marks.map((m) => ({ x: m.x, y: m.y, r: m.r, m }));
  const MAXPS = Math.max(...placed.map((p) => p.m.ps));
  const rOf = (ps: number) => foam.rMin + foam.k * Math.sqrt(ps / MAXPS);

  // ALONG is the time axis, ACROSS the spread — the two directions the pack was solved in.
  // On the wide field they are the page's x and y; on the portrait one they are swapped, and
  // this is the only place that knows it.
  const along = (p: Placed) => (portrait ? p.y : p.x);
  const aStart = (y: number) => foam.yearEdge[clamp(y - foam.y0, 0, foam.yearH.length - 1)];
  const aEnd = (y: number) => foam.yearEdge[clamp(y - foam.y0, 0, foam.yearH.length - 1) + 1];
  const halfAt = (pa: number) => {
    const E = foam.yearEdge, Hh = foam.yearH;
    let lo = 0, hi = Hh.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (pa < E[mid + 1]) hi = mid; else lo = mid + 1; }
    const a = (E[lo] + E[lo + 1]) / 2;
    const nb = pa < a ? Math.max(0, lo - 1) : Math.min(Hh.length - 1, lo + 1);
    const b = (E[nb] + E[nb + 1]) / 2;
    const t = a === b ? 0 : clamp((pa - a) / (b - a), 0, 1);
    return (Hh[lo] + (Hh[nb] - Hh[lo]) * t) / 2;
  };
  const topAt = (px: number) => CY - halfAt(px);
  const botAt = (px: number) => CY + halfAt(px);

  // --- the mark ------------------------------------------------------------------------
  // Drawn, not rendered. The craft budget goes into line, not tone: a tonal sphere repeated
  // 1,572 times reads as a glossy orb. No true circle anywhere — each outline is its own
  // low-frequency noise walk, laid twice off-register the way a pencil goes round twice.
  let g: CanvasRenderingContext2D = bctx;
  const outline = (p: Placed, k: (v: number) => number, wob: number, phase = 0, grow = 0) => {
    const pts = markOutline(p.x, p.y, p.r, k, wob, phase, grow);
    g.beginPath();
    for (let i = 0; i < pts.length; i++) i ? g.lineTo(pts[i][0], pts[i][1]) : g.moveTo(pts[i][0], pts[i][1]);
    g.closePath();
  };

  // letterspaced caps, measured and drawn — the apparatus's one type treatment, shared by
  // the canvas key block and the markup one
  const capsW = (str: string, font: string, ls: number) => {
    g.font = font;
    let w = 0;
    for (const ch of str.toUpperCase()) w += g.measureText(ch).width + ls;
    return w - ls;
  };
  const caps = (str: string, font: string, ls: number, px: number, py: number, fill: string) => {
    g.font = font; g.fillStyle = fill;
    let cx2 = px;
    for (const ch of str.toUpperCase()) { g.fillText(ch, cx2, py); cx2 += g.measureText(ch).width + ls; }
    return cx2 - ls - px;
  };

  /** chroma rationed by coverage: full only where a mark is big enough to carry it */
  const fillOf = (p: Placed, blockIdx: number | Lch) => {
    const base2 = typeof blockIdx === 'number' ? LETTERS[blockIdx][2] : blockIdx;
    const strength = clamp((p.r - 2.4) / 16, 0, 1);
    return towards(base2, { L: 0.955, C: 0.012, h: base2.h }, 1 - (0.54 + strength * 0.46));
  };

  // The apparatus keys the three channels separately, so the specimen that teaches AREA and
  // the one that teaches the ARC must not be in any letter's colour — they would be claiming
  // a letter. This is the mark's own construction with the hue taken out of it.
  const GREY: Lch = { L: 0.82, C: 0.008, h: 250 };

  const drawMark = (p: Placed, blockIdx: number | Lch, glyph = true) => {
    const seed = hashOf(p.m.n, p.m.py);
    const base2 = typeof blockIdx === 'number' ? LETTERS[blockIdx][2] : blockIdx;
    const strength = clamp((p.r - 2.4) / 16, 0, 1);
    const col = fillOf(p, blockIdx);
    const r2 = rng(seed);
    const k = noise1(seed);
    const wob = wobbleFor(p.r);
    const ink = towards(base2, { L: 0.26, C: base2.C, h: base2.h }, 0.66);

    outline(p, k, wob);
    g.fillStyle = css(col, 0.94); g.fill();

    if (p.r > 2.2) {
      g.lineJoin = 'round'; g.lineCap = 'round';
      outline(p, k, wob * 1.5, 2.7, clamp(p.r * 0.035, 0.4, 1.2));
      g.strokeStyle = css(ink, 0.20 + strength * 0.16);
      g.lineWidth = clamp(p.r * 0.07, 0.7, 2.0); g.stroke();
      outline(p, k, wob, 0, 0);
      g.strokeStyle = css(ink, 0.50 + strength * 0.34);
      g.lineWidth = clamp(p.r * 0.055, 0.6, 1.7); g.stroke();
      g.lineCap = 'butt';
    }
    if (p.r > 5) {
      g.save(); outline(p, k, wob * 0.5); g.clip();
      speckle(g, p.x, p.y, p.r * 0.74, (p.r | 0) + 10, css(ink), r2,
        { rMin: 0.55, rMax: clamp(p.r * 0.1, 0.8, 2.6), aMin: 0.05, aMax: 0.19 });
      g.restore();
    }
    // The subject is names, and a name is made of letters, so the letter is drawn — with the
    // hand-inked alphabet, not set in the page face. It is the same letterform the key at the
    // foot of the page shows, so a mark states what its own colour means.
    //
    // It is also the label of last resort. A mark whose name will not fit inside it says the
    // one thing about that name it still has room for, at the weight of something doing a
    // job; where the name did fit, the letter drops back to a watermark under it.
    if (p.r > 15 && glyph) {
      g.save(); outline(p, k, wob * 0.6); g.clip();
      inkGlyph(g, p.m.n[0], p.x, p.y + p.r * 0.04, p.r * 1.54, css(ink),
        labelFit(p) ? 0.24 : 0.46, { seed, weight: 0.165 });
      g.restore();
    }
    // second channel: years held above half its own peak, a full turn is a century. It
    // carries the finding this study falsified — peak share falls sevenfold across the
    // page and this does not.
    if (p.r > 7 && p.m.w) {
      const turn = clamp(p.m.w / 100, 0, 1) * Math.PI * 2, st = -Math.PI / 2;
      g.beginPath(); g.arc(p.x, p.y, p.r * 0.8, st, st + turn);
      g.strokeStyle = css(ink, 0.46);
      g.lineWidth = clamp(p.r * 0.045, 0.6, 1.3);
      g.lineCap = 'round'; g.stroke(); g.lineCap = 'butt';
    }
  };

  // --- interior labels: fitted to the chord of their own circle at their own baseline ---
  const chordFits = (r: number, text: string, font: string, dy: number, pad: number) => {
    g.font = font;
    const m = g.measureText(text);
    const yw = Math.max(Math.abs(dy - m.actualBoundingBoxAscent), Math.abs(dy + m.actualBoundingBoxDescent));
    if (yw >= r - pad) return false;
    return m.width / 2 + pad <= Math.sqrt(r * r - yw * yw);
  };

  // Whether a mark can carry its own name, decided once and reused: the mark's deboss reads
  // this to know whether it is a watermark or the label itself, and the label pass reads it
  // to draw. Two places deciding the same thing separately is how they drift apart.
  interface Fit { fs: number; both: boolean; pad: number; }
  const fitCache = new Map<string, Fit | null>();
  function labelFit(p: Placed): Fit | null {
    const key2 = p.m.slug || `#${p.m.n}`;      // '#' namespaces specimens away from real slugs
    const hit2 = fitCache.get(key2);
    if (hit2 !== undefined) return hit2;
    let out: Fit | null = null;
    if (p.r >= 10 && p.m.slug) {                       // a key specimen carries no name label
      const pad = 2.4 + p.r * 0.05;
      const pct = p.m.ps.toFixed(1) + '%';
      const top = clamp(p.r * 0.42, 8.5, 19);
      for (let t = top; t >= 8.5 && !out; t -= 0.5) {
        if (chordFits(p.r, p.m.n, `500 ${t}px Outfit`, -t * 0.06, pad) &&
            chordFits(p.r, pct, `300 ${t * 0.58}px Outfit`, t * 0.72, pad)) out = { fs: t, both: true, pad };
      }
      for (let t = top; t >= 8.5 && !out; t -= 0.5) {
        if (chordFits(p.r, p.m.n, `500 ${t}px Outfit`, 0, pad)) out = { fs: t, both: false, pad };
      }
    }
    fitCache.set(key2, out);
    return out;
  }

  // What the page actually drew, kept as it draws it, so the craft floor is checked against
  // real geometry instead of against a screenshot. See .claude/plans/…/craftcheck.mjs.
  const AUDIT = {
    page: { W, H }, band: foam.band, keyRuleY: 0,
    labels: [] as { n: string; w: number; pad: number; r: number }[],
    type: [] as { label: string; str: string; x0: number; y0: number; x1: number; y1: number; base: number }[],
    keys: [] as { label: string; textX: number; w: number }[],
    demos: [] as { x: number; y: number; r: number }[],
  };

  // Provenance is the source AND the rule that made the picture, so both travel together —
  // drawn into the canvas on the wide page, set as markup under the narrow one.
  const creditLine =
    `U.S. Social Security Administration, national data · ${placed.length.toLocaleString('en-US')} names, ${foam.y0}–${foam.y1}`;

  function paintField() {
    g = bctx;
    bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.scale(DPR, DPR);
    bctx.fillStyle = css(PAPER); bctx.fillRect(0, 0, W, H);
    AUDIT.labels.length = 0; AUDIT.type.length = 0; AUDIT.keys.length = 0; AUDIT.demos.length = 0;

    const order = [...placed].sort((a, b) => a.r - b.r);
    for (const p of order) drawMark(p, blockOf(p.m.n));

    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const p of order) {
      const fit = labelFit(p);
      if (!fit) continue;                              // will not fit its own circle
      const { fs, both, pad } = fit;
      g.font = `500 ${fs}px Outfit`;
      AUDIT.labels.push({ n: p.m.n, w: g.measureText(p.m.n).width, pad, r: p.r });
      // White reads on a dark fill and disappears on a light one, and this palette runs from
      // L 0.54 to L 0.70 before chroma is rationed by size — so the label's colour is chosen
      // from the fill it lands on, not fixed. A green mark got a white label at 2.5:1.
      const fill = fillOf(p, blockOf(p.m.n));
      const dark = fill.L > 0.63;
      const strong = dark ? css({ L: 0.24, C: fill.C * 0.55, h: fill.h }, 0.94) : 'rgba(255,255,255,0.96)';
      const soft = dark ? css({ L: 0.24, C: fill.C * 0.55, h: fill.h }, 0.76) : 'rgba(255,255,255,0.80)';
      g.fillStyle = strong;
      g.fillText(p.m.n, p.x, p.y - (both ? fs * 0.06 : 0));
      if (!both) continue;
      g.font = `300 ${fs * 0.58}px Outfit`;
      g.fillStyle = soft;
      g.fillText(p.m.ps.toFixed(1) + '%', p.x, p.y + fs * 0.72);
    }
    g.textBaseline = 'alphabetic';

    const CAPS = `600 ${9.5 * UIS}px "Archivo Narrow"`, LS = 1.15 * UIS;
    const note = (label: string, str: string, x0: number, base: number, w: number, font: string) => {
      g.font = font;
      const m = g.measureText(str);
      AUDIT.type.push({ label, str, x0, x1: x0 + w, base,
        y0: base - m.actualBoundingBoxAscent, y1: base + m.actualBoundingBoxDescent });
    };

    g.textAlign = 'left'; g.textBaseline = 'alphabetic';

    if (portrait) {
      // The narrow field has no strip under it to stand an apparatus on — the band runs the
      // whole page. So the axis stands in the left gutter, and its labels stay HORIZONTAL: a
      // phone must never ask anyone to read sideways. The keys went to markup (Foam.astro).
      const RULE_X = foam.band.x0 - 13;
      for (const [a, b, , short] of ERAS) {
        const a0 = aStart(a), a1 = aEnd(Math.min(b, foam.y1));
        // The axis is the one heavy stroke on a page of hairlines, and it earns the weight:
        // the whole field stands on it, and every other line here is apparatus about it.
        g.strokeStyle = 'rgba(93,104,122,0.72)'; g.lineWidth = 2.6; g.lineCap = 'butt';
        g.beginPath(); g.moveTo(RULE_X, a0); g.lineTo(RULE_X, a1 - 7); g.stroke();
        g.strokeStyle = 'rgba(120,131,146,0.34)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(RULE_X - 5, a0); g.lineTo(RULE_X + 5, a0); g.stroke();
        const ty = a0 + 11 * UIS;
        const w = caps(short, CAPS, LS, 9, ty, '#5b6472');
        note('era', short, 9, ty, w, CAPS);
        AUDIT.keys.push({ label: short, textX: 9, w });
      }
      grain(bctx, W, H, 8, 5);
      return;
    }

    // --- the apparatus: one block under the field, two rows, one left edge ----------------
    // The field encodes two things the reader cannot deduce: where a year sits on a
    // non-linear axis, and what a colour means. Row one answers the first, row two the
    // second, and the credit closes row two rather than opening a third strip.
    //
    // Row two is not a swatch chart. Each entry is a MARK, at a size the field actually
    // draws, carrying the same hand-inked initial the marks carry — so the key is a
    // specimen of the thing it explains, and a reader who has seen a debossed M in the
    // field has already been told what blue means.
    const AX = aStart(foam.y0);                          // the apparatus shares the field's left edge
    const eraBase = foam.band.y1 + 46;
    const eraRule = eraBase + 8;
    const KR = 17;                                       // a real mark size: above the deboss floor
    const leadBase = eraRule + 26;
    const RBIG = rOf(MAXPS);
    const keyFoot = leadBase + 13 + RBIG * 2;            // both keys stand on one line
    const keyCy = keyFoot - KR;
    const keyBase = keyFoot + 14;
    const methodBase = keyBase + 17;
    AUDIT.keyRuleY = eraRule;

    for (const [a, b, label] of ERAS) {
      const px0 = aStart(a), px1 = aEnd(Math.min(b, foam.y1));
      const w = caps(label, CAPS, LS, px0, eraBase, '#5b6472');
      note('era', label, px0, eraBase, w, CAPS);
      AUDIT.keys.push({ label, textX: px0, w });
      // The axis is the one heavy stroke on a page of hairlines, and it earns the weight:
      // the whole field stands on it, and every other line here is apparatus about it.
      g.strokeStyle = 'rgba(93,104,122,0.72)'; g.lineWidth = 2.6; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(px0, eraRule); g.lineTo(px1 - 6, eraRule); g.stroke();
      g.strokeStyle = 'rgba(120,131,146,0.34)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(px0, eraRule - 5); g.lineTo(px0, eraRule + 5); g.stroke();
    }

    // Three groups, and their x comes out of their own measured widths — never a constant.
    // The first draft placed them at AX+520 and AX+700 and the two headings printed straight
    // through each other; a heading is as long as its string, so the string is what places it.
    const SK_INK = '#7c8697';
    const pitch = KR * 2 + 20;
    const SIZES: [number, string][] = [[MAXPS, MAXPS.toFixed(1) + '%'], [1, '1%'], [0.1, '0.1%']];
    // the specimen's arc is a real one — the biggest name's own span, not a drawn-in constant
    const ARC_YEARS = placed.reduce((b, p) => (p.m.ps > b.m.ps ? p : b), placed[0]).m.w;
    const ARC_LBL = 'A full turn is a century';
    const sizeLblW = Math.max(...SIZES.map(([, l]) => capsW(l, CAPS, LS)));
    const arcLblW = capsW(ARC_LBL, CAPS, LS);

    const GROUPS = [
      { lead: "Colour — the name's first letter", w: LETTERS.length * pitch - 20, x: 0 },
      { lead: 'Area — its biggest share of a year', w: RBIG * 2 + 14 + sizeLblW, x: 0 },
      { lead: 'The arc — years above half that peak', w: RBIG * 2 + 12 + arcLblW, x: 0 },
    ];
    for (const gp of GROUPS) gp.w = Math.max(gp.w, capsW(gp.lead, CAPS, LS));
    const sumW = GROUPS.reduce((s, gp) => s + gp.w, 0);
    const gGap = clamp((foam.band.x1 - AX - sumW) / (GROUPS.length - 1), 40, 170);
    let gx = AX;
    for (const gp of GROUPS) { gp.x = gx; gx += gp.w + gGap; }
    for (let i = 0; i < GROUPS.length; i++) {
      const gp = GROUPS[i];
      const w = caps(gp.lead, CAPS, LS, gp.x, leadBase, '#98a1ae');
      note(`lead${i}`, gp.lead, gp.x, leadBase, w, CAPS);
    }

    // 1 — colour. Each entry is a MARK, at a size the field actually draws, carrying the same
    // hand-inked initial the marks carry: the key is a specimen of the thing it explains.
    for (let i = 0; i < LETTERS.length; i++) {
      const kx = GROUPS[0].x + KR + i * pitch;
      const n0 = LETTERS[i][0];
      drawMark({ x: kx, y: keyCy, r: KR,
        m: { n: n0, slug: '', py: 1900 + i, ps: 0, w: 0, x: kx, y: keyCy, r: KR } }, i);
      AUDIT.demos.push({ x: kx, y: keyCy, r: KR });
      const lbl = `${n0}–${LETTERS[i][1]}`;
      const lw = capsW(lbl, CAPS, LS);
      caps(lbl, CAPS, LS, kx - lw / 2, keyBase, '#5b6472');
      note('letters', lbl, kx - lw / 2, keyBase, lw, CAPS);
    }

    // 2 — area. The page's whole claim is area, and the band used to key only hue: the one
    // channel carrying no quantity. Three real marks at the field's own scale, nested
    // deliberately — one drawn object, not three that happen to touch.
    // Real marks, not hairline circles: the same wobbled two-pass edge, grain and halo the
    // field is drawn with, with the hue taken out because hue is keyed next door. A legend
    // made of line diagrams is a legend for a different drawing.
    const SKX = GROUPS[1].x + RBIG;
    for (let i = 0; i < SIZES.length; i++) {              // biggest first; the rest nest on top
      const [ps, lbl] = SIZES[i];
      const rr = rOf(ps), cyc = keyFoot - rr, top = keyFoot - rr * 2;
      const sp: Placed = { x: SKX, y: cyc, r: rr,
        m: { n: lbl, slug: '', py: 1880 + i, ps, w: 0, x: SKX, y: cyc, r: rr } };
      if (i === 0) drawMark(sp, GREY, false);
      else {
        outline(sp, noise1(0x5123 + i), 0.04);
        g.strokeStyle = css(towards(GREY, { L: 0.34, C: 0.02, h: GREY.h }, 0.8), 0.8);
        g.lineWidth = 1.1; g.lineJoin = 'round'; g.stroke();
      }
      g.strokeStyle = 'rgba(124,134,151,0.42)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(SKX + 2, top + 1); g.lineTo(SKX + RBIG + 10, top + 1); g.stroke();
      const lx3 = SKX + RBIG + 14;
      caps(lbl, CAPS, LS, lx3, top + 4.5, SK_INK);
      note(`size${i}`, lbl, lx3, top + 4.5, capsW(lbl, CAPS, LS), CAPS);
    }

    // 3 — the arc. The marks carry a SECOND quantity and the page drew it without ever saying
    // what it was. A channel a reader can see and cannot decode is worse than no channel.
    const AKX = GROUPS[2].x + RBIG, acy = keyFoot - RBIG;
    drawMark({ x: AKX, y: acy, r: RBIG,
      m: { n: 'O', slug: '', py: 1881, ps: MAXPS, w: ARC_YEARS, x: AKX, y: acy, r: RBIG } }, GREY, false);
    const awx = AKX + RBIG + 12;
    caps(ARC_LBL, CAPS, LS, awx, acy + 4, SK_INK);
    note('arclbl', ARC_LBL, awx, acy + 4, arcLblW, CAPS);

    // Provenance is the source AND the rule that made the picture: what a share is measured
    // against, what got in, and what "peak" means. A credit on its own is not a method.
    const CREDIT_F = '400 10.5px "Archivo Narrow"', METHOD_F = '400 9.5px "Archivo Narrow"';
    const method =
      "Share = a name's births in a year ÷ all American births that year. A name is drawn if it ever took " +
      '0.04% of a year; peak is its largest such share, and the arc counts the years it stayed above half of it.';
    g.font = CREDIT_F;
    const cw = g.measureText(creditLine).width;
    g.fillStyle = '#8d97a5';
    g.fillText(creditLine, foam.band.x1 - cw, keyBase);
    note('credit', creditLine, foam.band.x1 - cw, keyBase, cw, CREDIT_F);
    AUDIT.keys.push({ label: 'credit', textX: foam.band.x1 - cw, w: cw });
    g.font = METHOD_F;
    const mw = g.measureText(method).width;
    g.fillStyle = '#a4adba';
    g.fillText(method, foam.band.x1 - mw, methodBase);
    note('method', method, foam.band.x1 - mw, methodBase, mw, METHOD_F);
    AUDIT.keys.push({ label: 'method', textX: foam.band.x1 - mw, w: mw });

    grain(bctx, W, H, 8, 5);
  }

  // --- the markup key block (narrow only) ------------------------------------------------
  // Same three channels, same specimens, drawn by the same hand into their own canvases —
  // because a key rendered inside the portrait field would arrive at 6.7px, and a key you
  // cannot read is not a key. Each canvas is drawn at 1:1 with CSS pixels, so these sizes
  // are the sizes on glass.
  function paintKeys() {
    const host = root.querySelector<HTMLElement>('[data-foam-keys]');
    if (!host) return;
    const credit = host.querySelector<HTMLElement>('[data-foam-credit]');
    if (credit) credit.textContent = creditLine;
    if (!portrait) return;
    const CAPS = '600 10px "Archivo Narrow"', LS = 1.15, INK = '#5b6472';
    const prev = g;
    for (const cvs of host.querySelectorAll<HTMLCanvasElement>('canvas[data-key]')) {
      // the CSS box is the source of truth for both, so a repaint after a resize cannot read
      // back the backing store it set last time
      const w = cvs.clientWidth || 340, h = cvs.clientHeight || 80;
      cvs.width = w * DPR; cvs.height = h * DPR;
      const c = cvs.getContext('2d')!;
      c.setTransform(1, 0, 0, 1, 0, 0); c.scale(DPR, DPR);
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      g = c;
      if (cvs.dataset.key === 'colour') {
        const pitch = w / LETTERS.length, r = clamp(pitch / 2 - 7, 15.5, 20);
        for (let i = 0; i < LETTERS.length; i++) {
          const kx = pitch * (i + 0.5), ky = r + 3;
          const n0 = LETTERS[i][0];
          drawMark({ x: kx, y: ky, r, m: { n: n0, slug: '', py: 1900 + i, ps: 0, w: 0, x: kx, y: ky, r } }, i);
          const lbl = `${n0}–${LETTERS[i][1]}`;
          caps(lbl, CAPS, LS, kx - capsW(lbl, CAPS, LS) / 2, ky + r + 15, INK);
        }
      } else if (cvs.dataset.key === 'area') {
        // the three nested marks, at the field's own scale, biggest first
        const RBIG = rOf(MAXPS), foot = h - 4, x = RBIG + 2;
        for (const [ps, lbl] of [[MAXPS, MAXPS.toFixed(1) + '%'], [1, '1%'], [0.1, '0.1%']] as [number, string][]) {
          const rr = rOf(ps), cy2 = foot - rr, top = foot - rr * 2;
          const sp: Placed = { x, y: cy2, r: rr, m: { n: lbl, slug: '', py: 1880, ps, w: 0, x, y: cy2, r: rr } };
          if (ps === MAXPS) drawMark(sp, GREY, false);
          else {
            outline(sp, noise1(0x5123 + (ps * 10 | 0)), 0.04);
            c.strokeStyle = css(towards(GREY, { L: 0.34, C: 0.02, h: GREY.h }, 0.8), 0.8);
            c.lineWidth = 1.1; c.lineJoin = 'round'; c.stroke();
          }
          c.strokeStyle = 'rgba(124,134,151,0.42)'; c.lineWidth = 1;
          c.beginPath(); c.moveTo(x + 2, top + 1); c.lineTo(x + RBIG + 10, top + 1); c.stroke();
          caps(lbl, CAPS, LS, x + RBIG + 14, top + 4.5, '#7c8697');
        }
      } else {
        const RBIG = rOf(MAXPS), x = RBIG + 2, y = h / 2;
        const years = placed.reduce((b, p) => (p.m.ps > b.m.ps ? p : b), placed[0]).m.w;
        drawMark({ x, y, r: RBIG, m: { n: 'O', slug: '', py: 1881, ps: MAXPS, w: years, x, y, r: RBIG } }, GREY, false);
        caps('A full turn is a century', CAPS, LS, x + RBIG + 12, y + 4, '#7c8697');
      }
    }
    g = prev;
  }

  // --- focus ---------------------------------------------------------------------------
  const cell = 34;
  const index = new Map<string, Placed[]>();
  const ckey = (a: number, b: number) => a + ':' + b;
  for (const p of placed) {
    const a = Math.floor(p.x / cell), b = Math.floor(p.y / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const k2 = ckey(a + i, b + j);
      if (!index.has(k2)) index.set(k2, []);
      index.get(k2)!.push(p);
    }
  }
  /**
   * A pointer inside a mark takes that mark — the smallest one, so a little mark on top of a
   * landmark still wins. A finger is not a pointer: at the field's density the median mark is
   * 9px across, so a touch that lands on ground gets the nearest EDGE within `slop`. Without
   * it half the field is untouchable, and with it as the first test the small marks would be
   * unreachable, hence both, in that order.
   */
  const hit = (mx: number, my: number, slop = 0) => {
    let inside: Placed | null = null, near: Placed | null = null, nd = Infinity;
    for (const p of index.get(ckey(Math.floor(mx / cell), Math.floor(my / cell))) || []) {
      const d2 = (mx - p.x) ** 2 + (my - p.y) ** 2;
      if (d2 <= p.r * p.r) { if (!inside || p.r < inside.r) inside = p; continue; }
      if (slop > 0 && d2 <= (p.r + slop) ** 2) {
        const d = Math.sqrt(d2) - p.r;
        if (d < nd) { nd = d; near = p; }
      }
    }
    return inside || near;
  };

  // The story sits inside the field, not in the top band: the band is spoken for — the
  // headline, the search and the claim all live there — and at focus the field is ghosted to
  // 13%, so the roomiest clear ground on the page is the field itself. Which corner it takes
  // is chosen against the focused mark, because a panel that covers the thing you just
  // pointed at is the worst version of this. (Narrow: there is no clear ground, so the story
  // is a sheet in markup instead — see showSheet.)
  const PW = 470, PH = 196, PAD = 18;
  // The upper slots start below whatever the overlay actually occupies, measured — the
  // headline, the deck, the search and the claim are set in container units and move with
  // the page width, so a hard-coded y here is a collision waiting for a different viewport.
  const overlay = [...root.querySelectorAll<HTMLElement>('.head h1, .head .deck, .search input, .claim .big, .claim .cap')];
  let topCache: number | null = null;
  const topLimit = () => {
    if (topCache !== null) return topCache;
    const rect = canvas.getBoundingClientRect();
    const sc = H / rect.height;
    let low = foam.band.y0;
    for (const el of overlay) {
      const b = el.getBoundingClientRect();
      low = Math.max(low, (b.bottom - rect.top) * sc);
    }
    return (topCache = low + 34);
  };
  const slotFor = (p: Placed) => {
    const top = topLimit();
    const SLOTS = [
      { x0: BX0 + 26, y0: H - 184 - PH }, { x0: BX1 - 26 - PW, y0: H - 184 - PH },
      { x0: BX0 + 26, y0: top }, { x0: BX1 - 26 - PW, y0: top },
    ];
    let best = SLOTS[0], bestScore = -Infinity;
    for (const s of SLOTS) {
      const cx2 = s.x0 + PW / 2, cy2 = s.y0 + PH / 2;
      const dx = Math.max(Math.abs(p.x - cx2) - PW / 2 - PAD, 0);
      const dy = Math.max(Math.abs(p.y - cy2) - PH / 2 - PAD, 0);
      // clear of the mark first (any overlap scores below every clear slot), then farthest
      const clear = Math.hypot(dx, dy) - p.r;
      const score = clear > 6 ? 1000 + Math.hypot(p.x - cx2, p.y - cy2) : clear;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return { x0: best.x0, x1: best.x0 + PW, y0: best.y0, y1: best.y0 + PH };
  };
  const curves = new Map<string, number[]>();
  async function curveFor(m: Mark): Promise<number[] | null> {
    if (curves.has(m.slug)) return curves.get(m.slug)!;
    const ch = (c: string | undefined) => (c && /[a-z0-9]/.test(c) ? c : '_');
    const shard = ch(m.slug[0]) + ch(m.slug[1]);      // same rule as src/lib/format.ts shardKey
    try {
      const data = await fetch(`${base}/data/names/${shard}.json`).then((r) => r.json());
      const rec = data[m.slug];
      if (!rec) return null;
      curves.set(m.slug, rec.curve);
      return rec.curve;
    } catch { return null; }
  }

  /**
   * One name's life, drawn in the hand the rest of the page is drawn in.
   *
   * It used to be a plotted area chart — a flat wash under a 1.8px line — which is the one
   * stock object on a page where every other object is made. It is now inked: the same
   * two-pass nib stroke as the alphabet, filled with the mark's own speckle rather than a
   * solid tint, so the curve is a bigger version of the mark you are pointing at.
   *
   * Two things are annotated on the curve itself, and nothing else is, because these are the
   * two numbers the field encodes: the peak (the mark's AREA) and the span the name held
   * above half that peak (the mark's ARC). No y-axis — the two annotations are the scale.
   */
  function drawStory(p: Placed, cv: number[]) {
    const n = cv.length, peak = Math.max(...cv);
    const B = slotFor(p);
    const b2 = LETTERS[blockOf(p.m.n)][2];
    const ink = towards(b2, { L: 0.26, C: b2.C, h: b2.h }, 0.66);
    const seed = hashOf(p.m.n, p.m.py);
    const r2 = rng(seed ^ 0x9e3779b9);

    const TITLE = 22, META = 15;
    const plotTop = B.y0 + TITLE + META + 14;
    const plotBot = B.y1 - 22;
    const sx = (i: number) => B.x0 + (i / (n - 1)) * (B.x1 - B.x0);
    // the peak lands HEAD below the top of the plot, not on it: the peak is the thing being
    // annotated, and an annotation needs somewhere to stand that is not on top of the curve
    const HEAD = 30;
    const sy = (v: number) => plotBot - (v / peak) * (plotBot - plotTop - HEAD);

    // its own paper, so it reads over whatever it covers
    view.fillStyle = css(PAPER, 0.955);
    view.fillRect(B.x0 - PAD, B.y0 - PAD, PW + PAD * 2, PH + PAD * 2);
    inkPath(view, [[B.x0 - PAD, B.y0 - PAD], [B.x1 + PAD, B.y0 - PAD],
                   [B.x1 + PAD, B.y1 + PAD], [B.x0 - PAD, B.y1 + PAD]],
      css(ink), 0.30, 1.1, { seed: seed ^ 0x51, wobble: 0.7, closed: true });

    view.textAlign = 'left'; view.textBaseline = 'alphabetic';
    view.font = `700 ${TITLE}px Outfit`; view.fillStyle = '#1d2430';
    view.fillText(p.m.n, B.x0, B.y0 + TITLE * 0.76);
    view.font = '400 11px "Archivo Narrow"'; view.fillStyle = '#5b6472';
    view.fillText(`every American birth given this name, ${foam.y0}–${foam.y1}`,
      B.x0, B.y0 + TITLE + META * 0.66);

    // the area, as the mark's own grain rather than a tint: a wash to hold the shape, then
    // speckle at the density the mark itself is speckled with
    const area: [number, number][] = [];
    for (let i = 0; i < n; i++) area.push([sx(i), sy(cv[i])]);
    view.save();
    view.beginPath();
    view.moveTo(B.x0, plotBot);
    for (const [px, py] of area) view.lineTo(px, py);
    view.lineTo(B.x1, plotBot); view.closePath();
    view.fillStyle = css(towards(b2, { L: 0.97, C: 0.01, h: b2.h }, 0.56), 0.9);
    view.fill();
    view.clip();
    speckle(view, (B.x0 + B.x1) / 2, plotBot, (B.x1 - B.x0) * 0.66, 2400, css(ink), r2,
      { rMin: 0.45, rMax: 1.9, aMin: 0.04, aMax: 0.18 });
    view.restore();

    // the ground line and the curve, both inked
    inkPath(view, [[B.x0, plotBot], [B.x1, plotBot]], css(ink), 0.34, 1.2,
      { seed: seed ^ 0x77, wobble: 0.5 });
    inkPath(view, area, css(ink), 0.92, 2.3, { seed, wobble: 0.42 });

    // annotation 1 — the peak. This is the number the mark's area encodes.
    const pi = cv.indexOf(peak);
    const px0 = sx(pi), py0 = sy(peak);
    inkPath(view, [[px0 - 3, py0], [px0, py0 - 3], [px0 + 3, py0], [px0, py0 + 3]],
      css(ink), 0.95, 2.6, { seed: seed ^ 0x2b, wobble: 0.35, closed: true });
    const big = `${p.m.ps.toFixed(2)}%`, small = `peak · ${p.m.py}`;
    view.font = '500 12px Outfit';
    const aw = view.measureText(big).width;
    view.font = '400 9.5px "Archivo Narrow"';
    const bw = Math.max(aw, view.measureText(small).width);
    const right = px0 < B.x0 + (B.x1 - B.x0) * 0.62;
    const tx = clamp(right ? px0 + 14 : px0 - 14 - bw, B.x0, B.x1 - bw);
    const ty = py0 - 17;
    inkPath(view, [[px0, py0 - 4], [right ? tx - 5 : tx + bw + 5, ty - 3]], css(ink), 0.7, 1.2,
      { seed: seed ^ 0x33, wobble: 0.4 });
    view.textAlign = 'left';
    view.font = '500 12px Outfit'; view.fillStyle = css(ink, 0.95);
    view.fillText(big, tx, ty);
    view.font = '400 9.5px "Archivo Narrow"'; view.fillStyle = '#5b6472';
    view.fillText(small, tx, ty + 11);

    // annotation 2 — the span above half the peak. This is the number the mark's arc
    // encodes, and it is the finding this study did NOT find: amplitude collapsed across
    // the page, this did not.
    const half = peak / 2;
    let a0 = -1, a1 = -1;
    for (let i = 0; i < n; i++) if (cv[i] >= half) { if (a0 < 0) a0 = i; a1 = i; }
    if (a0 >= 0 && a1 > a0) {
      const hy = sy(half), hx0 = sx(a0), hx1 = sx(a1);
      inkPath(view, [[hx0, hy], [hx1, hy]], css(ink), 0.5, 1.0, { seed: seed ^ 0x15, wobble: 0.55 });
      for (const hx of [hx0, hx1])
        inkPath(view, [[hx, hy - 4.5], [hx, hy + 4.5]], css(ink), 0.62, 1.1, { seed: seed ^ 0x19, wobble: 0.3 });
      view.font = '400 9.5px "Archivo Narrow"'; view.fillStyle = '#5b6472';
      const lbl = `${p.m.w} years above half its peak`;
      const lw = view.measureText(lbl).width;
      // inside the span if it is wide enough to hold it, otherwise beside it on whichever
      // side has the room — a short span near an edge is the common case, not the exception
      const inside = hx1 - hx0 > lw + 16;
      const lx2 = inside ? (hx0 + hx1) / 2 - lw / 2
        : hx0 - 10 - lw >= B.x0 ? hx0 - 10 - lw : hx1 + 10;
      view.textAlign = 'left';
      // inside the span the curve is above the line, so the label goes under it; beside the
      // span the curve is below the line, so it goes over it. Either way it sits on paper.
      view.fillText(lbl, clamp(lx2, B.x0, B.x1 - lw), inside ? hy + 15 : hy - 6);
    }

    view.font = '400 10px "Archivo Narrow"'; view.fillStyle = '#98a1ae';
    view.textAlign = 'left'; view.fillText(String(foam.y0), B.x0, B.y1 - 4);
    view.textAlign = 'right'; view.fillText(String(foam.y1), B.x1, B.y1 - 4);
    view.fillStyle = '#5b6472';
    view.fillText('click to open its full story →', B.x1, B.y0 + TITLE * 0.76);
    view.textAlign = 'left';
  }

  // --- the sheet: the focused name on a narrow page --------------------------------------
  const sheet = root.querySelector<HTMLAnchorElement>('[data-foam-sheet]');
  const sheetName = root.querySelector<HTMLElement>('[data-sheet-name]');
  const sheetMeta = root.querySelector<HTMLElement>('[data-sheet-meta]');
  const spark = root.querySelector<HTMLCanvasElement>('[data-sheet-spark]');
  const status = root.querySelector<HTMLElement>('[data-foam-status]');

  const readOut = (p: Placed) =>
    `${p.m.n} — peak ${p.m.ps.toFixed(2)}% of American births in ${p.m.py}, ` +
    `${p.m.w} years above half that peak.`;

  function showSheet(p: Placed | null) {
    if (!sheet) return;
    if (!p) {
      sheet.classList.remove('is-open');
      sheet.setAttribute('aria-hidden', 'true'); sheet.tabIndex = -1;
      return;
    }
    sheet.href = `${base}/name/${p.m.slug}`;
    if (sheetName) sheetName.textContent = p.m.n;
    if (sheetMeta) sheetMeta.textContent =
      `peak ${p.m.ps.toFixed(2)}% · ${p.m.py} · ${p.m.w} years above half of it`;
    if (spark) { const c = spark.getContext('2d'); c?.clearRect(0, 0, spark.width, spark.height); }
    sheet.setAttribute('aria-hidden', 'false'); sheet.tabIndex = 0;
    sheet.classList.add('is-open');
  }

  /** the mark's own curve, at sheet size, in the same ink — a bigger version of the mark */
  function drawSpark(p: Placed, cv: number[]) {
    if (!spark) return;
    const w = spark.clientWidth || 132, h = spark.clientHeight || 60;
    spark.width = w * DPR; spark.height = h * DPR;
    const c = spark.getContext('2d')!;
    c.setTransform(1, 0, 0, 1, 0, 0); c.scale(DPR, DPR); c.clearRect(0, 0, w, h);
    const b2 = LETTERS[blockOf(p.m.n)][2];
    const ink = towards(b2, { L: 0.26, C: b2.C, h: b2.h }, 0.66);
    const seed = hashOf(p.m.n, p.m.py);
    const n = cv.length, peak = Math.max(...cv), foot = h - 4;
    const sx = (i: number) => 2 + (i / (n - 1)) * (w - 4);
    const sy = (v: number) => foot - (v / peak) * (foot - 6);
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) pts.push([sx(i), sy(cv[i])]);
    c.beginPath();
    c.moveTo(2, foot);
    for (const [x, y] of pts) c.lineTo(x, y);
    c.lineTo(w - 2, foot); c.closePath();
    c.fillStyle = css(towards(b2, { L: 0.97, C: 0.01, h: b2.h }, 0.56), 0.9);
    c.fill();
    c.save(); c.clip();
    speckle(c, w / 2, foot, w * 0.62, 300, css(ink), rng(seed ^ 0x9e3779b9),
      { rMin: 0.4, rMax: 1.4, aMin: 0.04, aMax: 0.16 });
    c.restore();
    inkPath(c, [[2, foot], [w - 2, foot]], css(ink), 0.34, 1.0, { seed: seed ^ 0x77, wobble: 0.5 });
    inkPath(c, pts, css(ink), 0.92, 1.7, { seed, wobble: 0.42 });
  }

  /** scroll the focused mark into the strip of glass the sheet is not covering */
  function reveal(p: Placed) {
    if (!portrait) return;
    const rect = canvas.getBoundingClientRect();
    const y = rect.top + window.scrollY + (p.y / H) * rect.height;
    const free = window.innerHeight - (sheet?.offsetHeight || 0);
    window.scrollTo({ top: Math.max(0, y - free / 2), behavior: reduced ? 'auto' : 'smooth' });
  }

  let focus: Placed | null = null;
  let lit: Set<string> | null = null;          // an explore set, e.g. every ghost

  function render() {
    view.setTransform(1, 0, 0, 1, 0, 0);
    view.clearRect(0, 0, W * DPR, H * DPR);
    view.scale(DPR, DPR);
    if (!focus && !lit) { view.drawImage(buf, 0, 0, W, H); return; }
    view.fillStyle = css(PAPER); view.fillRect(0, 0, W, H);
    // The veil falls on the FIELD only. Dimming the apparatus with it takes the key away at
    // the exact moment the reader is using it — the whole point of the ghost is to leave one
    // mark readable, and a readable mark you can no longer decode is worth nothing. On the
    // narrow page the apparatus is markup, so the whole canvas is field.
    const veil = portrait ? H : foam.band.y1 + 24;
    view.globalAlpha = 0.13;
    view.drawImage(buf, 0, 0, W * DPR, veil * DPR, 0, 0, W, veil);
    view.globalAlpha = 1;
    if (veil < H) view.drawImage(buf, 0, veil * DPR, W * DPR, (H - veil) * DPR, 0, veil, W, H - veil);
    g = view;
    if (lit) {
      // A lit set has to be readable as names, not as anonymous dots — the panels it
      // replaced listed six names in words, so every lit mark says which one it is.
      for (const p of placed) if (lit.has(p.m.slug)) drawMark(p, blockOf(p.m.n));
      view.textAlign = 'center';
      view.font = `500 ${11.5 * UIS}px Outfit`;
      for (const p of placed) {
        if (!lit.has(p.m.slug)) continue;
        const ly = p.y + p.r + 14 * UIS, w2 = view.measureText(p.m.n).width;
        view.fillStyle = css(PAPER, 0.9);
        view.fillRect(p.x - w2 / 2 - 4, ly - 11 * UIS, w2 + 8, 15 * UIS);
        view.fillStyle = '#1d2430';
        view.fillText(p.m.n, p.x, ly);
      }
      view.textAlign = 'left';
    }
    if (focus) {
      drawMark(focus, blockOf(focus.m.n));
      // Lift, not ring. A rough black ring dropped over the chosen mark is a specific
      // object out of a specific published piece; this is the halo the marks are already
      // built from — the mark's own hue, laid wide and soft outside its own wobbled edge —
      // and then a leader that says which of 1,572 the panel is talking about.
      const b3 = LETTERS[blockOf(focus.m.n)][2];
      const nzf = noise1(hashOf(focus.m.n, focus.m.py));
      outline(focus, nzf, 0.04, 0, 5.0);
      view.strokeStyle = css(b3, 0.34); view.lineWidth = 7; view.lineJoin = 'round'; view.stroke();
      outline(focus, nzf, 0.04, 0, 2.0);
      view.strokeStyle = css(towards(b3, { L: 0.26, C: b3.C, h: b3.h }, 0.66), 0.8);
      view.lineWidth = 1.3; view.stroke();

      if (!portrait) {
        const B2 = slotFor(focus);
        const tx2 = clamp(focus.x, B2.x0 + 12, B2.x1 - 12);
        const ty2 = focus.y < B2.y0 ? B2.y0 - PAD : B2.y1 + PAD;
        const d2 = Math.hypot(tx2 - focus.x, ty2 - focus.y);
        if (d2 > focus.r + 26) {
          const t0 = (focus.r + 9) / d2;
          inkPath(view, [[focus.x + (tx2 - focus.x) * t0, focus.y + (ty2 - focus.y) * t0], [tx2, ty2]],
            css(towards(b3, { L: 0.26, C: b3.C, h: b3.h }, 0.66)), 0.5, 1.1,
            { seed: hashOf(focus.m.n, 7), wobble: 0.6 });
        }
      }
    }
    g = bctx;
    if (focus && !portrait) {
      const cv = curves.get(focus.m.slug);
      if (cv) drawStory(focus, cv);
    }
  }

  async function setFocus(p: Placed | null, opts: { speak?: boolean; reveal?: boolean } = {}) {
    if (p === focus) return;
    focus = p;
    render();
    if (portrait) showSheet(p);
    // hover must not talk: a mouse crossing the field would read out a hundred names
    if (opts.speak && status) status.textContent = p ? readOut(p) : '';
    if (p && opts.reveal) reveal(p);
    if (p) {
      const cv = await curveFor(p.m);
      if (cv && focus === p) { render(); if (portrait) drawSpark(p, cv); }
    }
  }

  paintField();
  paintKeys();
  render();

  // The craft floor runs against this, not against a screenshot and not against the
  // standalone candidate the language was gated on: the shipped page is the artefact, so the
  // shipped page is what gets measured. node .claude/plans/…/craftcheck.mjs <url>
  (window as unknown as { __audit: () => unknown }).__audit = () => {
    const rect = canvas.getBoundingClientRect();
    const sc = W / rect.width;
    const dom = [...root.querySelectorAll<HTMLElement>('.head h1, .head .deck, .search input, .claim .big, .claim .cap')]
      .map((el) => {
        const b = el.getBoundingClientRect();
        return {
          sel: el.className || el.tagName.toLowerCase(),
          x0: (b.left - rect.left) * sc, x1: (b.right - rect.left) * sc,
          y0: (b.top - rect.top) * sc, y1: (b.bottom - rect.top) * sc,
        };
      });
    const envelope: [number, number, number][] = [];
    if (!portrait) for (let px = foam.band.x0; px <= foam.band.x1; px += 4) envelope.push([px, topAt(px), botAt(px)]);
    return { ...AUDIT, portrait, dom, envelope, marks: placed.map((p) => [p.x, p.y, p.r]) };
  };

  // the rest of the page can now draw a name as the same object this one does
  publishField({
    mark: (slug) => {
      const p = placed.find((q) => q.m.slug === slug);
      return p && { n: p.m.n, slug: p.m.slug, py: p.m.py, r: p.r, ps: p.m.ps };
    },
    paint: (ctx, m: FieldMark, x, y, r) => {
      const prev = g;
      g = ctx;
      drawMark({ x, y, r, m: { n: m.n, slug: '', py: m.py, ps: m.ps, w: 0, x, y, r } }, blockOf(m.n));
      g = prev;
    },
  });

  // --- pointer -------------------------------------------------------------------------
  // The field bound `mousemove` and `click`, which is a hover interface: on a touch screen
  // there is no hover, so the story panel was unreachable and the first tap navigated away
  // from a field nobody had been able to read yet. So the two devices get the two
  // interactions they actually have — a mouse hovers to look and clicks to open, a finger
  // taps to look and taps the same mark again to open.
  const local = (cx: number, cy2: number, rect: DOMRect) =>
    [((cx - rect.left) * W) / rect.width, ((cy2 - rect.top) * H) / rect.height] as const;
  const open = (p: Placed) => { location.href = `${base}/name/${p.m.slug}`; };

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const [mx, my] = local(e.clientX, e.clientY, canvas.getBoundingClientRect());
    const f = hit(mx, my);
    canvas.style.cursor = f ? 'pointer' : 'default';
    void setFocus(f);
  }, { signal });
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') void setFocus(null);
  }, { signal });

  let tapX = 0, tapY = 0, tapT = 0, lastTouch = -1e9;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    tapX = e.clientX; tapY = e.clientY; tapT = e.timeStamp;
  }, { signal });
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') return;
    lastTouch = e.timeStamp;
    // a drag is the page scrolling past under the finger, not a choice
    if (Math.hypot(e.clientX - tapX, e.clientY - tapY) > 12 || e.timeStamp - tapT > 700) return;
    const rect = canvas.getBoundingClientRect();
    const [mx, my] = local(e.clientX, e.clientY, rect);
    const f = hit(mx, my, (11 * W) / rect.width);
    if (f && focus && f.m.slug === focus.m.slug) { open(f); return; }
    void setFocus(f, { speak: true });
  }, { signal });
  canvas.addEventListener('click', (e) => {
    // touch synthesises a click after pointerup; that one already chose what to do
    if (e.timeStamp - lastTouch < 900) return;
    const [mx, my] = local(e.clientX, e.clientY, canvas.getBoundingClientRect());
    const f = hit(mx, my);
    if (f) open(f);
  }, { signal });

  // --- keyboard ------------------------------------------------------------------------
  // 1,572 names and no way in without a mouse. Arrows walk the pack: the next mark in the
  // pressed direction, scored by how far along that direction it is plus how far off it —
  // a cone, so "right" cannot answer with something almost straight up.
  const step = (from: Placed | null, dx: number, dy: number) => {
    if (!from) return placed.reduce((b, p) => (along(p) < along(b) ? p : b), placed[0]);
    let best: Placed | null = null, bs = Infinity;
    for (const p of placed) {
      if (p === from) continue;
      const ax = (p.x - from.x) * dx + (p.y - from.y) * dy;
      if (ax <= 0.5) continue;
      const off = Math.abs((p.x - from.x) * dy - (p.y - from.y) * dx);
      if (off > ax * 2.2 + 26) continue;
      const s = ax + off * 1.8;
      if (s < bs) { bs = s; best = p; }
    }
    return best || from;
  };
  canvas.addEventListener('keydown', (e) => {
    const dirs: Record<string, [number, number]> = {
      ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1],
    };
    const d = dirs[e.key];
    if (d) {
      e.preventDefault();
      void setFocus(step(focus, d[0], d[1]), { speak: true, reveal: true });
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && focus) { e.preventDefault(); open(focus); return; }
    if (e.key === 'Escape' && focus) { e.preventDefault(); void setFocus(null, { speak: true }); }
  }, { signal });

  // the search box drives the same focus state, so typing your name lights it in the field
  const input = root.querySelector<HTMLInputElement>('input[data-foam-search]');
  if (input) {
    let typing = 0;
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { clearTimeout(typing); void setFocus(null); return; }
      const f = placed.find((p) => p.m.n.toLowerCase() === q) ||
                placed.find((p) => p.m.n.toLowerCase().startsWith(q)) || null;
      void setFocus(f, { speak: true });
      // On the narrow page the field runs three screens deep, so a mark lit off-screen is
      // no answer at all — the page goes to it. But not on the keystroke: scrolling away
      // from a box someone is still typing into, with the keyboard up, is the page fighting
      // them. It goes when they stop.
      clearTimeout(typing);
      if (f) typing = window.setTimeout(() => { if (focus === f) reveal(f); }, 480);
    }, { signal });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && focus) open(focus);
    }, { signal });
  }

  // explore modes: ghosts / comebacks / unisex are selections over this same field, so
  // they light in place instead of opening a separate list
  const bySlug = new Map(placed.map((p) => [p.m.slug, p]));
  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
    // Each mode is fronted by its own marks, at the field's true scale, drawn by the same
    // hand — the strip is a specimen of the selection, not an illustration of it. The row
    // is scaled to its own content so no two marks can ever share a footprint.
    const strip = btn.querySelector<HTMLCanvasElement>('canvas.strip');
    const picks = (btn.dataset.slugs || '').split(',').filter(Boolean)
      .map((s) => bySlug.get(s)).filter((p): p is Placed => !!p);
    if (strip && picks.length) {
      // Three findings, so three pictures — not three rows of the same dot. Each strip is a
      // miniature of the field's own timeline, so a set's SHAPE is the finding: ghosts crowd
      // the left because they all crested before the war; comebacks sit in pairs; the unisex
      // names are a modern band. And each class gets its own mark, drawn from what the class
      // MEANS — a ghost is a name that emptied out, so it is drawn hollow.
      const SW = strip.width / 2, SH = strip.height / 2;
      const sg = strip.getContext('2d')!;
      sg.setTransform(1, 0, 0, 1, 0, 0); sg.scale(2, 2);
      sg.clearRect(0, 0, SW, SH);
      const prev = g;
      g = sg;
      const kind = btn.dataset.mode;
      const rMax = Math.max(...picks.map((p) => p.r));
      const k3 = Math.min(0.62, (SH - 10) / (2 * rMax));
      const spanX = (y: number) => 10 + ((y - foam.y0) / (foam.y1 - foam.y0)) * (SW - 20);
      // nudge apart along x only, so the timeline survives but no two marks share a footprint
      const lay = picks.map((p) => ({ x: spanX(p.m.py), r: Math.max(2.6, p.r * k3), p }))
        .sort((a, b) => a.x - b.x);
      for (let pass = 0; pass < 60; pass++) {
        let moved = 0;
        for (let i = 1; i < lay.length; i++) {
          const need = lay[i - 1].r + lay[i].r + 2.5, d = lay[i].x - lay[i - 1].x;
          if (d < need) { const push = (need - d) / 2; lay[i - 1].x -= push; lay[i].x += push; moved++; }
        }
        for (const l of lay) l.x = clamp(l.x, l.r + 2, SW - l.r - 2);
        if (!moved) break;
      }
      for (const l of lay) {
        const m2 = { ...l.p.m, slug: '', x: l.x, y: SH / 2, r: l.r };
        if (kind === 'ghosts') {
          // hollow: the name is still remembered, the births are gone
          const k4 = noise1(hashOf(l.p.m.n, l.p.m.py));
          const b4 = LETTERS[blockOf(l.p.m.n)][2];
          const q = { x: l.x, y: SH / 2, r: l.r, m: m2 };
          outline(q, k4, 0.05);
          sg.strokeStyle = css(towards(b4, { L: 0.26, C: b4.C, h: b4.h }, 0.66), 0.85);
          sg.lineWidth = Math.max(1, l.r * 0.16); sg.lineJoin = 'round'; sg.stroke();
        } else {
          drawMark({ x: l.x, y: SH / 2, r: l.r, m: m2 }, blockOf(l.p.m.n));
          if (kind === 'unisex') {
            // a unisex name is one name shared, so the mark is halved
            const k4 = noise1(hashOf(l.p.m.n, l.p.m.py));
            const b4 = LETTERS[blockOf(l.p.m.n)][2];
            sg.save();
            outline({ x: l.x, y: SH / 2, r: l.r, m: m2 }, k4, 0.05);
            sg.clip();
            sg.fillStyle = css(towards(b4, { L: 0.26, C: b4.C, h: b4.h }, 0.66), 0.30);
            sg.fillRect(l.x - l.r - 1, SH / 2 - l.r - 1, l.r + 1, l.r * 2 + 2);
            sg.restore();
          }
        }
      }
      // the timeline the strip is drawn on, named at both ends
      sg.strokeStyle = 'rgba(120,131,146,0.30)'; sg.lineWidth = 1;
      sg.beginPath(); sg.moveTo(10, SH - 5); sg.lineTo(SW - 10, SH - 5); sg.stroke();
      sg.font = '400 8.5px "Archivo Narrow"'; sg.fillStyle = '#98a1ae';
      sg.textAlign = 'left'; sg.fillText(String(foam.y0), 10, SH - 9);
      sg.textAlign = 'right'; sg.fillText(String(foam.y1), SW - 10, SH - 9);
      sg.textAlign = 'left';
      g = prev;
    }
    btn.addEventListener('click', () => {
      const slugs = (btn.dataset.slugs || '').split(',').filter(Boolean);
      const on = btn.getAttribute('aria-pressed') === 'true';
      for (const b of root.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', 'false');
      lit = on ? null : new Set(slugs);
      if (!on) btn.setAttribute('aria-pressed', 'true');
      void setFocus(null);
      render();
    }, { signal });
  }

  // The overlay is measured, so a width change invalidates the measurement — and the
  // portrait key canvases are drawn at their own CSS size, so they are redrawn with it.
  let idle = 0;
  const settle = () => {
    topCache = null;
    clearTimeout(idle);
    idle = window.setTimeout(() => { paintKeys(); render(); }, 160);
  };
  window.addEventListener('resize', settle, { signal });
  window.addEventListener('orientationchange', settle, { signal });

  // Crossing the breakpoint changes which pack the page is drawing, and that is a different
  // solve — not a restyle. Everything this mount owns hangs off one signal, so remounting is
  // safe: the old listeners go with it.
  narrow.addEventListener('change', () => { void mountFoam(root); }, { signal });
}
