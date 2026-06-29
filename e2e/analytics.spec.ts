import { test, expect } from "@playwright/test";

// The e2e build is served on localhost:4399 — the same static export Pages
// ships. GA4 is hostname-gated OFF there, so loading the app must NOT request
// gtag.js and must NOT define window.gtag.
test("GA4 does not load on the localhost (e2e) host", async ({ page }) => {
  const gtagRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("googletagmanager.com")) gtagRequests.push(req.url());
  });

  await page.goto("./");
  await expect(page.getByText("Klar til en udfordring?")).toBeVisible();
  // Give afterInteractive scripts a tick to have fired if the gate were broken.
  await page.waitForTimeout(500);

  expect(gtagRequests).toEqual([]);
  expect(await page.evaluate(() => typeof (window as unknown as { gtag?: unknown }).gtag)).toBe(
    "undefined",
  );
});
