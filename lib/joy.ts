// Progress math for the Læseudfordring reading challenge.
//
// Pure helpers — no React, no DOM, no side effects beyond reading the local
// clock inside deadlineInfo(). Reproduces the design-tool spec
// (Sommerlæsning.dc.html): the progress ring constants and stroke-dashoffset
// in renderVals (~796–798), the pct computation (~767), and the deadline
// countdown (~853–868). joyForPct intentionally retunes the prototype's _joy
// thresholds for engagement (issue #16) — see its docstring.

import type { Stage } from "@/lib/types";

/**
 * Map a completion percentage to a mascot happiness Stage (0–7).
 *
 * Front-loaded ramp (issue #16): the cutoffs 5/15/30/50/75/100/101 react sooner
 * than the prototype's verbatim 10/25/50/75/90 so the first reading session
 * visibly wakes the mascot. The `>=101` "konge" tier sits one notch above the
 * plain 100% celebration so over-achievers get the top crown; stages 6 (100%)
 * and 7 stay pinned to the 100% caption. Callers decide whether challenge
 * lifecycle (none → 0, completed → 7) overrides this progress-driven value.
 */
export function joyForPct(pct: number): Stage {
  if (pct >= 101) return 7;
  if (pct >= 100) return 6;
  if (pct >= 75) return 5;
  if (pct >= 50) return 4;
  if (pct >= 30) return 3;
  if (pct >= 15) return 2;
  if (pct >= 5) return 1;
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

// ---------------------------------------------------------------------------
// Reading-goal slider + effort model (issue #23)
//
// The Læsemål slider spans a fixed minute range in 50-minute steps. "Effort" is
// NOT a property of the total — it is minutes/day = goal ÷ days-left-to-deadline,
// bucketed into three bands. Because the bands are per-day, their position on the
// minute axis depends on the deadline and shifts/collapses as it lengthens.
// ---------------------------------------------------------------------------

/** Inclusive slider bounds + step, in total minutes. */
export const GOAL_MIN = 200;
export const GOAL_MAX = 750;
export const GOAL_STEP = 50;

/** Effort band keys (also the copy keys under settings.goal.effort). */
export type EffortKey = "lille" | "mellem" | "stor";

/** Clamp any goal into the slider's [GOAL_MIN, GOAL_MAX] range. */
export function clampGoal(goal: number): number {
  return Math.max(GOAL_MIN, Math.min(GOAL_MAX, goal));
}

/**
 * Minutes-per-day to hit `goal` by the deadline. `daysLeft` is floored to 1 so a
 * same-day / missing deadline never divides by zero (it then reports the whole
 * goal as one day's effort). Rounded to whole minutes to match the band cutoffs.
 */
export function minutesPerDay(goal: number, daysLeft: number): number {
  return Math.round(goal / Math.max(1, daysLeft));
}

/** Bucket minutes-per-day into an effort band: 0–10 lille, 11–20 mellem, 21+ stor. */
export function effortFor(minPerDay: number): EffortKey {
  if (minPerDay <= 10) return "lille";
  if (minPerDay <= 20) return "mellem";
  return "stor";
}

/**
 * Track fractions (0–1) of the two band boundaries for a given deadline, used to
 * tint the slider track and place the zone labels. The lille/mellem edge sits at
 * 10.5·days minutes and the mellem/stor edge at 20.5·days (the round() midpoints of
 * the 10/11 and 20/21 cutoffs), mapped onto [GOAL_MIN, GOAL_MAX] and clamped.
 * A boundary past the track end clamps to 1 → that zone disappears (expected at
 * long deadlines, where every goal is "Let").
 */
export function effortZones(daysLeft: number): { p1: number; p2: number } {
  const d = Math.max(1, daysLeft);
  const frac = (minutes: number) =>
    Math.max(0, Math.min(1, (minutes - GOAL_MIN) / (GOAL_MAX - GOAL_MIN)));
  return { p1: frac(10.5 * d), p2: frac(20.5 * d) };
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
