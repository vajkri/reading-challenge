"use client";

// Bottom tab bar: Fremgang / Læselog / Indstillinger / Bingo. Active tab is amber
// accent, inactive is muted. State-driven (no routing) to match the prototype.

import type { ReactNode } from "react";
import { useApp } from "@/lib/store";
import { copy } from "@/lib/copy";

function Tab({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
      style={{ color: active ? "var(--color-accent)" : "var(--color-nav-inactive)" }}
    >
      {children}
      <span style={{ fontFamily: "var(--font-display)" }}>{label}</span>
    </button>
  );
}

const iconProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export default function BottomNav() {
  const { state, actions } = useApp();
  const s = state.screen;

  return (
    <nav
      className="sticky bottom-0 z-20 flex bg-white"
      style={{ borderTop: "1.5px solid #F2E6D2", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <Tab active={s === "progress"} label={copy.nav.progress} onClick={actions.goProgress}>
        <svg {...iconProps} strokeWidth={2.4}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 12 L12 7" />
          <path d="M12 12 L16 14" />
        </svg>
      </Tab>
      <Tab active={s === "log"} label={copy.nav.log} onClick={actions.goLog}>
        <svg {...iconProps}>
          <path d="M5 5.5 C5 4.7 5.7 4 6.5 4 H18 C18.5 4 19 4.5 19 5 V19 C19 19.5 18.5 20 18 20 H6.5 C5.7 20 5 19.3 5 18.5 Z" />
          <path d="M9 8.5 H15 M9 12 H14" />
        </svg>
      </Tab>
      <Tab active={s === "settings"} label={copy.nav.settings} onClick={actions.goSettings}>
        <svg {...iconProps}>
          <path d="M5 8 H19 M5 16 H19" />
          <circle cx="9" cy="8" r="2.6" fill="none" />
          <circle cx="15" cy="16" r="2.6" fill="none" />
        </svg>
      </Tab>
      <Tab active={s === "bingo"} label={copy.bingo.nav} onClick={actions.goBingo}>
        <svg {...iconProps} strokeWidth={2}>
          <rect x="4" y="4" width="16" height="16" rx="2.5" />
          <path d="M9.3 4 V20 M14.7 4 V20 M4 9.3 H20 M4 14.7 H20" />
        </svg>
      </Tab>
    </nav>
  );
}
