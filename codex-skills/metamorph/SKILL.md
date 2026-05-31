---
name: metamorph
description: Analyze your coding habits and improve your agents, skills, and CLAUDE.md to match how you actually work. Interactive selection — you choose what to improve.
---

# /metamorph

Improve your agents, skills, and CLAUDE.md based on your real coding habits across Claude Code, Cursor, and Codex.

## Usage

```
/metamorph              # Interactive: stats → pick targets → generate diffs → accept
/metamorph --target ID  # Direct: improve a specific agent/skill immediately
/metamorph --status     # Warm-up progress and last analysis timestamp
```

---

You are the metamorph improvement orchestrator. **Speed and token efficiency are critical.**

Resolve the plugin root once (works in Cursor, Codex, and Claude Code):

```bash
MM="${CURSOR_PLUGIN_ROOT:-${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}}"
```

## Step 0 — Sync latest session data

Before showing stats, run analysis to pick up any new sessions:

```bash
node "$MM/dist/index.js" session-end
```

## Mode A — Full interactive (no --target)

**Step 1 — Stats (CLI only).**

```bash
node "$MM/dist/index.js" improve-stats
```

If output is `No session data yet`, stop.

If `--status`:

```bash
node "$MM/dist/index.js" improve-status
```

Stop after printing.

**Step 2 — Target tables (CLI only).**

```bash
node "$MM/dist/index.js" improve-targets
```

Print the CLI output verbatim, then ask:

```
Which targets to improve?
  • Space-separated IDs:    architect code-reviewer tdd-guide
  • Lowest-scoring N:       top 3  (or top 5, top 10, etc.)
  • Everything allowed:     all
  • Skip:                   none
```

Parse selection: agent/skill ids, `global`, `local`, `claudemd`; `top N` = N lowest scores; `all` = everything allowed.

Cap at `maxSuggestionsPerRun` from the CLI footer (default 3).

**Step 3 — Batch prepare (one command, one runId).**

```bash
node "$MM/dist/index.js" prepare-improve-batch id1 id2 id3
```

Parse JSON: `runId`, `prepared[]` (`id`, `contextPath`, `suggestionPath`), `skipped[]`.

**Step 4 — Parallel diff generation.**

Launch one diff subagent per prepared target (parallel, fast model):

```
Read only this context file and write diff + proposed file per its rules:
<contextPath from prepared[]>
```

**Step 5 — Show diffs.**

For each prepared target, read the `.diff` file at `suggestionPath`. Print:

```
── <id> (score if known) ──
<diff body or "no changes suggested">
```

**Step 6 — Accept.**

```
Accept which changes? "all" | IDs | "none"
```

For each accepted non-empty diff:

```bash
node "$MM/dist/index.js" improve-approve '<runId>-<id>'
```

Print backup path. On success: `To undo: run /metamorph-rollback --file <path>`

---

## Mode B — Direct target (--target <id>)

1. Run session-end sync (Step 0).
2. `prepare-improve-batch <id>` — parse JSON.
3. If skipped, print reason and stop.
4. One diff subagent with `contextPath`.
5. Read `.diff`, print, ask yes/no.
6. If yes: `improve-approve '<runId>-<id>'`.
