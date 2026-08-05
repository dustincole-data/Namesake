import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cpus } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readTopSlugs, readPayload } from '../src/lib/data.ts';
import { shardKey } from '../src/lib/format.ts';
import { archetypeOf } from '../src/lib/archetype.ts';
import { cardTree, brandTree, type CardOpts } from './card.ts';
import type { NamePayload } from '../src/lib/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'og');
const W = 1200, H = 630;

// The page's two faces, statically instanced — satori's opentype.js parser cannot read a
// variable font's fvar table, and it falls back per WEIGHT, not per family, so every weight
// the card sets has to be loaded as its own file or that string silently renders in another
// face. The card sets Outfit 300/500/700 and Archivo Narrow 400/600. No serif ships.
const A = join(ROOT, 'scripts', 'assets');
export const FONTS = [
  { name: 'Outfit', data: await readFile(join(A, 'Outfit-300.ttf')), weight: 300 as const, style: 'normal' as const },
  { name: 'Outfit', data: await readFile(join(A, 'Outfit-500.ttf')), weight: 500 as const, style: 'normal' as const },
  { name: 'Outfit', data: await readFile(join(A, 'Outfit-700.ttf')), weight: 700 as const, style: 'normal' as const },
  { name: 'Archivo Narrow', data: await readFile(join(A, 'ArchivoNarrow-400.ttf')), weight: 400 as const, style: 'normal' as const },
  { name: 'Archivo Narrow', data: await readFile(join(A, 'ArchivoNarrow-600.ttf')), weight: 600 as const, style: 'normal' as const },
];

/** years a name held above half its own peak — the quantity the mark's ARC encodes */
export function spanOf(curve: number[]): number {
  const peak = Math.max(...curve, 0);
  if (!peak) return 0;
  let n = 0;
  for (const v of curve) if (v >= peak / 2) n++;
  return n;
}

export function optsFor(p: NamePayload): CardOpts {
  return {
    name: p.name, caption: p.caption, startYear: p.startYear,
    endYear: p.startYear + p.curve.length - 1, curve: p.curve,
    peakYear: p.peakYear, peakCount: p.peakCount,
    peakShare: p.maxShare * 100, spanYears: spanOf(p.curve),
    archetypeLabel: archetypeOf(p.archetype).label,
  };
}

async function toPng(tree: unknown) {
  const svg = await satori(tree as any, { width: W, height: H, fonts: FONTS });
  // loadSystemFonts:false is critical — satori vectorizes text to <path>, so there is
  // no <text> for resvg to shape; without this, resvg scans the Windows font DB (~2s/img).
  return new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
}

/**
 * Render one contiguous slice of the work list — the unit of work a thread gets.
 *
 * `readPayload` opens and JSON-parses a whole shard to answer for ONE name, and the slugs
 * arrive in popularity order, so rendering them in that order re-parsed a multi-megabyte
 * file 5,001 times. The list is grouped by shard before it is sliced (see `workList`), so a
 * single-entry cache turns that into one read per shard.
 */
async function renderSlice(slugs: string[], from: number, to: number, report: (n: number) => void) {
  let n = 0, held = '', shard: Record<string, NamePayload> = {};
  for (let i = from; i < to; i++) {
    const slug = slugs[i], key = shardKey(slug);
    if (key !== held) {
      try { shard = JSON.parse(await readFile(join(ROOT, 'public', 'data', 'names', `${key}.json`), 'utf8')); }
      catch { shard = {}; }
      held = key;
    }
    const p = shard[slug];
    if (!p) continue;
    await writeFile(join(OUT, `${slug}.png`), await toPng(cardTree(optsFor(p))));
    if (++n % 100 === 0) report(100);
  }
  report(n % 100);
  return n;
}

/** the same slugs, grouped so every shard is opened once and stays open for its whole run */
function workList(slugs: string[]): string[] {
  const byShard = new Map<string, string[]>();
  for (const s of slugs) {
    const k = shardKey(s);
    (byShard.get(k) ?? byShard.set(k, []).get(k)!).push(s);
  }
  return [...byShard.values()].flat();
}

async function brandCard() {
  // The homepage card states the site's claim with the two marks it is about — not, as it
  // did, the first name in the file wearing the word "Namesake" and asserting that Namesake
  // peaked in 1880 with 5,949 babies.
  const john = await readPayload('john'), liam = await readPayload('liam');
  if (!john || !liam) return 0;
  const side = (p: NamePayload) => ({
    name: p.name, peakYear: p.peakYear, peakShare: p.maxShare * 100, spanYears: spanOf(p.curve),
  });
  await writeFile(join(OUT, '_default.png'), await toPng(brandTree({
    startYear: john.startYear, endYear: john.startYear + john.curve.length - 1,
    nameCount: 1572, big: side(john), small: side(liam),
  })));
  return 1;
}

/**
 * This module is both a script and a small library — FONTS, spanOf and optsFor are what the
 * card is rendered WITH, so anything that renders a card wants them. Without this guard,
 * importing one of them draws all 5,002 cards as a side effect of the import, which is eight
 * minutes and a very confusing eight minutes.
 */
const isEntry = !!process.argv[1] && fileURLToPath(import.meta.url) === pathToFileURL(process.argv[1]).href;

if (!isMainThread && workerData?.og) {
  // a worker: draw its slice, reporting progress as deltas so the parent can total them
  const { slugs, from, to } = workerData as { slugs: string[]; from: number; to: number };
  const n = await renderSlice(slugs, from, to, (d) => { if (d) parentPort!.postMessage({ d }); });
  parentPort!.postMessage({ total: n });
} else if (isEntry) {
  await mkdir(OUT, { recursive: true });
  // One card per prerendered name (top.json == build.ts TOP_N) so no prerendered
  // page ever ships an og:image that 404s. Kept in lockstep by construction.
  const slugs = workList(await readTopSlugs());

  // Drawing a card is satori + resvg, both synchronous CPU, so this is the one place in the
  // build where threads are the whole difference: ~160ms a card × 5,001 is thirteen minutes
  // on one core. Falls back to a plain sequential run if a worker cannot start — a slow
  // build is a nuisance, a failed one blocks the deploy.
  const threads = Math.max(1, Math.min(cpus().length, 8));
  let done = 0;
  const started = Date.now();
  const progress = () => {
    const pct = Math.round((done / slugs.length) * 100);
    console.log(`og ${done}/${slugs.length} (${pct}%, ${((Date.now() - started) / 1000).toFixed(0)}s)`);
  };

  if (threads > 1) {
    const size = Math.ceil(slugs.length / threads);
    try {
      const counts = await Promise.all(Array.from({ length: threads }, (_, i) => new Promise<number>((res, rej) => {
        const w = new Worker(new URL(import.meta.url), {
          workerData: { og: true, slugs, from: i * size, to: Math.min(slugs.length, (i + 1) * size) },
        });
        w.on('message', (m: { d?: number; total?: number }) => {
          if (m.d) { done += m.d; progress(); } else res(m.total ?? 0);
        });
        w.on('error', rej);
        w.on('exit', (code) => { if (code !== 0) rej(new Error(`worker exit ${code}`)); });
      })));
      done = counts.reduce((s, v) => s + v, 0);
    } catch (e) {
      console.warn('og: worker pool failed, falling back to one thread —', (e as Error).message);
      done = 0;
      done = await renderSlice(slugs, 0, slugs.length, (d) => { done += d; progress(); });
    }
  } else {
    done = await renderSlice(slugs, 0, slugs.length, (d) => { done += d; progress(); });
  }

  done += await brandCard();
  console.log(`wrote ${done} og images in ${((Date.now() - started) / 1000).toFixed(0)}s on ${threads} thread(s)`);
}
