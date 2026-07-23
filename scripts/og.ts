import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readTopSlugs, readPayload } from '../src/lib/data.ts';
import { buildLinePath } from '../src/lib/chart.ts';
import type { NamePayload } from '../src/lib/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'og');
const W = 1200, H = 630;

// System serif isn't available to satori; ship one local ttf for the display font
// (Gelasio, a Georgia-metric-compatible OFL Google font, statically instanced at
// wght=400 — satori's opentype.js parser can't read the variable fvar table).
const font = await readFile(join(ROOT, 'scripts', 'assets', 'display.ttf'));

function card(p: NamePayload) {
  const { line } = buildLinePath(p.curve, 1080, 240, 6);
  return {
    type: 'div',
    props: {
      style: { width: W, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: 64, background: '#e7e2d3', color: '#23201b', fontFamily: 'Gelasio' },
      children: [
        { type: 'div', props: { style: { fontSize: 22, letterSpacing: 4, textTransform: 'uppercase', color: '#21456e' }, children: 'U.S. Social Security · 1880–2024' } },
        { type: 'div', props: { style: { display: 'flex', flexDirection: 'column' }, children: [
          { type: 'div', props: { style: { fontSize: 128, lineHeight: 1 }, children: p.name } },
          { type: 'div', props: { style: { fontSize: 30, fontStyle: 'italic', color: '#6b6252', marginTop: 12 }, children: p.caption } },
        ] } },
        { type: 'svg', props: { width: 1080, height: 120, viewBox: '0 0 1080 240', children: [
          { type: 'path', props: { d: line, fill: 'none', stroke: '#21456e', strokeWidth: 5 } },
        ] } },
      ],
    },
  };
}

async function render(p: NamePayload, slug: string) {
  const svg = await satori(card(p) as any, { width: W, height: H, fonts: [{ name: 'Gelasio', data: font, weight: 400, style: 'normal' }] });
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
  if (first) await render({ ...first, name: 'Namesake', caption: 'A map of American names, 1880–2024.' }, '_default');
  console.log(`wrote ${done + 1} og images`);
}
main().catch(e => { console.error(e); process.exit(1); });
