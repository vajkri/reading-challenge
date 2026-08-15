# Læsemakker Rebrand Implementation Plan (PR 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the app from "Læseudfordring" to "Læsemakker" everywhere it is visible, without touching the deployed URL or any persisted data.

**Architecture:** The brand is already funnelled through one copy key. `copy/da.json` → `app.name` feeds the header `<h1>`, the document `<title>`, the iOS web-app title, and the PWA manifest `name`/`short_name`. Flipping that one key does the whole user-facing rebrand; everything else in this plan is a non-user-facing consistency sweep (a service-worker cache namespace and four file-header comments).

**Tech Stack:** Next.js 16 static export, TypeScript, Playwright, Tailwind.

**Spec:** [`docs/superpowers/specs/2026-08-09-laesemakker-rebrand-and-domain-design.md`](../specs/2026-08-09-laesemakker-rebrand-and-domain-design.md)

**Prerequisite:** none. This PR has no deployment dependency and can merge and deploy to the existing `vajkri.github.io/reading-challenge` URL immediately.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `copy/da.json` | single source of all Danish user-facing strings | `app.name` value |
| `e2e/app.spec.ts` | behavioural end-to-end coverage | add a brand-assertion test |
| `public/sw.js` | offline service worker | cache namespace + header comment |
| `lib/joy.ts`, `lib/storage.ts`, `lib/store.tsx` | pure logic modules | header comments only |

No new files. No file exceeds the 300-line guideline as a result of these changes.

**Do NOT touch** the `sommerlaesning.v1.*` keys in `lib/storage.ts:25-34`. They are the on-disk contract; renaming them reads as "first run" and abandons a real child's saved progress (`CLAUDE.md` hard rule).

---

### Task 1: Lock the brand with a failing test

There is currently no test asserting the app's name anywhere, so the rebrand could silently half-land. Add the assertion first, watch it fail, then make it pass.

**Files:**
- Modify: `e2e/app.spec.ts` (append at end of file)

- [ ] **Step 1: Write the failing test**

Append to `e2e/app.spec.ts`:

```ts
test("header and document title carry the Læsemakker brand", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Læsemakker" })).toBeVisible();
  await expect(page).toHaveTitle("Læsemakker");
});
```

- [ ] **Step 2: Build, then run the test to verify it fails**

`test:e2e` does not build — it runs against `./out`, so a stale export would test the old code.

Run:
```bash
npm run build && npx playwright test -g "Læsemakker brand"
```

Expected: **FAIL**. Both assertions miss because the app still renders and titles itself "Læseudfordring".

- [ ] **Step 3: Commit the failing test**

```bash
git add e2e/app.spec.ts
git commit -m "test(#32): assert the Læsemakker brand in header and title"
```

---

### Task 2: Flip the brand key

**Files:**
- Modify: `copy/da.json:3`

- [ ] **Step 1: Change the value**

In `copy/da.json`, inside the `"app"` object, change:

```json
    "name": "Læseudfordring",
```

to:

```json
    "name": "Læsemakker",
```

Change **only** the `app.name` value. Leave `app.description` and every other key alone.

- [ ] **Step 2: Rebuild and run the test to verify it passes**

Run:
```bash
npm run build && npx playwright test -g "Læsemakker brand"
```

Expected: **PASS**, 1 passed.

- [ ] **Step 3: Confirm the key propagated to the manifest**

The manifest is generated from the same key, so this needs no code change — but verify it actually flowed through.

Run:
```bash
grep -o '"name":"[^"]*"' out/manifest.webmanifest
```

Expected output contains `"name":"Læsemakker"` and `"short_name":"Læsemakker"`.

- [ ] **Step 4: Commit**

```bash
git add copy/da.json
git commit -m "feat(#32): rename the app to Læsemakker"
```

---

### Task 3: Rename the service-worker cache namespace

Cosmetic, and safe: `activate` already deletes every cache whose key is not the current one, so the old `laeseudfordring-*` cache is purged on the next activation. This is a **cache name**, not a storage key — the rule against renaming applies to `localStorage` keys only.

**Files:**
- Modify: `public/sw.js:18`

- [ ] **Step 1: Change the cache prefix**

In `public/sw.js`, change:

```js
const CACHE = `laeseudfordring-${BUILD_ID}`;
```

to:

```js
const CACHE = `laesemakker-${BUILD_ID}`;
```

- [ ] **Step 2: Rebuild and verify the built service worker carries the new namespace**

Run:
```bash
npm run build && grep -n "laesemakker-" out/sw.js
```

Expected: one match, on the `const CACHE = ...` line. Also confirm no stale name survives:

```bash
grep -c "laeseudfordring" out/sw.js
```

Expected: `0`.

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "chore(#32): rename the service worker cache namespace to laesemakker"
```

---

### Task 4: Sweep the brand out of code comments

Four file-header comments still say "Læseudfordring". Non-user-facing, but they are the first thing a reader sees in each module.

**Files:**
- Modify: `public/sw.js:1`
- Modify: `lib/joy.ts:1`
- Modify: `lib/storage.ts:1`
- Modify: `lib/store.tsx:3`

- [ ] **Step 1: Update each comment**

`public/sw.js:1`:
```js
// Minimal offline service worker for Læsemakker.
```

`lib/joy.ts:1`:
```ts
// Progress math for the Læsemakker reading challenge.
```

`lib/storage.ts:1`:
```ts
// localStorage data layer for the Læsemakker app.
```

`lib/store.tsx:3`:
```tsx
// Central app state for Læsemakker.
```

- [ ] **Step 2: Verify no source file still carries the old brand**

Run:
```bash
grep -rn "Læseudfordring" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" app components lib public copy scripts e2e
```

Expected: **no output**. (`docs/` is excluded on purpose — the spec handoffs in `docs/spec/` are historical records of the original prototype and must keep their original wording.)

- [ ] **Step 3: Commit**

```bash
git add public/sw.js lib/joy.ts lib/storage.ts lib/store.tsx
git commit -m "docs(#32): update the brand name in module header comments"
```

---

### Task 5: Full verification gate

**Files:** none modified.

- [ ] **Step 1: Types and lint**

Run:
```bash
npx tsc --noEmit && npx eslint .
```

Expected: clean, no output from either.

- [ ] **Step 2: Build**

Run:
```bash
npm run build
```

Expected: static export succeeds, and the postbuild line prints
`[inject-sw-assets] BUILD_ID=<hash> precache assets=<n>`.

- [ ] **Step 3: Full e2e suite**

Run:
```bash
npm run test:e2e
```

Expected: all tests pass, including the new brand test. If the analytics specs fail, that is unrelated to this change — investigate before proceeding, do not skip.

- [ ] **Step 4: Confirm persisted data is untouched**

The single most damaging possible mistake in this PR is a renamed storage key. Prove it did not happen.

Run:
```bash
git diff origin/main -- lib/storage.ts | grep -E "^[+-].*sommerlaesning" || echo "storage keys untouched"
```

Expected: `storage keys untouched`.

---

### Task 6: Open the PR

**Files:** none modified.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/32-rebrand-to-l-semakker-move-to-laesemakke
```

- [ ] **Step 2: Open the PR**

The PR body must **not** say `Closes #32` — issue #32 also covers the domain move, which ships in PR 2. Reference it without closing.

```bash
gh pr create --base main \
  --title "feat(#32): rebrand to Læsemakker" \
  --body "$(cat <<'EOF'
Renames the app from Læseudfordring to Læsemakker. Part 1 of #32 — the
laesemakker.dk domain cutover follows in a separate PR, gated on DNS.

- `copy/da.json` `app.name` drives the header, `<title>`, the iOS web-app
  title, and the PWA manifest `name`/`short_name` — one key, whole rebrand
- service worker cache namespace renamed (self-cleaning: `activate` already
  purges every non-current cache)
- brand updated in four module header comments
- new e2e test pins the header and title so the brand can't half-land

No `localStorage` keys touched — `sommerlaesning.v1.*` is unchanged, so no
saved progress is affected. No URL or basePath change.

Design: `docs/superpowers/specs/2026-08-09-laesemakker-rebrand-and-domain-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notes for the implementer

- `about.title` ("Om Læseudfordring") is **not** in scope. The About page lives on an
  unmerged branch and does not exist on `origin/main`. It must be renamed when
  [#3](https://github.com/vajkri/reading-challenge/issues/3) lands.
- The repo name, `package.json` `name`, and the app icon stay as they are.
- Do not add `basePath` or domain changes here — those belong to PR 2.
