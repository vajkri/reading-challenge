# HANDOFF — Issue #3: About page + "Buy me a coffee" (restart implementation)

**Purpose:** Everything a fresh session needs to restart the **implementation phase**
(subagent-driven) for issue #3 from the committed spec + plan. Brainstorming and
planning are DONE. No implementation code has landed on the feature branch yet.

**Last updated:** 2026-07-11

---

## TL;DR — do these in order

1. **FIRST, clean up polluted local `main`** (see §4). This must run from the
   **main checkout**, not the worktree. It restores the user's uncommitted
   install-prompt work and removes stray #3 commits. *Nothing is lost.*
2. Work in the **worktree** `feat/3-add-buy-me-a-coffee-support-button` (see §2).
3. Commit the one pending spec edit (§3), then run **subagent-driven-development**
   over the plan (§5), **redoing Task 1 from scratch** (its earlier attempt was
   broken and never reached this branch).
4. Obey the **gotchas** in §6 or you will repeat the failure.

---

## 1. Status at a glance

| Item | State |
|------|-------|
| Spec | ✅ committed — `docs/superpowers/specs/2026-07-05-about-page-and-support-design.md` |
| Plan | ✅ committed — `docs/superpowers/plans/2026-07-05-about-page-and-support.md` |
| Spec URL edit | ⚠️ **uncommitted** in worktree (trivial; commit it — see §3) |
| Task 1 (foundations) | ❌ **not on this branch** — earlier attempt was broken + landed on `main`. Redo from scratch. |
| Tasks 2–5 | ❌ not started |
| Local `main` | ❌ **polluted** with 2 stray commits (see §4) — clean before/independently |
| Execution mode | **Subagent-Driven** (user standing preference — do not ask which mode) |

---

## 2. Where to work

- **Worktree (build here):**
  `/Users/krisztinavajda/dev/reading-challenge/.claude/worktrees/feat/3-add-buy-me-a-coffee-support-button`
- **Branch:** `feat/3-add-buy-me-a-coffee-support-button` (based on `origin/main` = `b205762`)
- **Worktree HEAD:** `a7db499` (plan doc). Clean except the pending spec edit.
- The session should be **git-isolated to the worktree** (git ops targeting the
  shared checkout are refused). This is the guardrail that prevents recurrence of
  the §4 mess — keep it. Run all git/build/test commands from the worktree path.

---

## 3. Pending trivial commit (worktree)

The spec's `SUPPORT_URL` was finalized to the real handle but not committed:

```bash
cd /Users/krisztinavajda/dev/reading-challenge/.claude/worktrees/feat/3-add-buy-me-a-coffee-support-button
git add docs/superpowers/specs/2026-07-05-about-page-and-support-design.md
git commit -m "docs(#3): set real Buy Me a Coffee URL in spec"
```

Support URL (final): `https://buymeacoffee.com/kriszta.vajda`

---

## 4. Clean up polluted `main` (RUN FROM THE MAIN CHECKOUT)

**What happened:** In an earlier session, after a resume, some `Bash` git commands
and a Task-1 subagent ran in the **main checkout** (`~/dev/reading-challenge`, on
branch `main`) instead of the worktree. Two stray commits landed on local `main`:

| Commit | Message claims | Actually contains |
|--------|----------------|-------------------|
| `0d6800a` | "set Buy Me a Coffee URL in spec" | **User's uncommitted PWA install-prompt work** (`components/InstallPrompt.tsx`, `lib/useInstallPrompt.ts`, edits to `AppShell.tsx`, `SettingsScreen.tsx`, `copy/da.json`) — swept up by a stray `git add -A`. **Real work — preserve it.** |
| `f848aab` | Task 1 (#3) | About copy + `lib/links.ts`, **plus a BROKEN `lib/analytics.ts`** — the file was *recreated* with a bogus `trackEvent()`, destroying the real GA4 `track()` seam. **Discard entirely.** |

- `origin/main` = `b205762` (clean). Local `main` = `6c2eb86 → 0d6800a → f848aab` (diverged, never pushed).
- Nothing is lost: install-prompt files still exist on disk; `0d6800a` stays in reflog as backup.

**Recovery (from the MAIN checkout — a worktree-isolated session cannot do this):**

```bash
cd /Users/krisztinavajda/dev/reading-challenge      # main checkout, branch main
git status                                           # confirm clean tree at f848aab
git reset --soft 6c2eb86                             # un-commit both stray commits; changes staged
git restore --staged .                               # unstage everything
rm -f lib/links.ts                                   # remove Task-1 artifact
git checkout -- lib/analytics.ts                     # restore the REAL track() seam (discard bogus trackEvent)
```

Then strip **only** the two `about` additions from `main`'s `copy/da.json`
(keep the user's install-prompt copy):
- remove the top-level `"about": { ... }` block, and
- remove the `"about": "Om appen",` line inside `"settings"`.

Result: `main` back at `6c2eb86` with **only the user's install-prompt work,
uncommitted** — exactly as it was at the start. Do **not** force-push or alter
`origin/main`. Leave whether to fast-forward `main` to `origin/main` (b205762) to
the user.

> If the user prefers, this cleanup can be skipped for now and done by them later —
> it does not block building #3 in the worktree. But flag it; a broken
> `analytics.ts` sitting on local `main` is a landmine.

---

## 5. Restart implementation (subagent-driven)

Invoke `superpowers:subagent-driven-development` and execute the plan
`docs/superpowers/plans/2026-07-05-about-page-and-support.md` task-by-task.
Per-task: dispatch implementer → spec-compliance review → code-quality review →
fix loops → next task. Fresh subagent per task; paste full task text into each
(don't make subagents read the plan file).

**Task list (all still TODO on this branch):**

| Task | Summary | Files |
|------|---------|-------|
| 1 | Foundations: `about` copy block + `settings.about`; create `lib/links.ts` (`SUPPORT_URL`); add `"support_click"` to the `EventName` union | `copy/da.json`, `lib/links.ts`, `lib/analytics.ts` |
| 2 | About screen + header ⓘ entry: `Screen` union `+"about"`, `goAbout()` action, `components/AboutScreen.tsx`, wire `AppShell` (render + header button), `e2e/about.spec.ts` | store, AboutScreen, AppShell, e2e |
| 3 | Settings "Om appen" row → `goAbout()` | `SettingsScreen.tsx`, e2e |
| 4 | Analytics coverage: `nav_screen(about)` + `support_click` (gtag stub, abort buymeacoffee network) | `e2e/about.spec.ts` |
| 5 | Verification gates: `tsc`, `eslint`, `build`, `test:e2e`, confirm no `storage.ts` changes | — |

Task 1's exact code is in the plan. **Key correction vs the earlier broken attempt:**
Task 1 must **MODIFY the existing `lib/analytics.ts`** — only append `"support_click"`
to the `EventName` union. It must **NOT** recreate the file and must keep the
existing `track()` function and GA4 seam intact.

After all tasks: dispatch a final full-diff code review, then
`superpowers:finishing-a-development-branch` → open PR with `Closes #3`.

---

## 6. Gotchas (the failure was caused by ignoring these)

1. **All git/build/test commands must run inside the worktree.** The earlier
   contamination happened because commands ran in the main checkout. Keep the
   session git-isolated to the worktree; keep every subagent working there too.
   Pass the worktree path explicitly to subagents and have them `cd` to it +
   `git rev-parse --show-toplevel` to confirm before committing.
2. **`npm run test:e2e` does NOT build.** It runs against `./out`. Always
   `npm run build` first or you test a stale export.
3. **No hardcoded Danish.** Every user-facing string via `copy/da.json` + `@/lib/copy`.
4. **Never rename/alter `sommerlaesning.v1.*` keys** in `lib/storage.ts`. About
   adds **no** persisted state (pure view) — no `storage.ts` change, no hydration guard.
5. **`analytics.ts` = MODIFY, not recreate** (see §5).
6. **Language switcher is OUT of scope** for #3 — the header is only *laid out* to
   seat it later (its own issue). Do not build it.

---

## 7. Verification gates (must be green before PR)

```bash
cd /Users/krisztinavajda/dev/reading-challenge/.claude/worktrees/feat/3-add-buy-me-a-coffee-support-button
npx tsc --noEmit && npx eslint .
npm run build
npm run test:e2e
```

---

## 8. Design decisions already locked (context for reviewers)

- Coffee CTA lives on a **single About page** (story + one CTA) — no scattered
  buttons, no popups, no completion-screen link. Reciprocity + a human story is
  the motivator.
- Reached via **header ⓘ icon** (visible everywhere, no nav-tab added) **and** a
  **Settings "Om appen" row**. Bottom nav stays at its deliberate 4 tabs.
- Platform: **Buy Me a Coffee**, `https://buymeacoffee.com/kriszta.vajda`.
- Full rationale in the spec (§ Information architecture).
