"use client";

import * as React from "react";
import MascotFace from "@/components/MascotFace";
import { useApp } from "@/lib/store";
import { copy } from "@/lib/copy";
import { RING } from "@/lib/joy";

const display: React.CSSProperties = { fontFamily: "var(--font-display)" };

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
 * Falling-confetti burst, scoped over the mascot hero. CSS-only: the pieces
 * mount when `active` flips true (the mascot reaches a celebratory stage,
 * joy >= 6) and play the mons-fall animation twice, then rest invisible — no
 * JS timers or state. Positioned absolutely + pointer-events:none + aria-hidden.
 */
function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
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

/**
 * Fremgang (Progress) screen.
 *
 * Returns only the inner scrollable column — the app frame, header and bottom
 * nav are owned by <AppShell/>. Branches on the challenge lifecycle
 * (derived.isNone / isOngoing / isCompleted); the mascot hero is always at the
 * top, with the celebratory confetti scoped over it. Ports
 * Sommerlæsning.dc.html lines ~44–136 faithfully.
 */
export default function ProgressScreen(): React.ReactElement {
  const { state, derived, actions } = useApp();

  return (
    <section
      data-screen-label="Fremgang"
      className="progress-screen"
      style={{
        flex: "1 1 auto",
        overflowY: "auto",
        padding: "var(--pad-top) 22px calc(var(--pad-top) + 10px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <h2 className="sr-only">{copy.nav.progress}</h2>

      {/* mascot hero (head only) — confetti burst is scoped to this container.
          The face is a fixed 150x162 px render (MascotFace stays pure), so it
          shrinks on short viewports via transform: scale(--mascot-scale). The
          wrapper's layout box is calc'd to the scaled size (transform-origin
          top-center) so it reserves no dead space. */}
      <div
        style={{
          position: "relative",
          width: "calc(200px * var(--mascot-scale))",
          height: "calc(172px * var(--mascot-scale))",
          marginTop: 6,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
        }}
      >
        <ConfettiBurst active={derived.showConfetti} />
        <div
          style={{
            position: "relative",
            width: "calc(150px * var(--mascot-scale))",
            height: "calc(162px * var(--mascot-scale))",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 150,
              height: 162,
              transform: "scale(var(--mascot-scale))",
              transformOrigin: "top left",
            }}
          >
            <MascotFace animal={state.mascot} stage={derived.joy} confetti={false} />
          </div>
        </div>
      </div>

      {/* caption (ongoing only) */}
      {derived.isOngoing && (
        <div
          style={{
            ...display,
            marginTop: "var(--hero-gap)",
            textAlign: "center",
            fontWeight: 600,
            fontSize: 17,
            color: "#6B5444",
            minHeight: 44,
            maxWidth: 290,
            lineHeight: 1.3,
            textWrap: "balance",
          }}
        >
          {derived.caption}
        </div>
      )}

      {/* NO CHALLENGE: start CTA */}
      {derived.isNone && (
        <div
          style={{
            marginTop: 18,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            maxWidth: 300,
          }}
        >
          <div style={{ ...display, fontWeight: 800, fontSize: 22 }} className="text-ink">
            {copy.progress.readyHeading}
          </div>
          <div
            className="text-ink-2"
            style={{ marginTop: 8, fontSize: 15, fontWeight: 600, lineHeight: 1.45 }}
          >
            {derived.startSub}
          </div>
          <button
            type="button"
            onClick={actions.goSettings}
            className="bg-accent"
            style={{
              ...display,
              marginTop: 22,
              padding: "16px 28px",
              borderRadius: 16,
              color: "#fff",
              fontWeight: 700,
              fontSize: 17,
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              boxShadow: "0 10px 24px rgba(246,166,35,.34)",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 5.5 C5 4.7 5.7 4 6.5 4 H18 C18.5 4 19 4.5 19 5 V19 C19 19.5 18.5 20 18 20 H6.5 C5.7 20 5 19.3 5 18.5 Z"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <path d="M9 8.5 H15 M9 12 H14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            {copy.progress.startBtn}
          </button>
        </div>
      )}

      {/* ONGOING: ring + deadline */}
      {derived.isOngoing && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "clamp(168px, 30dvh, 236px)",
              aspectRatio: "1 / 1",
              marginTop: "var(--hero-gap)",
            }}
          >
            <svg
              viewBox="0 0 280 280"
              style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}
              aria-hidden="true"
            >
              <circle
                cx="140"
                cy="140"
                r={RING.r}
                fill="none"
                stroke="#FBE6BD"
                strokeWidth="20"
              />
              <circle
                cx="140"
                cy="140"
                r={RING.r}
                fill="none"
                strokeLinecap="round"
                strokeWidth="20"
                strokeDasharray={RING.c}
                strokeDashoffset={derived.ringOffset}
                style={{
                  stroke: "var(--accent, #F6A623)",
                  transition: "stroke-dashoffset .8s cubic-bezier(.34,1.2,.5,1)",
                }}
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                className="text-ink"
                style={{ ...display, fontWeight: 800, fontSize: "clamp(40px, 8.5dvh, 58px)", lineHeight: 1 }}
              >
                {derived.pct}
                <span style={{ fontSize: "0.45em", verticalAlign: "super" }}>%</span>
              </div>
              <div
                className="text-ink-3"
                style={{ marginTop: 6, fontWeight: 700, fontSize: 15 }}
              >
                {derived.total} / {state.goal} {copy.progress.unit}
              </div>
            </div>
          </div>

          {derived.showDeadline && (
            <div
              style={{
                marginTop: "var(--hero-gap)",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 16px",
                borderRadius: 999,
                background: "#FBEFDB",
                color: "#C98A2B",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="2.2" />
                <path
                  d="M12 9.5 V13 L14.5 14.5 M9 3.5 H15"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
              {derived.deadlineLabel}
            </div>
          )}
        </div>
      )}

      {/* COMPLETED: celebration + stats */}
      {derived.isCompleted && (
        <div
          style={{
            marginTop: 16,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            maxWidth: 320,
          }}
        >
          <div
            className="bg-flash text-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 16px",
              borderRadius: 999,
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="#5C8A3F" />
              <path
                d="M7.5 12.5 L10.5 15.5 L16.5 9"
                stroke="#fff"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {copy.progress.completedBadge}
          </div>

          <div
            className="text-ink"
            style={{
              ...display,
              marginTop: 14,
              fontWeight: 800,
              fontSize: 24,
              textAlign: "center",
              lineHeight: 1.2,
            }}
          >
            {copy.progress.completedHeading}
          </div>
          <div
            className="text-ink-2"
            style={{
              marginTop: 6,
              fontSize: 15,
              fontWeight: 600,
              textAlign: "center",
              lineHeight: 1.45,
            }}
          >
            {derived.doneSub}
          </div>

          <div style={{ marginTop: 18, display: "flex", gap: 12, width: "100%" }}>
            <div
              style={{
                flex: 1,
                background: "#fff",
                borderRadius: 18,
                padding: "16px 12px",
                boxShadow: "0 6px 16px rgba(80,55,25,.08)",
                textAlign: "center",
              }}
            >
              <div
                style={{ ...display, fontWeight: 800, fontSize: 26, color: "var(--accent, #F6A623)" }}
              >
                {derived.total}
              </div>
              <div className="text-ink-3" style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                {copy.progress.minutesRead}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                background: "#fff",
                borderRadius: 18,
                padding: "16px 12px",
                boxShadow: "0 6px 16px rgba(80,55,25,.08)",
                textAlign: "center",
              }}
            >
              <div
                style={{ ...display, fontWeight: 800, fontSize: 26, color: "var(--accent, #F6A623)" }}
              >
                {derived.bookCount}
              </div>
              <div className="text-ink-3" style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                {derived.bookWord}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={actions.requestNewChallenge}
            className="bg-accent"
            style={{
              ...display,
              marginTop: 22,
              width: "100%",
              padding: 16,
              borderRadius: 16,
              color: "#fff",
              fontWeight: 700,
              fontSize: 17,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              boxShadow: "0 10px 24px rgba(246,166,35,.34)",
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1, marginTop: -2 }}>+</span>{" "}
            {copy.progress.newChallengeBtn}
          </button>
        </div>
      )}
    </section>
  );
}
