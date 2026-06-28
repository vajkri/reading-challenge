"use client";

// Event-based confetti for the bingo board. Unlike ProgressScreen's steady-state
// burst, this mounts when `mode` flips to "row"/"board" (a feat-toggle that newly
// completes a row or the whole board) and the store clears it on a timer. CSS-only
// via the mons-fall keyframe; absolutely positioned, inert, aria-hidden.

const COLORS = ["#F6A623", "#7FC8A9", "#F39A8B", "#BBA7E0", "#FFCE52", "#5C8A3F"];

function pieces(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    left: ((i * 53 + 11) % 96) + "%",
    color: COLORS[i % COLORS.length],
    size: 8 + (i % 4) * 2,
    delay: ((i % 6) * 0.1).toFixed(2) + "s",
    dur: (1.3 + (i % 3) * 0.25).toFixed(2) + "s",
    round: i % 2 === 0,
  }));
}

const ROW_PIECES = pieces(14);
const BOARD_PIECES = pieces(28);

export default function BingoConfetti({ mode }: { mode: "none" | "row" | "board" }) {
  if (mode === "none") return null;
  const ps = mode === "board" ? BOARD_PIECES : ROW_PIECES;
  return (
    <div
      aria-hidden
      data-testid="bingo-confetti"
      data-mode={mode}
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
    >
      {ps.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: -16,
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.round ? "50%" : "2px",
            animation: `mons-fall ${p.dur} linear ${p.delay} 2 both`,
          }}
        />
      ))}
    </div>
  );
}
