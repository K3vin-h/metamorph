# metamorph

**Version 1.2.8**

metamorph helps you understand and improve the agent, skill, and instruction files you use with Claude Code, Cursor, and Codex.

It watches local session activity, builds a plain-text report, scores each target, and proposes small diffs when you ask for improvements. It does not send telemetry, does not run model calls in the background, and does not edit files without approval.

## What metamorph does

Working with coding assistants, you usually collect a few kinds of configuration:

- **Agents** - specialized assistant definitions for focused work.
- **Skills** - instruction files loaded for specific tasks.
- **CLAUDE.md** - standing project or global instructions.

Some of these files are useful, some drift out of date, and some are never used. metamorph makes that visible.

It has two workflows:

- **Watcher** - runs from hooks, parses local session activity, updates scores, and writes `report.md`. This uses zero tokens.
- **Improver** - runs when you type `/metamorph`, prepares a small context for selected targets, and asks the model to draft diffs. This is the only token-using step.

## Guarantees

- **Local-first** - observation, scoring, and report generation happen on your machine.
- **Suggest-only** - metamorph proposes diffs; you decide what gets applied.
- **Reversible** - approved changes are backed up before the target file is replaced.
- **Runtime-focused** - this branch ships the installable plugin runtime in `dist/`.

## Documentation

- [docs/architecture.md](docs/architecture.md) - structure and data flow
- [docs/scoring-model.md](docs/scoring-model.md) - score and flag calculation
- [docs/privacy-model.md](docs/privacy-model.md) - read modes, scrubbing, and deny globs
- [docs/plugin-runtime.md](docs/plugin-runtime.md) - packaging and data persistence
- [docs/security-review.md](docs/security-review.md) - threat model and controls

## Quick Reference

| Goal | Command |
|------|---------|
| Install in Claude Code | `/plugin marketplace add K3vin-h/metamorph` then `/plugin install metamorph` |
| Install in Cursor | Clone to `~/.cursor/plugins/local/metamorph/` and reload |
| Install in Codex | `codex plugin marketplace add K3vin-h/metamorph` then enable the plugin |
| First-time setup | `/metamorph-setup` |
| View report | `/metamorph-report` |
| Improve agents or skills | `/metamorph` |
| Check status | `/metamorph --status` |
| Undo an approved change | `/metamorph-rollback --list` |

## Requirements

| Requirement | Details |
|-------------|---------|
| Claude Code | Plugin and hook support enabled |
| Node.js 18+ | Runs the local runtime scripts |

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

Settings and data in `${CLAUDE_PLUGIN_DATA}` are preserved. After updating, start a new session or run `/metamorph-report` to refresh the report.

### Cursor

Clone the plugin into Cursor's local plugin folder:

```bash
git clone https://github.com/K3vin-h/metamorph.git ~/.cursor/plugins/local/metamorph
```

Restart Cursor or run **Developer: Reload Window**. Commands, hooks, and skills load from `.cursor-plugin/plugin.json`.

From Claude Code, `/metamorph-setup` can also link the plugin into `~/.cursor/plugins/local/metamorph/`.

### Codex

Add the marketplace:

```bash
codex plugin marketplace add K3vin-h/metamorph
```

For a local checkout during development:

```bash
codex plugin marketplace add /absolute/path/to/metamorph
```

Restart Codex and enable **metamorph** from the plugin picker. `/metamorph` runs improvements; session hooks run automatically.

## First-Time Setup

Run:

```text
/metamorph-setup
```

The setup wizard configures:

| Setting | What it controls |
|---------|------------------|
| Read scope | Global config, project config, or both |
| Transcript privacy | `full`, `redacted`, or `off` |
| Write targets | Whether metamorph may suggest edits to agents, skills, and/or CLAUDE.md |
| Warm-up sessions | Sessions collected before the report shows `ready` |
| Flag threshold | Score threshold for the `underused` flag |
| Deny-read globs | File patterns metamorph must never read |

Shipped defaults:

- Transcripts: `redacted`
- Agent and skill suggestions: enabled
- CLAUDE.md suggestions: disabled
- Read scope: `both`
- Warm-up sessions: `5`

Settings are saved to `${CLAUDE_PLUGIN_DATA}/config.jsonc`. Run setup again anytime, or use `/metamorph-setup --reset` to restore defaults first.

## Typical Workflow

1. Install the plugin and run `/metamorph-setup`.
2. Use Claude Code normally for several sessions.
3. Run `/metamorph-report` to view the report.
4. Run `/metamorph`, select targets, review diffs, and approve only what you want.

During warm-up, the report shows progress such as `warm-up 2/5`. After enough sessions, it shows `ready`. Warm-up improves score quality, but it does not block commands.

## How It Works

### Workflow 1 - Watcher

Hooks are registered in `hooks/hooks.json`.

| Hook | When | What it does |
|------|------|--------------|
| `SessionStart` | Session opens | Refreshes `report.md` and prints a compact status |
| `SessionEnd` | Session closes | Parses new transcript data, updates scores, and refreshes reports when new data exists |

The watcher is plain Node.js code. It parses local files, updates `analysis.json`, and writes `report.md`. It does not call the model.

Hook timeouts are 10 seconds for `SessionStart` and 60 seconds for `SessionEnd`. Errors are written to `data/hook-errors.log`.

### Workflow 2 - Improver

When you run `/metamorph`:

1. metamorph prints the current status and target list.
2. You choose targets, such as `top 3`, specific IDs, or `all`.
3. `prepare-improve-batch` builds a small context file per target.
4. The `metamorph-diff` subagent drafts one diff per target.
5. You review the diffs.
6. Approved changes are validated, backed up, and written.

This is the only workflow that uses the AI model.

## Commands

### Core

| Command | Description |
|---------|-------------|
| `/metamorph` | Interactive improvement flow |
| `/metamorph --status` | Warm-up progress, recommended targets, and top flags |
| `/metamorph --target <id>` | Improve one target directly |
| `/metamorph-report` | Refresh and display `report.md` |

Target IDs are agent or skill names, or `global` / `local` for CLAUDE.md.

### Configuration

| Command | Description |
|---------|-------------|
| `/metamorph-setup` | Run the setup wizard |
| `/metamorph-setup --reset` | Reset defaults, then run setup |
| `/metamorph-config show` | Display current settings |
| `/metamorph-config set key=value` | Update one setting |

Examples:

```text
/metamorph-config set warmupSessions=3
/metamorph-config set flagThreshold=50
/metamorph-config set read.transcripts=full
/metamorph-config set read.mistakeTracking=false
/metamorph-config set write.targets.claudeMd=both
```

### Approval and Rollback

| Command | Description |
|---------|-------------|
| `/metamorph-improve --list` | List pending suggestions |
| `/metamorph-improve --approve <id>` | Apply one approved suggestion |
| `/metamorph-improve --approve all` | Apply all pending suggestions from the latest run |
| `/metamorph-improve --reject <id>` | Discard a suggestion |
| `/metamorph-improve --reject all` | Discard all pending suggestions |
| `/metamorph-rollback --list` | List restorable backups |
| `/metamorph-rollback --file <path>` | Restore one file |
| `/metamorph-rollback --run <runId>` | Restore all restorable files from one run |

### Feedback

```text
/metamorph-feedback "prefer shorter agent descriptions"
/metamorph-feedback --list
/metamorph-feedback --clear
```

Feedback is sanitized and treated as untrusted reference data before it influences suggestions.

## Report and Scoring

Run `/metamorph-report` or open `${CLAUDE_PLUGIN_DATA}/report.md`.

The report is a plain-text dashboard with session counts, language mix, target scores, and flags. There is no HTML dashboard.

Each agent or skill receives a score from 0 to 100:

| Factor | Weight | What it measures |
|--------|--------|------------------|
| Invocation frequency | 40% | How often the target is used |
| Tool utilization | 30% | Declared tools compared with observed tool use |
| Section coverage | 20% | Whether documented sections match observed work |
| Skill apply rate | 10% | Skills only: loads compared with actual application |

Common flags include:

| Flag | Meaning |
|------|---------|
| `inactive` | No observed use, or a skill loaded but was never applied |
| `underused` | Used, but below the configured score threshold |
| `healthy` | Active with a score of 80 or higher |
| `tool-gap` | A declared tool was not observed in sessions |
| `stale-doc` | A documented section may not match actual use |
| `correction` | Repeated correction patterns were detected |

See [docs/scoring-model.md](docs/scoring-model.md) for the full model.

## Privacy

The default transcript mode is `redacted`.

| Mode | What is stored |
|------|----------------|
| `redacted` | Metadata such as tool names, file extensions, hashed path fragments, and timestamps |
| `full` | Complete transcript bodies and tool inputs |
| `off` | Aggregate counts with minimal per-event detail |

metamorph applies best-effort secret scrubbing before storage. Use deny-read globs for sensitive files. Scrubbing reduces risk, but it is not a guarantee.

Session data included in improvement context is wrapped as untrusted data. The model is instructed to treat it as reference material, not as instructions.

## What Happens When You Approve

1. The diff is applied to a temporary copy of the target file.
2. The copy is validated.
3. If validation passes, the original file is backed up.
4. The validated copy replaces the original file.
5. If validation fails, the original file is unchanged.

Rollback keeps one backup per file: the version from immediately before metamorph's last edit.

## Data Storage

Plugin data lives under `${CLAUDE_PLUGIN_DATA}`, typically:

```text
~/.claude/plugins/data/metamorph-metamorph/
```

| Path | Purpose |
|------|---------|
| `config.jsonc` | Settings |
| `report.md` | Text report |
| `data/analysis.json` | Scores and flags |
| `data/profile.json` | Session cache |
| `data/feedback.log` | User feedback entries |
| `data/hook-errors.log` | Hook error log |
| `data/style-profile.json` | Style patterns for suggested edits |
| `data/mistake-feedback.jsonl` | Mistake and rejection events |
| `suggestions/` | Pending diffs |
| `backups/` | Pre-edit file copies |

metamorph reads configured agent, skill, CLAUDE.md, and transcript paths. It writes to agent, skill, and CLAUDE.md paths only after approval and only where settings allow.

## Configuration Reference

| Setting | Values | Default |
|---------|--------|---------|
| `mode` | `suggest` only | Cannot auto-apply |
| `warmupSessions` | 1-50 | 5 |
| `flagThreshold` | 0-100 | 40 |
| `maxSuggestionsPerRun` | 1-20 | 3 |
| `read.scope` | `global`, `project`, `both` | `both` |
| `read.transcripts` | `full`, `redacted`, `off` | `redacted` |
| `read.mistakeTracking` | `true`, `false` | `true` |
| `read.trackCursor` | `true`, `false` | `true` |
| `read.trackCodex` | `true`, `false` | `true` |
| `improve.skipNeverInvoked` | `true`, `false` | `true` |
| `improve.minScore` | 0-100 | 30 |
| `improve.minInvocations` | 0-100 | 1 |
| `write.targets.agents` | `true`, `false` | `true` |
| `write.targets.skills` | `true`, `false` | `true` |
| `write.targets.claudeMd` | `false`, `global`, `local`, `both` | `false` |
| `write.allow` | path globs | `agents/*`, `skills/*/SKILL.md` |
| `write.deny` | path globs | `[]` |

Changes take effect on the next hook run. The config file supports JSONC comments.

## Security

- **Suggest-only** - no autonomous file writes.
- **Path confinement** - writes are restricted to allowed directories.
- **Input sanitization** - feedback and mistake data are scrubbed and marked untrusted before model use.
- **Validation** - proposed files are checked before replacement.
- **Checksums** - rollback can detect manual edits since metamorph's last write.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Outdated report format | Run `/metamorph-report` or start a new session |
| No data available | Complete at least one full Claude Code session |
| Hook errors | Check `data/hook-errors.log` |
| Validation failed on approval | The original file was left unchanged |
| Rollback restored the wrong file | Use the full path, such as `/metamorph-rollback --file agents/architect.md` |
| Scores look unreliable | Allow more sessions; default warm-up is 5 |

## Runtime Reference

Source: [github.com/K3vin-h/metamorph](https://github.com/K3vin-h/metamorph)

CLI:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" <command>
```

Useful runtime commands:

| Command | Purpose |
|---------|---------|
| `session-start` / `session-end` | Run hooks manually |
| `report-refresh` / `report-print` | Regenerate or print `report.md` |
| `improve-stats` / `improve-targets` / `improve-status` | Improve-flow output |
| `prepare-improve-batch <ids...>` | Build context files for selected targets |
| `prepare-improve <id> [runId]` | Prepare one target |
| `improve-approve` / `improve-reject` / `improve-list` | Suggestion lifecycle |
| `config-set` / `config-write` | Config updates |
| `feedback-add` / `feedback-list` / `feedback-clear` | Feedback log |
| `rollback-list` / `rollback-file` / `rollback-run` | Backup restore |

Bundled subagent: `agents/metamorph-diff.md`.

## License

MIT. See the [GitHub repository](https://github.com/K3vin-h/metamorph).
