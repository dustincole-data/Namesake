import { buildLinePath, buildSparkPath } from '../lib/chart.ts';
import { rankLabel, shardKey } from '../lib/format.ts';
import type { NamePayload } from '../lib/types.ts';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const slug = decodeURIComponent(location.pathname.replace(/\/$/, '').split('/').pop() || '');

async function run() {
  let payload: NamePayload | null = null;
  try {
    const shard = await fetch(`${base}/data/names/${shardKey(slug)}.json`).then(r => r.ok ? r.json() : null);
    payload = shard?.[slug] ?? null;
  } catch { payload = null; }
  if (!payload) { document.getElementById('miss')!.hidden = false; return; }
  document.title = `${payload.name} — a name's life story | Namesake`;
  renderStory(payload);
}

function renderStory(p: NamePayload) {
  const n = p.curve.length;
  const { line, area } = buildLinePath(p.curve, 1000, 380, 6);
  const peakIdx = p.peakYear - p.startYear;
  const px = 6 + (peakIdx / (n - 1)) * (1000 - 12);
  const py = 380 - 6 - (p.curve[peakIdx] / 1000) * (380 - 12);
  const skewSex = p.dominantSex === 'F' ? 'girls' : 'boys';
  const el = document.getElementById('story') as HTMLElement;
  el.hidden = false;
  el.className = 'story';
  const ariaLabel = `Popularity of the name ${p.name} from ${p.startYear} to ${p.startYear + n - 1}, peaking in ${p.peakYear}.`;
  el.innerHTML = `<div class="wrap">
    <div class="eyebrow">U.S. Social Security · ${p.startYear}–${p.startYear + n - 1}</div>
    <h1 class="name">${p.name}</h1>
    <p class="caption">${p.caption}</p>
    <div class="stamp">Peaked ${p.peakYear}</div>
    <div class="chartwrap"><svg viewBox="0 0 1000 380" role="img" aria-label="${ariaLabel}">
      <defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--accent)" stop-opacity=".16"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#fill)"/>
      <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" fill="var(--stamp)"/></svg>
      <div class="peaklabel" style="left:${(px/1000*100).toFixed(2)}%; top:${(py/380*100 - 3).toFixed(2)}%; opacity:1"><b>${p.peakYear}</b>peak</div>
    </div>
    <div class="axis"><span>${p.startYear}</span><span>1920</span><span>1960</span><span>2000</span><span>${p.startYear + n - 1}</span></div>
    <div class="stats">
      ${[['Peak year', String(p.peakYear), 'the crest of the wave'],
         ['Peak rank', Number.isFinite(p.peakRank) ? rankLabel(p.peakRank) : '—', `of all U.S. ${skewSex}’ names`],
         ['Skew', `${p.skewPct}%`, `given to ${skewSex}`],
         ['Median age today', `~${p.medianAgeToday}`, `median birth year ${p.medianBirthYear}`]]
        .map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('')}
    </div>
    ${p.twins.length ? `<div class="twins"><div class="lab">Names that rose &amp; fell alongside it</div><div class="chips">${
      p.twins.map(t => `<a class="chip" href="${base}/name/${t.slug}"><svg viewBox="0 0 46 18" aria-hidden="true"><path d="${buildSparkPath(t.spark,46,18)}" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-opacity=".85" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${t.name}</span></a>`).join('')
    }</div></div>` : ''}
  </div>`;
}
run();
