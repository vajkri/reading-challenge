// Progress math for the Læseudfordring reading challenge.
//
// Pure helpers — no React, no DOM, no side effects beyond reading the local
// clock inside deadlineInfo(). Faithfully reproduces the design-tool spec
// (Sommerlæsning.dc.html): _joy (~526–535), the progress ring constants and
// stroke-dashoffset in renderVals (~796–798), the pct computation (~767), and
// the deadline countdown (~853–868).

import type { Stage } from "@/lib/types";

/**
 * Map a completion percentage to a mascot happiness Stage (0–7).
 *
 * Mirrors the source `_joy(p)` thresholds verbatim, including the `>=101`
 * "konge" tier that sits one notch above the plain 100% celebration so that
 * over-achievers get the top crown. Callers decide whether challenge lifecycle
 * (none → 0, completed → 7) overrides this progress-driven value.
 */
export function joyForPct(pct: number): Stage {
  if (pct >= 101) return 7;
  if (pct >= 100) return 6;
  if (pct >= 90) return 5;
  if (pct >= 75) return 4;
  if (pct >= 50) return 3;
  if (pct >= 25) return 2;
  if (pct >= 10) return 1;
  return 0;
}

/**
 * Completion percentage = round(total / goal * 100).
 *
 * Guards against a zero/negative goal the same way the source does: it falls
 * back to a 1000-minute target (`safeGoal = goal > 0 ? goal : 1000`) rather
 * than dividing by zero. The result is NOT clamped — values can exceed 100,
 * which is what drives the `>=101` konge tier in joyForPct().
 */
export function pctFor(total: number, goal: number): number {
  const safeGoal = goal > 0 ? goal : 1000;
  return Math.round((total / safeGoal) * 100);
}

/**
 * Progress-ring geometry. `r` is the SVG circle radius (matches the prototype's
 * `<circle r="118">`) and `c` its circumference, used as the stroke-dasharray.
 */
export const RING = { r: 118, c: 2 * Math.PI * 118 } as const;

/**
 * stroke-dashoffset for the progress ring at a given percentage.
 *
 * `c * (1 - min(pct, 100) / 100)`: full circumference (empty ring) at 0%,
 * zero offset (full ring) at 100%+. pct is clamped to 100 here so the ring
 * never over-rotates even when pctFor() returns >100.
 */
export function ringOffset(pct: number): number {
  return RING.c * (1 - Math.min(pct, 100) / 100);
}

/** Whole-day countdown bucket for the deadline banner. */
export type DeadlineKind = "future" | "oneDay" | "lastDay" | "expired";

export interface DeadlineInfo {
  /** Whole days between today (local midnight) and the deadline. */
  daysLeft: number;
  /** Bucket the caller maps to copy.progress.deadline labels. */
  kind: DeadlineKind;
}

/**
 * Compute the whole-days countdown to an ISO (YYYY-MM-DD) deadline.
 *
 * Returns null when the deadline is empty or malformed (anything that does not
 * split into exactly three numeric parts), matching the source guard.
 *
 * Day count uses the SAME rounding as the prototype: both the deadline and
 * "today" are constructed as local-time dates (the deadline at local midnight,
 * today truncated to local midnight), then `Math.round((end - today) / 86400000)`.
 * Rounding — rather than floor — keeps the result stable across the spring/fall
 * DST shift, where a calendar day spans 23 or 25 hours.
 *
 * Bucketing follows the source: >1 → future, ===1 → oneDay, ===0 → lastDay,
 * <0 → expired.
 */
export function deadlineInfo(deadlineISO: string): DeadlineInfo | null {
  if (!deadlineISO) return null;

  const parts = deadlineISO.split("-").map(Number);
  // Must be exactly [year, month, day], all parseable as numbers.
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;

  const [year, month, day] = parts;
  const end = new Date(year, month - 1, day);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const daysLeft = Math.round((end.getTime() - today.getTime()) / 86400000);

  let kind: DeadlineKind;
  if (daysLeft > 1) kind = "future";
  else if (daysLeft === 1) kind = "oneDay";
  else if (daysLeft === 0) kind = "lastDay";
  else kind = "expired";

  return { daysLeft, kind };
}
