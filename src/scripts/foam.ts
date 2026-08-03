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
 */
import { rng, noise1, towards, css, speckle, grain, clamp, type Lch } from '../lib/draw.ts';

interface Mark { n: string; slug: string; py: number; ps: number; w: number; x: number; y: number; r: number; }
interface Foam {
  k: number; rMin: number; band: { x0: number; x1: number; y0: number; y1: number };
  cy: number; y0: number; y1: number; yearEdge: number[]; yearH: number[]; marks: Mark[];
}
interface Placed { x: number; y: number; r: number; m: Mark; }

const W = 1400, H = 900, DPR = Math.min(2, window.devicePixelRatio || 1);
const PAPER: Lch = { L: 0.988, C: 0.004, h: 250 };

const LETTERS: [string, string, Lch][] = [
  ['A', 'B', { L: 0.58, C: 0.155, h: 25 }],
  ['C', 'D', { L: 0.68, C: 0.150, h: 72 }],
  ['E', 'I', { L: 0.70, C: 0.145, h: 128 }],
  ['J', 'K', { L: 0.60, C: 0.120, h: 178 }],
  ['L', 'M', { L: 0.58, C: 0.130, h: 232 }],
  ['N', 'S', { L: 0.54, C: 0.155, h: 292 }],
  ['T', 'Z', { L: 0.60, C: 0.165, h: 344 }],
];
const ERAS: [number, number, string][] = [
  [1880, 1904, '1880s–1900s'], [1905, 1929, '1900s–20s'], [1930, 1949, '1930s–40s'],
  [1950, 1969, '1950s–60s'], [1970, 1989, '1970s–80s'], [1990, 2009, '1990s–2000s'],
  [2010, 2030, '2010s–now'],
];
const blockOf = (name: string) => {
  const c0 = name[0].toUpperCase();
  for (let i = 0; i < LETTERS.length; i++) if (c0 >= LETTERS[i][0] && c0 <= LETTERS[i][1]) return i;
  return LETTERS.length - 1;
};
const hashOf = (str: string, salt: number) => {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

export async function mountFoam(root: HTMLElement) {
  const base = root.dataset.base || '';
  const [foam] = await Promise.all([
    fetch(`${base}/data/foam.json`).then((r) => r.json() as Promise<Foam>),
    // Canvas does not wait for a webfont — it silently falls back mid-draw, and the
    // fallback for an unresolved family is a serif. Every fitted label is measured against
    // the font, so resolving first is correctness, not polish.
    document.fonts.load('500 12px Outfit').then(() => document.fonts.load('600 10px "Archivo Narrow"')),
  ]);
  await document.fonts.ready;

  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  canvas.width = W * DPR; canvas.height = H * DPR;
  const view = canvas.getContext('2d')!;
  const buf = document.createElement('canvas');
  buf.width = W * DPR; buf.height = H * DPR;
  const bctx = buf.getContext('2d')!;

  const { x0: BX0, x1: BX1 } = foam.band, CY = foam.cy;
  const placed: Placed[] = foam.marks.map((m) => ({ x: m.x, y: m.y, r: m.r, m }));
  const MAXPS = Math.max(...placed.map((p) => p.m.ps));
  const rOf = (ps: number) => foam.rMin + foam.k * Math.sqrt(ps / MAXPS);

  const xStart = (y: number) => foam.yearEdge[clamp(y - foam.y0, 0, foam.yearH.length - 1)];
  const xEnd = (y: number) => foam.yearEdge[clamp(y - foam.y0, 0, foam.yearH.length - 1) + 1];
  const halfAt = (px: number) => {
    const E = foam.yearEdge, Hh = foam.yearH;
    let lo = 0, hi = Hh.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (px < E[mid + 1]) hi = mid; else lo = mid + 1; }
    const a = (E[lo] + E[lo + 1]) / 2;
    const nb = px < a ? Math.max(0, lo - 1) : Math.min(Hh.length - 1, lo + 1);
    const b = (E[nb] + E[nb + 1]) / 2;
    const t = a === b ? 0 : clamp((px - a) / (b - a), 0, 1);
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
    const steps = clamp(Math.round(p.r * 2.4), 16, 84);
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const rr = p.r * (1 + wob * k((a / (Math.PI * 2)) * 6 + phase)) + grow;
      const px = p.x + Math.cos(a) * rr, py = p.y + Math.sin(a) * rr;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  };

  const drawMark = (p: Placed, blockIdx: number) => {
    const seed = hashOf(p.m.n, p.m.py);
    const base2 = LETTERS[blockIdx][2];
    const strength = clamp((p.r - 2.4) / 16, 0, 1);
    const col = towards(base2, { L: 0.955, C: 0.012, h: base2.h }, 1 - (0.54 + strength * 0.46));
    const r2 = rng(seed);
    const k = noise1(seed);
    const wob = p.r < 3 ? 0 : clamp(0.058 - p.r * 0.0007, 0.032, 0.058);
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
    // the subject is names, and a name is made of letters — the biggest marks carry a
    // drawn initial, struck twice off-register in the same hand as the edge
    if (p.r > 17) {
      g.save(); outline(p, k, wob * 0.6); g.clip();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `700 ${p.r * 1.72}px Outfit`;
      g.lineWidth = clamp(p.r * 0.05, 0.7, 1.6); g.lineJoin = 'round';
      for (const [dx2, dy2, al] of [[-0.6, 0.5, 0.2], [0.7, -0.4, 0.15]]) {
        g.strokeStyle = css(ink, al);
        g.strokeText(p.m.n[0], p.x + dx2, p.y + dy2 + p.r * 0.06);
      }
      g.textBaseline = 'alphabetic';
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

  function paintField() {
    g = bctx;
    bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.scale(DPR, DPR);
    bctx.fillStyle = css(PAPER); bctx.fillRect(0, 0, W, H);

    const order = [...placed].sort((a, b) => a.r - b.r);
    for (const p of order) drawMark(p, blockOf(p.m.n));

    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const p of order) {
      if (p.r < 10) continue;
      const pad = 2.4 + p.r * 0.05;
      const pct = p.m.ps.toFixed(1) + '%';
      const top = clamp(p.r * 0.42, 8.5, 19);
      let fs = 0, both = false;
      for (let t = top; t >= 8.5; t -= 0.5) {
        if (chordFits(p.r, p.m.n, `500 ${t}px Outfit`, -t * 0.06, pad) &&
            chordFits(p.r, pct, `300 ${t * 0.58}px Outfit`, t * 0.72, pad)) { fs = t; both = true; break; }
      }
      if (!fs) for (let t = top; t >= 8.5; t -= 0.5) {
        if (chordFits(p.r, p.m.n, `500 ${t}px Outfit`, 0, pad)) { fs = t; break; }
      }
      if (!fs) continue;                               // will not fit its own circle
      g.font = `500 ${fs}px Outfit`;
      g.fillStyle = 'rgba(255,255,255,0.96)';
      g.fillText(p.m.n, p.x, p.y - (both ? fs * 0.06 : 0));
      if (!both) continue;
      g.font = `300 ${fs * 0.58}px Outfit`;
      g.fillStyle = 'rgba(255,255,255,0.80)';
      g.fillText(pct, p.x, p.y + fs * 0.72);
    }
    g.textBaseline = 'alphabetic';

    // the axis: era is position, so the strip below the field carries the mapping, and the
    // credit closes the same row rather than opening a second one
    const KY = 856, RULE = KY + 8;
    const caps = (str: string, font: string, ls: number, px: number, py: number, fill: string) => {
      g.font = font; g.fillStyle = fill;
      let cx2 = px;
      for (const ch of str.toUpperCase()) { g.fillText(ch, cx2, py); cx2 += g.measureText(ch).width + ls; }
    };
    for (const [a, b, label] of ERAS) {
      const px0 = xStart(a), px1 = xEnd(Math.min(b, foam.y1));
      g.textAlign = 'left';
      caps(label, '600 9.5px "Archivo Narrow"', 1.15, px0, KY, '#5b6472');
      g.strokeStyle = 'rgba(120,131,146,0.34)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(px0, RULE); g.lineTo(px1 - 5, RULE); g.stroke();
      g.beginPath(); g.moveTo(px0, RULE - 3.5); g.lineTo(px0, RULE + 3.5); g.stroke();
    }
    g.font = '400 10.5px "Archivo Narrow"'; g.fillStyle = '#9aa3b0'; g.textAlign = 'left';
    g.fillText(
      `U.S. Social Security Administration · ${placed.length.toLocaleString('en-US')} names, ` +
      `${foam.y0}–${foam.y1} — every one that ever took 0.04% of a year's births`,
      xStart(foam.y0), RULE + 16);

    grain(bctx, W, H, 8, 5);
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
  const hit = (mx: number, my: number) => {
    let best: Placed | null = null;
    for (const p of index.get(ckey(Math.floor(mx / cell), Math.floor(my / cell))) || [])
      if ((mx - p.x) ** 2 + (my - p.y) ** 2 <= p.r * p.r && (!best || p.r < best.r)) best = p;
    return best;
  };

  // The story sits low in the field, not in the top band. The band is spoken for — the
  // headline, the search and the claim all live there — and at focus the field itself is
  // ghosted to 13%, so the roomiest clear ground on the page is the field. Drawn on its own
  // paper so it reads over whatever it covers.
  const PANEL = { x0: BX0 + 26, x1: BX0 + 470, y0: 636, y1: 786 };
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

  function drawStory(p: Placed, cv: number[]) {
    const n = cv.length, peak = Math.max(...cv);
    const PAD = 18, TITLE = 26, META = 16;
    const plotTop = PANEL.y0 + TITLE + META + 8;
    const sx = (i: number) => PANEL.x0 + (i / (n - 1)) * (PANEL.x1 - PANEL.x0);
    const sy = (v: number) => PANEL.y1 - (v / peak) * (PANEL.y1 - plotTop);
    const b2 = LETTERS[blockOf(p.m.n)][2];
    const ink = towards(b2, { L: 0.26, C: b2.C, h: b2.h }, 0.66);

    view.fillStyle = css(PAPER, 0.93);
    view.fillRect(PANEL.x0 - PAD, PANEL.y0 - PAD, PANEL.x1 - PANEL.x0 + PAD * 2, PANEL.y1 - PANEL.y0 + PAD * 2.4);
    view.strokeStyle = 'rgba(120,131,146,0.22)'; view.lineWidth = 1;
    view.strokeRect(PANEL.x0 - PAD, PANEL.y0 - PAD, PANEL.x1 - PANEL.x0 + PAD * 2, PANEL.y1 - PANEL.y0 + PAD * 2.4);

    view.textAlign = 'left';
    view.font = '700 22px Outfit'; view.fillStyle = '#1d2430';
    view.fillText(p.m.n, PANEL.x0, PANEL.y0 + 16);
    view.font = '400 11px "Archivo Narrow"'; view.fillStyle = '#5b6472';
    view.fillText(`peaked ${p.m.py} at ${p.m.ps.toFixed(2)}% of all births · above half that for ${p.m.w} years`,
      PANEL.x0, PANEL.y0 + TITLE + 10);

    view.strokeStyle = 'rgba(120,131,146,0.30)'; view.lineWidth = 1;
    view.beginPath(); view.moveTo(PANEL.x0, PANEL.y1); view.lineTo(PANEL.x1, PANEL.y1); view.stroke();
    view.beginPath();
    for (let i = 0; i < n; i++) { const px = sx(i), py = sy(cv[i]); i ? view.lineTo(px, py) : view.moveTo(px, py); }
    view.lineTo(PANEL.x1, PANEL.y1); view.lineTo(PANEL.x0, PANEL.y1); view.closePath();
    view.fillStyle = css(b2, 0.22); view.fill();
    view.beginPath();
    for (let i = 0; i < n; i++) { const px = sx(i), py = sy(cv[i]); i ? view.lineTo(px, py) : view.moveTo(px, py); }
    view.strokeStyle = css(ink, 0.85); view.lineWidth = 1.8; view.lineJoin = 'round'; view.stroke();
    const pi = cv.indexOf(peak);
    view.beginPath(); view.arc(sx(pi), sy(peak), 3.4, 0, 7); view.fillStyle = css(ink, 0.95); view.fill();

    view.font = '400 10px "Archivo Narrow"'; view.fillStyle = '#98a1ae';
    view.fillText(String(foam.y0), PANEL.x0, PANEL.y1 + 14);
    view.textAlign = 'right';
    view.fillText(String(foam.y1), PANEL.x1, PANEL.y1 + 14);
    view.fillStyle = '#5b6472';
    view.fillText('click to open its full story →', PANEL.x1, PANEL.y0 + 16);
    view.textAlign = 'left';
  }

  let focus: Placed | null = null;
  let lit: Set<string> | null = null;          // an explore set, e.g. every ghost

  function render() {
    view.setTransform(1, 0, 0, 1, 0, 0);
    view.clearRect(0, 0, W * DPR, H * DPR);
    view.scale(DPR, DPR);
    if (!focus && !lit) { view.drawImage(buf, 0, 0, W, H); return; }
    view.fillStyle = css(PAPER); view.fillRect(0, 0, W, H);
    view.globalAlpha = 0.13; view.drawImage(buf, 0, 0, W, H); view.globalAlpha = 1;
    g = view;
    if (lit) {
      // A lit set has to be readable as names, not as anonymous dots — the panels it
      // replaced listed six names in words, so every lit mark says which one it is.
      for (const p of placed) if (lit.has(p.m.slug)) drawMark(p, blockOf(p.m.n));
      view.textAlign = 'center';
      view.font = '500 11.5px Outfit';
      for (const p of placed) {
        if (!lit.has(p.m.slug)) continue;
        const ly = p.y + p.r + 14, w2 = view.measureText(p.m.n).width;
        view.fillStyle = css(PAPER, 0.9);
        view.fillRect(p.x - w2 / 2 - 4, ly - 11, w2 + 8, 15);
        view.fillStyle = '#1d2430';
        view.fillText(p.m.n, p.x, ly);
      }
      view.textAlign = 'left';
    }
    if (focus) {
      drawMark(focus, blockOf(focus.m.n));
      view.beginPath(); view.arc(focus.x, focus.y, focus.r + 5.5, 0, 7);
      view.strokeStyle = 'rgba(29,36,48,0.85)'; view.lineWidth = 1.4; view.stroke();
    }
    g = bctx;
    if (focus) {
      const cv = curves.get(focus.m.slug);
      if (cv) drawStory(focus, cv);
    }
  }

  async function setFocus(p: Placed | null) {
    if (p === focus) return;
    focus = p;
    render();
    if (p) { const cv = await curveFor(p.m); if (cv && focus === p) render(); }
  }

  paintField();
  render();

  const toLocal = (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height] as const;
  };
  canvas.addEventListener('mousemove', (e) => {
    const [mx, my] = toLocal(e);
    const f = hit(mx, my);
    canvas.style.cursor = f ? 'pointer' : 'default';
    void setFocus(f);
  });
  canvas.addEventListener('mouseleave', () => void setFocus(null));
  canvas.addEventListener('click', (e) => {
    const [mx, my] = toLocal(e);
    const f = hit(mx, my);
    if (f) location.href = `${base}/name/${f.m.slug}`;
  });

  // the search box drives the same focus state, so typing your name lights it in the field
  const input = root.querySelector<HTMLInputElement>('input[data-foam-search]');
  if (input) {
    const bySlug = new Map(placed.map((p) => [p.m.slug, p]));
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { void setFocus(null); return; }
      const f = placed.find((p) => p.m.n.toLowerCase() === q) ||
                placed.find((p) => p.m.n.toLowerCase().startsWith(q)) || null;
      void setFocus(f);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && focus) location.href = `${base}/name/${focus.m.slug}`;
    });
    void bySlug;
  }

  // explore modes: ghosts / comebacks / unisex are selections over this same field, so
  // they light in place instead of opening a separate list
  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
    btn.addEventListener('click', () => {
      const slugs = (btn.dataset.slugs || '').split(',').filter(Boolean);
      const on = btn.getAttribute('aria-pressed') === 'true';
      for (const b of root.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', 'false');
      lit = on ? null : new Set(slugs);
      if (!on) btn.setAttribute('aria-pressed', 'true');
      void setFocus(null);
      render();
    });
  }
}
