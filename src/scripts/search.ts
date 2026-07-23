import { slugify } from '../lib/format.ts';

const base = import.meta.env.BASE_URL;
let names: [string, string][] | null = null;

async function load() {
  if (!names) names = await fetch(`${base}/data/names.json`).then(r => r.json());
  return names!;
}

for (const box of document.querySelectorAll<HTMLElement>('[data-search]')) {
  const input = box.querySelector('input')!;
  const list = box.querySelector('.results') as HTMLUListElement;
  input.addEventListener('focus', load, { once: true });
  input.addEventListener('input', async () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { list.hidden = true; return; }
    const all = await load();
    const hits = all.filter(([n]) => n.toLowerCase().startsWith(q)).slice(0, 8);
    list.innerHTML = hits.map(([n, s]) => `<li role="option"><a href="${base}/name/${s}">${n}</a></li>`).join('');
    list.hidden = hits.length === 0;
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const s = slugify(input.value.trim()); if (s) location.href = `${base}/name/${s}`; }
  });
}
