# About + "Buy me a coffee" support — design

**Issue:** #3 — Add "Buy me a coffee" support button
**Date:** 2026-07-05
**Status:** Approved (pending spec review)

> **Revised 2026-08-15 — About is a bottom drawer, not a screen.**
> As a screen it displaced whatever the user was looking at, and its "Tilbage"
> control always returned to Fremgang rather than where they came from. As a
> drawer it overlays the current screen and closing returns the user exactly
> where they were — which matters more here than usual, because the page exists
> to make an optional ask. Built on Base UI's `Drawer` (the only runtime
> dependency added) for swipe-to-dismiss, focus trapping, and scroll locking.
>
> Everything else below stands unchanged: the reciprocity framing, the single
> coffee CTA, the two entry points (header ⓘ + Settings row), and the decision
> that the bottom nav stays at four tabs. The sections below have been reworded
> where they described About as a `state.screen` view; see
> `docs/superpowers/plans/2026-08-15-about-drawer.md` for the implementation.

## Problem

We want a lightweight, non-intrusive way for users to *optionally* support the
project. The naive framing ("add a coffee button") undersells the real goal:
make a parent genuinely *want* to support a free, ad-free hobby app.

Donation psychology says people give when there is (a) a **human and a story**,
(b) a **tiny, concrete ask** ("a coffee"), and (c) **no guilt or nagging**. A
bare button satisfies none of these; a short honest "about" story does.

## Solution (scope of this issue)

Add an **About drawer** that tells the story behind the app and hosts a single
"Buy me a coffee" call to action. It slides up over the current screen. Open it
from lightweight entry points that do **not** clutter the bottom nav:

1. An **ⓘ info icon** in the app header (visible on every screen).
2. An **"Om appen" row** at the bottom of the Settings screen.

The coffee CTA lives **only** in the About drawer — no coffee buttons scattered
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
is **not** one of those screens: it is an **overlay flag**, matching the existing
`newChallengeOpen` / `unlockOpen` house convention. The `Screen` union stays
`"progress" | "log" | "settings" | "bingo"`.

### Data / state

- `lib/store.tsx`: add `aboutOpen: boolean` to `UIState` (initialised `false`),
  the `OPEN_ABOUT` / `CLOSE_ABOUT` reducer cases, and `openAbout` / `closeAbout`
  on `Actions`.
- `openAbout` still fires `track("nav_screen", { screen: "about" })` — the event
  name is deliberately kept so the GA4 series stays continuous across this
  change (see the GA4 dictionary note in
  `docs/superpowers/specs/2026-06-30-ga4-events-design.md`).
- `SET_SCREEN` and `GO_SETTINGS` clear `aboutOpen` alongside `editing`, so the
  drawer never survives a navigation underneath it. The four other reducer cases
  that write `screen` are unreachable while the drawer is open only because the
  drawer is **modal** — that caveat is recorded at the `aboutOpen` declaration.
- **No new `localStorage` keys.** About is a pure view with no persisted state
  (`aboutOpen` is transient UI state, like the other overlay flags), so **no
  hydration guard is required** and the `sommerlaesning.v1.*` key set is
  untouched (invariant preserved).

### Components

- **`components/AboutDrawer.tsx`** (new, small — well under the 300-line limit):
  a `Drawer.Root` from `@base-ui/react/drawer`, portalled and bottom-anchored,
  driven by `state.aboutOpen` with `onOpenChange` → `actions.closeAbout()`.
  Base UI supplies swipe-to-dismiss, focus trapping, scroll locking, background
  inertness, and enter/exit transitions — all of which the three hand-rolled
  modals in this repo lack. Layout inside the panel:
  - a **grab handle** (decorative) and a centred **`Drawer.Title`**
  - a **mascot hero** — reuse `MascotFace` with `state.mascot` at a happy stage
    (`stage={7}`, `confetti={false}`), matching the other screens' usage
  - **2 short story paragraphs** (from copy), rendered as the accessible
    description so screen readers announce them with the title
  - a **support card** (white card, matches `CARD` styling): heading + sub +
    the coffee CTA button (accent `#F6A623`, coffee icon)
  - a **thanks** footer line, then an explicit **"Luk"** `Drawer.Close` — in
    addition to swipe, Escape, and backdrop press
- **`components/AppShell.tsx`**: render `<AboutDrawer />` as a sibling of
  `<NewChallengeModal />`, outside the screen switch — it is not a screen. Add a
  **right-aligned control cluster** to the `<header>`
  (`ml-auto flex items-center gap-2`) containing the ⓘ button now, laid out to
  seat the language pill later. The ⓘ button calls `openAbout()`, carries an
  `aria-label` from copy plus `aria-haspopup="dialog"` / `aria-expanded`, and
  uses the existing `focus-visible` accent ring convention.
- **`components/SettingsScreen.tsx`**: add an **"Om appen" row** near the bottom
  (above or beside the existing footer), styled as a tappable card row with an
  ⓘ icon + label + chevron, calling `openAbout()`.
- **`app/globals.css`**: the drawer's transition and gesture rules live here as
  classes rather than inline style objects, because they key off Base UI's
  `data-starting-style` / `data-ending-style` attributes and its
  `--drawer-swipe-*` custom properties. Geometry mirrors `BingoModal`'s bottom
  sheet; the existing `prefers-reduced-motion` block already neutralises them.

### Dependency

`@base-ui/react` (pinned exact, `1.6.0`) is the **only runtime dependency this
issue adds**, and it exists solely for the drawer. Explicitly rejected:
`shadcn` / `components.json` / `cn()` / `clsx` / `tailwind-merge` /
`class-variance-authority` / `lucide-react` — this project has no semantic-token
layer (the palette is `--color-ink`, `--color-accent`, …) and no
`tailwind.config.*`. One dependency, house styling.

### External link + config

- **`lib/links.ts`** (new): export `SUPPORT_URL = "https://buymeacoffee.com/kriszta.vajda"`.
  This is a config value, not translatable copy, so it lives as a constant, not
  in `copy/da.json`.
- The CTA is an `<a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">`
  styled as a button. On click, fire `track("support_click", { platform: "buymeacoffee" })`
  using the existing analytics `track()` util.

### Copy (no hardcoded Danish)

All strings via `copy/da.json`. New top-level `about` block:

```jsonc
"about": {
  "navAria": "Om appen",                 // aria-label for the header ⓘ button
  "title": "Om Læseudfordring",
  "close": "Luk",                        // the drawer closes in place; there is no "back"
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

## Information architecture (why the header, not the nav — and why an overlay)

- The **bottom nav is the kid's lifecycle space** (Progress / Log / Settings |
  Bingo) — deliberately grouped, Bingo set apart by a hairline. A 5th tab breaks
  that grouping, and About is read-once/low-frequency, so it hasn't *earned* a
  permanent tab. **The nav stays at four tabs.**
- **About is an overlay, not a destination.** It has two entry points reachable
  from anywhere, so as a screen it had no honest "back": the back control had to
  pick one destination (Fremgang) and was therefore wrong for anyone who arrived
  from Settings. A drawer has no destination to pick — it closes and the user is
  already where they were. That matters here specifically because About exists to
  make an *optional* ask: an ask that costs the user their place is a nag.
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
  - Header ⓘ icon opens the About drawer; About content (title, coffee CTA) is
    visible.
  - Settings "Om appen" row opens the About drawer, and stays reachable while an
    ongoing challenge is locked.
  - The coffee CTA is an anchor with the correct `SUPPORT_URL`,
    `target="_blank"`, and `rel="noopener noreferrer"`.
  - **Overlay semantics:** opened from Settings, the drawer overlays it — the
    Settings screen is still mounted underneath — and closing returns to
    Settings, *not* Fremgang. This is the assertion the rework exists for.
  - **Dismissal:** Escape, backdrop press, and the "Luk" button each close it;
    focus returns to the header ⓘ button. These behaviours come from Base UI, so
    each was proven to go red when the corresponding Base UI prop is disabled.
  - The bottom nav stays at four tabs (unchanged IA guard).
- **Gates:** `npx tsc --noEmit && npx eslint .` clean; `npm run build` (static
  export + SW inject) succeeds; `npm run test:e2e` green.

## Non-goals / guardrails

- No interstitial, no repeating prompt, nothing that opens itself — the ask is
  passive and lives in one drawer the user chooses to open.
- No feature gating behind support.
- No new `localStorage` keys; do not rename existing ones.
- Keep `AboutDrawer.tsx` focused and under the 300-line limit.
- One new runtime dependency (`@base-ui/react`) and no more — see "Dependency".
