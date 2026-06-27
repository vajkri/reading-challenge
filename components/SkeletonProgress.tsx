"use client";

import * as React from "react";
import { copy } from "@/lib/copy";

// Neutral pulsing skeleton shown while !state.hydrated, mirroring the ONGOING
// branch of ProgressScreen (mascot hero → caption → ring) so the real content
// hydrates into the same positions with no layout jump. Purely presentational:
// no name, progress, or challenge state is rendered, so the loading frame leaks
// nothing and the discouraging "none" state never paints on reload (issue #11).
//
// Shimmer is a plain CSS animation (sk-shimmer) so the existing universal
// reduced-motion block in globals.css neutralizes it for free.

const SK = "#EFE0C8"; // sketch's --sk placeholder fill on the app bg
const shimmer: React.CSSProperties = {
  background: SK,
  animation: "sk-shimmer 1.6s ease-in-out infinite",
};

export default function SkeletonProgress(): React.ReactElement {
  return (
    <section
      aria-busy="true"
      aria-label={copy.loading.label}
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
      {/* mascot hero placeholder — same outer footprint as ProgressScreen's
          scaled 200x172 wrapper; soft rounded blob fits the 150x162 inner box */}
      <div
        aria-hidden
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
        <div
          style={{
            ...shimmer,
            width: "calc(150px * var(--mascot-scale))",
            height: "calc(162px * var(--mascot-scale))",
            borderRadius: 42,
          }}
        />
      </div>

      {/* caption placeholder — two stacked pill lines in the ~44px caption band */}
      <div
        aria-hidden
        style={{
          marginTop: "var(--hero-gap)",
          minHeight: 44,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 9,
        }}
      >
        <div style={{ ...shimmer, width: 200, height: 14, borderRadius: 7 }} />
        <div style={{ ...shimmer, width: 140, height: 14, borderRadius: 7 }} />
      </div>

      {/* ring placeholder — track-only circle matching ProgressScreen's ring box;
          two centered inner pills for the percent + total lines. No arc, no text */}
      <div
        aria-hidden
        style={{
          position: "relative",
          width: "clamp(168px, 30dvh, 236px)",
          aspectRatio: "1 / 1",
          marginTop: "var(--hero-gap)",
        }}
      >
        <div
          style={{
            ...shimmer,
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: "transparent",
            border: `20px solid ${SK}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <div style={{ ...shimmer, width: 84, height: 34, borderRadius: 10 }} />
          <div style={{ ...shimmer, width: 96, height: 14, borderRadius: 7 }} />
        </div>
      </div>
    </section>
  );
}
