import { badgeFor, BADGES, countInYear } from '../lib/reveal.ts';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const fmt = (n: number) => n.toLocaleString('en-US');

// Chart geometry — must match PopularityChart.astro and lookup.ts (W×H×PAD).
const W = 1000, H = 380, PAD = 6;

/** Wire every [data-reveal] under `root`. Idempotent per element. */
export function initReveal(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-reveal]')) {
    if ((el as any)._wired) continue;
    (el as any)._wired = true;
    wire(el);
  }
}

function wire(el: HTMLElement) {
  const curve: number[] = JSON.parse(el.dataset.curve!);
  const births: number[] = JSON.parse(el.dataset.births!);
  const startYear = +el.dataset.start!, peakYear = +el.dataset.peak!, maxShare = +el.dataset.max!;
  const slug = el.dataset.slug!, name = el.dataset.name!;
  const endYear = startYear + curve.length - 1;
  const input = el.querySelector('input')!;
  const out = el.querySelector('[data-out]') as HTMLElement;
  const svg = document.querySelector('[data-chart] svg') as SVGSVGElement | null;

  const render = () => {
    const raw = input.value.trim();
    if (!raw) { out.hidden = true; clearMarker(svg); return; }
    let y = Math.round(Number(raw));
    if (!Number.isFinite(y)) { out.hidden = true; clearMarker(svg); return; }
    y = Math.min(endYear, Math.max(startYear, y));

    const key = badgeFor(curve, startYear, peakYear, y);
    const badge = BADGES[key];
    const count = countInYear(curve, maxShare, births, startYear, y);
    const gap = Math.abs(y - peakYear);
    const rel = gap === 0 ? 'right at its peak'
      : `${gap} year${gap === 1 ? '' : 's'} ${y >= peakYear ? 'after' : 'before'} its peak`;

    out.hidden = false;
    out.innerHTML = `
      <span class="badge badge--${key}">${badge.label}</span>
      <p class="revealline">A <b>${name}</b> born in <b>${y}</b> arrived ${rel}. ${badge.line}</p>
      <p class="revealsub">≈<b>${fmt(count)}</b> U.S. babies got the name that year.</p>
      <a class="sharebtn" href="${base}/api/og?slug=${encodeURIComponent(slug)}&year=${y}" target="_blank" rel="noopener">Share your card ↗</a>`;
    drawMarker(svg, curve, startYear, y);
  };

  input.addEventListener('input', render);
  if (input.value.trim()) render();
}

function markerXY(curve: number[], startYear: number, year: number) {
  const n = curve.length, i = year - startYear;
  const x = PAD + (i / (n - 1)) * (W - PAD * 2);
  const yv = H - PAD - ((curve[i] ?? 0) / 1000) * (H - PAD * 2);
  return { x, y: yv };
}

function clearMarker(svg: SVGSVGElement | null) {
  svg?.querySelector('.you-marker')?.remove();
}

function drawMarker(svg: SVGSVGElement | null, curve: number[], startYear: number, year: number) {
  if (!svg) return;
  clearMarker(svg);
  const { x, y } = markerXY(curve, startYear, year);
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', 'you-marker');
  g.innerHTML =
    `<line x1="${x.toFixed(1)}" y1="${(H - PAD).toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 3" opacity=".5"/>` +
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="var(--ink)"/>`;
  svg.appendChild(g);
}

initReveal();
