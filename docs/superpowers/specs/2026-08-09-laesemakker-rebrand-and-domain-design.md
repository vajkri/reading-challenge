# Rebrand to Læsemakker + move to laesemakker.dk — design

**Date:** 2026-08-09
**Issue:** [#32](https://github.com/vajkri/reading-challenge/issues/32)
**Branch:** `feat/32-rebrand-to-l-semakker-move-to-laesemakke`
**Status:** approved

Rename the app from **Læseudfordring** to **Læsemakker** and serve it from the newly
purchased apex domain **laesemakker.dk**, replacing the GitHub Pages project URL
`https://vajkri.github.io/reading-challenge/`.

Ships as **two PRs**. PR 1 is safe to merge immediately; PR 2 must not merge until DNS
resolves, because merging it early breaks both URLs at once.

---

## Current state

A static Next.js export deployed to GitHub Pages as a *project* site, so every URL is
prefixed with `/reading-challenge`. That prefix is duplicated across nine files (see
[PR 2](#pr-2--domain-cutover)) rather than derived from one source, and two of them
(`public/sw.js`, `scripts/inject-sw-assets.mjs`) cannot read env vars at all — `sw.js`
is not processed by the bundler, and the postbuild script rewrites the built copy.

The app is single-locale Danish. All user-facing strings come from `copy/da.json` via
`@/lib/copy`; `CLAUDE.md` forbids hardcoded Danish in JSX.

---

## Decisions

Four decisions were taken during brainstorming. Recorded here because three of them
have consequences that are invisible in the diff.

### D1 — Existing users' data will be lost. Accepted.

`localStorage` is scoped to an **origin**. `vajkri.github.io` and `laesemakker.dk` are
different origins, so none of the eight `sommerlaesning.v1.*` keys travel. Every daily
user's challenge progress resets to zero and they begin a new challenge.

This was raised twice and confirmed twice. Preserving the data was possible but rejected
as not worth the cost.

**Why no cheap fix exists:**

- Attaching `laesemakker.dk` as the custom domain on `reading-challenge` makes the old
  Pages URL serve a **server-side 301**. No JavaScript ever runs on the old origin again,
  so the old `localStorage` becomes permanently unreachable. The auto-redirect that
  satisfies "old URL redirects to new" is the same mechanism that destroys the data —
  redirect and migration are mutually exclusive on a single repo.
- A hidden `<iframe>` + `postMessage` from the old origin does **not** work. Chrome
  partitions third-party storage by top-level site and Safari's ITP has done so for
  years, so the iframe writes to a `(vajkri.github.io, laesemakker.dk)` partition — not
  the first-party storage the user sees when visiting `laesemakker.dk` directly.
- Any working migration therefore needs the payload to ride a **top-level navigation**
  in the URL **fragment** (fragments are never sent to a server, which matters because
  `sommerlaesning.v1.name` holds a child's name), which in turn requires **two live
  origins simultaneously** — i.e. a second repo or host.

**Rejected alternatives:**

| | Cost | Outcome |
|---|---|---|
| Bridge page on old origin | new repo + ~40-line `index.html` + import path in app | data preserved, clean cutover date |
| Leave old URL unredirected until challenges end | new repo, no code | data preserved, open-ended tail |
| **Accept loss (chosen)** | none | fastest; progress resets |

### D2 — Canonical host is the apex, `laesemakker.dk`.

Shorter and easier for a child or parent to type. `www` is not a separate domain and
needs no separate purchase — it is a DNS record on the domain already owned. A `www`
CNAME is still created so `www.laesemakker.dk` redirects to the apex rather than failing.

### D3 — The old service worker gets no kill-switch. Accepted.

Users who have visited the old URL have a service worker registered at scope
`/reading-challenge/`. After the flip it can never be updated again, because the origin
serves no more content.

- **Online:** the SW's navigation handler does `fetch(request)`. A navigation request has
  `redirect: "manual"`, so the 301 surfaces as an opaque-redirect response — `res.ok` is
  false, nothing is cached, and the browser follows the redirect. The cutover works.
- **Offline:** the SW keeps serving the stale cached app shell indefinitely. A child can
  log minutes into the old origin's storage; those minutes are lost the next time they
  come online and get redirected away.
- **Installed PWAs:** the home-screen icon's `start_url` still points at the old origin.
  Navigating out of scope opens a browser tab instead of the app shell. Users must
  re-add the app from the new domain.

A phase-0 deploy shipping a self-unregistering `sw.js` to the current URL, followed by a
wait for daily users to pick it up, would have avoided the offline ghost. Rejected in
favour of flipping immediately.

### D4 — Two PRs, not one.

PR 1 has no deployment dependency and can merge and deploy to the existing URL today.
PR 2 is a hard cutover gated on DNS. Splitting them keeps a rollback boundary between
"the name changed" and "the origin changed".

---

## PR 1 — Rebrand

No deployment dependency. Merges and deploys to the existing URL.

| File | Change |
|---|---|
| `copy/da.json:3` | `app.name`: `"Læseudfordring"` → `"Læsemakker"` |
| `public/sw.js:18` | cache prefix `laeseudfordring-${BUILD_ID}` → `laesemakker-${BUILD_ID}` |
| `public/sw.js:1`, `lib/joy.ts:1`, `lib/storage.ts:1`, `lib/store.tsx:3` | brand name in header comments |

`app.name` is the only user-facing string involved. It already feeds:

- the header "logo" in `components/AppShell.tsx`,
- `metadata.title` and `appleWebApp.title` in [`app/layout.tsx:23,25`](../../../app/layout.tsx),
- `name` and `short_name` in `app/manifest.ts`.

The SW cache rename is safe: `activate` already deletes every cache whose key ≠ the
current one, so the old `laeseudfordring-*` cache is purged on next activation. This is
a cache name, **not** a storage key.

**Explicitly not touched:**

- the `sommerlaesning.v1.*` `localStorage` keys — renaming them abandons saved progress
  (`CLAUDE.md` hard rule, `lib/storage.ts:19-24`);
- the repo name `reading-challenge` and `package.json` `name`;
- `about.title` — the About page is not on `origin/main`, so it is out of scope on this
  branch and must be renamed whenever [#3](https://github.com/vajkri/reading-challenge/issues/3) lands.

No e2e test asserts the brand string, so no test updates are required.

---

## PR 2 — Domain cutover

Merge **only after** DNS resolves. Between merging and DNS being ready the site is
broken at both URLs.

### Code changes

Nine spots. The issue listed four; `playwright.config.ts`, `scripts/serve-out.mjs`,
`scripts/verify-states.mjs`, `components/Analytics.tsx` and `public/CNAME` were found
during design.

| File | Line | Change |
|---|---|---|
| `next.config.ts` | 7 | drop `basePath` + `assetPrefix`; `env.NEXT_PUBLIC_BASE_PATH: ""` |
| `public/sw.js` | 10 | `BASE = ""` → `APP_SHELL` becomes `/` |
| `scripts/inject-sw-assets.mjs` | 14 | `BASE = ""` → precache URLs become `/_next/...` |
| `playwright.config.ts` | 7 | `BASE = ""` → `baseURL` becomes `http://localhost:4399/` |
| `scripts/serve-out.mjs` | 10 | `PREFIX = ""` |
| `scripts/verify-states.mjs` | 6 | default URL → `http://localhost:3000/` |
| `components/Analytics.tsx` | 6 | `PAGES_HOST` → `"laesemakker.dk"` |
| `public/CNAME` | new | `laesemakker.dk` |
| `CLAUDE.md` | — | update the load-bearing-Pages-config section and the brand name |

`app/manifest.ts` and `components/ServiceWorkerRegister.tsx` need **no edit** — both
derive their paths from `BASE_PATH` (`lib/config.ts:3`), which becomes `""`.

**`components/Analytics.tsx` is the trap.** `PAGES_HOST` is an *allowlist* — any unknown
host defaults to OFF, deliberately, so a forgotten host cannot pollute production
analytics. Miss this line and GA4 goes completely dark on the new domain with no error
anywhere. The file's own comment predicts it: *"If the site ever moves to a custom
domain, update PAGES_HOST."*

`scripts/serve-out.mjs` and `scripts/verify-states.mjs` must be checked for correct
behaviour with an **empty** prefix, not just a changed one — string concatenation that
assumed a leading segment may produce `//` or drop a slash.

### Cutover runbook

Order is load-bearing.

1. **Registrar — DNS.** Apex `A` records → GitHub Pages' four IPv4 addresses; `AAAA` →
   the four IPv6 addresses; `www` `CNAME` → `vajkri.github.io`.
   *Take the current addresses from GitHub's Pages documentation at cutover time. They
   change rarely, but they do change — do not copy them from memory or from this doc.*
2. **Wait for propagation.** Confirm with `dig laesemakker.dk +short` and
   `dig www.laesemakker.dk +short`.
3. **Repo Settings → Pages → Custom domain** = `laesemakker.dk`. With an Actions-based
   deploy this setting is authoritative; `public/CNAME` ships as belt-and-braces.
4. **Merge PR 2** → the workflow builds, runs e2e, deploys.
5. **Enable "Enforce HTTPS"** once the certificate provisions (≈15 min – 24 h).
6. **Confirm the redirect.** `https://vajkri.github.io/reading-challenge/` should 301 to
   `https://laesemakker.dk/`.

### Rollback

Before step 5, rollback is: unset the custom domain in Settings and revert PR 2. After
HTTPS enforcement the same works, but browsers that cached the HSTS/redirect may take
time to settle. There is no rollback for D1 — once users land on the new origin and
start fresh, the old data is not merged back.

---

## Verification

Per `CLAUDE.md`, before claiming done:

```bash
npx tsc --noEmit && npx eslint .
npm run build
npm run test:e2e
```

`test:e2e` does not build — build first or the suite tests a stale `./out`.

PR 2 additionally requires manual confirmation on the built export:

- `sw.js` registers at scope `/` (DevTools → Application → Service Workers);
- `manifest.webmanifest` has `start_url` and `scope` of `/`;
- no request 404s on a `/reading-challenge/...` path;
- the site loads at `http://localhost:4399/` under `npm run serve`.

---

## Out of scope

- `components/InstallPrompt.tsx` and `lib/useInstallPrompt.ts` — ~400 lines that exist
  only on the stale local `main`, added by a commit messaged `docs(#3)`. Relevant to a
  domain move (users must re-install the PWA) but deliberately deferred.
- The About page and `about.title` — not on `origin/main`; see PR 1.
- Renaming the repo, the `package.json` name, or the app icon.
- Any migration of user data — see D1.
