> **Superseded by [`docs/superpowers/plans/2026-08-15-about-drawer.md`](2026-08-15-about-drawer.md) — About ships as a bottom drawer, not a screen.**
> Kept as a dated record of the original design; do not implement from it.

# About Page + "Buy Me a Coffee" Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an About page (personal story + a single Buy Me a Coffee CTA), reachable via a header ⓘ icon and a Settings "Om appen" row, without touching the bottom nav.

**Architecture:** About is a new `state.screen === "about"` view (no router, no persisted state), rendered by `AppShell` exactly like the existing screens. Navigation is a plain `SET_SCREEN` dispatch behind a `goAbout()` action. The CTA is an external anchor to a `SUPPORT_URL` constant and fires a `support_click` analytics event. All Danish text comes from `copy/da.json`.

**Tech Stack:** Next.js static export, React client components, TypeScript, `@/lib/copy` (i18n), `@/lib/analytics` (GA4 seam), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-07-05-about-page-and-support-design.md`

---

## File Structure

- **Create** `lib/links.ts` — the `SUPPORT_URL` constant (config, not copy).
- **Create** `components/AboutScreen.tsx` — the About view (story + coffee CTA card). Small, single responsibility.
- **Create** `e2e/about.spec.ts` — behavioural + analytics coverage for About.
- **Modify** `copy/da.json` — new `about` block + `settings.about` label.
- **Modify** `lib/analytics.ts` — add `"support_click"` to the `EventName` union.
- **Modify** `lib/store.tsx` — extend `Screen` union, add `goAbout` action.
- **Modify** `components/AppShell.tsx` — render `AboutScreen`; add the header ⓘ button.
- **Modify** `components/SettingsScreen.tsx` — add the "Om appen" row.

---

## Task 1: Foundations — copy, URL constant, analytics event

**Files:**
- Modify: `copy/da.json`
- Create: `lib/links.ts`
- Modify: `lib/analytics.ts:6-11` (the `EventName` union)

- [ ] **Step 1: Add the `about` copy block to `copy/da.json`**

Add this top-level key (sibling of `settings`, `bingo`):

```json
  "about": {
    "navAria": "Om appen",
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

- [ ] **Step 2: Add the Settings row label to `copy/da.json`**

Inside the existing `"settings"` object, add one key (e.g. right after `"footer"`):

```json
    "about": "Om appen"
```

- [ ] **Step 3: Create `lib/links.ts`**

```ts
// External links. Config values (not translatable copy), so they live here
// rather than in copy/da.json.

/** Buy Me a Coffee support page (see issue #3). */
export const SUPPORT_URL = "https://buymeacoffee.com/kriszta.vajda";
```

- [ ] **Step 4: Add `"support_click"` to the analytics `EventName` union in `lib/analytics.ts`**

```ts
type EventName =
  | "challenge_started"
  | "reading_logged"
  | "challenge_completed"
  | "nav_screen"
  | "bingo_feat_completed"
  | "support_click";
```

- [ ] **Step 5: Verify types + lint are clean**

Run: `npx tsc --noEmit && npx eslint .`
Expected: no errors. (`copy.about.*` and `copy.settings.about` now type-check because `copy` is typed as `typeof da`.)

- [ ] **Step 6: Commit**

```bash
git add copy/da.json lib/links.ts lib/analytics.ts
git commit -m "feat(#3): copy, SUPPORT_URL, and support_click event for About page"
```

---

## Task 2: About screen + header entry point

**Files:**
- Modify: `lib/store.tsx:66` (`Screen` union), `lib/store.tsx:786-789` (`Actions` interface), `lib/store.tsx:881-896` (actions object)
- Create: `components/AboutScreen.tsx`
- Modify: `components/AppShell.tsx`
- Create: `e2e/about.spec.ts`

- [ ] **Step 1: Write the failing e2e test**

Create `e2e/about.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const SUPPORT_URL = "https://buymeacoffee.com/kriszta.vajda";

test("header info icon opens the About page with the coffee CTA", async ({ page }) => {
  await page.goto("./");
  await page.getByTestId("header-about").click();

  await expect(page.getByRole("heading", { name: "Om Læseudfordring" })).toBeVisible();
  await expect(
    page.getByText("Jeg lavede Læseudfordring i min fritid", { exact: false }),
  ).toBeVisible();

  const cta = page.getByRole("link", { name: "Køb mig en kaffe" });
  await expect(cta).toHaveAttribute("href", SUPPORT_URL);
  await expect(cta).toHaveAttribute("target", "_blank");
  await expect(cta).toHaveAttribute("rel", /noopener/);
});

test("bottom nav is still usable from the About page", async ({ page }) => {
  await page.goto("./");
  await page.getByTestId("header-about").click();
  await expect(page.getByRole("heading", { name: "Om Læseudfordring" })).toBeVisible();

  await page.getByRole("button", { name: "Læselog" }).click();
  await expect(page.getByRole("heading", { name: "Om Læseudfordring" })).toHaveCount(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build && npx playwright test e2e/about.spec.ts -g "header info icon"`
Expected: FAIL — `getByTestId("header-about")` not found (no header button yet).

> Note: `test:e2e` runs against `./out`, so a `npm run build` must precede each e2e run in this plan.

- [ ] **Step 3: Extend the `Screen` union in `lib/store.tsx`**

Line 66:

```ts
export type Screen = "progress" | "log" | "settings" | "bingo" | "about";
```

- [ ] **Step 4: Add `goAbout` to the `Actions` interface in `lib/store.tsx`**

Alongside the other `goX` declarations (near line 786-789):

```ts
  goAbout: () => void;
```

- [ ] **Step 5: Implement `goAbout` in the actions object in `lib/store.tsx`**

Next to `goBingo` (near line 893). Use plain `SET_SCREEN` (not `GO_SETTINGS`), so it clears any transient `editing` session like every other nav does:

```ts
      goAbout: () => {
        track("nav_screen", { screen: "about" });
        dispatch({ type: "SET_SCREEN", screen: "about" });
      },
```

- [ ] **Step 6: Create `components/AboutScreen.tsx`**

```tsx
"use client";

// Om Læseudfordring (About) screen. Reached from the header ⓘ button and the
// Settings "Om appen" row — NOT a bottom-nav tab (see spec IA). Returns only the
// screen's inner scrollable content; the app header + bottom nav come from
// <AppShell/>. No persisted state. All user-facing text comes from copy.

import type { CSSProperties } from "react";
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

export default function AboutScreen() {
  const { state, actions } = useApp();

  return (
    <section data-testid="about-screen" style={{ paddingTop: 8 }}>
      {/* Back row: arrow → home (Progress). Bottom nav also stays available. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button
          type="button"
          onClick={actions.goProgress}
          aria-label={copy.about.back}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{ display: "inline-flex", padding: 4, borderRadius: 10, color: "#8A7559" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5 L8 12 L15 19" />
          </svg>
        </button>
        <h2 className="text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, margin: 0 }}>
          {copy.about.title}
        </h2>
      </div>

      {/* Mascot hero — the child's chosen mascot, happy. */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
        <MascotFace animal={state.mascot} stage={7} confetti={false} bob={false} />
      </div>

      {/* Story (2 short paragraphs). */}
      {copy.about.intro.map((para, i) => (
        <p
          key={i}
          className="text-ink-2"
          style={{ fontSize: 15, lineHeight: 1.6, marginTop: i === 0 ? 8 : 12, textAlign: "center" }}
        >
          {para}
        </p>
      ))}

      {/* Support card — the single coffee CTA. */}
      <div style={{ ...CARD, marginTop: 18, textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "#4F4034" }}>
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
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 8 H17 V13 A4 4 0 0 1 13 17 H8 A4 4 0 0 1 4 13 Z" />
            <path d="M17 9 H19.5 A2 2 0 0 1 19.5 13 H17" />
            <path d="M7 3 V5 M10.5 3 V5 M14 3 V5" />
          </svg>
          {copy.about.support.cta}
        </a>
      </div>

      <div style={{ textAlign: "center", fontSize: 12, color: "#C2B299", marginTop: 20 }}>
        {copy.about.thanks}
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Wire `AboutScreen` + header button into `components/AppShell.tsx`**

Add the import near the other screen imports:

```tsx
import AboutScreen from "@/components/AboutScreen";
```

Render it in `<main>` alongside the others:

```tsx
            {state.screen === "about" && <AboutScreen />}
```

Replace the `<header>`'s content so the app name is followed by a right-aligned control cluster holding the ⓘ button (the cluster is where the future language pill will sit — see spec). The `useApp()` call at the top of `AppShell` must also expose `actions`:

```tsx
  const { state, actions } = useApp();
```

Header markup (keep the existing logo `<svg>` and `<h1>`; add the cluster after the `<h1>`):

```tsx
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            data-testid="header-about"
            onClick={actions.goAbout}
            aria-label={copy.about.navAria}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={{ boxShadow: "0 0 0 1.5px #F0DBB4 inset" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11 V16" />
              <path d="M12 8 H12.01" />
            </svg>
          </button>
        </div>
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run build && npx playwright test e2e/about.spec.ts`
Expected: PASS (both tests).

- [ ] **Step 9: Commit**

```bash
git add lib/store.tsx components/AboutScreen.tsx components/AppShell.tsx e2e/about.spec.ts
git commit -m "feat(#3): About screen + header info-icon entry point"
```

---

## Task 3: Settings "Om appen" row

**Files:**
- Modify: `components/SettingsScreen.tsx` (near the footer, around line 384)
- Modify: `e2e/about.spec.ts` (add one test)

- [ ] **Step 1: Write the failing e2e test**

Append to `e2e/about.spec.ts`:

```ts
test("Settings 'Om appen' row opens the About page", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Indstillinger" }).click();

  await page.getByTestId("settings-about").click();
  await expect(page.getByRole("heading", { name: "Om Læseudfordring" })).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build && npx playwright test e2e/about.spec.ts -g "Om appen"`
Expected: FAIL — `getByTestId("settings-about")` not found.

- [ ] **Step 3: Add the "Om appen" row to `components/SettingsScreen.tsx`**

Insert this button immediately **above** the existing footer `<div>` (`{copy.settings.footer}`, ~line 384). It reuses the card look and calls `goAbout`:

```tsx
        <button
          type="button"
          data-testid="settings-about"
          onClick={actions.goAbout}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{
            width: "100%",
            marginTop: 14,
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 6px 16px rgba(80,55,25,.08)",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 11,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C99A3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11 V16" />
            <path d="M12 8 H12.01" />
          </svg>
          <span style={{ flex: 1, textAlign: "left", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5, color: "#4F4034" }}>
            {copy.settings.about}
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2B299" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5 L16 12 L9 19" />
          </svg>
        </button>
```

> `actions` is already destructured in `SettingsScreen` (`const { state, derived, actions } = useApp()`), so no change to the hook call is needed. Verify this at the top of the file; if only `state`/`derived` are destructured, add `actions`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run build && npx playwright test e2e/about.spec.ts -g "Om appen"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/SettingsScreen.tsx e2e/about.spec.ts
git commit -m "feat(#3): add 'Om appen' row to Settings"
```

---

## Task 4: Analytics coverage (nav_screen + support_click)

**Files:**
- Modify: `e2e/about.spec.ts` (add one analytics test using the gtag stub pattern)

- [ ] **Step 1: Write the failing/again-verifying analytics test**

Append to `e2e/about.spec.ts`. This mirrors the `stubGtag` pattern from `e2e/analytics-events.spec.ts`:

```ts
test("About fires nav_screen(about) and the CTA fires support_click", async ({ page, context }) => {
  await context.addInitScript(() => {
    const w = window as unknown as { __gaEvents: unknown[][]; gtag: (...a: unknown[]) => void };
    w.__gaEvents = [];
    w.gtag = (...args: unknown[]) => {
      w.__gaEvents.push(args);
    };
  });
  // Never hit the real support host in CI — the popup opens with the URL set,
  // but its network request is aborted.
  await context.route(/buymeacoffee\.com/, (route) => route.abort());

  await page.goto("./");
  await page.getByTestId("header-about").click();
  await expect(page.getByRole("heading", { name: "Om Læseudfordring" })).toBeVisible();

  const cta = page.getByRole("link", { name: "Køb mig en kaffe" });
  const [popup] = await Promise.all([page.waitForEvent("popup"), cta.click()]);
  expect(popup.url()).toContain("buymeacoffee.com/kriszta.vajda");
  await popup.close();

  const events = await page.evaluate(
    () => (window as unknown as { __gaEvents: unknown[][] }).__gaEvents,
  );
  // Each entry is ["event", name, params?]
  const names = events.map((e) => e[1]);
  expect(names).toContain("nav_screen");
  expect(names).toContain("support_click");
  const nav = events.find((e) => e[1] === "nav_screen");
  expect((nav?.[2] as { screen?: string })?.screen).toBe("about");
});
```

- [ ] **Step 2: Run the test**

Run: `npm run build && npx playwright test e2e/about.spec.ts -g "support_click"`
Expected: PASS (the CTA handler + `goAbout` from Tasks 1-2 already emit these events).

- [ ] **Step 3: Commit**

```bash
git add e2e/about.spec.ts
git commit -m "test(#3): analytics coverage for About nav + support_click"
```

---

## Task 5: Full verification gates

**Files:** none (verification only).

- [ ] **Step 1: Type + lint**

Run: `npx tsc --noEmit && npx eslint .`
Expected: clean.

- [ ] **Step 2: Build (static export + SW inject)**

Run: `npm run build`
Expected: succeeds; `out/` regenerated.

- [ ] **Step 3: Full e2e suite**

Run: `npm run test:e2e`
Expected: all specs green (existing + `e2e/about.spec.ts`). A red suite blocks the Pages deploy.

- [ ] **Step 4: Confirm no `localStorage` keys changed**

Run: `git diff main -- lib/storage.ts`
Expected: empty diff — the `sommerlaesning.v1.*` key set is untouched (About has no persisted state).

---

## Notes for the implementer

- **No hardcoded Danish** — every visible string is a `copy.about.*` / `copy.settings.about` lookup. Do not inline literals in JSX.
- **No new persisted state** — About is a pure view, so there is intentionally no `storage.ts` change and no hydration guard.
- **Header cluster** uses `ml-auto` so it right-aligns; it is deliberately laid out to seat the future language pill next to the ⓘ button (separate issue — do not build the switcher here).
- **`test:e2e` does not build** — always `npm run build` before running Playwright, or you test a stale `./out`.
- Keep `AboutScreen.tsx` focused and under the 300-line limit (it is ~110 lines as written).
