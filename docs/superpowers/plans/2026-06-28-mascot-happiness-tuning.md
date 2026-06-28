# Mascot happiness tuning — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Front-load the mascot happiness thresholds and replace the 8 Danish captions with a warmer, more playful set, so the Progress-screen mascot reacts sooner and more often.

**Architecture:** Pure data changes. `joyForPct()` in `lib/joy.ts` maps completion % → `Stage` (0–7); the cutoffs move from `10/25/50/75/90/100/101` to `5/15/30/50/75/100/101`. The 8 caption strings in `copy/da.json` (`progress.captions`, index-aligned to the stages and consumed by `store.tsx` via `copy.progress.captions[joy]`) are rewritten. No React, store, or MascotFace changes — the 8 stages ↔ 8 captions ↔ visual-trigger alignment is preserved.

**Tech Stack:** TypeScript, Next.js static export, Playwright e2e. No unit-test runner exists — behaviour is locked by the existing Playwright suite plus tsc/eslint/build gates.

---

## File structure

- `lib/joy.ts` — `joyForPct()` cutoffs + its docstring (and the file-header "faithfully reproduces _joy" note).
- `copy/da.json` — `progress.captions` array (8 strings).
- `e2e/app.spec.ts` — one assertion at the "ongoing challenge renders the ring percentage" test is coupled to the old stage-3 caption at 50%; 50% now resolves to stage 4.

## TDD note

There is no Vitest/Jest harness, so the failing-test/passing-test loop runs through Playwright. e2e runs against `./out`, so every e2e run is preceded by `npm run build`. Task 1 makes the existing e2e assertion expect the *new* behaviour (red), Tasks 2–3 implement it (green).

---

### Task 1: Make the e2e assertion expect the new stage-4 caption (red)

**Files:**
- Modify: `e2e/app.spec.ts:43-44`

- [ ] **Step 1: Update the assertion**

At 500/1000 = 50%, the new ramp puts the mascot at stage 4 (festhat), so the caption changes. Replace lines 43–44:

```ts
  // caption is derived from joy(pct=50)=stage 3, proving the ring data is wired
  await expect(page.getByText("Det går rigtig godt", { exact: false })).toBeVisible();
```

with:

```ts
  // caption is derived from joy(pct=50)=stage 4 (festhat), proving the ring data is wired
  await expect(page.getByText("Festhat på!", { exact: false })).toBeVisible();
```

- [ ] **Step 2: Build, then run the test to verify it fails**

Run:

```bash
npm run build && npx playwright test -g "ring percentage"
```

Expected: FAIL — the page still shows "Det går rigtig godt" (stage 3) and "Festhat på!" is not found, because `joy.ts` and `copy/da.json` are unchanged.

---

### Task 2: Front-load the happiness thresholds

**Files:**
- Modify: `lib/joy.ts` (the `joyForPct` body, its docstring, and the file-header comment)

- [ ] **Step 1: Replace the `joyForPct` cutoffs**

Replace this body:

```ts
export function joyForPct(pct: number): Stage {
  if (pct >= 101) return 7;
  if (pct >= 100) return 6;
  if (pct >= 90) return 5;
  if (pct >= 75) return 4;
  if (pct >= 50) return 3;
  if (pct >= 25) return 2;
  if (pct >= 10) return 1;
  return 0;
}
```

with:

```ts
export function joyForPct(pct: number): Stage {
  if (pct >= 101) return 7;
  if (pct >= 100) return 6;
  if (pct >= 75) return 5;
  if (pct >= 50) return 4;
  if (pct >= 30) return 3;
  if (pct >= 15) return 2;
  if (pct >= 5) return 1;
  return 0;
}
```

- [ ] **Step 2: Update the `joyForPct` docstring**

Replace this docstring:

```ts
/**
 * Map a completion percentage to a mascot happiness Stage (0–7).
 *
 * Mirrors the source `_joy(p)` thresholds verbatim, including the `>=101`
 * "konge" tier that sits one notch above the plain 100% celebration so that
 * over-achievers get the top crown. Callers decide whether challenge lifecycle
 * (none → 0, completed → 7) overrides this progress-driven value.
 */
```

with:

```ts
/**
 * Map a completion percentage to a mascot happiness Stage (0–7).
 *
 * Front-loaded ramp (issue #16): the cutoffs 5/15/30/50/75/100/101 react sooner
 * than the prototype's verbatim 10/25/50/75/90 so the first reading session
 * visibly wakes the mascot. The `>=101` "konge" tier sits one notch above the
 * plain 100% celebration so over-achievers get the top crown; stages 6 (100%)
 * and 7 stay pinned to the 100% caption. Callers decide whether challenge
 * lifecycle (none → 0, completed → 7) overrides this progress-driven value.
 */
```

- [ ] **Step 3: Update the file-header comment so it no longer claims `_joy` is faithfully reproduced**

Replace this fragment of the top-of-file comment:

```ts
// clock inside deadlineInfo(). Faithfully reproduces the design-tool spec
// (Sommerlæsning.dc.html): _joy (~526–535), the progress ring constants and
// stroke-dashoffset in renderVals (~796–798), the pct computation (~767), and
// the deadline countdown (~853–868).
```

with:

```ts
// clock inside deadlineInfo(). Reproduces the design-tool spec
// (Sommerlæsning.dc.html): the progress ring constants and stroke-dashoffset
// in renderVals (~796–798), the pct computation (~767), and the deadline
// countdown (~853–868). joyForPct intentionally retunes the prototype's _joy
// thresholds for engagement (issue #16) — see its docstring.
```

- [ ] **Step 4: Typecheck + lint**

Run:

```bash
npx tsc --noEmit && npx eslint lib/joy.ts
```

Expected: clean (no output / exit 0).

---

### Task 3: Rewrite the captions

**Files:**
- Modify: `copy/da.json` (`progress.captions`)

- [ ] **Step 1: Replace the captions array**

Replace:

```json
    "captions": [
      "{name} keder sig lidt... skal vi læse en bog?",
      "{name} er vågnet – kom i gang med at læse!",
      "Godt begyndt! {name} begynder at smile.",
      "Det går rigtig godt – bliv ved!",
      "Wow! {name} har taget festhat på.",
      "Så fin! {name} har fået butterfly på.",
      "Du gjorde det – 100%! {name} jubler!",
      "FEST! Du er en ægte superlæser!"
    ],
```

with:

```json
    "captions": [
      "{name} keder sig... skal vi finde en god bog?",
      "Yes! {name} vågnede – nu kører det!",
      "{name} smiler allerede – sikke en start!",
      "Wauw, du læser løs! {name} gnistrer af stolthed.",
      "Festhat på! {name} fejrer hvert minut, du læser.",
      "Næsten i mål! {name} har taget butterfly på.",
      "100%! Du gjorde det – {name} jubler!",
      "Konge! Du er en ægte superlæser!"
    ],
```

- [ ] **Step 2: Verify the JSON still parses**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('copy/da.json','utf8')); console.log('da.json OK')"
```

Expected: `da.json OK`.

---

### Task 4: Full verification + commit (green)

**Files:** none (verification only)

- [ ] **Step 1: Static gates**

Run:

```bash
npx tsc --noEmit && npx eslint .
```

Expected: clean.

- [ ] **Step 2: Build + full e2e (the failing test from Task 1 now passes)**

Run:

```bash
npm run build && npm run test:e2e
```

Expected: all Playwright tests PASS, including "ongoing challenge renders the ring percentage" (now asserting "Festhat på!").

- [ ] **Step 3: Commit**

```bash
git add lib/joy.ts copy/da.json e2e/app.spec.ts
git commit -m "feat(#16): front-load mascot happiness ramp + warmer captions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review

- **Spec coverage:** thresholds (Task 2) ✓, captions (Task 3) ✓, coupled e2e (Task 1) ✓, docstring/"verbatim" claim fixed (Task 2 steps 2–3) ✓, verification gates (Task 4) ✓.
- **Placeholders:** none — every code/JSON block is literal and complete.
- **Type consistency:** `joyForPct` signature unchanged (`(pct: number): Stage`); `Stage` is `0|…|7`; the 8-element captions array keeps index alignment; no new symbols introduced.
