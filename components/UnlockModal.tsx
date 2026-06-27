"use client";

// Parental gate modal — a simple arithmetic challenge that unlocks Settings.
// Ported from Sommerlæsning.dc.html (~386–405). Renders only when
// state.unlockOpen. Backdrop click closes; the inner card stops propagation
// and uses the `mons-sheet` entrance animation.

import { useApp } from "@/lib/store";
import { copy } from "@/lib/copy";

/** Closed-padlock icon: rounded-rect body + arc shackle + keyhole dot. */
function ClosedPadlock({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.6" fill="#B5803A" />
      <path d="M7.5 10.5 V8 a4.5 4.5 0 0 1 9 0 V10.5" stroke="#B5803A" strokeWidth="2.3" fill="none" />
      <circle cx="12" cy="15.3" r="1.7" fill="#FBEFDB" />
    </svg>
  );
}

export default function UnlockModal() {
  const { state, actions } = useApp();
  if (!state.unlockOpen) return null;

  return (
    <div
      onClick={actions.closeUnlock}
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
        role="dialog"
        aria-modal="true"
        aria-label={copy.settings.unlock.heading}
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
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 16,
            background: "#FBEFDB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
          }}
        >
          <ClosedPadlock />
        </div>

        <div
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "#4F4034" }}
        >
          {copy.settings.unlock.heading}
        </div>
        <div style={{ fontSize: 13, color: "#A9967E", marginTop: 5, lineHeight: 1.45 }}>
          {copy.settings.unlock.sub}
        </div>

        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 30,
            color: "#4F4034",
            margin: "18px 0 14px",
          }}
        >
          {state.uA} + {state.uB} = ?
        </div>

        <input
          type="number"
          inputMode="numeric"
          value={state.unlockInput}
          onChange={(e) => actions.setUnlockInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") actions.submitUnlock();
          }}
          placeholder={copy.settings.unlock.placeholder}
          aria-label={`${state.uA} + ${state.uB}`}
          autoFocus
          style={{
            width: 120,
            textAlign: "center",
            padding: 12,
            borderRadius: 12,
            border: "2px solid #F2DEBE",
            fontSize: 20,
            fontWeight: 800,
            color: "#4F4034",
            outline: "none",
          }}
        />

        {state.unlockError && (
          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: "#C45B40" }}>
            {copy.settings.unlock.error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={actions.closeUnlock}
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
            {copy.settings.unlock.cancel}
          </button>
          <button
            type="button"
            onClick={actions.submitUnlock}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={{
              flex: 1,
              padding: 13,
              borderRadius: 13,
              background: "var(--color-accent)",
              color: "#fff",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {copy.settings.unlock.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
