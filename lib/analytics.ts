// Thin GA4 event seam. `window.gtag` is injected ONLY on the prod host by
// components/Analytics.tsx, so every call here is a no-op on dev / e2e / LAN —
// no extra host check needed, and the e2e "gtag undefined on localhost" guard
// keeps protecting it.

type EventName =
  | "challenge_started"
  | "reading_logged"
  | "challenge_completed"
  | "nav_screen"
  | "bingo_feat_completed";

type EventParams = Record<string, string | number>;

declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void;
  }
}

export function track(name: EventName, params?: EventParams): void {
  if (typeof window === "undefined") return; // SSR-safe
  window.gtag?.("event", name, params);
}
