# Namesake — Design Spec

**Date:** 2026-07-22
**Status:** Brainstorming complete. Concept, experience spine, visual direction, share strategy, and scope are LOCKED and user-approved. NOT yet implemented (greenfield — no code exists). Next: user reviews this spec → `writing-plans` → build.

---

## What it is

A free, static, genuinely gorgeous interactive **"map of American names."** Type any name → its ~145-year life story (rise, peak, fall) rendered as a beautiful vital-records-style chart; plus an explorer of name trends. Serious data-journalism craft on fun, universal data.

Purpose: the **flagship data toy for dustincoledata** — simultaneously a shareable brand piece AND a portfolio proof-point for data roles (proves Dustin can source data, engineer it, design it, and ship a polished product end-to-end).

This project is the deliberate correction to a prior failed toy (Latent): **design-first, gorgeous + instant, no heavy runtime.** See memory `design-first-on-visual-projects`.

---

## Locked decisions (all user-approved this session)

- **Concept:** Namesake — US baby names. (Chosen over two alternatives: "Six Degrees" movie shortest-path, and a music-charts "Time Machine".)
- **Experience spine:** **Combo** — an explorer landing that pulls you in, with the personal **"type your name"** name-story as the shareable centerpiece.
- **Audience:** **Both** — flagship bar: must be gorgeous AND technically credible.
- **Visual direction:** **A · "Vital Records"** (light). Editorial serif display for the giant name; an ink-blue plotted popularity curve on faint ledger lines; warm manila ground (pushed greyer than the cream cliché); a small rotated "records stamp"; monospace utility labels; italic serif caption. Approved from a 2-direction look-study (the other was a dark "Nightfall" luminous treatment — rejected).
  - **Approved mockup (THE craft bar to hold everything to):**
    - Live artifact: https://claude.ai/code/artifact/d36dab7d-9df9-4dd9-81bd-e382c8d14d0f
    - Local reference copy: `./namesake-look-reference.html` (has both directions; **Direction A** `section#a` is the approved one). Shown with "Dustin", illustrative data.
- **Share strategy:** **Full** — prerendered per-name pages (e.g. `/name/dustin`) with real URLs + SEO + **build-time social share images**; rare/long-tail names fall back to an instant client-side lookup.
- **Data scope:** **National only** (SSA, 1880–2024). A state-by-state geography map is deferred to v2.

## Hard constraints
- Static + free at runtime; **loads in ~1s**; **no heavy runtime / no in-browser model** (the explicit anti-Latent).
- **SVG charts** (vector → razor-sharp on any screen; fixes the half-res blur that helped kill Latent).
- Design-first: hold every screen to the approved mockup's bar; **verify the look live in the browser as we build**, not only at the end. Nothing overlaps at 375 / 768 / desktop.

---

## Data

- **Source:** SSA baby names, national, 1880–2024 (yearly `name × sex × count`). Free, public, canonical, clean.
- **Offline build step** (pure data crunch — NO model, so unlike Latent it runs fine on the laptop, no Colab):
  - Per name: yearly counts + share-of-births, yearly rank, peak year, peak rank, total births, gender split, median birth-year / "median age today", inputs for the one-line era caption.
  - **"Twins"** (the engineering flex): nearest-trajectory names — normalize each name's yearly share to a shape vector, compute similarity (cosine on normalized vectors, or a DTW-lite) among names above a popularity threshold, store the top ~5 per name. Fully precomputed; no runtime cost.
  - **Explorer aggregates:** biggest comebacks, fastest risers/fallers, "ghosts" (huge-then-vanished), most-unisex / gender-crossing names, name-of-the-year per year/decade.
- **Output:** compact static JSON. Keep each name's payload tiny for instant loads. Exact sharding (per-name files vs grouped shards + index) to be decided in the implementation plan.

---

## Surfaces

### Explorer landing
- **Hero:** the "type your name" search (autocomplete over the name index).
- **3–4 pull-in panels**, each a small gorgeous viz + example names that click into the name-story:
  - **Ghosts** — vanished giants (Bertha, Mildred, Gertrude).
  - **Comebacks** — roaring back (Hazel, Ezra, Ada).
  - **The unisex line** — names crossing the gender divide over time.
  - **Name of your birth year** — enter a year → its defining names.
- All in the Vital-Records look.

### Name story (per name) — exactly the approved mockup
Giant name · one-line era caption · self-drawing SVG popularity curve with the peak called out · 4 stat tiles (peak year, peak rank, gender skew, median age today) · "names that rose & fell alongside it" sparkline chips · search to try another name. Own URL + build-time share card.

---

## Architecture

- **Build:** a data pipeline (Python or Node) over the SSA files → JSON artifacts + twins + explorer aggregates. Runs on the laptop (no model → no Colab).
- **Frontend:** static site with **per-name prerendered pages**. Recommended stack: **Astro** (static + islands; excellent per-name SEO/URLs/OG; Dustin already uses Astro for dustincole_data). Prerender the top ~N names (covers virtually every real search); client-fetch for the long tail. Final stack to confirm in the plan. **SVG** charts + light JS for the self-draw animation and search. TS + a test setup for the pure data/layout logic (cheap, high-value units: rank math, twins similarity, chart path building).
- **Share/OG:** build-time social image per prerendered name (satori/resvg or a headless render) → static PNG; generic card for the long tail.
- **Rendering:** SVG (crisp everywhere), self-drawing curve via `stroke-dashoffset`, respect `prefers-reduced-motion`. Canvas/WebGL only if a specific viz truly needs it (default: no).

---

## MVP vs deferred
- **MVP:** national data; name-story + explorer (4 panels); per-name pages + share cards; search.
- **Deferred (v2+):** state geography map; more "worlds" (surnames, global names); a head-to-head compare mode; extra flourish.

---

## Success criteria
- Loads ~1s; charts crisp at any resolution; nothing overlaps at 375 / 768 / desktop.
- Type your name → a correct, beautiful life story, instantly.
- Explorer panels are genuinely gorgeous and pull you in.
- A pasted name link shows a great social share card.
- Reads as BOTH "wow, beautiful/shareable" AND "this person can really do data."
- Held to the approved mockup's craft bar throughout; look verified live in-browser during the build, not at the end.

## Process notes for the build
- **Design-first:** keep the mockup reference open; verify visual output live in the browser at each step.
- Use **Impeccable** (visual craft) + **Intent** (UX) during the build per Dustin's global routing.
- Then subagent-driven / plan execution once the implementation plan exists.
