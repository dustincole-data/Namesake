import { ImageResponse } from '@vercel/og';
import { cardTree, type CardOpts } from '../scripts/card.ts';
import { archetypeOf } from '../src/lib/archetype.ts';
import { badgeFor, countInYear, BADGES } from '../src/lib/reveal.ts';
import { shardKey } from '../src/lib/format.ts';

// Personalized name+year share card, rendered on demand (satori + resvg, via
// @vercel/og). The canonical /name/<slug> page still unfurls the static
// build-time card in public/og; this route powers the birth-year reveal's
// "Share your card" link, which carries the viewer's year.
//
// Runs on the default Node.js runtime (not edge): edge's bundler can't trace
// relative imports that live outside /api, which the shared src/lib and
// scripts/card modules require.
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const slug = (url.searchParams.get('slug') || '').toLowerCase();
  const yearRaw = Number(url.searchParams.get('year'));
  const o = url.origin;

  // Every WEIGHT the card sets has to be loaded as its own face: satori falls back per
  // weight, not per family, so a missing 300 silently renders in whatever is left.
  const FACES = [
    ['Outfit', 'Outfit-300.ttf', 300], ['Outfit', 'Outfit-500.ttf', 500], ['Outfit', 'Outfit-700.ttf', 700],
    ['Archivo Narrow', 'ArchivoNarrow-400.ttf', 400], ['Archivo Narrow', 'ArchivoNarrow-600.ttf', 600],
  ] as const;
  const [shard, births, ...faces] = await Promise.all([
    fetch(`${o}/data/names/${shardKey(slug)}.json`).then(r => (r.ok ? r.json() : null)),
    fetch(`${o}/data/births.json`).then(r => (r.ok ? r.json() : [])),
    ...FACES.map(([, file]) => fetch(`${o}/fonts/${file}`).then(r => r.arrayBuffer())),
  ]);
  const p = shard?.[slug];
  if (!p) return new Response('Not found', { status: 404 });

  const end = p.startYear + p.curve.length - 1;
  const peak = Math.max(...p.curve, 0);
  const opts: CardOpts = {
    name: p.name, caption: p.caption, startYear: p.startYear, endYear: end,
    curve: p.curve, peakYear: p.peakYear, peakCount: p.peakCount,
    peakShare: p.maxShare * 100,
    spanYears: peak ? p.curve.filter((v: number) => v >= peak / 2).length : 0,
    archetypeLabel: archetypeOf(p.archetype).label,
  };
  if (Number.isFinite(yearRaw)) {
    const year = Math.min(end, Math.max(p.startYear, Math.round(yearRaw)));
    const key = badgeFor(p.curve, p.startYear, p.peakYear, year);
    opts.year = year;
    opts.badgeLabel = BADGES[key].label;
    opts.countInYear = countInYear(p.curve, p.maxShare, births, p.startYear, year);
  }

  return new ImageResponse(cardTree(opts) as any, {
    width: 1200, height: 630,
    fonts: FACES.map(([name, , weight], i) => ({ name, data: faces[i], weight, style: 'normal' as const })),
  });
}

export default { fetch: handler };
