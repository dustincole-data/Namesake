import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NamePayload, ExploreData } from './types.ts';
import { shardKey } from './format.ts';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'data');

export async function readTopSlugs(): Promise<string[]> {
  return JSON.parse(await readFile(join(DATA, 'top.json'), 'utf8'));
}
export async function readPayload(slug: string): Promise<NamePayload | null> {
  try {
    const shard = JSON.parse(await readFile(join(DATA, 'names', `${shardKey(slug)}.json`), 'utf8'));
    return shard[slug] ?? null;
  } catch { return null; }
}
export async function readExplore(): Promise<ExploreData> {
  return JSON.parse(await readFile(join(DATA, 'explore.json'), 'utf8'));
}
