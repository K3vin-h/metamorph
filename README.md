# metamorph

**Version 1.2.7**

metamorph is a **local-first AI-agent observability and improvement tool** for **Claude Code**, **Cursor**, and **Codex**. It observes how you actually use your **agents**, **skills**, and **CLAUDE.md** files, builds a text **dashboard** that scores each target, and proposes small file edits as **diffs** you review. Suggest-only with one-level rollback, no telemetry, and tokens spent only when you ask for an improvement.

**Local-first & private:** observation, scoring, and the dashboard run entirely on your machine — no network calls, no telemetry. See [docs/privacy-model.md](docs/privacy-model.md).

**Suggest-only by design:** metamorph never auto-applies edits. You review every diff first, every applied change is backed up, and `/metamorph-rollback` undoes it.

**Runtime-only repo:** `main` contains the files users install and run, plus `tests/` and CI that validate the shipped `dist/` artifact. TypeScript source, source maps, and build-only files are intentionally not shipped in this branch.

**Documentation:**

- [docs/architecture.md](docs/architecture.md) — two-layer design and data flow
- [docs/scoring-model.md](docs/scoring-model.md) — how scores and flags are computed
- [docs/privacy-model.md](docs/privacy-model.md) — read modes, scrubbing, deny globs
- [docs/plugin-runtime.md](docs/plugin-runtime.md) — cross-host packaging and data persistence
- [docs/security-review.md](docs/security-review.md) — threat model and controls

---

## Quick reference

| Goal | Command |
|------|---------|
| Install (Claude Code) | `/plugin marketplace add K3vin-h/metamorph` then `/plugin install metamorph` |
| Install (Cursor) | Clone to `~/.cursor/plugins/local/metamorph/` and reload |
| Install (Codex) | `codex plugin marketplace add K3vin-h/metamorph` then enable in plugin directory |
| First-time setup | `/metamorph-setup` |
| View dashboard | `/metamorph-report` |
| Improve agents or skills | `/metamorph` |
| Check status | `/metamorph --status` |
| Undo an approved change | `/metamorph-rollback --list` |

---

## Key terms

| Term | Meaning |
|------|---------|
| **Agent** | A specialized assistant definition Claude can invoke (e.g. `architect`, `code-reviewer`) |
| **Skill** | An instruction file Claude loads for specific tasks (e.g. `tdd-workflow`) |
| **CLAUDE.md** | Project-level instructions that guide Claude's behavior |
| **Session** | One work period in Claude Code, from open to close |
| **Hook** | An automatic script that runs at session start or end — no AI involved |
| **Token** | A unit of AI usage; only the improvement step consumes tokens |
| **Diff** | A line-by-line list of what would change in a file |
| **Flag** | A short label on the dashboard (`inactive`, `underused`, `healthy`, etc.) explaining a finding |
| **Score** | A number from 0–100; lower usually means more room to improve |
| **Warm-up** | Initial sessions where metamorph collects data before marking the dashboard `ready` (default: 5) |

---

## What metamorph does

1. **Observes** your Claude Code sessions through background hooks (local parsing only — no AI).
2. **Scores** each agent and skill based on real usage patterns.
3. **Publishes** a text report (`report.md`) with scores, flags, and warm-up status.
4. **Proposes** targeted diffs when you run `/metamorph`.
5. **Validates, backs up, and writes** only after you explicitly approve.

metamorph does **not** run continuously in the background, serve an HTML dashboard, or modify files without consent.

---

## How it works

### Layer 1 — Background pipeline (zero tokens)

**Hooks** are small Node.js scripts registered in `hooks/hooks.json`. They fire automatically:

| Hook | When | What it does |
|------|------|--------------|
| **SessionStart** | Session opens | Refreshes `report.md`; prints a compact 2-line status (session count, flagged count, top target) |
| **SessionEnd** | Session closes | Parses new transcript data; updates scores when new sessions are found; refreshes the report and style profile only if new data was ingested |

Hook timeouts: SessionStart **10s**, SessionEnd **60s**. Errors go to `data/hook-errors.log` and do not prevent Claude Code from closing normally.

### Layer 2 — Improvement pipeline (uses tokens)

When you run `/metamorph`:

1. **CLI helpers** print stats and target tables without loading the full analysis file into chat.
2. You select targets (`top 3`, specific IDs, or `all` — capped at `maxSuggestionsPerRun`, default **3**).
3. **`prepare-improve-batch`** builds a small context file (~1–3 KB) per target.
4. **`metamorph-diff` subagents** run **in parallel** (Haiku model) — each reads one context file and writes a unified diff.
5. You review diffs and approve with `all`, specific IDs, or `none` (or later via `/metamorph-improve`).
6. Approved changes are validated, backed up, and written atomically.

This is the **only step that uses the AI model** and consumes tokens.

---

## Requirements

| Requirement | Details |
|-------------|---------|
| **Claude Code** | Plugin and hook support enabled |
| **Node.js 18+** | Runs metamorph's background scripts |

---

## Installation

### Claude Code

```bash
/plugin marketplace add K3vin-h/metamorph
/plugin install metamorph
```

To update:

```bash
/plugin marketplace update
/plugin update metamorph
```

Your settings and data in `${CLAUDE_PLUGIN_DATA}` are preserved. After updating, start a new session or run `/metamorph-report` to refresh the dashboard format.

### Cursor

Install from GitHub (clone or download), then load locally:

```bash
git clone https://github.com/K3vin-h/metamorph.git ~/.cursor/plugins/local/metamorph
```

Restart Cursor (or **Developer: Reload Window**). Commands (`/metamorph`, `/metamorph-setup`, …), hooks, and skills load from `.cursor-plugin/plugin.json`.

From Claude Code, `/metamorph-setup` can also link the plugin into `~/.cursor/plugins/local/metamorph/` automatically.

### Codex

Add the GitHub marketplace, then install from the plugin directory:

```bash
codex plugin marketplace add K3vin-h/metamorph
```

Codex reads `.claude-plugin/marketplace.json` (legacy-compatible) and requires `.codex-plugin/plugin.json` at the plugin root.

For a local checkout during development:

```bash
codex plugin marketplace add /absolute/path/to/metamorph
```

Or run `/metamorph-setup` from Claude Code to link the plugin into `~/.agents/plugins/metamorph/` and register a personal marketplace entry.

Restart Codex and enable **metamorph** from the plugin picker. Use `/metamorph` to run improvements; `SessionStart`/`SessionEnd` hooks run automatically.

---

## First-time setup

```text
/metamorph-setup
```

The wizard configures:

| Setting | What it controls |
|---------|------------------|
| **Read scope** | Which Claude config folders to analyze: global, project, or both |
| **Transcript privacy** | How much session data to store: `full`, `redacted`, or `off` |
| **Write targets** | Whether metamorph may suggest edits to agents, skills, and/or CLAUDE.md |
| **Warm-up sessions** | Sessions to collect before the dashboard shows `ready` (default: **5**) |
| **Flag threshold** | Scores below this value receive the `underused` flag (default: **40**) |
| **Deny-read globs** | File path patterns metamorph must never read (e.g. `**/*.env*`) |

**Shipped defaults** (`config.jsonc`):

- Transcripts: `redacted` (metadata only — not full chat text)
- Agent and skill suggestions: enabled
- CLAUDE.md suggestions: disabled
- Read scope: `both`

Settings save to `${CLAUDE_PLUGIN_DATA}/config.jsonc`. Run setup again anytime; use `--reset` to restore defaults first.

---

## Typical workflow

1. Install the plugin and run `/metamorph-setup`.
2. Use Claude Code normally for several sessions (at least **5** by default).
3. Run `/metamorph-report` to view the dashboard.
4. Run `/metamorph`, select targets, review diffs, and approve what you want.

| During warm-up | After warm-up |
|----------------|---------------|
| Dashboard shows `warm-up 2/5` (example) | Dashboard shows `ready` |
| Session start reports sessions remaining | Session start suggests `/metamorph` |
| `/metamorph` works if session data exists | Scores are generally more reliable |

Warm-up improves data quality; it is not a hard lock on commands.

---

## Efficient usage (token savings)

| Practice | Effect |
|----------|--------|
| `/metamorph-report` | Zero LLM — dashboard only; prints a clickable `report.md` link |
| `/metamorph --target <id>` | Skip stats tables + multi-target prep when you know the target |
| Actionable targets only | Default interactive flow uses `improve-targets-actionable` (excludes inactive targets) |
| `improve.skipNeverInvoked: true` | Batch prepare skips inactive agents/skills (default in 1.2.7) |
| `transcripts: redacted` | Smaller cache — default; use `full` only if you need mistake text |
| Prune unused agents/skills | Biggest routing win — remove from `~/.claude/agents/` or `~/.cursor/skills-cursor/` |

**Config migration** (if your runtime config still has `transcripts: full`):

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" config-set read.transcripts redacted
```

**After upgrading to 1.2.7**, run one `session-end` to re-parse transcripts with improved Cursor `Task` / `Read` skill tracking:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" session-end
```

**Recommended improve targets** (when you have usage data): agents/skills with score ≥ 30 and non-`inactive` flags — e.g. `code-reviewer`, `security-reviewer`, `graphify`. Skip `architect`-class agents until you actually invoke them.

---

## Commands

### Core

| Command | Description |
|---------|-------------|
| `/metamorph` | Interactive: actionable targets → diffs → approval |
| `/metamorph --status` | Warm-up progress, recommended target IDs, top flags |
| `/metamorph --target <id>` | Improve a single target directly (preferred for token savings) |
| `/metamorph-report` | Refresh and display `report.md` (zero LLM) |

**Target IDs:** agent/skill names (`architect`, `backend-patterns`), or `global` / `local` for CLAUDE.md.

**Selection in `/metamorph`:** `top N`, `all`, or space-separated IDs. Lowest-scoring targets are kept when the selection exceeds `maxSuggestionsPerRun`.

### Configuration

| Command | Description |
|---------|-------------|
| `/metamorph-setup` | Setup wizard |
| `/metamorph-setup --reset` | Reset defaults, then wizard |
| `/metamorph-config show` | Display current settings |
| `/metamorph-config set key=value` | Update one setting (dot notation for nested keys) |

Examples:

```text
/metamorph-config set warmupSessions=3
/metamorph-config set flagThreshold=50
/metamorph-config set read.transcripts=full
/metamorph-config set read.mistakeTracking=false
/metamorph-config set write.targets.claudeMd=both
```

### Approval and rollback

| Command | Description |
|---------|-------------|
| `/metamorph-improve --list` | List pending suggestions by run ID |
| `/metamorph-improve --approve <runId>-<targetId>` | Apply one approved diff |
| `/metamorph-improve --approve all` | Apply all pending from the latest run |
| `/metamorph-improve --reject <id>` | Discard a suggestion |
| `/metamorph-improve --reject all` | Discard all pending suggestions |
| `/metamorph-rollback --list` | List restorable backups |
| `/metamorph-rollback --file <path>` | Restore a file to its pre-edit backup |
| `/metamorph-rollback --run <runId>` | Restore all restorable files from one run |

**Suggestion ID example:** `run-1717000000000-abc123def456-architect`

### Feedback

```text
/metamorph-feedback "prefer shorter agent descriptions"
/metamorph-feedback --list
/metamorph-feedback --clear
```

Up to **500 characters** per entry via the slash command. Feedback is sanitized and marked as untrusted before it influences suggestions.

---

## Dashboard and scoring

### Reading the report

Run `/metamorph-report` or open `${CLAUDE_PLUGIN_DATA}/report.md`.

```text
# metamorph · ready
124 sessions · 44 tools · 0 agent runs · 0 skill loads · redacted
ts 42% · py 28%

_Score: 0–30 needs attention · 31–70 moderate · 71–100 healthy_
_Flags: inactive=unused · underused=low score · healthy=active · tool-gap=declared tool unused · stale-doc=inactive section · correction=repeated fixes_

## Agents (25)

┌──────────────────────────────┬──────────────┬──────────────┐
│              id              │    score     │     flag     │
├──────────────────────────────┼──────────────┼──────────────┤
│  architect                   │    10/100    │  inactive   │
│  researcher                  │    40/100    │  underused  │
└──────────────────────────────┴──────────────┴──────────────┘
```

There is no HTML dashboard — only this plain-text report with ASCII tables.

### Score composition

Each agent or skill receives a weighted score from **0 to 100**:

| Factor | Weight | What it measures |
|--------|--------|------------------|
| Invocation frequency | 40% | How often you use it vs total agent runs or skill loads |
| Tool utilization | 30% | Declared tools vs tools actually observed in sessions |
| Section coverage | 20% | Whether documented sections align with your workflow |
| Skill apply rate | 10% | Skills only: times loaded vs times actually applied |

### Flags

| Flag | Meaning |
|------|---------|
| `—` | No primary issue |
| `inactive` | No observed use, or a skill loaded but was never applied |
| `underused` | Used at least once, but score is below `flagThreshold` (default: below 40) |
| `healthy` | Score is 80 or higher and the target appears active |
| `tool-gap` | A declared tool was not seen in your sessions |
| `stale-doc` | A documentation section may not match your workflow (high confidence in `full` privacy mode) |
| `stale-doc?` | Same as `stale-doc`, but lower confidence (`redacted` or `off` mode) |
| `correction` | Repeated correction patterns detected |

**Note:** `stale-doc` and `stale-doc?` flags appear only after at least **5 invocations**, to limit false positives.

---

## Privacy

| Mode | What is stored |
|------|----------------|
| **`redacted`** (default) | Metadata only: tool names, file extensions, hashed path fragments, timestamps — not full prompts or file contents |
| **`full`** | Complete transcript bodies and tool inputs |
| **`off`** | Aggregate counts with minimal per-event detail |

metamorph applies best-effort secret scrubbing before storage. Use deny-read globs for sensitive files. Scrubbing is not a guarantee.

Session data included in improvement context is wrapped in **`[UNTRUSTED DATA]`** blocks. Subagents are instructed to treat that content as reference data, not as commands to follow.

---

## Mistake tracking

Enabled by default (`read.mistakeTracking: true`). Helps metamorph suggest guardrails when you repeatedly correct similar issues.

| Counts | Does not count |
|--------|----------------|
| Tool completes successfully, then you send a fix message | Declined tool calls |
| You reject a suggestion with `/metamorph-improve --reject` | Failed commands |
| | Fix messages with no successful tool step immediately before |

Disable: `/metamorph-config set read.mistakeTracking=false`

Only a compact slice (max 3 patterns, 2 examples, 80 characters each) is passed to the improvement step to limit token use.

---

## What happens when you approve

1. The diff is applied to a temporary copy of the target file.
2. The copy is validated (required frontmatter keys, balanced code fences).
3. If validation passes: the original file is backed up, then replaced.
4. If validation fails: the original file is **unchanged**.

**Rollback:** one backup per file (the version from immediately before metamorph's last edit). If filenames collide, use the full path (e.g. `agents/architect.md`).

---

## Configuration reference

| Setting | Values | Default |
|---------|--------|---------|
| `mode` | `suggest` only | Cannot auto-apply |
| `warmupSessions` | 1–50 | 5 |
| `flagThreshold` | 0–100 | 40 |
| `maxSuggestionsPerRun` | 1–20 | 3 |
| `read.scope` | `global`, `project`, `both` | `both` |
| `read.transcripts` | `full`, `redacted`, `off` | `redacted` |
| `read.mistakeTracking` | `true`, `false` | `true` |
| `read.trackCursor` | `true`, `false` | `true` |
| `read.trackCodex` | `true`, `false` | `true` |
| `improve.skipNeverInvoked` | `true`, `false` | `true` |
| `improve.minScore` | 0–100 | 30 |
| `improve.minInvocations` | 0–100 | 1 |
| `write.targets.agents` | `true`, `false` | `true` |
| `write.targets.skills` | `true`, `false` | `true` |
| `write.targets.claudeMd` | `false`, `global`, `local`, `both` | `false` |
| `write.allow` | path globs | `agents/*`, `skills/*/SKILL.md` |
| `write.deny` | path globs | `[]` |

Changes take effect on the next hook run. The config file supports comments (JSONC format).

---

## Data storage

Plugin data lives under `${CLAUDE_PLUGIN_DATA}`, typically:

```text
~/.claude/plugins/data/metamorph-metamorph/
```

| Path | Purpose |
|------|---------|
| `config.jsonc` | Settings |
| `report.md` | Text dashboard |
| `data/analysis.json` | Scores and flags |
| `data/profile.json` | Session cache (up to 500 sessions) |
| `data/feedback.log` | User feedback entries |
| `data/hook-errors.log` | Hook error log |
| `data/style-profile.json` | Style patterns for suggested edits |
| `data/mistake-feedback.jsonl` | Mistake and rejection events |
| `suggestions/` | Pending diffs awaiting approval |
| `backups/` | Pre-edit file copies |

**Reads from:** `~/.claude/agents/`, `~/.claude/skills/`, `~/.claude/projects/` (transcripts).

**Writes to:** agent, skill, and CLAUDE.md paths only after approval, and only where settings permit.

---

## Security

- **Suggest-only** — no autonomous file writes.
- **Path confinement** — writes restricted to allowed directories; symlink escapes blocked.
- **Input sanitization** — feedback and mistake data scrubbed and marked untrusted before LLM context.
- **Validation** — frontmatter and structure checks before replacing files.
- **Checksums** — rollback can detect manual edits since metamorph's last write.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Outdated dashboard format | `/metamorph-report` or start a new session |
| No data available | Complete at least one full Claude Code session |
| Hook errors | Check `data/hook-errors.log` |
| Validation failed on approve | Original file unchanged; review the error message |
| Rollback restored wrong file | Use full path: `/metamorph-rollback --file agents/architect.md` |
| Unreliable scores | Allow more sessions; default warm-up is 5 |

---

## Runtime reference

Source: [github.com/K3vin-h/metamorph](https://github.com/K3vin-h/metamorph)

This branch is the installable plugin. It ships compiled runtime JavaScript in `dist/` and omits source, tests, and build-only files.

CLI: `node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" <command>`

| Command | Purpose |
|---------|---------|
| `session-start` / `session-end` | Run hooks manually |
| `report-refresh` / `report-print` | Regenerate `report.md`; `report-print` also prints a clickable `report.md` link and dashboard |
| `improve-stats` / `improve-targets` / `improve-status` | Improve-flow output |
| `prepare-improve-batch <ids…>` | Build context files (shared run ID) |
| `prepare-improve <id> [runId]` | Prepare one target |
| `improve-approve` / `improve-reject` / `improve-list` | Suggestion lifecycle |
| `config-set` / `config-write` | Config updates (write max 64KB) |
| `feedback-add` / `feedback-list` / `feedback-clear` | Feedback log |
| `rollback-list` / `rollback-file` / `rollback-run` | Backup restore |

Bundled subagent: `agents/metamorph-diff.md` (parallel diff generation for `/metamorph`).

---

## License

MIT — see the [GitHub repository](https://github.com/K3vin-h/metamorph).
