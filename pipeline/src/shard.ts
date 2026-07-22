import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { NamePayload, ExploreData } from '../../src/lib/types.ts';
import { shardKey } from '../../src/lib/format.ts';

export async function writeArtifacts(
  outDir: string,
  payloads: NamePayload[],
  explore: ExploreData,
  topSlugs: string[],
): Promise<void> {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(join(outDir, 'names'), { recursive: true });

  // autocomplete index
  const index = payloads.map(p => [p.name, p.slug]);
  await writeFile(join(outDir, 'names.json'), JSON.stringify(index));

  // detail shards
  const shards = new Map<string, Record<string, NamePayload>>();
  for (const p of payloads) {
    const k = shardKey(p.slug);
    (shards.get(k) ?? shards.set(k, {}).get(k)!)[p.slug] = p;
  }
  for (const [k, obj] of shards) await writeFile(join(outDir, 'names', `${k}.json`), JSON.stringify(obj));

  await writeFile(join(outDir, 'explore.json'), JSON.stringify(explore));
  await writeFile(join(outDir, 'top.json'), JSON.stringify(topSlugs));
}
