// Minimal offline service worker for Læseudfordring.
//
// Strategy:
//   - navigations (HTML): network-first → fall back to cache, then the app shell
//     (so a new deploy is picked up online, but the app still opens offline)
//   - static assets (_next, icons, manifest): cache-first → network, then cache
//
// BASE is hardcoded to match next.config.ts `basePath`. This file lives in
// public/ and is NOT processed by the bundler, so it cannot read env vars.
const BASE = "/reading-challenge";

// BUILD_ID and PRECACHE_ASSETS are rewritten in the BUILT out/sw.js by the
// postbuild script scripts/inject-sw-assets.mjs. The defaults below keep the
// dev copy (public/sw.js) valid and runnable on their own.
const BUILD_ID = "dev";
const PRECACHE_ASSETS = [];

const CACHE = `laeseudfordring-${BUILD_ID}`;
const APP_SHELL = `${BASE}/`;
const PRECACHE = [APP_SHELL, `${BASE}/manifest.webmanifest`, ...PRECACHE_ASSETS];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  const isNavigation =
    request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    // Network-first for pages.
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match(APP_SHELL))),
    );
    return;
  }

  // Cache-first for static assets.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
