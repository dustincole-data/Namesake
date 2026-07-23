const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
document.querySelectorAll<HTMLElement>('[data-chart]').forEach(el => io.observe(el));
