# About page + "Buy me a coffee" support — design

**Issue:** #3 — Add "Buy me a coffee" support button
**Date:** 2026-07-05
**Status:** Approved (pending spec review)

## Problem

We want a lightweight, non-intrusive way for users to *optionally* support the
project. The naive framing ("add a coffee button") undersells the real goal:
make a parent genuinely *want* to support a free, ad-free hobby app.

Donation psychology says people give when there is (a) a **human and a story**,
(b) a **tiny, concrete ask** ("a coffee"), and (c) **no guilt or nagging**. A
bare button satisfies none of these; a short honest "about" story does.

## Solution (scope of this issue)

Add an **About page** that tells the story behind the app and hosts a single
"Buy me a coffee" call to action. Reach it from lightweight entry points that do
**not** clutter the bottom nav:

1. An **ⓘ info icon** in the app header (visible on every screen).
2. An **"Om appen" row** at the bottom of the Settings screen.

The coffee CTA lives **only** on the About page — no coffee buttons scattered
elsewhere, no popups, no repeat prompts.

### Explicitly out of scope (own issue)

A **language switcher** is planned for the same header "meta" zone, but it is a
much larger effort (a full `copy/en.json` translation, locale state,
persistence, `DATE_LOCALE` switching) and is **not** part of this issue. This
spec only *reserves the header layout* for it — see "Future: language switcher".

Also out of scope (decided): no support link on the completion-celebration
screen. Keep it minimal.

## Architecture

The app is a single static page that switches `state.screen` — no router. About
is a **new screen value**, consistent with the existing Progress/Log/Settings/
Bingo pattern.

### Data / state

- `lib/store.tsx`: extend `Screen` union with `"about"`.
- Add `goAbout()` to `Actions`, implemented as a plain `SET_SCREEN` dispatch
  (mirrors `goBingo`), with `track("nav_screen", { screen: "about" })`.
  It uses `SET_SCREEN` (not the settings-specific `GO_SETTINGS`), so navigating
  to About sets `editing: false` — an ongoing challenge re-locks, consistent
  with all other navigation.
- **No new `localStorage` keys.** About is a pure view with no persisted state,
  so **no hydration guard is required** and the `sommerlaesning.v1.*` key set is
  untouched (invariant preserved).

### Components

- **`components/AboutScreen.tsx`** (new, small — well under the 300-line limit):
  returns the screen's inner scrollable content only (header/nav come from
  `AppShell`), matching how the other screens are structured. Layout:
  - a **back affordance** (left arrow + "Om Læseudfordring" title) → `goProgress()`
  - a **mascot hero** — reuse `MascotFace` with `state.mascot` at a happy stage
    (`stage={7}`, `confetti={false}`), matching the other screens' usage
  - **2 short story paragraphs** (from copy)
  - a **support card** (white card, matches `CARD` styling): heading + sub +
    the coffee CTA button (accent `#F6A623`, coffee icon)
  - a **thanks** footer line
- **`components/AppShell.tsx`**: render `state.screen === "about" && <AboutScreen />`
  inside `<main>`. Add a **right-aligned control cluster** to the `<header>`
  (`ml-auto flex items-center gap-2`) containing the ⓘ button now, laid out to
  seat the language pill later. The ⓘ button calls `goAbout()`, has an
  `aria-label` from copy, and uses the existing `focus-visible` accent ring
  convention.
- **`components/SettingsScreen.tsx`**: add an **"Om appen" row** near the bottom
  (above or beside the existing footer), styled as a tappable card row with an
  ⓘ icon + label + chevron, calling `goAbout()`.

### External link + config

- **`lib/links.ts`** (new): export `SUPPORT_URL` — the Buy Me a Coffee page
  (`https://buymeacoffee.com/<handle>`). This is a deploy-time config value, not
  translatable copy, so it lives as a constant, not in `copy/da.json`.
- The CTA is an `<a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">`
  styled as a button. On click, fire `track("support_click", { platform: "buymeacoffee" })`
  using the existing analytics `track()` util.

### Copy (no hardcoded Danish)

All strings via `copy/da.json`. New top-level `about` block:

```jsonc
"about": {
  "navAria": "Om appen",                 // aria-label for the header ⓘ button
  "title": "Om Læseudfordring",
  "back": "Tilbage",
  "intro": [
    "Hej! Jeg lavede Læseudfordring i min fritid, fordi jeg ville gøre det sjovere for mit barn at læse lidt hver dag.",
    "Den er gratis, uden reklamer, og alt bliver kun gemt på din egen enhed."
  ],
  "support": {
    "heading": "Kan du lide appen?",
    "sub": "Du kan give en kop kaffe — helt frivilligt.",
    "cta": "Køb mig en kaffe"
  },
  "thanks": "Tak fordi I læser med."
}
```

Plus a Settings row label under the existing `settings` block:

```jsonc
"about": "Om appen"    // settings.about — the "Om appen" row label
```

The intro copy is a starting draft — the app owner should personalise the
wording (and may add their name) before shipping.

## Information architecture (why the header, not the nav)

- The **bottom nav is the kid's lifecycle space** (Progress / Log / Settings |
  Bingo) — deliberately grouped, Bingo set apart by a hairline. A 5th tab breaks
  that grouping, and About is read-once/low-frequency, so it hasn't *earned* a
  permanent tab.
- The **header becomes the "app meta" zone** (about now, language later). Chrome
  up top, journey at the bottom.
- Language is intentionally **not** placed in Settings: Settings sits behind the
  "Kun for voksne" math gate, and forcing an unlock just to change language is
  hostile. The header keeps meta controls gate-free.

## Future: language switcher (design reserved, not built)

Captured here so the follow-up issue starts with a decision, not a blank page.

- **IA chosen: two distinct header controls** (not a consolidated overflow menu).
  Rationale: the whole point of a second language is that an English-preferring
  parent *notices* they can switch — a hidden menu defeats that. The meta zone
  only ever needs two items (language + about), so it won't sprawl; take the
  directness dividend.
- **Language control:** a small **`🌐 DA` pill** showing the current language,
  right-aligned in the header next to the ⓘ icon. Tapping it switches (with 2
  languages, a simple toggle or a tiny 2-item popover — see the "one menu" sheet
  sketch for the popover treatment).
- **What the follow-up issue must add:** `copy/en.json` (full translation), a
  `locale` slice with a new hydration-gated `sommerlaesning.v1.locale` key, a
  `dicts` registry lookup in `@/lib/copy`, and `DATE_LOCALE` switching.
- Header layout in this issue must right-align its control cluster so the pill
  drops in beside the ⓘ icon with no restructure.

Reference sketches (produced during brainstorming): header "two controls" vs
"one menu"; About page layout; the three About entry-point options.

## Testing

- **Playwright (`test:e2e`, runs against `./out`):**
  - Header ⓘ icon navigates to the About screen; About content (title, coffee
    CTA) is visible.
  - Settings "Om appen" row navigates to the About screen.
  - The coffee CTA is an anchor with the correct `SUPPORT_URL`,
    `target="_blank"`, and `rel="noopener noreferrer"`.
  - Bottom nav remains usable from About (e.g. tapping a tab leaves About).
- **Gates:** `npx tsc --noEmit && npx eslint .` clean; `npm run build` (static
  export + SW inject) succeeds; `npm run test:e2e` green.

## Non-goals / guardrails

- No popup, no interstitial, no repeating prompt — the ask is passive and lives
  on one page.
- No feature gating behind support.
- No new `localStorage` keys; do not rename existing ones.
- Keep `AboutScreen.tsx` focused and under the 300-line limit.
