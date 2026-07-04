# Agent Git Workflow Guide

This document captures the recommended git workflow for using local agents (Claude Code, Opencode, Cursor...) in this repo, so you don't lose changes or end up with a messy history.

---

## The Problem

Unlike GitHub Copilot (which shows a per-file inline diff _before_ applying changes), many agentic AI tools are CLI based — it can modify multiple files in one shot and the changes are already applied by the time you see them. This means you need a deliberate strategy to review and recover cleanly.

---

## Core Strategy: Snapshot Commits

Before every Opencode prompt, create a snapshot commit:

```bash
git add -A && git commit -m "wip: before opencode prompt"
```

This gives you a clean baseline to diff against, and a hard reset target if the output is bad.

---

## After Opencode Runs — 3 Scenarios

### ✅ Changes were good — commit properly

Soft reset the WIP commit (keeps all file changes, just undoes the commit):

```bash
git reset HEAD~1
git add -A && git commit -m "feat: your proper message here"
```

### 🔄 Still iterating — keep stacking WIPs

Don't worry about WIP commits mid-session. Just keep prompting and committing snapshots. When you're done, squash them all into one clean commit:

```bash
git rebase -i HEAD~3  # replace 3 with however many WIP commits you have
# In the editor: change "pick" to "squash" (or "s") for all but the first commit
```

### ❌ Changes were bad — hard reset

Nuke everything back to the last WIP snapshot:

```bash
git reset --hard HEAD
```

---

## Reviewing Changes

After Opencode runs, use VSCode's **Source Control tab** to review diffs file-by-file. Click any modified file for a side-by-side diff — the right-hand side is editable, so you can tweak inline before staging.

---

## Optional: Git Worktrees (for longer sessions)

Worktrees are useful when you want full isolation — e.g. keeping your Next.js dev server running while Opencode works in a separate branch:

```bash
# Create a new worktree on a fresh branch
git worktree add ../my-app-ai-session -b ai/feature-name

# Work in the AI worktree
cd ../my-app-ai-session
# run opencode here

# Review changes from your main worktree
git diff main..ai/feature-name

# Merge if happy, then clean up
git worktree remove ../my-app-ai-session
```

> **Note:** Worktrees are better for long feature sessions, not every single prompt. The overhead isn't worth it at the per-prompt level.

---

## Quick Reference

| Situation                           | Command                                                     |
| ----------------------------------- | ----------------------------------------------------------- |
| Before every Opencode prompt        | `git add -A && git commit -m "wip: before opencode prompt"` |
| Changes were good, commit properly  | `git reset HEAD~1` then `git add -A && git commit -m "..."` |
| Still iterating, squash WIPs later  | `git rebase -i HEAD~N`                                      |
| Changes were bad, start over        | `git reset --hard HEAD`                                     |
| Undo a commit, keep file changes    | `git reset HEAD~1`                                          |
| Undo a commit, discard file changes | `git reset --hard HEAD`                                     |

---

## Key Principle

You're on a feature branch anyway — messy WIP history doesn't matter until you open a PR. Don't stress about squashing mid-session. Do it once at the end with an interactive rebase before you merge.
