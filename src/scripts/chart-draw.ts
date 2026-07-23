import { xAtIndex, yAtValue, xToIndex, shareAt } from '../lib/chart.ts';
import { oneInLabel } from '../lib/format.ts';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function scrub(wrap: HTMLElement) {
  const svg = wrap.querySelector('svg')!;
  const guide = svg.querySelector('.guide') as SVGLineElement;
  const cursor = svg.querySelector('.cursor') as SVGCircleElement;
  const readout = wrap.querySelector('.readout') as HTMLElement;
  const ry = readout.querySelector('.ry') as HTMLElement;
  const rs = readout.querySelector('.rs') as HTMLElement;
  const curve: number[] = JSON.parse(wrap.dataset.curve || '[]');
  const startYear = Number(wrap.dataset.startYear);
  const maxShare = Number(wrap.dataset.maxShare);
  const W = Number(wrap.dataset.w), H = Number(wrap.dataset.h), PAD = Number(wrap.dataset.pad);
  const n = curve.length;
  if (!n) return;
  const peakIdx = Number(wrap.dataset.peakYear) - startYear;
  let idx = -1;

  function show(i: number) {
    if (i === idx) return;
    idx = i;
    const v = curve[i];
    const x = xAtIndex(i, n, W, PAD), y = yAtValue(v, H, PAD);
    guide.setAttribute('x1', String(x)); guide.setAttribute('x2', String(x));
    cursor.setAttribute('cx', String(x)); cursor.setAttribute('cy', String(y));
    const xPct = x / W * 100, yPct = y / H * 100;
    readout.style.left = Math.max(9, Math.min(91, xPct)) + '%';
    readout.style.top = yPct + '%';
    readout.classList.toggle('below', yPct < 24);
    ry.textContent = String(startYear + i);
    rs.textContent = oneInLabel(shareAt(v, maxShare)) + ' U.S. babies';
    wrap.classList.add('scrubbing');
  }
  function hide() { wrap.classList.remove('scrubbing'); idx = -1; }

  function fromPointer(e: PointerEvent) {
    const rect = svg.getBoundingClientRect();
    show(xToIndex((e.clientX - rect.left) / rect.width * W, n, W, PAD));
  }

  svg.addEventListener('pointerdown', fromPointer);
  svg.addEventListener('pointermove', fromPointer);
  svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  svg.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const from = idx < 0 ? peakIdx : idx;
    show(Math.max(0, Math.min(n - 1, from + (e.key === 'ArrowRight' ? 1 : -1))));
  });
  svg.addEventListener('focus', () => { if (idx < 0) show(peakIdx); });
  svg.addEventListener('blur', hide);
}

function draw(wrap: HTMLElement) {
  const svg = wrap.querySelector('svg')!;
  const lineEl = svg.querySelector('.line') as SVGPathElement;
  const area = svg.querySelector('.area') as SVGPathElement;
  const dot = svg.querySelector('.dot') as SVGCircleElement;
  const lab = wrap.querySelector('.peaklabel') as HTMLElement;
  lab.style.left = wrap.dataset.peakX + '%';
  lab.style.top = (Number(wrap.dataset.peakY) - 3) + '%';

  if (reduce) { area.style.opacity = '1'; dot.setAttribute('opacity', '1'); lab.style.opacity = '1'; return; }
  const len = lineEl.getTotalLength();
  lineEl.style.strokeDasharray = String(len);
  lineEl.style.strokeDashoffset = String(len);
  lineEl.getBoundingClientRect();
  lineEl.style.transition = 'stroke-dashoffset 1.7s cubic-bezier(.4,0,.15,1)';
  lineEl.style.strokeDashoffset = '0';
  area.style.transition = 'opacity 1.2s ease .5s'; area.style.opacity = '1';
  dot.style.transition = 'opacity .4s ease 1.5s'; dot.setAttribute('opacity', '1');
  lab.style.transition = 'opacity .5s ease .9s';
  requestAnimationFrame(() => (lab.style.opacity = '1'));
}

const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { draw(e.target as HTMLElement); io.unobserve(e.target); }
}, { threshold: .35 });
document.querySelectorAll<HTMLElement>('[data-chart]').forEach(el => { io.observe(el); scrub(el); });
