import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { NamePayload, ExploreData, RankEquiv } from './types.ts';
import { shardKey } from './format.ts';

// Resolved from process.cwd() (project root, per npm script invocation) rather than
// import.meta.url: the bundler collapses nested pages (e.g. pages/name/[slug].astro)
// into build output at a different directory depth than pages/index.astro, which
// broke a relative ../../ walk-up from the compiled chunk's own location.
const DATA = join(process.cwd(), 'public', 'data');

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
export async function readBirths(): Promise<number[]> {
  return JSON.parse(await readFile(join(DATA, 'births.json'), 'utf8'));
}
export async function readEquiv(): Promise<RankEquiv> {
  return JSON.parse(await readFile(join(DATA, 'equiv.json'), 'utf8'));
}
