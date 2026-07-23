# Namesake

A free, static "map of American names." Type any name → its ~145-year life story
(rise, peak, fall) as a Vital-Records-style SVG chart, plus a trends explorer.
Data: SSA national baby names, 1880–2024. The flagship data toy for dustincoledata.

Lives at **dustincoledata.com/projects/namesake**.

## Stack
Astro 5 (static, `base: /projects/namesake`) · TypeScript · Vitest · SVG charts ·
satori + @resvg/resvg-js for build-time share cards. No in-browser model; ~1s load.

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Local dev server (Astro). Use this for local iteration. |
| `npm run data` | Download SSA + generate `public/data/*` (shards, index, explore aggregates). Gitignored output. Run yearly when SSA updates. |
| `npm run og` | Generate `public/og/*.png` share cards (top ~2000 names + `_default`). Gitignored output. |
| `npm run build` | `astro build` → `dist/projects/namesake/…` |
| `npm test` | Vitest (pipeline logic + chart/format). |

`public/data/` (~66MB) and `public/og/` (~70MB) are **gitignored and CI-generated**
(too large for git). The Vercel build command regenerates them (`vercel.json` →
`npm run data && npm run og && npm run build`).

> **Local preview note:** `astro preview` does **not** work here — `outDir` is nested
> under the base (`dist/projects/namesake`) so the physical file layout matches the
> deploy URLs, which double-prefixes `astro preview`. Use `npm run dev` for local work.
> To simulate the production static serve, serve `dist/` with any raw static server
> and hit `/projects/namesake/…`.

## Deploy (own Vercel project + a one-time main-site rewrite)

Namesake is its own Vercel project, mounted under the brand domain by a rewrite on
the dustincole_data site.

**1. Namesake Vercel project**
- Push this repo to GitHub; import as a new Vercel project.
- Build/output are already codified in `vercel.json` (`buildCommand`, `outputDirectory: dist`).
- **Set the project's Node.js version to 22.x** (the pipeline runs `.ts` via
  `node --experimental-strip-types`, which needs Node ≥22.6).
- First build downloads SSA + generates data + 2000 OG cards + 5000 pages (~4–5 min).

**2. One-time rewrite on the dustincole_data repo** (needs review — it's the production brand site)
Add to that repo's `vercel.json` `rewrites`:
```json
{ "source": "/projects/namesake/:path*", "destination": "https://<namesake-deploy>.vercel.app/projects/namesake/:path*" }
```
Redeploy the main site. This proxies `/projects/namesake/*` 1:1 to the Namesake
deployment (paths already carry the `/projects/namesake` prefix on both sides).

**3. Verify on the live domain**
- `/projects/namesake` (landing, search autocomplete)
- `/projects/namesake/name/dustin` (prerendered, OG meta present, curve self-draws)
- `/projects/namesake/name/<a-rare-real-name>` (long-tail fallback renders the full story)
- `/projects/namesake/name/zzzznotaname` ("No record found")
- OG: `/projects/namesake/og/dustin.png` resolves; paste a name link into a social-card debugger.

## Yearly refresh
When SSA publishes a new year (and after bumping `END_YEAR` in `src/lib/types.ts` if
extending the range): `npm run data && npm run og`, commit nothing (gitignored) — the
next Vercel deploy regenerates from source. Redeploy.
