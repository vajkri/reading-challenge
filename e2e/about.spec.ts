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

  // Assert the Log screen actually rendered *before* asserting About is gone —
  // a bare toHaveCount(0) would also pass if <main> rendered nothing at all.
  await page.getByRole("button", { name: "Læselog" }).click();
  await expect(page.getByRole("heading", { name: "Læselog" })).toBeVisible();
  await expect(page.getByTestId("about-screen")).toHaveCount(0);
});

test("back arrow returns to Fremgang", async ({ page }) => {
  await page.goto("./");
  await page.getByTestId("header-about").click();
  await page.getByRole("button", { name: "Tilbage" }).click();
  await expect(page.locator('[data-screen-label="Fremgang"]')).toBeVisible();
});

// Testid, not name: copy.settings.about and copy.about.navAria are both "Om appen",
// so a name-based selector would match the header ⓘ button too (strict-mode violation).
test("Settings 'Om appen' row opens the About page", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Indstillinger" }).click();

  await page.getByTestId("settings-about").click();
  await expect(page.getByRole("heading", { name: "Om Læseudfordring" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Om Læseudfordring" })).toBeVisible();
});
