# Git worktrees (parallel AI agent sessions)

Parallel agent sessions run in isolated git worktrees so concurrent edits never collide.
The native Claude Code worktree tooling **is** the harness — prefer it over scripting around it.

> **Why this project differs from the generic worktree rule:** Læseudfordring is a static
> Next.js export with **no gitignored build inputs** — no `.env`, no certs, no generated client.
> A worktree builds and runs from tracked files alone, so there is **no env/secrets propagation**
> to manage and **no `.worktreeinclude`** in this harness.
>
> If a gitignored **`.planning/`** dir exists (local-only workspace for plans/notes), worktrees do
> not inherit it, so `scripts/pick-up-task.sh` **symlinks** it into each worktree — all sessions
> then share one workspace (single source of truth). Trade-off: avoid two worktrees writing to it
> *simultaneously*. One task at a time is fine.

## Creating a worktree

- **Fresh branch off the remote default** (most tasks): in a running session, ask Claude to "work
  in a worktree" → it uses the `EnterWorktree` tool. From the CLI: `claude --worktree <name>`.
  This branches off `origin/HEAD` and switches the session into the new worktree.
- **Issue-linked branch** (the feedback workflow): the GitHub issue↔branch link comes from
  `gh issue develop`, which the native tool can then adopt. Use `scripts/pick-up-task.sh`, or by hand:
  ```bash
  gh issue develop <N> --name feat/<N>-<slug> --base main          # create linked branch
  git worktree add .claude/worktrees/feat/<N>-<slug> feat/<N>-<slug>
  # then in-session: EnterWorktree with path=.claude/worktrees/feat/<N>-<slug>
  ```
  Raw `git worktree add` is acceptable here precisely because there is nothing to propagate.
- **Subagents that edit files in parallel:** pass `isolation: "worktree"` to the Agent tool.

## Location
- Worktrees live under `.claude/worktrees/` (the native default, gitignored). One session per worktree.

## Naming
- Worktree/branch name = GitHub issue number + short slug: `feat/<N>-<slug>`
  (e.g. `feat/12-mascot-blink-speed`). Embedding the issue number keeps the PR↔issue link obvious
  in `git log` and `git worktree list`.

## Base branch
- Default: branch from `origin/HEAD` (`main`) — `EnterWorktree`'s `fresh` baseRef does this. Start
  from the remote default, not a stale local branch.
- Only stack on in-progress, unpushed work (baseRef `head`) when a task genuinely depends on it —
  and say so.

## Cleanup
- `ExitWorktree` with `action: "keep"` (preserve work) or `"remove"` (clean exit). On session exit a
  worktree entered via `EnterWorktree` prompts keep/remove.
- `ExitWorktree` only manages worktrees it created this session — it will **not** remove one you made
  with `git worktree add` (it returns you to the original dir on `keep`). Remove those manually.
- Audit with `git worktree list`; prune with `git worktree remove <path>` (`--force` if dirty).

## Forbidden
- Sharing one worktree across two sessions (defeats isolation).
- A custom `WorktreeCreate` hook that re-implements creation — a hook *replaces* the default logic.
  This project doesn't need one; don't add it.

## Per-item flow (where worktrees fit)
Workflow uses **superpowers** skills, and execution **always runs through subagents**.
1. `gh issue list --label feedback` (or `enhancement`) — pick a task
2. `scripts/pick-up-task.sh <N>` — issue-linked branch + worktree under `.claude/worktrees/`
3. `EnterWorktree path=…`, then:
   - **No good feature spec on the issue** → `brainstorming` → `writing-plans` → `subagent-driven-development`
   - **Issue already has a good feature spec** → skip brainstorming → `writing-plans` → `subagent-driven-development`
4. Implement + verify gates (see `CLAUDE.md`); `verification-before-completion`, then `requesting-code-review`
5. `finishing-a-development-branch` → open the PR (body `Closes #<N>` → merging auto-closes the issue)
