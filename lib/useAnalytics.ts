"use client";

import { useEffect, useRef } from "react";
import type { Entry, ChallengeStatus, BingoState } from "@/lib/types";
import { SEASONS, activeSeason } from "@/lib/bingo";
import { track } from "@/lib/analytics";

// Only the slice of app state the analytics needs. `State` from the store
// satisfies this structurally, so the hook stays decoupled from the store.
interface AnalyticsState {
  hydrated: boolean;
  entries: Entry[];
  challenge: ChallengeStatus;
  goal: number;
  bingo: BingoState;
}

// Total completed bingo feats across all seasons.
function bingoCount(bingo: BingoState): number {
  return Object.values(bingo).reduce((n, ids) => n + ids.length, 0);
}

// Fires GA4 funnel/bingo events by watching state transitions. Kept out of the
// pure reducer (a side effect) and out of `actions` (whose useMemo([]) closures
// freeze INITIAL and can't read live state). Guarded by `hydrated` + a one-time
// baseline seed so loading saved data on startup never replays old events.
export function useAnalytics(state: AnalyticsState): void {
  const seeded = useRef(false);
  const prevLen = useRef(0);
  const prevChallenge = useRef<ChallengeStatus>("none");
  const prevBingo = useRef(0);

  useEffect(() => {
    if (!state.hydrated) return;

    const len = state.entries.length;
    const challenge = state.challenge;
    const bingo = bingoCount(state.bingo);

    // First hydrated pass: seed baselines, fire nothing.
    if (!seeded.current) {
      seeded.current = true;
      prevLen.current = len;
      prevChallenge.current = challenge;
      prevBingo.current = bingo;
      return;
    }

    // reading_logged — a NEW entry was prepended (edits leave length unchanged).
    if (len > prevLen.current) {
      track("reading_logged", { minutes: state.entries[0]?.minutes ?? 0 });
    }
    // challenge_started / challenge_completed — status transitions.
    if (prevChallenge.current !== "ongoing" && challenge === "ongoing") {
      track("challenge_started", { goal: state.goal });
    }
    if (prevChallenge.current !== "completed" && challenge === "completed") {
      track("challenge_completed");
    }
    // bingo_feat_completed — a feat was crossed off (count up only).
    if (bingo > prevBingo.current) {
      const season = activeSeason(SEASONS, new Date());
      track("bingo_feat_completed", season ? { season: season.id } : undefined);
    }

    prevLen.current = len;
    prevChallenge.current = challenge;
    prevBingo.current = bingo;
  }, [state]);
}
