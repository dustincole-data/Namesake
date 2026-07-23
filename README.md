# Namesake

A free, static "map of American names." Type any name → its ~145-year life story
(rise, peak, fall) as a Vital-Records-style SVG chart, plus a trends explorer.
Data: SSA national baby names, 1880–2024. The flagship data toy for dustincoledata.

Lives at **namesake.dustincoledata.com** (its own standalone Vercel project — fully
decoupled from the main dustincoledata site, not proxied through it).

## Stack
Astro 5 (static, served at root — `base: '/'`) · TypeScript · Vitest · SVG charts ·
satori + @resvg/resvg-js for build-time share cards. No in-browser model; ~1s load.

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Local dev server (Astro). Use this for local iteration. |
| `npm run data` | Download SSA + generate `public/data/*` (shards, index, explore aggregates). Gitignored output. Run yearly when SSA updates. |
| `npm run og` | Generate `public/og/*.png` share cards (top ~5000 names + `_default`). Gitignored output. |
| `npm run build` | `astro build` → `dist/…` |
| `npm test` | Vitest (pipeline logic + chart/format). |

`public/data/` (~66MB) and `public/og/` (~70MB) are **gitignored and CI-generated**
(too large for git). The Vercel build command regenerates them (`vercel.json` →
`npm run data && npm run og && npm run build`).

> **Local preview:** both `npm run dev` and `astro preview` work (base is `/`, output
> is the default `dist/`). Use `npm run dev` for iteration; `astro preview` to sanity-check
> a production build of `dist/`.

## Deploy (standalone Vercel project)

Namesake is its own Vercel project served at its own subdomain — no rewrite/proxy on
the main site. It is 100% static, so it uses ~zero runtime (fluid) compute.

**1. Namesake Vercel project**
- Push this repo to GitHub; import as a **new** Vercel project.
- Build/output are already codified in `vercel.json` (`buildCommand`, `outputDirectory: dist`).
- **Set the project's Node.js version to 22.x** (the pipeline runs `.ts` via
  `node --experimental-strip-types`, which needs Node ≥22.6).
- First build downloads SSA + generates data + ~5000 OG cards + 5000 pages (~5–12 min).

**2. Attach the subdomain**
- In the Namesake project → Settings → Domains, add `namesake.dustincoledata.com`.
- Vercel shows a `CNAME` target (`cname.vercel-dns.com`). Add that CNAME record for
  `namesake` at the dustincoledata.com DNS provider. Independent of the main site's
  DNS/project — no coupling.

**3. Verify on the live domain**
- `/` (landing, search autocomplete)
- `/name/dustin` (prerendered, OG meta present, curve self-draws)
- `/name/<a-rare-real-name>` (long-tail fallback via the `vercel.json` rewrite → `lookup`)
- `/name/zzzznotaname` ("No record found")
- OG: `/og/dustin.png` resolves; paste a name link into a social-card debugger.

## Yearly refresh
When SSA publishes a new year (and after bumping `END_YEAR` in `src/lib/types.ts` if
extending the range): `npm run data && npm run og`, commit nothing (gitignored) — the
next Vercel deploy regenerates from source. Redeploy.
