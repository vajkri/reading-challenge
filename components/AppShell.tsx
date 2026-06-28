"use client";

// The app frame: fixed-width mobile column with a header, the active screen,
// and the bottom nav. Screens are switched by state.screen (no routing),
// matching the prototype. (Celebratory confetti lives inside ProgressScreen.)

import { useApp } from "@/lib/store";
import { copy } from "@/lib/copy";
import BottomNav from "@/components/BottomNav";
import ProgressScreen from "@/components/ProgressScreen";
import LogScreen from "@/components/LogScreen";
import SettingsScreen from "@/components/SettingsScreen";
import NewChallengeModal from "@/components/NewChallengeModal";
import BingoScreen from "@/components/BingoScreen";

export default function AppShell() {
  const { state } = useApp();

  return (
    <div className="relative mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-app">
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
      <BottomNav />
    </div>
  );
}
