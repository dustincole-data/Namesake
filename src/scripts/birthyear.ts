import { slugify } from '../lib/format.ts';
import { onField, type FieldApi } from '../lib/field.ts';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

for (const el of document.querySelectorAll<HTMLElement>('[data-birthyear]')) {
  const map = JSON.parse(el.dataset.map!) as Record<string, { M: string[]; F: string[] }>;
  const input = el.querySelector('input')!;
  const slots = { M: el.querySelector('[data-slot="M"]') as HTMLElement, F: el.querySelector('[data-slot="F"]') as HTMLElement };
  const status = el.querySelector<HTMLElement>('[data-by-status]');
  const min = Number(input.min), max = Number(input.max);
  let field: FieldApi | null = null;

  /**
   * Each name gets its own mark, not a bullet. The six shown share one scale, so their areas
   * are true against each other — the reader can see that the year's top name was twice the
   * third, which is the whole subject of the page and was previously thrown away here.
   */
  const paintMarks = () => {
    if (!field) return;
    const cans = [...el.querySelectorAll<HTMLCanvasElement>('canvas[data-slug]')];
    const marks = cans.map((c) => field!.mark(c.dataset.slug!));
    const rMax = Math.max(...marks.map((m) => m?.r ?? 0), 1);
    for (let i = 0; i < cans.length; i++) {
      const m = marks[i];
      if (!m) continue;
      const c = cans[i], box = c.width / 2;
      const ctx = c.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(2, 2);
      ctx.clearRect(0, 0, box, box);
      field.paint(ctx, m, box / 2, box / 2, Math.max(3, (m.r / rMax) * (box / 2 - 2)));
    }
  };

  const render = () => {
    let y = Number(input.value);
    if (!Number.isFinite(y)) return;
    y = Math.min(max, Math.max(min, y));
    const entry = map[String(y)] ?? { M: [], F: [] };
    for (const sex of ['M', 'F'] as const) {
      slots[sex].innerHTML = entry[sex]
        .map((n, i) => {
          const s = slugify(n);
          return `<a href="${base}/name/${s}"><canvas class="mk" data-slug="${s}" width="72" height="72" aria-hidden="true"></canvas>` +
            `<span class="rank">${i + 1}</span>${n}</a>`;
        })
        .join('');
    }
    if (status) status.textContent = `Showing the top names of ${y}.`;
    paintMarks();
  };
  input.addEventListener('input', render);
  render();
  onField((a) => { field = a; paintMarks(); });
}
