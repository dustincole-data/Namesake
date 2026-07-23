import { readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadSSA } from './download.ts';
import { parseYobFile } from './parse.ts';
import { indexRecords, shareCurve, normalizeCurve, peakYearOf, medianBirthYear, skewOf } from './stats.ts';
import { computeRanks, peakRankOf, rankNamesForYear } from './rank.ts';
import { classifyTrajectory, eraCaption } from './caption.ts';
import { classifyArchetype } from './archetype.ts';
import { shapeVector, topTwins } from './twins.ts';
import { ghosts, comebacks, unisex, nameOfYear, type NameStat } from './explore.ts';
import { writeArtifacts } from './shard.ts';
import { slugify } from '../../src/lib/format.ts';
import { START_YEAR, END_YEAR, type NamePayload, type RawRecord, type TwinData, type ExploreItem, type NameAgg } from '../../src/lib/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TWIN_THRESHOLD = 60_000;   // all-time total to be a twin candidate (~2–3k names); tune after first run
const TOP_N = 5_000;             // names prerendered as pages (Task 11)

function downsample(curve: number[], n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(curve[Math.round((i / (n - 1)) * (curve.length - 1))]);
  return out;
}
const meanTail = (a: number[], k: number) => a.slice(-k).reduce((s, v) => s + v, 0) / k;

async function main() {
  const rawDir = join(ROOT, 'pipeline', 'raw');
  const files = await downloadSSA(rawDir);
  const records: RawRecord[] = [];
  const yearsIngested = new Set<number>();
  for (const f of files) {
    const year = Number(basename(f).match(/\d{4}/)![0]);
    if (year < START_YEAR || year > END_YEAR) continue;
    yearsIngested.add(year);
    records.push(...parseYobFile(await readFile(f, 'utf8'), year));
  }
  console.log(`parsed ${records.length} records across ${yearsIngested.size} years`);

  const { aggs, totalBirthsByYear } = indexRecords(records);
  const ranks = computeRanks(records);

  // First pass: per-name core stats
  const stats: (NameStat & { agg: NameAgg; curve: number[]; dominantSex: 'M' | 'F'; peakRank: number; median: number })[] = [];
  for (const agg of aggs.values()) {
    const shares = shareCurve(agg, totalBirthsByYear);
    const curve = normalizeCurve(shares);
    const peakYear = peakYearOf(shares);
    const peakShare = Math.max(...shares);
    const { dominantSex, pct } = skewOf(agg);
    const peakIdx = peakYear - START_YEAR;
    const troughAfterPeak = Math.min(...shares.slice(peakIdx));
    stats.push({
      name: agg.name, slug: slugify(agg.name), shares, curve,
      peakYear, peakShare, recentShare: meanTail(shares, 15),
      troughAfterPeak, skewPct: pct, dominantSex,
      peakRank: peakRankOf(agg.name, dominantSex, ranks),
      median: medianBirthYear(agg), agg,
    });
  }

  // Twins over candidates, matched within the same dominant sex
  const candidates = stats.filter(s => (s.agg.totalBySex.M + s.agg.totalBySex.F) >= TWIN_THRESHOLD);
  const vectorsBySex = { M: new Map<string, number[]>(), F: new Map<string, number[]>() };
  for (const s of candidates) vectorsBySex[s.dominantSex].set(s.slug, shapeVector(s.shares));
  const curveBySlug = new Map(stats.map(s => [s.slug, s.curve]));
  const nameBySlug = new Map(stats.map(s => [s.slug, s.name]));

  const payloads: NamePayload[] = stats.map(s => {
    const vm = vectorsBySex[s.dominantSex];
    const twins: TwinData[] = vm.has(s.slug)
      ? topTwins(s.slug, vm, 5).map(t => ({
          name: nameBySlug.get(t.slug)!, slug: t.slug, spark: downsample(curveBySlug.get(t.slug)!, 40),
        }))
      : [];
    const peakCount = (s.agg.bySexYear.M.get(s.peakYear) ?? 0) + (s.agg.bySexYear.F.get(s.peakYear) ?? 0);
    return {
      name: s.name, slug: s.slug, dominantSex: s.dominantSex, startYear: START_YEAR,
      curve: s.curve, peakYear: s.peakYear, peakRank: s.peakRank,
      peakCount, maxShare: s.peakShare, skewPct: s.skewPct,
      totalBirths: s.agg.totalBySex.M + s.agg.totalBySex.F,
      medianBirthYear: s.median,
      archetype: classifyArchetype(s.shares, s.peakYear),
      caption: eraCaption(s.peakYear, classifyTrajectory(s.shares, s.peakYear)),
      twins,
    };
  });

  // Explore
  const toItem = (n: NameStat): ExploreItem => ({
    name: n.name, slug: n.slug, spark: downsample(curveBySlug.get(n.slug)!, 40), blurb: '',
  });
  const explore = {
    ghosts: ghosts(candidates, 12).map(toItem),
    comebacks: comebacks(candidates, 12).map(toItem),
    unisex: unisex(candidates, 12).map(toItem),
    nameOfYear: nameOfYear(records),
  };

  const topSlugs = [...payloads].sort((a, b) => b.totalBirths - a.totalBirths).slice(0, TOP_N).map(p => p.slug);

  // globals for the reveal: per-year total births (reconstructs any name's per-year
  // count client-side) and END_YEAR rank->name (modern rank-equivalent).
  const births = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => totalBirthsByYear.get(START_YEAR + i) ?? 0);
  const equiv = rankNamesForYear(records, END_YEAR);

  await writeArtifacts(join(ROOT, 'public', 'data'), payloads, explore, topSlugs, births, equiv);
  console.log(`wrote ${payloads.length} names, ${topSlugs.length} top slugs`);
}
main().catch(e => { console.error(e); process.exit(1); });
