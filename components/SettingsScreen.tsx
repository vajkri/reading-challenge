"use client";

// Indstillinger (Settings) screen.
//
// Ported from Sommerlæsning.dc.html (~269–408). Returns ONLY the screen's inner
// scrollable content — the header (app name), bottom nav, page background, and
// confetti overlay all come from <AppShell/>. All user-facing text comes from
// the copy module; exact pixel values match the prototype's inline styles.

import type { CSSProperties } from "react";
import { useApp } from "@/lib/store";
import { copy } from "@/lib/copy";
import MascotFace from "@/components/MascotFace";
import UnlockModal from "@/components/UnlockModal";

// ---------------------------------------------------------------------------
// Shared style fragments (match the prototype exactly).
// ---------------------------------------------------------------------------

const CARD: CSSProperties = {
  background: "#fff",
  borderRadius: 20,
  padding: 18,
  boxShadow: "0 6px 16px rgba(80,55,25,.08)",
};

const CARD_HEADING: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 16,
  color: "#4F4034",
};

const CARD_SUB: CSSProperties = {
  fontSize: 13,
  color: "#A9967E",
  marginTop: 4,
  lineHeight: 1.45,
};

const FIELD: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: 12,
  borderRadius: 12,
  border: "2px solid #F2DEBE",
  fontSize: 16,
  fontWeight: 700,
  color: "#4F4034",
  outline: "none",
};

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Padlock body (rounded rect) + arc shackle + keyhole dot. */
function Padlock({
  open,
  color,
  keyhole,
}: {
  open: boolean;
  color: string;
  keyhole: string;
}) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.6" fill={color} />
      <path
        d={open ? "M7.5 10.5 V8 a4.5 4.5 0 0 1 9 0" : "M7.5 10.5 V8 a4.5 4.5 0 0 1 9 0 V10.5"}
        stroke={color}
        strokeWidth="2.3"
        fill="none"
      />
      <circle cx="12" cy="15.3" r="1.7" fill={keyhole} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Mascot tile
// ---------------------------------------------------------------------------

function MascotTile({
  animal,
  label,
  active,
  onClick,
}: {
  animal: "cat" | "dog";
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={FOCUS_RING}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "14px 8px 12px",
        borderRadius: 16,
        border: `2.5px solid ${active ? "var(--color-accent)" : "#F2DEBE"}`,
        background: active ? "#FBEFDB" : "#FFFBF3",
        transition: "border-color .2s, background .2s",
      }}
    >
      <div style={{ position: "relative", width: 96, height: 104 }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 0,
            transform: "translateX(-50%) scale(.62)",
            transformOrigin: "bottom center",
          }}
        >
          <MascotFace animal={animal} stage={3} confetti={false} bob={false} />
        </div>
      </div>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "#4F4034" }}>
        {label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Goal preset chip
// ---------------------------------------------------------------------------

function PresetChip({
  value,
  tier,
  onClick,
}: {
  value: string;
  tier: "easy" | "med" | "hard";
  onClick: () => void;
}) {
  const bg = tier === "easy" ? "bg-easy-bg" : tier === "med" ? "bg-med-bg" : "bg-hard-bg";
  const fg = tier === "easy" ? "text-easy-fg" : tier === "med" ? "text-med-fg" : "text-hard-fg";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${bg} ${fg} ${FOCUS_RING}`}
      style={{
        flex: 1,
        padding: 11,
        borderRadius: 11,
        fontWeight: 800,
        fontSize: 15,
      }}
    >
      {value}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const { state, derived, actions } = useApp();

  return (
    <section
      data-screen-label="Indstillinger"
      style={{ flex: "1 1 auto", overflowY: "auto", padding: "6px 22px 24px" }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 20,
          color: "#4F4034",
          marginBottom: 14,
        }}
      >
        {copy.settings.title}
      </h2>

      {/* Banner — ongoing (locked) prompts to edit; completed prompts to start anew. */}
      {derived.showEditBanner && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 13,
            background: "#FBEFDB",
            border: "1.5px solid #F2DEBE",
            borderRadius: 18,
            padding: "15px 16px",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              flex: "0 0 auto",
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "#F6E2BE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Padlock open={false} color="#B5803A" keyhole="#FBEFDB" />
          </div>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "#4F4034" }}>
              {copy.settings.ongoingBanner.title}
            </div>
            <div style={{ fontSize: 12, color: "#A9967E", lineHeight: 1.4, marginTop: 1 }}>
              {copy.settings.ongoingBanner.sub}
            </div>
          </div>
          <button
            type="button"
            onClick={actions.openUnlock}
            className={FOCUS_RING}
            style={{
              flex: "0 0 auto",
              padding: "11px 16px",
              borderRadius: 12,
              background: "var(--color-accent)",
              color: "#fff",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {copy.settings.ongoingBanner.editBtn}
          </button>
        </div>
      )}

      {derived.showDoneBanner && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 13,
            background: "#E4F1D8",
            border: "1.5px solid #CDE4BC",
            borderRadius: 18,
            padding: "15px 16px",
            marginBottom: 16,
          }}
        >
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "#4F4034" }}>
              {copy.settings.completedBanner.title}
            </div>
            <div style={{ fontSize: 12, color: "#7A8C66", lineHeight: 1.4, marginTop: 1 }}>
              {copy.settings.completedBanner.sub}
            </div>
          </div>
          <button
            type="button"
            onClick={actions.requestNewChallenge}
            className={FOCUS_RING}
            style={{
              flex: "0 0 auto",
              padding: "11px 16px",
              borderRadius: 12,
              background: "var(--color-accent)",
              color: "#fff",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {copy.settings.completedBanner.newBtn}
          </button>
        </div>
      )}

      {/* Gating wrapper — dims + disables the four cards while locked. */}
      <div
        inert={derived.effLocked || undefined}
        style={{
          pointerEvents: derived.lockedPE,
          opacity: derived.lockedOpacity,
          transition: "opacity .25s",
        }}
      >
        {/* Card 1 — Vælg maskot */}
        <div style={{ ...CARD, marginBottom: 14 }}>
          <div style={CARD_HEADING}>{copy.settings.mascot.heading}</div>
          <div style={CARD_SUB}>{copy.settings.mascot.sub}</div>

          <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
            <MascotTile
              animal="cat"
              label={copy.settings.mascot.cat}
              active={state.mascotDraft === "cat"}
              onClick={() => actions.pickMascot("cat")}
            />
            <MascotTile
              animal="dog"
              label={copy.settings.mascot.dog}
              active={state.mascotDraft === "dog"}
              onClick={() => actions.pickMascot("dog")}
            />
          </div>
        </div>

        {/* Card 2 — Maskottens navn */}
        <div style={{ ...CARD, marginBottom: 14 }}>
          <div style={CARD_HEADING}>{copy.settings.name.heading}</div>
          <div style={CARD_SUB}>{copy.settings.name.sub}</div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <input
              value={state.nameDraft}
              onChange={(e) => actions.setNameDraft(e.target.value)}
              placeholder={copy.settings.name.placeholder}
              maxLength={20}
              aria-label={copy.settings.name.heading}
              className={FOCUS_RING}
              style={FIELD}
            />
          </div>
        </div>

        {/* Card 3 — Læsemål */}
        <div style={{ ...CARD, marginBottom: 14 }}>
          <div style={CARD_HEADING}>{copy.settings.goal.heading}</div>
          <div style={CARD_SUB}>{copy.settings.goal.sub}</div>

          <div style={{ display: "flex", gap: 8, margin: "16px 0 14px" }}>
            <PresetChip value="300" tier="easy" onClick={() => actions.presetGoal("300")} />
            <PresetChip value="450" tier="med" onClick={() => actions.presetGoal("450")} />
            <PresetChip value="600" tier="hard" onClick={() => actions.presetGoal("600")} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="number"
              min={1}
              value={state.goalDraft}
              onChange={(e) => actions.setGoalDraft(e.target.value)}
              aria-label={copy.settings.goal.heading}
              className={FOCUS_RING}
              style={FIELD}
            />
            <span style={{ fontWeight: 700, color: "#A9967E", fontSize: 14 }}>
              {copy.settings.goal.unit}
            </span>
          </div>
        </div>

        {/* Card 4 — Slutdato */}
        <div style={{ ...CARD, marginTop: 14 }}>
          <div style={CARD_HEADING}>{copy.settings.deadline.heading}</div>
          <div style={CARD_SUB}>{copy.settings.deadline.sub}</div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <input
              type="date"
              value={state.deadlineDraft}
              onChange={(e) => actions.setDeadlineDraft(e.target.value)}
              aria-label={copy.settings.deadline.heading}
              className={FOCUS_RING}
              style={FIELD}
            />
          </div>
        </div>
      </div>

      {/* Single commit button: Start (no challenge) or Update (editing a running one). */}
      {(derived.isNone || derived.isEditing) && (
        <button
          type="button"
          onClick={derived.isNone ? actions.startChallenge : actions.updateChallenge}
          className={FOCUS_RING}
          style={{
            width: "100%",
            marginTop: 14,
            padding: 16,
            borderRadius: 16,
            background: "var(--color-accent)",
            color: "#fff",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 17,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            boxShadow: "0 10px 24px rgba(246,166,35,.34)",
          }}
        >
          {derived.isNone ? copy.settings.startBtn : copy.settings.updateBtn}
        </button>
      )}

      <div style={{ textAlign: "center", fontSize: 12, color: "#C2B299", marginTop: 22, lineHeight: 1.5 }}>
        {copy.settings.footer}
      </div>

      <UnlockModal />
    </section>
  );
}
