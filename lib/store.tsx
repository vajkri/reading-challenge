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
import { copy, interp, DATE_LOCALE } from "@/lib/copy";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type Screen = "progress" | "log" | "settings";

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
  // Settings drafts + "✓ gemt" flash flags
  goalDraft: string;
  nameDraft: string;
  deadlineDraft: string;
  goalSaved: boolean;
  nameSaved: boolean;
  deadlineSaved: boolean;
  mascotSaved: boolean;
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
  goalDraft: String(DEFAULTS.goal),
  nameDraft: DEFAULTS.name,
  deadlineDraft: DEFAULTS.deadline,
  goalSaved: false,
  nameSaved: false,
  deadlineSaved: false,
  mascotSaved: false,
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
 * Seed the Settings goal/deadline drafts. When the challenge is "none" the form
 * pre-fills the none-defaults (450 / today+30); otherwise it mirrors the saved
 * goal/deadline so an ongoing/completed challenge shows its real values.
 */
function seedDrafts(
  challenge: ChallengeStatus,
  goal: number,
  deadline: string,
): { goalDraft: string; deadlineDraft: string } {
  if (challenge === "none") {
    return {
      goalDraft: String(NONE_DEFAULT_GOAL),
      deadlineDraft: isoPlusDays(NONE_DEFAULT_DEADLINE_DAYS),
    };
  }
  return { goalDraft: String(goal), deadlineDraft: deadline };
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
  | { type: "NEW_CHALLENGE" }
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
  | { type: "SAVE_GOAL" }
  | { type: "SET_NAME_DRAFT"; value: string }
  | { type: "SAVE_NAME" }
  | { type: "SET_DEADLINE_DRAFT"; value: string }
  | { type: "SAVE_DEADLINE" }
  | { type: "PICK_MASCOT"; mascot: MascotKey }
  | { type: "LOCK" }
  | { type: "OPEN_UNLOCK"; uA: number; uB: number }
  | { type: "SET_UNLOCK_INPUT"; value: string }
  | { type: "SUBMIT_UNLOCK"; nextA: number; nextB: number }
  | { type: "CLOSE_UNLOCK" }
  | { type: "CLEAR_FLASH"; which: "goal" | "name" | "deadline" | "mascot" | "entry" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return {
        ...state,
        ...action.payload,
        hydrated: true,
        ...seedDrafts(action.payload.challenge, action.payload.goal, action.payload.deadline),
        nameDraft: action.payload.name,
      };

    case "SET_SCREEN":
      return { ...state, screen: action.screen };

    case "GO_SETTINGS":
      return {
        ...state,
        screen: "settings",
        ...seedDrafts(state.challenge, state.goal, state.deadline),
        nameDraft: state.name,
        goalSaved: false,
        nameSaved: false,
        deadlineSaved: false,
        mascotSaved: false,
      };

    case "START_CHALLENGE": {
      // Commit the Settings drafts, start the challenge, auto-lock, go to Fremgang.
      const parsed = Math.round(Number(state.goalDraft));
      const goal = parsed >= 1 ? parsed : state.goal;
      const name = state.nameDraft.trim() || state.name;
      return {
        ...state,
        goal,
        name,
        deadline: state.deadlineDraft,
        challenge: "ongoing",
        locked: true,
        screen: "progress",
        goalSaved: false,
        nameSaved: false,
        deadlineSaved: false,
      };
    }

    case "NEW_CHALLENGE":
      // Non-destructive: entries/minutes are kept (cumulative). Reopen Settings.
      return {
        ...state,
        challenge: "none",
        locked: false,
        screen: "settings",
        ...seedDrafts("none", state.goal, state.deadline),
        nameDraft: state.name,
        goalSaved: false,
        nameSaved: false,
        deadlineSaved: false,
        mascotSaved: false,
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
      return { ...state, goalDraft: action.value, goalSaved: false };

    case "PRESET_GOAL":
      return { ...state, goalDraft: action.value, goalSaved: false };

    case "SAVE_GOAL": {
      const goal = Math.max(1, Math.round(Number(state.goalDraft) || 0));
      return { ...state, goal, goalSaved: true };
    }

    case "SET_NAME_DRAFT":
      return { ...state, nameDraft: action.value, nameSaved: false };

    case "SAVE_NAME": {
      const name = state.nameDraft.trim() || state.name;
      return { ...state, name, nameSaved: true };
    }

    case "SET_DEADLINE_DRAFT":
      return { ...state, deadlineDraft: action.value, deadlineSaved: false };

    case "SAVE_DEADLINE":
      return { ...state, deadline: state.deadlineDraft, deadlineSaved: true };

    case "PICK_MASCOT":
      return { ...state, mascot: action.mascot, mascotSaved: true };

    case "LOCK":
      return { ...state, locked: true };

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
        return { ...state, locked: false, unlockOpen: false, unlockError: false };
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
      switch (action.which) {
        case "goal":
          return { ...state, goalSaved: false };
        case "name":
          return { ...state, nameSaved: false };
        case "deadline":
          return { ...state, deadlineSaved: false };
        case "mascot":
          return { ...state, mascotSaved: false };
        case "entry":
          return { ...state, flashId: null };
      }
      return state;

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Derived values (the rest of renderVals())
// ---------------------------------------------------------------------------

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
  unlocked: boolean;
  lockedPE: "none" | "auto";
  lockedOpacity: number;
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

  const effLocked = challengeStarted && state.locked;
  const unlocked = challengeStarted && !state.locked;

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
    unlocked,
    lockedPE: effLocked ? "none" : "auto",
    lockedOpacity: effLocked ? 0.5 : 1,
  };
}

// ---------------------------------------------------------------------------
// Actions (bound) + context
// ---------------------------------------------------------------------------

export interface Actions {
  goProgress: () => void;
  goLog: () => void;
  goSettings: () => void;
  startChallenge: () => void;
  newChallenge: () => void;
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
  saveGoal: () => void;
  setNameDraft: (value: string) => void;
  saveName: () => void;
  setDeadlineDraft: (value: string) => void;
  saveDeadline: () => void;
  pickMascot: (mascot: MascotKey) => void;
  lock: () => void;
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

  // Auto-clear the "✓ gemt" flashes (~2.2s) and the edited-entry flash (~1.5s).
  useEffect(() => {
    if (!state.mascotSaved) return;
    const t = setTimeout(() => dispatch({ type: "CLEAR_FLASH", which: "mascot" }), 2200);
    return () => clearTimeout(t);
  }, [state.mascotSaved]);
  useEffect(() => {
    if (!state.nameSaved) return;
    const t = setTimeout(() => dispatch({ type: "CLEAR_FLASH", which: "name" }), 2200);
    return () => clearTimeout(t);
  }, [state.nameSaved]);
  useEffect(() => {
    if (!state.goalSaved) return;
    const t = setTimeout(() => dispatch({ type: "CLEAR_FLASH", which: "goal" }), 2200);
    return () => clearTimeout(t);
  }, [state.goalSaved]);
  useEffect(() => {
    if (!state.deadlineSaved) return;
    const t = setTimeout(() => dispatch({ type: "CLEAR_FLASH", which: "deadline" }), 2200);
    return () => clearTimeout(t);
  }, [state.deadlineSaved]);
  useEffect(() => {
    if (!state.flashId) return;
    const t = setTimeout(() => dispatch({ type: "CLEAR_FLASH", which: "entry" }), 1500);
    return () => clearTimeout(t);
  }, [state.flashId]);

  const actions = useMemo<Actions>(
    () => ({
      goProgress: () => dispatch({ type: "SET_SCREEN", screen: "progress" }),
      goLog: () => dispatch({ type: "SET_SCREEN", screen: "log" }),
      goSettings: () => dispatch({ type: "GO_SETTINGS" }),
      startChallenge: () => dispatch({ type: "START_CHALLENGE" }),
      newChallenge: () => dispatch({ type: "NEW_CHALLENGE" }),
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
      saveGoal: () => dispatch({ type: "SAVE_GOAL" }),
      setNameDraft: (value) => dispatch({ type: "SET_NAME_DRAFT", value }),
      saveName: () => dispatch({ type: "SAVE_NAME" }),
      setDeadlineDraft: (value) => dispatch({ type: "SET_DEADLINE_DRAFT", value }),
      saveDeadline: () => dispatch({ type: "SAVE_DEADLINE" }),
      pickMascot: (mascot) => dispatch({ type: "PICK_MASCOT", mascot }),
      lock: () => dispatch({ type: "LOCK" }),
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
