/**
 * The foam: one mark per name, solved once at build time.
 *
 * The homepage hero draws 1,572 marks whose positions have to be packed without overlap.
 * That solve is ~6s of single-threaded work, which is not something a page hero may spend,
 * and it must be deterministic so a render is reproducible and a share image matches what
 * the visitor saw. So it happens here and ships as data.
 *
 * Three decisions worth knowing, because each replaced something that looked fine and was
 * wrong:
 *
 *  - The mark scale is SOLVED from the ink budget, not chosen. Fixing the total area of
 *    every mark at a packable fraction of the band makes the coefficient fall out of a
 *    quadratic, so "one bubble per name" stays true at any band size or with future data.
 *    A hard-coded scale silently drops whatever will not fit.
 *  - x is allocated BY INK, not linearly in the year. The SSA record opens in 1880, so
 *    every Victorian giant is already at its peak in the first year on file; a linear axis
 *    drops a tenth of the page's ink into a 43px column and no packer can close it. Order
 *    is still strictly by peak year — only the spacing is non-linear, which is why the
 *    axis under the field carries the mapping.
 *  - The band's HEIGHT at each x is the biggest name alive that year, on the same
 *    area-true scale as the marks, so the field's silhouette is the argument the page
 *    makes: 4.81% of American babies were called John in 1880; the biggest name since 2010
 *    managed 0.67%.
 */
import { START_YEAR, END_YEAR } from '../../src/lib/types.ts';

export interface FoamInput {
  name: string;
  slug: string;
  shares: number[];        // true share of all births, per year, fraction
  peakYear: number;
  peakShare: number;
}

export interface FoamMark {
  n: string; slug: string; py: number; ps: number; w: number;
  x: number; y: number; r: number;
}

export interface Foam {
  k: number; rMin: number; seed: number;
  band: { x0: number; x1: number; y0: number; y1: number };
  cy: number; y0: number; y1: number;
  yearEdge: number[];      // year -> x boundary, length span+1
  yearH: number[];         // year -> band height
  marks: FoamMark[];
}

/** Peak share below this is noise, not a name the field can carry. 0.04% of a year. */
export const FOAM_THRESHOLD = 0.0004;

const BX0 = 72, BX1 = 1332, BY0 = 230, BY1 = 810, CY = 520;
const R_MIN = 1.4, DENSITY = 0.62, HMAX = 580, HEIGHT_IN_MARKS = 7.4;
const ITER = 900, FREEZE = 650, RELAX = 0.62, SWEEPS = 1500, SEED = 20260801;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const rng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
};

/** The gap between two marks grows with the marks. A constant hairline makes the field
 *  read as one extruded slab of colour: at landmark scale the marks are effectively
 *  tangent and the ground never gets through. */
const gapOf = (ri: number, rj: number) => Math.max(1.0, 0.17 * (ri + rj));

export function buildFoam(input: FoamInput[]): Foam {
  const marks = input.filter((m) => m.peakShare >= FOAM_THRESHOLD);
  if (!marks.length) throw new Error('foam: no marks above threshold');
  const SPAN = END_YEAR - START_YEAR + 1;
  const MAXPS = Math.max(...marks.map((m) => m.peakShare));
  const S = marks.map((m) => Math.sqrt(m.peakShare / MAXPS));

  // years a name held above half its own peak — the page's second channel
  const widthOf = (m: FoamInput) => {
    const half = m.peakShare / 2;
    let w = 0;
    for (const v of m.shares) if (v >= half) w++;
    return w;
  };

  const scaleFor = (budget: number) => {
    const a = Math.PI * S.reduce((s, v) => s + v * v, 0);
    const b = 2 * Math.PI * R_MIN * S.reduce((s, v) => s + v, 0);
    const c = Math.PI * marks.length * R_MIN * R_MIN - budget;
    return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  };

  // biggest name alive in each year, lightly smoothed: year-to-year jitter is noise, the
  // decline is the signal
  const ridge = (() => {
    const raw = new Float64Array(SPAN);
    for (const m of marks) {
      for (let i = 0; i < SPAN && i < m.shares.length; i++) if (m.shares[i] > raw[i]) raw[i] = m.shares[i];
    }
    const sm = new Float64Array(SPAN);
    for (let i = 0; i < SPAN; i++) {
      let s = 0, c = 0;
      for (let j = -2; j <= 2; j++) { const k = i + j; if (k >= 0 && k < SPAN) { s += raw[k]; c++; } }
      sm[i] = s / c;
    }
    return sm;
  })();

  // Height on the SAME scale as the marks — HEIGHT_IN_MARKS times the diameter a bubble of
  // that share would have — never linearly in share. A page where one thing encodes share
  // by area and another by length is a page with two rulers on it and no way to tell.
  const heights = (rOf: (ps: number) => number) => {
    const d = Array.from(ridge, (v) => 2 * rOf(v) * HEIGHT_IN_MARKS);
    const top = Math.max(...d);
    return d.map((v) => (v / top) * HMAX);
  };

  const axisFor = (rOf: (ps: number) => number, h: number[]) => {
    const ink = new Float64Array(SPAN);
    for (const m of marks) ink[clamp(m.peakYear - START_YEAR, 0, SPAN - 1)] += Math.PI * rOf(m.peakShare) ** 2;
    const want = Array.from(ink, (v, i) => v / h[i]);
    const total = want.reduce((s, v) => s + v, 0);
    const cum = new Float64Array(SPAN + 1);
    for (let i = 0; i < SPAN; i++) cum[i + 1] = cum[i] + want[i];
    const edge = Array.from(cum, (c) => BX0 + (c / total) * (BX1 - BX0));
    const at = (y: number) => { const i = clamp(y - START_YEAR, 0, SPAN - 1); return (edge[i] + edge[i + 1]) / 2; };
    const halfAt = (px: number) => {
      let lo = 0, hi = SPAN - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (px < edge[mid + 1]) hi = mid; else lo = mid + 1; }
      const a = (edge[lo] + edge[lo + 1]) / 2;
      const nb = px < a ? Math.max(0, lo - 1) : Math.min(SPAN - 1, lo + 1);
      const b = (edge[nb] + edge[nb + 1]) / 2;
      const t = a === b ? 0 : clamp((px - a) / (b - a), 0, 1);
      return (h[lo] + (h[nb] - h[lo]) * t) / 2;
    };
    const area = h.reduce((s, v, i) => s + v * (edge[i + 1] - edge[i]), 0);
    return { edge, at, halfAt, area };
  };

  function attempt(K: number) {
    const rOf = (ps: number) => R_MIN + K * Math.sqrt(ps / MAXPS);
    const H = heights(rOf);
    const axis = axisFor(rOf, H);
    const sorted = [...marks].sort((a, b) => b.peakShare - a.peakShare);
    const rand = rng(SEED), n = sorted.length;
    const R = new Float64Array(n), X = new Float64Array(n), Y = new Float64Array(n),
          X0 = new Float64Array(n), Wt = new Float64Array(n), DX = new Float64Array(n), DY = new Float64Array(n);
    let rMax = 0;
    for (let i = 0; i < n; i++) {
      R[i] = rOf(sorted[i].peakShare); rMax = Math.max(rMax, R[i]);
      X0[i] = axis.at(sorted[i].peakYear);
      X[i] = X0[i] + (rand() - 0.5) * 8;
      Y[i] = CY + (rand() - 0.5) * 2 * axis.halfAt(X[i]) * 0.9;
      Wt[i] = 1 / (R[i] * R[i]);                     // inertia by area: landmarks hold, tail fills
    }
    const hold = (i: number) => {
      X[i] = clamp(X[i], BX0 + R[i], BX1 - R[i]);
      const half = axis.halfAt(X[i]);
      Y[i] = half <= R[i] ? CY : clamp(Y[i], CY - half + R[i], CY + half - R[i]);
    };
    const cell = rMax * 2 + gapOf(rMax, rMax) + 1;
    const cols = Math.ceil((BX1 - BX0) / cell) + 3, rows = Math.ceil((BY1 - BY0) / cell) + 3;
    const grid: number[][] = Array.from({ length: cols * rows }, () => []);
    const cx = (v: number) => clamp(Math.floor((v - BX0) / cell) + 1, 1, cols - 2);
    const cy = (v: number) => clamp(Math.floor((v - BY0) / cell) + 1, 1, rows - 2);

    // Phase 1 — relaxation. Corrections are accumulated and applied once per step
    // (Jacobi): resolved in place, a mark wedged between several neighbours overshoots and
    // rings forever. Two weak springs hold each mark near its own year's x and toward the
    // centre line, released for the last FREEZE steps so the field breathes out.
    for (let it = 0; it < ITER; it++) {
      for (const g of grid) g.length = 0;
      for (let i = 0; i < n; i++) { grid[cy(Y[i]) * cols + cx(X[i])].push(i); DX[i] = DY[i] = 0; }
      for (let i = 0; i < n; i++) {
        const gx = cx(X[i]), gy = cy(Y[i]);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
          for (const j of grid[(gy + b) * cols + (gx + a)]) {
            if (j <= i) continue;
            let dx = X[j] - X[i], dy = Y[j] - Y[i];
            const need = R[i] + R[j] + gapOf(R[i], R[j]), d2 = dx * dx + dy * dy;
            if (d2 >= need * need) continue;
            let d = Math.sqrt(d2);
            if (d < 1e-6) { dx = rand() - 0.5; dy = rand() - 0.5; d = Math.hypot(dx, dy) || 1e-6; }
            const push = need - d, share = Wt[i] + Wt[j];
            const ux = (dx / d) * push, uy = (dy / d) * push;
            DX[i] -= ux * Wt[i] / share; DY[i] -= uy * Wt[i] / share;
            DX[j] += ux * Wt[j] / share; DY[j] += uy * Wt[j] / share;
          }
        }
      }
      const free = it < ITER - FREEZE;
      for (let i = 0; i < n; i++) {
        X[i] += DX[i] * RELAX; Y[i] += DY[i] * RELAX;
        if (free) { X[i] += (X0[i] - X[i]) * 0.06; Y[i] += (CY - Y[i]) * 0.03; }
        hold(i);
      }
    }

    // Phase 2 — hard resolve. Relaxation leaves a few tenths of a pixel at this density;
    // sequential in-place separation clears the stragglers. No residual is acceptable: two
    // marks sharing a footprint is the defect this whole build exists to avoid.
    for (let s = 0; s < SWEEPS; s++) {
      for (const g of grid) g.length = 0;
      for (let i = 0; i < n; i++) grid[cy(Y[i]) * cols + cx(X[i])].push(i);
      let hitCount = 0;
      for (let i = 0; i < n; i++) {
        const gx = cx(X[i]), gy = cy(Y[i]);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
          for (const j of grid[(gy + b) * cols + (gx + a)]) {
            if (j <= i) continue;
            let dx = X[j] - X[i], dy = Y[j] - Y[i];
            const need = R[i] + R[j] + gapOf(R[i], R[j]) * 0.5, d2 = dx * dx + dy * dy;
            if (d2 >= need * need) continue;
            let d = Math.sqrt(d2);
            if (d < 1e-6) { dx = rand() - 0.5; dy = rand() - 0.5; d = Math.hypot(dx, dy) || 1e-6; }
            hitCount++;
            const push = need - d, share = Wt[i] + Wt[j];
            const ux = (dx / d) * push, uy = (dy / d) * push;
            X[i] -= ux * Wt[i] / share; Y[i] -= uy * Wt[i] / share;
            X[j] += ux * Wt[j] / share; Y[j] += uy * Wt[j] / share;
            hold(i); hold(j);
          }
        }
      }
      if (!hitCount) break;
    }

    // audit: any true overlap at all fails the attempt
    let overlaps = 0;
    for (const g of grid) g.length = 0;
    for (let i = 0; i < n; i++) grid[cy(Y[i]) * cols + cx(X[i])].push(i);
    for (let i = 0; i < n; i++) {
      const gx = cx(X[i]), gy = cy(Y[i]);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        for (const j of grid[(gy + b) * cols + (gx + a)]) {
          if (j <= i) continue;
          if (R[i] + R[j] - Math.hypot(X[j] - X[i], Y[j] - Y[i]) > 1e-3) overlaps++;
        }
      }
    }
    const out: FoamMark[] = sorted.map((m, i) => ({
      n: m.name, slug: m.slug, py: m.peakYear, ps: +(m.peakShare * 100).toFixed(4), w: widthOf(m),
      x: +X[i].toFixed(2), y: +Y[i].toFixed(2), r: +R[i].toFixed(2),
    }));
    return { out, axis, H, overlaps };
  }

  // K and the band's area depend on each other, so settle them before packing.
  let K = scaleFor(DENSITY * (BX1 - BX0) * (BY1 - BY0));
  for (let i = 0; i < 5; i++) {
    const rOf = (ps: number) => R_MIN + K * Math.sqrt(ps / MAXPS);
    K = scaleFor(DENSITY * axisFor(rOf, heights(rOf)).area);
  }

  for (let i = 0; i < 8; i++) {
    const res = attempt(K);
    if (res.overlaps === 0) {
      return {
        k: +K.toFixed(3), rMin: R_MIN, seed: SEED,
        band: { x0: BX0, x1: BX1, y0: BY0, y1: BY1 },
        cy: CY, y0: START_YEAR, y1: END_YEAR,
        yearEdge: res.axis.edge.map((v) => +v.toFixed(2)),
        yearH: Array.from(res.H, (v) => +v.toFixed(1)),
        marks: res.out,
      };
    }
    K *= 0.97;                                        // too big for the band — never drop a name
  }
  throw new Error('foam: pack never closed clean');
}
