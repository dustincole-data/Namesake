import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { NamePayload, ExploreData, RankEquiv } from '../../src/lib/types.ts';
import { shardKey } from '../../src/lib/format.ts';

export async function writeArtifacts(
  outDir: string,
  payloads: NamePayload[],
  explore: ExploreData,
  topSlugs: string[],
  births: number[],
  equiv: RankEquiv,
): Promise<void> {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(join(outDir, 'names'), { recursive: true });

  // Autocomplete index — the names that HAVE a page, in popularity order.
  //
  // It used to be every name in the data: 105,966 entries and 2.2 MB, fetched the moment
  // anyone touched a search box. Only the top 5,000 are prerendered, so ~95% of what it
  // suggested was a 404 — typing "za" offered five dead links out of eight. Indexing the
  // built pages fixes the broken suggestions and the payload with one change, and topSlugs
  // order means the likeliest name is offered first rather than the earliest-recorded one.
  const nameBySlug = new Map(payloads.map(p => [p.slug, p.name]));
  const index = topSlugs.map(s => [nameBySlug.get(s)!, s]);
  await writeFile(join(outDir, 'names.json'), JSON.stringify(index));

  // detail shards
  const shards = new Map<string, Record<string, NamePayload>>();
  for (const p of payloads) {
    const k = shardKey(p.slug);
    const shard = shards.get(k) ?? shards.set(k, {}).get(k)!;
    const existing = shard[p.slug];
    if (existing && existing.name !== p.name) {
      throw new Error(`slug collision in shard "${k}": "${existing.name}" and "${p.name}" both map to slug "${p.slug}"`);
    }
    shard[p.slug] = p;
  }
  for (const [k, obj] of shards) await writeFile(join(outDir, 'names', `${k}.json`), JSON.stringify(obj));

  await writeFile(join(outDir, 'explore.json'), JSON.stringify(explore));
  await writeFile(join(outDir, 'top.json'), JSON.stringify(topSlugs));
  await writeFile(join(outDir, 'births.json'), JSON.stringify(births));   // per-year total U.S. births
  await writeFile(join(outDir, 'equiv.json'), JSON.stringify(equiv));     // END_YEAR rank -> name, per sex
}
