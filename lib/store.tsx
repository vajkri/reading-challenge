"use client";

// Central app state for Læseudfordring.
//
// This is the React reimplementation of the prototype's single `renderVals()` +
// `_method` handlers: a useReducer store (persisted slice + UI slice), with all
// derived values computed once in the provider and exposed via `useApp()`.
// Screen components stay almost purely presentational — they read `derived` and
// call `actions`.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type {
  ChallengeStatus,
  Entry,
  MascotKey,
  PersistedState,
  Stage,
} from "@/lib/types";
import {
  DEFAULTS,
  loadState,
  newId,
  saveBingo,
  saveChallenge,
  saveDeadline,
  saveEntries,
  saveGoal,
  saveLocked,
  saveMascot,
  saveName,
  totalMinutes,
} from "@/lib/storage";
import { joyForPct, pctFor, ringOffset, deadlineInfo } from "@/lib/joy";
import {
  SEASONS,
  activeSeason,
  isBoardComplete,
  completedRowCount,
} from "@/lib/bingo";
import { copy, interp, DATE_LOCALE } from "@/lib/copy";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type Screen = "progress" | "log" | "settings" | "bingo";

interface FormState {
  title: string;
  author: string;
  date: string; // ISO YYYY-MM-DD
  minutes: string; // kept as string so the input can be partially typed
}

interface UIState {
  screen: Screen;
  hydrated: boolean;
  // Læselog form
  formOpen: boolean;
  editId: string | null;
  confirmId: string | null;
  form: FormState;
  flashId: string | null; // entry that just got edited (green flash)
  // Transient bingo celebration: set on a feat-toggle that newly completes a
  // row/board, auto-cleared by a timer (NOT persisted). "board" outranks "row".
  bingoConfetti: "none" | "row" | "board";
  // Settings drafts — committed together by START_CHALLENGE / UPDATE_CHALLENGE
  goalDraft: string;
  nameDraft: string;
  deadlineDraft: string;
  mascotDraft: MascotKey;
  // Transient "editing a running challenge" session (NOT persisted → resets on refresh)
  editing: boolean;
  // Destructive "start a new challenge" confirm dialog
  newChallengeOpen: boolean;
  // Parental unlock modal
  unlockOpen: boolean;
  unlockInput: string;
  unlockError: boolean;
  uA: number;
  uB: number;
}

export type State = PersistedState & UIState;

const INITIAL: State = {
  ...DEFAULTS,
  screen: "progress",
  hydrated: false,
  formOpen: false,
  editId: null,
  confirmId: null,
  form: { title: "", author: "", date: "", minutes: "" },
  flashId: null,
  bingoConfetti: "none",
  goalDraft: String(DEFAULTS.goal),
  nameDraft: DEFAULTS.name,
  deadlineDraft: DEFAULTS.deadline,
  mascotDraft: DEFAULTS.mascot,
  editing: false,
  newChallengeOpen: false,
  unlockOpen: false,
  unlockInput: "",
  unlockError: false,
  uA: 3,
  uB: 4,
};

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

// When the challenge is "none", the Settings form seeds its drafts with these
// sensible defaults instead of the persisted DEFAULTS (goal 1000 / empty deadline).
// Drafts only — never persisted; the +N-day deadline is computed at seed time.
const NONE_DEFAULT_GOAL = 450;
const NONE_DEFAULT_DEADLINE_DAYS = 30;

/** Local-time `YYYY-MM-DD`, shifted `days` forward from today (zero-padded). */
function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function todayISO(): string {
  return isoPlusDays(0);
}

/**
 * Seed the Settings drafts. For a "none" challenge the form shows the fixed
 * new-challenge defaults (goal 450 / today+30 / "Max" / cat); otherwise it
 * mirrors the saved values so an ongoing/completed challenge shows its reals.
 * Drafts only — never persisted until START_CHALLENGE / UPDATE_CHALLENGE.
 */
function seedDrafts(
  challenge: ChallengeStatus,
  goal: number,
  deadline: string,
  name: string,
  mascot: MascotKey,
): { goalDraft: string; deadlineDraft: string; nameDraft: string; mascotDraft: MascotKey } {
  if (challenge === "none") {
    return {
      goalDraft: String(NONE_DEFAULT_GOAL),
      deadlineDraft: isoPlusDays(NONE_DEFAULT_DEADLINE_DAYS),
      nameDraft: DEFAULTS.name,
      mascotDraft: DEFAULTS.mascot,
    };
  }
  return {
    goalDraft: String(goal),
    deadlineDraft: deadline,
    nameDraft: name,
    mascotDraft: mascot,
  };
}

/** Danish short date, e.g. "27. jun". Empty for blank/invalid input. */
function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(DATE_LOCALE, { day: "numeric", month: "short" });
}

function bookKey(title: string, author: string): string {
  return `${title.trim().toLowerCase()}|${author.trim().toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Actions + reducer
// ---------------------------------------------------------------------------

type Action =
  | { type: "HYDRATE"; payload: PersistedState }
  | { type: "SET_SCREEN"; screen: Screen }
  | { type: "GO_SETTINGS" }
  | { type: "START_CHALLENGE" }
  | { type: "UPDATE_CHALLENGE" }
  | { type: "OPEN_NEW_CHALLENGE" }
  | { type: "CONFIRM_NEW_CHALLENGE" }
  | { type: "CLOSE_NEW_CHALLENGE" }
  | { type: "OPEN_ADD"; today: string }
  | { type: "OPEN_EDIT"; entry: Entry }
  | { type: "CLOSE_FORM" }
  | { type: "SET_FORM_FIELD"; field: keyof FormState; value: string }
  | { type: "SAVE_ENTRY"; id: string; now: number }
  | { type: "ASK_DELETE"; id: string }
  | { type: "CANCEL_DELETE" }
  | { type: "DELETE_ENTRY"; id: string }
  | { type: "PICK_RECENT"; title: string; author: string }
  | { type: "SET_GOAL_DRAFT"; value: string }
  | { type: "PRESET_GOAL"; value: string }
  | { type: "SET_NAME_DRAFT"; value: string }
  | { type: "SET_DEADLINE_DRAFT"; value: string }
  | { type: "PICK_MASCOT"; mascot: MascotKey }
  | { type: "OPEN_UNLOCK"; uA: number; uB: number }
  | { type: "SET_UNLOCK_INPUT"; value: string }
  | { type: "SUBMIT_UNLOCK"; nextA: number; nextB: number }
  | { type: "CLOSE_UNLOCK" }
  | { type: "CLEAR_FLASH" }
  | { type: "TOGGLE_FEAT"; seasonId: string; featId: string }
  | { type: "CLEAR_BINGO_CONFETTI" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return {
        ...state,
        ...action.payload,
        hydrated: true,
        ...seedDrafts(
          action.payload.challenge,
          action.payload.goal,
          action.payload.deadline,
          action.payload.name,
          action.payload.mascot,
        ),
      };

    case "SET_SCREEN":
      // Any navigation ends a transient edit session (re-locks the running challenge).
      return { ...state, screen: action.screen, editing: false };

    case "GO_SETTINGS":
      // Entering Settings always starts locked; seed drafts from current values
      // (or the none-defaults when there is no challenge).
      return {
        ...state,
        screen: "settings",
        editing: false,
        ...seedDrafts(state.challenge, state.goal, state.deadline, state.name, state.mascot),
      };

    case "START_CHALLENGE": {
      // Commit all drafts, start the challenge, go to Fremgang. (No lock toggle:
      // an ongoing challenge is locked by default; editing is a transient session.)
      const parsed = Math.round(Number(state.goalDraft));
      const goal = parsed >= 1 ? parsed : state.goal;
      const name = state.nameDraft.trim() || state.name;
      return {
        ...state,
        goal,
        name,
        deadline: state.deadlineDraft,
        mascot: state.mascotDraft,
        challenge: "ongoing",
        editing: false,
        screen: "progress",
      };
    }

    case "UPDATE_CHALLENGE": {
      // Commit edits to a running challenge, then re-lock and stay on Settings.
      const parsed = Math.round(Number(state.goalDraft));
      const goal = parsed >= 1 ? parsed : state.goal;
      const name = state.nameDraft.trim() || state.name;
      // Edge case: lowering the goal below the logged total auto-completes it.
      let challenge: ChallengeStatus = state.challenge;
      let screen: Screen = state.screen;
      if (state.challenge === "ongoing" && totalMinutes(state.entries) >= goal) {
        challenge = "completed";
        screen = "progress";
      }
      return {
        ...state,
        goal,
        name,
        deadline: state.deadlineDraft,
        mascot: state.mascotDraft,
        challenge,
        screen,
        editing: false,
      };
    }

    case "OPEN_NEW_CHALLENGE":
      return { ...state, newChallengeOpen: true };

    case "CLOSE_NEW_CHALLENGE":
      return { ...state, newChallengeOpen: false };

    case "CONFIRM_NEW_CHALLENGE":
      // Destructive reset: wipe the log + reset persisted config to fresh-install
      // defaults, then drop into the open `none` setup (drafts = none-defaults).
      return {
        ...state,
        entries: [],
        goal: DEFAULTS.goal,
        name: DEFAULTS.name,
        deadline: DEFAULTS.deadline,
        mascot: DEFAULTS.mascot,
        locked: false,
        challenge: "none",
        editing: false,
        newChallengeOpen: false,
        screen: "settings",
        ...seedDrafts("none", DEFAULTS.goal, DEFAULTS.deadline, DEFAULTS.name, DEFAULTS.mascot),
      };

    case "OPEN_ADD":
      return {
        ...state,
        formOpen: true,
        editId: null,
        confirmId: null,
        form: { title: "", author: "", date: action.today, minutes: "" },
      };

    case "OPEN_EDIT":
      return {
        ...state,
        formOpen: true,
        editId: action.entry.id,
        confirmId: null,
        form: {
          title: action.entry.title,
          author: action.entry.author,
          date: action.entry.date,
          minutes: String(action.entry.minutes),
        },
      };

    case "CLOSE_FORM":
      return { ...state, formOpen: false, editId: null };

    case "SET_FORM_FIELD":
      return { ...state, form: { ...state.form, [action.field]: action.value } };

    case "SAVE_ENTRY": {
      const title = state.form.title.trim();
      const minutes = Math.round(Number(state.form.minutes)) || 0;
      if (!title || minutes <= 0) return state; // invalid → no-op (button is dimmed)

      const author = state.form.author.trim();
      const date = state.form.date || todayISO();

      let entries: Entry[];
      let flashId: string | null;
      if (state.editId) {
        entries = state.entries.map((e) =>
          e.id === state.editId ? { ...e, title, author, date, minutes } : e,
        );
        flashId = state.editId; // edited card flashes green
      } else {
        const entry: Entry = {
          id: action.id,
          title,
          author,
          date,
          minutes,
          created: action.now,
        };
        entries = [entry, ...state.entries];
        flashId = null; // adds do not flash
      }

      // Auto-complete an ongoing challenge whose new total reaches the goal.
      let challenge: ChallengeStatus = state.challenge;
      let screen: Screen = state.screen;
      if (state.challenge === "ongoing" && totalMinutes(entries) >= state.goal) {
        challenge = "completed";
        screen = "progress";
      }

      return {
        ...state,
        entries,
        challenge,
        screen,
        formOpen: false,
        editId: null,
        confirmId: null,
        flashId,
      };
    }

    case "ASK_DELETE":
      return { ...state, confirmId: action.id };

    case "CANCEL_DELETE":
      return { ...state, confirmId: null };

    case "DELETE_ENTRY":
      return {
        ...state,
        entries: state.entries.filter((e) => e.id !== action.id),
        confirmId: null,
      };

    case "PICK_RECENT":
      return {
        ...state,
        form: { ...state.form, title: action.title, author: action.author },
      };

    case "SET_GOAL_DRAFT":
      return { ...state, goalDraft: action.value };

    case "PRESET_GOAL":
      return { ...state, goalDraft: action.value };

    case "SET_NAME_DRAFT":
      return { ...state, nameDraft: action.value };

    case "SET_DEADLINE_DRAFT":
      return { ...state, deadlineDraft: action.value };

    case "PICK_MASCOT":
      return { ...state, mascotDraft: action.mascot };

    case "OPEN_UNLOCK":
      return {
        ...state,
        unlockOpen: true,
        unlockInput: "",
        unlockError: false,
        uA: action.uA,
        uB: action.uB,
      };

    case "SET_UNLOCK_INPUT":
      return { ...state, unlockInput: action.value, unlockError: false };

    case "SUBMIT_UNLOCK":
      if (Number(state.unlockInput) === state.uA + state.uB) {
        // Correct → open a transient edit session and close the gate.
        return { ...state, editing: true, unlockOpen: false, unlockError: false };
      }
      // Wrong → flash error and regenerate the sum.
      return {
        ...state,
        unlockError: true,
        unlockInput: "",
        uA: action.nextA,
        uB: action.nextB,
      };

    case "CLOSE_UNLOCK":
      return { ...state, unlockOpen: false };

    case "CLEAR_FLASH":
      return { ...state, flashId: null };

    case "TOGGLE_FEAT": {
      const season = SEASONS.find((s) => s.id === action.seasonId);
      if (!season) return state;

      const prev = state.bingo[action.seasonId] ?? [];
      const wasDone = prev.includes(action.featId);
      const next = wasDone
        ? prev.filter((id) => id !== action.featId)
        : [...prev, action.featId];
      const bingo = { ...state.bingo, [action.seasonId]: next };

      // Confetti only when COMPLETING (not undoing) and a new row/board lands.
      let bingoConfetti = state.bingoConfetti;
      if (!wasDone) {
        const before = new Set(prev);
        const after = new Set(next);
        const boardNew = isBoardComplete(season.feats, after) && !isBoardComplete(season.feats, before);
        const rowNew = completedRowCount(season.feats, after) > completedRowCount(season.feats, before);
        if (boardNew) bingoConfetti = "board";
        else if (rowNew) bingoConfetti = "row";
      }

      return { ...state, bingo, bingoConfetti };
    }

    case "CLEAR_BINGO_CONFETTI":
      return { ...state, bingoConfetti: "none" };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Derived values (the rest of renderVals())
// ---------------------------------------------------------------------------

export interface BingoFeatView {
  id: string;
  emoji: string;
  card: string; // single-word card label
  title: string; // full feat title (modal)
  desc: string; // one-sentence description (modal)
  done: boolean;
}

export interface BingoView {
  active: boolean; // a season window contains today
  seasonId: string | null;
  seasonName: string;
  feats: BingoFeatView[];
  doneCount: number;
  boardComplete: boolean;
  confetti: "none" | "row" | "board";
}

export interface RecentBook {
  title: string;
  author: string;
  byline: string;
  highlighted: boolean; // matches the form's current title+author
}

export interface EntryView {
  entry: Entry;
  byline: string;
  dateLabel: string;
  confirming: boolean;
  editing: boolean;
  flashing: boolean;
}

// copy.bingo.seasons is keyed by season id; index it through a Record cast
// because the JSON-inferred type only knows the literal "sommer-26" key.
interface FeatCopy { card: string; title: string; desc: string }
interface SeasonCopy { name: string; feats: Record<string, FeatCopy> }

export interface Derived {
  total: number;
  pct: number;
  status: ChallengeStatus;
  isNone: boolean;
  isOngoing: boolean;
  isCompleted: boolean;
  challengeStarted: boolean;
  joy: Stage;
  ringOffset: number;
  caption: string;
  startSub: string;
  doneSub: string;
  showConfetti: boolean;
  recentBooks: RecentBook[];
  hasRecentBooks: boolean;
  viewEntries: EntryView[];
  noEntries: boolean;
  bookCount: number;
  bookWord: string;
  valid: boolean;
  showDeadline: boolean;
  deadlineLabel: string;
  // lock gating
  effLocked: boolean;
  lockedPE: "none" | "auto";
  lockedOpacity: number;
  // settings mode
  showEditBanner: boolean; // ongoing + locked → "edit it?" + Rediger udfordring
  showDoneBanner: boolean; // completed → "🎉 complete" + Start ny udfordring
  isEditing: boolean;      // ongoing + unlocked session → show Opdater udfordring
  bingo: BingoView;
}

function computeDerived(state: State): Derived {
  const total = totalMinutes(state.entries);
  const pct = pctFor(total, state.goal);
  const status = state.challenge;
  const isNone = status === "none";
  const isOngoing = status === "ongoing";
  const isCompleted = status === "completed";
  const challengeStarted = status !== "none";

  // Mascot joy: none → gloomy (0), completed → crown (7), else progress-driven.
  const joy: Stage = isNone ? 0 : isCompleted ? 7 : joyForPct(pct);

  const nm = state.name;
  const caption = interp(copy.progress.captions[joy], { name: nm });
  const startSub = interp(copy.progress.startSub, { name: nm });
  const doneSub = interp(copy.progress.doneSub, { name: nm });

  // Newest-first: date desc, then created desc as tiebreaker.
  const sorted = [...state.entries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.created - a.created;
  });

  const curKey = bookKey(state.form.title, state.form.author);
  const byline = (author: string) =>
    author.trim()
      ? `${copy.log.bylinePrefix} ${author.trim()}`
      : copy.log.unknownAuthor;

  const viewEntries: EntryView[] = sorted.map((entry) => ({
    entry,
    byline: byline(entry.author),
    dateLabel: fmtDate(entry.date),
    confirming: entry.id === state.confirmId,
    editing: entry.id === state.editId,
    flashing: entry.id === state.flashId,
  }));

  // Recent books for quick-pick: dedupe by title|author, skip empty titles, cap 8.
  const seen = new Set<string>();
  const recentBooks: RecentBook[] = [];
  for (const { entry } of viewEntries) {
    if (!entry.title.trim()) continue;
    const key = bookKey(entry.title, entry.author);
    if (seen.has(key)) continue;
    seen.add(key);
    recentBooks.push({
      title: entry.title,
      author: entry.author,
      byline: byline(entry.author),
      highlighted: key === curKey,
    });
    if (recentBooks.length >= 8) break;
  }

  // Distinct books read (for the completed stat card).
  const bookKeys = new Set<string>();
  for (const e of state.entries) {
    if (e.title.trim()) bookKeys.add(bookKey(e.title, e.author));
  }
  const bookCount = bookKeys.size;
  const bookWord = bookCount === 1 ? copy.progress.bookSingular : copy.progress.bookPlural;

  const validTitle = state.form.title.trim().length > 0;
  const valid = validTitle && Number(state.form.minutes) > 0;

  // Deadline countdown — only while the challenge is ongoing.
  const di = deadlineInfo(state.deadline);
  const showDeadline = isOngoing && di !== null;
  let deadlineLabel = "";
  if (di) {
    const dl = copy.progress.deadline;
    deadlineLabel =
      di.kind === "future"
        ? interp(dl.daysLeft, { count: di.daysLeft })
        : di.kind === "oneDay"
          ? dl.oneDay
          : di.kind === "lastDay"
            ? dl.lastDay
            : dl.expired;
  }

  const isEditing = isOngoing && state.editing;
  // Cards are dimmed + inert whenever a challenge exists and we're not editing.
  const effLocked = (isOngoing && !state.editing) || isCompleted;
  const showEditBanner = isOngoing && !state.editing;
  const showDoneBanner = isCompleted;

  // ---- Bingo (standalone; independent of the challenge lifecycle) ----
  const season = activeSeason(SEASONS, new Date());
  let bingo: BingoView;
  if (!season) {
    bingo = {
      active: false,
      seasonId: null,
      seasonName: "",
      feats: [],
      doneCount: 0,
      boardComplete: false,
      confetti: state.bingoConfetti,
    };
  } else {
    const doneIds = new Set(state.bingo[season.id] ?? []);
    const seasonsCopy = copy.bingo.seasons as unknown as Record<string, SeasonCopy>;
    const sc = seasonsCopy[season.id];
    if (!sc) {
      // A future season is in SEASONS but its copy block is missing from
      // da.json — fall back to the teaser shape instead of crashing every render.
      bingo = {
        active: false,
        seasonId: null,
        seasonName: "",
        feats: [],
        doneCount: 0,
        boardComplete: false,
        confetti: state.bingoConfetti,
      };
    } else {
      // Skip a feat whose copy entry is missing (e.g. a future season adds a feat
      // id to SEASONS but not yet to copy/da.json) rather than crashing the screen.
      const feats: BingoFeatView[] = season.feats.flatMap((f) => {
        const fc = sc.feats[f.id];
        if (!fc) return [];
        return [
          {
            id: f.id,
            emoji: f.emoji,
            card: fc.card,
            title: fc.title,
            desc: fc.desc,
            done: doneIds.has(f.id),
          },
        ];
      });
      bingo = {
        active: true,
        seasonId: season.id,
        seasonName: sc.name,
        feats,
        doneCount: doneIds.size,
        boardComplete: isBoardComplete(season.feats, doneIds),
        confetti: state.bingoConfetti,
      };
    }
  }

  return {
    total,
    pct,
    status,
    isNone,
    isOngoing,
    isCompleted,
    challengeStarted,
    joy,
    ringOffset: ringOffset(pct),
    caption,
    startSub,
    doneSub,
    showConfetti: joy >= 6,
    recentBooks,
    hasRecentBooks: recentBooks.length > 0,
    viewEntries,
    noEntries: state.entries.length === 0 && !state.formOpen,
    bookCount,
    bookWord,
    valid,
    showDeadline,
    deadlineLabel,
    effLocked,
    lockedPE: effLocked ? "none" : "auto",
    lockedOpacity: effLocked ? 0.5 : 1,
    showEditBanner,
    showDoneBanner,
    isEditing,
    bingo,
  };
}

// ---------------------------------------------------------------------------
// Actions (bound) + context
// ---------------------------------------------------------------------------

export interface Actions {
  goProgress: () => void;
  goLog: () => void;
  goSettings: () => void;
  goBingo: () => void;
  toggleFeat: (featId: string) => void;
  startChallenge: () => void;
  updateChallenge: () => void;
  requestNewChallenge: () => void;
  confirmNewChallenge: () => void;
  cancelNewChallenge: () => void;
  openAdd: () => void;
  openEdit: (entry: Entry) => void;
  closeForm: () => void;
  setFormField: (field: keyof FormState, value: string) => void;
  saveEntry: () => void;
  askDelete: (id: string) => void;
  cancelDelete: () => void;
  deleteEntry: (id: string) => void;
  pickRecent: (title: string, author: string) => void;
  setGoalDraft: (value: string) => void;
  presetGoal: (value: string) => void;
  setNameDraft: (value: string) => void;
  setDeadlineDraft: (value: string) => void;
  pickMascot: (mascot: MascotKey) => void;
  openUnlock: () => void;
  setUnlockInput: (value: string) => void;
  submitUnlock: () => void;
  closeUnlock: () => void;
}

interface AppContextValue {
  state: State;
  derived: Derived;
  actions: Actions;
}

const AppContext = createContext<AppContextValue | null>(null);

const rnd = () => 2 + Math.floor(Math.random() * 8); // unlock operand, 2–9

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  // Hydrate from localStorage once on the client (runs the challenge migration).
  useEffect(() => {
    dispatch({ type: "HYDRATE", payload: loadState() });
  }, []);

  // Persist each slice when it changes (after hydration, so we never clobber
  // stored data with the SSR defaults on first paint).
  useEffect(() => {
    if (state.hydrated) saveEntries(state.entries);
  }, [state.entries, state.hydrated]);
  useEffect(() => {
    if (state.hydrated) saveGoal(state.goal);
  }, [state.goal, state.hydrated]);
  useEffect(() => {
    if (state.hydrated) saveName(state.name);
  }, [state.name, state.hydrated]);
  useEffect(() => {
    if (state.hydrated) saveDeadline(state.deadline);
  }, [state.deadline, state.hydrated]);
  useEffect(() => {
    if (state.hydrated) saveLocked(state.locked);
  }, [state.locked, state.hydrated]);
  useEffect(() => {
    if (state.hydrated) saveChallenge(state.challenge);
  }, [state.challenge, state.hydrated]);
  useEffect(() => {
    if (state.hydrated) saveMascot(state.mascot);
  }, [state.mascot, state.hydrated]);
  useEffect(() => {
    if (state.hydrated) saveBingo(state.bingo);
  }, [state.bingo, state.hydrated]);

  // Auto-clear the edited-entry green flash (~1.5s).
  useEffect(() => {
    if (!state.flashId) return;
    const t = setTimeout(() => dispatch({ type: "CLEAR_FLASH" }), 1500);
    return () => clearTimeout(t);
  }, [state.flashId]);

  // Auto-clear the bingo row/board confetti after its run (~3.5s, covering the
  // ~3.6s two-iteration mons-fall burst so it isn't cut off mid-fall).
  useEffect(() => {
    if (state.bingoConfetti === "none") return;
    const t = setTimeout(() => dispatch({ type: "CLEAR_BINGO_CONFETTI" }), 3500);
    return () => clearTimeout(t);
  }, [state.bingoConfetti]);

  const actions = useMemo<Actions>(
    () => ({
      goProgress: () => dispatch({ type: "SET_SCREEN", screen: "progress" }),
      goLog: () => dispatch({ type: "SET_SCREEN", screen: "log" }),
      goSettings: () => dispatch({ type: "GO_SETTINGS" }),
      goBingo: () => dispatch({ type: "SET_SCREEN", screen: "bingo" }),
      toggleFeat: (featId) => {
        const s = activeSeason(SEASONS, new Date());
        if (s) dispatch({ type: "TOGGLE_FEAT", seasonId: s.id, featId });
      },
      startChallenge: () => dispatch({ type: "START_CHALLENGE" }),
      updateChallenge: () => dispatch({ type: "UPDATE_CHALLENGE" }),
      requestNewChallenge: () => dispatch({ type: "OPEN_NEW_CHALLENGE" }),
      confirmNewChallenge: () => dispatch({ type: "CONFIRM_NEW_CHALLENGE" }),
      cancelNewChallenge: () => dispatch({ type: "CLOSE_NEW_CHALLENGE" }),
      openAdd: () => dispatch({ type: "OPEN_ADD", today: todayISO() }),
      openEdit: (entry) => dispatch({ type: "OPEN_EDIT", entry }),
      closeForm: () => dispatch({ type: "CLOSE_FORM" }),
      setFormField: (field, value) => dispatch({ type: "SET_FORM_FIELD", field, value }),
      saveEntry: () => dispatch({ type: "SAVE_ENTRY", id: newId(), now: Date.now() }),
      askDelete: (id) => dispatch({ type: "ASK_DELETE", id }),
      cancelDelete: () => dispatch({ type: "CANCEL_DELETE" }),
      deleteEntry: (id) => dispatch({ type: "DELETE_ENTRY", id }),
      pickRecent: (title, author) => dispatch({ type: "PICK_RECENT", title, author }),
      setGoalDraft: (value) => dispatch({ type: "SET_GOAL_DRAFT", value }),
      presetGoal: (value) => dispatch({ type: "PRESET_GOAL", value }),
      setNameDraft: (value) => dispatch({ type: "SET_NAME_DRAFT", value }),
      setDeadlineDraft: (value) => dispatch({ type: "SET_DEADLINE_DRAFT", value }),
      pickMascot: (mascot) => dispatch({ type: "PICK_MASCOT", mascot }),
      openUnlock: () => dispatch({ type: "OPEN_UNLOCK", uA: rnd(), uB: rnd() }),
      setUnlockInput: (value) => dispatch({ type: "SET_UNLOCK_INPUT", value }),
      submitUnlock: () => dispatch({ type: "SUBMIT_UNLOCK", nextA: rnd(), nextB: rnd() }),
      closeUnlock: () => dispatch({ type: "CLOSE_UNLOCK" }),
    }),
    [],
  );

  const derived = useMemo(() => computeDerived(state), [state]);

  const value = useMemo<AppContextValue>(
    () => ({ state, derived, actions }),
    [state, derived, actions],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
