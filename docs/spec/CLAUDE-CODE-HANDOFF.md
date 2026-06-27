# Claude Code build brief — Læseudfordring

_Created June 27, 2026. This is the top-level handoff for rebuilding the app as a real,
deployable project. Read this first, then the two design specs (below)._

---

## 0. TL;DR for Claude Code

Build a **Danish kids' reading-challenge PWA** as a **Next.js static-export site**, styled
with **Tailwind**, **client-side `localStorage` only** (no server), deployed to **GitHub
Pages via GitHub Actions**.

The design and behavior are **already fully specified** in two existing files in this repo:

- **`HANDOFF.md`** — the app's requirements, screens, challenge lifecycle, settings lock,
  reading-log CRUD, quick-pick, data model + exact `localStorage` keys, copy, palette, fonts.
- **`MASKOT-HANDOFF.md`** — the mascot drawing system (parametric face renderer, stroke
  conventions, per-animal anchors, accessories, stage→expression mapping).

Treat those two as the **product + design spec**. This file (`CLAUDE-CODE-HANDOFF.md`)
adds the **stack, the mascot v1 decision, and the .dc.html reuse rules** that aren't in them.

---

## 1. How to treat the existing `.dc.html` files

The repo contains `Sommerlæsning.dc.html`, `Maskot-forslag.dc.html`, `App-ikon-forslag.dc.html`,
and `support.js`. These were authored in a design tool that uses a proprietary component format
("Design Components").

**Rules:**

- **They are a SPEC, not source to import.** Read them to understand layout, behavior, copy,
  colors, and the mascot renderer — then **rebuild** in Next.js + Tailwind + React.
- **Do NOT import or ship `support.js`.** It is the design tool's runtime and has no place in
  the real project. Delete it from your build; it is not a dependency.
- The `.dc.html` template/logic split (template markup + `class Component extends DCLogic` +
  `renderVals()`) is a tool convention. In your build:
  - The `renderVals()` logic → ordinary React component state/derived values/hooks.
  - The inline-styled template markup → JSX + Tailwind classes.
  - `this.props.xyz` "tweaks" (e.g. `accentColor`, `catColor`, `startGoal`, `demoState`) were
    design-time knobs. **`demoState` is a demo-only override — drop it.** `accentColor`/`catColor`
    can become constants (see palette in `HANDOFF.md`). `startGoal` → a default constant.
- **The mascot renderer is the one piece worth porting almost verbatim** — see §3.

---

## 2. Stack (LOCKED)

- **Next.js** (App Router), **`output: 'export'`** (static export — no SSR/API/middleware/server actions).
- **Tailwind** for styling. (The specs use inline styles with hardcoded hex; translate those into
  Tailwind utilities / a small theme — exact values are in `HANDOFF.md`.)
- **All state client-side in `localStorage`** — exactly the keys already specced. No backend.
- **PWA-installable** — manifest + service worker.
- **Hosting: GitHub Pages**, deployed by **GitHub Actions on push to `main`.**

### 2.1 GitHub Pages config — MUST get these right (they fail silently → blank page / 404s)

1. **`basePath` + `assetPrefix`** — A GH Pages *project* site serves from
   `https://<user>.github.io/<repo>/`, so set `basePath: '/<repo>'` and a matching `assetPrefix`,
   or every asset 404s. **Assume repo `reading-challenge` → `basePath: '/reading-challenge'`**
   unless told otherwise. **If a custom domain or a `<user>.github.io` user-page is used instead,
   leave both empty.** Confirm the actual repo/domain before the first deploy.
2. **`.nojekyll`** *(critical)* — GH Pages runs Jekyll, which ignores folders starting with `_`;
   Next emits `_next/`. Add an empty **`.nojekyll`** at the publish root or all JS/CSS 404s.
3. **`images: { unoptimized: true }`** — no optimizer on static export (app art is SVG anyway).
4. **`trailingSlash: true`** — routes resolve cleanly as static files.
5. **PWA scope** — service-worker `scope` and manifest `start_url`/`scope` must **include the
   basePath**, or the installed PWA opens blank. Same trap as #1, one level deeper.

### 2.2 Why static export (if you question it)

The app is `localStorage`-only → no server-knowable state, so SSR would render an empty shell
identical to static output. Static export is host-agnostic and is the only thing GH Pages can serve.

---

## 3. Mascot — v1 decision (RESOLVED)

**v1 ships TWO mascots the user chooses between: a cat OR a dog.** No other animals in v1.

- The choice is made on the **Indstillinger (Settings)** screen via a two-up picker (Kat / Hund),
  each showing a live preview face. The selection persists to **`sommerlaesning.v1.mascot`**
  (`'cat'` | `'dog'`, default **`'cat'`**). It drives the mascot shown on the Fremgang (Progress)
  screen, which evolves through the happiness stages as progress grows.
- **Source of truth = the parametric face renderer that now lives in `Sommerlæsning.dc.html`**
  (the logic class). The app no longer hard-draws the cat in markup — it uses the same
  `_faceEl(animal, stage, opts)` system documented in `MASKOT-HANDOFF.md`. **Port that renderer
  into a React component.** Entry points to carry over:
  - `_faceEl(animal, stage, {confetti, bob})` → composes `_base` → `_blush` (stage≥3) → `_eyes`
    → `_mouth` (or `_owlBeak` for owl) → `_acc` → `_confetti` (stage≥6) in a 150×162 box.
  - `_anchor(animal)`, `_base(b, animal)`, and the stroke helpers `_arc`/`_line`/`_svg` with the
    **`STROKE = 2.6` / `BROW = 4`** weights and round line-caps (see `MASKOT-HANDOFF.md` for the
    full convention — do **not** revert to border/border-radius line work; it was rejected).
  - Stage→expression mapping (0–7) and the **grin threshold = stage 5** are documented there.
- **Only `cat` and `dog` are exposed in v1.** The renderer also contains `owl`/`horse`/`fox`
  (from the earlier exploration in `Maskot-forslag.dc.html`). Leave that code if it's harmless,
  but **do not surface owl/horse/fox in the UI.** Keeping `animal` as a string makes adding them
  later trivial.
- These faces are `React.createElement` trees (not editable markup in the design tool — that
  caveat is tool-specific and irrelevant once ported). In your React app they're just a component.
- **`Maskot-forslag.dc.html`** is the original 5-animal exploration matrix — **reference only**,
  not shipped. The cat/dog versions in the actual app are the ones to match.

---

## 4. Data model — implement exactly (do NOT rename keys)

These are stable on purpose; renaming wipes a real kid's progress. From `HANDOFF.md` plus the
mascot key:

- `sommerlaesning.v1.entries` — JSON array of reading entries (`{id, title, author, date/created, minutes}`).
- `sommerlaesning.v1.goal` — target minutes (number as string).
- `sommerlaesning.v1.name` — mascot's display name (default `"Max"`).
- `sommerlaesning.v1.deadline` — ISO `YYYY-MM-DD` (may be empty).
- `sommerlaesning.v1.locked` — `'1'` locked / `'0'`/absent unlocked (parental lock).
- `sommerlaesning.v1.challenge` — `'none'` | `'ongoing'` | `'completed'`.
- `sommerlaesning.v1.mascot` — `'cat'` | `'dog'` (default `'cat'`).

The **migration logic** for `challenge` (absent → `ongoing` if entries/locked exist else `none`;
auto-`completed` if an ongoing goal is already met) is in `HANDOFF.md` → "Challenge lifecycle".
Reproduce it so existing localStorage data keeps working. Note `localStorage` is only available
client-side — gate reads in an effect / `'use client'` component so static export doesn't choke.

---

## 5. Naming

- The app's **Danish display name** is **"Læseudfordring"** (year-round, not "Sommerlæsning"; the
  old `.dc.html` filename is legacy).
- The **repo / Next project / package slug** is **`reading-challenge`** (English, locale-neutral) —
  chosen so an **English version can be added later** without renaming the repo. Keep code, file,
  and identifier names in **English**; keep user-facing copy in **Danish** for v1. Structure copy so
  a future locale (English) can be swapped in (e.g. a strings module), but **do not build i18n in
  v1** unless asked — just don't hardcode Danish in ways that fight a later extraction.
- The PWA manifest `name`/`short_name` shown to users = **"Læseudfordring"**.

---

## 6. Assets

- **`app-icon.svg`** — the intended app icon. Use it as the source for the PWA icon set
  (generate the PNG sizes the manifest needs: 192, 512, maskable, apple-touch-icon).
  `App-ikon-forslag.dc.html` is the exploration that produced it (reference only).
- Fonts: **Baloo 2** (display) + **Nunito** (body) — load via `next/font/google` or self-host.
- Palette (full values in `HANDOFF.md`): accent `#F6A623`, cat `#F4A35C`, background `#FFF6E9`,
  plus the goal-difficulty greens/ambers/corals and the flash/badge colors documented there.

---

## 7. Build order (suggested)

1. Scaffold Next.js (App Router) + Tailwind + the static-export/GH-Pages config in §2.1 (do this
   first — verify a hello-world deploys to Pages before building features; the basePath/`.nojekyll`
   traps are easier to catch on an empty app).
2. Port the data layer (§4) into a small typed `localStorage` module with the migration.
3. Build the 3 tabs + bottom nav (Fremgang / Læselog / Indstillinger) per `HANDOFF.md`.
4. Port the mascot renderer (§3) as a React component; wire the cat/dog picker + progress face.
5. Add the challenge lifecycle, parental lock, quick-pick, inline edit/flash (all in `HANDOFF.md`).
6. PWA: manifest + service worker with basePath-correct scope; generate icons from `app-icon.svg`.
7. GitHub Actions workflow: build → export → publish `out/` (with `.nojekyll`) to Pages.

---

## 8. Out of scope for v1 (don't build unless asked)

Owl/horse/fox mascots in the UI; reset-progress button; streaks/weekly goals/reward shelf;
pace hints from the deadline. These are noted as future ideas in `HANDOFF.md`.
