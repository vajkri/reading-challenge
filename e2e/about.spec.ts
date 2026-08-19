import { readFile, readdir } from "node:fs/promises";

import { test, expect, type BrowserContext } from "@playwright/test";

const SUPPORT_URL = "https://buymeacoffee.com/kriszta.vajda";

// seed()/iso() are duplicated per spec file in this suite rather than shared —
// following the existing convention (see e2e/analytics-events.spec.ts).
const K = "sommerlaesning.v1.";
const iso = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

/** Seed localStorage before the app loads (re-applied on every navigation). */
async function seed(context: BrowserContext, data: Record<string, unknown>) {
  await context.addInitScript(
    ([prefix, s]) => {
      const obj = s as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        localStorage.setItem((prefix as string) + k, typeof v === "string" ? v : JSON.stringify(v));
      }
    },
    [K, data] as const,
  );
}

/**
 * Stub gtag before load so track() is observable on localhost; capture every call.
 * components/Analytics.tsx only injects the real gtag on the prod host, so without
 * this every track() is a silent no-op and the assertions below would be vacuous.
 */
async function stubGtag(context: BrowserContext) {
  await context.addInitScript(() => {
    const w = window as unknown as { __gaEvents: unknown[][]; gtag: (...a: unknown[]) => void };
    w.__gaEvents = [];
    w.gtag = (...args: unknown[]) => {
      w.__gaEvents.push(args);
    };
  });
}

test("header info icon opens the About drawer with the coffee CTA", async ({ page }) => {
  await page.goto("./");
  await page.getByTestId("header-about").click();

  await expect(page.getByRole("heading", { name: "Om Læsemakker" })).toBeVisible();
  await expect(
    page.getByText("Jeg byggede oprindeligt Læsemakker", { exact: false }),
  ).toBeVisible();

  // The hero illustration: asserted on src + alt only, deliberately NOT on
  // whether the bitmap loads. naturalWidth would couple this suite to the
  // asset being present in ./out, which is a separate concern.
  const illustration = page.getByRole("dialog").locator("img");
  await expect(illustration).toHaveAttribute("src", "/reading-girl.svg");
  await expect(illustration).toHaveAttribute("alt", "Barn der ligger og læser i en bog");

  const cta = page.getByRole("link", { name: "Giv til kaffekassen" });
  await expect(cta).toHaveAttribute("href", SUPPORT_URL);
  await expect(cta).toHaveAttribute("target", "_blank");
  // Exact, not /noopener/: this is the app's only external link, and a regex on
  // the first token stays green if `noreferrer` is ever dropped.
  await expect(cta).toHaveAttribute("rel", "noopener noreferrer");
});

// The illustration is the only in-app artwork served from the root, so it must be
// named explicitly in the precache allowlist in scripts/inject-sw-assets.mjs —
// that list is not a full walk of out/. Without it the drawer falls back to alt
// text on a cold offline launch, and the failure is silent: every other test here
// still passes. No page load needed; this reads the built service worker directly.
test("the drawer illustration is precached for offline use", async ({ request }) => {
  const sw = await (await request.get("sw.js")).text();
  expect(sw).toContain('"/reading-girl.svg"');
});

// --- Overlay semantics + dismissal -----------------------------------------
// About is a drawer, not a screen: it overlays whatever the user was on and
// closing returns them there. The closed assertions all use toHaveCount(0)
// rather than not.toBeVisible() because it polls, so it also catches a panel
// lingering through its exit transition — same reasoning as e2e/app.spec.ts:58.
//
// While the drawer is open Base UI marks the background aria-hidden, so the
// screen underneath is asserted with a CSS locator ([data-screen-label]) —
// a getByRole query would (correctly) not see it.

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

/**
 * Wiring guard for swipe-to-dismiss.
 *
 * WHY THIS EXISTS: the swipe gesture itself is deliberately NOT e2e-tested.
 * Base UI only responds to touch pointers (a `page.mouse` drag does nothing at
 * all, so a mouse-based swipe test would ship green while asserting nothing),
 * and the CDP `Input.dispatchTouchEvent` version that does work measured a 5-7%
 * failure rate under parallel workers — always at the release, where the drag
 * distance is compared against the dismiss threshold. This suite gates the Pages
 * deploy, so a gesture test that flakes is worse than no gesture test.
 *
 * The gesture is Base UI's code and is unlikely to regress. What CAN regress is
 * OUR wiring, and every way of breaking it is silent — the drawer still opens,
 * looks right, and closes via Escape/backdrop/Luk, so every other test here stays
 * green while swipe is dead. This asserts that contract deterministically:
 *   1. the popup is inside a real Drawer.Viewport (not a div wearing its class);
 *   2. `touch-action` isn't `none` — the browser would swallow the drag first;
 *   3. `--drawer-swipe-movement-y`, the variable Base UI writes on every pointer
 *      move, actually translates the panel — i.e. our transform wasn't replaced
 *      by a static one;
 *   4. `overscroll-behavior` stays `contain`, which is what keeps a drag from a
 *      scrolled position scrolling the content instead of chaining to the page.
 *
 * WHAT IT DOES NOT COVER: the gesture. Thresholds, velocity/flick handling, 1:1
 * finger tracking, and the scroll-vs-swipe arbitration are verified manually —
 * this test passing does not mean swiping works, only that nothing here makes it
 * impossible.
 */
test("the popup keeps the CSS contract swipe-to-dismiss depends on", async ({ page }) => {
  await page.goto("./");
  await page.getByTestId("header-about").click();
  const popup = page.getByTestId("about-drawer");
  await expect(popup).toBeVisible();

  // (1) A real Drawer.Viewport: our class AND Base UI's data-open, which only
  // the component emits — a hand-rolled div with the same class fails this.
  const viewport = page.locator(".about-drawer-viewport[data-open]");
  await expect(viewport).toHaveCount(1);
  await expect(viewport.getByTestId("about-drawer")).toHaveCount(1);

  // (2) + (4) The two properties that decide whether the browser or Base UI gets
  // the drag. Asserted on the y axis specifically — the drawer swipes downwards.
  await expect(popup).toHaveCSS("touch-action", "auto");
  await expect(popup).toHaveCSS("overscroll-behavior-y", "contain");

  // (3) Drive the variable and watch the panel move, rather than string-matching
  // the CSS: this stays true however the transform is expressed, and goes red the
  // moment the panel stops tracking the variable. Wait out the open transition
  // first so the entry animation can't be mistaken for the drag.
  await popup.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const restingY = (await popup.boundingBox())!.y;
  await popup.evaluate((el) =>
    (el as HTMLElement).style.setProperty("--drawer-swipe-movement-y", "120px"),
  );
  // Polls (the transform transitions), so no fixed timeout is needed.
  await expect
    .poll(async () => (await popup.boundingBox())!.y - restingY)
    .toBeGreaterThan(100);
});

// IA guard, deliberately its own test so a failure names the decision it broke.
// The spec locks the bottom nav at four tabs: About is reachable ONLY from the
// header ⓘ and the Settings row, because a 5th tab breaks the 3+1 grouping
// (three challenge-lifecycle tabs, divider, standalone Bingo). Scoped to the
// <nav> landmark rather than the [data-testid="nav-inner"] wrapper — there is
// exactly one nav, and the wrapper is a layout div that a refactor could drop.
test("the bottom nav stays at 4 tabs — About never becomes one", async ({ page }) => {
  await page.goto("./");

  const tabs = page.getByRole("navigation").getByRole("button");
  await expect(tabs).toHaveCount(4);
  // Names too, not just the count: a bare count(4) would also pass if a tab were
  // swapped for About rather than added alongside it.
  await expect(tabs).toHaveText(["Fremgang", "Læselog", "Indstillinger", "Bingo"]);
});

// Testid, not name: the Settings row and the header pill are both About entry
// points, and the row's own label ("Om appen") is not guaranteed to stay distinct
// from the pill's ("Om") — a testid keeps this test about placement, not copy.
test("Settings 'Om appen' row opens the About drawer", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Indstillinger" }).click();

  await page.getByTestId("settings-about").click();
  await expect(page.getByRole("heading", { name: "Om Læsemakker" })).toBeVisible();
});

// Regression guard for placement, not for navigation. The four config cards sit in a
// wrapper that goes `inert` while effLocked ((ongoing && !editing) || completed) — the
// row must stay a SIBLING of that wrapper. The test above runs with challenge "none",
// where the wrapper is interactive, so it passes either way; only this one goes red if
// the row is ever moved inside. One locked case is enough: effLocked is a plain OR and
// both branches render the identical wrapper, so "completed" would retread this path.
test("'Om appen' row stays reachable while the challenge is locked", async ({ page, context }) => {
  await seed(context, {
    challenge: "ongoing",
    name: "Max",
    goal: 1000,
    deadline: iso(30),
    entries: [{ id: "a", title: "Vitello", author: "", date: iso(-1), minutes: 30, created: 1 }],
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Indstillinger" }).click();

  // Preconditions: genuinely locked, not a mis-seeded "none" — the edit banner is up
  // and the config cards really did go inert. Without these the test could pass vacuously.
  await expect(page.getByRole("button", { name: "Rediger udfordring" })).toBeVisible();
  await expect(page.locator("[data-screen-label='Indstillinger'] [inert]")).toHaveCount(1);

  await page.getByTestId("settings-about").click();
  await expect(page.getByRole("heading", { name: "Om Læsemakker" })).toBeVisible();
});

test("About fires nav_screen(about) and the CTA fires support_click", async ({ page, context }) => {
  await stubGtag(context);
  // Never hit the real support host in CI. Fulfilling locally (rather than
  // aborting) keeps the request off the network *and* lets the popup settle on
  // the real URL — an aborted navigation lands on chrome-error:// instead.
  await context.route(/buymeacoffee\.com/, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<title>stub</title>" }),
  );

  await page.goto("./");
  await page.getByTestId("header-about").click();
  await expect(page.getByRole("heading", { name: "Om Læsemakker" })).toBeVisible();

  const cta = page.getByRole("link", { name: "Giv til kaffekassen" });
  const [popup] = await Promise.all([page.waitForEvent("popup"), cta.click()]);
  await popup.waitForURL(SUPPORT_URL);
  await popup.close();

  // Each captured entry is ["event", name, params?].
  const events = await page.evaluate(
    () => (window as unknown as { __gaEvents: unknown[][] }).__gaEvents,
  );
  const paramsFor = (name: string) =>
    events.filter((e) => e[1] === name).map((e) => e[2] as Record<string, unknown> | undefined);

  // nav_screen fires on EVERY navigation, so match on the payload rather than
  // taking the first one — this stays green if a nav is ever added ahead of it.
  expect(paramsFor("nav_screen").map((p) => p?.screen)).toContain("about");
  // The platform param is what makes support_click useful in GA4 — assert it.
  expect(paramsFor("support_click")).toEqual([{ platform: "buymeacoffee" }]);
});

// The About drawer is lazy-loaded. If its chunk fails to arrive the app must
// survive: before the .catch() in AppShell an aborted fetch unmounted the whole
// React root and left a blank page — and with NO user interaction, because the
// idle callback requests the chunk on every page load. So a flaky network on a
// first visit (before the SW has cached it) took down the reading app because an
// optional overlay's code didn't load.
//
// The chunk is found by content rather than by its hashed filename, and from the
// build output rather than from index.html — index.html deliberately does not
// reference it, which is the whole point of the lazy import. Discovering it up
// front and then aborting that one URL avoids intercepting every chunk: reading
// a route's body mid-flight and re-fulfilling it disposes the response under
// concurrent requests ("Response has been disposed").
test("a failed About chunk does not take down the app", async ({ page, context }) => {
  const chunkDir = "out/_next/static/chunks";
  const names = (await readdir(chunkDir)).filter((f) => f.endsWith(".js"));
  const bodies = await Promise.all(names.map((f) => readFile(`${chunkDir}/${f}`, "utf8")));
  const drawerChunk = names[bodies.findIndex((b) => b.includes("about-drawer-popup"))];
  // Guards against this test silently passing if the marker string ever changes.
  expect(drawerChunk, "no built chunk contains the drawer markup").toBeTruthy();

  await context.route(`**/_next/static/chunks/${drawerChunk}`, (route) => route.abort("failed"));

  // Wait for the request to actually be attempted and rejected before asserting
  // survival. The chunk is only fetched when the idle callback fires, so asserting
  // straight after goto() passes before the failure has even happened — and would
  // stay green with no error handling at all.
  const chunkFailed = page.waitForEvent("requestfailed", (r) => r.url().includes(drawerChunk));
  await page.goto("./");
  await chunkFailed;
  // Then hold for a window before asserting. This is proving a negative — that
  // nothing tears the app down later — so it needs real elapsed time, not a
  // retrying matcher: toBeVisible() would pass on the first poll and the unmount
  // would land after the test ended. Without the .catch() the root is gone 303ms
  // after this point (measured), so 1000ms is ~3x the observed teardown.
  await page.waitForTimeout(1000);

  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(page.locator('[data-screen-label="Fremgang"]')).toBeVisible();
});

// The close handle is a sibling of Drawer.Content *inside* the scrolling popup,
// so before it was made sticky, scrolling to the coffee CTA on a short viewport
// carried the only visible close control off-screen (y = -284 at 320x568). The
// panel was still dismissible by Escape, backdrop and swipe, but the stated
// design is "the grab handle IS the close button" and at the CTA it was gone.
//
// Also pins the target size: 12px top + 5px handle + 7px bottom = 24px, the WCAG
// 2.2 SC 2.5.8 minimum. It was 23px — one pixel under — which is exactly the kind
// of value that drifts back.
test("the close handle stays reachable and meets the 24px target", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("./");
  await page.getByTestId("header-about").click();

  const handle = page.getByRole("button", { name: "Luk" });
  const popup = page.getByTestId("about-drawer");
  await expect(handle).toBeVisible();

  const box = await handle.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(24);

  // Scroll the panel to the CTA and confirm the handle came along.
  await popup.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(page.getByRole("link", { name: "Giv til kaffekassen" })).toBeVisible();

  const after = await handle.boundingBox();
  expect(after!.y).toBeGreaterThanOrEqual(0);
  await expect(handle).toBeInViewport();
});
