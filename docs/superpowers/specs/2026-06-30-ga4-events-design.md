# GA4 Event Tracking (Tier 2) — Design

**Goal:** Measure whether people actually *use* the app by sending a small set of GA4 custom events for the core reading loop plus screen navigation — building on the pageview-only GA4 already on `main` (PR #29).

**Context:** GA4 (`G-TKWB5RGY4V`) loads via `components/Analytics.tsx`, allowlisted to the prod host `vajkri.github.io`. `window.gtag` therefore exists **only on prod** — events auto-silence on dev / e2e / LAN with no extra gating.

## Events (Tier 2 — 6 types)

| Event | Fires when | Params |
|---|---|---|
| `challenge_started` | `state.challenge` transitions `→ "ongoing"` | `goal` (number, target minutes) |
| `reading_logged` | a **new** entry is saved (`entries.length` increases) | `minutes` (number) |
| `challenge_completed` | `state.challenge` transitions `→ "completed"` | — |
| `nav_screen` | user taps a bottom-nav tab | `screen` (`"progress"`/`"log"`/`"settings"`/`"bingo"`) |
| `bingo_feat_completed` | a feat is crossed off (total completed count increases) | `season` (season id string) |

All names are **custom/non-reserved** — deliberately avoiding GA4's reserved `screen_view` / `page_view`. No PII in any param (screen names + minute counts only).

## Architecture

Three units; the pure `lib/` math (`joy.ts`, `bingo.ts`) and the reducer stay untouched.

### 1. `lib/analytics.ts` (new) — the single side-effect seam

```ts
type EventName =
  | "challenge_started"
  | "reading_logged"
  | "challenge_completed"
  | "nav_screen"
  | "bingo_feat_completed";

type EventParams = Record<string, string | number>;

declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void;
  }
}

export function track(name: EventName, params?: EventParams): void {
  if (typeof window === "undefined") return; // SSR-safe
  window.gtag?.("event", name, params); // undefined off-prod → no-op
}
```

- **What it does:** forwards a typed event to gtag, or does nothing.
- **How you use it:** `track("reading_logged", { minutes })`.
- **Depends on:** the global `window.gtag` injected by `components/Analytics.tsx` (prod only).

### 2. `lib/useAnalytics.ts` (new) — transition-watching effects

A `useAnalytics(state: State)` hook owning the funnel/bingo events. Each effect tracks the previous value in a `useRef` and is **guarded by `state.hydrated`**, so hydrating saved data on startup never replays historical events.

- `reading_logged`: ref `prevLen`. When `state.entries.length > prevLen`, fire with `minutes` of the newest entry — `state.entries[0]` (the reducer prepends new entries: `[entry, ...state.entries]`). Editing leaves length unchanged → not counted.
- `challenge_started` / `challenge_completed`: ref `prevChallenge`. On `prev !== "ongoing" && next === "ongoing"` → `challenge_started({ goal: state.goal })`. On `prev !== "completed" && next === "completed"` → `challenge_completed()`.
- `bingo_feat_completed`: ref `prevBingoCount` = `Object.values(state.bingo).reduce((n, a) => n + a.length, 0)`. On increase → fire with `season: activeSeason(SEASONS, new Date())?.id` (omit param if off-season).
- **Baseline init:** on the first run where `state.hydrated` becomes true, seed every ref from current state **without firing** (the `prev` refs start at sentinel values and are reconciled on that first hydrated pass).
- **Depends on:** `track` (analytics.ts), `activeSeason`/`SEASONS` (bingo.ts), `State` (store.tsx types).

### 3. `lib/store.tsx` (modify) — two minimal edits

- The 4 nav actions each gain one line — they know their target screen literally, so no state read is needed (which is essential, since `actions` is `useMemo([])` and its closures can't see live state):
  ```ts
  goProgress: () => { track("nav_screen", { screen: "progress" }); dispatch({ type: "SET_SCREEN", screen: "progress" }); },
  // …goLog "log", goSettings "settings", goBingo "bingo"
  ```
- `AppProvider` calls `useAnalytics(state)` once (alongside the existing effects).

### Why transitions (not actions) for the funnel

`actions` is `useMemo([])`, so its closures freeze `INITIAL` and cannot read live state. Completion *also* auto-fires inside the reducer (`SAVE_ENTRY`). Watching state transitions in effects is the only correct way to catch both, and it mirrors the provider's existing persistence/flash/confetti effect pattern.

## Testing

New e2e spec `e2e/analytics-events.spec.ts`. It stubs `window.gtag` via `context.addInitScript` **before** load, so events fire regardless of the prod host gate, capturing calls into `window.__gaEvents`:

- Seed an ongoing challenge → log a reading via the UI → assert a `reading_logged` event with the right `minutes`.
- Tap the Log tab → assert a `nav_screen` event with `screen: "log"`.
- Log enough minutes to reach the goal → assert a `challenge_completed` event.

This is genuine red-green coverage on localhost. The existing guard (`e2e/analytics.spec.ts`: `window.gtag` undefined on localhost with no stub) still holds — the stub is test-only.

## Out of scope

Tier 3 extras (`pwa_installed`, entry-deleted, new-challenge reset), consent banner (locked product decision), event params beyond those listed.
