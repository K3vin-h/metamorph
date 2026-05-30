# metamorph

**Version 1.0.8**

metamorph is a Claude Code plugin that watches how you actually work — which agents you call, which skills you load, and what kinds of files you touch — then suggests small improvements to your agent and skill files so they better match your real habits.

**Nothing changes unless you say yes.** Every edit is a suggestion. You read the diff and approve it yourself.

---

## Quick start

1. Install the plugin (see [Install](#install)).
2. Run `/metamorph-setup` once to choose your privacy and write settings.
3. Use Claude Code normally for a few sessions (default: 5) while metamorph collects data.
4. Run `/metamorph-report` to see your habits dashboard.
5. Run `/metamorph` to pick targets, review suggested changes, and accept the ones you want.

---

## What does it do?

1. **Watches** your Claude Code sessions in the background. This part does not use AI tokens.
2. **Scores** each agent and skill from 0–100. Lower scores mean more room to improve.
3. **Flags** problems like never-used agents, unused tools, or sections that do not match your workflow.
4. **Shows** a compact habits dashboard (`report.md`) after every session.
5. **Suggests** small, targeted edits — then waits for your approval before writing anything.
6. **Backs up** every file it changes so you can undo with one command.

---

## What you need first

| Requirement | Details |
|-------------|---------|
| **Claude Code** | With plugin and hook support |
| **Node.js 18+** | Runs the plugin's background scripts |

---

## Install

### From GitHub (recommended)

```bash
/plugin marketplace add K3vin-h/metamorph
/plugin install metamorph
```

### Local development

```bash
/plugin marketplace add /path/to/metamorph
/plugin install metamorph
```

### Update to a newer version

When a new version is released:

```bash
/plugin marketplace update
/plugin update metamorph
```

Your settings and collected data stay in place after an update.

---

## First-time setup

Run the setup wizard once after installing:

```
/metamorph-setup
```

The wizard walks you through:

| Setting | What it controls |
|---------|------------------|
| **Read scope** | Which Claude config folders to analyze (`global`, `project`, or `both`) |
| **Transcript privacy** | How much session transcript data to store (`full`, `redacted`, or `off`) |
| **Write targets** | Whether metamorph can suggest edits to agents, skills, and CLAUDE.md |
| **Warm-up sessions** | How many sessions to collect before the dashboard recommends improvements (default: **5**) |
| **Flag threshold** | Score below which a target gets flagged (default: **40**) |
| **Deny-read globs** | File patterns metamorph should never read (e.g. `**/*.env*`) |

Settings save to `${CLAUDE_PLUGIN_DATA}/config.jsonc`. Re-run `/metamorph-setup` any time to change them. Use `/metamorph-setup --reset` to restore factory defaults first.

**Default settings (safe out of the box):**

- Transcripts: `redacted` (metadata only — no raw prompts)
- Writable: agents and skills **on**, CLAUDE.md **off**
- Read scope: `both`
- Deny-read globs block common secret files (`**/*.env*`, `**/credentials*`, etc.)

---

## Warm-up period

After setup, metamorph collects data for a few sessions before it recommends improvements.

| During warm-up | After warm-up |
|----------------|---------------|
| Dashboard shows progress like `2/5 warming up` | Dashboard shows `ready` |
| `/metamorph-report` works | Full dashboard with quick-action buttons |
| HTML dashboard hides "Improve" buttons | "Improve" buttons appear on flagged targets |

You **can** run `/metamorph` or `/metamorph --target <id>` once session data exists — warm-up is mainly about collecting enough data for reliable scores, not a hard lock on commands.

---

## Commands

### Main commands

| Command | What it does |
|---------|--------------|
| `/metamorph` | Interactive: stats → pick targets → see diffs → accept or skip |
| `/metamorph --status` | Warm-up progress, last analysis time, top flags |
| `/metamorph --target <id>` | Improve one agent, skill, or CLAUDE.md directly |
| `/metamorph-report` | Show the text habits dashboard inline |

**Example target IDs:** `architect`, `tdd-guide`, `backend-patterns`, `global` (global CLAUDE.md), `local` (project CLAUDE.md)

When picking targets in `/metamorph`, you can type specific IDs, `top 3`, `top N`, or `all`.

### Setup and config

| Command | What it does |
|---------|--------------|
| `/metamorph-setup` | Full interactive setup wizard |
| `/metamorph-setup --reset` | Reset to defaults, then run the wizard |
| `/metamorph-config show` | Print current settings |
| `/metamorph-config set key=value` | Change one setting |

**Examples:**

```bash
/metamorph-config set warmupSessions=3
/metamorph-config set flagThreshold=50
/metamorph-config set read.transcripts=full
/metamorph-config set write.targets.claudeMd=both
```

| Setting | Values | What it controls |
|---------|--------|------------------|
| `warmupSessions` | 1–50 | Sessions before dashboard recommends improvements (default: 5) |
| `flagThreshold` | 0–100 | Score below which a target is flagged (default: 40) |
| `maxSuggestionsPerRun` | 1–20 | Stored config limit (default: 3) |
| `read.scope` | `global` / `project` / `both` | Which config folders to analyze |
| `read.transcripts` | `full` / `redacted` / `off` | How much transcript data to store |
| `read.mistakeTracking` | `true` / `false` | Track mistakes and corrections from sessions |
| `write.targets.agents` | `true` / `false` | Allow editing agent files |
| `write.targets.skills` | `true` / `false` | Allow editing skill files |
| `write.targets.claudeMd` | `false` / `global` / `local` / `both` | Which CLAUDE.md files may be edited |

Config changes save immediately and take effect on the next session-end hook. You can also edit `config.jsonc` directly (comments are allowed).

### Approve, reject, and undo

There are **two ways** to apply changes:

1. **Inline in `/metamorph`** — after diffs are shown, type `all`, specific IDs, or `none`.
2. **Later with `/metamorph-improve`** — if you skipped inline approval or closed the session.

| Command | What it does |
|---------|--------------|
| `/metamorph-improve --list` | List pending suggestions |
| `/metamorph-improve --approve <runId>-<targetId>` | Apply one suggestion |
| `/metamorph-improve --approve all` | Apply all pending for the latest run |
| `/metamorph-improve --reject <runId>-<targetId>` | Discard one suggestion |
| `/metamorph-improve --reject all` | Discard all pending suggestions |
| `/metamorph-rollback --list` | List files you can restore |
| `/metamorph-rollback --file <path>` | Undo the last metamorph edit to one file |
| `/metamorph-rollback --run <runId>` | Restore all still-restorable files from a run |

**What happens when you approve:**

1. The diff is applied to a temporary copy of the file.
2. The copy is validated (frontmatter parses, required keys present, no broken code fences).
3. If validation passes, the original is backed up, then the new version is written.
4. If validation fails, nothing changes and you get an error.

**Rollback notes:**

- Only the **most recent** backup is kept per file. A later edit replaces the older backup.
- If you manually edited a file after metamorph changed it, rollback warns you before overwriting your edits.
- Files metamorph created from scratch have no prior version to restore — delete them manually if needed.

### Feedback

Tell metamorph what matters to you. Feedback appears in the dashboard and influences future suggestions.

```bash
/metamorph-feedback "add a per-language chart to the dashboard"
/metamorph-feedback "don't flag code-reviewer — it's already accurate"
/metamorph-feedback --list
/metamorph-feedback --clear
```

Feedback is limited to 500 characters per entry.

---

## How `/metamorph` works (interactive mode)

When you run `/metamorph` with no flags:

1. Runs fast CLI helpers (`improve-stats`, `improve-targets`) — the orchestrator does **not** load `analysis.json` into chat.
2. Shows session summary and target tables, then asks what to improve.
3. Runs `prepare-improve-batch` once (shared `runId`) to build tiny per-target context files (~1–3 KB each, not full agent bodies).
4. Dispatches **`metamorph-diff` subagents in parallel** (`haiku`) — each reads only its context JSON path.
5. Shows diffs and asks what to accept — `all`, specific IDs, or `none`.

**Speed / token tips:** use `top 3` instead of `all`; default cap is `maxSuggestionsPerRun` (3). Never-invoked targets only send frontmatter + intro, not the full file.

Suggested changes follow strict rules:

- Fix real errors (broken formatting, bad frontmatter, conflicting instructions).
- Add habit data only when session data clearly supports it (e.g. you use TypeScript 80% of the time but the agent has no TypeScript guidance).
- Trim text only when savings are meaningful — no minor prose polish.
- Keep behavior the same — do not remove tools or change core instructions.
- If a file is already fine, the diff may be empty (no change).

Session data in diff context is wrapped in `[UNTRUSTED DATA]` blocks — the AI treats it as data only, never as instructions to follow.

---

## Mistake and correction tracking

metamorph watches sessions for signals that an agent or skill output was wrong and how you corrected it. This data is used when you run `/metamorph` to suggest better guardrails in agent and skill files.

**What gets detected (heuristic — not perfect):**

| Signal | When it counts |
|--------|----------------|
| **Fix after completed tool** | A tool runs and **completes successfully** (not rejected, not errored), then you send a **text message** asking to fix or correct the output |
| **Rejected suggestion** | You run `/metamorph-improve --reject` on a pending metamorph diff |

**What does NOT count:** declined tool uses, failed commands, or generic complaints with no prior completed tool in the same flow.

Applies to **every tool type** (Bash, Read, Edit, Write, Grep, Agent, Skill, MCP tools, etc.) and **subagent** transcripts. Each event records which tool completed and which agent/skill was active. Summaries are scrubbed and capped at 80 characters.

**Privacy:**

| Transcript mode | Mistake tracking |
|-----------------|------------------|
| `redacted` (default) | Pattern labels only — no quotes from your messages |
| `full` | Short scrubbed excerpts from your messages |
| `off` | Disabled (only logged rejections from `/metamorph-improve --reject`) |

Turn tracking off with `/metamorph-config set read.mistakeTracking=false`.

Targets with repeated mistakes get a `recurring mistakes` flag on the dashboard.

**Token usage (same as other features):** mistake data is aggregated in `analysis.json`, then only a **compact** `mistakes` slice (max 3 patterns, 2 examples, 80 chars each) is written to improve-context JSON files. Context files omit full flag lists, language stats, and duplicate section bodies. No extra LLM reads of raw transcripts or target files on disk.

---

## Understanding scores and flags

Each agent and skill gets a **score from 0 to 100**. Lower scores mean metamorph thinks there is more room to improve. The score combines:

| Factor | Weight | What it measures |
|--------|--------|------------------|
| How often you use it | 40% | Invocation frequency |
| Tool usage | 30% | Declared tools vs. tools actually used |
| Section coverage | 20% | Whether documented sections match your workflow |
| Skill apply rate | 10% | Skills only — loads vs. actual applies |

Common **flags** you may see on the dashboard:

| Flag | Meaning |
|------|---------|
| `never-invoked` | You never used this agent |
| `rarely-used` | Score is below your flag threshold |
| `hot-path` | Score 80+ — working well |
| `unused-tool` | A declared tool was never seen in your sessions |
| `dead-section` | A documentation section may not match your workflow (high confidence in `full` privacy mode) |
| `low-confidence-dead-section` | Same idea, but less certain (in `redacted` or `off` mode) |
| `never-applied` | Skill was loaded but never actually applied |
| `recurring-mistakes` | Multiple mistake/correction signals linked to this target |

The dashboard also shows a **language breakdown** (e.g. `ts:60%, py:30%`) based on file types you worked with.

---

## How it runs in the background

Two hooks run automatically at no AI token cost:

| Hook | When | What it does |
|------|------|--------------|
| **SessionEnd** | After each session | Parses transcripts, updates scores, derives your style profile, refreshes dashboards |
| **SessionStart** | At session start | Prints warm-up status and top flags |

Only `/metamorph` (specifically its diff-generation step) uses AI tokens.

If something goes wrong in a hook, check `data/hook-errors.log` in your plugin data folder.

---

## Dashboard and reports

After every session, metamorph updates `report.md` in your plugin data folder. View it with `/metamorph-report` or open the file directly. It lists agents and skills in compact tables (score + short flag) and links to `/metamorph` when warm-up is complete.

---

## Where your data is stored

All runtime data lives in Claude Code's plugin data directory:

```
${CLAUDE_PLUGIN_DATA}
```

Usually:

```
~/.claude/plugins/data/<plugin-id>/
```

| Path | What it contains |
|------|------------------|
| `config.jsonc` | Your settings |
| `data/analysis.json` | Scores and flags — compact data `/metamorph` reads |
| `data/profile.json` | Internal session cache (up to 500 sessions) |
| `data/feedback.log` | Your logged feedback |
| `data/style-profile.json` | Your writing style patterns (used to match suggested edits) |
| `data/hook-errors.log` | Error log if background hooks fail |
| `data/mistake-feedback.jsonl` | Logged suggestion rejections and similar feedback |
| `report.md` | Compact text dashboard |
| `suggestions/` | Pending diff files waiting for approval |
| `backups/` | Previous versions of metamorph-edited files |
| `backups/manifest.json` | Rollback tracking with checksums |

metamorph reads agent and skill definitions from `~/.claude/agents/` and `~/.claude/skills/`. Session transcripts come from your Claude Code project folders under `~/.claude/projects/`.

---

## Privacy

Three privacy modes for session transcripts:

| Mode | What is stored |
|------|----------------|
| **`redacted`** (default) | Metadata only — tool names, file extensions, hashed file name stems, timestamps. No raw prompts or file contents. |
| **`full`** | Full transcript bodies including tool inputs and commands. Most detail, least private. |
| **`off`** | Counts only — no per-event detail. |

In `redacted` mode, some flags (like unused tools and dead sections) are marked low-confidence because less data is available.

Common secret patterns (API keys, tokens, PEM blocks) are scrubbed before storage. Scrubbing is best-effort — do not treat it as perfect protection.

Deny-read globs (configured in setup) block matching file paths from ever being read. Deny rules win over allow rules.

---

## Security

- Captured session data is treated as untrusted and wrapped in labeled blocks before any AI sees it.
- All file writes stay inside `~/.claude` — path traversal and symlink escapes are blocked.
- Every approved write is validated before the backup is replaced.
- Rollback checks file checksums to detect manual edits since metamorph's last write.

---

## What metamorph does NOT do (v1)

- **No auto-apply** — every change needs your explicit approval (`mode: suggest` only).
- **No background daemon** — it runs at session start/end and when you use a command.
- **No perfect secret removal** — scrubbing helps but is not foolproof.
- **Dashboard is read-only** — it shows commands to copy; it does not apply changes on its own.

---

## Build from source (developers only)

End users do not need to build — `dist/` is included in the repo.

```bash
cd metamorph
npm install
npm run build   # outputs to dist/
```

---

## License

MIT — see [GitHub repository](https://github.com/K3vin-h/metamorph).
