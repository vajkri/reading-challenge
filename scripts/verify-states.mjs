// Seed localStorage for each app state, screenshot it. Local verification helper.
// Usage: node scripts/verify-states.mjs <outDir> [baseUrl]
import { chromium } from "@playwright/test";

const OUT = process.argv[2];
const BASE = process.argv[3] || "http://localhost:3000/reading-challenge/";
if (!OUT) {
  console.error("usage: node scripts/verify-states.mjs <outDir> [baseUrl]");
  process.exit(1);
}

const K = "sommerlaesning.v1.";
const iso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};
const E = (id, title, author, minutes, dayOff, created) => ({
  id,
  title,
  author,
  date: iso(dayOff),
  minutes,
  created,
});

const logEntries = [
  E("a", "Vitello", "Kim Fupz Aakeson", 35, -1, 5),
  E("b", "Mumitroldene", "Tove Jansson", 20, -2, 4),
  E("c", "Vitello", "Kim Fupz Aakeson", 25, -3, 3),
  E("d", "Cirkeline", "", 15, -4, 2),
];

const scenarios = [
  { name: "01-none", seed: {} },
  {
    name: "02-ongoing-50",
    seed: {
      goal: "1000",
      challenge: "ongoing",
      name: "Max",
      deadline: iso(20),
      entries: [E("a", "Vitello", "Kim Fupz Aakeson", 500, -2, 1)],
    },
  },
  {
    name: "03-ongoing-90-dog",
    seed: {
      goal: "1000",
      challenge: "ongoing",
      name: "Luna",
      mascot: "dog",
      deadline: iso(1),
      entries: [E("a", "Harry Potter", "J.K. Rowling", 920, -1, 1)],
    },
  },
  {
    name: "04-completed",
    seed: {
      goal: "600",
      challenge: "completed",
      name: "Max",
      entries: [
        E("a", "Vitello", "Kim Fupz Aakeson", 400, -3, 1),
        E("b", "Cirkeline", "Hanne Hastrup", 250, -1, 2),
      ],
    },
  },
  { name: "05-log", tab: "Læselog", seed: { goal: "1000", challenge: "ongoing", entries: logEntries } },
  {
    name: "06-log-add",
    tab: "Læselog",
    seed: { goal: "1000", challenge: "ongoing", entries: logEntries },
    click: "Tilføj læsning",
  },
  { name: "07-settings-none", tab: "Indstillinger", seed: {} },
  {
    name: "08-settings-locked",
    tab: "Indstillinger",
    seed: { goal: "1000", challenge: "ongoing", locked: "1", name: "Max", entries: [E("a", "Bog", "", 300, -1, 1)] },
  },
  {
    name: "09-unlock-modal",
    tab: "Indstillinger",
    seed: { goal: "1000", challenge: "ongoing", locked: "1", entries: [E("a", "Bog", "", 300, -1, 1)] },
    click: "Lås op",
  },
];

const browser = await chromium.launch();
let failures = 0;
for (const sc of scenarios) {
  const ctx = await browser.newContext({ viewport: { width: 440, height: 940 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(
    ([prefix, seed]) => {
      for (const [k, v] of Object.entries(seed)) {
        localStorage.setItem(prefix + k, typeof v === "string" ? v : JSON.stringify(v));
      }
    },
    [K, sc.seed],
  );
  const res = await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(400);
  if (sc.tab) {
    await page.getByRole("button", { name: sc.tab }).first().click();
    await page.waitForTimeout(300);
  }
  if (sc.click) {
    await page.getByRole("button", { name: sc.click }).first().click();
    await page.waitForTimeout(300);
  }
  const out = `${OUT}/${sc.name}.png`;
  await page.screenshot({ path: out, fullPage: true });
  console.log(`${res?.status()} ${sc.name} -> ${out}`);
  if ((res?.status() ?? 0) >= 400) failures++;
  await ctx.close();
}
await browser.close();
process.exit(failures > 0 ? 1 : 0);
