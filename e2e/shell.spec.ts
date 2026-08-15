import { test, expect } from "@playwright/test";

// App-shell level coverage: the frame that wraps every screen — branding,
// document metadata, and the PWA manifest. Screen behaviour lives in app.spec.ts.

test("header, document title, and manifest all carry the Læsemakker brand", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Læsemakker" })).toBeVisible();
  await expect(page).toHaveTitle("Læsemakker");

  const manifest = await (await page.request.get("manifest.webmanifest")).json();
  expect(manifest.name).toBe("Læsemakker");
  expect(manifest.short_name).toBe("Læsemakker");
});

test("app is served from the root path, not a project subpath", async ({ page }) => {
  await page.goto("./");
  expect(new URL(page.url()).pathname).toBe("/");

  const manifest = await page.evaluate(async () => {
    const res = await fetch("/manifest.webmanifest");
    return res.json() as Promise<{ start_url: string; scope: string }>;
  });
  expect(manifest.start_url).toBe("/");
  expect(manifest.scope).toBe("/");
});
