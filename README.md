# metamorph

A Claude Code plugin that observes how you actually use your subagents, skills, and CLAUDE.md, computes a **utilization score** for every part of every agent/skill, and then **proposes** rewrites that fit your real coding habits — with one-level rollback for everything it writes.

**v1 is suggest-only: nothing is written without your explicit approval.**

## Prerequisites

- **Claude Code** with plugin + hooks support
- **Node 18+** (required for compiled JS hooks/commands)

## Install

```bash
# From GitHub
/plugin marketplace add K3vin-h/metamorph
/plugin install metamorph

# Local dev
/plugin marketplace add /path/to/metamorph
/plugin install metamorph
```

## First run

Run `/metamorph setup` to configure read scope, write permissions, and privacy level. Defaults are safe: `transcripts=redacted`, agents+skills writable, CLAUDE.md off.

After setup, metamorph collects data for **5 sessions** (configurable) before offering suggestions. During warm-up the dashboard is available but no improvement suggestions are shown.

## Usage

```
/metamorph              # Show dashboard + top improvement suggestions
/metamorph --status     # Warm-up progress + last analysis
/metamorph --target ID  # Improve a specific agent/skill

/metamorph-setup        # Interactive setup wizard (re-runnable)
/metamorph-config show  # Show current config
/metamorph-config set warmupSessions=3

/metamorph-improve --list              # Pending suggestions
/metamorph-improve --approve <runId>-<targetId>
/metamorph-improve --reject  <runId>-<targetId>

/metamorph-rollback --list             # Restorable files
/metamorph-rollback --file agents/foo.md

/metamorph-feedback "add per-language chart"
```

## How it works

1. **SessionEnd hook** (deterministic, zero-token): parses new session transcripts, updates utilization scores, regenerates `report.md` and `report.html`
2. **SessionStart hook** (deterministic, zero-token): prints top flags + warm-up status
3. **`/metamorph`** (LLM — only thing that spends tokens): reads compact `analysis.json`, picks top N lowest-scoring targets, generates diffs via a subagent, presents them for your approval

## Data & privacy

All runtime data lives under Claude Code's persistent plugin data directory (`${CLAUDE_PLUGIN_DATA}`, usually `~/.claude/plugins/data/<plugin-id>/`). Default privacy mode is `redacted` — only metadata is stored (tool names, file extensions, hashed path stems, timestamps). No raw file contents or prompt text are stored unless you switch to `full` mode.

## Files generated

- `${CLAUDE_PLUGIN_DATA}/report.md` — text dashboard, updated after every session
- `${CLAUDE_PLUGIN_DATA}/report.html` — interactive dashboard with inline SVG charts and command-bridge buttons
- `${CLAUDE_PLUGIN_DATA}/data/analysis.json` — compact utilization scores (the LLM reads only this)
- `${CLAUDE_PLUGIN_DATA}/backups/` — previous versions of metamorph-edited files (one-level rollback)

## Build (dev only)

```bash
cd metamorph
npm install
npm run build   # outputs to dist/
```

`dist/` is committed so installers need no build step.

## Configuration

Edit `${CLAUDE_PLUGIN_DATA}/config.jsonc` directly or use `/metamorph-config set key=value`. Comments are allowed in the config file.

## Security

- Captured content is treated as untrusted data and wrapped in labeled delimiters before the LLM sees it
- Common secret patterns (API keys, tokens, PEM blocks) are scrubbed before storage
- All writes are confined to `~/.claude` — path traversal and symlink escapes are rejected
- Each approved write is validated (frontmatter parses, required keys present) before the backup is overwritten

## Non-goals (v1)

- No auto-apply — every change requires approval
- No background daemon or scheduled runs
- No perfect secret redaction (best-effort scrubbing only)
- Dashboard is read-only — it generates slash commands, doesn't apply them directly
