# laesemakker.dk Domain Cutover Implementation Plan (PR 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the app from the GitHub Pages project URL `https://vajkri.github.io/reading-challenge/` to the apex custom domain `https://laesemakker.dk/`, served from the root path instead of a `/reading-challenge` prefix.

**Architecture:** A GitHub Pages *project* site forces every URL under `/reading-challenge`. A custom apex domain serves from `/`, so the base path must become empty in all nine places it is currently hardcoded. Two of those places (`public/sw.js`, `scripts/inject-sw-assets.mjs`) cannot read env vars — `sw.js` is not processed by the bundler and the postbuild script rewrites the built copy — so they carry their own literal and must be edited by hand.

**Tech Stack:** Next.js 16 static export, GitHub Pages via Actions, Playwright, GA4.

**Spec:** [`docs/superpowers/specs/2026-08-09-laesemakker-rebrand-and-domain-design.md`](../specs/2026-08-09-laesemakker-rebrand-and-domain-design.md)

---

## ⚠️ Prerequisites — do not start Task 1 until both are true

1. **PR 1 (rebrand) is merged.** This plan assumes the brand is already "Læsemakker".
2. **DNS for `laesemakker.dk` resolves.** Merging this PR before DNS is live breaks the
   site at *both* URLs simultaneously. See Task 0.

## ⚠️ Accepted consequences (decided in the spec — not bugs, do not "fix" them)

- Every existing user's progress resets to zero. `localStorage` does not cross origins.
- The old service worker keeps serving a cached ghost app **offline, indefinitely** —
  it can never be updated again once the old origin stops serving content.
- Installed PWAs point at a dead `start_url` and must be re-added from the new domain.

---

## File Structure

| File | Line | Responsibility | Change |
|---|---|---|---|
| `next.config.ts` | 7 | Next build config | drop `basePath` + `assetPrefix` |
| `public/sw.js` | 10 | offline SW, unbundled | `BASE = ""` |
| `scripts/inject-sw-assets.mjs` | 14 | postbuild precache injection | `BASE = ""` |
| `playwright.config.ts` | 7 | e2e base URL | `BASE = ""` |
| `scripts/serve-out.mjs` | 10 | local static server | `PREFIX = ""` |
| `scripts/verify-states.mjs` | 6 | screenshot helper | default URL |
| `components/Analytics.tsx` | 6 | GA4 host allowlist | `PAGES_HOST` |
| `public/CNAME` | new | Pages custom domain | create |
| `CLAUDE.md` | — | project instructions | update Pages section |
| `README.md` | 7, 38, 43, 74 | public-facing readme | live URL + dev/serve URLs |

`app/manifest.ts` and `components/ServiceWorkerRegister.tsx` need **no edit** — both
derive their paths from `BASE_PATH` (`lib/config.ts:3`), which becomes `""` automatically.

---

### Task 0: DNS (manual — human, not agent)

**Files:** none. This is registrar work and must be done by the repo owner.

- [ ] **Step 1: Get the current GitHub Pages IP addresses**

Open GitHub's Pages apex-domain documentation and copy the four `A` record IPv4
addresses and four `AAAA` IPv6 addresses. **Do not use addresses remembered from
elsewhere or copied from an older document** — GitHub changes them rarely, but it does
change them, and a stale address means an unreachable site.

- [ ] **Step 2: Create the records at the registrar**

- Four `A` records on the apex `laesemakker.dk` → the four IPv4 addresses.
- Four `AAAA` records on the apex → the four IPv6 addresses.
- One `CNAME` on `www` → `vajkri.github.io`, so `www.laesemakker.dk` redirects to the
  apex rather than failing.

- [ ] **Step 3: Confirm propagation**

Run:
```bash
dig laesemakker.dk +short
dig www.laesemakker.dk +short
```

Expected: the apex returns the four GitHub IPv4 addresses; `www` returns
`vajkri.github.io` followed by GitHub's addresses. Do not proceed until both resolve.

---

### Task 1: Pin the root-served behaviour with a failing test

Before changing any config, make the e2e suite demand root-serving. The suite's
`baseURL` currently carries the prefix, so this test fails until Task 2 lands.

**Files:**
- Modify: `e2e/shell.spec.ts` (append at end of file)

`e2e/shell.spec.ts` holds app-shell-level assertions — branding, document metadata, the
manifest. A root-path assertion belongs there, not in `e2e/app.spec.ts`, which covers
screen behaviour and is already near the ~300-line guideline.

- [ ] **Step 1: Write the failing test**

Append to `e2e/shell.spec.ts`:

```ts
test("app is served from the root path, not a project subpath", async ({ page }) => {
  await page.goto("./");
  expect(new URL(page.url()).pathname).toBe("/");

  const manifest = await page.evaluate(async () => {
    const res = await fetch("/manifest.webmanifest");
    return res.json() as Promise<{ start_url: string; scope: string }>;
  });
  expect(manifest.start_url).toBe("/");
  expect(manifest.scope).toBe("/");
});
```

- [ ] **Step 2: Build, then run the test to verify it fails**

Run:
```bash
npm run build && npx playwright test -g "served from the root path"
```

Expected: **FAIL** on the first assertion — `pathname` is `/reading-challenge/`, not `/`.

(The `fetch` itself will succeed even before the change, because `out/manifest.webmanifest`
sits at the export root regardless of `basePath` and `serve-out.mjs` only strips the prefix
when the request actually starts with it. The manifest assertions fail on their *values*:
`start_url` and `scope` are `/reading-challenge/`.)

- [ ] **Step 3: Commit the failing test**

```bash
git add e2e/shell.spec.ts
git commit -m "test(#32): assert the app is served from the root path"
```

---

### Task 2: Empty the base path in the build config

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Rewrite the config**

Replace the whole of `next.config.ts` with:

```ts
import type { NextConfig } from "next";

// Served from the apex custom domain https://laesemakker.dk/, so the app lives at
// the root path — no basePath/assetPrefix. NEXT_PUBLIC_BASE_PATH stays defined (as
// an empty string) because lib/config.ts and the manifest read it; keeping the key
// makes the "root-served" choice explicit rather than incidental.
const basePath = "";

const nextConfig: NextConfig = {
  output: "export", // static export → ./out (no server; localStorage-only app)
  trailingSlash: true, // routes resolve cleanly as static files on Pages
  images: { unoptimized: true }, // no image optimizer on static export (art is SVG)
  env: { NEXT_PUBLIC_BASE_PATH: basePath }, // expose to client (SW + manifest paths)
};

export default nextConfig;
```

Note `basePath` and `assetPrefix` are **removed as keys**, not set to `""`. `output`,
`trailingSlash`, and `images.unoptimized` must all stay — they are load-bearing for the
static export.

- [ ] **Step 2: Verify the manifest is now root-scoped**

Run:
```bash
npm run build && cat out/manifest.webmanifest
```

Expected: `"start_url":"/"`, `"scope":"/"`, and icon `src` values beginning `/icons/`
with no `/reading-challenge` anywhere.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat(#32): serve from the root path instead of /reading-challenge"
```

---

### Task 3: Empty the base path in the two unbundled files

`public/sw.js` is shipped verbatim (never bundled) and `scripts/inject-sw-assets.mjs`
rewrites the built copy, so neither can read `NEXT_PUBLIC_BASE_PATH`. Both carry their
own literal.

**Files:**
- Modify: `public/sw.js:8-10`
- Modify: `scripts/inject-sw-assets.mjs:14`

- [ ] **Step 1: Update the service worker**

In `public/sw.js`, replace the `BASE` declaration and its comment:

```js
// BASE is empty because the app is served from the root of laesemakker.dk. This
// file lives in public/ and is NOT processed by the bundler, so it cannot read
// env vars — the value is duplicated from next.config.ts by hand.
const BASE = "";
```

Leave `APP_SHELL` and `PRECACHE` as they are — `` `${BASE}/` `` correctly yields `/`.

- [ ] **Step 2: Update the postbuild injector**

In `scripts/inject-sw-assets.mjs`, change line 14:

```js
const BASE = "";
```

`toUrl()` builds `` `${BASE}/${rel}` ``, which now yields `/_next/...` — one leading
slash, correct.

- [ ] **Step 3: Verify the built SW is root-scoped**

Run:
```bash
npm run build
grep -c "reading-challenge" out/sw.js
```

Expected: `0`.

Then confirm the app shell and precache list look right:
```bash
grep -o 'const PRECACHE_ASSETS = \[[^]]\{0,120\}' out/sw.js
```

Expected: entries starting `"/_next/...` — with exactly one leading slash, no `//`.

- [ ] **Step 4: Commit**

```bash
git add public/sw.js scripts/inject-sw-assets.mjs
git commit -m "feat(#32): root-scope the service worker and its precache list"
```

---

### Task 4: Update the local tooling paths

These three are dev/test-only, but a stale prefix here means the e2e suite tests a URL
shape that no longer matches production.

**Files:**
- Modify: `playwright.config.ts:3-7`
- Modify: `scripts/serve-out.mjs:10`
- Modify: `scripts/verify-states.mjs:6`

- [ ] **Step 1: Update the Playwright base URL**

In `playwright.config.ts`, update the comment and constant:

```ts
// Tests run against the real static export (./out) served from the root, so they
// catch the same asset-resolution issues GitHub Pages would. Build first
// (`npm run build`), then `npm run test:e2e`.
const PORT = 4399;
const BASE = "";
```

Leave `baseURL` and `webServer.url` as they are — `` `http://localhost:${PORT}${BASE}/` ``
now yields `http://localhost:4399/`.

- [ ] **Step 2: Update the static server**

In `scripts/serve-out.mjs`, change line 10:

```js
const PREFIX = "";
```

No other change is needed. `p.startsWith("")` is always `true` and `p.slice(0)` returns
`p` unchanged, so the strip step becomes a harmless no-op.

- [ ] **Step 3: Update the screenshot helper default**

In `scripts/verify-states.mjs`, change line 6:

```js
const BASE = process.argv[3] || "http://localhost:3000/";
```

- [ ] **Step 4: Verify the suite runs green at the root**

Run:
```bash
npm run build && npm run test:e2e
```

Expected: all tests pass, **including** the root-path test from Task 1, which should now
go green.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts scripts/serve-out.mjs scripts/verify-states.mjs
git commit -m "test(#32): point local tooling at the root path"
```

---

### Task 5: Repoint GA4 at the new host

**This is the trap in this PR.** `PAGES_HOST` is an *allowlist* — any unknown host
defaults to OFF, deliberately, so a forgotten host cannot pollute production analytics.
Miss this and GA4 goes completely dark on the new domain with no error anywhere.

**Files:**
- Modify: `components/Analytics.tsx:5-6`

- [ ] **Step 1: Change the host and its comment**

In `components/Analytics.tsx`, replace lines 5-6:

```tsx
// The deployed production host. GA4 fires ONLY here.
const PAGES_HOST = "laesemakker.dk";
```

Also update the parenthetical on line 13 so it stays true:

```tsx
// excluded. (If the site ever moves hosts again, update PAGES_HOST.)
```

Use the apex only. `www.laesemakker.dk` redirects to the apex and never renders the app,
so it does not need an entry.

- [ ] **Step 2: Verify the gate compiles into the export with the new host**

Run:
```bash
npm run build && grep -o "location.hostname !== '[^']*'" out/index.html
```

Expected: `location.hostname !== 'laesemakker.dk'`.

- [ ] **Step 3: Confirm the localhost guard still holds**

The existing analytics spec asserts `gtag` is undefined off-host. Run:
```bash
npx playwright test e2e/analytics.spec.ts
```

Expected: PASS. (It passes because `localhost` is not `laesemakker.dk` — the same
allowlist logic, new value.)

- [ ] **Step 4: Commit**

```bash
git add components/Analytics.tsx
git commit -m "fix(#32): point the GA4 host allowlist at laesemakker.dk"
```

---

### Task 6: Add the CNAME file

**Files:**
- Create: `public/CNAME`

- [ ] **Step 1: Create the file**

`public/CNAME` — a single line, no protocol, no trailing slash, with a trailing newline:

```
laesemakker.dk
```

- [ ] **Step 2: Verify it reaches the export**

Everything in `public/` is copied to `out/` by the static export.

Run:
```bash
npm run build && cat out/CNAME
```

Expected: `laesemakker.dk`.

- [ ] **Step 3: Commit**

```bash
git add public/CNAME
git commit -m "feat(#32): add CNAME for laesemakker.dk"
```

---

### Task 7: Update CLAUDE.md and README.md

The "GitHub Pages config is load-bearing" bullet describes the old prefix layout and
would actively mislead the next reader. `README.md` still advertises the old live URL.

**Files:**
- Modify: `CLAUDE.md` (the "GitHub Pages config is load-bearing" bullet under **Hard rules**, and the `npm run dev` line under **Commands**)
- Modify: `README.md` (lines 7, 38, 43, 74)

- [ ] **Step 1: Replace the hard-rules bullet**

Replace the existing bullet with:

```markdown
- **GitHub Pages config is load-bearing** (`next.config.ts` + `public/CNAME` +
  `public/.nojekyll` + `public/sw.js`): the site is served from the apex custom domain
  **laesemakker.dk** at the root path — there is no `basePath`/`assetPrefix`. `public/CNAME`
  must keep containing `laesemakker.dk`, and `trailingSlash` + `images.unoptimized` must
  stay. `public/sw.js` and `scripts/inject-sw-assets.mjs` hardcode an empty `BASE` because
  neither can read env vars; if a base path is ever reintroduced, all three must change
  together. Breaking any of these blanks the deployed site or the installed PWA. The
  `postbuild` step (`scripts/inject-sw-assets.mjs`) injects the precache list + build id
  into `out/sw.js` — keep it wired.
```

- [ ] **Step 2: Fix the dev-server URL in the Commands block**

Change the `npm run dev` comment from `http://localhost:3000/reading-challenge/` to:

```
npm run dev        # next dev at http://localhost:3000/
```

And the `npm run serve` comment from "under the basePath at :4399" to:

```
npm run serve      # serve ./out at :4399 (what Playwright + Pages actually hit)
```

- [ ] **Step 3: Update README.md**

`README.md` carries the public-facing URLs. Four lines change:

- line 7: `**Live:** https://vajkri.github.io/reading-challenge/` → `**Live:** https://laesemakker.dk/`
- line 38: `npm run dev      # http://localhost:3000/reading-challenge/  (basePath applies in dev too)`
  → `npm run dev      # http://localhost:3000/`
- line 43: `npm run serve    # serve ./out under the basePath at http://localhost:4399/reading-challenge/`
  → `npm run serve    # serve ./out at http://localhost:4399/`
- line 74: the GitHub Pages bullet naming `` `/reading-challenge` `` — rewrite it to describe the
  apex custom domain and the absence of a basePath, matching the `CLAUDE.md` wording from Step 1.

Read each line before editing; the line numbers are from the pre-change file and will drift as you edit.

- [ ] **Step 4: Verify no stale prefix remains anywhere in the repo**

Run:
```bash
grep -rn "reading-challenge" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" --include="*.md" --include="*.yml" app components lib public copy scripts e2e docs/superpowers CLAUDE.md AGENTS.md
```

Expected: matches **only** inside `docs/superpowers/specs/` and `docs/superpowers/plans/`
(historical design records, and GitHub issue URLs, which are correct to leave). No match
in `app/`, `components/`, `lib/`, `public/`, `scripts/`, `e2e/`, or `CLAUDE.md`.

`package.json` `name` stays `reading-challenge` — the repo is not being renamed.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs(#32): document the root-served laesemakker.dk Pages setup"
```

---

### Task 8: Full verification gate

**Files:** none modified.

- [ ] **Step 1: Types and lint**

Run:
```bash
npx tsc --noEmit && npx eslint .
```

Expected: clean, no output from either.

- [ ] **Step 2: Build and full e2e**

Run:
```bash
npm run build && npm run test:e2e
```

Expected: all tests pass.

- [ ] **Step 3: Manual check of the served export**

Start the server:
```bash
npm run serve
```

Then in a browser at `http://localhost:4399/`, confirm all four:

1. the app loads at the root, no 404s in the Network panel;
2. no request anywhere targets a `/reading-challenge/...` path;
3. DevTools → Application → Service Workers shows the SW registered at scope `/`;
4. DevTools → Application → Manifest shows `start_url` and `scope` of `/`.

Stop the server when done.

- [ ] **Step 4: Confirm persisted data is still untouched**

Run:
```bash
git diff origin/main -- lib/storage.ts | grep -E "^[+-].*sommerlaesning" || echo "storage keys untouched"
```

Expected: `storage keys untouched`.

---

### Task 9: Cutover (manual — human, not agent)

Order is load-bearing. Do not reorder.

- [ ] **Step 1: Set the custom domain**

Repo **Settings → Pages → Custom domain** → `laesemakker.dk` → Save. With an
Actions-based deploy this setting is authoritative; the `public/CNAME` file from Task 6
ships as belt-and-braces.

- [ ] **Step 2: Merge the PR**

Merging to `main` triggers `.github/workflows/deploy.yml`: build → e2e → Pages deploy.
A red suite blocks the deploy, which is the intended safety net.

- [ ] **Step 3: Wait for the certificate, then enforce HTTPS**

Repo **Settings → Pages → Enforce HTTPS**. The certificate can take from ~15 minutes to
24 hours to provision; the checkbox stays disabled until it is ready.

- [ ] **Step 4: Verify the live site and the redirect**

```bash
curl -sI https://laesemakker.dk/ | head -1
curl -sI https://vajkri.github.io/reading-challenge/ | head -2
```

Expected: the first returns `HTTP/2 200`; the second returns a `301` with a `location:`
header pointing at `https://laesemakker.dk/`.

- [ ] **Step 5: Confirm GA4 is reporting**

Open `https://laesemakker.dk/`, then check GA4 Realtime for an active user. If it stays
empty, `PAGES_HOST` (Task 5) is the first thing to re-check.

- [ ] **Step 6: Close the issue**

Both halves of #32 have now shipped.

```bash
gh issue close 32 --comment "Rebrand shipped in PR 1; laesemakker.dk cutover shipped in PR 2 and verified live."
```

---

## Notes for the implementer

- Do **not** attempt to preserve user data or add a migration bridge. That was
  considered and explicitly rejected — see decision D1 in the spec.
- Do **not** add a service-worker kill switch. Also explicitly rejected — decision D3.
- If the site 404s after cutover, check `public/.nojekyll` still exists before anything
  else; without it Pages ignores `_next/` because the directory starts with an underscore.
