"use client";

// "Om appen" — a bottom drawer, deliberately NOT a screen. Opening it overlays
// whatever the user was looking at and closing returns them there, so the coffee
// ask never displaces anyone. Built on Base UI's Drawer for swipe-to-dismiss,
// focus trapping, and scroll locking (see the plan for why not hand-rolled).
// All user-facing text comes from copy.
//
// Layout is a port of the Claude Design handoff: grab-handle-as-close-button,
// illustration, story, signature, support card, footer. The hex values are
// literal on purpose — that's the house style in this file.

import { Drawer } from "@base-ui/react/drawer";
import { useApp } from "@/lib/store";
import { copy } from "@/lib/copy";
import { track } from "@/lib/analytics";
import { SUPPORT_URL } from "@/lib/links";

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
            {/* The grab handle IS the close button — one affordance, not a
                decorative bar plus a redundant "Luk" row at the bottom. Its
                accessible name comes from aria-label (Base UI spreads it onto
                the <button> it renders). Escape / backdrop / swipe still work. */}
            <Drawer.Close
              aria-label={copy.about.close}
              className={FOCUS_RING}
              style={{
                padding: "12px 0 6px",
                display: "flex",
                justifyContent: "center",
                width: "100%",
              }}
            >
              <div className="about-drawer-handle" />
            </Drawer.Close>

            <Drawer.Content
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 18,
                padding: "6px 26px 30px",
              }}
            >
              <Drawer.Title
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: 24,
                  color: "#4F4034",
                  textAlign: "center",
                  margin: 0,
                }}
              >
                {copy.about.title}
              </Drawer.Title>

              {/* Hero illustration. Plain <img>: this is a static export with
                  images.unoptimized, and the project uses no next/image. Both
                  dimensions are set (source is 1224×776) so the panel doesn't
                  reflow when the bitmap decodes. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/reading-girl.svg"
                alt={copy.about.illustrationAlt}
                width={290}
                height={184}
                style={{ width: 290, display: "block", margin: "2px 0 -2px" }}
              />

              {/* Story. Rendered as the accessible description so screen readers
                  announce it with the title. Base UI's Drawer.Description renders
                  a <p>, so it is re-rendered as a <div> to keep the paragraphs
                  below it valid HTML. */}
              <Drawer.Description
                render={<div />}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  textAlign: "center",
                  fontSize: 16,
                  lineHeight: 1.6,
                  color: "#8A7761",
                  textWrap: "pretty",
                  margin: 0,
                }}
              >
                {copy.about.intro.map((para, i) => (
                  <p key={i} style={{ margin: 0 }}>
                    {para}
                  </p>
                ))}
              </Drawer.Description>

              <div style={{ fontSize: 14, fontWeight: 700, color: "#C2B299" }}>
                {copy.about.signature}
              </div>

              {/* Support card — the single coffee CTA. */}
              <div
                style={{
                  width: "100%",
                  background: "#FFFDF8",
                  borderRadius: 20,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 6px 18px rgba(80,55,25,.08)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: 18,
                    color: "#4F4034",
                  }}
                >
                  {copy.about.support.heading}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "#B0A08A",
                    textAlign: "center",
                    lineHeight: 1.6,
                    textWrap: "pretty",
                  }}
                >
                  {copy.about.support.sub}
                </div>
                <a
                  href={SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track("support_click", { platform: "buymeacoffee" })}
                  className={FOCUS_RING}
                  style={{
                    marginTop: 8,
                    width: "100%",
                    height: 56,
                    borderRadius: 16,
                    background: "var(--color-accent)",
                    color: "#FFFDF8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 11,
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: 18,
                  }}
                >
                  <svg
                    width="21"
                    height="21"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 9h12v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Z" />
                    <path d="M16 10h1.8a2.2 2.2 0 0 1 0 4.4H16" />
                    <path d="M6 5.5v1M10 5v1.5M14 5.5v1" />
                  </svg>
                  {copy.about.support.cta}
                </a>
              </div>

              <div style={{ fontSize: 14, color: "#C2B299", textAlign: "center" }}>
                {copy.about.thanks}
              </div>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
