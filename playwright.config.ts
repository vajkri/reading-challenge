import { defineConfig, devices } from "@playwright/test";

// Tests run against the real static export (./out) served under the basePath,
// so they catch the same asset-resolution issues GitHub Pages would. Build first
// (`npm run build`), then `npm run test:e2e`.
const PORT = 4399;
const BASE = "/reading-challenge";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}${BASE}/`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 440, height: 940 } },
    },
  ],
  webServer: {
    command: `node scripts/serve-out.mjs ${PORT}`,
    url: `http://localhost:${PORT}${BASE}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
