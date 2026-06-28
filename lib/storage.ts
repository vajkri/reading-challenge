// localStorage data layer for the Læseudfordring app.
//
// Mirrors the persistence behaviour of the original design-tool prototype
// (Sommerlæsning.dc.html): seven discrete keys, each with its own encoding,
// plus the one-time challenge-status migration that runs on load.
//
// Everything here is SSR-safe: during static export / server render there is
// no `window`, so reads return DEFAULTS and writes are no-ops.

import type {
  PersistedState,
  Entry,
  MascotKey,
  ChallengeStatus,
  BingoState,
} from "@/lib/types";

/**
 * The seven localStorage keys, verbatim from the prototype.
 *
 * DO NOT rename — these strings are the on-disk contract. Renaming any of them
 * silently abandons a real kid's saved progress (it would read as "first run").
 */
export const KEYS = {
  entries: "sommerlaesning.v1.entries",
  goal: "sommerlaesning.v1.goal",
  name: "sommerlaesning.v1.name",
  deadline: "sommerlaesning.v1.deadline",
  locked: "sommerlaesning.v1.locked",
  challenge: "sommerlaesning.v1.challenge",
  mascot: "sommerlaesning.v1.mascot",
  bingo: "sommerlaesning.v1.bingo",
} as const;

/**
 * Fresh-install state. Matches the prototype's initial `this.state` defaults:
 * goal 1000, name "Max", mascot "cat", challenge "none", unlocked, no deadline,
 * no entries.
 */
export const DEFAULTS: PersistedState = {
  entries: [],
  goal: 1000,
  name: "Max",
  deadline: "",
  locked: false,
  challenge: "none",
  mascot: "cat",
  bingo: {},
};

// ---------------------------------------------------------------------------
// Decode helpers
// ---------------------------------------------------------------------------

const MASCOTS: readonly MascotKey[] = ["cat", "dog"];
const CHALLENGES: readonly ChallengeStatus[] = ["none", "ongoing", "completed"];

function isMascot(v: string): v is MascotKey {
  return (MASCOTS as readonly string[]).includes(v);
}

function isChallenge(v: string): v is ChallengeStatus {
  return (CHALLENGES as readonly string[]).includes(v);
}

/** Sum of entry minutes — tolerant of non-numeric values, exactly like the prototype. */
export function totalMinutes(entries: Entry[]): number {
  return entries.reduce((s, e) => s + (Number(e.minutes) || 0), 0);
}

/**
 * id scheme copied verbatim from the prototype's `_saveEntry`:
 * a base-36 timestamp plus 4 base-36 random chars.
 */
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

/**
 * Read the full persisted slice from localStorage, decoding each key per its
 * stored format and falling back to DEFAULTS on any missing/corrupt value.
 *
 * Also runs the challenge-status migration (see `migrate`), persisting any
 * derived value back to storage so subsequent loads are stable.
 *
 * SSR-safe: returns DEFAULTS when there is no `window`.
 */
export function loadState(): PersistedState {
  if (typeof window === "undefined") return { ...DEFAULTS };

  // entries — JSON, guard corrupt → []
  let entries: Entry[] = [];
  try {
    const raw = window.localStorage.getItem(KEYS.entries);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      entries = Array.isArray(parsed) ? (parsed as Entry[]) : [];
    }
  } catch {
    entries = [];
  }

  // goal — Number(string); only adopt a positive value, else default
  let goal = DEFAULTS.goal;
  try {
    const g = window.localStorage.getItem(KEYS.goal);
    if (g != null && g !== "") {
      const n = Number(g);
      if (n > 0) goal = n;
    }
  } catch {
    goal = DEFAULTS.goal;
  }

  // name — raw string; blank/whitespace falls back to default
  let name = DEFAULTS.name;
  try {
    const n = window.localStorage.getItem(KEYS.name);
    if (n != null && n.trim() !== "") name = n;
  } catch {
    name = DEFAULTS.name;
  }

  // deadline — raw string ("" allowed)
  let deadline = DEFAULTS.deadline;
  try {
    const dl = window.localStorage.getItem(KEYS.deadline);
    if (dl != null) deadline = dl;
  } catch {
    deadline = DEFAULTS.deadline;
  }

  // locked — "1" => true, anything else => false
  let locked = DEFAULTS.locked;
  try {
    locked = window.localStorage.getItem(KEYS.locked) === "1";
  } catch {
    locked = DEFAULTS.locked;
  }

  // mascot — raw string validated against the union
  let mascot = DEFAULTS.mascot;
  try {
    const ms = window.localStorage.getItem(KEYS.mascot);
    if (ms && isMascot(ms)) mascot = ms;
  } catch {
    mascot = DEFAULTS.mascot;
  }

  // bingo — JSON object { seasonId: string[] }, guard corrupt → {}
  let bingo: BingoState = {};
  try {
    const raw = window.localStorage.getItem(KEYS.bingo);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        bingo = parsed as BingoState;
      }
    }
  } catch {
    bingo = {};
  }

  // challenge — raw string validated against the union.
  // `null` here means "key absent", which the migration step needs to detect.
  let challenge: ChallengeStatus | null = null;
  try {
    const c = window.localStorage.getItem(KEYS.challenge);
    if (c && isChallenge(c)) challenge = c;
  } catch {
    challenge = null;
  }

  return migrate({ entries, goal, name, deadline, locked, mascot, challenge, bingo });
}

/**
 * Challenge-status migration, mirroring the prototype's `componentDidMount`.
 *
 * Takes the decoded values plus `challenge` as `null` when the key was ABSENT
 * in storage (vs. an explicit stored value). Two rules, both of which persist
 * their result:
 *
 *   1. Key absent → "ongoing" if the user already has entries or a parental
 *      lock (an existing pre-challenge user), else "none". Persist it.
 *   2. An "ongoing" challenge whose logged minutes already meet the goal →
 *      "completed". Persist it.
 *
 * Caller guarantees `window` exists (only invoked from `loadState`), so the
 * persistence writes here are safe.
 */
function migrate(decoded: {
  entries: Entry[];
  goal: number;
  name: string;
  deadline: string;
  locked: boolean;
  mascot: MascotKey;
  challenge: ChallengeStatus | null;
  bingo: BingoState;
}): PersistedState {
  const { entries, goal, name, deadline, locked, mascot, bingo } = decoded;
  let challenge = decoded.challenge;

  // Rule 1: derive status for existing users when the key was never written.
  if (challenge == null) {
    challenge = entries.length > 0 || locked ? "ongoing" : "none";
    saveChallenge(challenge);
  }

  // Rule 2: auto-complete an ongoing challenge that already met its goal.
  if (challenge === "ongoing" && totalMinutes(entries) >= goal) {
    challenge = "completed";
    saveChallenge(challenge);
  }

  return { entries, goal, name, deadline, locked, challenge, mascot, bingo };
}

// ---------------------------------------------------------------------------
// Per-key savers
//
// Each is SSR-guarded and uses the same encoding the prototype wrote with.
// Failures (e.g. private-mode quota errors) are swallowed, matching the
// prototype's try/catch-and-ignore behaviour.
// ---------------------------------------------------------------------------

export function saveEntries(entries: Entry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYS.entries, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

export function saveGoal(goal: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYS.goal, String(goal));
  } catch {
    // ignore
  }
}

export function saveName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYS.name, name);
  } catch {
    // ignore
  }
}

export function saveDeadline(deadline: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYS.deadline, deadline);
  } catch {
    // ignore
  }
}

export function saveLocked(locked: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYS.locked, locked ? "1" : "0");
  } catch {
    // ignore
  }
}

export function saveChallenge(challenge: ChallengeStatus): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYS.challenge, challenge);
  } catch {
    // ignore
  }
}

export function saveMascot(mascot: MascotKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYS.mascot, mascot);
  } catch {
    // ignore
  }
}

export function saveBingo(bingo: BingoState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYS.bingo, JSON.stringify(bingo));
  } catch {
    // ignore
  }
}
