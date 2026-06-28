#!/usr/bin/env bash
#
# pick-up-task.sh — pick an open issue, create an issue-linked
# branch, and spin up a sibling git worktree ready to plan/implement.
#
# Usage:
#   scripts/pick-up-task.sh [issue-number]
#
# Label filter for the picker defaults to `enhancement`; override with
# PICKUP_LABEL=<label>. With no argument it lists matching open issues and lets you choose one
# (fzf if installed, otherwise a numbered menu). The worktree is created as a
# sibling dir: ../<repo>-<slug>. The branch is git-linked to the issue, so the
# PR you open later auto-links and (with "Closes #N" in the body) auto-closes it.

set -euo pipefail

LABEL="${PICKUP_LABEL:-enhancement}"
BASE="main"
BASE_REF="origin/${BASE}"

repo_root="$(git rev-parse --show-toplevel)"

# --- pick the issue -----------------------------------------------------------
issue="${1:-}"

if [[ -z "$issue" ]]; then
  list="$(gh issue list --label "$LABEL" --state open \
            --json number,title --jq '.[] | "\(.number)\t\(.title)"')"

  if [[ -z "$list" ]]; then
    echo "No open '$LABEL' issues. File some first: gh issue create --label $LABEL" >&2
    exit 1
  fi

  if command -v fzf >/dev/null 2>&1; then
    chosen="$(printf '%s\n' "$list" | fzf --prompt='feedback › ' --with-nth=1,2)"
  else
    echo "Open $LABEL issues:" >&2
    printf '%s\n' "$list" | awk -F'\t' '{printf "  %s  %s\n", $1, $2}' >&2
    printf 'Issue number: ' >&2
    read -r picked
    chosen="$(printf '%s\n' "$list" | awk -F'\t' -v n="$picked" '$1==n')"
  fi

  issue="$(printf '%s' "$chosen" | cut -f1)"
fi

[[ -n "$issue" ]] || { echo "No issue selected." >&2; exit 1; }

# --- derive a slug from the issue title --------------------------------------
title="$(gh issue view "$issue" --json title --jq .title)"
slug="$(printf '%s' "$title" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' \
  | cut -c1-40)"
branch="feat/${issue}-${slug}"
# Native EnterWorktree default location (gitignored). See .claude/rules/git-worktrees.md
worktree="${repo_root}/.claude/worktrees/${branch}"

# --- create issue-linked branch + worktree -----------------------------------
echo "→ issue #$issue: $title" >&2
echo "→ branch:   $branch" >&2
echo "→ worktree: $worktree" >&2

# Pull latest base so every new branch/worktree forks from the current tip.
git fetch origin "$BASE" >/dev/null 2>&1 || true

# gh issue develop creates a branch git-linked to the issue (no checkout here).
# Idempotent-ish: ignore failure if the linked branch already exists.
gh issue develop "$issue" --name "$branch" --base "$BASE" >/dev/null 2>&1 || true

# Make sure the branch exists locally before adding the worktree.
# Always fork from origin/main (just fetched) — never a stale local main.
git fetch origin "$branch" >/dev/null 2>&1 || true
if ! git show-ref --verify --quiet "refs/heads/$branch"; then
  git branch "$branch" "$BASE_REF" >/dev/null 2>&1 || true
fi

if [[ -d "$worktree" ]]; then
  echo "Worktree already exists: $worktree" >&2
else
  git worktree add "$worktree" "$branch"
fi

# .planning/ is gitignored (local-only). If it exists, symlink it so every
# worktree shares ONE workspace (single source of truth for plans/notes).
if [[ -d "$repo_root/.planning" && ! -e "$worktree/.planning" ]]; then
  ln -s "$repo_root/.planning" "$worktree/.planning"
  echo "→ linked .planning → $repo_root/.planning (shared workspace)" >&2
fi

echo >&2
echo "Ready. Next:" >&2
echo "  in-session: EnterWorktree path=$worktree" >&2
echo "  or shell:   cd $worktree" >&2
echo >&2
echo "Workflow — superpowers skills (always execute via subagents):" >&2
echo "  • No good feature spec on the issue?" >&2
echo "      brainstorming → writing-plans → subagent-driven-development" >&2
echo "  • Issue already has a good feature spec?  (skip brainstorming)" >&2
echo "      writing-plans → subagent-driven-development" >&2

# Print the path on stdout so you can:  cd \"\$(scripts/pick-up-task.sh 3)\"
printf '%s\n' "$worktree"
