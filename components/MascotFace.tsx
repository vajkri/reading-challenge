import * as React from "react";
import type { AnimalKey, Stage } from "@/lib/types";

// ===================================================================
// PARAMETRIC MASCOT RENDERER (ported near-verbatim from
// Sommerlæsning.dc.html / Maskot-forslag.dc.html)
//
// Every drawn face line is an SVG <path> with a uniform weight + round
// caps (no border/border-radius line tricks — they taper). The whole
// face is a pure function of (animal, stage) plus the two themeable
// colors; there is NO component state. Faces are React.createElement
// trees, exactly as in the source.
//
// catColor  -> cat head fill (was this.props.catColor)
// accentColor -> bowtie color (was this.props.accentColor)
//
// SSR/concurrent-safe: the SVG key counter and the element key counter
// are render-local closures — there is NO module-level mutable state.
// ===================================================================

const STROKE = 2.6; // uniform weight for eyes + mouths
const BROW = 4; // eyebrows stay heavier

const C = React.createElement;

/** Render-local SVG key counter (replaces this._sk). */
type KeyCounter = { sk: number };

/** Builder for an absolutely-positioned <div>; carries a render-local key counter. */
type DivBuilder = (
  style: React.CSSProperties,
  kids?: React.ReactNode
) => React.ReactElement;

// ----- Anchor data: per-animal eye/mouth/blush geometry -------------

interface EyeAnchor {
  cx1: number;
  cx2: number;
  cy: number;
  size: number;
  color: string;
  brows?: boolean;
  disc?: boolean;
  discR?: number;
  tilt?: number;
}
interface MouthAnchor {
  cx: number;
  cy: number;
  color: string;
  twin?: boolean;
  tongue?: boolean;
}
interface BlushAnchor {
  cy: number;
  lx: number;
  rx: number;
}
interface Anchor {
  eye: EyeAnchor;
  mouth: MouthAnchor;
  blush: BlushAnchor;
}

// ----- SVG primitives -----------------------------------------------

function svg(kc: KeyCounter, children: React.ReactNode): React.ReactElement {
  return C(
    "svg",
    {
      key: "s" + (kc.sk = (kc.sk || 0) + 1),
      width: 150,
      height: 162,
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        overflow: "visible",
        zIndex: 5,
        pointerEvents: "none",
      },
    },
    children
  );
}

function arc(
  kc: KeyCounter,
  cx: number,
  cy: number,
  w: number,
  h: number,
  color: string,
  weight: number,
  dir: "frown" | "smile" | "flat"
): React.ReactElement {
  const x0 = cx - w / 2,
    x1 = cx + w / 2;
  let d: string;
  if (dir === "frown") d = "M" + x0 + " " + cy + " Q" + cx + " " + (cy - h) + " " + x1 + " " + cy;
  else if (dir === "smile") d = "M" + x0 + " " + cy + " Q" + cx + " " + (cy + h) + " " + x1 + " " + cy;
  else d = "M" + x0 + " " + cy + " L" + x1 + " " + cy;
  return svg(
    kc,
    C("path", {
      d,
      fill: "none",
      stroke: color,
      strokeWidth: weight,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    })
  );
}

function line(
  kc: KeyCounter,
  cx: number,
  cy: number,
  len: number,
  angleDeg: number,
  color: string,
  weight: number
): React.ReactElement {
  const r = (angleDeg * Math.PI) / 180,
    dx = (Math.cos(r) * len) / 2,
    dy = (Math.sin(r) * len) / 2;
  const d = "M" + (cx - dx) + " " + (cy - dy) + " L" + (cx + dx) + " " + (cy + dy);
  return svg(
    kc,
    C("path", {
      d,
      fill: "none",
      stroke: color,
      strokeWidth: weight,
      strokeLinecap: "round",
    })
  );
}

// ----- Feature renderers --------------------------------------------

function eyes(kc: KeyCounter, b: DivBuilder, stage: Stage, a: Anchor): React.ReactNode[] {
  const o = a.eye,
    col = o.color,
    out: React.ReactNode[] = [];
  if (o.disc) {
    const r = o.discR || 21;
    [o.cx1, o.cx2].forEach((cx) => {
      out.push(
        b({
          position: "absolute",
          top: o.cy - r + "px",
          left: cx - r + "px",
          width: r * 2 + "px",
          height: r * 2 + "px",
          borderRadius: "50%",
          background: "#fff",
          border: "3px solid #AE7C45",
          zIndex: 4,
        })
      );
    });
  }
  const E = [o.cx1, o.cx2],
    W = STROKE;
  if (stage === 0) {
    E.forEach((cx) => out.push(arc(kc, cx, o.cy, o.size * 2, o.size, col, W, "smile")));
  } else if (stage >= 5) {
    E.forEach((cx) => out.push(arc(kc, cx, o.cy + o.size, o.size * 2, o.size, col, W, "frown")));
  } else {
    E.forEach((cx, i) => {
      const st: React.CSSProperties = {
        position: "absolute",
        top: o.cy + "px",
        left: cx - o.size / 2 + "px",
        width: o.size + "px",
        height: o.size * 1.25 + "px",
        background: col,
        borderRadius: "50%",
        zIndex: 5,
      };
      if (o.tilt) st.transform = "rotate(" + (i === 0 ? o.tilt : -o.tilt) + "deg)";
      out.push(
        b(st, [
          b({
            position: "absolute",
            top: "3px",
            right: "2px",
            width: "5px",
            height: "5px",
            background: "#fff",
            borderRadius: "50%",
          }),
        ])
      );
    });
  }
  if (o.brows && stage > 0) {
    const hard = stage >= 2;
    out.push(line(kc, o.cx1 - 4, o.cy - 11, 16, hard ? -14 : -5, "#7A5230", BROW));
    out.push(line(kc, o.cx2 + 4, o.cy - 11, 16, hard ? 14 : 5, "#7A5230", BROW));
  }
  return out;
}

function mouth(kc: KeyCounter, b: DivBuilder, stage: Stage, a: Anchor): React.ReactNode[] {
  const o = a.mouth,
    col = o.color,
    cx = o.cx,
    cy = o.cy,
    z = 5,
    W = STROKE;
  if (stage === 0) return [arc(kc, cx, cy + 5, 22, 7, col, W, "frown")];
  if (stage === 1) return [arc(kc, cx, cy + 5, 18, 0, col, W, "flat")];
  if (stage <= 4) {
    const small = stage === 2;
    if (o.twin) {
      const d = small ? 6 : 8,
        w = small ? 11 : 16,
        h = small ? 5 : 8;
      return [arc(kc, cx - d, cy, w, h, col, W, "smile"), arc(kc, cx + d, cy, w, h, col, W, "smile")];
    }
    const w = small ? 18 : 30,
      h = small ? 7 : 13;
    const smile = arc(kc, cx, cy, w, h, col, W, "smile");
    if (o.tongue && stage >= 3) {
      return [
        smile,
        b(
          {
            position: "absolute",
            top: cy + 6 + "px",
            left: cx - 6 + "px",
            width: "12px",
            height: "13px",
            background: "#F39A8B",
            borderRadius: "0 0 9px 9px",
            zIndex: z - 1,
          },
          [
            b({
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "2px",
              height: "7px",
              background: "#E0857A",
              borderRadius: "2px",
            }),
          ]
        ),
      ];
    }
    return [smile];
  }
  return [
    b(
      {
        position: "absolute",
        top: cy - 2 + "px",
        left: cx - 15 + "px",
        width: "30px",
        height: "19px",
        background: "#6B4636",
        borderRadius: "7px 7px 17px 17px",
        overflow: "hidden",
        zIndex: z,
      },
      [
        b({
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "17px",
          height: "10px",
          background: "#F39A8B",
          borderRadius: "11px 11px 0 0",
        }),
      ]
    ),
  ];
}

function owlBeak(b: DivBuilder, stage: Stage): React.ReactNode[] {
  if (stage >= 5) {
    return [
      b({
        position: "absolute",
        top: "84px",
        left: "67px",
        width: 0,
        height: 0,
        borderLeft: "8px solid transparent",
        borderRight: "8px solid transparent",
        borderTop: "12px solid #F2A93C",
        zIndex: 6,
      }),
      b(
        {
          position: "absolute",
          top: "95px",
          left: "68px",
          width: "14px",
          height: "14px",
          background: "#E8912E",
          borderRadius: "14% 14% 50% 50% / 14% 14% 90% 90%",
          overflow: "hidden",
          zIndex: 6,
        },
        [
          b({
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "9px",
            height: "6px",
            background: "#F39A8B",
            borderRadius: "9px 9px 0 0",
          }),
        ]
      ),
    ];
  }
  return [
    b({
      position: "absolute",
      top: "88px",
      left: "66px",
      width: 0,
      height: 0,
      borderLeft: "9px solid transparent",
      borderRight: "9px solid transparent",
      borderTop: "19px solid #E8A23C",
      zIndex: 6,
    }),
    b({
      position: "absolute",
      top: "88px",
      left: "69px",
      width: 0,
      height: 0,
      borderLeft: "6px solid transparent",
      borderRight: "6px solid transparent",
      borderTop: "11px solid #CC7F26",
      zIndex: 6,
    }),
  ];
}

function blush(b: DivBuilder, a: Anchor): React.ReactNode[] {
  const o = a.blush;
  return [
    b({
      position: "absolute",
      top: o.cy + "px",
      left: o.lx + "px",
      width: "19px",
      height: "11px",
      background: "#F6A6A0",
      borderRadius: "50%",
      opacity: 0.8,
      zIndex: 5,
    }),
    b({
      position: "absolute",
      top: o.cy + "px",
      left: o.rx + "px",
      width: "19px",
      height: "11px",
      background: "#F6A6A0",
      borderRadius: "50%",
      opacity: 0.8,
      zIndex: 5,
    }),
  ];
}

function bowtieTop(animal: AnimalKey): number {
  const map: Record<AnimalKey, number> = {
    cat: 142,
    dog: 134,
    owl: 142,
    horse: 142,
    fox: 142,
  };
  return map[animal] ?? 142;
}

function acc(
  b: DivBuilder,
  stage: Stage,
  animal: AnimalKey,
  accentColor: string
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const AC = accentColor || "#F6A623";
  if (stage >= 4 && stage <= 6) {
    out.push(
      b(
        {
          position: "absolute",
          top: "-15px",
          left: "50%",
          transform: "translateX(-50%) rotate(-8deg)",
          width: "48px",
          height: "52px",
          zIndex: 7,
        },
        [
          b({
            position: "absolute",
            inset: 0,
            clipPath: "polygon(50% 0,100% 100%,0% 100%)",
            background: "repeating-linear-gradient(125deg,#F39A8B 0 11px,#7FC8A9 11px 22px)",
          }),
          b({
            position: "absolute",
            top: "-7px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            background: "#FFCE52",
          }),
        ]
      )
    );
  }
  if (stage >= 7) {
    out.push(
      b({
        position: "absolute",
        top: "6px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "54px",
        height: "30px",
        background: "#FFCE52",
        clipPath: "polygon(0% 100%,0% 32%,21% 60%,50% 0%,79% 60%,100% 32%,100% 100%)",
        zIndex: 7,
      })
    );
    out.push(
      b({
        position: "absolute",
        top: "4px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "7px",
        height: "7px",
        borderRadius: "50%",
        background: "#F39A8B",
        zIndex: 8,
      })
    );
  }
  if (stage >= 5) {
    out.push(
      b(
        {
          position: "absolute",
          top: bowtieTop(animal) + "px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          zIndex: 6,
        },
        [
          b({
            width: 0,
            height: 0,
            borderTop: "11px solid transparent",
            borderBottom: "11px solid transparent",
            borderLeft: "15px solid " + AC,
          }),
          b({
            width: "10px",
            height: "13px",
            borderRadius: "4px",
            background: "#D98612",
            margin: "0 -2px",
          }),
          b({
            width: 0,
            height: 0,
            borderTop: "11px solid transparent",
            borderBottom: "11px solid transparent",
            borderRight: "15px solid " + AC,
          }),
        ]
      )
    );
  }
  return out;
}

function confetti(b: DivBuilder): React.ReactNode[] {
  const dots: Array<[string, number, number, number, number]> = [
    ["#F6A623", 12, 4, 8, 12],
    ["#7FC8A9", 132, 8, 9, 0],
    ["#F39A8B", 30, -2, 7, 11],
    ["#BBA7E0", 118, 0, 7, 12],
    ["#FFCE52", 74, -8, 8, 8],
  ];
  return dots.map((d) =>
    b({
      position: "absolute",
      left: d[1] + "px",
      top: d[2] + "px",
      width: d[3] + "px",
      height: d[4] + "px",
      background: d[0],
      borderRadius: d[4] === d[3] ? "50%" : "2px",
      transform: "rotate(18deg)",
      zIndex: 8,
    })
  );
}

function anchor(animal: AnimalKey): Anchor {
  switch (animal) {
    case "cat":
      return {
        eye: { cx1: 54, cx2: 96, cy: 62, size: 15, color: "#4A3A30" },
        mouth: { cx: 75, cy: 108, color: "#6B5444", twin: true },
        blush: { cy: 86, lx: 22, rx: 109 },
      };
    case "dog":
      return {
        eye: { cx1: 53, cx2: 97, cy: 58, size: 18, color: "#3A2E26", brows: true },
        mouth: { cx: 75, cy: 102, color: "#5B4636", tongue: true },
        blush: { cy: 80, lx: 18, rx: 113 },
      };
    case "owl":
      return {
        eye: { cx1: 50, cx2: 100, cy: 58, size: 18, color: "#3A2E26", disc: true, discR: 20 },
        mouth: { cx: 75, cy: 96, color: "#9A6A3A" },
        blush: { cy: 96, lx: 16, rx: 115 },
      };
    case "horse":
      return {
        eye: { cx1: 57, cx2: 93, cy: 56, size: 12, color: "#3A2E26" },
        mouth: { cx: 75, cy: 130, color: "#7A5A3E" },
        blush: { cy: 102, lx: 42, rx: 89 },
      };
    case "fox":
      return {
        eye: { cx1: 54, cx2: 96, cy: 60, size: 12, color: "#2E2620", tilt: 12 },
        mouth: { cx: 75, cy: 116, color: "#6B5444" },
        blush: { cy: 88, lx: 24, rx: 107 },
      };
  }
}

function base(b: DivBuilder, animal: AnimalKey, catColor: string): React.ReactNode[] {
  if (animal === "cat") {
    const H = catColor || "#F4A35C";
    return [
      b({
        position: "absolute",
        top: "10.4px",
        left: "20.7px",
        width: 0,
        height: 0,
        borderLeft: "21.6px solid transparent",
        borderRight: "21.6px solid transparent",
        borderBottom: "45.6px solid " + H,
        transform: "rotate(-26deg)",
        zIndex: 1,
      }),
      b({
        position: "absolute",
        top: "10.4px",
        right: "20.7px",
        width: 0,
        height: 0,
        borderLeft: "21.6px solid transparent",
        borderRight: "21.6px solid transparent",
        borderBottom: "45.6px solid " + H,
        transform: "rotate(26deg)",
        zIndex: 1,
      }),
      b({
        position: "absolute",
        top: "22.4px",
        left: "30.4px",
        width: 0,
        height: 0,
        borderLeft: "10.8px solid transparent",
        borderRight: "10.8px solid transparent",
        borderBottom: "21.6px solid #F7B7A8",
        transform: "rotate(-26deg)",
        zIndex: 1,
      }),
      b({
        position: "absolute",
        top: "22.4px",
        right: "30.4px",
        width: 0,
        height: 0,
        borderLeft: "10.8px solid transparent",
        borderRight: "10.8px solid transparent",
        borderBottom: "21.6px solid #F7B7A8",
        transform: "rotate(26deg)",
        zIndex: 1,
      }),
      b({
        position: "absolute",
        top: "34px",
        left: "15px",
        width: "120px",
        height: "108px",
        background: H,
        borderRadius: "46% 46% 47% 47% / 42% 42% 56% 56%",
        zIndex: 2,
        boxShadow: "inset 0 -6px 0 rgba(0,0,0,.04)",
      }),
      b({
        position: "absolute",
        top: "94px",
        left: "36px",
        width: "78px",
        height: "46px",
        background: "#FFE3C2",
        borderRadius: "50%",
        zIndex: 3,
      }),
      b({
        position: "absolute",
        top: "92px",
        left: "66px",
        width: 0,
        height: 0,
        borderLeft: "9px solid transparent",
        borderRight: "9px solid transparent",
        borderTop: "11px solid #E08977",
        zIndex: 5,
      }),
      b({
        position: "absolute",
        top: "102px",
        left: "74px",
        width: "2px",
        height: "8px",
        background: "#6B5444",
        borderRadius: "2px",
        zIndex: 5,
      }),
      b({
        position: "absolute",
        top: "98px",
        left: "6px",
        width: "28px",
        height: "2px",
        background: "#E9C9A6",
        borderRadius: "2px",
        transform: "rotate(6deg)",
        zIndex: 4,
      }),
      b({
        position: "absolute",
        top: "106px",
        left: "8px",
        width: "26px",
        height: "2px",
        background: "#E9C9A6",
        borderRadius: "2px",
        transform: "rotate(-4deg)",
        zIndex: 4,
      }),
      b({
        position: "absolute",
        top: "98px",
        right: "6px",
        width: "28px",
        height: "2px",
        background: "#E9C9A6",
        borderRadius: "2px",
        transform: "rotate(-6deg)",
        zIndex: 4,
      }),
      b({
        position: "absolute",
        top: "106px",
        right: "8px",
        width: "26px",
        height: "2px",
        background: "#E9C9A6",
        borderRadius: "2px",
        transform: "rotate(4deg)",
        zIndex: 4,
      }),
    ];
  }
  if (animal === "dog") {
    const H = "#D7A05E",
      EAR = "#B5793C";
    return [
      b({
        position: "absolute",
        top: "42px",
        left: "2px",
        width: "40px",
        height: "72px",
        background: EAR,
        borderRadius: "50% 50% 50% 50% / 40% 40% 60% 60%",
        transform: "rotate(12deg)",
        zIndex: 1,
      }),
      b({
        position: "absolute",
        top: "42px",
        right: "2px",
        width: "40px",
        height: "72px",
        background: EAR,
        borderRadius: "50% 50% 50% 50% / 40% 40% 60% 60%",
        transform: "rotate(-12deg)",
        zIndex: 1,
      }),
      b({
        position: "absolute",
        top: "30px",
        left: "18px",
        width: "114px",
        height: "104px",
        background: H,
        borderRadius: "48% 48% 47% 47% / 44% 44% 56% 56%",
        zIndex: 2,
      }),
      b({
        position: "absolute",
        top: "40px",
        left: "26px",
        width: "40px",
        height: "40px",
        background: "rgba(120,80,40,.16)",
        borderRadius: "50%",
        zIndex: 2,
      }),
      b({
        position: "absolute",
        top: "84px",
        left: "40px",
        width: "70px",
        height: "50px",
        background: "#F0D3A8",
        borderRadius: "50%",
        zIndex: 3,
      }),
      b(
        {
          position: "absolute",
          top: "80px",
          left: "63px",
          width: "24px",
          height: "18px",
          background: "#3A2E26",
          borderRadius: "50%",
          zIndex: 5,
        },
        [
          b({
            position: "absolute",
            top: "3px",
            left: "5px",
            width: "6px",
            height: "4px",
            background: "rgba(255,255,255,.55)",
            borderRadius: "50%",
          }),
        ]
      ),
    ];
  }
  if (animal === "owl") {
    const H = "#B98A52";
    return [
      b({
        position: "absolute",
        top: "4px",
        left: "34px",
        width: 0,
        height: 0,
        borderLeft: "14px solid transparent",
        borderRight: "10px solid transparent",
        borderBottom: "34px solid " + H,
        transform: "rotate(-22deg)",
        zIndex: 1,
      }),
      b({
        position: "absolute",
        top: "4px",
        right: "34px",
        width: 0,
        height: 0,
        borderLeft: "10px solid transparent",
        borderRight: "14px solid transparent",
        borderBottom: "34px solid " + H,
        transform: "rotate(22deg)",
        zIndex: 1,
      }),
      b({
        position: "absolute",
        top: "24px",
        left: "11px",
        width: "128px",
        height: "118px",
        background: H,
        borderRadius: "48% 48% 47% 47% / 47% 47% 53% 53%",
        zIndex: 2,
      }),
      b({
        position: "absolute",
        top: "38px",
        left: "20px",
        width: "110px",
        height: "80px",
        background: "#ECD6AC",
        border: "2px solid #AC8852",
        borderRadius: "48% 48% 46% 46% / 44% 44% 56% 56%",
        zIndex: 3,
      }),
    ];
  }
  if (animal === "horse") {
    const H = "#C29156",
      SN = "#E0BC8C",
      MANE = "#6E4628";
    return [
      b({
        position: "absolute",
        top: "8px",
        left: "42px",
        width: "20px",
        height: "40px",
        background: H,
        borderRadius: "50% 50% 45% 45% / 62% 62% 38% 38%",
        transform: "rotate(-16deg)",
        zIndex: 1,
      }),
      b({
        position: "absolute",
        top: "8px",
        right: "42px",
        width: "20px",
        height: "40px",
        background: H,
        borderRadius: "50% 50% 45% 45% / 62% 62% 38% 38%",
        transform: "rotate(16deg)",
        zIndex: 1,
      }),
      b({
        position: "absolute",
        top: "13px",
        left: "47px",
        width: "9px",
        height: "24px",
        background: "#E7C79B",
        borderRadius: "50%",
        transform: "rotate(-16deg)",
        zIndex: 2,
      }),
      b({
        position: "absolute",
        top: "13px",
        right: "47px",
        width: "9px",
        height: "24px",
        background: "#E7C79B",
        borderRadius: "50%",
        transform: "rotate(16deg)",
        zIndex: 2,
      }),
      b({
        position: "absolute",
        top: "30px",
        left: "38px",
        width: "18px",
        height: "40px",
        background: MANE,
        borderRadius: "60% 40% 50% 50%",
        transform: "rotate(-12deg)",
        zIndex: 1,
      }),
      b({
        position: "absolute",
        top: "30px",
        right: "38px",
        width: "18px",
        height: "40px",
        background: MANE,
        borderRadius: "40% 60% 50% 50%",
        transform: "rotate(12deg)",
        zIndex: 1,
      }),
      b({
        position: "absolute",
        top: "30px",
        left: "47px",
        width: "56px",
        height: "104px",
        background: H,
        borderRadius: "46% 46% 44% 44% / 34% 34% 66% 66%",
        zIndex: 2,
      }),
      b({
        position: "absolute",
        top: "106px",
        left: "43px",
        width: "64px",
        height: "44px",
        background: SN,
        borderRadius: "46% 46% 48% 48% / 36% 36% 64% 64%",
        zIndex: 3,
      }),
      b({
        position: "absolute",
        top: "20px",
        left: "62px",
        width: "26px",
        height: "30px",
        background: MANE,
        borderRadius: "50% 50% 60% 40% / 50% 50% 60% 40%",
        transform: "rotate(4deg)",
        zIndex: 4,
      }),
      b({
        position: "absolute",
        top: "44px",
        left: "69px",
        width: "12px",
        height: "80px",
        background: "#F3E7D0",
        borderRadius: "8px",
        zIndex: 4,
      }),
      b({
        position: "absolute",
        top: "126px",
        left: "55px",
        width: "9px",
        height: "12px",
        background: "#9A7142",
        borderRadius: "50%",
        zIndex: 5,
      }),
      b({
        position: "absolute",
        top: "126px",
        right: "55px",
        width: "9px",
        height: "12px",
        background: "#9A7142",
        borderRadius: "50%",
        zIndex: 5,
      }),
    ];
  }
  // fox (default)
  const H = "#E8915A",
    CH = "#FBEFDD";
  return [
    b({
      position: "absolute",
      top: "2px",
      left: "20px",
      width: 0,
      height: 0,
      borderLeft: "17px solid transparent",
      borderRight: "13px solid transparent",
      borderBottom: "54px solid " + H,
      transform: "rotate(-12deg)",
      zIndex: 1,
    }),
    b({
      position: "absolute",
      top: "2px",
      right: "20px",
      width: 0,
      height: 0,
      borderLeft: "13px solid transparent",
      borderRight: "17px solid transparent",
      borderBottom: "54px solid " + H,
      transform: "rotate(12deg)",
      zIndex: 1,
    }),
    b({
      position: "absolute",
      top: "4px",
      left: "26px",
      width: 0,
      height: 0,
      borderLeft: "9px solid transparent",
      borderRight: "7px solid transparent",
      borderBottom: "26px solid #2E2620",
      transform: "rotate(-12deg)",
      zIndex: 2,
    }),
    b({
      position: "absolute",
      top: "4px",
      right: "26px",
      width: 0,
      height: 0,
      borderLeft: "7px solid transparent",
      borderRight: "9px solid transparent",
      borderBottom: "26px solid #2E2620",
      transform: "rotate(12deg)",
      zIndex: 2,
    }),
    b({
      position: "absolute",
      top: "38px",
      left: "25px",
      width: "100px",
      height: "88px",
      background: H,
      borderRadius: "48% 48% 50% 50% / 40% 40% 76% 76%",
      zIndex: 2,
    }),
    b({
      position: "absolute",
      top: "82px",
      left: "10px",
      width: 0,
      height: 0,
      borderTop: "9px solid transparent",
      borderBottom: "9px solid transparent",
      borderRight: "20px solid " + H,
      transform: "rotate(-18deg)",
      zIndex: 1,
    }),
    b({
      position: "absolute",
      top: "82px",
      right: "10px",
      width: 0,
      height: 0,
      borderTop: "9px solid transparent",
      borderBottom: "9px solid transparent",
      borderLeft: "20px solid " + H,
      transform: "rotate(18deg)",
      zIndex: 1,
    }),
    b({
      position: "absolute",
      top: "62px",
      left: "40px",
      width: "70px",
      height: "82px",
      background: CH,
      borderRadius: "50% 50% 50% 50% / 34% 34% 92% 92%",
      zIndex: 3,
    }),
    b({
      position: "absolute",
      top: "44px",
      left: "66px",
      width: "18px",
      height: "26px",
      background: CH,
      borderRadius: "50% 50% 0 0",
      zIndex: 3,
    }),
    b({
      position: "absolute",
      top: "104px",
      left: "68px",
      width: 0,
      height: 0,
      borderLeft: "7px solid transparent",
      borderRight: "7px solid transparent",
      borderTop: "10px solid #3A2E26",
      zIndex: 5,
    }),
  ];
}

interface FaceOpts {
  confetti?: boolean;
  bob?: boolean;
}

function faceEl(
  animal: AnimalKey,
  stage: Stage,
  opts: FaceOpts,
  catColor: string,
  accentColor: string
): React.ReactElement {
  const withConfetti = opts.confetti !== false;
  const withBob = opts.bob !== false;
  // Render-local key counters — created per render, never module-level.
  let k = 0;
  const kc: KeyCounter = { sk: 0 };
  const b: DivBuilder = (style, kids) => C("div", { key: "k" + k++, style }, kids);
  const a = anchor(animal);
  const parts: React.ReactNode[] = base(b, animal, catColor);
  if (stage >= 3) parts.push(...blush(b, a));
  parts.push(...eyes(kc, b, stage, a));
  parts.push(...(animal === "owl" ? owlBeak(b, stage) : mouth(kc, b, stage, a)));
  parts.push(...acc(b, stage, animal, accentColor));
  if (withConfetti && stage >= 6) parts.push(...confetti(b));
  const innerStyle: React.CSSProperties = { position: "absolute", inset: 0 };
  if (withBob) innerStyle.animation = "mons-bob 3.4s ease-in-out infinite";
  const inner = C("div", { key: "inner", style: innerStyle }, parts);
  return C(
    "div",
    { key: animal + stage, style: { position: "relative", width: "150px", height: "162px" } },
    [inner]
  );
}

export interface MascotFaceProps {
  animal: AnimalKey;
  stage: Stage;
  confetti?: boolean;
  bob?: boolean;
  /** Cat head fill (was this.props.catColor). */
  catColor?: string;
  /** Bowtie color (was this.props.accentColor). */
  accentColor?: string;
}

/**
 * Pure parametric mascot face. No state, no hooks — safe in Server or
 * Client Components. Relies on the `mons-bob` keyframe (defined in
 * app/globals.css) when `bob` is true.
 */
export default function MascotFace({
  animal,
  stage,
  confetti = true,
  bob = true,
  catColor = "#F4A35C",
  accentColor = "#F6A623",
}: MascotFaceProps): React.ReactElement {
  return faceEl(animal, stage, { confetti, bob }, catColor, accentColor);
}
