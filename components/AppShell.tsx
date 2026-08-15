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
const AboutDrawer = dynamic(() => import("@/components/AboutDrawer"));

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

        {/* Right-hand header cluster. Today it holds only the About (ⓘ) button;
            it is laid out as a flex row because the language pill will sit here
            later (separate issue) — see spec. */}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            data-testid="header-about"
            onClick={actions.openAbout}
            aria-label={copy.about.navAria}
            aria-haspopup="dialog"
            aria-expanded={state.aboutOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={{ boxShadow: "0 0 0 1.5px #F0DBB4 inset" }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11 V16" />
              <path d="M12 8 H12.01" />
            </svg>
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
