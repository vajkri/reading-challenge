# Mascot happiness tuning — design

Issue: #16 — Tune mascot happiness intervals + captions for engagement
Branch: `feat/16-tune-mascot-happiness-intervals-captions`

## Problem

The Progress-screen mascot is the app's main engagement engine for kids, but
its emotional ramp is a verbatim port of the prototype's `_joy()` and is not
tuned for motivation:

- **Dead zones in the thresholds.** `joyForPct()` maps completion % to a
  `Stage` (0–7) at `10 / 25 / 50 / 75 / 90 / 100 / 101`
  (`lib/joy.ts`). Stages 2 (25–49%) and 3 (50–74%) each span ~25 points, so a
  child can read for a long time and see no visible mascot change — the
  dopamine loop stalls.
- **Flat captions.** The 8 stage captions in `copy/da.json`
  (`progress.captions`) are functional but not very playful or celebratory.

## Goal

Retune the thresholds to be **front-loaded** (the first reading session
visibly wakes the mascot) and rewrite the captions to be **warmer, playful, and
milestone-celebrating** — maximizing visible mascot reactions for a young
reader.

## Constraints (invariants this design preserves)

- **8 stages ↔ 8 captions ↔ visual triggers stay index-aligned.** We change
  *where on the % axis* each stage fires and *the caption text*; we do not add,
  remove, or reorder stages. `components/MascotFace.tsx` is untouched.
- **Stages 6 and 7 are pinned.** Caption[6] references "100%", and stage 7 is
  the over-achiever crown (`pctFor()` can exceed 100, driving the `>=101`
  konge tier). So only stages 1–5 are redistributed across the 0–99% range.
- **Mascot visual milestones drive caption wording.** The renderer adds the
  party hat at stage ≥4, the bow-tie at stage ≥5, confetti at stage ≥6, and the
  crown at stage ≥7. Captions 4/5/6/7 must keep referencing hat / butterfly /
  jubler / konge so copy matches what the child sees.
- This is an intentional, documented deviation from the prototype's `_joy()` /
  `renderVals()` port — not a bug fix.

## Solution

### Thresholds (`lib/joy.ts` → `joyForPct`)

Change the cutoffs from `10 / 25 / 50 / 75 / 90 / 100 / 101` to:

```
5 / 15 / 30 / 50 / 75 / 100 / 101
```

Resulting bands:

| Stage | Band (%) | Visual milestone        | Was (%) |
|------:|----------|-------------------------|---------|
| 0     | 0–4      | gloomy / frown          | 0–9     |
| 1     | 5–14     | awake, brows            | 10–24   |
| 2     | 15–29    | small smile             | 25–49   |
| 3     | 30–49    | big smile + blush + tongue | 50–74 |
| 4     | 50–74    | + party hat (festhat)   | 75–89   |
| 5     | 75–99    | + bow-tie (butterfly)   | 90–99   |
| 6     | 100      | + confetti (jubler)     | 100     |
| 7     | 101+     | + crown (konge)         | 101+    |

Rationale: early thresholds roughly halve, so a single reading session moves
the mascot. The festhat lands at the 50% halfway point (strong mid-challenge
reward) and the bow-tie drops from 90%→75%. Two ~25-point bands remain in the
back half (stages 4 and 5) because only one threshold separates 75–99% from the
pinned 100% — acceptable since being close is itself motivating and each band
ends in a visible unlock.

### Captions (`copy/da.json` → `progress.captions`)

Replace all 8 with the playful "Variant A" set (`{name}` interpolation
preserved):

```json
[
  "{name} keder sig... skal vi finde en god bog?",
  "Yes! {name} vågnede – nu kører det!",
  "{name} smiler allerede – sikke en start!",
  "Wauw, du læser løs! {name} gnistrer af stolthed.",
  "Festhat på! {name} fejrer hvert minut, du læser.",
  "Næsten i mål! {name} har taget butterfly på.",
  "100%! Du gjorde det – {name} jubler!",
  "Konge! Du er en ægte superlæser!"
]
```

## Affected files

- `lib/joy.ts` — `joyForPct()` thresholds + the docstring (which currently
  claims the thresholds mirror the source "verbatim"; update to note the
  intentional retune).
- `copy/da.json` — `progress.captions` array (8 strings).
- `e2e/app.spec.ts` — update any test asserting an old caption string or an
  old threshold-derived stage, if present.

Out of scope: `components/MascotFace.tsx` (visual geometry), `lib/store.tsx`
(joy/caption wiring stays — `joyForPct(pct)`, `copy.progress.captions[joy]`),
`pctFor` / `ringOffset` (unchanged).

## Testing

- `npx tsc --noEmit && npx eslint .` clean.
- `npm run build` (static export + postbuild SW injection).
- `npm run test:e2e` green (build first — e2e runs against `./out`).
- Manual sanity: a low-minute entry now shows stage 1, not stage 0.
