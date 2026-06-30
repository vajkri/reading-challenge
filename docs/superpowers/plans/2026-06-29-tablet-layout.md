# Tablet Layout (issue #25) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Læseudfordring usable and elegant on tablets by lifting the hard `max-w-[430px]` shell cap and reflowing each screen for wider viewports — without changing the phone experience at all.

**Architecture:** One breakpoint, `768px`, everywhere. Two screens that use Tailwind (`AppShell`, `BottomNav`) get `md:` utilities; the inline-styled screens get a class on their container plus `@media (min-width: 768px)` rules in `app/globals.css`, following the existing `.progress-screen` / `.goal-slider` convention. Sizes that must grow on tablet are driven by CSS custom properties set on the parent (the existing `--mascot-scale` pattern). Phones (≤430px, and the 440px Playwright viewport) never match `min-width: 768px`, so their layout is byte-identical.

**Tech Stack:** Next.js (static export), React, Tailwind v4 (`@import "tailwindcss"`, default breakpoints), inline styles + `globals.css`, Playwright e2e.

**Design reference:** approved mockup at `scratchpad/tablet-proposal.html` (v2). Per-screen intent:
- **Fremgang:** 2-col — mascot + caption left, larger ring + deadline right.
- **Læselog:** centered add-form (~520px); entries become 2-col (~760px) beneath it.
- **Indstillinger:** unchanged single column, just centered + capped (~520px).
- **Læsebingo:** stays 3-wide (short rows keep row-confetti easy), just larger cells capped ~540px.
- **Nav:** stays the bottom bar; inner content caps ~520px and centers.

**Constraints (from CLAUDE.md):**
- No hardcoded user-facing Danish — this plan adds **zero** new strings, so nothing to add to `copy/da.json`.
- Don't touch `MascotFace.tsx` geometry, `storage.ts` keys, or `next.config.ts`.
- Verify gates must be clean: `npx tsc --noEmit && npx eslint .`, `npm run build`, `npm run test:e2e` (build first).

**Testing note:** This is layout/CSS work; the project's test harness is Playwright e2e at a phone viewport. Pure unit-TDD doesn't fit visual layout, so verification is: (a) two new e2e assertions that give real regression protection for the load-bearing change (shell lifts past 430; nav stays capped), and (b) visual verification via the preview server at tablet width per task. Existing e2e must stay green throughout.

---

## File Structure

- `components/AppShell.tsx` — lift the shell `max-width`; add `data-testid` for the e2e width check.
- `components/BottomNav.tsx` — wrap the tabs in a capped, centered inner container; add `data-testid`.
- `components/ProgressScreen.tsx` — add `data-lifecycle` + class hooks for the 2-col grid.
- `components/LogScreen.tsx` — wrap the head (title + add-form) and tag the entries list for the 2-col grid.
- `components/SettingsScreen.tsx` — wrap the content in a centered, capped container.
- `components/BingoScreen.tsx` — tag the board grid for tablet sizing.
- `components/BingoModal.tsx` — small `maxWidth` bump (issue called it out).
- `app/globals.css` — all `@media (min-width: 768px)` rules + the new CSS variables.
- `e2e/app.spec.ts` — a `tablet layout` describe block with two assertions.

---

### Task 1: Lift the shell cap

**Files:**
- Modify: `components/AppShell.tsx:20`

- [ ] **Step 1: Raise the max-width and add a test hook**

In `components/AppShell.tsx`, change the root `<div>` line 20 from:

```tsx
    <div className="relative mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-app">
```

to:

```tsx
    <div
      data-testid="app-shell"
      className="relative mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-app md:max-w-[1280px]"
    >
```

Rationale: phones keep the 430px cap; at ≥768px the shell may grow to the issue's 1280px ceiling. Per-screen content caps (Tasks 3–6) keep the inner content readable inside that wider frame.

- [ ] **Step 2: Verify build is clean**

Run: `npx tsc --noEmit && npx eslint .`
Expected: no output / exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/AppShell.tsx
git commit -m "feat(#25): lift shell max-width to 1280px on tablet"
```

---

### Task 2: Cap & center the bottom nav

**Files:**
- Modify: `components/BottomNav.tsx:54-99`

- [ ] **Step 1: Wrap the tabs in a capped, centered container**

In `components/BottomNav.tsx`, the `<nav>` currently holds the three children (lifecycle group, divider, bingo group) directly. Add `justify-center` to the `<nav>` and wrap its three children in a single capped flex container.

Change the opening `<nav>` from:

```tsx
    <nav
      className="sticky bottom-0 z-20 flex bg-white"
      style={{ borderTop: "1.5px solid #F2E6D2", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
```

to:

```tsx
    <nav
      className="sticky bottom-0 z-20 flex justify-center bg-white"
      style={{ borderTop: "1.5px solid #F2E6D2", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div data-testid="nav-inner" className="flex w-full max-w-[520px]">
```

Then, immediately before the closing `</nav>`, close the new wrapper. The current end of the component is:

```tsx
      {/* Standalone seasonal feature */}
      <div className="flex flex-1 pl-1">
        <Tab active={s === "bingo"} label={copy.bingo.nav} onClick={actions.goBingo}>
          <svg {...iconProps} strokeWidth={2}>
            <rect x="4" y="4" width="16" height="16" rx="2.5" />
            <path d="M9.3 4 V20 M14.7 4 V20 M4 9.3 H20 M4 14.7 H20" />
          </svg>
        </Tab>
      </div>
    </nav>
```

Change the tail to:

```tsx
      {/* Standalone seasonal feature */}
      <div className="flex flex-1 pl-1">
        <Tab active={s === "bingo"} label={copy.bingo.nav} onClick={actions.goBingo}>
          <svg {...iconProps} strokeWidth={2}>
            <rect x="4" y="4" width="16" height="16" rx="2.5" />
            <path d="M9.3 4 V20 M14.7 4 V20 M4 9.3 H20 M4 14.7 H20" />
          </svg>
        </Tab>
      </div>
      </div>
    </nav>
```

Rationale: on phones (≤440px) `max-w-[520px]` is inert and the flex layout is identical; on tablets the bar stays full-bleed white while the tabs cap at 520px and center.

- [ ] **Step 2: Verify build is clean**

Run: `npx tsc --noEmit && npx eslint .`
Expected: no output / exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/BottomNav.tsx
git commit -m "feat(#25): cap and center the bottom nav on tablet"
```

---

### Task 3: Fremgang — 2-column tablet layout

**Files:**
- Modify: `components/ProgressScreen.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Move the section's base layout into the class + add data-lifecycle**

In `components/ProgressScreen.tsx`, the `<section className="progress-screen" ...>` currently sets `display`, `flexDirection`, `alignItems` inline. Move those into the class (Step 4) so the tablet `@media` grid can override them without `!important`, and add a `data-lifecycle` attribute.

Replace the opening `<section>` (lines ~65-77):

```tsx
    <section
      data-screen-label="Fremgang"
      className="progress-screen"
      style={{
        flex: "1 1 auto",
        overflowY: "auto",
        padding: "var(--pad-top) 22px calc(var(--pad-top) + 10px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
```

with:

```tsx
    <section
      data-screen-label="Fremgang"
      className="progress-screen"
      data-lifecycle={
        derived.isOngoing ? "ongoing" : derived.isCompleted ? "completed" : "none"
      }
      style={{
        flex: "1 1 auto",
        overflowY: "auto",
        padding: "var(--pad-top) 22px calc(var(--pad-top) + 10px)",
      }}
    >
```

- [ ] **Step 2: Add class hooks to the three grid children**

The 2-col grid places the mascot hero (col 1, row 1), the caption (col 1, row 2) and the ongoing ring/deadline block (col 2, spanning both rows). Add a class to each.

(a) The mascot hero wrapper — the `<div>` at lines ~85-95 that starts:

```tsx
      <div
        style={{
          position: "relative",
          width: "calc(200px * var(--mascot-scale))",
          height: "calc(172px * var(--mascot-scale))",
          marginTop: 6,
```

Add `className="mascot-hero"` as its first prop:

```tsx
      <div
        className="mascot-hero"
        style={{
          position: "relative",
          width: "calc(200px * var(--mascot-scale))",
          height: "calc(172px * var(--mascot-scale))",
          marginTop: 6,
```

(b) The ongoing caption — the `{derived.isOngoing && (` block's `<div>` at lines ~121-127:

```tsx
        <div
          style={{
            ...display,
            marginTop: "var(--hero-gap)",
```

Add `className="progress-caption"`:

```tsx
        <div
          className="progress-caption"
          style={{
            ...display,
            marginTop: "var(--hero-gap)",
```

(c) The ongoing ring/deadline wrapper — the `{derived.isOngoing && (` block's outer `<div>` at lines ~194-202:

```tsx
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
          }}
        >
```

Add `className="progress-ongoing"`:

```tsx
        <div
          className="progress-ongoing"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
          }}
        >
```

- [ ] **Step 3: Make the ring size a variable**

So the ring can grow on tablet, drive its width from a CSS variable. In the ongoing ring block, the inner ring `<div>` at lines ~203-209 currently:

```tsx
          <div
            style={{
              position: "relative",
              width: "clamp(168px, 30dvh, 236px)",
              aspectRatio: "1 / 1",
              marginTop: "var(--hero-gap)",
            }}
          >
```

Change `width` to read the variable:

```tsx
          <div
            style={{
              position: "relative",
              width: "var(--ring-size)",
              aspectRatio: "1 / 1",
              marginTop: "var(--hero-gap)",
            }}
          >
```

- [ ] **Step 4: Add the responsive CSS**

In `app/globals.css`, find the existing `.progress-screen` rule (the `--mascot-scale` block, ~lines 141-145):

```css
.progress-screen {
  --mascot-scale: 1;     /* face transform multiplier (ceiling 1 = 150x162) */
  --hero-gap: 14px;      /* caption / ring / deadline vertical rhythm        */
  --pad-top: 14px;       /* section top padding                              */
}
```

Replace it with (adds the base flex layout — moved from the inline style — and the new `--ring-size` token):

```css
.progress-screen {
  --mascot-scale: 1;     /* face transform multiplier (ceiling 1 = 150x162) */
  --hero-gap: 14px;      /* caption / ring / deadline vertical rhythm        */
  --pad-top: 14px;       /* section top padding                              */
  --ring-size: clamp(168px, 30dvh, 236px); /* progress ring diameter        */
  display: flex;
  flex-direction: column;
  align-items: center;
}
```

Then, at the END of `app/globals.css`, append the tablet rules:

```css
/* ---------------------------------------------------------------------------
   TABLET LAYOUT (issue #25)
   At >=768px the shell cap is lifted (see AppShell). Each screen reflows for
   the wider canvas. The 440px Playwright viewport and real phones never match
   these queries, so the phone layout is unchanged.
--------------------------------------------------------------------------- */
@media (min-width: 768px) {
  /* Fremgang — ongoing only: mascot+caption (left) beside the ring (right). */
  .progress-screen[data-lifecycle="ongoing"] {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 48px;
    align-items: center;
    justify-items: center;
    align-content: center;
    width: 100%;
    max-width: 900px;
    margin-inline: auto;
  }
  .progress-screen[data-lifecycle="ongoing"] > .mascot-hero {
    grid-column: 1;
    grid-row: 1;
    align-self: flex-end;
  }
  .progress-screen[data-lifecycle="ongoing"] > .progress-caption {
    grid-column: 1;
    grid-row: 2;
  }
  .progress-screen[data-lifecycle="ongoing"] > .progress-ongoing {
    grid-column: 2;
    grid-row: 1 / span 2;
  }
}

/* Grow the mascot + ring only when there's real vertical room (true tablets),
   so a short, wide desktop window doesn't get an oversized hero. */
@media (min-width: 768px) and (min-height: 700px) {
  .progress-screen {
    --mascot-scale: 1.25;
    --ring-size: clamp(240px, 32dvh, 300px);
  }
}
```

- [ ] **Step 5: Verify build is clean**

Run: `npx tsc --noEmit && npx eslint .`
Expected: no output / exit 0.

- [ ] **Step 6: Visual check at tablet width**

Start the preview (`npm run dev`), open at tablet size (e.g. 1024×1366), seed an ongoing challenge (or start one). Confirm: mascot + caption sit left, the larger ring + deadline pill sit right, vertically centered; nothing overflows; the `none` and `completed` states still render as a single centered column.

- [ ] **Step 7: Commit**

```bash
git add components/ProgressScreen.tsx app/globals.css
git commit -m "feat(#25): two-column Fremgang on tablet"
```

---

### Task 4: Læselog — centered form + 2-column entries

**Files:**
- Modify: `components/LogScreen.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Wrap the head (title + add button + add form) in a capped container**

In `components/LogScreen.tsx`, the title row, the add button, and the add form are the first three blocks inside the `<section>`. Wrap them in a `<div className="log-head">`.

Find the title `<div>` (lines ~22-44) and add the wrapper opening just before it. Then close the wrapper right after the add-form block (`{showAddForm && (...)}`). Concretely, the region from the title row through the add form becomes:

```tsx
      <div className="log-head">
        {/* Header: title + total summary */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 20,
              color: "var(--color-ink)",
            }}
          >
            {copy.log.title}
          </h2>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--color-ink-3)" }}>
            {derived.total} {copy.log.totalSuffix}
          </div>
        </div>

        {/* Add button (only when no form is open) */}
        {!state.formOpen && (
          <button
            type="button"
            onClick={actions.openAdd}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 16,
              background: "var(--color-accent)",
              color: "#fff",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 8px 18px rgba(246,166,35,.32)",
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1, marginTop: -2 }}>+</span>{" "}
            {copy.log.addBtn}
          </button>
        )}

        {/* Top add form with quick-pick chips above the Titel field */}
        {showAddForm && (
          <EntryForm>{derived.hasRecentBooks && <QuickPickRow />}</EntryForm>
        )}
      </div>
```

(This is the existing markup, unchanged, wrapped in `<div className="log-head"> … </div>`.)

- [ ] **Step 2: Tag the entries list**

The entries list `<div>` (lines ~110-112) is:

```tsx
      <div
        style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 11 }}
      >
```

Change it to use a class (move `display/flexDirection/gap` to the class so the tablet grid can override them; keep `marginTop` inline):

```tsx
      <div className="log-entries" style={{ marginTop: 14 }}>
```

Leave the empty-state block (`{derived.noEntries && ...}`) where it is — it renders before the list and is fine full-width/centered.

- [ ] **Step 3: Add the responsive CSS**

Append to `app/globals.css` (inside a new rule, after the Task 3 block):

```css
@media (min-width: 768px) {
  /* Læselog — centered add-form, two-column entries beneath. */
  .log-head {
    max-width: 520px;
    margin-inline: auto;
  }
  .log-entries {
    max-width: 760px;
    margin-inline: auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    align-items: start;
  }
}
```

Also add the phone base for `.log-entries` so removing the inline flex doesn't change phone rendering. Put this with the other base rules (not in a media query) — append near the end of `globals.css` but OUTSIDE the `@media`:

```css
.log-entries {
  display: flex;
  flex-direction: column;
  gap: 11px;
}
```

(Place this base rule BEFORE the `@media (min-width: 768px)` `.log-entries` override, or the grid won't win on tablet — later/more-specific wins; a media query already beats a plain rule, so ordering the base rule first is correct.)

- [ ] **Step 4: Verify build is clean**

Run: `npx tsc --noEmit && npx eslint .`
Expected: no output / exit 0.

- [ ] **Step 5: Visual check at tablet width**

In the preview at 1024px wide, seed an ongoing challenge with several entries. Confirm: the title + add button + add form are centered (~520px); entries below flow into two columns (~760px), newest first; an inline edit (tap "Ret") shows the form in a single cell at roughly phone width — usable.

- [ ] **Step 6: Commit**

```bash
git add components/LogScreen.tsx app/globals.css
git commit -m "feat(#25): centered log form + 2-col entries on tablet"
```

---

### Task 5: Indstillinger — centered, capped column

**Files:**
- Modify: `components/SettingsScreen.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Wrap the screen content in a centered container**

In `components/SettingsScreen.tsx`, wrap everything inside the `<section>` EXCEPT `<UnlockModal />` (which renders its own fixed overlay) in `<div className="settings-content">`.

The section body runs from the `<h2>` (`{copy.settings.title}`) through the footer `<div>` (`{copy.settings.footer}`). Add `<div className="settings-content">` immediately after the opening `<section ...>` tag, and close it (`</div>`) immediately before `<UnlockModal />`.

So the structure becomes:

```tsx
    <section
      data-screen-label="Indstillinger"
      style={{ flex: "1 1 auto", overflowY: "auto", padding: "6px 22px 24px" }}
    >
      <div className="settings-content">
        <h2 ...>{copy.settings.title}</h2>
        {/* …banners, gating wrapper with the 4 cards, commit button, footer… */}
        <div style={{ textAlign: "center", fontSize: 12, color: "#C2B299", marginTop: 22, lineHeight: 1.5 }}>
          {copy.settings.footer}
        </div>
      </div>

      <UnlockModal />
    </section>
```

(No inner markup changes — only the wrapper is added around the existing content, with `<UnlockModal />` left outside it.)

- [ ] **Step 2: Add the responsive CSS**

Append to `app/globals.css` inside a `@media (min-width: 768px)` block (after the Task 4 block):

```css
@media (min-width: 768px) {
  /* Indstillinger — same single column, just centered + capped. */
  .settings-content {
    max-width: 520px;
    margin-inline: auto;
  }
}
```

- [ ] **Step 3: Verify build is clean**

Run: `npx tsc --noEmit && npx eslint .`
Expected: no output / exit 0.

- [ ] **Step 4: Visual check at tablet width**

In the preview at 1024px, open Indstillinger (none state). Confirm the four cards + commit button form one centered column (~520px), not stretched across the tablet. Start a challenge and confirm the ongoing/edit banner and the commit button also sit within the centered column.

- [ ] **Step 5: Commit**

```bash
git add components/SettingsScreen.tsx app/globals.css
git commit -m "feat(#25): center the settings column on tablet"
```

---

### Task 6: Læsebingo — larger 3-column board + modal width

**Files:**
- Modify: `components/BingoScreen.tsx`
- Modify: `components/BingoModal.tsx:86`
- Modify: `app/globals.css`

- [ ] **Step 1: Tag the board grid**

In `components/BingoScreen.tsx`, the board `<div>` (lines ~75-82) is:

```tsx
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 9,
          marginTop: 14,
        }}
      >
```

Move the grid props to a class so the tablet rule can cap + space it; keep `marginTop` inline:

```tsx
      <div className="bingo-board" style={{ marginTop: 14 }}>
```

- [ ] **Step 2: Add the base + responsive CSS**

Append to `app/globals.css`. First the phone base (outside any media query), preserving today's look exactly:

```css
.bingo-board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 9px;
}
```

Then the tablet override (in a `@media (min-width: 768px)` block, after the Task 5 block):

```css
@media (min-width: 768px) {
  /* Læsebingo — keep 3 wide (short rows = easy row-confetti), just larger. */
  .bingo-board {
    max-width: 540px;
    margin-inline: auto;
    gap: 14px;
  }
}
```

(540px ÷ 3 ≈ 170px cells — noticeably bigger than phone, still a tidy board.)

- [ ] **Step 3: Bump the modal width**

In `components/BingoModal.tsx:86`, change:

```tsx
          maxWidth: 430,
```

to:

```tsx
          maxWidth: 460,
```

Small bump so the bottom sheet isn't tied to the retired 430px shell width; it stays a centered sheet.

- [ ] **Step 4: Verify build is clean**

Run: `npx tsc --noEmit && npx eslint .`
Expected: no output / exit 0.

- [ ] **Step 5: Visual check at tablet width**

In the preview at 1024px with the clock inside the Sommer '26 window (1 Jun–31 Aug 2026), open Bingo. Confirm the board is 3 columns, centered, with larger cells (~540px board); the title/count sit centered above it; tapping a tile opens the sheet and marking a row still fires confetti.

- [ ] **Step 6: Commit**

```bash
git add components/BingoScreen.tsx components/BingoModal.tsx app/globals.css
git commit -m "feat(#25): larger centered bingo board on tablet"
```

---

### Task 7: e2e — tablet regression assertions

**Files:**
- Modify: `e2e/app.spec.ts`

- [ ] **Step 1: Add a tablet describe block**

Append to the end of `e2e/app.spec.ts`. This re-uses the existing `seed` helper and `K`/`iso` already defined at the top of the file.

```ts
// --- Tablet layout (>=768px) --------------------------------------------

test.describe("tablet layout", () => {
  test.use({ viewport: { width: 1024, height: 1366 } });

  test("shell lifts past the phone cap", async ({ page, context }) => {
    await seed(context, {
      goal: "1000",
      challenge: "ongoing",
      name: "Max",
      deadline: iso(20),
      entries: [{ id: "a", title: "Vitello", author: "Kim Fupz", date: iso(-1), minutes: 500, created: 1 }],
    });
    await page.goto("./");
    await expect(page.getByText("500 / 1000 min")).toBeVisible();
    const box = await page.getByTestId("app-shell").boundingBox();
    expect(box).not.toBeNull();
    // On a 1024px viewport the shell is far wider than the old 430px cap.
    expect(box!.width).toBeGreaterThan(700);
  });

  test("bottom nav stays capped and centered", async ({ page }) => {
    await page.goto("./");
    const box = await page.getByTestId("nav-inner").boundingBox();
    expect(box).not.toBeNull();
    // Capped at 520px (allow a little slack); not stretched across the tablet.
    expect(box!.width).toBeLessThanOrEqual(560);
  });
});
```

- [ ] **Step 2: Build the static export (e2e runs against ./out)**

Run: `npm run build`
Expected: completes; `out/` regenerated; postbuild SW injection runs.

- [ ] **Step 3: Run the new tablet tests**

Run: `npx playwright test -g "tablet layout"`
Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add e2e/app.spec.ts
git commit -m "test(#25): tablet shell + nav regression assertions"
```

---

### Task 8: Full verification gates

**Files:** none (verification only).

- [ ] **Step 1: Types + lint**

Run: `npx tsc --noEmit && npx eslint .`
Expected: no output / exit 0.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Full e2e suite (the build above is current)**

Run: `npm run test:e2e`
Expected: all tests pass — including the existing phone-viewport tests (proving phone layout is unchanged) and the two new tablet tests. Pay special attention to `bingo: in-season shows the 3x5 board` and `bingo: completing a full row triggers row confetti` — both must stay green (the board is still 3-wide).

- [ ] **Step 4: Final visual sweep**

In the preview, check all four screens at three widths — **430px** (phone, must look identical to before), **768px** (breakpoint edge), **1024px** (tablet). Confirm no horizontal page scroll at any width and that the bottom nav never stretches edge-to-edge on tablet.

- [ ] **Step 5: Commit any final tweaks**

If the visual sweep surfaced spacing nits, fix them in the relevant component/`globals.css` and commit:

```bash
git add -A
git commit -m "polish(#25): tablet layout spacing"
```

---

## Self-Review

**Spec coverage (issue #25):**
- "Raise ceiling 430→1280" → Task 1. ✓
- `AppShell.tsx:20` anchor → Task 1. ✓
- `BingoModal.tsx:86` maxWidth revisit → Task 6 Step 3. ✓
- "Multi-column / larger where it makes sense" → Fremgang 2-col (Task 3), Log 2-col entries (Task 4), larger Bingo board (Task 6); Settings intentionally kept single-column per user feedback (Task 5). ✓
- "Consistent with existing design language" → no new colors/fonts/strings; reuses tokens + the `globals.css` media-query convention. ✓
- "Verify across phone ≤430, tablet ≥768, up to 1280" → Task 8 Step 4 (430/768/1024) + Task 1 ceiling 1280. ✓

**Placeholder scan:** none — every step has exact code/commands.

**Type/name consistency:** class names are stable across component + CSS: `progress-screen` (existing), `mascot-hero`, `progress-caption`, `progress-ongoing`, `--ring-size`, `log-head`, `log-entries`, `settings-content`, `bingo-board`; test ids `app-shell`, `nav-inner`. Breakpoint is `768px` in both Tailwind `md:` and the `@media` rules. ✓

**Cascade note:** the `.log-entries` and `.bingo-board` base rules (plain selectors) must appear in `globals.css` BEFORE their `@media (min-width: 768px)` overrides; a media-query rule of equal specificity wins only when it comes later in source order. Tasks 4/6 specify this ordering.
