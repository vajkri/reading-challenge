"use client";

// Confirm dialog for the one destructive action in the app: starting a new
// challenge wipes the entire reading log. Mounted app-level (AppShell) so it can
// be triggered from both Fremgang (completed view) and Indstillinger. Renders
// only while state.newChallengeOpen. Pattern mirrors UnlockModal.tsx.

import { useEffect, useRef } from "react";
import { useApp } from "@/lib/store";
import { copy } from "@/lib/copy";

export default function NewChallengeModal() {
  const { state } = useApp();
  if (!state.newChallengeOpen) return null;
  return <NewChallengeDialog />;
}

function NewChallengeDialog() {
  const { actions } = useApp();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  // Capture the opener, focus the confirm button on mount, restore focus on unmount.
  useEffect(() => {
    openerRef.current = document.activeElement;
    confirmRef.current?.focus();
    return () => {
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  // Escape closes; Tab / Shift+Tab cycle focus within the dialog.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        actions.cancelNewChallenge();
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
  }, [actions]);

  return (
    <div
      onClick={actions.cancelNewChallenge}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(60,42,22,.42)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 50,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={copy.settings.newChallengeConfirm.title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 320,
          background: "#fff",
          borderRadius: 24,
          padding: 24,
          boxShadow: "0 18px 50px rgba(60,42,22,.3)",
          textAlign: "center",
          animation: "mons-sheet .28s ease-out",
        }}
      >
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "#4F4034" }}>
          {copy.settings.newChallengeConfirm.title}
        </div>
        <div style={{ fontSize: 13, color: "#A9967E", marginTop: 6, lineHeight: 1.45 }}>
          {copy.settings.newChallengeConfirm.body}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={actions.cancelNewChallenge}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={{
              flex: 1,
              padding: 13,
              borderRadius: 13,
              background: "#F2E6D2",
              color: "#8A7559",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {copy.settings.newChallengeConfirm.cancel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={actions.confirmNewChallenge}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={{
              flex: 1,
              padding: 13,
              borderRadius: 13,
              background: "#C45B40",
              color: "#fff",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {copy.settings.newChallengeConfirm.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
