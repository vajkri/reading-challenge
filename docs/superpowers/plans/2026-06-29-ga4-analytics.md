# GA4 Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load Google Analytics 4 (`G-TKWB5RGY4V`) on the deployed PWA for pageview tracking, while never firing on local dev or the Playwright e2e build.

**Architecture:** An `<Analytics />` component renders a single `next/script` (`afterInteractive`) whose inline bootstrap self-injects gtag.js — but only after a runtime allowlist check (fire only when `location.hostname === PAGES_HOST`; any other host → early return). Putting the gate inside the script (rather than in React state) keeps the rendered markup byte-identical at build and runtime, so there is no hydration mismatch and no `react-hooks/set-state-in-effect` lint violation, while every non-prod host makes zero gtag.js requests. Mounted once from `app/layout.tsx` next to `<ServiceWorkerRegister />`.

**Tech Stack:** Next.js 16 static export, `next/script`, React 19, Playwright (e2e).

**Decisions locked in (from brainstorming):** Direct load, no consent banner, pageviews only, no new dependencies, no `next.config.ts` changes (basePath/SW untouched). Hostname gate is kept (excludes dev + CI).

---

### Task 1: Create the gated `<Analytics />` component

**Files:**
- Create: `components/Analytics.tsx`

- [ ] **Step 1: Write the component**

```tsx
import Script from "next/script";

const GA_ID = "G-TKWB5RGY4V";

// The deployed GitHub Pages host. GA4 fires ONLY here.
const PAGES_HOST = "vajkri.github.io";

// GA4 must fire only on the deployed GitHub Pages site — never on local dev,
// the Playwright e2e build (localhost:4399), or on-device PWA testing over the
// LAN ([::1] / 0.0.0.0 / 192.168.x.x). This is an *allowlist*, not a denylist:
// any unknown host defaults to OFF, so we can't leak page_views from a host we
// forgot to exclude. (If the site moves to a custom domain, update PAGES_HOST.)
// The gate lives inside the bootstrap script so the rendered markup is
// byte-identical everywhere (no hydration mismatch) and non-prod hosts make no
// gtag.js request at all.
export default function Analytics() {
  return (
    <Script id="ga4-init" strategy="afterInteractive">
      {`(function(){
  if (location.hostname !== '${PAGES_HOST}') return;
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = gtag;
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=${GA_ID}';
  document.head.appendChild(s);
  gtag('js', new Date());
  gtag('config', '${GA_ID}');
})();`}
    </Script>
  );
}
```

> **Deviation note:** the originally planned `useState`/`useEffect` gate tripped Next 16's `react-hooks/set-state-in-effect` lint rule. Moving the gate into the inline bootstrap is behaviourally equivalent (no GA on localhost, GA on real host), removes the lint issue, and eliminates the hydration concern.

- [ ] **Step 2: Typecheck + lint the new file**

Run: `npx tsc --noEmit && npx eslint components/Analytics.tsx`
Expected: clean (no errors).

- [ ] **Step 3: Commit**

```bash
git add components/Analytics.tsx
git commit -m "feat(analytics): add hostname-gated GA4 component"
```

---

### Task 2: Mount `<Analytics />` from the root layout

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Import the component**

Add next to the existing `ServiceWorkerRegister` import at the top of `app/layout.tsx`:

```tsx
import Analytics from "@/components/Analytics";
```

- [ ] **Step 2: Render it in `<body>`**

In the returned JSX, change the `<body>` contents from:

```tsx
      <body className="min-h-full">
        {children}
        <ServiceWorkerRegister />
      </body>
```

to:

```tsx
      <body className="min-h-full">
        {children}
        <ServiceWorkerRegister />
        <Analytics />
      </body>
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint .`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(analytics): mount GA4 from root layout"
```

---

### Task 3: e2e guard — GA stays OFF on localhost

This test pins the critical invariant: the e2e/dev host must never load gtag.js. It guards against anyone removing the hostname gate later (which would silently pollute analytics on every CI run).

**Files:**
- Create: `e2e/analytics.spec.ts`

- [ ] **Step 1: Write the test**

```tsx
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
```

- [ ] **Step 2: Build so e2e runs against the new export**

Run: `npm run build`
Expected: static export to `./out` + postbuild SW injection, no errors.

- [ ] **Step 3: Run the new test**

Run: `npx playwright test -g "GA4 does not load"`
Expected: PASS (no gtag request, `window.gtag` undefined).

- [ ] **Step 4: Commit**

```bash
git add e2e/analytics.spec.ts
git commit -m "test(analytics): guard that GA4 stays off on localhost"
```

---

### Task 4: Full verification gates

**Files:** none (verification only)

- [ ] **Step 1: Run the project's full gate set**

Run: `npx tsc --noEmit && npx eslint . && npm run build && npm run test:e2e`
Expected: tsc clean, eslint clean, build succeeds, **entire** Playwright suite green (existing tests + the new GA guard).

- [ ] **Step 2: Confirm GA wiring is present in the export**

Run: `grep -rl "G-TKWB5RGY4V" out/ | head`
Expected: the measurement ID appears in the exported HTML/JS (proof the code shipped; it stays inert on localhost via the gate). If GA were stripped entirely this would be empty.

> **Note — what is NOT auto-tested:** that GA *does* fire on the real Pages host. The hostname gate can't be exercised by the localhost e2e server. Verify manually post-deploy: open the deployed site, confirm a request to `googletagmanager.com/gtag/js?id=G-TKWB5RGY4V` in the Network tab and a `page_view` in GA4 Realtime.

---

## Self-Review

- **Spec coverage:** direct load ✓ (Task 1 fires gtag on the prod host), pageviews only ✓ (only `gtag('config', ...)`, no custom events), no consent banner ✓, no new deps ✓ (`next/script` only), no config changes ✓, hostname gate present ✓ (Task 1 + guarded by Task 3).
- **Placeholder scan:** none — all code blocks complete.
- **Type consistency:** `GA_ID` / `PAGES_HOST` used consistently; component default-exported and imported as `Analytics` in Task 2.
- **Ambiguity:** gate is an explicit allowlist of the Pages host (`location.hostname !== PAGES_HOST` → off), so unknown hosts default to off.

> **Post-review update (PR #29):** the gate was changed from a denylist (`localhost`/`127.0.0.1`) to an allowlist of the Pages host (`vajkri.github.io`), so on-device PWA testing over LAN IP / `[::1]` / `0.0.0.0` can't leak page_views to production.
