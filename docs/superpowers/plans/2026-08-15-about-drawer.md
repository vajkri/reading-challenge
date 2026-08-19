# About as a Bottom Drawer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the About page from a full `state.screen` view into a bottom drawer that overlays the current screen, so opening it never displaces the user from where they were.

**Architecture:** About stops being a `Screen` and becomes an overlay driven by `state.aboutOpen`, matching the existing `newChallengeOpen` / `unlockOpen` house convention. The overlay is built on Base UI's `Drawer` primitive — the only new runtime dependency — which supplies swipe-to-dismiss, focus trapping, scroll locking, portalling, and enter/exit transitions that the three hand-rolled modals in this repo currently lack. Styling stays house-style (inline objects + the existing `--color-*` palette + `mons-sheet`-era geometry lifted from `BingoModal`); only the transition/gesture-dependent rules live as CSS classes, because they key off Base UI's `data-starting-style` / `data-ending-style` attributes and its `--drawer-swipe-*` variables.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, Tailwind v4 (CSS-first `@theme`), `@base-ui/react` 1.6.0, Playwright.

**Supersedes:** the "About is a new `state.screen === 'about'` view" decision in `docs/superpowers/specs/2026-07-05-about-page-and-support-design.md`. That spec is updated in Task 5.

**Branch:** `feat/3-add-buy-me-a-coffee-support-button` (PR #35, open and unmerged). These commits are added to that PR.

---

## Why Base UI rather than hand-rolling

`NewChallengeModal.tsx`, `UnlockModal.tsx`, and `BingoModal.tsx` each contain a byte-identical copy of the same Escape + Tab-trap + focus-restore effect. All three share the same gaps: **no scroll lock, no background inertness, no portal, no exit animation, no `aria-labelledby`, and a focus trap that only fires on `keydown`** (so click- or programmatically-driven focus escapes it). Hand-rolling a fourth copy would add a fifth gap — drag-to-dismiss — and that gesture is the whole point of this change.

`Drawer.Root` gives all of it: `modal` defaults to `true` (focus trapped, page scroll locked, outside pointers disabled), `swipeDirection` defaults to `"down"`, and Escape / outside-press / swipe all arrive through one `onOpenChange` with typed reasons.

**Do NOT** add `shadcn`, `components.json`, `cn()`, `clsx`, `tailwind-merge`, `class-variance-authority`, or `lucide-react`. This project has no semantic-token layer (`--popover`, `--foreground`, `--border` do not exist — the palette is `--color-ink`, `--color-accent`, …) and no `tailwind.config.*`. One dependency, house styling. This was an explicit decision.

---

## File Structure

- **Create** `components/AboutDrawer.tsx` — the drawer. Replaces `AboutScreen.tsx`. Presentational; reads `state.aboutOpen` / `state.mascot`, calls `actions.closeAbout`.
- **Delete** `components/AboutScreen.tsx`.
- **Modify** `lib/store.tsx` — drop `"about"` from `Screen`, drop `goAbout`; add `aboutOpen` + `openAbout`/`closeAbout`.
- **Modify** `components/AppShell.tsx` — render `<AboutDrawer />` as a sibling of `<NewChallengeModal />`; ⓘ button calls `openAbout`.
- **Modify** `components/SettingsScreen.tsx` — the row calls `openAbout`.
- **Modify** `copy/da.json` — `about.back` → `about.close`.
- **Modify** `app/globals.css` — drop the `.about-content` tablet rule; add the drawer's transition/gesture CSS.
- **Modify** `e2e/about.spec.ts` — rewrite for overlay semantics; add dismissal coverage.
- **Modify** `package.json` — add `@base-ui/react`.
- **Modify** `docs/superpowers/specs/2026-07-05-about-page-and-support-design.md` — record the drawer decision.

---

## Task 1: Add the dependency and the close-label copy

**Files:**
- Modify: `package.json`
- Modify: `copy/da.json`

- [ ] **Step 1: Install Base UI, pinned exact**

Run from the worktree:

```bash
npm install --save-exact @base-ui/react@1.6.0
```

Pinned exact to match the sibling `impact-case` project's convention. Confirm `package.json` gained `"@base-ui/react": "1.6.0"` under `dependencies` (not `devDependencies` — it ships in the bundle).

- [ ] **Step 2: Rename the About back-label to a close-label in `copy/da.json`**

The drawer has no "back" — it closes in place. Inside the `"about"` block, replace the `"back"` key with `"close"`, matching `copy.bingo.modal.close` which is already `"Luk"`:

```json
    "close": "Luk",
```

So the block reads:

```json
  "about": {
    "navAria": "Om appen",
    "title": "Om Læsemakker",
    "close": "Luk",
    "intro": [
```

Leave `navAria`, `title`, `intro`, `support`, and `thanks` exactly as they are.

**Add `close` — do NOT remove `back` yet.** `components/AboutScreen.tsx` still reads `copy.about.back` and is not deleted until Task 3. Removing it here would leave a commit that fails `tsc`, and CI runs on every push. `back` is deleted in Task 3, in the same commit that deletes its last consumer.

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit && npx eslint .`
Expected: **clean.** Both `back` and `close` exist; nothing consumes `close` yet, which is fine — `copy` is typed as `typeof da`, so an unused key is not an error.

- [ ] **Step 4: Verify the dependency resolves**

```bash
node -e "console.log(Object.keys(require('@base-ui/react/drawer')))"
```

Expected: prints the `Drawer` export. If this fails, the install did not land in this worktree — check `ls node_modules/@base-ui` before continuing.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json copy/da.json
git commit -m "feat(#3): add @base-ui/react and the About close label"
```

---

## Task 2: Move About from a Screen to an overlay flag in the store

**Files:**
- Modify: `lib/store.tsx`

**This task is purely additive and must leave the tree green.** The old screen-based path (`Screen` includes `"about"`, `goAbout` exists) stays untouched here; Task 3 removes it in the same commit that deletes its last consumer. That keeps every commit on this branch building — no red intermediate state for `git bisect` to trip over.

- [ ] **Step 1: Add the `aboutOpen` field to `UIState`**

`UIState` already carries `newChallengeOpen: boolean` and `unlockOpen: boolean` (around lines 93–98). Add alongside them, with a comment in the same style:

```ts
  // "Om appen" drawer — an overlay, not a screen: it must never displace
  // whatever the user was looking at.
  aboutOpen: boolean;
```

- [ ] **Step 3: Initialise it**

Find the initial-state object where `newChallengeOpen: false` and `unlockOpen: false` are set, and add:

```ts
  aboutOpen: false,
```

- [ ] **Step 4: Add the reducer actions**

Add to the Action union, next to `OPEN_NEW_CHALLENGE` / `CLOSE_NEW_CHALLENGE`:

```ts
  | { type: "OPEN_ABOUT" }
  | { type: "CLOSE_ABOUT" }
```

And the reducer cases, next to the `NEW_CHALLENGE` cases:

```ts
    case "OPEN_ABOUT":
      return { ...state, aboutOpen: true };

    case "CLOSE_ABOUT":
      return { ...state, aboutOpen: false };
```

- [ ] **Step 5: Close the drawer on any screen change**

`SET_SCREEN` already clears the transient `editing` session. The drawer must not survive a navigation underneath it. Find:

```ts
    case "SET_SCREEN":
      // Any navigation ends a transient edit session (re-locks the running challenge).
      return { ...state, screen: action.screen, editing: false };
```

Replace with:

```ts
    case "SET_SCREEN":
      // Any navigation ends a transient edit session (re-locks the running challenge)
      // and dismisses the About drawer, which is never tied to a specific screen.
      return { ...state, screen: action.screen, editing: false, aboutOpen: false };
```

Do the same for `GO_SETTINGS` — add `aboutOpen: false` to the object it returns, alongside the existing `editing: false`.

- [ ] **Step 5: Add `openAbout` / `closeAbout` to the `Actions` interface**

**Leave `goAbout: () => void;` in place** — Task 3 removes it together with its callers. Add, next to the other overlay actions (`openUnlock`, `closeUnlock`):

```ts
  openAbout: () => void;
  closeAbout: () => void;
```

- [ ] **Step 6: Implement them in the actions object**

Leave the existing `goAbout` implementation alone. Add, next to `openUnlock` / `closeUnlock`:

```ts
      // About is an overlay, not a screen — but it stays a `nav_screen` event so the
      // GA4 series is continuous across this change and "how many people opened
      // About" remains one query rather than two.
      openAbout: () => {
        track("nav_screen", { screen: "about" });
        dispatch({ type: "OPEN_ABOUT" });
      },
      closeAbout: () => dispatch({ type: "CLOSE_ABOUT" }),
```

- [ ] **Step 7: Verify the tree is still green**

Run: `npx tsc --noEmit && npx eslint . && npm run build && npm run test:e2e`
Expected: **all clean, full suite still passing.** Nothing consumes `aboutOpen` yet and the old screen path is untouched, so behaviour is unchanged. Report the suite count — it must match what it was before this task.

- [ ] **Step 8: Commit**

```bash
git add lib/store.tsx
git commit -m "feat(#3): model About as an overlay flag instead of a screen"
```

---

## Task 3: Build the drawer and cut over to it

**Files:**
- Create: `components/AboutDrawer.tsx`
- Delete: `components/AboutScreen.tsx`
- Modify: `components/AppShell.tsx`
- Modify: `components/SettingsScreen.tsx`
- Modify: `app/globals.css`

This is the atomic cutover — it must land as one commit or the tree does not compile.

- [ ] **Step 1: Add the drawer CSS to `app/globals.css`**

Base UI drives its transitions through `data-starting-style` / `data-ending-style` attributes and `--drawer-swipe-*` custom properties. Those cannot be expressed as inline style objects, so they live here. Everything colour- and radius-related still matches the house palette and `BingoModal`'s sheet geometry.

Remove the existing About tablet rule (About is no longer a screen with a content column):

```css
@media (min-width: 768px) {
  /* Om appen — reading column; same cap as Indstillinger ... */
  .about-content {
    max-width: 520px;
    margin-inline: auto;
  }
}
```

Add this block near the other component-level rules (not inside the `TABLET LAYOUT` section — this is not breakpoint-specific):

```css
/* ---------------------------------------------------------------------------
   "Om appen" drawer (Base UI Drawer). Geometry mirrors BingoModal's bottom
   sheet; the transition + gesture rules must be CSS because they key off Base
   UI's data-* attributes and --drawer-swipe-* variables.
   --bleed extends the panel below the viewport so an over-drag never reveals
   the page behind it.
   --------------------------------------------------------------------------- */
.about-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(60, 42, 22, 0.42);
  opacity: calc(1 - var(--drawer-swipe-progress, 0));
  transition: opacity 450ms cubic-bezier(0.32, 0.72, 0, 1);
}
.about-drawer-backdrop[data-swiping] {
  transition-duration: 0s;
}
.about-drawer-backdrop[data-starting-style],
.about-drawer-backdrop[data-ending-style] {
  opacity: 0;
}

.about-drawer-viewport {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.about-drawer-popup {
  --bleed: 3rem;
  width: 100%;
  max-width: 460px;
  max-height: calc(85dvh + var(--bleed));
  margin-bottom: calc(var(--bleed) * -1);
  padding: 10px 22px calc(22px + env(safe-area-inset-bottom) + var(--bleed));
  background: #fff6e9;
  border-radius: 24px 24px 0 0;
  box-shadow: 0 -10px 30px rgba(60, 42, 22, 0.28);
  outline: none;
  overflow-y: auto;
  overscroll-behavior: contain;
  touch-action: auto;
  transform: translateY(var(--drawer-swipe-movement-y, 0px));
  transition: transform 450ms cubic-bezier(0.32, 0.72, 0, 1);
}
.about-drawer-popup[data-swiping] {
  user-select: none;
}
.about-drawer-popup[data-starting-style],
.about-drawer-popup[data-ending-style] {
  transform: translateY(calc(100% - var(--bleed) + 2px));
}

/* Grab handle — decorative; the panel is also dismissible by Escape, backdrop
   press, and the explicit "Luk" button. */
.about-drawer-handle {
  width: 44px;
  height: 4px;
  margin: 0 auto 14px;
  border-radius: 999px;
  background: #e2d3bb;
}
```

The existing `prefers-reduced-motion` block in this file already neutralises these transitions globally — do not add a second one.

- [ ] **Step 2: Create `components/AboutDrawer.tsx`**

Port the card/CTA/mascot markup verbatim from `AboutScreen.tsx` — only the outer shell and the close affordance change.

```tsx
"use client";

// "Om appen" — a bottom drawer, deliberately NOT a screen. Opening it overlays
// whatever the user was looking at and closing returns them there, so the coffee
// ask never displaces anyone. Built on Base UI's Drawer for swipe-to-dismiss,
// focus trapping, and scroll locking (see the plan for why not hand-rolled).
// All user-facing text comes from copy.

import type { CSSProperties } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { useApp } from "@/lib/store";
import { copy } from "@/lib/copy";
import { track } from "@/lib/analytics";
import { SUPPORT_URL } from "@/lib/links";
import MascotFace from "@/components/MascotFace";

const CARD: CSSProperties = {
  background: "#fff",
  borderRadius: 20,
  padding: 18,
  boxShadow: "0 6px 16px rgba(80,55,25,.08)",
};

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function AboutDrawer() {
  const { state, actions } = useApp();

  return (
    <Drawer.Root
      open={state.aboutOpen}
      onOpenChange={(open) => {
        if (!open) actions.closeAbout();
      }}
    >
      <Drawer.Portal>
        <Drawer.Backdrop className="about-drawer-backdrop" />
        <Drawer.Viewport className="about-drawer-viewport">
          <Drawer.Popup className="about-drawer-popup" data-testid="about-drawer">
            <div className="about-drawer-handle" aria-hidden="true" />

            <Drawer.Content>
              <Drawer.Title
                className="text-ink"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: 20,
                  margin: 0,
                  textAlign: "center",
                }}
              >
                {copy.about.title}
              </Drawer.Title>

              {/* Mascot hero — the child's chosen mascot, happy. */}
              <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
                <MascotFace animal={state.mascot} stage={7} confetti={false} bob={false} />
              </div>

              {/* Story (2 short paragraphs). Rendered as the accessible description
                  so screen readers announce it with the title. */}
              <Drawer.Description render={<div />}>
                {copy.about.intro.map((para, i) => (
                  <p
                    key={i}
                    className="text-ink-2"
                    style={{
                      fontSize: 15,
                      lineHeight: 1.6,
                      marginTop: i === 0 ? 8 : 12,
                      textAlign: "center",
                    }}
                  >
                    {para}
                  </p>
                ))}
              </Drawer.Description>

              {/* Support card — the single coffee CTA. */}
              <div style={{ ...CARD, marginTop: 18, textAlign: "center" }}>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 16,
                    color: "#4F4034",
                  }}
                >
                  {copy.about.support.heading}
                </div>
                <div style={{ fontSize: 13, color: "#A9967E", marginTop: 4, lineHeight: 1.45 }}>
                  {copy.about.support.sub}
                </div>
                <a
                  href={SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track("support_click", { platform: "buymeacoffee" })}
                  className={FOCUS_RING}
                  style={{
                    marginTop: 14,
                    width: "100%",
                    padding: 14,
                    borderRadius: 14,
                    background: "var(--color-accent)",
                    color: "#fff",
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 15.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 9,
                    boxShadow: "0 10px 24px rgba(246,166,35,.34)",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 8 H17 V13 A4 4 0 0 1 13 17 H8 A4 4 0 0 1 4 13 Z" />
                    <path d="M17 9 H19.5 A2 2 0 0 1 19.5 13 H17" />
                    <path d="M7 3 V5 M10.5 3 V5 M14 3 V5" />
                  </svg>
                  {copy.about.support.cta}
                </a>
              </div>

              <div
                style={{ textAlign: "center", fontSize: 12, color: "#C2B299", marginTop: 20 }}
              >
                {copy.about.thanks}
              </div>

              {/* Explicit close, in addition to swipe / Escape / backdrop press —
                  matches BingoModal's text "Luk" button. */}
              <Drawer.Close
                className={FOCUS_RING}
                style={{
                  width: "100%",
                  marginTop: 18,
                  padding: 13,
                  borderRadius: 14,
                  background: "#F2E6D2",
                  color: "#4F4034",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                {copy.about.close}
              </Drawer.Close>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
```

**Verify two things against the installed package before accepting this markup** (`node_modules/@base-ui/react/drawer/`):

1. **`Drawer.Title` must render a heading element** (the e2e asserts `getByRole("heading", { name: "Om Læsemakker" })`). If it renders a `<div>`, pass `render={<h2 />}`.
2. **`Drawer.Description` accepts `render`.** If not, drop the wrapper and put the paragraphs inline — the title alone is then the accessible name, which is acceptable.
3. **`Drawer.Close` must render a `<button>`** (the e2e asserts `getByRole("button", { name: "Luk" })`). If it renders something else, pass `render={<button type="button" />}`.
4. **`Drawer.Popup` must end up with `role="dialog"`** — every dismissal test uses `getByRole("dialog")`, matching this repo's existing overlay tests. Confirm it in the rendered DOM, not just from the types; if Base UI uses a different role, tell me before rewriting the tests around it.

If either differs, adapt and report it as a deviation with the real signature quoted.

- [ ] **Step 3: Delete the old screen and retire the `back` copy key**

```bash
git rm components/AboutScreen.tsx
```

`AboutScreen.tsx` was the only consumer of `copy.about.back`. Now remove that key from the `"about"` block in `copy/da.json`, leaving `close` in its place:

```json
    "title": "Om Læsemakker",
    "close": "Luk",
```

Confirm with `grep -rn "about.back" --exclude-dir=node_modules --exclude-dir=.git .` that nothing outside `docs/` still references it.

Then retire the old screen-based path in `lib/store.tsx`, which this cutover makes dead:

1. Narrow the `Screen` union (around line 66) — drop `"about"`:
   ```ts
   export type Screen = "progress" | "log" | "settings" | "bingo";
   ```
2. Remove `goAbout: () => void;` from the `Actions` interface.
3. Remove the `goAbout` implementation from the actions object:
   ```ts
         goAbout: () => {
           track("nav_screen", { screen: "about" });
           dispatch({ type: "SET_SCREEN", screen: "about" });
         },
   ```

`openAbout` (added in Task 2) already carries the `track("nav_screen", { screen: "about" })` call, so the analytics event is preserved — verify that before deleting, don't assume it.

4. Record the clearing invariant where the next editor will trip over it. Six reducer cases write `state.screen`, but only `SET_SCREEN` and `GO_SETTINGS` clear `aboutOpen`; the other four (`START_CHALLENGE`, `UPDATE_CHALLENGE`, `CONFIRM_NEW_CHALLENGE`, `SAVE_ENTRY`) are unreachable with the drawer open **only because the drawer is modal**. Extend the `aboutOpen` declaration comment to say so:

```ts
  // "Om appen" drawer — an overlay, not a screen: it must never displace
  // whatever the user was looking at.
  // Cleared by SET_SCREEN and GO_SETTINGS only. The four other cases that write
  // `screen` (START_CHALLENGE, UPDATE_CHALLENGE, CONFIRM_NEW_CHALLENGE, SAVE_ENTRY)
  // are all pointer-driven from background chrome, so they're unreachable while the
  // drawer is open — but that safety comes from Drawer.Root's `modal`, not from here.
  // If the drawer ever becomes non-modal, or gains a control that navigates, clear
  // `aboutOpen` in those cases too.
  aboutOpen: boolean;
```

- [ ] **Step 4: Wire `AppShell.tsx`**

Replace the import:

```tsx
import AboutScreen from "@/components/AboutScreen";
```

with:

```tsx
import AboutDrawer from "@/components/AboutDrawer";
```

Remove this line from the screen switch inside `<main>`:

```tsx
            {state.screen === "about" && <AboutScreen />}
```

Render the drawer as a sibling next to the other overlay, just before `<BottomNav />`:

```tsx
      <NewChallengeModal />
      <AboutDrawer />
      <BottomNav />
```

Update the header ⓘ button. It previously carried `aria-current` because About was a screen; a button that opens a dialog should advertise that instead:

```tsx
          <button
            type="button"
            data-testid="header-about"
            onClick={actions.openAbout}
            aria-label={copy.about.navAria}
            aria-haspopup="dialog"
            aria-expanded={state.aboutOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={{ boxShadow: "0 0 0 1.5px #F0DBB4 inset" }}
          >
```

Keep the surrounding `<svg>` and the `ml-auto` cluster exactly as they are.

- [ ] **Step 5: Point the Settings row at `openAbout`**

In `components/SettingsScreen.tsx`, the "Om appen" row currently has `onClick={actions.goAbout}`. Change it to:

```tsx
          onClick={actions.openAbout}
```

Update the comment above it — it currently explains the row sits outside the gating wrapper, which is still true and must be preserved. Only the action name changes.

- [ ] **Step 6: Verify types, lint, and build**

Run: `npx tsc --noEmit && npx eslint . && npm run build`
Expected: all clean. `tsc` should now be green again — if it still reports `goAbout` or `"about"`, a reference was missed.

- [ ] **Step 7: Verify it actually works in a browser**

Build, then serve and drive it. Confirm, and report each:

1. Clicking the header ⓘ from **Fremgang** opens the drawer over Fremgang; the progress ring is still visible behind the backdrop.
2. Escape closes it and Fremgang is still there.
3. Clicking the backdrop closes it.
4. The "Luk" button closes it.
5. Opening from **Settings** and closing returns to Settings — *not* Fremgang. This is the entire point of the change; verify it explicitly.
6. Background scroll is locked while open (scroll the page behind — it must not move).
7. Focus moves into the drawer on open and returns to the ⓘ button on close.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(#3): present About as a bottom drawer instead of a screen"
```

---

## Task 4: Rewrite the e2e suite for overlay semantics

**Files:**
- Modify: `e2e/about.spec.ts`

The existing tests assert screen semantics (`about-screen` testid, "back arrow returns to Fremgang", "bottom nav is still usable"). Those describe behaviour that no longer exists. Three tests are unchanged in substance and must keep passing: the 4-tab IA guard, the locked-Settings-row guard, and the analytics test.

- [ ] **Step 1: Replace the two screen-semantics tests**

Delete `"bottom nav is still usable from the About page"` and `"back arrow returns to Fremgang"`. Replace them with the tests below. Use `getByRole("dialog")` as the handle — that is the established pattern in `e2e/app.spec.ts` for this repo's overlays.

```ts
test("the drawer overlays the current screen and closing returns to it", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Indstillinger" }).click();
  await expect(page.getByRole("heading", { name: "Indstillinger" })).toBeVisible();

  await page.getByTestId("header-about").click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "Om Læsemakker" })).toBeVisible();

  // The point of the drawer: Indstillinger is still mounted underneath, not replaced.
  await expect(page.locator('[data-screen-label="Indstillinger"]')).toBeVisible();

  await drawer.getByRole("button", { name: "Luk" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Back where we started — NOT bounced to Fremgang, which is what the old screen did.
  await expect(page.getByRole("heading", { name: "Indstillinger" })).toBeVisible();
});

test("Escape closes the drawer", async ({ page }) => {
  await page.goto("./");
  await page.getByTestId("header-about").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('[data-screen-label="Fremgang"]')).toBeVisible();
});

test("pressing the backdrop closes the drawer", async ({ page }) => {
  await page.goto("./");
  await page.getByTestId("header-about").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Press near the top of the viewport — the drawer is anchored to the bottom,
  // so this lands on the backdrop rather than the panel.
  await page.mouse.click(10, 10);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("focus returns to the info button when the drawer closes", async ({ page }) => {
  await page.goto("./");
  await page.getByTestId("header-about").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("header-about")).toBeFocused();
});
```

> `toHaveCount(0)` is used for the closed assertion because it polls, so it also catches a panel that lingers through its exit transition. That is the same reasoning as the comment at `e2e/app.spec.ts:58`.

- [ ] **Step 2: Update the surviving tests' selectors**

In `"header info icon opens the About page with the coffee CTA"`, `"Settings 'Om appen' row opens the About page"`, `"'Om appen' row stays reachable while the challenge is locked"`, and the analytics test — the heading assertions still work unchanged. Only replace any `getByTestId("about-screen")` reference (there is one, in a test being deleted). Rename the first test to `"header info icon opens the About drawer with the coffee CTA"`.

Leave the 4-tab IA guard **completely untouched** — it is independent of this change and its comment explains a decision that still holds.

- [ ] **Step 3: Run the suite**

Run: `npm run build && npx playwright test e2e/about.spec.ts`
Expected: all pass. Report the count (was 7; expect 9 after +4 −2).

- [ ] **Step 4: Prove the new dismissal tests can fail**

The Escape, backdrop, and focus-restore tests assert behaviour supplied by Base UI rather than by our code, so they could silently pass for the wrong reason. Prove each is real: temporarily set `disablePointerDismissal` on `Drawer.Root` and confirm the backdrop test goes RED; temporarily pass `finalFocus={false}` to `Drawer.Popup` and confirm the focus-restore test goes RED.

**Back up `components/AboutDrawer.tsx` to the scratchpad first and restore with `git checkout --`, not by hand-editing.** Confirm `git status --short` is clean before committing.

- [ ] **Step 5: Full regression**

Run: `npm run test:e2e`
Expected: everything green, including `e2e/shell.spec.ts`'s brand and root-path tests. Report the total.

- [ ] **Step 6: Commit**

```bash
git add e2e/about.spec.ts
git commit -m "test(#3): cover the About drawer's overlay and dismissal behaviour"
```

---

## Task 5: Update the spec and run the full gates

**Files:**
- Modify: `docs/superpowers/specs/2026-07-05-about-page-and-support-design.md`

- [ ] **Step 1: Record the drawer decision in the spec**

The spec's "Information architecture" section states About is a new `state.screen === "about"` view reached via the header ⓘ and the Settings row. Update the parts that describe it as a screen so the spec matches what ships. Keep the reciprocity/single-CTA rationale, the two entry points, and the 4-tab bottom-nav decision — none of those changed.

Add a short dated note recording *why* it changed, in the spec's own voice:

```markdown
> **Revised 2026-08-15 — About is a bottom drawer, not a screen.**
> As a screen it displaced whatever the user was looking at, and its "Tilbage"
> control always returned to Fremgang rather than where they came from. As a
> drawer it overlays the current screen and closing returns the user exactly
> where they were — which matters more here than usual, because the page exists
> to make an optional ask. Built on Base UI's `Drawer` (the only runtime
> dependency added) for swipe-to-dismiss, focus trapping, and scroll locking.
```

- [ ] **Step 1b: Fix the GA4 event dictionary, which was already drifting**

`docs/superpowers/specs/2026-06-30-ga4-events-design.md:14` defines `nav_screen` as *"user taps a bottom-nav tab"* with `screen` values `"progress"/"log"/"settings"/"bingo"`. About has **never** been a bottom-nav tab — it fired from the header ⓘ and the Settings row — and `"about"` was never added to that list. The drift predates this work; the drawer sharpens it.

We keep the `nav_screen` name (renaming would split the GA4 series in two, and GA4 can't union event names outside BigQuery). So fix the dictionary instead — add `"about"` to the value list and note that it is an **overlay that does not change the current screen**. The concrete risk otherwise is someone computing a nav funnel or screens-per-session over `nav_screen` and counting About as a screen transition the user never made.

Do **not** rewrite the historical plan documents (`docs/superpowers/plans/2026-07-05-about-page-and-support.md`, the handoff). This repo's precedent — set by upstream commit `be51634` — is that dated per-issue records keep their original wording. This new plan document supersedes them.

- [ ] **Step 2: Full verification gates**

Run each and paste real output:

```bash
lsof -nP -iTCP:4399 -sTCP:LISTEN     # must be empty
npx tsc --noEmit && npx eslint .
npm run build
npm run test:e2e
```

- [ ] **Step 3: Confirm the load-bearing invariants still hold**

```bash
git diff origin/main -- lib/storage.ts     # MUST be empty
git diff origin/main -- lib/analytics.ts   # MUST be exactly one added union member
grep -rn "trackEvent" lib/ components/ app/ e2e/   # MUST return nothing
grep -rn "AboutScreen\|goAbout\|about-content" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=out --exclude-dir=docs
```

The last grep must return nothing outside `docs/` — any hit is a leftover reference to the deleted screen.

- [ ] **Step 4: Confirm no unintended dependencies crept in**

```bash
git diff origin/main -- package.json
```

Expected: exactly one added line, `"@base-ui/react": "1.6.0"`. No `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, or `shadcn`.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-07-05-about-page-and-support-design.md docs/superpowers/plans/2026-08-15-about-drawer.md
git commit -m "docs(#3): record the About drawer decision in the spec"
```

- [ ] **Step 6: Push and update the PR description**

These commits belong to the already-open PR #35, whose body still describes About as a page with a back arrow. Push, then report to the orchestrator what needs rewording — **do not edit the PR yourself**; the orchestrator owns outward-facing changes.

```bash
git push
gh pr view 35 --json body --jq .body > /dev/null && echo "PR reachable"
```

Report which claims in the PR body are now stale. At minimum: the "Back arrow returns to Fremgang" test-plan line, the "Tilbage always returns to Fremgang" follow-up note (now resolved by this change), the test count, and the fact that a runtime dependency was added.

---

## Notes for the implementer

- **Working directory:** everything runs in the worktree `/Users/krisztinavajda/dev/reading-challenge/.claude/worktrees/feat/3-add-buy-me-a-coffee-support-button`. The agent harness **resets cwd between turns**, so put `cd <worktree> && …` inside *every* Bash call and verify `git rev-parse --show-toplevel` in the same call as any commit. Commits have landed on the main checkout before this way.
- **`npm run test:e2e` does not build.** Always `npm run build` first, and check port 4399 is free — a stale `serve-out.mjs` from another checkout will make Playwright test the wrong `out/`.
- **No hardcoded user-facing Danish.** Every visible string is a `copy.about.*` lookup.
- **Never touch `lib/storage.ts`** or the `sommerlaesning.v1.*` keys.
- **Do not add shadcn or its satellites.** One dependency, house styling. This was decided explicitly.
- The `--bleed` technique in the popup CSS is what stops an over-drag from revealing the page behind the panel; do not remove it when adjusting padding.
