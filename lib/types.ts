// Shared type contract for the app. All substrate modules code against these.

/** Animals the parametric renderer can draw. v1 only *surfaces* cat + dog. */
export type AnimalKey = "cat" | "dog" | "owl" | "horse" | "fox";

/** Mascots offered to the user in v1 (Settings picker). */
export type MascotKey = "cat" | "dog";

/** Happiness stage 0–7 (sad → konge). Output of joyForPct(). */
export type Stage = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Challenge lifecycle. */
export type ChallengeStatus = "none" | "ongoing" | "completed";

/** A single reading-log entry. */
export interface Entry {
  id: string;
  title: string;
  author: string;
  date: string; // ISO YYYY-MM-DD (the reading date)
  minutes: number;
  created: number; // epoch ms — stable tiebreaker for sorting newest-first
}

/** Identifier for a bingo season (e.g. "sommer-26"). */
export type SeasonId = string;

/**
 * Completed bingo feats, keyed by season id → list of completed feat ids.
 * Per-season so each season keeps a fresh board without losing prior crosses.
 */
export type BingoState = Record<SeasonId, string[]>;

/** The persisted slice — one field per localStorage key. */
export interface PersistedState {
  entries: Entry[];
  goal: number; // target minutes
  name: string; // mascot display name (default "Max")
  deadline: string; // ISO YYYY-MM-DD or ""
  locked: boolean; // parental lock
  challenge: ChallengeStatus;
  mascot: MascotKey;
  bingo: BingoState; // per-season completed feat ids
}
