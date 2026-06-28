import { test, expect, type BrowserContext } from "@playwright/test";

// Behavioural end-to-end coverage. Each test seeds localStorage (the 7 keys) to
// reach a starting state, then drives the UI and asserts the prototype behaviour.

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

test("none state shows the start CTA + gloomy mascot copy", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText("Klar til en udfordring?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start en udfordring" })).toBeVisible();
});

test("ongoing challenge renders the ring percentage", async ({ page, context }) => {
  await seed(context, {
    goal: "1000",
    challenge: "ongoing",
    name: "Max",
    deadline: iso(20),
    entries: [{ id: "a", title: "Vitello", author: "Kim Fupz", date: iso(-1), minutes: 500, created: 1 }],
  });
  await page.goto("./");
  await expect(page.getByText("500 / 1000 min")).toBeVisible();
  await expect(page.getByText("20 dage tilbage")).toBeVisible();
  // caption is derived from joy(pct=50)=stage 3, proving the ring data is wired
  await expect(page.getByText("Det går rigtig godt", { exact: false })).toBeVisible();
});

test("reload of a saved ongoing challenge never flickers the none-state (#11)", async ({ page, context }) => {
  await seed(context, {
    goal: "1000",
    challenge: "ongoing",
    name: "Max",
    deadline: iso(20),
    entries: [{ id: "a", title: "Vitello", author: "Kim Fupz", date: iso(-1), minutes: 500, created: 1 }],
  });
  await page.goto("./");
  // <main> stays empty until state is hydrated, so the gloomy none-state heading
  // must never paint — not even for a frame. toHaveCount(0) polls, catching a late flash.
  await expect(page.getByText("Klar til en udfordring?")).toHaveCount(0);
  // ...and the real ongoing content lands in its place.
  await expect(page.getByText("500 / 1000 min")).toBeVisible();
});

test("start a challenge from settings → ongoing + locked banner", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start en udfordring" }).click();
  await page.getByPlaceholder("Max").fill("Bella");
  await page.getByRole("button", { name: "300", exact: true }).click();
  await page.getByRole("button", { name: "Start udfordringen" }).click();
  await expect(page.getByText("0 / 300 min")).toBeVisible();
  await page.getByRole("button", { name: "Indstillinger" }).click();
  await expect(page.getByText("Der er en udfordring i gang")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rediger udfordring" })).toBeVisible();
});

test("none state: Settings pre-fills 450 goal + today+30 deadline defaults", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start en udfordring" }).click();
  await expect(page.getByLabel("Læsemål")).toHaveValue("450");
  await expect(page.getByLabel("Slutdato")).toHaveValue(iso(30));
});

test("editing an ongoing challenge shows its real saved goal + deadline", async ({ page, context }) => {
  await seed(context, { goal: "1000", challenge: "ongoing", name: "Max", deadline: iso(20) });
  await page.goto("./");
  await page.getByRole("button", { name: "Indstillinger" }).click();
  // Unlock via the math gate to reveal the editable form.
  await page.getByRole("button", { name: "Rediger udfordring" }).click();
  const dialog = page.getByRole("dialog");
  const problem = (await dialog.getByText(/\d+\s*\+\s*\d+/).first().textContent()) ?? "";
  const m = problem.match(/(\d+)\s*\+\s*(\d+)/);
  await dialog.getByRole("spinbutton").fill(String(Number(m![1]) + Number(m![2])));
  await dialog.getByRole("button", { name: "Lås op" }).click();
  // Real saved values, not the none-defaults (450 / today+30).
  await expect(page.getByLabel("Læsemål")).toHaveValue("1000");
  await expect(page.getByLabel("Slutdato")).toHaveValue(iso(20));
});

test("add a reading updates the log list and total", async ({ page, context }) => {
  await seed(context, { goal: "1000", challenge: "ongoing", name: "Max" });
  await page.goto("./");
  await page.getByRole("button", { name: "Læselog" }).click();
  await page.getByRole("button", { name: /Tilføj læsning/ }).click();
  await page.getByPlaceholder("fx Vitello").fill("Palle alene i verden");
  await page.getByPlaceholder("15").fill("25");
  await page.getByRole("button", { name: "Gem læsning" }).click();
  await expect(page.getByText("Palle alene i verden")).toBeVisible();
  await expect(page.getByText("25 min i alt")).toBeVisible();
});

test("reaching the goal auto-completes the challenge", async ({ page, context }) => {
  await seed(context, { goal: "30", challenge: "ongoing", name: "Max" });
  await page.goto("./");
  await page.getByRole("button", { name: "Læselog" }).click();
  await page.getByRole("button", { name: /Tilføj læsning/ }).click();
  await page.getByPlaceholder("fx Vitello").fill("Sluttest");
  await page.getByPlaceholder("15").fill("40");
  await page.getByRole("button", { name: "Gem læsning" }).click();
  await expect(page.getByText("Udfordring fuldført")).toBeVisible();
});

test("quick-pick fills title and author", async ({ page, context }) => {
  await seed(context, {
    goal: "1000",
    challenge: "ongoing",
    entries: [{ id: "a", title: "Vitello", author: "Kim Fupz Aakeson", date: iso(-1), minutes: 30, created: 1 }],
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Læselog" }).click();
  await page.getByRole("button", { name: /Tilføj læsning/ }).click();
  await page.getByRole("button", { name: /Vitello/ }).click();
  await expect(page.getByPlaceholder("fx Vitello")).toHaveValue("Vitello");
  await expect(page.getByPlaceholder("fx Kim Fupz Aakeson")).toHaveValue("Kim Fupz Aakeson");
});

test("mascot only persists after editing + updating a running challenge", async ({ page, context }) => {
  await seed(context, { goal: "1000", challenge: "ongoing" });
  await page.goto("./");
  await page.getByRole("button", { name: "Indstillinger" }).click();

  // Locked by default — unlock via the math gate.
  await page.getByRole("button", { name: "Rediger udfordring" }).click();
  const dialog = page.getByRole("dialog");
  const problem = (await dialog.getByText(/\d+\s*\+\s*\d+/).first().textContent()) ?? "";
  const m = problem.match(/(\d+)\s*\+\s*(\d+)/);
  await dialog.getByRole("spinbutton").fill(String(Number(m![1]) + Number(m![2])));
  await dialog.getByRole("button", { name: "Lås op" }).click();

  // Pick the dog (draft only — no toast) then commit with Opdater udfordring.
  await page.getByRole("button", { name: "Hund" }).click();
  await page.getByRole("button", { name: "Opdater udfordring" }).click();

  const mascot = await page.evaluate(() => localStorage.getItem("sommerlaesning.v1.mascot"));
  expect(mascot).toBe("dog");
  // Re-locked after update: the edit banner is back.
  await expect(page.getByText("Der er en udfordring i gang")).toBeVisible();
});

test("edit gate: wrong answer errors, correct answer opens the edit session", async ({ page, context }) => {
  await seed(context, { goal: "1000", challenge: "ongoing" });
  await page.goto("./");
  await page.getByRole("button", { name: "Indstillinger" }).click();
  await expect(page.getByText("Der er en udfordring i gang")).toBeVisible();
  await page.getByRole("button", { name: "Rediger udfordring" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("spinbutton").fill("999");
  await dialog.getByRole("button", { name: "Lås op" }).click();
  await expect(dialog.getByText("Prøv igen!")).toBeVisible();

  // Solve the (regenerated) sum shown in the modal.
  const problem = (await dialog.getByText(/\d+\s*\+\s*\d+/).first().textContent()) ?? "";
  const m = problem.match(/(\d+)\s*\+\s*(\d+)/);
  expect(m).not.toBeNull();
  await dialog.getByRole("spinbutton").fill(String(Number(m![1]) + Number(m![2])));
  await dialog.getByRole("button", { name: "Lås op" }).click();

  // Unlocked → the edit-session commit button is the Update button.
  await expect(page.getByRole("button", { name: "Opdater udfordring" })).toBeVisible();
});

test("none setup: no per-field save buttons, single start button, no mascot toast", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Start en udfordring" }).click();
  await page.getByRole("button", { name: "Hund" }).click();
  await expect(page.getByText("Maskot valgt", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Gem", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start udfordringen" })).toBeVisible();
});

test("completed → start new → confirm wipes the log and opens setup", async ({ page, context }) => {
  await seed(context, {
    goal: "30",
    challenge: "completed",
    name: "Max",
    entries: [{ id: "a", title: "Vitello", author: "Kim Fupz", date: iso(-1), minutes: 40, created: 1 }],
  });
  await page.goto("./");
  await expect(page.getByText("Udfordring fuldført")).toBeVisible(); // front-page badge
  await page.getByRole("button", { name: "Indstillinger" }).click();
  await expect(page.getByText("Udfordring fuldført!")).toBeVisible(); // settings banner

  await page.getByRole("button", { name: "Start en ny udfordring" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Dette sletter alle dine læsninger", { exact: false })).toBeVisible();
  await dialog.getByRole("button", { name: "Ja, start forfra" }).click();

  // Now in none setup: single start button + defaults restored.
  await expect(page.getByRole("button", { name: "Start udfordringen" })).toBeVisible();
  await expect(page.getByLabel("Læsemål")).toHaveValue("450");
  const entries = await page.evaluate(() => localStorage.getItem("sommerlaesning.v1.entries"));
  expect(entries).toBe("[]");
});

test("completed → start new → cancel keeps entries", async ({ page, context }) => {
  await seed(context, {
    goal: "30",
    challenge: "completed",
    entries: [{ id: "a", title: "Vitello", author: "", date: iso(-1), minutes: 40, created: 1 }],
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Indstillinger" }).click();
  await page.getByRole("button", { name: "Start en ny udfordring" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Fortryd" }).click();
  await expect(page.getByText("Udfordring fuldført!")).toBeVisible();
  const entries = await page.evaluate(() => localStorage.getItem("sommerlaesning.v1.entries"));
  expect(entries).not.toBe("[]");
});

test("edit session re-locks when leaving settings", async ({ page, context }) => {
  await seed(context, { goal: "1000", challenge: "ongoing" });
  await page.goto("./");
  await page.getByRole("button", { name: "Indstillinger" }).click();
  await page.getByRole("button", { name: "Rediger udfordring" }).click();
  const dialog = page.getByRole("dialog");
  const problem = (await dialog.getByText(/\d+\s*\+\s*\d+/).first().textContent()) ?? "";
  const m = problem.match(/(\d+)\s*\+\s*(\d+)/);
  await dialog.getByRole("spinbutton").fill(String(Number(m![1]) + Number(m![2])));
  await dialog.getByRole("button", { name: "Lås op" }).click();
  await expect(page.getByRole("button", { name: "Opdater udfordring" })).toBeVisible();

  // Leave and return — should be locked again.
  await page.getByRole("button", { name: "Fremgang" }).click();
  await page.getByRole("button", { name: "Indstillinger" }).click();
  await expect(page.getByText("Der er en udfordring i gang")).toBeVisible();
  await expect(page.getByRole("button", { name: "Opdater udfordring" })).toHaveCount(0);
});

test("state persists across reload (hydration)", async ({ page }) => {
  await page.goto("./");
  await page.waitForTimeout(600); // let first-load default persistence settle before overwriting
  await page.evaluate(() => {
    localStorage.setItem("sommerlaesning.v1.challenge", "ongoing");
    localStorage.setItem("sommerlaesning.v1.goal", "1000");
    localStorage.setItem(
      "sommerlaesning.v1.entries",
      JSON.stringify([{ id: "x", title: "Vedholdende Bog", author: "", date: "2026-06-01", minutes: 50, created: 1 }]),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "Læselog" }).click();
  await expect(page.getByText("Vedholdende Bog")).toBeVisible();
});

// --- Bingo (seasonal board) ---------------------------------------------

// A date inside the Sommer '26 window (1 Jun–31 Aug 2026) and one outside it.
const IN_SEASON = new Date("2026-07-01T10:00:00");
const OFF_SEASON = new Date("2026-12-01T10:00:00");

test("bingo: in-season shows the 3x5 board and feat titles", async ({ page }) => {
  await page.clock.install({ time: IN_SEASON });
  await page.goto("./");
  await page.getByRole("button", { name: "Bingo" }).click();
  await expect(page.getByText("Læsebingo")).toBeVisible();
  await expect(page.getByText("Sommer '26", { exact: false })).toBeVisible();
  // 15 feat tiles (buttons are aria-labelled by full title).
  await expect(page.getByRole("button", { name: "Læs i naturen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Læs på stranden" })).toBeVisible();
});

test("bingo: tapping a tile opens the modal and marks it done", async ({ page }) => {
  await page.clock.install({ time: IN_SEASON });
  await page.goto("./");
  await page.getByRole("button", { name: "Bingo" }).click();

  const tile = page.getByRole("button", { name: "Læs i naturen" });
  await expect(tile).toHaveAttribute("data-done", "false");
  await tile.click();

  // Modal shows the description + the mark-done action.
  await expect(page.getByText("Find et træ eller en bænk udenfor og læs der.")).toBeVisible();
  await page.getByRole("button", { name: "Marker som færdig" }).click();

  // Modal stays open; tile is now done and the sheet offers Undo.
  await expect(tile).toHaveAttribute("data-done", "true");
  await expect(page.getByRole("button", { name: "Fortryd" })).toBeVisible();
});

test("bingo: a saved completed feat reloads from storage", async ({ page, context }) => {
  await page.clock.install({ time: IN_SEASON });
  await seed(context, { bingo: { "sommer-26": ["natur"] } });
  await page.goto("./");
  await page.getByRole("button", { name: "Bingo" }).click();
  await expect(page.getByRole("button", { name: "Læs i naturen" })).toHaveAttribute(
    "data-done",
    "true",
  );
});

test("bingo: completing a full row triggers row confetti", async ({ page }) => {
  await page.clock.install({ time: IN_SEASON });
  await page.goto("./");
  await page.getByRole("button", { name: "Bingo" }).click();

  for (const name of ["Læs med en ven", "Læs i naturen", "Læs på ferie"]) {
    await page.getByRole("button", { name }).click();
    await page.getByRole("button", { name: "Marker som færdig" }).click();
    // Modal stays open after marking done — close it before clicking the next tile.
    await page.getByRole("button", { name: "Luk" }).click();
  }
  // The burst mounts on the toggle that completed the top row.
  await expect(page.getByTestId("bingo-confetti")).toBeVisible();
});

test("bingo: off-season shows the teaser, not the board", async ({ page }) => {
  await page.clock.install({ time: OFF_SEASON });
  await page.goto("./");
  await page.getByRole("button", { name: "Bingo" }).click();
  await expect(page.getByText("Næste sæson kommer snart", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Læs i naturen" })).toHaveCount(0);
});
