import type { RawRecord, Sex } from '../../src/lib/types.ts';

export function parseYobFile(text: string, year: number): RawRecord[] {
  const out: RawRecord[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const [name, sex, countStr] = t.split(',');
    out.push({ name, sex: sex as Sex, year, count: Number(countStr) });
  }
  return out;
}
