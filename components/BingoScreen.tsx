"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { copy, interp } from "@/lib/copy";
import BingoModal from "@/components/BingoModal";
import BingoConfetti from "@/components/BingoConfetti";

const display: React.CSSProperties = { fontFamily: "var(--font-display)" };

// The detail sheet lingers briefly after a mark/undo tap so the state flip is
// seen, then auto-dismisses — short enough that the row/board confetti is
// revealed promptly behind the dismissed sheet.
const AUTO_CLOSE_MS = 250;

export default function BingoScreen() {
  const { derived, actions } = useApp();
  const b = derived.bingo;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending auto-close when the screen unmounts.
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const closeModal = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setSelectedId(null);
  };

  // Toggle the feat, then auto-dismiss the sheet so the change registers and any
  // completed-row/board confetti becomes visible.
  const toggleAndClose = (id: string) => {
    actions.toggleFeat(id);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setSelectedId(null), AUTO_CLOSE_MS);
  };

  // Off-season: a season tab exists but no active board → teaser.
  if (!b.active) {
    return (
      <section data-screen-label="Bingo" style={{ paddingTop: 40, textAlign: "center" }}>
        <h2 className="sr-only">{copy.bingo.nav}</h2>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🎟️</div>
        <div style={{ ...display, fontWeight: 800, fontSize: 20, color: "#4F4034" }}>
          {copy.bingo.teaser.heading}
        </div>
        <p style={{ fontSize: 14, color: "#A9967E", fontWeight: 600, marginTop: 8 }}>
          {copy.bingo.teaser.sub}
        </p>
      </section>
    );
  }

  const selected = selectedId ? b.feats.find((f) => f.id === selectedId) ?? null : null;

  return (
    // position:relative scopes the absolutely-positioned <BingoConfetti> burst to this screen.
    <section data-screen-label="Bingo" style={{ position: "relative", paddingTop: 8 }}>
      <h2 className="sr-only">{copy.bingo.nav}</h2>

      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <div style={{ ...display, fontWeight: 800, fontSize: 26, color: "#4F4034" }}>
          {copy.bingo.title}
        </div>
        <div style={{ fontSize: 13, color: "#A9967E", fontWeight: 600, marginTop: 2 }}>
          {b.seasonName} · {interp(copy.bingo.countLabel, { done: b.doneCount, total: b.feats.length })}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 9,
          marginTop: 14,
        }}
      >
        {b.feats.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setSelectedId(f.id)}
            aria-label={f.title}
            aria-pressed={f.done}
            data-done={f.done}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={{
              position: "relative",
              background: f.done ? "#E4F1D8" : "#fff",
              border: `2px solid ${f.done ? "#7BAE52" : "#F2DEBE"}`,
              borderRadius: 16,
              aspectRatio: "1 / 1",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              padding: "6px 5px",
              cursor: "pointer",
            }}
          >
            {f.done && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: -9,
                  right: -9,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#5C8A3F",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 900,
                  boxShadow: "0 2px 6px rgba(76,122,46,.55)",
                }}
              >
                ✓
              </span>
            )}
            <span style={{ fontSize: 26, lineHeight: 1 }}>{f.emoji}</span>
            <span
              style={{
                ...display,
                fontWeight: 700,
                fontSize: 13.5,
                lineHeight: 1.12,
                color: f.done ? "#4C7A2E" : "#4F4034",
                textWrap: "balance",
              }}
            >
              {f.card}
            </span>
          </button>
        ))}
      </div>

      <BingoConfetti mode={b.confetti} />

      {selected && (
        <BingoModal
          feat={selected}
          onToggle={() => toggleAndClose(selected.id)}
          onClose={closeModal}
        />
      )}
    </section>
  );
}
