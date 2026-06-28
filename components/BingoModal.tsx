"use client";

// Bingo feat detail bottom-sheet: big emoji, full title, one-line description,
// and a Mark-as-done / Undo button. Screen-local (driven by BingoScreen state,
// not the global store) since it's purely presentational. Focus-trap + Escape +
// focus-restore mirror NewChallengeModal.tsx.

import { useEffect, useRef } from "react";
import type { BingoFeatView } from "@/lib/store";
import { copy } from "@/lib/copy";

export default function BingoModal({
  feat,
  onToggle,
  onClose,
}: {
  feat: BingoFeatView;
  onToggle: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    actionRef.current?.focus();
    return () => {
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialog.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(60,42,22,.42)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={feat.title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 430,
          background: "#FFF6E9",
          borderRadius: "24px 24px 0 0",
          padding: "26px 22px calc(22px + env(safe-area-inset-bottom))",
          textAlign: "center",
          boxShadow: "0 -10px 30px rgba(60,42,22,.28)",
          animation: "mons-sheet .26s ease-out",
        }}
      >
        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 8 }}>{feat.emoji}</div>
        <div
          style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "#4F4034" }}
        >
          {feat.title}
        </div>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.45,
            color: "#8A7559",
            fontWeight: 600,
            margin: "8px auto 20px",
            maxWidth: "30ch",
          }}
        >
          {feat.desc}
        </p>

        {feat.done && (
          <div
            style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "#4C7A2E", marginBottom: 14 }}
          >
            {copy.bingo.modal.doneState}
          </div>
        )}

        <button
          ref={actionRef}
          type="button"
          onClick={onToggle}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{
            width: "100%",
            padding: 15,
            borderRadius: 16,
            border: feat.done ? "2px solid #7BAE52" : "0",
            background: feat.done ? "transparent" : "#5C8A3F",
            color: feat.done ? "#4C7A2E" : "#fff",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 17,
          }}
        >
          {feat.done ? copy.bingo.modal.undo : copy.bingo.modal.markDone}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{
            marginTop: 12,
            background: "none",
            border: 0,
            color: "#A9967E",
            fontFamily: "var(--font-body)",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {copy.bingo.modal.close}
        </button>
      </div>
    </div>
  );
}
