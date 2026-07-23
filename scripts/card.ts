import { buildLinePath } from '../src/lib/chart.ts';

// Shared share-card template (satori vnode tree). Rendered two ways:
//  - build time: scripts/og.ts -> static per-name og/<slug>.png (no year)
//  - runtime:    api/og.ts (Vercel edge, @vercel/og) -> personalized name+year card
// Both hand satori the same tree; only the font loader differs.

export interface CardOpts {
  name: string;
  caption: string;
  startYear: number;
  endYear: number;
  curve: number[];             // 0..1000, length endYear-startYear+1
  peakYear: number;
  peakCount: number;
  archetypeLabel: string;
  year?: number;               // personalized card only
  badgeLabel?: string;
  countInYear?: number;
}

const W = 1200, H = 630;
const CW = 1080, CH = 240;     // sparkline viewBox

const label = (s: string) => ({
  type: 'div',
  props: { style: { fontSize: 22, letterSpacing: 3, textTransform: 'uppercase', color: '#21456e' }, children: s },
});

export function cardTree(o: CardOpts) {
  const { line } = buildLinePath(o.curve, CW, CH, 6);
  const n = o.curve.length;
  const meta = `${o.archetypeLabel} · Peaked ${o.peakYear} · ${o.peakCount.toLocaleString('en-US')} babies`;

  const svgChildren: any[] = [{ type: 'path', props: { d: line, fill: 'none', stroke: '#21456e', strokeWidth: 5 } }];
  if (o.year != null) {
    const i = o.year - o.startYear;
    const mx = 6 + (i / (n - 1)) * (CW - 12);
    const my = CH - 6 - ((o.curve[i] ?? 0) / 1000) * (CH - 12);
    svgChildren.push(
      { type: 'line', props: { x1: mx, y1: CH - 6, x2: mx, y2: my, stroke: '#23201b', strokeWidth: 3, strokeDasharray: '6 6', opacity: 0.5 } },
      { type: 'circle', props: { cx: mx, cy: my, r: 9, fill: '#23201b' } },
    );
  }

  const bottom: any[] = [
    { type: 'div', props: { style: { display: 'flex' }, children: label(meta) } },
  ];
  if (o.year != null && o.badgeLabel && o.countInYear != null) {
    bottom.push({
      type: 'div',
      props: {
        style: { display: 'flex', marginTop: 10 },
        children: label(`Born ${o.year} — ${o.badgeLabel} · ≈${o.countInYear.toLocaleString('en-US')}`),
      },
    });
  }

  return {
    type: 'div',
    props: {
      style: {
        width: W, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: 64, background: '#e7e2d3', color: '#23201b', fontFamily: 'Gelasio',
      },
      children: [
        label(`U.S. Social Security · ${o.startYear}–${o.endYear}`),
        {
          type: 'div', props: {
            style: { display: 'flex', flexDirection: 'column' }, children: [
              { type: 'div', props: { style: { fontSize: 128, lineHeight: 1 }, children: o.name } },
              { type: 'div', props: { style: { fontSize: 30, fontStyle: 'italic', color: '#6b6252', marginTop: 12 }, children: o.caption } },
            ],
          },
        },
        {
          type: 'div', props: {
            style: { display: 'flex', flexDirection: 'column' }, children: [
              { type: 'svg', props: { width: CW, height: 120, viewBox: `0 0 ${CW} ${CH}`, children: svgChildren } },
              { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', marginTop: 14 }, children: bottom } },
            ],
          },
        },
      ],
    },
  };
}
