import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readTopSlugs, readPayload } from '../src/lib/data.ts';
import { archetypeOf } from '../src/lib/archetype.ts';
import { cardTree, type CardOpts } from './card.ts';
import type { NamePayload } from '../src/lib/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'og');
const W = 1200, H = 630;

// System serif isn't available to satori; ship one local ttf for the display font
// (Gelasio, a Georgia-metric-compatible OFL Google font, statically instanced at
// wght=400 — satori's opentype.js parser can't read the variable fvar table).
const font = await readFile(join(ROOT, 'scripts', 'assets', 'display.ttf'));

function optsFor(p: NamePayload): CardOpts {
  return {
    name: p.name, caption: p.caption, startYear: p.startYear,
    endYear: p.startYear + p.curve.length - 1, curve: p.curve,
    peakYear: p.peakYear, peakCount: p.peakCount, archetypeLabel: archetypeOf(p.archetype).label,
  };
}

async function render(p: NamePayload, slug: string) {
  const svg = await satori(cardTree(optsFor(p)) as any, { width: W, height: H, fonts: [{ name: 'Gelasio', data: font, weight: 400, style: 'normal' }] });
  // loadSystemFonts:false is critical — satori vectorizes text to <path>, so there is
  // no <text> for resvg to shape; without this, resvg scans the Windows font DB (~2s/img).
  const png = new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
  await writeFile(join(OUT, `${slug}.png`), png);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  // One card per prerendered name (top.json == build.ts TOP_N) so no prerendered
  // page ever ships an og:image that 404s. Kept in lockstep by construction.
  const slugs = await readTopSlugs();
  let done = 0;
  for (const slug of slugs) {
    const p = await readPayload(slug);
    if (p) { await render(p, slug); if (++done % 200 === 0) console.log(`og ${done}/${slugs.length}`); }
  }
  // default card
  const first = await readPayload(slugs[0]);
  if (first) {
    const end = first.startYear + first.curve.length - 1;
    await render({ ...first, name: 'Namesake', caption: `A map of American names, ${first.startYear}–${end}.` }, '_default');
  }
  console.log(`wrote ${done + 1} og images`);
}
main().catch(e => { console.error(e); process.exit(1); });
