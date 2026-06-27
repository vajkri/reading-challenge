---
description: Pick up a feedback issue — issue-linked branch + worktree via scripts/pick-up-task.sh
argument-hint: "[issue-nr]"
allowed-tools: Bash(scripts/pick-up-task.sh:*)
---

Run the task pick-up helper for issue **#$ARGUMENTS** and report the worktree path it created.

!`scripts/pick-up-task.sh $ARGUMENTS`

If no issue number is given, the script falls back to an interactive picker over open `enhancement` issues.
