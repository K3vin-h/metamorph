---
name: metamorph
description: Analyze your coding habits and improve your agents, skills, and CLAUDE.md to match how you actually work. Interactive selection — you choose what to improve.
---

# /metamorph

Improve your agents, skills, and CLAUDE.md based on your real coding habits across Claude Code, Cursor, and Codex.

## Usage

```
/metamorph              # Interactive: actionable targets → diffs → accept
/metamorph --target ID  # Direct: skip tables; improve one target (token-efficient)
/metamorph --status     # Warm-up + recommended target IDs
```

**Token tip:** Prefer `--target` when you know the agent/skill. Never-invoked targets are auto-skipped in batch mode.

---

Resolve the plugin root once:

```bash
MM="${CURSOR_PLUGIN_ROOT:-${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}}"
```

## Step 0 — Sync latest session data

```bash
node "$MM/dist/index.js" session-end
```

## Mode A — Full interactive (no --target)

**Step 1 — Stats**

```bash
node "$MM/dist/index.js" improve-stats
```

If `--status`: `node "$MM/dist/index.js" improve-status` (includes recommended IDs).

**Step 2 — Actionable targets only**

```bash
node "$MM/dist/index.js" improve-targets-actionable
```

Ask user to pick from recommended list only (`top 3`, IDs, or `none`).

**Step 3 — Batch prepare**

```bash
node "$MM/dist/index.js" prepare-improve-batch id1 id2 id3
```

Skipped never-invoked targets need `--target <id>` or `prepare-improve-batch --force <id>`.

**Step 4 — Parallel diff subagents** (one per prepared target, fast model).

**Step 5 — Show diffs, accept** via `improve-approve '<runId>-<id>'`.

## Mode B — Direct target (--target <id>) — preferred

1. `prepare-improve-batch <id>` — always allows explicit target.
2. One diff subagent, show diff, approve or reject.

---
