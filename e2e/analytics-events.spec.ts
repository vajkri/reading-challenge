import { test, expect, type BrowserContext } from "@playwright/test";

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

/** Stub gtag before load so track() fires on localhost; capture every call. */
async function stubGtag(context: BrowserContext) {
  await context.addInitScript(() => {
    const w = window as unknown as { __gaEvents: unknown[][]; gtag: (...a: unknown[]) => void };
    w.__gaEvents = [];
    w.gtag = (...args: unknown[]) => {
      w.__gaEvents.push(args);
    };
  });
}

const readEvents = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as unknown as { __gaEvents: unknown[][] }).__gaEvents);

test("logging a reading fires nav_screen + reading_logged", async ({ page, context }) => {
  await stubGtag(context);
  await seed(context, {
    goal: "1000",
    challenge: "ongoing",
    name: "Max",
    deadline: iso(20),
    entries: [],
  });

  await page.goto("./");
  await page.getByRole("button", { name: "Læselog" }).click(); // nav_screen { screen: "log" }
  await page.getByRole("button", { name: /Tilføj læsning/ }).click();
  await page.getByPlaceholder("fx Vitello").fill("Palle alene i verden");
  await page.getByPlaceholder("15").fill("25");
  await page.getByRole("button", { name: "Gem læsning" }).click();

  const events = await readEvents(page);
  const nav = events.find((e) => e[1] === "nav_screen");
  expect((nav?.[2] as { screen: string }).screen).toBe("log");

  const reading = events.find((e) => e[1] === "reading_logged");
  expect(reading).toBeTruthy();
  expect((reading?.[2] as { minutes: number }).minutes).toBe(25);
});

test("reaching the goal fires challenge_completed", async ({ page, context }) => {
  await stubGtag(context);
  await seed(context, {
    goal: "20", // tiny goal so one entry completes it
    challenge: "ongoing",
    name: "Max",
    deadline: iso(20),
    entries: [],
  });

  await page.goto("./");
  await page.getByRole("button", { name: "Læselog" }).click();
  await page.getByRole("button", { name: /Tilføj læsning/ }).click();
  await page.getByPlaceholder("fx Vitello").fill("Sluttest");
  await page.getByPlaceholder("15").fill("25"); // 25 >= goal 20 → auto-complete
  await page.getByRole("button", { name: "Gem læsning" }).click();

  const events = await readEvents(page);
  const names = events.map((e) => e[1]);
  expect(names).toContain("reading_logged");
  expect(names).toContain("challenge_completed");
});
