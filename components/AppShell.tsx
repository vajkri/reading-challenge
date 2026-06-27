"use client";

// The app frame: fixed-width mobile column with a header, the active screen,
// the bottom nav, and a celebratory confetti overlay. Screens are switched by
// state.screen (no routing), matching the prototype.

import { useApp } from "@/lib/store";
import { copy } from "@/lib/copy";
import BottomNav from "@/components/BottomNav";
import ProgressScreen from "@/components/ProgressScreen";
import LogScreen from "@/components/LogScreen";
import SettingsScreen from "@/components/SettingsScreen";

const CONFETTI_COLORS = ["#F6A623", "#7FC8A9", "#F39A8B", "#BBA7E0", "#FFCE52"];

// Deterministic confetti pieces (no Math.random → pure render). Scattered via
// index arithmetic so the burst still looks irregular.
const PIECES = Array.from({ length: 16 }, (_, i) => ({
  left: ((i * 61 + 7) % 96) + "%",
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 7 + (i % 4) * 2,
  delay: ((i % 5) * 0.12).toFixed(2) + "s",
  dur: (1.2 + (i % 3) * 0.2).toFixed(2) + "s",
  round: i % 2 === 0,
}));

/**
 * Falling-confetti burst. CSS-only: the pieces mount when `active` flips true
 * (i.e. when the mascot reaches a celebratory stage, joy >= 6) and play the
 * mons-fall animation twice, then rest invisible — no JS timers or state.
 */
function ConfettiOverlay({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {PIECES.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: -14,
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.round ? "50%" : "2px",
            animation: `mons-fall ${p.dur} linear ${p.delay} 2 both`,
          }}
        />
      ))}
    </div>
  );
}

export default function AppShell() {
  const { state, derived } = useApp();

  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-app">
      <header className="flex items-center gap-2 px-5 py-4">
        <span
          aria-hidden
          className="grid h-9 w-9 place-items-center rounded-xl"
          style={{ background: "#FFF1DD" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="5" width="8.2" height="14" rx="1.6" fill="#7FC8A9" />
            <rect
              x="12.8"
              y="5"
              width="8.2"
              height="14"
              rx="1.6"
              fill="#F2705A"
              transform="rotate(6 16.9 12)"
            />
          </svg>
        </span>
        <h1
          className="text-[1.25rem] font-extrabold text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {copy.app.name}
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto px-5 pb-6">
        {state.screen === "progress" && <ProgressScreen />}
        {state.screen === "log" && <LogScreen />}
        {state.screen === "settings" && <SettingsScreen />}
      </main>

      <BottomNav />
      <ConfettiOverlay active={derived.showConfetti} />
    </div>
  );
}
