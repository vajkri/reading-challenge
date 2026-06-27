---
name: add-issue
description: Use when the user wants to capture an idea, task, or bug that surfaced mid-session as a GitHub issue on this repo — "add an issue", "file an issue", "open a ticket", "capture this on GitHub", "remind me to". Opens a structured issue via gh so the thought is tracked without losing current context.
argument-hint: "[short description of the issue]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Capture an idea, task, or bug as a structured GitHub issue on this repo. Preserve enough context that someone picking it up cold (a future session, a teammate, or future you) understands it — without derailing the current task.
</objective>

<process>

<step name="check_gh">
Confirm the GitHub CLI is usable and resolve the repo. If either fails, stop and tell the user.

```bash
gh auth status >/dev/null 2>&1 || { echo "gh not authenticated — run: gh auth login"; exit 1; }
gh repo view --json nameWithOwner -q .nameWithOwner
```
</step>

<step name="extract_content">
**With arguments:** use them as the title/focus.
- `add-issue Add auth token refresh` → title = "Add auth token refresh"

**Without arguments:** analyze the recent conversation to extract:
- the specific problem, idea, or task discussed
- relevant file paths mentioned (with line numbers)
- technical details (error messages, constraints)

Formulate:
- `title` — 3–10 words, action verb preferred
- `problem` — what's wrong / why this is needed
- `solution` — approach hints, or "TBD" if just an idea
- `files` — relevant paths with line numbers
</step>

<step name="infer_label">
Pick a label that matches an existing one — never invent a near-duplicate. List the repo's labels and choose the best fit:

```bash
gh label list --limit 100 --json name,description -q '.[] | .name'
```

Default picks for this repo: `bug` (something broken), `enhancement` (new feature/idea), `documentation` (docs), `feedback` (user-reported). If nothing fits, create the issue with no label rather than guessing.
</step>

<step name="check_duplicates">
Search existing open issues for overlap with the title's key words:

```bash
gh issue list --state open --search "keyword1 OR keyword2" --json number,title,url
```

If a likely duplicate is found, read it (`gh issue view <number>`), compare scope, then ask via AskUserQuestion:
- header: "Duplicate?"
- question: "Similar issue exists: #[number] [title]. What do you want to do?"
- options: **Skip** (keep existing) · **Comment** (add new context to existing issue) · **Add anyway** (separate issue)

For **Comment**: `gh issue comment <number> --body "<new context>"` and stop.
</step>

<step name="create_issue">
Write the body to a temp file (avoids shell-quoting issues with multi-line markdown), then create the issue.

```bash
body_file=$(mktemp)
cat > "$body_file" <<'EOF'
## Problem

[Enough context for someone to understand this later — the why, not just the what.]

## Solution

[Approach hints, or "TBD".]

## Files

- [file:lines]
EOF

gh issue create \
  --title "<title>" \
  --body-file "$body_file" \
  --label "<label>"
rm -f "$body_file"
```

Omit the `## Files` section if there are no relevant files. Drop the `--label` flag if no existing label fit.
</step>

<step name="confirm">
Report concisely using the URL that `gh issue create` prints:

```
Issue created: [url]
  [title]
  Label: [label]
```

To start work on it in an isolated worktree, see `.claude/rules/git-worktrees.md` (`scripts/pick-up-task.sh <N>`).
</step>

</process>

<success_criteria>
- [ ] `gh` authenticated and repo resolved
- [ ] Issue created with a clear title and structured body
- [ ] Problem section has enough standalone context
- [ ] Duplicates checked and resolved
- [ ] Label reuses an existing repo label (or omitted)
</success_criteria>
