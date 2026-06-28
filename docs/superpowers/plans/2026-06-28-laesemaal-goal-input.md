# Læsemål Goal-Input Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Settings "Læsemål" preset-chips + number-field combo with a single dynamic **Tempo-zoner slider** whose difficulty (Lille / Mellem / Stor indsats) is derived from **minutes-per-day relative to the deadline**.

**Architecture:** Pure math lands in `lib/joy.ts`; all derived values (clamped goal, min/day, effort band, zone fractions, per-day label) are computed in `computeDerived()` in `lib/store.tsx` and read by a new presentational `components/GoalField.tsx`. The slider is a **native `<input type="range">`** (free keyboard a11y + a real `.value` for tests) styled via a `.goal-slider` class in `globals.css`, with absolutely-positioned zone-label overlays. The Slutdato card moves **above** the goal card so the deadline (which drives the calc) is chosen first.

**Tech Stack:** Next.js (static export, App Router), React + useReducer, TypeScript, Tailwind v4 `@theme` tokens, Playwright e2e (the only test gate — no unit runner).

**Spec source of truth:** GitHub issue #23 (latest "FINAL SPEC" comment). Interactive sketch committed at `docs/sketches/laesemaal-goal-input.html` on branch `docs/23-laesemaal-goal-sketch`.

**Key decisions (locked in the design interview):**
- Range **200–750**, step **50**, drag/keyboard. No preset chips.
- `min/dag = mål ÷ dage-tilbage-fra-i-dag`; bands **0–9 Lille**, **10–20 Mellem**, **21+ Stor**.
- Zone boundary fractions on the track = `9.5·days` and `20.5·days` (clamped). Zones shift/collapse with the deadline — **accepted**.
- Editing a running challenge: **total goal ÷ days left from today** (ignores logged minutes).
- Deadline input unchanged in look/behaviour (already prefills today+30 via `seedDrafts`), just **reordered above** the goal card; date picker **blocks past dates** (`min={today}`).
- Legacy out-of-range goals (e.g. persisted `1000`) **clamp into 200–750** on seed.
- Copy: "Indsats" caption written **once**; zone words are bare **Lille / Mellem / Stor**.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `lib/joy.ts` | Pure progress + effort math | **Modify** — add range constants, `clampGoal`, `minutesPerDay`, `effortFor`, `effortZones`, `EffortKey` |
| `copy/da.json` | Danish strings | **Modify** — extend `settings.goal` (sub, effortCaption, effort.{lille,mellem,stor}, perDay) |
| `lib/store.tsx` | Reducer + `computeDerived()` | **Modify** — clamp goal in `seedDrafts`/commit, add draft-based derived (goalNum, goalPerDay, goalEffort, labels, zone fractions, minDeadlineISO), remove `presetGoal`/`PRESET_GOAL` |
| `app/globals.css` | Global styles | **Modify** — add `.goal-slider` track/thumb styling |
| `components/GoalField.tsx` | The whole Læsemål card (slider + zones + readout) | **Create** |
| `components/SettingsScreen.tsx` | Settings layout | **Modify** — drop `PresetChip` + number input, render `<GoalField/>`, move Slutdato card above it, add date `min` |
| `e2e/app.spec.ts` | Behavioural tests | **Modify** — rewrite preset-click test to slider keyboard, fix clamp expectation, add effort-by-deadline + legacy-clamp tests |

---

## Task 1: Pure effort math in `lib/joy.ts`

**Files:**
- Modify: `lib/joy.ts` (append after `pctFor`, ~line 44)

There is no unit-test runner in this repo (Playwright e2e only), so these pure helpers are verified by `tsc` here and exercised behaviourally in Task 7. Keep them pure (no DOM, no React).

- [ ] **Step 1: Add constants + helpers to `lib/joy.ts`**

Insert this block immediately after the `pctFor` function (after line 44):

```ts
// ---------------------------------------------------------------------------
// Reading-goal slider + effort model (issue #23)
//
// The Læsemål slider spans a fixed minute range in 50-minute steps. "Effort" is
// NOT a property of the total — it is minutes/day = goal ÷ days-left-to-deadline,
// bucketed into three bands. Because the bands are per-day, their position on the
// minute axis depends on the deadline and shifts/collapses as it lengthens.
// ---------------------------------------------------------------------------

/** Inclusive slider bounds + step, in total minutes. */
export const GOAL_MIN = 200;
export const GOAL_MAX = 750;
export const GOAL_STEP = 50;

/** Effort band keys (also the copy keys under settings.goal.effort). */
export type EffortKey = "lille" | "mellem" | "stor";

/** Clamp any goal into the slider's [GOAL_MIN, GOAL_MAX] range. */
export function clampGoal(goal: number): number {
  return Math.max(GOAL_MIN, Math.min(GOAL_MAX, goal));
}

/**
 * Minutes-per-day to hit `goal` by the deadline. `daysLeft` is floored to 1 so a
 * same-day / missing deadline never divides by zero (it then reports the whole
 * goal as one day's effort). Rounded to whole minutes to match the band cutoffs.
 */
export function minutesPerDay(goal: number, daysLeft: number): number {
  return Math.round(goal / Math.max(1, daysLeft));
}

/** Bucket minutes-per-day into an effort band: 0–9 lille, 10–20 mellem, 21+ stor. */
export function effortFor(minPerDay: number): EffortKey {
  if (minPerDay <= 9) return "lille";
  if (minPerDay <= 20) return "mellem";
  return "stor";
}

/**
 * Track fractions (0–1) of the two band boundaries for a given deadline, used to
 * tint the slider track and place the zone labels. The lille/mellem edge sits at
 * 9.5·days minutes and the mellem/stor edge at 20.5·days (the round() midpoints of
 * the 9/10 and 20/21 cutoffs), mapped onto [GOAL_MIN, GOAL_MAX] and clamped.
 * A boundary past the track end clamps to 1 → that zone disappears (expected at
 * long deadlines, where every goal is "Lille").
 */
export function effortZones(daysLeft: number): { p1: number; p2: number } {
  const d = Math.max(1, daysLeft);
  const frac = (minutes: number) =>
    Math.max(0, Math.min(1, (minutes - GOAL_MIN) / (GOAL_MAX - GOAL_MIN)));
  return { p1: frac(9.5 * d), p2: frac(20.5 * d) };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (no errors). The new exports are unused for now — that's fine (they are `export`ed, not local).

- [ ] **Step 3: Sanity-check the math by hand (no commit yet)**

Confirm against the spec table mentally:
- `minutesPerDay(450, 30)` → `round(15)` = 15 → `effortFor(15)` = `"mellem"` ✅
- `minutesPerDay(450, 90)` → `round(5)` = 5 → `effortFor(5)` = `"lille"` ✅
- `effortZones(30)` → `p1 = (285-200)/550 ≈ 0.155`, `p2 = (615-200)/550 ≈ 0.755` (all 3 zones) ✅
- `effortZones(90)` → `p1 = (855-200)/550` → clamp `1.0`, `p2 = 1.0` (only Lille) ✅
- `clampGoal(1000)` = 750, `clampGoal(150)` = 200 ✅

- [ ] **Step 4: Commit**

```bash
git add lib/joy.ts
git commit -m "feat(#23): add goal-slider range constants + effort math to joy.ts"
```

---

## Task 2: Copy strings in `copy/da.json`

**Files:**
- Modify: `copy/da.json` (the `settings.goal` object)

`copy.ts` types the dictionary as `typeof da`, so adding keys here makes them available (and type-checked) on `copy.settings.goal.*`. No hardcoded Danish may appear in JSX (CLAUDE.md hard rule).

- [ ] **Step 1: Replace the `settings.goal` object**

Find in `copy/da.json`:

```json
  "goal": {
    "heading": "Læsemål",
    "sub": "Hvor mange minutter vil I gerne læse i alt?",
    "unit": "min"
  },
```

Replace with:

```json
  "goal": {
    "heading": "Læsemål",
    "sub": "Vælg jeres mål — træk for at finjustere.",
    "unit": "min",
    "effortCaption": "Indsats",
    "effort": {
      "lille": "Lille",
      "mellem": "Mellem",
      "stor": "Stor"
    },
    "perDay": "Ca. {count} min om dagen"
  },
```

- [ ] **Step 2: Typecheck (confirms valid JSON + shape)**

Run: `npx tsc --noEmit`
Expected: clean. (A trailing-comma or malformed JSON would fail the import here.)

- [ ] **Step 3: Commit**

```bash
git add copy/da.json
git commit -m "feat(#23): add Læsemål effort + per-day copy strings"
```

---

## Task 3: Wire derived values + clamp in `lib/store.tsx`

**Files:**
- Modify: `lib/store.tsx` (imports, `seedDrafts`, `START_CHALLENGE`, `UPDATE_CHALLENGE`, remove `PRESET_GOAL`, `Derived` interface, `computeDerived`, `Actions`)

All numbers the slider needs live in `derived` so `GoalField` stays presentational (CLAUDE.md: "State lives in one place").

- [ ] **Step 1: Extend the joy import**

Find (line 39):

```ts
import { joyForPct, pctFor, ringOffset, deadlineInfo } from "@/lib/joy";
```

Replace with:

```ts
import {
  joyForPct,
  pctFor,
  ringOffset,
  deadlineInfo,
  clampGoal,
  minutesPerDay,
  effortFor,
  effortZones,
  GOAL_MIN,
  type EffortKey,
} from "@/lib/joy";
```

- [ ] **Step 2: Clamp goal drafts in `seedDrafts`**

Find (lines 140–154, the body of `seedDrafts`):

```ts
  if (challenge === "none") {
    return {
      goalDraft: String(NONE_DEFAULT_GOAL),
      deadlineDraft: isoPlusDays(NONE_DEFAULT_DEADLINE_DAYS),
      nameDraft: DEFAULTS.name,
      mascotDraft: DEFAULTS.mascot,
    };
  }
  return {
    goalDraft: String(goal),
    deadlineDraft: deadline,
    nameDraft: name,
    mascotDraft: mascot,
  };
```

Replace with (clamp the saved goal into slider range so a legacy 1000 shows as 750):

```ts
  if (challenge === "none") {
    return {
      goalDraft: String(NONE_DEFAULT_GOAL),
      deadlineDraft: isoPlusDays(NONE_DEFAULT_DEADLINE_DAYS),
      nameDraft: DEFAULTS.name,
      mascotDraft: DEFAULTS.mascot,
    };
  }
  return {
    goalDraft: String(clampGoal(goal)),
    deadlineDraft: deadline,
    nameDraft: name,
    mascotDraft: mascot,
  };
```

- [ ] **Step 3: Clamp the committed goal in `START_CHALLENGE`**

Find (lines 234–235):

```ts
      const parsed = Math.round(Number(state.goalDraft));
      const goal = parsed >= 1 ? parsed : state.goal;
```

Replace with:

```ts
      const parsed = Math.round(Number(state.goalDraft));
      const goal = clampGoal(parsed >= 1 ? parsed : state.goal);
```

- [ ] **Step 4: Clamp the committed goal in `UPDATE_CHALLENGE`**

Find (lines 251–252):

```ts
      const parsed = Math.round(Number(state.goalDraft));
      const goal = parsed >= 1 ? parsed : state.goal;
```

Replace with:

```ts
      const parsed = Math.round(Number(state.goalDraft));
      const goal = clampGoal(parsed >= 1 ? parsed : state.goal);
```

- [ ] **Step 5: Remove the now-unused `PRESET_GOAL` action**

Delete the union member (line 191):

```ts
  | { type: "PRESET_GOAL"; value: string }
```

Delete the reducer case (lines 396–397):

```ts
    case "PRESET_GOAL":
      return { ...state, goalDraft: action.value };
```

Delete the `Actions` interface member (line 642):

```ts
  presetGoal: (value: string) => void;
```

Delete the bound action (line 721):

```ts
      presetGoal: (value) => dispatch({ type: "PRESET_GOAL", value }),
```

(Leave `SET_GOAL_DRAFT` / `setGoalDraft` intact — the slider uses it.)

- [ ] **Step 6: Add the new derived fields to the `Derived` interface**

Find the end of the `Derived` interface (after `isEditing: boolean;`, line 496) and add before the closing `}`:

```ts
  // settings goal slider (draft-based, deadline-relative effort)
  goalNum: number;            // clamped parsed goalDraft, in [GOAL_MIN, GOAL_MAX]
  goalPerDay: number;         // minutes/day for the draft goal + draft deadline
  goalEffort: EffortKey;      // "lille" | "mellem" | "stor"
  goalEffortLabel: string;    // localized bare word (Lille/Mellem/Stor)
  goalPerDayLabel: string;    // "Ca. 15 min om dagen"
  goalZoneP1: number;         // lille/mellem boundary as 0–1 track fraction
  goalZoneP2: number;         // mellem/stor boundary as 0–1 track fraction
  minDeadlineISO: string;     // today's ISO once hydrated, else "" (date picker min)
```

- [ ] **Step 7: Compute those values in `computeDerived`**

Find the block just before `return {` (after the `isEditing`/`effLocked`/banner lines, ~line 585) and insert:

```ts
  // --- Settings goal slider (draft-based) ---
  // Effort uses the DRAFT deadline (what the user is editing), days-left from today.
  const goalNum = clampGoal(Math.round(Number(state.goalDraft)) || GOAL_MIN);
  const draftDi = deadlineInfo(state.deadlineDraft);
  const draftDaysLeft = draftDi && draftDi.daysLeft >= 1 ? draftDi.daysLeft : 1;
  const goalPerDay = minutesPerDay(goalNum, draftDaysLeft);
  const goalEffort = effortFor(goalPerDay);
  const { p1: goalZoneP1, p2: goalZoneP2 } = effortZones(draftDaysLeft);
  const goalEffortLabel = copy.settings.goal.effort[goalEffort];
  const goalPerDayLabel = interp(copy.settings.goal.perDay, { count: goalPerDay });
  // SSR/first-paint render uses "" (matches server) → set today only after hydrate,
  // so React never sees a min-attr hydration mismatch.
  const minDeadlineISO = state.hydrated ? todayISO() : "";
```

- [ ] **Step 8: Return the new fields**

In the `return { ... }` object of `computeDerived` (before the closing `};`, after `isEditing,` line 615), add:

```ts
    goalNum,
    goalPerDay,
    goalEffort,
    goalEffortLabel,
    goalPerDayLabel,
    goalZoneP1,
    goalZoneP2,
    minDeadlineISO,
```

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. If it complains about `presetGoal` anywhere, you missed a reference in `SettingsScreen.tsx` — that's fixed in Task 6; for now confirm the errors are ONLY `Property 'presetGoal' does not exist` from `SettingsScreen.tsx`. All `lib/store.tsx` errors must be zero.

- [ ] **Step 10: Commit**

```bash
git add lib/store.tsx
git commit -m "feat(#23): derive goal/effort/zones from drafts; clamp goal; drop presetGoal"
```

---

## Task 4: Slider styling in `app/globals.css`

**Files:**
- Modify: `app/globals.css` (append a new section at the end)

Native range inputs can only be themed via vendor pseudo-elements, which inline styles can't reach — hence a class. The 3-zone tint is passed in per-render through the `--zones` custom property (set inline by `GoalField`).

- [ ] **Step 1: Append the slider styles**

Add at the end of `app/globals.css`:

```css
/* ---------------------------------------------------------------------------
   GOAL SLIDER (issue #23)
   Native <input type=range> themed to match the cards. The 3-zone track tint is
   supplied per-render via the --zones custom property (set inline in GoalField).
--------------------------------------------------------------------------- */
.goal-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 30px;
  background: transparent;
  margin: 0;
  cursor: pointer;
}
.goal-slider::-webkit-slider-runnable-track {
  height: 8px;
  border-radius: 999px;
  background: var(--zones, var(--color-field-border));
}
.goal-slider::-moz-range-track {
  height: 8px;
  border-radius: 999px;
  background: var(--zones, var(--color-field-border));
}
.goal-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 30px;
  height: 30px;
  margin-top: -11px; /* center 30px thumb on 8px track */
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 4px 12px rgba(80, 55, 25, 0.25), inset 0 0 0 4px var(--color-accent);
}
.goal-slider::-moz-range-thumb {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 4px 12px rgba(80, 55, 25, 0.25), inset 0 0 0 4px var(--color-accent);
}
.goal-slider:focus-visible {
  outline: none;
}
.goal-slider:focus-visible::-webkit-slider-thumb {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.goal-slider:focus-visible::-moz-range-thumb {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat(#23): add .goal-slider native range styling"
```

---

## Task 5: Create `components/GoalField.tsx`

**Files:**
- Create: `components/GoalField.tsx`

Self-contained card: readout (big number + per-day) → "Indsats" caption → zone labels → native range slider. Reads `derived` + `actions.setGoalDraft` only. Mirrors the inline-style conventions of `SettingsScreen.tsx`.

- [ ] **Step 1: Write the component**

Create `components/GoalField.tsx` with:

```tsx
"use client";

// Læsemål card — a single dynamic "Tempo-zoner" slider (issue #23).
//
// The slider is a native <input type="range"> (free keyboard a11y + a real value
// for tests), themed by the .goal-slider class. Difficulty = minutes/day relative
// to the deadline, so the zone tint + labels are positioned from derived fractions
// (goalZoneP1/P2) and shift/collapse as the deadline changes. All numbers come
// from `derived`; this component only maps them to layout.

import type { CSSProperties } from "react";
import { useApp } from "@/lib/store";
import { copy } from "@/lib/copy";
import { GOAL_MIN, GOAL_MAX, GOAL_STEP, type EffortKey } from "@/lib/joy";

const CARD: CSSProperties = {
  background: "#fff",
  borderRadius: 20,
  padding: 18,
  boxShadow: "0 6px 16px rgba(80,55,25,.08)",
  marginTop: 14,
};
const HEADING: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 16,
  color: "#4F4034",
};
const SUB: CSSProperties = {
  fontSize: 13,
  color: "#A9967E",
  marginTop: 4,
  lineHeight: 1.45,
};

// Zone tints (warm, no "danger" red) + active-label colors keyed by effort band.
const ZONE_TINT: Record<EffortKey, string> = {
  lille: "#EAF3DD",
  mellem: "#FBE7C4",
  stor: "#F6D3C6",
};
const LABEL_FG: Record<EffortKey, string> = {
  lille: "var(--color-easy-fg)",
  mellem: "var(--color-med-fg)",
  stor: "var(--color-hard-fg)",
};

/** A zone label is hidden when its band occupies too little of the track. */
function zoneLabel(
  key: EffortKey,
  center: number | null,
  visible: boolean,
  active: boolean,
) {
  const label = copy.settings.goal.effort[key];
  if (center == null || !visible) {
    return (
      <span key={key} aria-hidden="true" style={{ display: "none" }}>
        {label}
      </span>
    );
  }
  return (
    <span
      key={key}
      aria-hidden="true"
      style={{
        position: "absolute",
        left: `${center * 100}%`,
        transform: active ? "translateX(-50%) scale(1.06)" : "translateX(-50%)",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
        color: active ? LABEL_FG[key] : "var(--color-muted)",
        transition: "left .2s, color .2s, transform .2s",
      }}
    >
      {label}
    </span>
  );
}

export default function GoalField() {
  const { derived, actions } = useApp();
  const g = copy.settings.goal;
  const p1 = derived.goalZoneP1;
  const p2 = derived.goalZoneP2;
  const active = derived.goalEffort;

  // 3-stop gradient with hard edges at the two band boundaries.
  const zones =
    `linear-gradient(90deg,` +
    `${ZONE_TINT.lille} 0 ${(p1 * 100).toFixed(2)}%,` +
    `${ZONE_TINT.mellem} ${(p1 * 100).toFixed(2)}% ${(p2 * 100).toFixed(2)}%,` +
    `${ZONE_TINT.stor} ${(p2 * 100).toFixed(2)}% 100%)`;

  // Zone label centers + visibility (hide a zone narrower than its threshold).
  const lilleCenter = p1 > 0 ? p1 / 2 : null;
  const mellemCenter = p2 > p1 ? (p1 + p2) / 2 : null;
  const storCenter = p2 < 1 ? (p2 + 1) / 2 : null;

  return (
    <div style={CARD}>
      <div style={HEADING}>{g.heading}</div>
      <div style={SUB}>{g.sub}</div>

      {/* Readout: big total + per-day */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "16px 0 12px" }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 44,
            lineHeight: 1,
            color: "#4F4034",
            letterSpacing: "-.01em",
          }}
        >
          {derived.goalNum}
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "#A9967E" }}>
          {g.unit}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#A9967E", textAlign: "right", lineHeight: 1.3 }}>
          {derived.goalPerDayLabel}
        </span>
      </div>

      {/* Indsats caption (written once) */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "#C2B299",
          textAlign: "center",
          marginBottom: 5,
        }}
      >
        {g.effortCaption}
      </div>

      {/* Zone labels overlay */}
      <div style={{ position: "relative", height: 20, marginBottom: 8 }}>
        {zoneLabel("lille", lilleCenter, p1 > 0.07, active === "lille")}
        {zoneLabel("mellem", mellemCenter, p2 - p1 > 0.11, active === "mellem")}
        {zoneLabel("stor", storCenter, 1 - p2 > 0.07, active === "stor")}
      </div>

      {/* Native range slider — themed via .goal-slider; --zones supplies the tint */}
      <input
        type="range"
        className="goal-slider"
        min={GOAL_MIN}
        max={GOAL_MAX}
        step={GOAL_STEP}
        value={derived.goalNum}
        onChange={(e) => actions.setGoalDraft(e.target.value)}
        aria-label={g.heading}
        aria-valuetext={`${derived.goalNum} ${g.unit}, ${derived.goalEffortLabel}, ${derived.goalPerDayLabel}`}
        style={{ ["--zones" as string]: zones } as CSSProperties}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean except the still-present `presetGoal` error(s) in `SettingsScreen.tsx` (fixed next). No errors in `GoalField.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/GoalField.tsx
git commit -m "feat(#23): add GoalField tempo-zoner slider component"
```

---

## Task 6: Rewire `components/SettingsScreen.tsx`

**Files:**
- Modify: `components/SettingsScreen.tsx` (remove `PresetChip` + goal card, import + render `<GoalField/>`, move Slutdato card above it, add date `min`)

- [ ] **Step 1: Import GoalField**

After the existing imports (after line 14, `import UnlockModal ...`), add:

```tsx
import GoalField from "@/components/GoalField";
```

- [ ] **Step 2: Delete the `PresetChip` component**

Remove the entire block (lines ~182–213), from the comment banner through the function:

```tsx
// ---------------------------------------------------------------------------
// Goal preset chip
// ---------------------------------------------------------------------------

function PresetChip({
  value,
  tier,
  onClick,
}: {
  value: string;
  tier: "easy" | "med" | "hard";
  onClick: () => void;
}) {
  const bg = tier === "easy" ? "bg-easy-bg" : tier === "med" ? "bg-med-bg" : "bg-hard-bg";
  const fg = tier === "easy" ? "text-easy-fg" : tier === "med" ? "text-med-fg" : "text-hard-fg";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${bg} ${fg} ${FOCUS_RING}`}
      style={{
        flex: 1,
        padding: 11,
        borderRadius: 11,
        fontWeight: 800,
        fontSize: 15,
      }}
    >
      {value}
    </button>
  );
}
```

- [ ] **Step 3: Replace the Goal + Deadline cards with Deadline-then-GoalField**

Find the two cards (lines ~365–407):

```tsx
        {/* Card 3 — Læsemål */}
        <div style={{ ...CARD, marginBottom: 14 }}>
          <div style={CARD_HEADING}>{copy.settings.goal.heading}</div>
          <div style={CARD_SUB}>{copy.settings.goal.sub}</div>

          <div style={{ display: "flex", gap: 8, margin: "16px 0 14px" }}>
            <PresetChip value="300" tier="easy" onClick={() => actions.presetGoal("300")} />
            <PresetChip value="450" tier="med" onClick={() => actions.presetGoal("450")} />
            <PresetChip value="600" tier="hard" onClick={() => actions.presetGoal("600")} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="number"
              min={1}
              value={state.goalDraft}
              onChange={(e) => actions.setGoalDraft(e.target.value)}
              aria-label={copy.settings.goal.heading}
              className={FOCUS_RING}
              style={FIELD}
            />
            <span style={{ fontWeight: 700, color: "#A9967E", fontSize: 14 }}>
              {copy.settings.goal.unit}
            </span>
          </div>
        </div>

        {/* Card 4 — Slutdato */}
        <div style={{ ...CARD, marginTop: 14 }}>
          <div style={CARD_HEADING}>{copy.settings.deadline.heading}</div>
          <div style={CARD_SUB}>{copy.settings.deadline.sub}</div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <input
              type="date"
              value={state.deadlineDraft}
              onChange={(e) => actions.setDeadlineDraft(e.target.value)}
              aria-label={copy.settings.deadline.heading}
              className={FOCUS_RING}
              style={FIELD}
            />
          </div>
        </div>
```

Replace with (Slutdato first — it drives the calc — then the slider; date picker blocks past dates):

```tsx
        {/* Card 3 — Slutdato (chosen first; drives the effort calc) */}
        <div style={{ ...CARD, marginBottom: 14 }}>
          <div style={CARD_HEADING}>{copy.settings.deadline.heading}</div>
          <div style={CARD_SUB}>{copy.settings.deadline.sub}</div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <input
              type="date"
              value={state.deadlineDraft}
              min={derived.minDeadlineISO || undefined}
              onChange={(e) => actions.setDeadlineDraft(e.target.value)}
              aria-label={copy.settings.deadline.heading}
              className={FOCUS_RING}
              style={FIELD}
            />
          </div>
        </div>

        {/* Card 4 — Læsemål (tempo-zoner slider) */}
        <GoalField />
```

- [ ] **Step 4: Confirm no dangling references**

`state.goalDraft` is no longer read in `SettingsScreen.tsx` (GoalField owns it) — that's fine. `FIELD`, `CARD`, `CARD_HEADING`, `CARD_SUB`, `FOCUS_RING` are still used (name card, deadline card). Do not delete them.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint .`
Expected: clean. (Any `presetGoal` / unused-var error means a leftover — fix it.)

- [ ] **Step 6: Build (static export must still succeed)**

Run: `npm run build`
Expected: build completes, `postbuild` injects the SW assets, `./out` is produced with no errors.

- [ ] **Step 7: Commit**

```bash
git add components/SettingsScreen.tsx
git commit -m "feat(#23): swap goal chips/number for GoalField, deadline-first order"
```

---

## Task 7: Update + extend e2e tests

**Files:**
- Modify: `e2e/app.spec.ts`

Reading goal is now a slider (`getByLabel("Læsemål")` resolves to the range input; its `.value` and keyboard work). Step is 50, so 450→300 is 3× `ArrowLeft`.

- [ ] **Step 1: Rewrite the "start a challenge" test to use the slider**

Find (lines 63–73):

```tsx
test("start a challenge from settings → ongoing + locked banner", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start en udfordring" }).click();
  await page.getByPlaceholder("Max").fill("Bella");
  await page.getByRole("button", { name: "300", exact: true }).click();
  await page.getByRole("button", { name: "Start udfordringen" }).click();
  await expect(page.getByText("0 / 300 min")).toBeVisible();
  await page.getByRole("button", { name: "Indstillinger" }).click();
  await expect(page.getByText("Der er en udfordring i gang")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rediger udfordring" })).toBeVisible();
});
```

Replace with:

```tsx
test("start a challenge from settings → ongoing + locked banner", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start en udfordring" }).click();
  await page.getByPlaceholder("Max").fill("Bella");
  // Slider seeds at 450; step is 50, so three ArrowLeft presses → 300.
  const goal = page.getByLabel("Læsemål");
  await goal.focus();
  await goal.press("ArrowLeft");
  await goal.press("ArrowLeft");
  await goal.press("ArrowLeft");
  await expect(goal).toHaveValue("300");
  await page.getByRole("button", { name: "Start udfordringen" }).click();
  await expect(page.getByText("0 / 300 min")).toBeVisible();
  await page.getByRole("button", { name: "Indstillinger" }).click();
  await expect(page.getByText("Der er en udfordring i gang")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rediger udfordring" })).toBeVisible();
});
```

- [ ] **Step 2: Fix the "editing shows saved goal" test for clamping**

Find (lines 82–95) and change the seeded goal to an in-range value so it asserts the real saved value (still 1000 would now clamp to 750). Replace `goal: "1000"` on line 83 and the assertion on line 94:

```tsx
test("editing an ongoing challenge shows its real saved goal + deadline", async ({ page, context }) => {
  await seed(context, { goal: "600", challenge: "ongoing", name: "Max", deadline: iso(20) });
  await page.goto("./");
  await page.getByRole("button", { name: "Indstillinger" }).click();
  // Unlock via the math gate to reveal the editable form.
  await page.getByRole("button", { name: "Rediger udfordring" }).click();
  const dialog = page.getByRole("dialog");
  const problem = (await dialog.getByText(/\d+\s*\+\s*\d+/).first().textContent()) ?? "";
  const m = problem.match(/(\d+)\s*\+\s*(\d+)/);
  await dialog.getByRole("spinbutton").fill(String(Number(m![1]) + Number(m![2])));
  await dialog.getByRole("button", { name: "Lås op" }).click();
  // Real saved values, not the none-defaults (450 / today+30).
  await expect(page.getByLabel("Læsemål")).toHaveValue("600");
  await expect(page.getByLabel("Slutdato")).toHaveValue(iso(20));
});
```

- [ ] **Step 3: Add a legacy-clamp test**

Add immediately after the test from Step 2:

```tsx
test("a legacy out-of-range goal clamps into the slider range", async ({ page, context }) => {
  await seed(context, { goal: "1000", challenge: "ongoing", name: "Max", deadline: iso(20) });
  await page.goto("./");
  await page.getByRole("button", { name: "Indstillinger" }).click();
  await page.getByRole("button", { name: "Rediger udfordring" }).click();
  const dialog = page.getByRole("dialog");
  const problem = (await dialog.getByText(/\d+\s*\+\s*\d+/).first().textContent()) ?? "";
  const m = problem.match(/(\d+)\s*\+\s*(\d+)/);
  await dialog.getByRole("spinbutton").fill(String(Number(m![1]) + Number(m![2])));
  await dialog.getByRole("button", { name: "Lås op" }).click();
  // 1000 is above GOAL_MAX (750) → the slider shows the clamped value.
  await expect(page.getByLabel("Læsemål")).toHaveValue("750");
});
```

- [ ] **Step 4: Add an effort-by-deadline test (the core feature)**

Add after the legacy-clamp test. Asserts the per-day readout recomputes when the deadline changes (450 over 30 days = 15/dag; over 90 days = 5/dag):

```tsx
test("effort/per-day recomputes from the deadline", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start en udfordring" }).click();
  // Default draft: goal 450, deadline today+30 → 450/30 = 15 min/dag.
  await expect(page.getByText("Ca. 15 min om dagen")).toBeVisible();
  // Push the deadline out to today+90 → 450/90 = 5 min/dag.
  await page.getByLabel("Slutdato").fill(iso(90));
  await expect(page.getByText("Ca. 5 min om dagen")).toBeVisible();
  await expect(page.getByText("Ca. 15 min om dagen")).toHaveCount(0);
});
```

- [ ] **Step 5: Build, then run the full e2e suite**

`test:e2e` runs against `./out` and does NOT build — build first (already done in Task 6, but rebuild to include the test-affecting source):

Run: `npm run build && npm run test:e2e`
Expected: all tests PASS, including the four touched/added above.

If the effort test is flaky on the day-count boundary (UTC CI vs local), confirm the seeded `iso()` and the app's `isoPlusDays` agree in the test environment (both compute UTC in CI). The numbers 15 and 5 assume `daysLeft` of exactly 30 and 90.

- [ ] **Step 6: Commit**

```bash
git add e2e/app.spec.ts
git commit -m "test(#23): cover goal slider keyboard, clamp, and deadline-relative effort"
```

---

## Task 8: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the complete gate from CLAUDE.md**

Run: `npx tsc --noEmit && npx eslint . && npm run build && npm run test:e2e`
Expected: every command exits 0, e2e suite green.

- [ ] **Step 2: Manual smoke (preview the real app, not the sketch)**

Start `npm run dev`, open `http://localhost:3000/reading-challenge/`, go to Settings via the start flow, and confirm:
- Slutdato card is **above** Læsemål.
- Dragging the slider moves in 50s between 200 and 750; arrow keys step 50.
- The "INDSATS" caption appears once; Lille/Mellem/Stor highlight follows the value.
- Changing the deadline shifts the zones / per-day text; a 3-month deadline collapses to a single "Lille" zone (expected).
- The date picker won't accept a past date.

- [ ] **Step 3: Final commit (if any smoke fixes were needed)**

```bash
git add -A
git commit -m "fix(#23): polish goal slider per manual smoke"
```

---

## Self-Review

**1. Spec coverage** (issue #23 FINAL SPEC → task):
- Single drag slider, no preset chips → Task 5 + Task 6 ✅
- Range 200–750, step 50 → `GOAL_MIN/MAX/STEP` (Task 1), wired in Task 5 ✅
- Big number + "min" + "Ca. X min om dagen" → Task 5 readout ✅
- "INDSATS" caption once + Lille/Mellem/Stor → Task 2 copy + Task 5 ✅
- Track tinted into 3 zones, boundaries shift/collapse → `effortZones` (Task 1) + `--zones` gradient (Task 5) ✅
- `min/dag = mål ÷ dage-tilbage`; bands 0–9/10–20/21+ → `minutesPerDay`/`effortFor` (Task 1), derived (Task 3) ✅
- Edit recalc = total ÷ days-left-from-today → `draftDaysLeft` from `deadlineInfo(deadlineDraft)` (Task 3) ✅
- Deadline unchanged + reordered above goal → Task 6 Step 3 ✅
- Block past dates → `min={derived.minDeadlineISO}` (Task 3 Step 7 + Task 6 Step 3) ✅
- Clamp legacy out-of-range goals → `clampGoal` in `seedDrafts` + commits (Task 3) ✅
- Remove PresetChip / presetGoal → Task 3 Step 5 + Task 6 Step 2 ✅
- Math in joy.ts (pure) → store derived → component presentational → Tasks 1/3/5 ✅
- Copy in da.json, no hardcoded Danish → Task 2; component reads `copy.*` ✅
- Slider keyboard + ARIA → native range (arrows = step), `aria-label` + `aria-valuetext` (Task 5) ✅
- Keep lock-gating wrapper → `<GoalField/>` sits inside the existing `inert`/dim wrapper (unchanged in Task 6) ✅

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to"/"add validation" — every code step shows complete code. ✅

**3. Type consistency:** `EffortKey` defined in Task 1, imported in Tasks 3 & 5. Derived field names (`goalNum`, `goalPerDay`, `goalEffort`, `goalEffortLabel`, `goalPerDayLabel`, `goalZoneP1`, `goalZoneP2`, `minDeadlineISO`) are declared in the `Derived` interface (Task 3 Step 6), returned (Step 8), and read in `GoalField` (Task 5) under the same names. `setGoalDraft` is preserved; `presetGoal` is fully removed (action type, reducer case, interface, binding, JSX usage). `copy.settings.goal.effort[key]` keys (`lille/mellem/stor`) match `EffortKey`. ✅
