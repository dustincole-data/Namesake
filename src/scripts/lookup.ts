import { buildLinePath, buildSparkPath } from '../lib/chart.ts';
import { rankLabel, shardKey } from '../lib/format.ts';
import { archetypeOf } from '../lib/archetype.ts';
import { rankEquivName } from '../lib/reveal.ts';
import { initReveal } from './reveal.ts';
import type { NamePayload, RankEquiv } from '../lib/types.ts';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const slug = decodeURIComponent(location.pathname.replace(/\/$/, '').split('/').pop() || '');
const fmt = (n: number) => n.toLocaleString('en-US');
const compact = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n);
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

async function run() {
  let payload: NamePayload | null = null;
  let births: number[] = [], equiv: RankEquiv = { M: [], F: [] };
  try {
    const [shard, b, e] = await Promise.all([
      fetch(`${base}/data/names/${shardKey(slug)}.json`).then(r => r.ok ? r.json() : null),
      fetch(`${base}/data/births.json`).then(r => r.ok ? r.json() : []),
      fetch(`${base}/data/equiv.json`).then(r => r.ok ? r.json() : { M: [], F: [] }),
    ]);
    payload = shard?.[slug] ?? null; births = b; equiv = e;
  } catch { payload = null; }
  if (!payload) { document.getElementById('miss')!.hidden = false; return; }
  document.title = `${payload.name} — a name's life story | Namesake`;
  renderStory(payload, births, equiv);
}

function renderStory(p: NamePayload, births: number[], equiv: RankEquiv) {
  const n = p.curve.length;
  const endYear = p.startYear + n - 1;
  const gap = endYear - p.peakYear;
  const gapText = gap <= 0 ? 'this year' : `${gap} year${gap === 1 ? '' : 's'} ago`;
  const arch = archetypeOf(p.archetype);
  const equivName = rankEquivName(equiv, p.dominantSex, p.peakRank);
  const skewSex = p.dominantSex === 'F' ? 'girls' : 'boys';
  const { line, area } = buildLinePath(p.curve, 1000, 380, 6);
  const peakIdx = p.peakYear - p.startYear;
  const px = 6 + (peakIdx / (n - 1)) * (1000 - 12);
  const py = 380 - 6 - (p.curve[peakIdx] / 1000) * (380 - 12);
  const ariaLabel = `Popularity of the name ${p.name} from ${p.startYear} to ${endYear}, peaking in ${p.peakYear}.`;

  const tiles: [string, string, string][] = [
    ['Peak rank', Number.isFinite(p.peakRank) ? rankLabel(p.peakRank) : '—',
      equivName ? `as high as ${esc(equivName)} sits today` : `of all U.S. ${skewSex}’ names`],
    ['Skew', `${p.skewPct}%`, `given to ${skewSex}`],
    ['Median birth year', String(p.medianBirthYear), 'half born before this year'],
    ['All-time', compact(p.totalBirths), `babies since ${p.startYear}`],
  ];

  const el = document.getElementById('story') as HTMLElement;
  el.hidden = false;
  el.className = 'story';
  el.innerHTML = `<div class="wrap">
    <div class="eyebrow">U.S. Social Security · ${p.startYear}–${endYear}</div>
    <h1 class="name">${esc(p.name)}</h1>
    <div class="stamp">${arch.label}</div>
    <p class="peakgap">Peaked in <b>${p.peakYear}</b>, ${gapText} — when <b>${fmt(p.peakCount)}</b> U.S. babies got the name.</p>
    <p class="caption">${esc(p.caption)}</p>
    <div class="chartwrap" data-chart>
      <svg viewBox="0 0 1000 380" role="img" aria-label="${esc(ariaLabel)}">
        <defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--accent)" stop-opacity=".16"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
        <path d="${area}" fill="url(#fill)"/>
        <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" fill="var(--stamp)"/></svg>
      <div class="peaklabel" style="left:${(px / 1000 * 100).toFixed(2)}%; top:${(py / 380 * 100 - 3).toFixed(2)}%; opacity:1"><b>${p.peakYear}</b>peak</div>
    </div>
    <div class="axis"><span>${p.startYear}</span><span>1920</span><span>1960</span><span>2000</span><span>${endYear}</span></div>
    <section class="reveal" data-reveal
      data-curve="${esc(JSON.stringify(p.curve))}" data-births="${esc(JSON.stringify(births))}"
      data-start="${p.startYear}" data-peak="${p.peakYear}" data-max="${p.maxShare}" data-slug="${esc(p.slug)}" data-name="${esc(p.name)}">
      <div class="ask">
        <label for="by-reveal">When were you born?</label>
        <input id="by-reveal" type="number" inputmode="numeric" min="${p.startYear}" max="${endYear}" placeholder="1990" />
        <span class="asklabel">→ see where you land on ${esc(p.name)}’s curve</span>
      </div>
      <div class="revealcard" data-out aria-live="polite" hidden></div>
    </section>
    <div class="stats">
      ${tiles.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('')}
    </div>
    ${p.twins.length ? `<div class="twins"><div class="lab">Names that rose &amp; fell alongside it</div><div class="chips">${
      p.twins.map(t => `<a class="chip" href="${base}/name/${t.slug}"><svg viewBox="0 0 46 18" aria-hidden="true"><path d="${buildSparkPath(t.spark, 46, 18)}" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-opacity=".85" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${esc(t.name)}</span></a>`).join('')
    }</div></div>` : ''}
    <details class="method"><summary>How to read this — sources &amp; method</summary><div class="methodbody">
      <p><b>Source.</b> U.S. Social Security card applications, ${p.startYear}–${endYear}. A name is published only in years it was given to <b>at least 5</b> babies.</p>
      <p><b>Raw, not modeled.</b> Yearly births, national rank, peak year, and median birth year are counted, not estimated.</p>
      <p><b>“Peak”</b> is the year the name was most common <i>relative to all births that year</i> — its cultural high-water mark.</p>
      <p><b>Modern rank-equivalent</b> compares rank <i>position</i> across eras, not absolute frequency.</p>
      <p class="methodnote">We don’t print a “typical age” — that needs a mortality model (an estimate). The median birth year above is the honest, unmodeled version.</p>
    </div></details>
  </div>`;
  initReveal(el);
}
run();
