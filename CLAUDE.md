# Læseudfordring — working notes for Claude

@AGENTS.md

This is a Danish kids' reading-challenge **PWA**, rebuilt from the Claude Design prototype
`Sommerlæsning.dc.html`. The full product + design spec lives in [`docs/spec/`](docs/spec) —
treat those handoffs as the source of truth for behaviour, copy, and the mascot geometry.

## Architecture (the big picture)

**One static page, no router, no server.** `app/page.tsx` mounts `<AppProvider>` → `<AppShell>`;
the visible screen (Progress / Log / Settings) is just `state.screen` switched in `AppShell.tsx`
— there are no Next routes and no data fetching. Everything runs client-side off `localStorage`.

Data flows one way through four `lib/` layers — keep logic in the layer it belongs to:

- `types.ts` — the shared contract (`PersistedState`, `Entry`, `ChallengeStatus`, `Stage`).
- `storage.ts` — the `localStorage` layer, **SSR-safe** (no `window` → returns `DEFAULTS`, writes
  are no-ops). Owns the seven `sommerlaesning.v1.*` keys and the `loadState()` migration.
- `joy.ts` — pure progress math (`pctFor`, `joyForPct`, `ringOffset`, `deadlineInfo`); no React/DOM.
- `store.tsx` — the reducer **+ `computeDerived()`** (the prototype's `renderVals()`), exposed via
  `useApp()` as `{ state, derived, actions }`. Screens read `derived` / call `actions`, nothing more.

**This is a faithful port of the single-file prototype** (`docs/spec/Sommerlæsning.dc.html`) —
when changing behaviour, check it first, it's the spec. The mapping: `renderVals()` →
`computeDerived()`, `_joy()` → `joyForPct()`, `_saveEntry`'s id scheme → `newId()`,
`componentDidMount`'s status fixup → `migrate()`.

Two cross-file invariants that are easy to break:

- **Hydration gating.** The provider first renders with SSR `DEFAULTS`, then `HYDRATE`s from
  `localStorage` once on the client. Every persistence `useEffect` is guarded by `state.hydrated`
  so the first paint never overwrites real saved data with defaults. New persisted slice → same guard.
- **Challenge lifecycle.** `none → ongoing → completed` drives the mascot and most derived values.
  It **auto-completes** when logged minutes reach the goal (in `SAVE_ENTRY`, `UPDATE_CHALLENGE`,
  and `migrate()`), and "Start en ny udfordring" **wipes the log and resets config to defaults**
  (confirm-gated; minutes do *not* carry over). An ongoing challenge is **locked by default**;
  unlocking is a transient `editing` session (UI-only, re-locks on commit/navigation/refresh) —
  there is no persisted lock toggle.

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

## Commands

```bash
npm run dev        # next dev at http://localhost:3000/reading-challenge/ (basePath applies in dev)
npm run build      # static export → ./out, then postbuild injects the SW precache list + build id
npm run serve      # serve ./out under the basePath at :4399 (what Playwright + Pages actually hit)
node scripts/gen-icons.mjs   # regenerate public/icons/* + apple-icon from app/icon.svg after edits
```

## Verify before claiming done

```bash
npx tsc --noEmit && npx eslint .   # must be clean
npm run build                      # static export + postbuild SW injection
npm run test:e2e                   # Playwright (build first); also gates CI
```

`test:e2e` does **not** build — it runs against `./out`, so `npm run build` first or you're testing
a stale export. Single test: `npx playwright test -g "auto-completes"` (or pass a file path). CI
(`.github/workflows/deploy.yml`) runs build → e2e → Pages deploy, so a red suite blocks the deploy.
