# Namesake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A free, static, gorgeous "map of American names" — type any name → its ~145-year life story as a Vital-Records-style SVG chart, plus a trends explorer. Flagship data toy for dustincoledata.

**Architecture:** Offline Node/TS pipeline crunches SSA national baby-name files (1880–2024) into compact JSON artifacts (per-name payloads, twins, explorer aggregates). Astro static site prerenders the top ~5k name pages with inlined data + build-time OG cards; the long tail falls back to a client-side shard fetch. All charts are hand-built SVG; the popularity curve self-draws via `stroke-dashoffset`.

**Tech Stack:** Astro (static, `base: /projects/namesake`), TypeScript, Vitest, satori + @resvg/resvg-js (OG images), Node built-in `fetch` + a zip reader for the pipeline. Deployed as its own Vercel project, mounted under dustincoledata.com via a main-site rewrite.

## Global Constraints

Copied verbatim from the spec — every task inherits these:

- Static + free at runtime; **loads in ~1s**; **no heavy runtime / no in-browser model** (the explicit anti-Latent).
- **SVG charts** (vector → razor-sharp on any screen).
- Design-first: hold every screen to the approved mockup's bar; **verify the look live in the browser as we build**, not only at the end. Nothing overlaps at 375 / 768 / desktop.
- Data scope: **National only** (SSA, 1880–2024).
- The approved craft bar is Direction A ("Vital Records") in `.claude/plans/namesake-look-reference.html` (`section#a`) and artifact `d36dab7d-9df9-4dd9-81bd-e382c8d14d0f`. Tokens are lifted from it verbatim (see Task 1).
- Respect `prefers-reduced-motion` (show final chart state, no animation).
- Deploy target: `dustincoledata.com/projects/namesake` → Astro `base: '/projects/namesake'`, `site: 'https://dustincoledata.com'`.

## Design token reference (Direction A — the single source of truth for look)

```
--ground:  #e7e2d3;   /* warm manila, pushed greyer than cream */
--panel:   #f0ebdf;
--ink:     #23201b;
--ink-soft:#6b6252;
--rule:    #cfc7b3;
--accent:  #21456e;   /* ink-blue plotted curve */
--stamp:   #9e3b2c;   /* records stamp + peak dot */
--display: Georgia,'Palatino Linotype','Iowan Old Style',serif;
ledger:    repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(33,69,110,.05) 27px, rgba(33,69,110,.05) 28px);
```
Name: `400 clamp(56px,13vw,132px)/.92 var(--display)`. Caption: italic serif `clamp(17px,2.4vw,21px)`. Stamp: `rotate(-3deg)`, 1.5px border `--stamp`. Curve: stroke `--accent` width 2.25, area gradient `.16→0`, peak dot `--stamp` r4. Sparkline: 46×18, stroke width 1.6, opacity .85. Stats grid 4 cols → 2 at ≤720px. Self-draw: `stroke-dashoffset` 1.7s `cubic-bezier(.4,0,.15,1)`; IntersectionObserver threshold .35.

---

## Data model (locked — used across all tasks)

`src/lib/types.ts`:

```ts
export type Sex = 'M' | 'F';
export const START_YEAR = 1880;
export const END_YEAR = 2024;

export interface RawRecord { name: string; sex: Sex; year: number; count: number; }

/** Per-name accumulation across all years, both sexes. */
export interface NameAgg {
  name: string;
  bySexYear: { M: Map<number, number>; F: Map<number, number> };
  totalBySex: { M: number; F: number };
}

export interface TwinData { name: string; slug: string; spark: number[]; } // spark: ~40 ints 0..1000

export interface NamePayload {
  name: string;
  slug: string;
  dominantSex: Sex;
  startYear: number;      // START_YEAR
  curve: number[];        // per-year share normalized to own max, ints 0..1000, length END-START+1
  peakYear: number;
  peakRank: number;       // best (min) yearly rank within dominant sex
  skewPct: number;        // % of all-time births given to dominantSex, one decimal
  totalBirths: number;    // all-time M+F count
  medianBirthYear: number;
  medianAgeToday: number;
  caption: string;        // one-line era caption
  twins: TwinData[];      // up to 5
}

export interface ExploreItem { name: string; slug: string; spark: number[]; blurb: string; }
export interface ExploreData {
  ghosts: ExploreItem[];
  comebacks: ExploreItem[];
  unisex: ExploreItem[];
  nameOfYear: Record<number, { M: string[]; F: string[] }>; // year -> top 3 names per sex
}
```

## File structure

```
Namesake/
  package.json                    # scripts: dev, build, test, data, og
  astro.config.mjs                # base + site + static
  tsconfig.json
  vitest.config.ts
  vercel.json                     # cleanUrls + long-tail fallback rewrite
  .gitignore                      # raw SSA files + node_modules (generated public/data IS committed)
  pipeline/
    src/
      download.ts                 # fetch SSA names.zip → unzip to raw/yobYYYY.txt
      parse.ts                    # yob text -> RawRecord[]
      index.ts                    # RawRecord[] -> Map<name, NameAgg> + totals
      stats.ts                    # share curve, peak, median, skew  (TDD)
      rank.ts                     # within-sex yearly rank            (TDD)
      caption.ts                  # trajectory + era caption          (TDD)
      twins.ts                    # shape vector, cosine, top-k       (TDD)
      explore.ts                  # ghosts/comebacks/unisex/nameOfYear(TDD)
      shard.ts                    # write index + detail shards + explore json
      build.ts                    # orchestrator: raw -> public/data/*
    tests/
      parse.test.ts stats.test.ts rank.test.ts caption.test.ts twins.test.ts explore.test.ts
  scripts/
    og.ts                         # satori + resvg -> public/og/{slug}.png for top N
  src/
    lib/
      types.ts
      chart.ts                    # buildLinePath, buildSparkPath        (TDD)
      format.ts                   # slugify, rankLabel, pct, shardKey     (TDD)
      data.ts                     # build-time readers over public/data
    styles/
      tokens.css global.css
    components/
      NameStory.astro             # full approved layout (server-rendered)
      PopularityChart.astro       # SVG + self-draw island
      StatTiles.astro TwinChips.astro SearchBox.astro ExplorePanel.astro
    scripts/
      chart-draw.ts               # client self-draw (shared)
      search.ts                   # autocomplete island
      lookup.ts                   # long-tail client hydrate
    pages/
      index.astro                 # explorer landing
      name/[slug].astro           # prerendered top-N + inlined payload
      name/_lookup.astro          # long-tail fallback (client-rendered)
  public/
    data/                         # GENERATED, committed: names.json, names/{aa}.json, explore.json
    og/                           # GENERATED, committed: {slug}.png
    tests/                        # test fixtures live under pipeline/tests/fixtures
```

**Data-freshness decision:** `public/data/` and `public/og/` are generated by `npm run data` + `npm run og` and **committed** (SSA updates once a year; regenerate yearly). Raw SSA files are gitignored. Vercel deploy runs only `astro build` — fast, deterministic, no network in CI.

---

## Task 1: Project scaffold + design tokens

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create: `src/styles/tokens.css`, `src/styles/global.css`
- Create: `src/pages/index.astro` (temporary placeholder)

**Interfaces:**
- Produces: an Astro project that `npm run dev` serves at base `/projects/namesake`, `npm test` runs Vitest, and tokens.css exposing the Direction-A CSS variables.

- [ ] **Step 1: Init project + deps**

```bash
cd C:/Users/dusti/Projects/Namesake
git init
npm create astro@latest . -- --template minimal --no-install --no-git --typescript strict --skip-houston
npm install
npm install -D vitest @resvg/resvg-js satori
```

- [ ] **Step 2: Write `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://dustincoledata.com',
  base: '/projects/namesake',
  output: 'static',
  trailingSlash: 'ignore',
});
```

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['**/*.test.ts'], environment: 'node' } });
```

- [ ] **Step 4: Add scripts to `package.json`** (merge into the `"scripts"` block)

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "data": "node --experimental-strip-types pipeline/src/build.ts",
    "og": "node --experimental-strip-types scripts/og.ts"
  }
}
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules/
dist/
.astro/
pipeline/raw/
*.zip
```

- [ ] **Step 6: Write `src/styles/tokens.css`** (verbatim from the look reference Direction A)

```css
:root {
  --ground:  #e7e2d3;
  --panel:   #f0ebdf;
  --ink:     #23201b;
  --ink-soft:#6b6252;
  --rule:    #cfc7b3;
  --accent:  #21456e;
  --stamp:   #9e3b2c;
  --display: Georgia,'Palatino Linotype','Iowan Old Style',serif;
  --mono: ui-monospace,'Cascadia Code','Consolas',monospace;
}
```

- [ ] **Step 7: Write `src/styles/global.css`**

```css
@import './tokens.css';
* { box-sizing: border-box; }
body {
  margin: 0; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  background: var(--ground); color: var(--ink);
  background-image: repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(33,69,110,.05) 27px, rgba(33,69,110,.05) 28px);
}
.wrap { max-width: 1080px; margin: 0 auto; padding: clamp(20px, 5vw, 64px); }
```

- [ ] **Step 8: Write placeholder `src/pages/index.astro`**

```astro
---
import '../styles/global.css';
---
<html lang="en"><head><meta charset="utf-8" /><title>Namesake</title>
<meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body><main class="wrap"><h1 style="font-family:var(--display)">Namesake</h1></main></body></html>
```

- [ ] **Step 9: Verify dev server + test runner**

Run: `npm run dev` → open `http://localhost:4321/projects/namesake` → confirm manila ground + faint ledger lines render. Then `npm test` (0 tests, exits clean).

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "chore: scaffold Astro + Vitest + Direction-A tokens"
```

---

## Task 2: SSA data — download + parse

**Files:**
- Create: `pipeline/src/download.ts`, `pipeline/src/parse.ts`
- Create: `src/lib/types.ts` (from the Data model section above — copy it in full)
- Test: `pipeline/tests/parse.test.ts`, `pipeline/tests/fixtures/yob-sample.txt`

**Interfaces:**
- Produces: `parseYobFile(text: string, year: number): RawRecord[]`; `downloadSSA(destDir: string): Promise<string[]>` (returns sorted yob file paths).
- Consumes: `RawRecord`, `Sex` from `src/lib/types.ts`.

- [ ] **Step 1: Create `src/lib/types.ts`** — paste the full Data model block from above.

- [ ] **Step 2: Write fixture `pipeline/tests/fixtures/yob-sample.txt`**

```
Mary,F,7065
Anna,F,2604
John,M,9655
William,M,9532
Dustin,M,5
```

- [ ] **Step 3: Write failing test `pipeline/tests/parse.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseYobFile } from '../src/parse.ts';

const text = readFileSync(fileURLToPath(new URL('./fixtures/yob-sample.txt', import.meta.url)), 'utf8');

describe('parseYobFile', () => {
  it('parses each line into a RawRecord with the given year', () => {
    const recs = parseYobFile(text, 1985);
    expect(recs).toHaveLength(5);
    expect(recs[0]).toEqual({ name: 'Mary', sex: 'F', year: 1985, count: 7065 });
    expect(recs[2]).toEqual({ name: 'John', sex: 'M', year: 1985, count: 9655 });
  });
  it('ignores blank trailing lines', () => {
    expect(parseYobFile(text + '\n\n', 1985)).toHaveLength(5);
  });
});
```

- [ ] **Step 4: Run — expect FAIL** (`parseYobFile` not defined)

Run: `npx vitest run pipeline/tests/parse.test.ts`

- [ ] **Step 5: Implement `pipeline/src/parse.ts`**

```ts
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
```

- [ ] **Step 6: Run — expect PASS**

- [ ] **Step 7: Implement `pipeline/src/download.ts`** (no unit test — integration, exercised by the build)

```ts
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
  const AdmZip = require('adm-zip'); // npm i -D adm-zip
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
  return paths.sort();
}
```

- [ ] **Step 8: Install zip dep + commit**

```bash
npm install -D adm-zip
git add -A && git commit -m "feat(pipeline): SSA download + yob parser with test"
```

---

## Task 3: Index records + share/peak/median/skew stats

**Files:**
- Create: `pipeline/src/index.ts`, `pipeline/src/stats.ts`
- Test: `pipeline/tests/stats.test.ts`

**Interfaces:**
- Produces:
  - `indexRecords(records: RawRecord[]): { aggs: Map<string, NameAgg>; totalBirthsByYear: Map<number, number> }`
  - `shareCurve(agg: NameAgg, totalBirthsByYear: Map<number, number>): number[]` (raw shares, length END−START+1)
  - `normalizeCurve(shares: number[]): number[]` (ints 0..1000 of own max)
  - `peakYearOf(shares: number[]): number`
  - `medianBirthYear(agg: NameAgg): number`
  - `skewOf(agg: NameAgg): { dominantSex: Sex; pct: number; total: number }`
- Consumes: `RawRecord`, `NameAgg`, `Sex`, `START_YEAR`, `END_YEAR`.

- [ ] **Step 1: Write failing test `pipeline/tests/stats.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import type { RawRecord } from '../../src/lib/types.ts';
import { indexRecords, shareCurve, normalizeCurve, peakYearOf, medianBirthYear, skewOf } from '../src/stats.ts';

// Minimal 3-year world (pretend START_YEAR..START_YEAR+2 by using real years near start)
const recs: RawRecord[] = [
  { name: 'Ann', sex: 'F', year: 1880, count: 100 },
  { name: 'Ann', sex: 'F', year: 1881, count: 300 },
  { name: 'Ann', sex: 'M', year: 1881, count: 100 },
  { name: 'Bob', sex: 'M', year: 1880, count: 900 },
  { name: 'Bob', sex: 'M', year: 1881, count: 600 },
];

describe('indexRecords', () => {
  it('aggregates per-name per-sex per-year and yearly totals', () => {
    const { aggs, totalBirthsByYear } = indexRecords(recs);
    expect(aggs.get('Ann')!.totalBySex).toEqual({ M: 100, F: 400 });
    expect(totalBirthsByYear.get(1880)).toBe(1000); // 100 + 900
    expect(totalBirthsByYear.get(1881)).toBe(1000); // 300 + 100 + 600
  });
});

describe('stats', () => {
  const { aggs, totalBirthsByYear } = indexRecords(recs);
  it('shareCurve = name total / all births that year', () => {
    const c = shareCurve(aggs.get('Ann')!, totalBirthsByYear);
    expect(c[0]).toBeCloseTo(100 / 1000);   // 1880
    expect(c[1]).toBeCloseTo(400 / 1000);   // 1881 (300F+100M)
  });
  it('normalizeCurve scales own max to 1000', () => {
    expect(normalizeCurve([0.1, 0.4, 0])).toEqual([250, 1000, 0]);
  });
  it('peakYearOf returns the year of max share', () => {
    expect(peakYearOf(shareCurve(aggs.get('Ann')!, totalBirthsByYear))).toBe(1881);
  });
  it('medianBirthYear is the year crossing half of cumulative births', () => {
    // Ann totals: 1880=100, 1881=400; cumulative half=250 -> reached in 1881
    expect(medianBirthYear(aggs.get('Ann')!)).toBe(1881);
  });
  it('skewOf picks the dominant sex and its percentage', () => {
    const s = skewOf(aggs.get('Ann')!);
    expect(s.dominantSex).toBe('F');
    expect(s.pct).toBeCloseTo(80.0); // 400 / 500
    expect(s.total).toBe(500);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run pipeline/tests/stats.test.ts`

- [ ] **Step 3: Implement `pipeline/src/stats.ts`**

```ts
import type { RawRecord, NameAgg, Sex } from '../../src/lib/types.ts';
import { START_YEAR, END_YEAR } from '../../src/lib/types.ts';

export function indexRecords(records: RawRecord[]) {
  const aggs = new Map<string, NameAgg>();
  const totalBirthsByYear = new Map<number, number>();
  for (const r of records) {
    let a = aggs.get(r.name);
    if (!a) { a = { name: r.name, bySexYear: { M: new Map(), F: new Map() }, totalBySex: { M: 0, F: 0 } }; aggs.set(r.name, a); }
    a.bySexYear[r.sex].set(r.year, (a.bySexYear[r.sex].get(r.year) ?? 0) + r.count);
    a.totalBySex[r.sex] += r.count;
    totalBirthsByYear.set(r.year, (totalBirthsByYear.get(r.year) ?? 0) + r.count);
  }
  return { aggs, totalBirthsByYear };
}

const nYears = END_YEAR - START_YEAR + 1;

function totalByYear(agg: NameAgg, year: number): number {
  return (agg.bySexYear.M.get(year) ?? 0) + (agg.bySexYear.F.get(year) ?? 0);
}

export function shareCurve(agg: NameAgg, totalBirthsByYear: Map<number, number>): number[] {
  const out = new Array(nYears).fill(0);
  for (let i = 0; i < nYears; i++) {
    const y = START_YEAR + i;
    const denom = totalBirthsByYear.get(y) ?? 0;
    out[i] = denom ? totalByYear(agg, y) / denom : 0;
  }
  return out;
}

export function normalizeCurve(shares: number[]): number[] {
  const max = Math.max(...shares, 0);
  if (max === 0) return shares.map(() => 0);
  return shares.map(v => Math.round((v / max) * 1000));
}

export function peakYearOf(shares: number[]): number {
  let bi = 0;
  for (let i = 1; i < shares.length; i++) if (shares[i] > shares[bi]) bi = i;
  return START_YEAR + bi;
}

export function medianBirthYear(agg: NameAgg): number {
  const total = agg.totalBySex.M + agg.totalBySex.F;
  const half = total / 2;
  let cum = 0;
  for (let y = START_YEAR; y <= END_YEAR; y++) {
    cum += totalByYear(agg, y);
    if (cum >= half) return y;
  }
  return END_YEAR;
}

export function skewOf(agg: NameAgg): { dominantSex: Sex; pct: number; total: number } {
  const { M, F } = agg.totalBySex;
  const total = M + F;
  const dominantSex: Sex = F >= M ? 'F' : 'M';
  const pct = total ? Math.round((agg.totalBySex[dominantSex] / total) * 1000) / 10 : 0;
  return { dominantSex, pct, total };
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): record index + share/peak/median/skew stats (TDD)"
```

---

## Task 4: Within-sex yearly rank

**Files:**
- Create: `pipeline/src/rank.ts`
- Test: `pipeline/tests/rank.test.ts`

**Interfaces:**
- Produces:
  - `computeRanks(records: RawRecord[]): Map<string, Map<number, number>>` keyed by `` `${name} ${sex}` ``, value year→rank (1 = most common that sex that year, ties share the lower rank by count, name-alphabetical tiebreak).
  - `peakRankOf(name: string, sex: Sex, ranks: Map<string, Map<number, number>>): number` (min rank across years; `Infinity` if never ranked).
- Consumes: `RawRecord`, `Sex`.

- [ ] **Step 1: Write failing test `pipeline/tests/rank.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import type { RawRecord } from '../../src/lib/types.ts';
import { computeRanks, peakRankOf } from '../src/rank.ts';

const recs: RawRecord[] = [
  { name: 'Ann', sex: 'F', year: 1880, count: 100 },
  { name: 'Bea', sex: 'F', year: 1880, count: 300 },
  { name: 'Cyd', sex: 'F', year: 1880, count: 200 },
  { name: 'Ann', sex: 'F', year: 1881, count: 500 },
  { name: 'Bea', sex: 'F', year: 1881, count: 100 },
];
const key = (n: string, s: string) => `${n} ${s}`;

describe('computeRanks', () => {
  const ranks = computeRanks(recs);
  it('ranks within sex per year, 1 = most common', () => {
    expect(ranks.get(key('Bea', 'F'))!.get(1880)).toBe(1); // 300
    expect(ranks.get(key('Cyd', 'F'))!.get(1880)).toBe(2); // 200
    expect(ranks.get(key('Ann', 'F'))!.get(1880)).toBe(3); // 100
    expect(ranks.get(key('Ann', 'F'))!.get(1881)).toBe(1); // 500
  });
  it('peakRankOf returns the best (min) yearly rank', () => {
    expect(peakRankOf('Ann', 'F', ranks)).toBe(1);
    expect(peakRankOf('Cyd', 'F', ranks)).toBe(2);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `pipeline/src/rank.ts`**

```ts
import type { RawRecord, Sex } from '../../src/lib/types.ts';

const key = (name: string, sex: Sex) => `${name} ${sex}`;

export function computeRanks(records: RawRecord[]): Map<string, Map<number, number>> {
  // group counts by year+sex
  const byYearSex = new Map<string, { name: string; count: number }[]>();
  for (const r of records) {
    const k = `${r.year} ${r.sex}`;
    (byYearSex.get(k) ?? byYearSex.set(k, []).get(k)!).push({ name: r.name, count: r.count });
  }
  const ranks = new Map<string, Map<number, number>>();
  for (const [k, arr] of byYearSex) {
    const [yearStr, sex] = k.split(' ');
    const year = Number(yearStr);
    arr.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    arr.forEach((e, i) => {
      const kk = key(e.name, sex as Sex);
      (ranks.get(kk) ?? ranks.set(kk, new Map()).get(kk)!).set(year, i + 1);
    });
  }
  return ranks;
}

export function peakRankOf(name: string, sex: Sex, ranks: Map<string, Map<number, number>>): number {
  const m = ranks.get(key(name, sex));
  if (!m) return Infinity;
  return Math.min(...m.values());
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): within-sex yearly rank + peak rank (TDD)"
```

---

## Task 5: Trajectory + era caption

**Files:**
- Create: `pipeline/src/caption.ts`
- Test: `pipeline/tests/caption.test.ts`

**Interfaces:**
- Produces:
  - `type Trajectory = 'rising' | 'falling' | 'comeback' | 'faded' | 'steady'`
  - `classifyTrajectory(shares: number[], peakYear: number): Trajectory`
  - `eraCaption(peakYear: number, trajectory: Trajectory): string`
- Consumes: `START_YEAR`, `END_YEAR`.

Trajectory rules (deterministic, on the raw `shares` array): let `recent = mean(last 15 values)`, `peak = max`, `peakIdx = argmax`. `faded` if `recent < 0.10*peak && peakIdx < len-30`. `comeback` if `recent >= 0.5*peak && there exists a trough < 0.35*peak between peakIdx and the recent window`. `rising` if the last value is within the top 15% of the series and `recent > mean(first 15)`. `falling` if `recent < 0.5*peak && !faded`. Else `steady`.

- [ ] **Step 1: Write failing test `pipeline/tests/caption.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { classifyTrajectory, eraCaption } from '../src/caption.ts';
import { START_YEAR, END_YEAR } from '../../src/lib/types.ts';

const n = END_YEAR - START_YEAR + 1;
function gauss(mu: number, s: number) {
  return Array.from({ length: n }, (_, i) => Math.exp(-(((START_YEAR + i) - mu) ** 2) / (2 * s * s)));
}

describe('classifyTrajectory', () => {
  it('flags a mid-century bloom that vanished as faded', () => {
    const s = gauss(1935, 8);
    expect(classifyTrajectory(s, 1935)).toBe('faded');
  });
  it('flags a name still near its peak at the end as rising', () => {
    const s = gauss(2020, 12);
    expect(classifyTrajectory(s, 2020)).toBe('rising');
  });
});

describe('eraCaption', () => {
  it('names the peak decade and the arc', () => {
    expect(eraCaption(1985, 'faded')).toMatch(/1980s/);
    expect(eraCaption(1985, 'faded')).toMatch(/faded|since/i);
  });
  it('always returns a non-empty sentence', () => {
    for (const t of ['rising', 'falling', 'comeback', 'faded', 'steady'] as const) {
      expect(eraCaption(1950, t).length).toBeGreaterThan(10);
    }
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `pipeline/src/caption.ts`**

```ts
import { START_YEAR, END_YEAR } from '../../src/lib/types.ts';

export type Trajectory = 'rising' | 'falling' | 'comeback' | 'faded' | 'steady';

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

export function classifyTrajectory(shares: number[], peakYear: number): Trajectory {
  const len = shares.length;
  const peak = Math.max(...shares, 0);
  if (peak === 0) return 'steady';
  const peakIdx = peakYear - START_YEAR;
  const recent = mean(shares.slice(-15));
  const early = mean(shares.slice(0, 15));
  const last = shares[len - 1];

  if (recent < 0.10 * peak && peakIdx < len - 30) return 'faded';
  const trough = Math.min(...shares.slice(peakIdx, len - 15));
  if (recent >= 0.5 * peak && trough < 0.35 * peak && peakIdx < len - 20) return 'comeback';
  if (last >= 0.85 * peak && recent > early) return 'rising';
  if (recent < 0.5 * peak) return 'falling';
  return 'steady';
}

function decade(year: number): string { return `${Math.floor(year / 10) * 10}s`; }

export function eraCaption(peakYear: number, trajectory: Trajectory): string {
  const d = decade(peakYear);
  switch (trajectory) {
    case 'faded':    return `A name that crested in the ${d} and has all but disappeared since.`;
    case 'falling':  return `A name that peaked in the ${d} and has been fading ever since.`;
    case 'comeback': return `A name that crested in the ${d}, fell away, and is climbing again.`;
    case 'rising':   return `A name on the rise, most common in the ${d} and still climbing.`;
    default:         return `A steady name, most common around the ${d}.`;
  }
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): trajectory classifier + era caption (TDD)"
```

---

## Task 6: Twins (nearest-trajectory names)

**Files:**
- Create: `pipeline/src/twins.ts`
- Test: `pipeline/tests/twins.test.ts`

**Interfaces:**
- Produces:
  - `shapeVector(shares: number[]): number[]` (L2-normalized)
  - `cosine(a: number[], b: number[]): number`
  - `topTwins(targetSlug: string, vectors: Map<string, number[]>, k: number): { slug: string; sim: number }[]`
- Consumes: nothing beyond arrays.

- [ ] **Step 1: Write failing test `pipeline/tests/twins.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { shapeVector, cosine, topTwins } from '../src/twins.ts';

describe('twins', () => {
  it('shapeVector L2-normalizes (unit length)', () => {
    const v = shapeVector([3, 4]);
    expect(v[0]).toBeCloseTo(0.6);
    expect(v[1]).toBeCloseTo(0.8);
  });
  it('cosine of identical shapes is 1, orthogonal is 0', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it('topTwins returns nearest others, excluding self, sorted desc', () => {
    const vectors = new Map<string, number[]>([
      ['a', shapeVector([1, 0, 0])],
      ['b', shapeVector([0.9, 0.1, 0])],
      ['c', shapeVector([0, 0, 1])],
    ]);
    const t = topTwins('a', vectors, 2);
    expect(t[0].slug).toBe('b');
    expect(t.map(x => x.slug)).not.toContain('a');
    expect(t[0].sim).toBeGreaterThan(t[1].sim);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `pipeline/src/twins.ts`**

```ts
export function shapeVector(shares: number[]): number[] {
  const norm = Math.hypot(...shares);
  if (norm === 0) return shares.map(() => 0);
  return shares.map(v => v / norm);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]; // inputs are unit vectors
  return dot;
}

export function topTwins(
  targetSlug: string,
  vectors: Map<string, number[]>,
  k: number,
): { slug: string; sim: number }[] {
  const target = vectors.get(targetSlug);
  if (!target) return [];
  const scored: { slug: string; sim: number }[] = [];
  for (const [slug, vec] of vectors) {
    if (slug === targetSlug) continue;
    scored.push({ slug, sim: cosine(target, vec) });
  }
  scored.sort((a, b) => b.sim - a.sim);
  return scored.slice(0, k);
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): twins similarity via cosine on shape vectors (TDD)"
```

**Build-time note (used in Task 8):** twins are computed only over *candidate* names (all-time total ≥ `TWIN_THRESHOLD`, tuned to ~2–3k names → ≤ ~9M cosine calls, seconds offline). Rarer names get no twins (section hidden). Sparkline for each twin = its `curve` downsampled to 40 points.

---

## Task 7: Explorer aggregates

**Files:**
- Create: `pipeline/src/explore.ts`
- Test: `pipeline/tests/explore.test.ts`

**Interfaces:**
- Produces:
  - `ghosts(names: NameStat[], k: number): NameStat[]`
  - `comebacks(names: NameStat[], k: number): NameStat[]`
  - `unisex(names: NameStat[], k: number): NameStat[]`
  - `nameOfYear(records: RawRecord[]): Record<number, { M: string[]; F: string[] }>` (top 3 names per sex per year)
  - where `interface NameStat { name: string; slug: string; shares: number[]; peakYear: number; peakShare: number; recentShare: number; troughAfterPeak: number; skewPct: number; }`
- Consumes: `RawRecord`.

Definitions: **ghosts** = `recentShare < 0.05*peakShare && peakYear <= 1965`, ranked by `peakShare` desc. **comebacks** = `recentShare >= 0.5*peakShare && troughAfterPeak < 0.35*peakShare`, ranked by `recentShare/troughAfterPeak` desc. **unisex** = `skewPct <= 65`, ranked by `peakShare` desc (most-used balanced names). **nameOfYear** = per year, the top-count name for each sex.

- [ ] **Step 1: Write failing test `pipeline/tests/explore.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import type { RawRecord } from '../../src/lib/types.ts';
import { ghosts, comebacks, nameOfYear, type NameStat } from '../src/explore.ts';

const mk = (over: Partial<NameStat>): NameStat => ({
  name: 'X', slug: 'x', shares: [], peakYear: 1900, peakShare: 1,
  recentShare: 0, troughAfterPeak: 0, skewPct: 100, ...over,
});

describe('explore', () => {
  it('ghosts: big old peak, ~zero now', () => {
    const g = ghosts([
      mk({ name: 'Bertha', slug: 'bertha', peakYear: 1900, peakShare: 1, recentShare: 0.01 }),
      mk({ name: 'Emma', slug: 'emma', peakYear: 2005, peakShare: 1, recentShare: 0.9 }),
    ], 5);
    expect(g.map(x => x.slug)).toEqual(['bertha']);
  });
  it('comebacks: fell to a trough then recovered', () => {
    const c = comebacks([
      mk({ name: 'Hazel', slug: 'hazel', peakShare: 1, recentShare: 0.8, troughAfterPeak: 0.05 }),
      mk({ name: 'Gary', slug: 'gary', peakShare: 1, recentShare: 0.1, troughAfterPeak: 0.05 }),
    ], 5);
    expect(c.map(x => x.slug)).toEqual(['hazel']);
  });
  it('nameOfYear: top 3 names per sex per year, count desc', () => {
    const recs: RawRecord[] = [
      { name: 'Mary', sex: 'F', year: 1880, count: 100 },
      { name: 'Anna', sex: 'F', year: 1880, count: 90 },
      { name: 'John', sex: 'M', year: 1880, count: 80 },
    ];
    expect(nameOfYear(recs)[1880]).toEqual({ M: ['John'], F: ['Mary', 'Anna'] });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `pipeline/src/explore.ts`**

```ts
import type { RawRecord, Sex } from '../../src/lib/types.ts';

export interface NameStat {
  name: string; slug: string; shares: number[];
  peakYear: number; peakShare: number; recentShare: number;
  troughAfterPeak: number; skewPct: number;
}

export function ghosts(names: NameStat[], k: number): NameStat[] {
  return names
    .filter(n => n.recentShare < 0.05 * n.peakShare && n.peakYear <= 1965)
    .sort((a, b) => b.peakShare - a.peakShare)
    .slice(0, k);
}

export function comebacks(names: NameStat[], k: number): NameStat[] {
  return names
    .filter(n => n.recentShare >= 0.5 * n.peakShare && n.troughAfterPeak < 0.35 * n.peakShare)
    .sort((a, b) => (b.recentShare / (b.troughAfterPeak || 1e-9)) - (a.recentShare / (a.troughAfterPeak || 1e-9)))
    .slice(0, k);
}

export function unisex(names: NameStat[], k: number): NameStat[] {
  return names
    .filter(n => n.skewPct <= 65)
    .sort((a, b) => b.peakShare - a.peakShare)
    .slice(0, k);
}

export function nameOfYear(records: RawRecord[]): Record<number, { M: string[]; F: string[] }> {
  const byYearSex = new Map<string, { name: string; count: number }[]>();
  for (const r of records) {
    const k = `${r.year} ${r.sex}`;
    (byYearSex.get(k) ?? byYearSex.set(k, []).get(k)!).push({ name: r.name, count: r.count });
  }
  const out: Record<number, { M: string[]; F: string[] }> = {};
  for (const [k, arr] of byYearSex) {
    const [yearStr, sex] = k.split(' ');
    const year = Number(yearStr);
    arr.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    (out[year] ??= { M: [], F: [] })[sex as Sex] = arr.slice(0, 3).map(e => e.name);
  }
  return out;
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pipeline): explorer aggregates ghosts/comebacks/unisex/nameOfYear (TDD)"
```

---

## Task 8: Build orchestrator + shard writer

**Files:**
- Create: `src/lib/format.ts` (needed here for slugify/shardKey — full TDD is in Task 9; write the two functions used now)
- Create: `pipeline/src/shard.ts`, `pipeline/src/build.ts`
- Modify: none

**Interfaces:**
- Consumes: everything from Tasks 2–7 plus `slugify`, `shardKey` from `src/lib/format.ts`.
- Produces (files on disk):
  - `public/data/names.json` — `[[name, slug], ...]` for autocomplete (all indexed names).
  - `public/data/names/{aa}.json` — `Record<slug, NamePayload>` for the long tail; `aa` = `shardKey(slug)`.
  - `public/data/explore.json` — `ExploreData`.
  - `public/data/top.json` — `string[]` slugs of the top-N names (Task 11 prerenders these).

- [ ] **Step 1: Add `slugify` + `shardKey` to `src/lib/format.ts`**

```ts
export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
/** First two slug chars, padded, for detail sharding. Non-letters -> '_'. */
export function shardKey(slug: string): string {
  const a = slug[0] ?? '_';
  const b = slug[1] ?? '_';
  return (/[a-z0-9]/.test(a) ? a : '_') + (/[a-z0-9]/.test(b) ? b : '_');
}
```

- [ ] **Step 2: Implement `pipeline/src/shard.ts`**

```ts
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
```

- [ ] **Step 3: Implement `pipeline/src/build.ts`** (orchestrator — glue, exercised by running it)

```ts
import { readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadSSA } from './download.ts';
import { parseYobFile } from './parse.ts';
import { indexRecords, shareCurve, normalizeCurve, peakYearOf, medianBirthYear, skewOf } from './stats.ts';
import { computeRanks, peakRankOf } from './rank.ts';
import { classifyTrajectory, eraCaption } from './caption.ts';
import { shapeVector, topTwins } from './twins.ts';
import { ghosts, comebacks, unisex, nameOfYear, type NameStat } from './explore.ts';
import { writeArtifacts } from './shard.ts';
import { slugify } from '../../src/lib/format.ts';
import { START_YEAR, END_YEAR, type NamePayload, type RawRecord, type TwinData, type ExploreItem } from '../../src/lib/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TWIN_THRESHOLD = 60_000;   // all-time total to be a twin candidate (~2–3k names); tune after first run
const TOP_N = 5_000;             // names prerendered as pages (Task 11)
const CURRENT_YEAR = new Date().getFullYear();

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
  for (const f of files) {
    const year = Number(basename(f).match(/\d{4}/)![0]);
    records.push(...parseYobFile(await readFile(f, 'utf8'), year));
  }
  console.log(`parsed ${records.length} records across ${files.length} years`);

  const { aggs, totalBirthsByYear } = indexRecords(records);
  const ranks = computeRanks(records);

  // First pass: per-name core stats
  const stats: (NameStat & { agg: import('../../src/lib/types.ts').NameAgg; curve: number[]; dominantSex: 'M' | 'F'; peakRank: number; median: number })[] = [];
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

  // Twins over candidates
  const candidates = stats.filter(s => (s.agg.totalBySex.M + s.agg.totalBySex.F) >= TWIN_THRESHOLD);
  const vectors = new Map(candidates.map(s => [s.slug, shapeVector(s.shares)]));
  const curveBySlug = new Map(stats.map(s => [s.slug, s.curve]));
  const nameBySlug = new Map(stats.map(s => [s.slug, s.name]));

  const payloads: NamePayload[] = stats.map(s => {
    const twins: TwinData[] = vectors.has(s.slug)
      ? topTwins(s.slug, vectors, 5).map(t => ({
          name: nameBySlug.get(t.slug)!, slug: t.slug, spark: downsample(curveBySlug.get(t.slug)!, 40),
        }))
      : [];
    return {
      name: s.name, slug: s.slug, dominantSex: s.dominantSex, startYear: START_YEAR,
      curve: s.curve, peakYear: s.peakYear, peakRank: s.peakRank, skewPct: s.skewPct,
      totalBirths: s.agg.totalBySex.M + s.agg.totalBySex.F,
      medianBirthYear: s.median, medianAgeToday: CURRENT_YEAR - s.median,
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

  await writeArtifacts(join(ROOT, 'public', 'data'), payloads, explore, topSlugs);
  console.log(`wrote ${payloads.length} names, ${topSlugs.length} top slugs`);
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Run the pipeline end-to-end**

Run: `npm run data`
Expected: downloads names.zip, prints `parsed ~2M records across 145 years`, writes `public/data/`. **Spot-check:** open `public/data/names/du.json`, confirm a `dustin` payload with `dominantSex:"M"`, a `peakYear` in the 1980s, non-empty `curve` (145 ints), and up to 5 `twins`.

- [ ] **Step 5: Commit** (data artifacts included)

```bash
git add -A && git commit -m "feat(pipeline): build orchestrator + shard writer; generate name artifacts"
```

---

## Task 9: Chart + format libraries (client-shared, TDD)

**Files:**
- Modify: `src/lib/format.ts` (add `rankLabel`, `pct`)
- Create: `src/lib/chart.ts`
- Test: `src/lib/chart.test.ts`, `src/lib/format.test.ts`

**Interfaces:**
- Produces:
  - `buildLinePath(values: number[], W: number, H: number, pad: number): { line: string; area: string }` — values in 0..1000; maps to a top-down SVG (peak near top).
  - `buildSparkPath(values: number[], w: number, h: number): string`
  - `rankLabel(rank: number): string` → `#123`
  - `pct(x: number, dp?: number): string` → `99.2%`
- Consumes: nothing.

- [ ] **Step 1: Write failing test `src/lib/chart.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildLinePath, buildSparkPath } from './chart.ts';

describe('buildLinePath', () => {
  it('starts with M, uses L for subsequent points, closes the area', () => {
    const { line, area } = buildLinePath([0, 1000], 1000, 380, 6);
    expect(line.startsWith('M')).toBe(true);
    expect(line).toContain('L');
    expect(area.trim().endsWith('Z')).toBe(true);
  });
  it('maps value 1000 near the top (small y) and 0 near the baseline', () => {
    const { line } = buildLinePath([0, 1000], 1000, 380, 6);
    const ys = [...line.matchAll(/[ML][\d.]+ ([\d.]+)/g)].map(m => Number(m[1]));
    expect(ys[1]).toBeLessThan(ys[0]); // 1000 -> higher up
  });
});

describe('buildSparkPath', () => {
  it('produces a path scaled to its own max', () => {
    expect(buildSparkPath([0, 500, 1000], 46, 18).startsWith('M')).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `src/lib/chart.ts`**

```ts
export function buildLinePath(values: number[], W: number, H: number, pad: number) {
  const n = values.length;
  const xAt = (i: number) => pad + (i / (n - 1)) * (W - pad * 2);
  const yAt = (v: number) => H - pad - (v / 1000) * (H - pad * 2);
  let line = '';
  values.forEach((v, i) => { line += (i ? 'L' : 'M') + xAt(i).toFixed(1) + ' ' + yAt(v).toFixed(1) + ' '; });
  const area = line + 'L' + xAt(n - 1).toFixed(1) + ' ' + (H - pad) + ' L' + xAt(0).toFixed(1) + ' ' + (H - pad) + ' Z';
  return { line, area };
}

export function buildSparkPath(values: number[], w: number, h: number): string {
  const n = values.length;
  const max = Math.max(...values, 1);
  let d = '';
  values.forEach((v, i) => {
    const x = (i / (n - 1)) * w;
    const y = h - (v / max) * (h - 3) - 1.5;
    d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
  });
  return d;
}
```

- [ ] **Step 4: Write `src/lib/format.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { slugify, shardKey, rankLabel, pct } from './format.ts';

describe('format', () => {
  it('slugify lowercases and dashes', () => { expect(slugify('Mary Jo')).toBe('mary-jo'); });
  it('shardKey takes first two slug chars', () => { expect(shardKey('dustin')).toBe('du'); });
  it('rankLabel prefixes #', () => { expect(rankLabel(123)).toBe('#123'); });
  it('pct rounds to given decimals', () => { expect(pct(0.992, 1)).toBe('99.2%'); });
});
```

- [ ] **Step 5: Add `rankLabel` + `pct` to `src/lib/format.ts`**

```ts
export function rankLabel(rank: number): string { return `#${rank}`; }
export function pct(x: number, dp = 1): string { return `${(x * 100).toFixed(dp)}%`; }
```

- [ ] **Step 6: Run both test files — expect PASS**

Run: `npx vitest run src/lib`

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(lib): SVG chart-path + format helpers (TDD)"
```

---

## Task 10: NameStory component + subcomponents (hold to the mockup)

**Files:**
- Create: `src/components/NameStory.astro`, `PopularityChart.astro`, `StatTiles.astro`, `TwinChips.astro`, `SearchBox.astro`
- Create: `src/scripts/chart-draw.ts`, `src/scripts/search.ts`
- Create: `src/lib/data.ts` (build-time reader) + a demo route to verify against the mockup

**Interfaces:**
- Consumes: `NamePayload` (props), `buildLinePath`/`buildSparkPath` (chart.ts), `rankLabel`/`pct` (format.ts).
- Produces: `<NameStory payload={NamePayload} />` rendering the exact Direction-A layout.

- [ ] **Step 1: Write `src/lib/data.ts`** (build-time readers)

```ts
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
```

- [ ] **Step 2: Write `src/components/PopularityChart.astro`**

```astro
---
import { buildLinePath } from '../lib/chart.ts';
import type { NamePayload } from '../lib/types.ts';
const { payload } = Astro.props as { payload: NamePayload };
const W = 1000, H = 380, PAD = 6;
const { line, area } = buildLinePath(payload.curve, W, H, PAD);
const n = payload.curve.length;
const peakIdx = payload.peakYear - payload.startYear;
const peakX = (PAD + (peakIdx / (n - 1)) * (W - PAD * 2));
const peakY = (H - PAD - (payload.curve[peakIdx] / 1000) * (H - PAD * 2));
const label = `Popularity of the name ${payload.name} from ${payload.startYear} to ${payload.startYear + n - 1}, peaking in ${payload.peakYear}.`;
---
<div class="chartwrap" data-chart data-peak-x={(peakX / W * 100).toFixed(2)} data-peak-y={(peakY / H * 100).toFixed(2)} data-peak-year={payload.peakYear}>
  <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
    <defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--accent)" stop-opacity=".16" />
      <stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
    </linearGradient></defs>
    <path d={area} fill="url(#fill)" opacity="0" class="area" />
    <path d={line} fill="none" stroke="var(--accent)" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" class="line" />
    <circle cx={peakX.toFixed(1)} cy={peakY.toFixed(1)} r="4" fill="var(--stamp)" class="dot" opacity="0" />
  </svg>
  <div class="peaklabel"><b>{payload.peakYear}</b>peak</div>
</div>
<div class="axis"><span>{payload.startYear}</span><span>1920</span><span>1960</span><span>2000</span><span>{payload.startYear + n - 1}</span></div>

<style>
  .chartwrap { margin: 30px 0 34px; position: relative; }
  .chartwrap svg { width: 100%; height: auto; display: block; overflow: visible; }
  .peaklabel { position: absolute; transform: translate(-50%, -100%); opacity: 0;
    font: 600 12px/1.3 var(--mono); color: var(--ink); text-align: center; pointer-events: none; white-space: nowrap; }
  .peaklabel b { display: block; font-size: 15px; }
  .axis { display: flex; justify-content: space-between; margin-top: 8px;
    font: 500 11px/1 var(--mono); letter-spacing: .06em; color: var(--ink-soft); }
</style>
<script src="../scripts/chart-draw.ts"></script>
```

- [ ] **Step 3: Write `src/scripts/chart-draw.ts`** (self-draw, IntersectionObserver, reduced-motion)

```ts
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function draw(wrap: HTMLElement) {
  const svg = wrap.querySelector('svg')!;
  const lineEl = svg.querySelector('.line') as SVGPathElement;
  const area = svg.querySelector('.area') as SVGPathElement;
  const dot = svg.querySelector('.dot') as SVGCircleElement;
  const lab = wrap.querySelector('.peaklabel') as HTMLElement;
  lab.style.left = wrap.dataset.peakX + '%';
  lab.style.top = (Number(wrap.dataset.peakY) - 3) + '%';

  if (reduce) { area.style.opacity = '1'; dot.setAttribute('opacity', '1'); lab.style.opacity = '1'; return; }
  const len = lineEl.getTotalLength();
  lineEl.style.strokeDasharray = String(len);
  lineEl.style.strokeDashoffset = String(len);
  lineEl.getBoundingClientRect();
  lineEl.style.transition = 'stroke-dashoffset 1.7s cubic-bezier(.4,0,.15,1)';
  lineEl.style.strokeDashoffset = '0';
  area.style.transition = 'opacity 1.2s ease .5s'; area.style.opacity = '1';
  dot.style.transition = 'opacity .4s ease 1.5s'; dot.setAttribute('opacity', '1');
  lab.style.transition = 'opacity .5s ease .9s';
  requestAnimationFrame(() => (lab.style.opacity = '1'));
}

const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { draw(e.target as HTMLElement); io.unobserve(e.target); }
}, { threshold: .35 });
document.querySelectorAll<HTMLElement>('[data-chart]').forEach(el => io.observe(el));
```

- [ ] **Step 4: Write `src/components/StatTiles.astro`**

```astro
---
import type { NamePayload } from '../lib/types.ts';
import { rankLabel } from '../lib/format.ts';
const { payload } = Astro.props as { payload: NamePayload };
const skewSex = payload.dominantSex === 'F' ? 'girls' : 'boys';
const tiles = [
  { k: 'Peak year', v: String(payload.peakYear), s: 'the crest of the wave' },
  { k: 'Peak rank', v: Number.isFinite(payload.peakRank) ? rankLabel(payload.peakRank) : '—', s: `of all U.S. ${skewSex}’ names` },
  { k: 'Skew', v: `${payload.skewPct}%`, s: `given to ${skewSex}` },
  { k: 'Median age today', v: `~${payload.medianAgeToday}`, s: `median birth year ${payload.medianBirthYear}` },
];
---
<div class="stats">
  {tiles.map(t => (
    <div class="stat"><div class="k">{t.k}</div><div class="v">{t.v}</div><div class="s">{t.s}</div></div>
  ))}
</div>
<style>
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
    background: var(--rule); border: 1px solid var(--rule); border-radius: 12px; overflow: hidden; }
  .stat { background: var(--panel); padding: 18px 18px 16px; }
  .stat .k { font: 600 11px/1 var(--mono); letter-spacing: .16em; text-transform: uppercase; color: var(--ink-soft); }
  .stat .v { margin-top: 10px; font-variant-numeric: tabular-nums lining-nums;
    font: 400 clamp(22px,3.4vw,30px)/1 var(--display); color: var(--ink); letter-spacing: -.01em; }
  .stat .s { margin-top: 5px; font: 400 12.5px/1.35 system-ui, sans-serif; color: var(--ink-soft); }
  @media (max-width: 720px) { .stats { grid-template-columns: repeat(2, 1fr); } }
</style>
```

- [ ] **Step 5: Write `src/components/TwinChips.astro`**

```astro
---
import type { TwinData } from '../lib/types.ts';
import { buildSparkPath } from '../lib/chart.ts';
const { twins } = Astro.props as { twins: TwinData[] };
const base = import.meta.env.BASE_URL;
---
{twins.length > 0 && (
  <div class="twins">
    <div class="lab">Names that rose &amp; fell alongside it</div>
    <div class="chips">
      {twins.map(t => (
        <a class="chip" href={`${base}/name/${t.slug}`}>
          <svg viewBox="0 0 46 18" aria-hidden="true"><path d={buildSparkPath(t.spark, 46, 18)}
            fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-opacity=".85"
            stroke-linecap="round" stroke-linejoin="round" /></svg>
          <span>{t.name}</span>
        </a>
      ))}
    </div>
  </div>
)}
<style>
  .twins { margin-top: 30px; }
  .twins .lab { font: 600 11px/1 var(--mono); letter-spacing: .16em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 14px; }
  .chips { display: flex; flex-wrap: wrap; gap: 12px; }
  .chip { display: flex; align-items: center; gap: 11px; padding: 9px 14px 9px 12px;
    border: 1px solid var(--rule); border-radius: 999px; background: var(--panel); text-decoration: none; }
  .chip svg { width: 46px; height: 18px; display: block; }
  .chip span { font: 500 14px/1 var(--display); color: var(--ink); letter-spacing: .01em; }
</style>
```

- [ ] **Step 6: Write `src/components/SearchBox.astro`** (autocomplete island)

```astro
---
const { autofocus = false } = Astro.props as { autofocus?: boolean };
---
<div class="search" data-search>
  <input type="text" placeholder="Type a name…" aria-label="Search for a name"
    autocomplete="off" spellcheck="false" autofocus={autofocus} />
  <ul class="results" role="listbox" hidden></ul>
</div>
<style>
  .search { position: relative; max-width: 420px; }
  .search input { width: 100%; padding: 14px 18px; border: 1px solid var(--rule); border-radius: 999px;
    background: var(--panel); color: var(--ink); font: 400 16px/1 var(--display); }
  .search input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .results { position: absolute; z-index: 5; left: 0; right: 0; margin: 6px 0 0; padding: 6px; list-style: none;
    background: var(--panel); border: 1px solid var(--rule); border-radius: 14px; max-height: 300px; overflow: auto; }
  .results li a { display: block; padding: 9px 12px; border-radius: 8px; text-decoration: none;
    color: var(--ink); font: 500 15px/1 var(--display); }
  .results li a:hover, .results li a:focus-visible { background: var(--ground); }
</style>
<script src="../scripts/search.ts"></script>
```

- [ ] **Step 7: Write `src/scripts/search.ts`**

```ts
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
```

- [ ] **Step 8: Write `src/components/NameStory.astro`** (assembles the approved layout)

```astro
---
import type { NamePayload } from '../lib/types.ts';
import PopularityChart from './PopularityChart.astro';
import StatTiles from './StatTiles.astro';
import TwinChips from './TwinChips.astro';
import SearchBox from './SearchBox.astro';
const { payload } = Astro.props as { payload: NamePayload };
const n = payload.curve.length;
---
<section class="story">
  <div class="wrap">
    <div class="eyebrow">U.S. Social Security · {payload.startYear}–{payload.startYear + n - 1}</div>
    <h1 class="name">{payload.name}</h1>
    <p class="caption">{payload.caption}</p>
    <div class="stamp">Peaked {payload.peakYear}</div>

    <PopularityChart payload={payload} />
    <StatTiles payload={payload} />
    <TwinChips twins={payload.twins} />

    <div class="searchrow"><SearchBox /><span class="hint">try any name →</span></div>
  </div>
</section>
<style>
  .story { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; }
  .story > .wrap { width: 100%; }
  .eyebrow { font: 600 12px/1 var(--mono); letter-spacing: .24em; text-transform: uppercase; color: var(--accent);
    display: inline-flex; align-items: center; gap: 10px; }
  .eyebrow::before { content: ""; width: 26px; height: 1px; background: var(--accent); display: inline-block; }
  .name { margin: 16px 0 6px; letter-spacing: -.02em; text-wrap: balance; color: var(--ink);
    font: 400 clamp(56px,13vw,132px)/.92 var(--display); }
  .caption { margin: 0 0 6px; max-width: 30ch; color: var(--ink-soft);
    font: 400 clamp(17px,2.4vw,21px)/1.45 var(--display); font-style: italic; }
  .stamp { display: inline-block; margin-top: 14px; padding: 5px 12px; transform: rotate(-3deg);
    border: 1.5px solid var(--stamp); color: var(--stamp); border-radius: 3px;
    font: 700 11px/1 var(--mono); letter-spacing: .18em; text-transform: uppercase; }
  .searchrow { margin-top: 40px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .searchrow .hint { font: 400 13px/1 system-ui, sans-serif; color: var(--ink-soft); }
  @media (max-width: 720px) { .story { min-height: auto; padding-top: 56px; padding-bottom: 56px; } }
</style>
```

- [ ] **Step 9: Temporary verify route** — replace `src/pages/index.astro` body with a hard-coded Dustin render:

```astro
---
import '../styles/global.css';
import NameStory from '../components/NameStory.astro';
import { readPayload } from '../lib/data.ts';
const payload = await readPayload('dustin');
---
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Namesake</title></head>
<body>{payload && <NameStory payload={payload} />}</body></html>
```

- [ ] **Step 10: Verify live against the mockup**

Run: `npm run dev` → `http://localhost:4321/projects/namesake`. **Design gate (Impeccable):** open the approved `namesake-look-reference.html` `#a` side-by-side. Confirm: giant serif name, italic caption, rotated records stamp, curve self-draws on scroll-in, peak dot + label, 4 stat tiles (→2-up under 720px), twin chips with sparklines, faux ledger ground. Resize to 375 / 768 / desktop — nothing overlaps. Toggle OS reduced-motion → chart shows final state instantly.

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "feat(ui): NameStory + chart/stats/twins/search held to Direction-A mockup"
```

---

## Task 11: Per-name pages (prerender top-N) + long-tail fallback

**Files:**
- Create: `src/pages/name/[slug].astro`, `src/pages/name/_lookup.astro`
- Create: `src/scripts/lookup.ts`
- Create: `vercel.json`
- Revert: `src/pages/index.astro` to the placeholder (real landing is Task 12)

**Interfaces:**
- Consumes: `readTopSlugs`, `readPayload` (data.ts), `NameStory`.
- Produces: static pages at `/projects/namesake/name/<slug>` for the top-N; a `_lookup` page that client-hydrates any other slug.

- [ ] **Step 1: Write `src/pages/name/[slug].astro`**

```astro
---
import '../../styles/global.css';
import NameStory from '../../components/NameStory.astro';
import { readTopSlugs, readPayload } from '../../lib/data.ts';
import type { NamePayload } from '../../lib/types.ts';

export async function getStaticPaths() {
  const slugs = await readTopSlugs();
  const paths = [];
  for (const slug of slugs) {
    const payload = await readPayload(slug);
    if (payload) paths.push({ params: { slug }, props: { payload } });
  }
  return paths;
}
const { payload } = Astro.props as { payload: NamePayload };
const title = `${payload.name} — a name's life story | Namesake`;
const ogPath = `${Astro.site}projects/namesake/og/${payload.slug}.png`.replace(/([^:]\/)\/+/g, '$1');
---
<html lang="en"><head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <meta name="description" content={payload.caption} />
  <meta property="og:title" content={`${payload.name} — a name's life story`} />
  <meta property="og:description" content={payload.caption} />
  <meta property="og:image" content={ogPath} />
  <meta name="twitter:card" content="summary_large_image" />
</head><body><main><NameStory payload={payload} /></main></body></html>
```

- [ ] **Step 2: Write `src/pages/name/_lookup.astro`** (client-rendered shell for the long tail)

```astro
---
import '../../styles/global.css';
import SearchBox from '../../components/SearchBox.astro';
---
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Namesake</title><meta property="og:image" content="/projects/namesake/og/_default.png" /></head>
<body><main class="wrap">
  <section id="story" hidden></section>
  <section id="miss" hidden>
    <div class="eyebrow" style="color:var(--accent);font:600 12px/1 var(--mono);letter-spacing:.24em;text-transform:uppercase">No record found</div>
    <h1 style="font:400 clamp(40px,9vw,88px)/.95 var(--display);margin:14px 0">That name isn’t in the record.</h1>
    <p style="color:var(--ink-soft)">The U.S. only publishes names given to at least 5 babies in a year. Try another:</p>
    <SearchBox autofocus={true} />
  </section>
</main></body></html>
<script src="../../scripts/lookup.ts"></script>
```

- [ ] **Step 3: Write `src/scripts/lookup.ts`** (reads slug from URL, fetches shard, renders NameStory client-side)

```ts
import { buildLinePath, buildSparkPath } from '../lib/chart.ts';
import { rankLabel } from '../lib/format.ts';
import type { NamePayload } from '../lib/types.ts';

const base = import.meta.env.BASE_URL;
const slug = decodeURIComponent(location.pathname.replace(/\/$/, '').split('/').pop() || '');
const shardKey = ((slug[0] || '_').match(/[a-z0-9]/) ? slug[0] : '_') + ((slug[1] || '_').match(/[a-z0-9]/) ? slug[1] : '_');

async function run() {
  let payload: NamePayload | null = null;
  try {
    const shard = await fetch(`${base}/data/names/${shardKey}.json`).then(r => r.ok ? r.json() : null);
    payload = shard?.[slug] ?? null;
  } catch { payload = null; }
  if (!payload) { document.getElementById('miss')!.hidden = false; return; }
  document.title = `${payload.name} — a name's life story | Namesake`;
  renderStory(payload);
}

function renderStory(p: NamePayload) {
  const n = p.curve.length;
  const { line, area } = buildLinePath(p.curve, 1000, 380, 6);
  const peakIdx = p.peakYear - p.startYear;
  const px = 6 + (peakIdx / (n - 1)) * (1000 - 12);
  const py = 380 - 6 - (p.curve[peakIdx] / 1000) * (380 - 12);
  const skewSex = p.dominantSex === 'F' ? 'girls' : 'boys';
  const el = document.getElementById('story') as HTMLElement;
  el.hidden = false;
  el.className = 'story';
  el.innerHTML = `
    <div class="eyebrow">U.S. Social Security · ${p.startYear}–${p.startYear + n - 1}</div>
    <h1 class="name">${p.name}</h1>
    <p class="caption">${p.caption}</p>
    <div class="stamp">Peaked ${p.peakYear}</div>
    <div class="chartwrap"><svg viewBox="0 0 1000 380" role="img" aria-label="Popularity of ${p.name}">
      <defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--accent)" stop-opacity=".16"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#fill)"/>
      <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" fill="var(--stamp)"/></svg></div>
    <div class="stats">
      ${[['Peak year', String(p.peakYear), 'the crest of the wave'],
         ['Peak rank', Number.isFinite(p.peakRank) ? rankLabel(p.peakRank) : '—', `of all U.S. ${skewSex}’ names`],
         ['Skew', `${p.skewPct}%`, `given to ${skewSex}`],
         ['Median age today', `~${p.medianAgeToday}`, `median birth year ${p.medianBirthYear}`]]
        .map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('')}
    </div>
    ${p.twins.length ? `<div class="twins"><div class="lab">Names that rose &amp; fell alongside it</div><div class="chips">${
      p.twins.map(t => `<a class="chip" href="${base}/name/${t.slug}"><svg viewBox="0 0 46 18" aria-hidden="true"><path d="${buildSparkPath(t.spark,46,18)}" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-opacity=".85" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${t.name}</span></a>`).join('')
    }</div></div>` : ''}`;
}
run();
```

> Note: `_lookup` reuses the class names from Task 10's component `<style>` blocks, but those are scoped by Astro. To keep the long-tail visuals identical, move the NameStory/StatTiles/TwinChips/PopularityChart CSS into a shared global block appended to `src/styles/global.css` and mark the component styles `is:global` (or import that block). Do this refactor as the first action of this task, before Step 1. Verify Task 10's prerendered page still matches after the move.

- [ ] **Step 4: Write `vercel.json`** (filesystem-first; the rewrite only catches long-tail misses)

```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [
    { "source": "/projects/namesake/name/:slug", "destination": "/projects/namesake/name/_lookup/index.html" }
  ]
}
```

- [ ] **Step 5: Revert `src/pages/index.astro`** to the Task 1 placeholder (landing built next).

- [ ] **Step 6: Build + verify both paths**

Run: `npm run build` then `npm run preview`.
- Prerendered: open `/projects/namesake/name/dustin` → full story, correct data. Confirm `dist/projects/namesake/name/dustin/index.html` exists.
- Long-tail: temporarily open `/projects/namesake/name/_lookup?slug=...` won't carry a path slug in preview; instead verify the client renderer by opening `_lookup` and setting `location` via the built page for a known non-top slug through the search box (type a rare real name, submit → URL becomes `/name/<rare>` → served by fallback in the deployed env). In local `preview`, Vercel rewrites don't apply, so validate the fallback logic by unit-eyeballing: open `/projects/namesake/name/_lookup/` and in the console run the renderer against a fetched rare payload. (Full rewrite behavior is verified on the Vercel preview in Task 14.)

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(pages): prerendered per-name pages + long-tail client fallback + vercel rewrite"
```

---

## Task 12: Explorer landing

**Files:**
- Create: `src/components/ExplorePanel.astro`
- Rewrite: `src/pages/index.astro` (the real landing)

**Interfaces:**
- Consumes: `readExplore` (data.ts), `SearchBox`, `buildSparkPath`, `ExploreData`/`ExploreItem`.
- Produces: the explorer landing at `/projects/namesake`.

- [ ] **Step 1: Write `src/components/ExplorePanel.astro`**

```astro
---
import type { ExploreItem } from '../lib/types.ts';
import { buildSparkPath } from '../lib/chart.ts';
const { title, blurb, items } = Astro.props as { title: string; blurb: string; items: ExploreItem[] };
const base = import.meta.env.BASE_URL;
---
<section class="panel">
  <h2>{title}</h2>
  <p class="blurb">{blurb}</p>
  <div class="chips">
    {items.slice(0, 6).map(it => (
      <a class="chip" href={`${base}/name/${it.slug}`}>
        <svg viewBox="0 0 46 18" aria-hidden="true"><path d={buildSparkPath(it.spark, 46, 18)}
          fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-opacity=".85"
          stroke-linecap="round" stroke-linejoin="round" /></svg>
        <span>{it.name}</span>
      </a>
    ))}
  </div>
</section>
<style>
  .panel { padding: 26px; border: 1px solid var(--rule); border-radius: 16px; background: var(--panel); }
  .panel h2 { margin: 0 0 6px; font: 400 clamp(22px,3vw,30px)/1 var(--display); color: var(--ink); }
  .blurb { margin: 0 0 18px; max-width: 42ch; color: var(--ink-soft); font: 400 14.5px/1.5 system-ui, sans-serif; }
  .chips { display: flex; flex-wrap: wrap; gap: 12px; }
  .chip { display: flex; align-items: center; gap: 11px; padding: 9px 14px 9px 12px;
    border: 1px solid var(--rule); border-radius: 999px; background: var(--ground); text-decoration: none; }
  .chip svg { width: 46px; height: 18px; } .chip span { font: 500 14px/1 var(--display); color: var(--ink); }
</style>
```

- [ ] **Step 2: Rewrite `src/pages/index.astro`**

```astro
---
import '../styles/global.css';
import SearchBox from '../components/SearchBox.astro';
import ExplorePanel from '../components/ExplorePanel.astro';
import { readExplore } from '../lib/data.ts';
const ex = await readExplore();
---
<html lang="en"><head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Namesake — a map of American names</title>
  <meta name="description" content="Type your name and watch its 145-year life story unfold. A map of American first names, 1880–2024." />
  <meta property="og:title" content="Namesake — a map of American names" />
  <meta property="og:image" content="/projects/namesake/og/_default.png" />
  <meta name="twitter:card" content="summary_large_image" />
</head>
<body><main class="wrap">
  <header class="hero">
    <div class="kick">Namesake · U.S. Social Security · 1880–2024</div>
    <h1>What does a name's life look like?</h1>
    <p>Type your name. Watch 145 years of American births rise, crest, and fall.</p>
    <SearchBox autofocus={true} />
  </header>

  <div class="grid">
    <ExplorePanel title="Ghosts" blurb="Giants of their day, all but gone now." items={ex.ghosts} />
    <ExplorePanel title="Comebacks" blurb="Names roaring back after decades away." items={ex.comebacks} />
    <ExplorePanel title="The unisex line" blurb="Names shared across the gender divide." items={ex.unisex} />
  </div>
</main></body></html>

<style>
  .hero { padding: clamp(30px,7vw,80px) 0 44px; }
  .kick { font: 600 12px/1 var(--mono); letter-spacing: .26em; text-transform: uppercase; color: var(--accent); }
  .hero h1 { margin: 16px 0 10px; font: 400 clamp(40px,8vw,84px)/.98 var(--display); letter-spacing: -.01em; color: var(--ink); text-wrap: balance; }
  .hero p { margin: 0 0 26px; max-width: 46ch; color: var(--ink-soft); font: 400 clamp(16px,2vw,19px)/1.5 var(--display); font-style: italic; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px; padding-bottom: 80px; }
</style>
```

- [ ] **Step 3: Verify live (Impeccable gate)**

Run: `npm run dev` → `/projects/namesake`. Confirm hero + search autocomplete works (type "dus" → Dustin appears → click → name page). Panels render gorgeous sparkline chips; grid reflows cleanly at 375 / 768 / desktop; nothing overlaps.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(pages): explorer landing with hero search + ghosts/comebacks/unisex panels"
```

---

## Task 12b: Birth-year panel (enter a year → its defining names)

**Files:**
- Create: `src/components/BirthYearPanel.astro`
- Modify: `src/pages/index.astro` (add the panel as a full-width band under the grid)

**Interfaces:**
- Consumes: `readExplore` (data.ts) — specifically `explore.nameOfYear`; `slugify` (format.ts).
- Produces: an interactive band where changing the year reveals that year's top-3 boys' and girls' names as links.

- [ ] **Step 1: Write `src/components/BirthYearPanel.astro`**

```astro
---
import type { ExploreData } from '../lib/types.ts';
const { nameOfYear } = Astro.props as { nameOfYear: ExploreData['nameOfYear'] };
const years = Object.keys(nameOfYear).map(Number).sort((a, b) => a - b);
const minY = years[0], maxY = years[years.length - 1];
const defaultY = 2000;
---
<section class="birthyear" data-birthyear data-map={JSON.stringify(nameOfYear)}>
  <div class="head">
    <h2>The names of your birth year</h2>
    <div class="control">
      <label for="by-input">Born in</label>
      <input id="by-input" type="number" min={minY} max={maxY} value={defaultY} inputmode="numeric" />
    </div>
  </div>
  <div class="cols">
    <div class="col"><div class="lab">Top boys’ names</div><div class="list" data-slot="M"></div></div>
    <div class="col"><div class="lab">Top girls’ names</div><div class="list" data-slot="F"></div></div>
  </div>
</section>
<style>
  .birthyear { margin: 8px 0 80px; padding: 34px; border: 1px solid var(--rule); border-radius: 18px; background: var(--panel);
    background-image: repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(33,69,110,.05) 27px, rgba(33,69,110,.05) 28px); }
  .head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
  .head h2 { margin: 0; font: 400 clamp(24px,3.4vw,34px)/1 var(--display); color: var(--ink); }
  .control { display: flex; align-items: center; gap: 10px; font: 400 15px/1 var(--display); font-style: italic; color: var(--ink-soft); }
  .control input { width: 96px; padding: 8px 12px; border: 1px solid var(--rule); border-radius: 10px; background: var(--ground);
    color: var(--ink); font: 400 18px/1 var(--display); font-variant-numeric: tabular-nums; }
  .control input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  .lab { font: 600 11px/1 var(--mono); letter-spacing: .16em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 12px; }
  .list { display: flex; flex-direction: column; gap: 6px; }
  .list a { font: 400 clamp(20px,3vw,28px)/1.15 var(--display); color: var(--ink); text-decoration: none; width: fit-content; }
  .list a:hover, .list a:focus-visible { color: var(--accent); text-decoration: underline; text-underline-offset: 4px; }
  .list a .rank { font: 500 12px/1 var(--mono); color: var(--ink-soft); margin-right: 10px; }
  @media (max-width: 560px) { .cols { grid-template-columns: 1fr; } }
</style>
<script src="../scripts/birthyear.ts"></script>
```

- [ ] **Step 2: Write `src/scripts/birthyear.ts`**

```ts
import { slugify } from '../lib/format.ts';

const base = import.meta.env.BASE_URL;

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
```

- [ ] **Step 3: Add the panel to `src/pages/index.astro`** — import it and place it below the `.grid` div, passing the aggregate:

```astro
// add to the frontmatter imports:
import BirthYearPanel from '../components/BirthYearPanel.astro';
// `ex` already available from readExplore(); after </div> closing .grid, add:
<BirthYearPanel nameOfYear={ex.nameOfYear} />
```

- [ ] **Step 4: Verify live (Impeccable gate)**

Run: `npm run dev` → `/projects/namesake`. Change the year input (e.g. 1985 → 2010) → both columns update instantly to that year's top-3 names; each links to its name page. Ledger-lined band matches the Vital-Records look; columns stack to 1-up under 560px; nothing overlaps at 375 / 768 / desktop.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(pages): birth-year panel — enter a year, reveal its defining names"
```

---

## Task 13: Build-time OG share images

**Files:**
- Create: `scripts/og.ts`
- Create: `public/og/.gitkeep`
- Modify: `package.json` (already has `og` script from Task 1)

**Interfaces:**
- Consumes: `readTopSlugs`, `readPayload`, `buildLinePath`; satori + resvg.
- Produces: `public/og/<slug>.png` (1200×630) for the top ~2k names + `public/og/_default.png`.

- [ ] **Step 1: Implement `scripts/og.ts`**

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readTopSlugs, readPayload } from '../src/lib/data.ts';
import { buildLinePath } from '../src/lib/chart.ts';
import type { NamePayload } from '../src/lib/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'og');
const OG_N = 2_000;
const W = 1200, H = 630;

// System serif isn't available to satori; ship one woff/ttf for the display font.
const font = await (await fetch('https://raw.githubusercontent.com/googlefonts/gelasio/main/fonts/ttf/Gelasio-Regular.ttf')).arrayBuffer();

function card(p: NamePayload) {
  const { line } = buildLinePath(p.curve, 1080, 240, 6);
  return {
    type: 'div',
    props: {
      style: { width: W, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: 64, background: '#e7e2d3', color: '#23201b', fontFamily: 'Gelasio' },
      children: [
        { type: 'div', props: { style: { fontSize: 22, letterSpacing: 4, textTransform: 'uppercase', color: '#21456e' }, children: 'U.S. Social Security · 1880–2024' } },
        { type: 'div', props: { style: { display: 'flex', flexDirection: 'column' }, children: [
          { type: 'div', props: { style: { fontSize: 128, lineHeight: 1 }, children: p.name } },
          { type: 'div', props: { style: { fontSize: 30, fontStyle: 'italic', color: '#6b6252', marginTop: 12 }, children: p.caption } },
        ] } },
        { type: 'svg', props: { width: 1080, height: 120, viewBox: '0 0 1080 240', children: [
          { type: 'path', props: { d: line, fill: 'none', stroke: '#21456e', strokeWidth: 5 } },
        ] } },
      ],
    },
  };
}

async function render(p: NamePayload, slug: string) {
  const svg = await satori(card(p) as any, { width: W, height: H, fonts: [{ name: 'Gelasio', data: font, weight: 400, style: 'normal' }] });
  const png = new Resvg(svg).render().asPng();
  await writeFile(join(OUT, `${slug}.png`), png);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const slugs = (await readTopSlugs()).slice(0, OG_N);
  let done = 0;
  for (const slug of slugs) {
    const p = await readPayload(slug);
    if (p) { await render(p, slug); if (++done % 200 === 0) console.log(`og ${done}/${slugs.length}`); }
  }
  // default card
  const first = await readPayload(slugs[0]);
  if (first) await render({ ...first, name: 'Namesake', caption: 'A map of American names, 1880–2024.' }, '_default');
  console.log(`wrote ${done + 1} og images`);
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Generate + verify**

Run: `npm run og`
Expected: writes `public/og/*.png`. **Open `public/og/dustin.png`** — confirm 1200×630 manila card: giant "Dustin" serif, italic caption, ink-blue curve. Check `_default.png` too.

- [ ] **Step 3: Wire the font for satori** — if the GitHub fetch is unreliable in build, download the TTF once into `scripts/assets/` and read it locally instead. Do that now: save the font under `scripts/assets/display.ttf`, replace the `fetch` with `readFile`.

```ts
import { readFile } from 'node:fs/promises';
const font = await readFile(join(ROOT, 'scripts', 'assets', 'display.ttf'));
```

- [ ] **Step 4: Commit** (images + font committed)

```bash
git add -A && git commit -m "feat(og): build-time satori/resvg share cards for top names + default"
```

---

## Task 14: Deploy — standalone Vercel + main-site rewrite + final live gate

**Files:**
- Create: `README.md` (build + deploy + yearly-refresh runbook)
- Coordinate: one rewrite in the dustincole_data repo's `vercel.json`

**Interfaces:**
- Consumes: the built `dist/` from `astro build`.
- Produces: live site at `dustincoledata.com/projects/namesake`.

- [ ] **Step 1: Write `README.md`**

```md
# Namesake
A static "map of American names" (SSA national, 1880–2024). Flagship data toy for dustincoledata.

## Build
- `npm run data`  — download SSA + generate `public/data/*` (run yearly when SSA updates; commit output)
- `npm run og`    — generate `public/og/*.png` share cards (commit output)
- `npm run build` — `astro build` → `dist/`
- `npm test`      — Vitest (pipeline logic + chart/format)

## Deploy
Own Vercel project. Build command `npm run build`, output `dist`. Base path `/projects/namesake`.
Mounted under the brand via a rewrite in the dustincole_data repo (see below).

## Yearly refresh
`npm run data && npm run og && git commit -am "data: SSA <year>"` then push.
```

- [ ] **Step 2: Create the Vercel project**

Push the repo to GitHub; import as a new Vercel project. Settings: Framework = Astro, Build = `npm run build`, Output = `dist`. Deploy → note the preview URL `https://<namesake>.vercel.app`.

- [ ] **Step 3: Verify on the Vercel preview (the real routing environment)**

- `/<preview>/projects/namesake` → landing loads, search works.
- `/<preview>/projects/namesake/name/dustin` → prerendered story, OG meta present (view source), curve self-draws.
- `/<preview>/projects/namesake/name/<a-rare-real-name>` → **fallback rewrite** serves `_lookup`, client fetches the shard, renders the same story with the URL intact.
- `/<preview>/projects/namesake/name/zzzznotaname` → `_lookup` shows the "No record found" state.
- Paste a `/name/dustin` link into a social-card debugger → the OG image renders.

- [ ] **Step 4: Load/craft gate**

Run Lighthouse (mobile) on the preview name page. Confirm LCP well under the ~1s craft target (no web-font blocking beyond the single display TTF; SVG only). Re-check 375 / 768 / desktop — nothing overlaps. This is the final Impeccable pass against the mockup.

- [ ] **Step 5: Coordinate the main-site rewrite** (one-time, in the dustincole_data repo)

Add to that repo's `vercel.json` `rewrites` (do NOT edit it silently — this is the flagged coordination step; confirm with Dustin before pushing the main site):

```json
{ "source": "/projects/namesake/:path*", "destination": "https://<namesake>.vercel.app/projects/namesake/:path*" }
```

Redeploy the main site. Verify `https://dustincoledata.com/projects/namesake` and a name page both load through the brand domain, and OG absolute URLs (`https://dustincoledata.com/projects/namesake/og/<slug>.png`) resolve.

- [ ] **Step 6: Final commit + tag**

```bash
git add -A && git commit -m "docs: build/deploy/refresh runbook"
git tag v1.0.0
```

---

## Self-review (author checklist — completed at plan time)

**Spec coverage:**
- Type-your-name life story → Tasks 8–11 (payload, NameStory, pages). ✓
- Vital-Records look held to mockup → Task 1 tokens + Task 10 components + live gates in 10/12/14. ✓
- SVG self-drawing curve + peak callout → PopularityChart + chart-draw (Task 10). ✓
- 4 stat tiles (peak year/rank, skew, median age) → StatTiles (Task 10), stats/rank (Tasks 3–4). ✓
- Twins sparkline chips → twins (Task 6) + TwinChips (Task 10). ✓
- Explorer landing (ghosts/comebacks/unisex + hero search) → Task 12. ✓  Birth-year panel ("name of your birth year") → Task 12b (in MVP). ✓
- Per-name prerendered pages + real URLs + SEO → Task 11. ✓
- Build-time social share images + long-tail generic card → Task 13. ✓
- Long-tail instant client lookup → `_lookup` + lookup.ts + rewrite (Tasks 11, 14). ✓
- National SSA 1880–2024, static, ~1s, no runtime model → pipeline (Tasks 2–8) + load gate (Task 14). ✓
- Tests on rank math, twins, chart paths → Tasks 3,4,6,9. ✓

**Known deferrals (spec-aligned, in "MVP vs deferred"):** state map, compare mode, surnames — not in this plan. All four landing surfaces (ghosts/comebacks/unisex/birth-year) are in MVP.

**Placeholder scan:** no TBD/TODO/"handle edge cases" left; every code step carries real code. ✓

**Type consistency:** `NamePayload`, `TwinData`, `ExploreItem`, `shardKey`, `buildLinePath`, `slugify` names/signatures match across pipeline, lib, components. ✓
```