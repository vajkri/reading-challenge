# Læseudfordring — working notes for Claude

@AGENTS.md

This is a Danish kids' reading-challenge **PWA**, rebuilt from the Claude Design prototype
`Sommerlæsning.dc.html`. The full product + design spec lives in [`docs/spec/`](docs/spec) —
treat those handoffs as the source of truth for behaviour, copy, and the mascot geometry.

## Hard rules

- **No hardcoded user-facing Danish.** Every string comes from `copy/da.json` via `@/lib/copy`
  (`copy`, `interp`, `DATE_LOCALE`). The app is single-locale today but structured so a second
  language is a drop-in `copy/<lang>.json` + a `dicts` entry. Don't reintroduce literals in JSX.
- **Never rename the `localStorage` keys** (`sommerlaesning.v1.*` in `lib/storage.ts`) — it wipes a
  real child's progress. The challenge-status migration in `loadState()` must keep working.
- **The mascot renderer (`components/MascotFace.tsx`) is a faithful port** of the prototype's
  parametric face system (`STROKE=2.6`, `BROW=4`, the 8-stage ramp). Keep it pure; tweak geometry
  here, not in markup. cat + dog are surfaced; owl/horse/fox stay in the code, unused.
- **GitHub Pages config is load-bearing** (`next.config.ts` + `public/.nojekyll` + `public/sw.js`):
  `basePath`/`assetPrefix` = `/reading-challenge`, `trailingSlash`, `images.unoptimized`, and the
  SW scope + manifest `start_url`/`scope` all include the basePath. Breaking any of these blanks
  the deployed site or the installed PWA. The `postbuild` step (`scripts/inject-sw-assets.mjs`)
  injects the precache list + build id into `out/sw.js` — keep it wired.
- **State lives in one place:** `lib/store.tsx` is the reducer + all derived values (the prototype's
  `renderVals()`). Screens are presentational — read `derived`, call `actions`.

## Verify before claiming done

```bash
npx tsc --noEmit && npx eslint .   # must be clean
npm run build                      # static export + postbuild SW injection
npm run test:e2e                   # Playwright (build first); also gates CI
```
