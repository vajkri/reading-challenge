"use client";

// Bottom tab bar: Fremgang / Læselog / Indstillinger. Active tab is amber accent,
// inactive is muted. State-driven (no routing) to match the prototype.

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
  width: 26,
  height: 26,
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
      style={{ borderTop: "1px solid #F0E2CC", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <Tab active={s === "progress"} label={copy.nav.progress} onClick={actions.goProgress}>
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="9" opacity="0.3" />
          <path d="M12 3a9 9 0 0 1 8.5 6.1" />
          <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
        </svg>
      </Tab>
      <Tab active={s === "log"} label={copy.nav.log} onClick={actions.goLog}>
        <svg {...iconProps}>
          <path d="M4 5.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-1.8H4z" />
          <path d="M20 5.5h-6a2 2 0 0 0-2 2V20a2 2 0 0 1 2-1.8h6z" />
        </svg>
      </Tab>
      <Tab active={s === "settings"} label={copy.nav.settings} onClick={actions.goSettings}>
        <svg {...iconProps}>
          <line x1="4" y1="8" x2="20" y2="8" />
          <line x1="4" y1="16" x2="20" y2="16" />
          <circle cx="9" cy="8" r="2.6" fill="white" />
          <circle cx="15" cy="16" r="2.6" fill="white" />
        </svg>
      </Tab>
    </nav>
  );
}
