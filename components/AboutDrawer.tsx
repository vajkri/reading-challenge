"use client";

// "Om appen" — a bottom drawer, deliberately NOT a screen. Opening it overlays
// whatever the user was looking at and closing returns them there, so the coffee
// ask never displaces anyone. Built on Base UI's Drawer for swipe-to-dismiss,
// focus trapping, and scroll locking (see the plan for why not hand-rolled).
// All user-facing text comes from copy.

import type { CSSProperties } from "react";
import { Drawer } from "@base-ui/react/drawer";
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

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function AboutDrawer() {
  const { state, actions } = useApp();

  return (
    <Drawer.Root
      open={state.aboutOpen}
      onOpenChange={(open) => {
        if (!open) actions.closeAbout();
      }}
    >
      <Drawer.Portal>
        <Drawer.Backdrop className="about-drawer-backdrop" />
        <Drawer.Viewport className="about-drawer-viewport">
          <Drawer.Popup className="about-drawer-popup" data-testid="about-drawer">
            <div className="about-drawer-handle" aria-hidden="true" />

            <Drawer.Content>
              <Drawer.Title
                className="text-ink"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: 20,
                  margin: 0,
                  textAlign: "center",
                }}
              >
                {copy.about.title}
              </Drawer.Title>

              {/* Mascot hero — the child's chosen mascot, happy. */}
              <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
                <MascotFace animal={state.mascot} stage={7} confetti={false} bob={false} />
              </div>

              {/* Story (2 short paragraphs). Rendered as the accessible description
                  so screen readers announce it with the title. Base UI's
                  Drawer.Description renders a <p>, so it is re-rendered as a <div>
                  to keep the paragraphs below it valid HTML. */}
              <Drawer.Description render={<div />}>
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
              </Drawer.Description>

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
                  className={FOCUS_RING}
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

              {/* Explicit close, in addition to swipe / Escape / backdrop press —
                  matches BingoModal's text "Luk" button. */}
              <Drawer.Close
                className={FOCUS_RING}
                style={{
                  width: "100%",
                  marginTop: 18,
                  padding: 13,
                  borderRadius: 14,
                  background: "#F2E6D2",
                  color: "#4F4034",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                {copy.about.close}
              </Drawer.Close>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
