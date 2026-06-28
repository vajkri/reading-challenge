# Seasonal Bingo Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4th "Bingo" page where a kid crosses off bonus reading feats on a 3×5 board, scoped to a provider-defined seasonal window, with celebratory confetti on row/board completion.

**Architecture:** Bingo is a standalone feature parallel to the progress tracker — it never touches minutes/goal. A pure domain layer (`lib/bingo.ts`) holds the season config + date/row math (mirroring `lib/joy.ts`). State lives in the existing reducer (`lib/store.tsx`): a new `bingo` persisted slice (completed feat ids keyed by season id) + a transient `bingoConfetti` UI flag. The screen (`BingoScreen` + `BingoModal`) is presentational, reading `derived.bingo` and calling `actions.toggleFeat`. The active season is resolved by today's date; off-season shows a teaser.

**Tech Stack:** Next.js (static export), React 19, TypeScript, Tailwind v4 tokens (`globals.css`), Playwright e2e. All Danish copy via `copy/da.json` + `@/lib/copy`.

**Testing strategy (project-specific):** This repo has **no unit-test runner** — only Playwright e2e (`e2e/app.spec.ts`, runs against `./out`). Pure/logic tasks are verified by `npx tsc --noEmit && npx eslint .` and `npm run build`; user-observable behaviour is verified by e2e specs (Task 8) that mock the clock with `page.clock` so seasonal date logic is deterministic in CI. Commit after every task.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `lib/types.ts` | Add `SeasonId`, `BingoState` types; add `bingo` to `PersistedState` | Modify |
| `lib/bingo.ts` | Pure season config + date/row math (no React/DOM/copy) | Create |
| `lib/storage.ts` | New `sommerlaesning.v1.bingo` key: DEFAULTS, decode, saver | Modify |
| `copy/da.json` | `bingo` copy block (nav, title, teaser, modal, season + 15 feats) | Modify |
| `lib/store.tsx` | `"bingo"` screen, `bingoConfetti` flag, `TOGGLE_FEAT`, derived `bingo`, actions | Modify |
| `components/BingoConfetti.tsx` | Event-based CSS confetti burst (row vs board intensity) | Create |
| `components/BingoModal.tsx` | Feat detail bottom-sheet (emoji, title, desc, mark/undo) + focus trap | Create |
| `components/BingoScreen.tsx` | The board: 3×5 grid, teaser, modal wiring, confetti | Create |
| `components/BottomNav.tsx` | 4th "Bingo" tab | Modify |
| `components/AppShell.tsx` | Render `<BingoScreen/>` when `screen === "bingo"` | Modify |
| `e2e/app.spec.ts` | Bingo behaviour specs (clock-mocked) | Modify |

---

## Task 1: Bingo types

**Files:**
- Modify: `lib/types.ts` (append after `PersistedState`)

- [ ] **Step 1: Add the bingo types and extend `PersistedState`**

In `lib/types.ts`, add the two new types and one new field on `PersistedState`:

```typescript
/** Identifier for a bingo season (e.g. "sommer-26"). */
export type SeasonId = string;

/**
 * Completed bingo feats, keyed by season id → list of completed feat ids.
 * Per-season so each season keeps a fresh board without losing prior crosses.
 */
export type BingoState = Record<SeasonId, string[]>;
```

And add `bingo` to the `PersistedState` interface (keep the other 7 fields unchanged):

```typescript
export interface PersistedState {
  entries: Entry[];
  goal: number; // target minutes
  name: string; // mascot display name (default "Max")
  deadline: string; // ISO YYYY-MM-DD or ""
  locked: boolean; // parental lock
  challenge: ChallengeStatus;
  mascot: MascotKey;
  bingo: BingoState; // per-season completed feat ids
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: FAIL — `lib/storage.ts` `DEFAULTS` (and `migrate`) now miss the `bingo` property (`Property 'bingo' is missing`). This is expected; Task 2 fixes it. (No other consumers construct a full `PersistedState`.)

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(bingo): add SeasonId + BingoState types"
```

---

## Task 2: Bingo domain layer (season config + pure math)

**Files:**
- Create: `lib/bingo.ts`

This file is pure (like `lib/joy.ts`): no React, no DOM, no `copy` import. It holds the **structural** season config (ids, dates, emoji, feat order) — the localized titles/descriptions live in `copy/da.json` (Task 3) and are merged in the store (Task 5).

- [ ] **Step 1: Create `lib/bingo.ts`**

```typescript
// Pure domain layer for the seasonal reading-bingo feature.
//
// Mirrors the purity of lib/joy.ts: no React, no DOM, no copy import. Holds the
// STRUCTURAL season config (ids, date windows, emoji, feat order) plus the date
// + grid math. Localized feat titles/descriptions live in copy/da.json and are
// merged with this structural data in the store's computeDerived().

import type { SeasonId } from "@/lib/types";

/** A feat's structural definition: stable id + its emoji. Title/desc are in copy. */
export interface SeasonFeatDef {
  id: string;
  emoji: string;
}

/** A season: id + inclusive ISO date window + ordered feats (length = BOARD_SIZE). */
export interface SeasonDef {
  id: SeasonId;
  start: string; // ISO YYYY-MM-DD, inclusive
  end: string; // ISO YYYY-MM-DD, inclusive
  feats: SeasonFeatDef[];
}

/** Grid geometry. 3 across suits the mobile width; 5 rows → 15 tiles. */
export const COLS = 3;
export const ROWS = 5;
export const BOARD_SIZE = COLS * ROWS; // 15

/**
 * Provider-defined seasons. Launching a new season = add an entry here + its
 * copy block in copy/da.json, then deploy. Windows must not overlap (the first
 * matching window wins). Feat order is the on-screen order, row by row.
 */
export const SEASONS: SeasonDef[] = [
  {
    id: "sommer-26",
    start: "2026-06-01",
    end: "2026-08-31",
    feats: [
      { id: "ven", emoji: "👫" },
      { id: "natur", emoji: "🌳" },
      { id: "ferie", emoji: "✈️" },
      { id: "liggende", emoji: "🛋️" },
      { id: "blad", emoji: "📰" },
      { id: "sprog", emoji: "🌍" },
      { id: "digt", emoji: "🪶" },
      { id: "lydbog", emoji: "🎧" },
      { id: "solbriller", emoji: "🕶️" },
      { id: "kreativt", emoji: "🎨" },
      { id: "dyr", emoji: "🐶" },
      { id: "alene", emoji: "🧒" },
      { id: "hojt", emoji: "📣" },
      { id: "eventyr", emoji: "🧙" },
      { id: "strand", emoji: "🏖️" },
    ],
  },
];

/** Local-midnight Date from an ISO YYYY-MM-DD, or null if malformed. */
function parseISO(iso: string): Date | null {
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

/**
 * The season whose [start, end] window contains `today` (inclusive), else null.
 * Compares at local-midnight granularity so the boundary days are inside.
 */
export function activeSeason(seasons: SeasonDef[], today: Date): SeasonDef | null {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  for (const s of seasons) {
    const start = parseISO(s.start);
    const end = parseISO(s.end);
    if (!start || !end) continue;
    if (t >= start.getTime() && t <= end.getTime()) return s;
  }
  return null;
}

/** Horizontal row index groups (e.g. [[0,1,2],[3,4,5],...]) for a feat list. */
export function rowGroups(size: number): number[][] {
  const rows: number[][] = [];
  for (let r = 0; r < size; r += COLS) {
    rows.push(Array.from({ length: COLS }, (_, c) => r + c));
  }
  return rows;
}

/** True when every feat in the season is in the done-set. */
export function isBoardComplete(feats: SeasonFeatDef[], done: Set<string>): boolean {
  return feats.length > 0 && feats.every((f) => done.has(f.id));
}

/** Number of fully-completed horizontal rows for a given done-set. */
export function completedRowCount(feats: SeasonFeatDef[], done: Set<string>): number {
  return rowGroups(feats.length).filter((row) =>
    row.every((i) => feats[i] !== undefined && done.has(feats[i].id)),
  ).length;
}
```

- [ ] **Step 2: Fix `lib/storage.ts` so the project compiles again**

In `lib/storage.ts`, add `bingo: {}` to `DEFAULTS` (it currently lists the 7 fields):

```typescript
export const DEFAULTS: PersistedState = {
  entries: [],
  goal: 1000,
  name: "Max",
  deadline: "",
  locked: false,
  challenge: "none",
  mascot: "cat",
  bingo: {},
};
```

Also import `BingoState` at the top (extend the existing type import):

```typescript
import type {
  PersistedState,
  Entry,
  MascotKey,
  ChallengeStatus,
  BingoState,
} from "@/lib/types";
```

> Note: `migrate()` and `loadState()` still don't thread `bingo` — Task 3... no, **Task 2 Step 3** wires the read/save path. Do it now (below) so this task leaves the build green.

- [ ] **Step 3: Add the bingo key, decode, and saver in `lib/storage.ts`**

Add the key to `KEYS` (after `mascot`):

```typescript
export const KEYS = {
  entries: "sommerlaesning.v1.entries",
  goal: "sommerlaesning.v1.goal",
  name: "sommerlaesning.v1.name",
  deadline: "sommerlaesning.v1.deadline",
  locked: "sommerlaesning.v1.locked",
  challenge: "sommerlaesning.v1.challenge",
  mascot: "sommerlaesning.v1.mascot",
  bingo: "sommerlaesning.v1.bingo",
} as const;
```

In `loadState()`, after the `mascot` decode block and before the `challenge` decode block, add the bingo decode (JSON object, guard corrupt → `{}`):

```typescript
  // bingo — JSON object { seasonId: string[] }, guard corrupt → {}
  let bingo: BingoState = {};
  try {
    const raw = window.localStorage.getItem(KEYS.bingo);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        bingo = parsed as BingoState;
      }
    }
  } catch {
    bingo = {};
  }
```

Update the `return migrate({ ... })` call at the end of `loadState()` to include `bingo`:

```typescript
  return migrate({ entries, goal, name, deadline, locked, mascot, challenge, bingo });
```

Update `migrate()`'s parameter type and destructuring + return to thread `bingo` through unchanged (it has no migration rules — it just needs to survive the round-trip):

```typescript
function migrate(decoded: {
  entries: Entry[];
  goal: number;
  name: string;
  deadline: string;
  locked: boolean;
  mascot: MascotKey;
  challenge: ChallengeStatus | null;
  bingo: BingoState;
}): PersistedState {
  const { entries, goal, name, deadline, locked, mascot, bingo } = decoded;
  let challenge = decoded.challenge;

  // Rule 1: derive status for existing users when the key was never written.
  if (challenge == null) {
    challenge = entries.length > 0 || locked ? "ongoing" : "none";
    saveChallenge(challenge);
  }

  // Rule 2: auto-complete an ongoing challenge that already met its goal.
  if (challenge === "ongoing" && totalMinutes(entries) >= goal) {
    challenge = "completed";
    saveChallenge(challenge);
  }

  return { entries, goal, name, deadline, locked, challenge, mascot, bingo };
}
```

Add the saver at the end of the file, next to the other per-key savers:

```typescript
export function saveBingo(bingo: BingoState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYS.bingo, JSON.stringify(bingo));
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: Verify types + lint are clean**

Run: `npx tsc --noEmit && npx eslint .`
Expected: PASS (clean). The `bingo` slice now round-trips through storage and `DEFAULTS`/`migrate` are complete.

- [ ] **Step 5: Commit**

```bash
git add lib/bingo.ts lib/storage.ts
git commit -m "feat(bingo): add pure season domain layer + persisted bingo slice"
```

---

## Task 3: Bingo copy (Danish strings + season-1 feats)

**Files:**
- Modify: `copy/da.json`

All user-facing Danish lives here (project hard rule). The structural ids/emoji/dates from `lib/bingo.ts` are merged with these strings in the store. Feat keys MUST match the `id`s in `SEASONS[0].feats`.

- [ ] **Step 1: Add the `bingo` block to `copy/da.json`**

Add a top-level `"bingo"` key (e.g. after `"settings"`). Keep valid JSON (comma after the preceding block):

```json
  "bingo": {
    "nav": "Bingo",
    "title": "Læsebingo",
    "countLabel": "{done} af {total} felter",
    "teaser": {
      "heading": "Ingen bingo lige nu",
      "sub": "Næste sæson kommer snart – hold øje!"
    },
    "modal": {
      "markDone": "Marker som færdig",
      "undo": "Fortryd",
      "doneState": "✓ Færdig!",
      "close": "Luk"
    },
    "seasons": {
      "sommer-26": {
        "name": "Sommer '26",
        "feats": {
          "ven": { "card": "Ven", "title": "Læs med en ven", "desc": "Læs en bog sammen med en kammerat." },
          "natur": { "card": "Natur", "title": "Læs i naturen", "desc": "Find et træ eller en bænk udenfor og læs der." },
          "ferie": { "card": "Ferie", "title": "Læs på ferie", "desc": "Tag en bog med, når I er væk hjemmefra." },
          "liggende": { "card": "Liggende", "title": "Læs liggende", "desc": "Læg dig godt til rette og læs." },
          "blad": { "card": "Blad", "title": "Læs i et blad", "desc": "Læs et magasin, en tegneserie eller en avis." },
          "sprog": { "card": "Sprog", "title": "Læs på et andet sprog", "desc": "Læs noget på et andet sprog end dansk." },
          "digt": { "card": "Digt", "title": "Læs et digt", "desc": "Find et digt og læs det højt." },
          "lydbog": { "card": "Lydbog", "title": "Lyt til en lydbog", "desc": "Hør en lydbog – det tæller også!" },
          "solbriller": { "card": "Solbriller", "title": "Læs med solbriller", "desc": "Tag solbriller på og læs i solen." },
          "kreativt": { "card": "Kreativt", "title": "Læs kreativt", "desc": "Læs et sted eller på en måde, du aldrig har prøvet." },
          "dyr": { "card": "Dyr", "title": "Læs for et dyr", "desc": "Læs højt for et kæledyr eller et bamsedyr." },
          "alene": { "card": "Alene", "title": "Læs alene", "desc": "Find et roligt sted og læs helt for dig selv." },
          "hojt": { "card": "Højt", "title": "Læs højt", "desc": "Læs en historie højt for nogen." },
          "eventyr": { "card": "Eventyr", "title": "Læs et eventyr", "desc": "Læs et klassisk eventyr." },
          "strand": { "card": "Strand", "title": "Læs på stranden", "desc": "Tag en bog med på stranden." }
        }
      }
    }
  }
```

- [ ] **Step 2: Verify JSON parses and types still compile**

Run: `npx tsc --noEmit && node -e "require('./copy/da.json'); console.log('json ok')"`
Expected: PASS + `json ok`. (`copy` is typed as `typeof da`, so the new keys become available to the store in Task 5.)

- [ ] **Step 3: Commit**

```bash
git add copy/da.json
git commit -m "feat(bingo): add Danish copy + Sommer '26 feats"
```

---

## Task 4: Store — screen, state, reducer, confetti flag

**Files:**
- Modify: `lib/store.tsx`

- [ ] **Step 1: Extend the `Screen` union and imports**

Change the `Screen` type:

```typescript
export type Screen = "progress" | "log" | "settings" | "bingo";
```

Extend the storage import to include `saveBingo`, and add the bingo domain import. Update the existing import blocks:

```typescript
import {
  DEFAULTS,
  loadState,
  newId,
  saveBingo,
  saveChallenge,
  saveDeadline,
  saveEntries,
  saveGoal,
  saveLocked,
  saveMascot,
  saveName,
  totalMinutes,
} from "@/lib/storage";
import { joyForPct, pctFor, ringOffset, deadlineInfo } from "@/lib/joy";
import {
  SEASONS,
  activeSeason,
  isBoardComplete,
  completedRowCount,
} from "@/lib/bingo";
```

- [ ] **Step 2: Add the transient confetti flag to `UIState` and `INITIAL`**

In `interface UIState`, add (near `flashId`):

```typescript
  // Transient bingo celebration: set on a feat-toggle that newly completes a
  // row/board, auto-cleared by a timer (NOT persisted). "board" outranks "row".
  bingoConfetti: "none" | "row" | "board";
```

In `const INITIAL: State`, add:

```typescript
  bingoConfetti: "none",
```

- [ ] **Step 3: Add the actions to the `Action` union**

Add two members to the `Action` type union:

```typescript
  | { type: "TOGGLE_FEAT"; seasonId: string; featId: string }
  | { type: "CLEAR_BINGO_CONFETTI" }
```

- [ ] **Step 4: Add the reducer cases**

Add these cases to `reducer` (before `default:`):

```typescript
    case "TOGGLE_FEAT": {
      const season = SEASONS.find((s) => s.id === action.seasonId);
      if (!season) return state;

      const prev = state.bingo[action.seasonId] ?? [];
      const wasDone = prev.includes(action.featId);
      const next = wasDone
        ? prev.filter((id) => id !== action.featId)
        : [...prev, action.featId];
      const bingo = { ...state.bingo, [action.seasonId]: next };

      // Confetti only when COMPLETING (not undoing) and a new row/board lands.
      let bingoConfetti = state.bingoConfetti;
      if (!wasDone) {
        const before = new Set(prev);
        const after = new Set(next);
        const boardNew = isBoardComplete(season.feats, after) && !isBoardComplete(season.feats, before);
        const rowNew = completedRowCount(season.feats, after) > completedRowCount(season.feats, before);
        if (boardNew) bingoConfetti = "board";
        else if (rowNew) bingoConfetti = "row";
      }

      return { ...state, bingo, bingoConfetti };
    }

    case "CLEAR_BINGO_CONFETTI":
      return { ...state, bingoConfetti: "none" };
```

- [ ] **Step 5: Verify types + lint**

Run: `npx tsc --noEmit && npx eslint .`
Expected: FAIL — `Derived`/`Actions`/`AppProvider` don't yet expose the bingo bits, but only if referenced. At this point nothing references them yet, so this should actually **PASS**. If it passes, good. (Derived + actions land in Task 5.)

- [ ] **Step 6: Commit**

```bash
git add lib/store.tsx
git commit -m "feat(bingo): add bingo screen, state slice, toggle reducer + confetti flag"
```

---

## Task 5: Store — derived values, actions, persistence

**Files:**
- Modify: `lib/store.tsx`

- [ ] **Step 1: Add the derived view types**

Add these interfaces near the other derived interfaces (`RecentBook`, `EntryView`):

```typescript
export interface BingoFeatView {
  id: string;
  emoji: string;
  card: string; // single-word card label
  title: string; // full feat title (modal)
  desc: string; // one-sentence description (modal)
  done: boolean;
}

export interface BingoView {
  active: boolean; // a season window contains today
  seasonId: string | null;
  seasonName: string;
  feats: BingoFeatView[];
  doneCount: number;
  boardComplete: boolean;
  confetti: "none" | "row" | "board";
}
```

Add `bingo: BingoView;` to the `Derived` interface (anywhere in it).

- [ ] **Step 2: Add a typed copy accessor + compute the bingo derived value**

At the top of `computeDerived` (or as module-level helpers above it), add the typed accessor for the season copy (the JSON-derived `copy` type can't be indexed by an arbitrary string):

```typescript
// copy.bingo.seasons is keyed by season id; index it through a Record cast
// because the JSON-inferred type only knows the literal "sommer-26" key.
interface FeatCopy { card: string; title: string; desc: string }
interface SeasonCopy { name: string; feats: Record<string, FeatCopy> }
```

(Place those two interfaces at module scope, near the other interfaces.)

Inside `computeDerived`, before the `return`, build the bingo view:

```typescript
  // ---- Bingo (standalone; independent of the challenge lifecycle) ----
  const season = activeSeason(SEASONS, new Date());
  let bingo: BingoView;
  if (!season) {
    bingo = {
      active: false,
      seasonId: null,
      seasonName: "",
      feats: [],
      doneCount: 0,
      boardComplete: false,
      confetti: state.bingoConfetti,
    };
  } else {
    const doneIds = new Set(state.bingo[season.id] ?? []);
    const seasonsCopy = copy.bingo.seasons as unknown as Record<string, SeasonCopy>;
    const sc = seasonsCopy[season.id];
    const feats: BingoFeatView[] = season.feats.map((f) => {
      const fc = sc.feats[f.id];
      return {
        id: f.id,
        emoji: f.emoji,
        card: fc.card,
        title: fc.title,
        desc: fc.desc,
        done: doneIds.has(f.id),
      };
    });
    bingo = {
      active: true,
      seasonId: season.id,
      seasonName: sc.name,
      feats,
      doneCount: doneIds.size,
      boardComplete: isBoardComplete(season.feats, doneIds),
      confetti: state.bingoConfetti,
    };
  }
```

Add `bingo,` to the object returned by `computeDerived`.

- [ ] **Step 3: Add the bound actions**

Add to the `Actions` interface:

```typescript
  goBingo: () => void;
  toggleFeat: (featId: string) => void;
```

Add to the `useMemo` actions object in `AppProvider`:

```typescript
      goBingo: () => dispatch({ type: "SET_SCREEN", screen: "bingo" }),
      toggleFeat: (featId) => {
        const s = activeSeason(SEASONS, new Date());
        if (s) dispatch({ type: "TOGGLE_FEAT", seasonId: s.id, featId });
      },
```

- [ ] **Step 4: Add persistence + confetti-clear effects**

In `AppProvider`, add a persistence effect next to the other `saveX` effects:

```typescript
  useEffect(() => {
    if (state.hydrated) saveBingo(state.bingo);
  }, [state.bingo, state.hydrated]);
```

And add the auto-clear timer next to the flash-clear effect:

```typescript
  // Auto-clear the bingo row/board confetti after its run (~2.5s).
  useEffect(() => {
    if (state.bingoConfetti === "none") return;
    const t = setTimeout(() => dispatch({ type: "CLEAR_BINGO_CONFETTI" }), 2500);
    return () => clearTimeout(t);
  }, [state.bingoConfetti]);
```

- [ ] **Step 5: Verify types + lint**

Run: `npx tsc --noEmit && npx eslint .`
Expected: PASS (clean). The store now exposes `derived.bingo` + `actions.goBingo`/`toggleFeat` and persists the slice.

- [ ] **Step 6: Commit**

```bash
git add lib/store.tsx
git commit -m "feat(bingo): derive bingo view, bind toggle/nav actions, persist slice"
```

---

## Task 6: BingoConfetti + BingoModal components

**Files:**
- Create: `components/BingoConfetti.tsx`
- Create: `components/BingoModal.tsx`

- [ ] **Step 1: Create `components/BingoConfetti.tsx`**

Event-based burst reusing the `mons-fall` keyframe. `board` drops more pieces than `row`. Pure render (deterministic pieces, no `Math.random`).

```tsx
"use client";

// Event-based confetti for the bingo board. Unlike ProgressScreen's steady-state
// burst, this mounts when `mode` flips to "row"/"board" (a feat-toggle that newly
// completes a row or the whole board) and the store clears it on a timer. CSS-only
// via the mons-fall keyframe; absolutely positioned, inert, aria-hidden.

const COLORS = ["#F6A623", "#7FC8A9", "#F39A8B", "#BBA7E0", "#FFCE52", "#5C8A3F"];

function pieces(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    left: ((i * 53 + 11) % 96) + "%",
    color: COLORS[i % COLORS.length],
    size: 8 + (i % 4) * 2,
    delay: ((i % 6) * 0.1).toFixed(2) + "s",
    dur: (1.3 + (i % 3) * 0.25).toFixed(2) + "s",
    round: i % 2 === 0,
  }));
}

const ROW_PIECES = pieces(14);
const BOARD_PIECES = pieces(28);

export default function BingoConfetti({ mode }: { mode: "none" | "row" | "board" }) {
  if (mode === "none") return null;
  const ps = mode === "board" ? BOARD_PIECES : ROW_PIECES;
  return (
    <div
      aria-hidden
      data-testid="bingo-confetti"
      data-mode={mode}
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
    >
      {ps.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: -16,
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.round ? "50%" : "2px",
            animation: `mons-fall ${p.dur} linear ${p.delay} 2 both`,
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/BingoModal.tsx`**

Bottom-sheet feat detail. Focus-trap + Escape + restore focus, copied from `NewChallengeModal.tsx`. Receives the selected `feat` (a `BingoFeatView`) and callbacks.

```tsx
"use client";

// Bingo feat detail bottom-sheet: big emoji, full title, one-line description,
// and a Mark-as-done / Undo button. Screen-local (driven by BingoScreen state,
// not the global store) since it's purely presentational. Focus-trap + Escape +
// focus-restore mirror NewChallengeModal.tsx.

import { useEffect, useRef } from "react";
import type { BingoFeatView } from "@/lib/store";
import { copy } from "@/lib/copy";

export default function BingoModal({
  feat,
  onToggle,
  onClose,
}: {
  feat: BingoFeatView;
  onToggle: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    actionRef.current?.focus();
    return () => {
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialog.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(60,42,22,.42)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 40,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={feat.title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: "#FFF6E9",
          borderRadius: "24px 24px 0 0",
          padding: "26px 22px calc(22px + env(safe-area-inset-bottom))",
          textAlign: "center",
          boxShadow: "0 -10px 30px rgba(60,42,22,.28)",
          animation: "mons-sheet .26s ease-out",
        }}
      >
        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 8 }}>{feat.emoji}</div>
        <div
          style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "#4F4034" }}
        >
          {feat.title}
        </div>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.45,
            color: "#8A7559",
            fontWeight: 600,
            margin: "8px auto 20px",
            maxWidth: "30ch",
          }}
        >
          {feat.desc}
        </p>

        {feat.done && (
          <div
            style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "#4C7A2E", marginBottom: 14 }}
          >
            {copy.bingo.modal.doneState}
          </div>
        )}

        <button
          ref={actionRef}
          type="button"
          onClick={onToggle}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{
            width: "100%",
            padding: 15,
            borderRadius: 16,
            border: feat.done ? "2px solid #7BAE52" : "0",
            background: feat.done ? "transparent" : "#5C8A3F",
            color: feat.done ? "#4C7A2E" : "#fff",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 17,
          }}
        >
          {feat.done ? copy.bingo.modal.undo : copy.bingo.modal.markDone}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{
            marginTop: 12,
            background: "none",
            border: 0,
            color: "#A9967E",
            fontFamily: "var(--font-body)",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {copy.bingo.modal.close}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify types + lint**

Run: `npx tsc --noEmit && npx eslint .`
Expected: PASS (clean). (`BingoFeatView` is exported from `lib/store.tsx` in Task 5.)

- [ ] **Step 4: Commit**

```bash
git add components/BingoConfetti.tsx components/BingoModal.tsx
git commit -m "feat(bingo): add confetti burst + feat detail modal components"
```

---

## Task 7: BingoScreen + nav + shell wiring

**Files:**
- Create: `components/BingoScreen.tsx`
- Modify: `components/BottomNav.tsx`
- Modify: `components/AppShell.tsx`

- [ ] **Step 1: Create `components/BingoScreen.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { copy, interp } from "@/lib/copy";
import BingoModal from "@/components/BingoModal";
import BingoConfetti from "@/components/BingoConfetti";

const display = { fontFamily: "var(--font-display)" } as const;

export default function BingoScreen() {
  const { derived, actions } = useApp();
  const b = derived.bingo;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Off-season: a season tab exists but no active board → teaser.
  if (!b.active) {
    return (
      <section data-screen-label="Bingo" style={{ paddingTop: 40, textAlign: "center" }}>
        <h2 className="sr-only">{copy.bingo.nav}</h2>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🎟️</div>
        <div style={{ ...display, fontWeight: 800, fontSize: 20, color: "#4F4034" }}>
          {copy.bingo.teaser.heading}
        </div>
        <p style={{ fontSize: 14, color: "#A9967E", fontWeight: 600, marginTop: 8 }}>
          {copy.bingo.teaser.sub}
        </p>
      </section>
    );
  }

  const selected = selectedId ? b.feats.find((f) => f.id === selectedId) ?? null : null;

  return (
    <section data-screen-label="Bingo" style={{ position: "relative", paddingTop: 8 }}>
      <h2 className="sr-only">{copy.bingo.nav}</h2>

      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <div style={{ ...display, fontWeight: 800, fontSize: 26, color: "#4F4034" }}>
          {copy.bingo.title}
        </div>
        <div style={{ fontSize: 13, color: "#A9967E", fontWeight: 600, marginTop: 2 }}>
          {b.seasonName} · {interp(copy.bingo.countLabel, { done: b.doneCount, total: b.feats.length })}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 9,
          marginTop: 14,
        }}
      >
        {b.feats.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setSelectedId(f.id)}
            aria-label={f.title}
            aria-pressed={f.done}
            data-done={f.done}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={{
              position: "relative",
              background: f.done ? "#E4F1D8" : "#fff",
              border: `2px solid ${f.done ? "#7BAE52" : "#F2DEBE"}`,
              borderRadius: 16,
              aspectRatio: "1 / 1",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              padding: "6px 5px",
              cursor: "pointer",
            }}
          >
            {f.done && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: -9,
                  right: -9,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#5C8A3F",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 900,
                  boxShadow: "0 2px 6px rgba(76,122,46,.55)",
                }}
              >
                ✓
              </span>
            )}
            <span style={{ fontSize: 26, lineHeight: 1 }}>{f.emoji}</span>
            <span
              style={{
                ...display,
                fontWeight: 700,
                fontSize: 13.5,
                lineHeight: 1.12,
                color: f.done ? "#4C7A2E" : "#4F4034",
                textWrap: "balance",
              }}
            >
              {f.card}
            </span>
          </button>
        ))}
      </div>

      <BingoConfetti mode={b.confetti} />

      {selected && (
        <BingoModal
          feat={selected}
          onToggle={() => actions.toggleFeat(selected.id)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </section>
  );
}
```

> Note: `onToggle` does not close the sheet — after marking done the sheet updates in place (button flips to "Fortryd", "✓ Færdig!" appears) because `selected` is re-derived from `derived.bingo` on the next render. This matches the spec's in-modal complete/undo. If you prefer close-on-mark, wrap with `onClose()`.

- [ ] **Step 2: Add the Bingo tab to `components/BottomNav.tsx`**

Add a 4th `<Tab>` after the settings tab (Bingo is last, per the spec). Use a 3×3 grid icon:

```tsx
      <Tab active={s === "bingo"} label={copy.bingo.nav} onClick={actions.goBingo}>
        <svg {...iconProps} strokeWidth={2}>
          <rect x="4" y="4" width="16" height="16" rx="2.5" />
          <path d="M9.3 4 V20 M14.7 4 V20 M4 9.3 H20 M4 14.7 H20" />
        </svg>
      </Tab>
```

- [ ] **Step 3: Render `BingoScreen` in `components/AppShell.tsx`**

Add the import:

```tsx
import BingoScreen from "@/components/BingoScreen";
```

Add the screen branch inside `<main>` (after the settings branch):

```tsx
            {state.screen === "bingo" && <BingoScreen />}
```

- [ ] **Step 4: Verify types, lint, and build**

Run: `npx tsc --noEmit && npx eslint . && npm run build`
Expected: PASS — clean typecheck/lint and a successful static export (postbuild SW injection runs).

- [ ] **Step 5: Visual check in dev**

Run: `npm run dev` then open `http://localhost:3000/reading-challenge/`, tap the **Bingo** tab. Confirm: 15-tile 3×5 grid, tap a tile → bottom sheet with full title + description, "Marker som færdig" → tile turns green with ✓ badge, reopen → "Fortryd". Complete the top row of 3 → confetti falls. (If today is outside 1 Jun–31 Aug 2026, you'll see the teaser instead — temporarily widen `SEASONS[0]` dates to verify the board, then revert.)

- [ ] **Step 6: Commit**

```bash
git add components/BingoScreen.tsx components/BottomNav.tsx components/AppShell.tsx
git commit -m "feat(bingo): add board screen, 4th nav tab, shell wiring"
```

---

## Task 8: e2e behaviour tests (clock-mocked)

**Files:**
- Modify: `e2e/app.spec.ts`

Seasonal date logic depends on `new Date()`, so each test installs a fake clock **before** `page.goto` with Playwright's `page.clock`. The existing `seed()` helper writes the localStorage keys.

- [ ] **Step 1: Write the failing bingo specs**

Append to `e2e/app.spec.ts`:

```typescript
// --- Bingo (seasonal board) ---------------------------------------------

// A date inside the Sommer '26 window (1 Jun–31 Aug 2026) and one outside it.
const IN_SEASON = new Date("2026-07-01T10:00:00");
const OFF_SEASON = new Date("2026-12-01T10:00:00");

test("bingo: in-season shows the 3x5 board and feat titles", async ({ page }) => {
  await page.clock.install({ time: IN_SEASON });
  await page.goto("./");
  await page.getByRole("button", { name: "Bingo" }).click();
  await expect(page.getByText("Læsebingo")).toBeVisible();
  await expect(page.getByText("Sommer '26", { exact: false })).toBeVisible();
  // 15 feat tiles (buttons are aria-labelled by full title).
  await expect(page.getByRole("button", { name: "Læs i naturen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Læs på stranden" })).toBeVisible();
});

test("bingo: tapping a tile opens the modal and marks it done", async ({ page }) => {
  await page.clock.install({ time: IN_SEASON });
  await page.goto("./");
  await page.getByRole("button", { name: "Bingo" }).click();

  const tile = page.getByRole("button", { name: "Læs i naturen" });
  await expect(tile).toHaveAttribute("data-done", "false");
  await tile.click();

  // Modal shows the description + the mark-done action.
  await expect(page.getByText("Find et træ eller en bænk udenfor og læs der.")).toBeVisible();
  await page.getByRole("button", { name: "Marker som færdig" }).click();

  // Tile is now done; reopening offers Undo.
  await expect(tile).toHaveAttribute("data-done", "true");
  await tile.click();
  await expect(page.getByRole("button", { name: "Fortryd" })).toBeVisible();
});

test("bingo: a saved completed feat reloads from storage", async ({ page, context }) => {
  await page.clock.install({ time: IN_SEASON });
  await seed(context, { bingo: { "sommer-26": ["natur"] } });
  await page.goto("./");
  await page.getByRole("button", { name: "Bingo" }).click();
  await expect(page.getByRole("button", { name: "Læs i naturen" })).toHaveAttribute(
    "data-done",
    "true",
  );
});

test("bingo: completing a full row triggers row confetti", async ({ page }) => {
  await page.clock.install({ time: IN_SEASON });
  await page.goto("./");
  await page.getByRole("button", { name: "Bingo" }).click();

  for (const name of ["Læs med en ven", "Læs i naturen", "Læs på ferie"]) {
    await page.getByRole("button", { name }).click();
    await page.getByRole("button", { name: "Marker som færdig" }).click();
  }
  // The burst mounts on the toggle that completed the top row.
  await expect(page.getByTestId("bingo-confetti")).toBeVisible();
});

test("bingo: off-season shows the teaser, not the board", async ({ page }) => {
  await page.clock.install({ time: OFF_SEASON });
  await page.goto("./");
  await page.getByRole("button", { name: "Bingo" }).click();
  await expect(page.getByText("Næste sæson kommer snart", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Læs i naturen" })).toHaveCount(0);
});
```

- [ ] **Step 2: Run the bingo specs to verify they pass against the build**

Run: `npm run build && npx playwright test -g "bingo:"`
Expected: PASS — all 5 bingo tests green. (`npm run build` first — e2e runs against `./out`, not a live dev server.)

> If `page.clock.install` interferes with hydration timing, fall back to `page.clock.setFixedTime(IN_SEASON)` after `install({ time: IN_SEASON })`, or widen the assertion timeout. Do NOT remove the clock mock — without it the suite breaks the day the real date leaves the season window.

- [ ] **Step 3: Run the FULL suite to confirm no regressions**

Run: `npm run test:e2e`
Expected: PASS — the original 16 tests + 5 new bingo tests all green.

- [ ] **Step 4: Commit**

```bash
git add e2e/app.spec.ts
git commit -m "test(bingo): e2e coverage for board, modal, persistence, confetti, off-season"
```

---

## Task 9: Final verification + docs

**Files:**
- Modify: `CLAUDE.md` (optional — add bingo to the architecture notes)

- [ ] **Step 1: Run the full verification gate**

Run: `npx tsc --noEmit && npx eslint . && npm run build && npm run test:e2e`
Expected: all clean / all green. This is the project's definition of done (`CLAUDE.md` → "Verify before claiming done").

- [ ] **Step 2: (Optional) Note the new slice in `CLAUDE.md`**

If updating architecture docs, add bingo to the `lib/` layer description and the localStorage key list (the `sommerlaesning.v1.bingo` key, hydration-gated like the rest). Keep it to 1–2 lines.

- [ ] **Step 3: Commit (if docs changed)**

```bash
git add CLAUDE.md
git commit -m "docs: note the bingo slice in architecture notes"
```

---

## Self-Review

**1. Spec coverage** (from issue #19):
- Seasonal, date-windowed, provider-defined-by-config → Task 2 (`SEASONS`, `activeSeason`). ✅
- Fresh board per season, per-season storage, new key, hydration-gated → Tasks 1–2, 5. ✅
- Off-season teaser (tab stays) → Task 7 (`!b.active` branch), Task 8 (test). ✅
- 3×5 grid, emoji + single-word card (V1) → Task 7. ✅
- Completed = green border + green bg + ✓ badge over top-right corner → Task 7. ✅
- Tap → bottom-sheet modal: emoji, full title, description, Mark/Undo → Tasks 6–7. ✅
- Undo allowed → Task 4 reducer toggle + Task 6 modal. ✅
- Row (horizontal-of-3) confetti + bigger board confetti, ~few seconds, reduced-motion → Tasks 4/6 (`mons-fall` respects the global `prefers-reduced-motion` rule in `globals.css`). ✅
- Standalone (no effect on minutes/goal) → bingo slice is fully separate from `challenge`/`entries`. ✅
- "Bingo" as 4th tab after Settings → Task 7. ✅
- No hardcoded Danish → all strings in `copy/da.json` (Task 3). ✅
- Season 1 = "Sommer '26", 1 Jun–31 Aug 2026, the 15 feats → Tasks 2–3. ✅

**2. Placeholder scan:** No TBD/TODO; every code step has complete code. ✅

**3. Type consistency:** `BingoState` (types) ↔ `state.bingo` (store/storage); `SeasonFeatDef`/`SeasonDef` (bingo.ts) ↔ `SEASONS`; `BingoFeatView`/`BingoView` (store) ↔ `derived.bingo` ↔ `BingoModal` prop; feat ids in `SEASONS[0].feats` ↔ keys in `copy.bingo.seasons["sommer-26"].feats`; `toggleFeat(featId)` ↔ `TOGGLE_FEAT {seasonId, featId}`; confetti `"none"|"row"|"board"` consistent across reducer, `BingoView.confetti`, `BingoConfetti` prop. ✅
