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

  const [shard, births, font] = await Promise.all([
    fetch(`${o}/data/names/${shardKey(slug)}.json`).then(r => (r.ok ? r.json() : null)),
    fetch(`${o}/data/births.json`).then(r => (r.ok ? r.json() : [])),
    fetch(`${o}/fonts/display.ttf`).then(r => r.arrayBuffer()),
  ]);
  const p = shard?.[slug];
  if (!p) return new Response('Not found', { status: 404 });

  const end = p.startYear + p.curve.length - 1;
  const opts: CardOpts = {
    name: p.name, caption: p.caption, startYear: p.startYear, endYear: end,
    curve: p.curve, peakYear: p.peakYear, peakCount: p.peakCount,
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
    fonts: [{ name: 'Gelasio', data: font, weight: 400, style: 'normal' }],
  });
}

export default { fetch: handler };
