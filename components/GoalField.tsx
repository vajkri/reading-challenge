"use client";

// Læsemål card — a single dynamic "Tempo-zoner" slider (issue #23).
//
// The slider is a native <input type="range"> (free keyboard a11y + a real value
// for tests), themed by the .goal-slider class. Difficulty = minutes/day relative
// to the deadline, so the zone tint + labels are positioned from derived fractions
// (goalZoneP1/P2) and shift/collapse as the deadline changes. All numbers come
// from `derived`; this component only maps them to layout.

import type { CSSProperties } from "react";
import { useApp } from "@/lib/store";
import { copy } from "@/lib/copy";
import { GOAL_MIN, GOAL_MAX, GOAL_STEP, type EffortKey } from "@/lib/joy";

const CARD: CSSProperties = {
  background: "#fff",
  borderRadius: 20,
  padding: 18,
  boxShadow: "0 6px 16px rgba(80,55,25,.08)",
  marginTop: 14,
};
const HEADING: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 16,
  color: "#4F4034",
};
const SUB: CSSProperties = {
  fontSize: 13,
  color: "#A9967E",
  marginTop: 4,
  lineHeight: 1.45,
};

// Zone tints — intentionally softer than the --color-*-bg chip tokens so the
// gradient track reads as a gentle wash, not three solid chips. Active-label
// colors reuse the shared --color-*-fg tokens.
const ZONE_TINT: Record<EffortKey, string> = {
  lille: "#EAF3DD",
  mellem: "#FBE7C4",
  stor: "#F6D3C6",
};
const LABEL_FG: Record<EffortKey, string> = {
  lille: "var(--color-easy-fg)",
  mellem: "var(--color-med-fg)",
  stor: "var(--color-hard-fg)",
};

/** A zone label is hidden when its band occupies too little of the track. */
function zoneLabel(
  key: EffortKey,
  center: number | null,
  visible: boolean,
  active: boolean,
) {
  const label = copy.settings.goal.effort[key];
  if (center == null || !visible) {
    return (
      <span aria-hidden="true" style={{ display: "none" }}>
        {label}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        left: `${center * 100}%`,
        transform: active ? "translateX(-50%) scale(1.06)" : "translateX(-50%)",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
        color: active ? LABEL_FG[key] : "var(--color-muted)",
        transition: "left .2s, color .2s, transform .2s",
      }}
    >
      {label}
    </span>
  );
}

export default function GoalField() {
  const { derived, actions } = useApp();
  const g = copy.settings.goal;
  const p1 = derived.goalZoneP1;
  const p2 = derived.goalZoneP2;
  const active = derived.goalEffort;

  // 3-stop gradient with hard edges at the two band boundaries.
  const zones =
    `linear-gradient(90deg,` +
    `${ZONE_TINT.lille} 0 ${(p1 * 100).toFixed(2)}%,` +
    `${ZONE_TINT.mellem} ${(p1 * 100).toFixed(2)}% ${(p2 * 100).toFixed(2)}%,` +
    `${ZONE_TINT.stor} ${(p2 * 100).toFixed(2)}% 100%)`;

  // Zone label centers + visibility (hide a zone narrower than its threshold).
  const lilleCenter = p1 > 0 ? p1 / 2 : null;
  const mellemCenter = p2 > p1 ? (p1 + p2) / 2 : null;
  const storCenter = p2 < 1 ? (p2 + 1) / 2 : null;

  return (
    <div style={CARD}>
      <div style={HEADING}>{g.heading}</div>
      <div style={SUB}>{g.sub}</div>

      {/* Readout: big total + per-day */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "16px 0 12px" }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 44,
            lineHeight: 1,
            color: "#4F4034",
            letterSpacing: "-.01em",
          }}
        >
          {derived.goalNum}
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "#A9967E" }}>
          {g.unit}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#A9967E", textAlign: "right", lineHeight: 1.3 }}>
          {derived.goalPerDayLabel}
        </span>
      </div>

      {/* Indsats caption (written once) */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "#C2B299",
          textAlign: "center",
          marginBottom: 5,
        }}
      >
        {g.effortCaption}
      </div>

      {/* Zone labels overlay */}
      <div style={{ position: "relative", height: 20, marginBottom: 8 }}>
        {/* Hide a label when its band is too narrow to fit the word (~7–11% of track). */}
        {zoneLabel("lille", lilleCenter, p1 > 0.07, active === "lille")}
        {zoneLabel("mellem", mellemCenter, p2 - p1 > 0.11, active === "mellem")}
        {zoneLabel("stor", storCenter, 1 - p2 > 0.07, active === "stor")}
      </div>

      {/* Native range slider — themed via .goal-slider; --zones supplies the tint */}
      <input
        type="range"
        className="goal-slider"
        min={GOAL_MIN}
        max={GOAL_MAX}
        step={GOAL_STEP}
        value={derived.goalNum}
        onChange={(e) => actions.setGoalDraft(e.target.value)}
        aria-label={g.heading}
        aria-valuetext={`${derived.goalNum} ${g.unit}, ${derived.goalEffortLabel}, ${derived.goalPerDayLabel}`}
        style={{ ["--zones" as string]: zones } as CSSProperties}
      />
    </div>
  );
}
