// Pure domain layer for the seasonal reading-bingo feature.
//
// Mirrors the purity of lib/joy.ts: no React, no DOM, no copy import. Holds the
// STRUCTURAL season config (ids, date windows, emoji, feat order) plus the date
// + grid math. Localized feat titles/descriptions live in copy/da.json and are
// merged with this structural data in the store's computeDerived().

import type { SeasonId } from "@/lib/types";

/** A feat's structural definition: stable id + its emoji. Title/desc are in copy. */
export interface SeasonFeatDef {
  id: string;
  emoji: string;
}

/** A season: id + inclusive ISO date window + ordered feats (length = BOARD_SIZE). */
export interface SeasonDef {
  id: SeasonId;
  start: string; // ISO YYYY-MM-DD, inclusive
  end: string; // ISO YYYY-MM-DD, inclusive
  feats: SeasonFeatDef[];
}

/** Grid geometry. 3 across suits the mobile width; 5 rows → 15 tiles. */
export const COLS = 3;
export const ROWS = 5;
export const BOARD_SIZE = COLS * ROWS; // 15

/**
 * Provider-defined seasons. Launching a new season = add an entry here + its
 * copy block in copy/da.json, then deploy. Windows must not overlap (the first
 * matching window wins). Feat order is the on-screen order, row by row.
 */
export const SEASONS: SeasonDef[] = [
  {
    id: "sommer-26",
    start: "2026-06-01",
    end: "2026-08-31",
    feats: [
      { id: "ven", emoji: "👫" },
      { id: "natur", emoji: "🌳" },
      { id: "ferie", emoji: "✈️" },
      { id: "liggende", emoji: "🛋️" },
      { id: "blad", emoji: "📰" },
      { id: "sprog", emoji: "🌍" },
      { id: "digt", emoji: "🪶" },
      { id: "lydbog", emoji: "🎧" },
      { id: "solbriller", emoji: "🕶️" },
      { id: "kreativt", emoji: "🎨" },
      { id: "dyr", emoji: "🐶" },
      { id: "alene", emoji: "🧒" },
      { id: "hojt", emoji: "📣" },
      { id: "eventyr", emoji: "🧙" },
      { id: "strand", emoji: "🏖️" },
    ],
  },
];

/** Local-midnight Date from an ISO YYYY-MM-DD, or null if malformed. */
function parseISO(iso: string): Date | null {
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

/**
 * The season whose [start, end] window contains `today` (inclusive), else null.
 * Compares at local-midnight granularity so the boundary days are inside.
 */
export function activeSeason(seasons: SeasonDef[], today: Date): SeasonDef | null {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  for (const s of seasons) {
    const start = parseISO(s.start);
    const end = parseISO(s.end);
    if (!start || !end) continue;
    if (t >= start.getTime() && t <= end.getTime()) return s;
  }
  return null;
}

/** Horizontal row index groups (e.g. [[0,1,2],[3,4,5],...]) for a feat list. */
export function rowGroups(size: number): number[][] {
  const rows: number[][] = [];
  for (let r = 0; r < size; r += COLS) {
    rows.push(Array.from({ length: COLS }, (_, c) => r + c));
  }
  return rows;
}

/** True when every feat in the season is in the done-set. */
export function isBoardComplete(feats: SeasonFeatDef[], done: Set<string>): boolean {
  return feats.length > 0 && feats.every((f) => done.has(f.id));
}

/** Number of fully-completed horizontal rows for a given done-set. */
export function completedRowCount(feats: SeasonFeatDef[], done: Set<string>): number {
  return rowGroups(feats.length).filter((row) =>
    row.every((i) => feats[i] !== undefined && done.has(feats[i].id)),
  ).length;
}
