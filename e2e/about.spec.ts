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
