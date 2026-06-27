// Tiny screenshot helper for local verification.
// Usage: node scripts/shot.mjs <url> <outPath> [width] [height] [fullPage]
import { chromium } from "@playwright/test";

const [url, out, w = "900", h = "1400", full = "true"] = process.argv.slice(2);
if (!url || !out) {
  console.error("usage: node scripts/shot.mjs <url> <outPath> [width] [height] [fullPage]");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
const res = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(600); // let fonts settle
await page.screenshot({ path: out, fullPage: full === "true" });
console.log("status", res?.status(), "->", out);
await browser.close();
