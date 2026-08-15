"use client";

// Om Læsemakker (About) screen. Reached from the header ⓘ button and the
// Settings "Om appen" row — NOT a bottom-nav tab (see spec IA). Returns only the
// screen's inner scrollable content; the app header + bottom nav come from
// <AppShell/>. No persisted state. All user-facing text comes from copy.

import type { CSSProperties } from "react";
import { useApp } from "@/lib/store";
import { copy } from "@/lib/copy";
import { track } from "@/lib/analytics";
import { SUPPORT_URL } from "@/lib/links";
import MascotFace from "@/components/MascotFace";

const CARD: CSSProperties = {
  background: "#fff",
  borderRadius: 20,
  padding: 18,
  boxShadow: "0 6px 16px rgba(80,55,25,.08)",
};

export default function AboutScreen() {
  const { state, actions } = useApp();

  return (
    <section
      className="about-content"
      data-testid="about-screen"
      data-screen-label="Om appen"
      style={{ paddingTop: 8 }}
    >
      {/* Back row: arrow → home (Progress). Bottom nav also stays available.
          The button pads 9 around its 22px icon for a 40px tap target (kids'
          app; the BottomNav tabs are ~48px). The negative inline-start margin
          cancels that padding so the icon stays optically flush with the
          content column below it. */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
        <button
          type="button"
          onClick={actions.goProgress}
          aria-label={copy.about.back}
          className="text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{
            display: "inline-flex",
            padding: 9,
            marginInlineStart: -9,
            borderRadius: 10,
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 5 L8 12 L15 19" />
          </svg>
        </button>
        <h2
          className="text-ink"
          style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, margin: 0 }}
        >
          {copy.about.title}
        </h2>
      </div>

      {/* Mascot hero — the child's chosen mascot, happy. */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
        <MascotFace animal={state.mascot} stage={7} confetti={false} bob={false} />
      </div>

      {/* Story (2 short paragraphs). */}
      {copy.about.intro.map((para, i) => (
        <p
          key={i}
          className="text-ink-2"
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            marginTop: i === 0 ? 8 : 12,
            textAlign: "center",
          }}
        >
          {para}
        </p>
      ))}

      {/* Support card — the single coffee CTA. */}
      <div style={{ ...CARD, marginTop: 18, textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 16,
            color: "#4F4034",
          }}
        >
          {copy.about.support.heading}
        </div>
        <div style={{ fontSize: 13, color: "#A9967E", marginTop: 4, lineHeight: 1.45 }}>
          {copy.about.support.sub}
        </div>
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("support_click", { platform: "buymeacoffee" })}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{
            marginTop: 14,
            width: "100%",
            padding: 14,
            borderRadius: 14,
            background: "var(--color-accent)",
            color: "#fff",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 15.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            boxShadow: "0 10px 24px rgba(246,166,35,.34)",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 8 H17 V13 A4 4 0 0 1 13 17 H8 A4 4 0 0 1 4 13 Z" />
            <path d="M17 9 H19.5 A2 2 0 0 1 19.5 13 H17" />
            <path d="M7 3 V5 M10.5 3 V5 M14 3 V5" />
          </svg>
          {copy.about.support.cta}
        </a>
      </div>

      <div style={{ textAlign: "center", fontSize: 12, color: "#C2B299", marginTop: 20 }}>
        {copy.about.thanks}
      </div>
    </section>
  );
}
