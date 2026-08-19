"use client";

// The app frame: fixed-width mobile column with a header, the active screen,
// and the bottom nav. Screens are switched by state.screen (no routing),
// matching the prototype. (Celebratory confetti lives inside ProgressScreen.)

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useApp } from "@/lib/store";
import { copy } from "@/lib/copy";
import BottomNav from "@/components/BottomNav";
import ProgressScreen from "@/components/ProgressScreen";
import LogScreen from "@/components/LogScreen";
import SettingsScreen from "@/components/SettingsScreen";
import NewChallengeModal from "@/components/NewChallengeModal";
import BingoScreen from "@/components/BingoScreen";

// The About drawer drags in Base UI — real weight (~35 KB gzipped) for an
// overlay most sessions never open, so it is code-split out of the first load:
// index.html no longer references that chunk and startup never parses it.
//
// Both options below are load-bearing, and neither is about performance:
//  - `loading` gives the lazy import its own Suspense boundary. Without one the
//    suspension propagates to the root, so tapping "Om" while the chunk is still
//    in flight freezes the ENTIRE app at its last committed state (measured) and
//    drops the tap if the user navigates during the freeze.
//  - `.catch` is the missing error boundary. An uncaught chunk-load rejection
//    unmounts the React root — a failed fetch of this one optional chunk blanked
//    the whole app (measured), with no user interaction needed, because the idle
//    callback below requests the chunk on every page load. Degrading to a no-op
//    drawer is the right trade: the reading log matters, the coffee ask does not.
const AboutDrawer = dynamic(
  () => import("@/components/AboutDrawer").catch(() => ({ default: () => null })),
  { loading: () => null },
);

export default function AppShell() {
  const { state, actions } = useApp();

  // …and mounted once the app has gone idle, never unmounted. Both halves are
  // load-bearing:
  //  - Mounting on idle rather than on the tap keeps *both* drawer transitions.
  //    Base UI skips the enter animation for a popup that is already open when
  //    it mounts, so gating on state.aboutOpen made the panel pop in on the
  //    first open (measured) instead of sliding up. Deferring further would
  //    also save nothing: public/sw.js precaches every asset on install, so the
  //    chunk is downloaded regardless — the win here is startup parse, not bytes.
  //  - Never unmounting is what lets the exit transition play out on close.
  // This is a render optimisation, not app state — hence local useState rather
  // than the store. state.aboutOpen is an escape hatch for a tap that somehow
  // beats the idle callback.
  const [aboutMounted, setAboutMounted] = useState(false);
  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setAboutMounted(true), { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setAboutMounted(true), 1200); // Safari < 17.4
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      data-testid="app-shell"
      className="relative mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-app md:max-w-[1280px]"
    >
      <header
        className="flex items-center gap-2 px-5 py-4"
        style={{ borderBottom: "1.5px solid #F2E6D2" }}
      >
        <svg width="34" height="34" viewBox="0 0 100 100" aria-hidden>
          <rect x="2" y="2" width="96" height="96" rx="24" fill="#FFF1DD" />
          <rect x="26" y="32" width="48" height="15" rx="4.5" fill="#F6A623" />
          <rect x="33" y="32" width="5" height="15" fill="#FFFBF2" opacity=".55" />
          <rect x="26" y="49" width="48" height="15" rx="4.5" fill="#7FC8A9" />
          <rect x="33" y="49" width="5" height="15" fill="#FFFBF2" opacity=".55" />
          <g transform="rotate(-4 50 73)">
            <rect x="28" y="66" width="48" height="15" rx="4.5" fill="#F2705A" />
            <rect x="35" y="66" width="5" height="15" fill="#FFFBF2" opacity=".55" />
          </g>
        </svg>
        <h1
          className="text-[1.25rem] font-extrabold text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {copy.app.name}
        </h1>

        {/* Right-hand header cluster. Today it holds only the About pill;
            it is laid out as a flex row because the language pill will sit here
            later (separate issue) — see spec. */}
        <div className="ml-auto flex items-center gap-2">
          {/* ⓘ + visible "Om": the label IS the accessible name, so no aria-label.
              44px tall, which also clears the WCAG 2.5.5 target size the old
              36×36 icon-only button missed. Hover/active live in globals.css
              (.about-trigger) — they can't be inline styles.

              No aria-expanded: the drawer has two triggers sharing one piece of
              state, so binding it here announced "expanded" on this button even
              when the Settings row was what opened it. aria-haspopup="dialog"
              already conveys the behaviour, and a modal dialog does not require
              aria-expanded — there is no correct single value for it. */}
          <button
            type="button"
            data-testid="header-about"
            onClick={actions.openAbout}
            aria-haspopup="dialog"
            className="about-trigger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            {copy.about.trigger}
          </button>
        </div>
      </header>

      {/* Until state is hydrated from localStorage we don't know which screen
          to show, so <main> stays empty rather than flashing the wrong state.
          Hydration is sub-frame in practice (static export + SW precache), so
          the empty→content swap is imperceptible and never shows a "none"
          flicker. Header + nav are state-independent and paint immediately. */}
      <main className="flex-1 overflow-y-auto px-5 pb-6" aria-busy={!state.hydrated}>
        {state.hydrated && (
          <>
            {state.screen === "progress" && <ProgressScreen />}
            {state.screen === "log" && <LogScreen />}
            {state.screen === "settings" && <SettingsScreen />}
            {state.screen === "bingo" && <BingoScreen />}
          </>
        )}
      </main>

      <NewChallengeModal />
      {(aboutMounted || state.aboutOpen) && <AboutDrawer />}
      <BottomNav />
    </div>
  );
}
