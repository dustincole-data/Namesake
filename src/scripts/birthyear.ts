import { slugify } from '../lib/format.ts';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

for (const el of document.querySelectorAll<HTMLElement>('[data-birthyear]')) {
  const map = JSON.parse(el.dataset.map!) as Record<string, { M: string[]; F: string[] }>;
  const input = el.querySelector('input')!;
  const slots = { M: el.querySelector('[data-slot="M"]') as HTMLElement, F: el.querySelector('[data-slot="F"]') as HTMLElement };
  const min = Number(input.min), max = Number(input.max);

  const render = () => {
    let y = Number(input.value);
    if (!Number.isFinite(y)) return;
    y = Math.min(max, Math.max(min, y));
    const entry = map[String(y)] ?? { M: [], F: [] };
    for (const sex of ['M', 'F'] as const) {
      slots[sex].innerHTML = entry[sex]
        .map((n, i) => `<a href="${base}/name/${slugify(n)}"><span class="rank">${i + 1}</span>${n}</a>`)
        .join('');
    }
  };
  input.addEventListener('input', render);
  render();
}
