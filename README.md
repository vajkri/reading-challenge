# Læseudfordring 📚

A small, playful **reading-challenge PWA** (in Danish) that motivates a 7–9-year-old to read.
A big progress ring and a chosen mascot — a **cat or a dog** — get happier as the minutes add up,
backed by a full reading log. Everything is stored on the device; there is no account and no server.

**Live:** https://vajkri.github.io/reading-challenge/

> Rebuilt from a Claude Design prototype (`Sommerlæsning.dc.html`) into a real, deployable app.
> The original design + product spec lives in [`docs/spec/`](docs/spec).

## What it does

- **Fremgang (Progress)** — a circular progress ring with the live percentage, the evolving mascot
  (8 happiness stages: sad → party hat → bowtie → crown), an encouraging caption, and a deadline
  countdown chip. Handles three challenge states: *none / ongoing / completed*.
- **Læselog (Reading log)** — add / edit / delete readings (title, author, date, minutes), newest
  first, with a "continue a book" quick-pick row so the kid only types the minutes.
- **Indstillinger (Settings)** — pick the mascot, name it, set the goal (300 / 450 / 600 or custom)
  and a deadline. A **parental lock** (a small arithmetic gate) keeps the kid from changing things.

## Tech stack

| | |
|---|---|
| Framework | **Next.js 16** (App Router), **`output: 'export'`** (fully static) |
| UI | **React 19** + **TypeScript** + **Tailwind v4** (CSS-first `@theme`) |
| State | **`localStorage` only** — no backend, no API |
| PWA | web manifest + a hand-rolled service worker (offline-capable, installable) |
| Fonts | Baloo 2 (display) + Nunito (body) via `next/font/google` |
| Hosting | **GitHub Pages** (project site), deployed by **GitHub Actions** on push to `main` |
| Tests | **Playwright** e2e against the real static export, run in CI before deploy |

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000/reading-challenge/  (basePath applies in dev too)
```

```bash
npm run build    # static export → ./out  (postbuild injects the SW precache manifest)
npm run serve    # serve ./out under the basePath at http://localhost:4399/reading-challenge/
npm run test:e2e # Playwright behavioural suite (builds nothing — run `build` first)
npm run lint
```

## Project structure

```
app/            layout (fonts, metadata), page (mounts the app), globals.css (@theme + keyframes),
                manifest.ts, icon.svg / apple-icon.png
components/     AppShell, BottomNav, MascotFace (parametric renderer), ProgressScreen,
                LogScreen + EntryForm + QuickPickRow, SettingsScreen + UnlockModal
lib/            store.tsx (reducer + derived values), storage.ts (localStorage + migration),
                copy.ts (typed accessor), joy.ts (progress math), types.ts, config.ts (basePath)
copy/da.json    ALL user-facing Danish text (i18n-ready — see below)
public/         sw.js, .nojekyll, icons/
scripts/        gen-icons.mjs, serve-out.mjs, inject-sw-assets.mjs (postbuild)
e2e/            Playwright specs
docs/spec/      the original design handoffs, prototype files, and screenshots
```

## Conventions worth knowing

- **All copy comes from `copy/da.json`** via `lib/copy.ts` — components never hardcode Danish.
  Adding a language is drop-in: create `copy/en.json` with the same shape, add it to the `dicts`
  map, and switch `LOCALE`. (Date formatting uses `DATE_LOCALE` from the same module.)
- **`localStorage` keys are frozen** (`sommerlaesning.v1.*`) — renaming any of them wipes a real
  kid's saved progress. A one-time migration upgrades pre-challenge data on load.
- **The mascot** is a parametric SVG/div renderer (`MascotFace`) ported near-verbatim from the
  prototype; cat + dog are surfaced in v1 (owl/horse/fox exist in the renderer for later).
- **GitHub Pages traps** (already handled, do not regress): `basePath`/`assetPrefix` =
  `/reading-challenge`, `public/.nojekyll`, `images: { unoptimized: true }`, `trailingSlash: true`,
  and a service-worker scope + manifest `start_url`/`scope` that include the basePath.

## Deployment

Push to `main` → GitHub Actions builds the static export, runs the Playwright e2e suite, and
(only if green) publishes `out/` to GitHub Pages. Hosting config is in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
