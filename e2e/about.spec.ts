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
    page.getByText("Jeg lavede Læsemakker i min fritid", { exact: false }),
  ).toBeVisible();

  const cta = page.getByRole("link", { name: "Køb mig en kaffe" });
  await expect(cta).toHaveAttribute("href", SUPPORT_URL);
  await expect(cta).toHaveAttribute("target", "_blank");
  // Exact, not /noopener/: this is the app's only external link, and a regex on
  // the first token stays green if `noreferrer` is ever dropped.
  await expect(cta).toHaveAttribute("rel", "noopener noreferrer");
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

// Testid, not name: copy.settings.about and copy.about.navAria are both "Om appen",
// so a name-based selector would match the header ⓘ button too (strict-mode violation).
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

  const cta = page.getByRole("link", { name: "Køb mig en kaffe" });
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
