import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const SSA_URL = 'https://www.ssa.gov/oact/babynames/names.zip';

/** Download + unzip SSA national names into destDir. Returns sorted yob*.txt paths. */
export async function downloadSSA(destDir: string): Promise<string[]> {
  await mkdir(destDir, { recursive: true });
  const existing = (await readdir(destDir)).filter(f => /^yob\d{4}\.txt$/.test(f));
  if (existing.length >= 145) return existing.sort().map(f => join(destDir, f));

  const require = createRequire(import.meta.url);
  const AdmZip = require('adm-zip');
  const res = await fetch(SSA_URL);
  if (!res.ok) throw new Error(`SSA download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(buf);
  const paths: string[] = [];
  for (const entry of zip.getEntries()) {
    if (/^yob\d{4}\.txt$/.test(entry.entryName)) {
      const p = join(destDir, entry.entryName);
      await writeFile(p, entry.getData());
      paths.push(p);
    }
  }
  if (paths.length < 100) throw new Error(`SSA extraction produced only ${paths.length} yob*.txt files, expected 100+`);
  return paths.sort();
}
