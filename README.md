# metamorph

**Version 1.1.0**

metamorph is a Claude Code plugin that learns how you actually use your agents, skills, and project instructions. It turns that usage into a simple report, then suggests small improvements you can review before anything changes.

**You stay in control:** metamorph never edits your files automatically. It shows a diff first, and you choose what to apply.

---

## At a glance

| You want to... | Run this |
|----------------|----------|
| Install metamorph | `/plugin marketplace add K3vin-h/metamorph` then `/plugin install metamorph` |
| Set it up | `/metamorph-setup` |
| See your report | `/metamorph-report` |
| Improve agents or skills | `/metamorph` |
| Check status | `/metamorph --status` |
| Undo an approved change | `/metamorph-rollback --list` |

---

## What metamorph helps with

Over time, agent and skill files can drift away from how you work. metamorph looks for that drift and helps you clean it up.

It can notice things like:

- Agents you never call.
- Skills that load but rarely get used.
- Tools listed in an agent file that do not show up in your sessions.
- Repeated correction patterns.
- Sections that may no longer match your workflow.
- Habit patterns worth adding to an agent or skill file.

Suggested changes are intentionally small. metamorph is built to tighten existing instructions, not rewrite your setup from scratch.

---

## How it works

1. **Collects local usage signals** at Claude Code session start and end.
2. **Builds a text report** with scores, flags, and warm-up status.
3. **Lets you choose targets** such as `top 3`, `all`, or specific agent/skill IDs.
4. **Generates focused diffs** for the selected targets.
5. **Waits for approval** before writing anything.
6. **Creates backups** so approved changes can be rolled back.

Only the improvement diff step uses AI tokens. Background hooks only parse local data and update the report.

---

## Requirements

| Requirement | Details |
|-------------|---------|
| Claude Code | Plugin and hook support enabled |
| Node.js 18+ | Runs the plugin scripts |

---

## Install

### Recommended install

```bash
/plugin marketplace add K3vin-h/metamorph
/plugin install metamorph
```

### Local development install

```bash
/plugin marketplace add /path/to/metamorph
/plugin install metamorph
```

### Update

```bash
/plugin marketplace update
/plugin update metamorph
```

Your settings and collected data stay in place after updates. After updating, start a new Claude Code session or run `/metamorph-report` to refresh the report format.

---

## First run

Run the setup wizard once:

```text
/metamorph-setup
```

The wizard asks for:

| Setting | Plain-English meaning |
|---------|-----------------------|
| Read scope | Analyze global config, project config, or both |
| Transcript privacy | Store full transcript data, redacted metadata, or almost nothing |
| Write targets | Allow suggestions for agents, skills, and/or CLAUDE.md |
| Warm-up sessions | Sessions to observe before the report says `ready` |
| Flag threshold | The warning line for low scores |
| Deny-read globs | File patterns metamorph must not read |

Default settings are privacy-conscious:

- Transcript mode: `redacted`
- Agent suggestions: on
- Skill suggestions: on
- CLAUDE.md suggestions: off
- Read scope: `both`
- Common secret files blocked from reads

Settings are saved in:

```text
${CLAUDE_PLUGIN_DATA}/config.jsonc
```

Run `/metamorph-setup` again anytime to change them. Use `/metamorph-setup --reset` to restore defaults first.

---

## Typical workflow

1. Install the plugin.
2. Run `/metamorph-setup`.
3. Use Claude Code normally for a few sessions.
4. Run `/metamorph-report`.
5. Run `/metamorph`.
6. Pick targets, review diffs, and approve only the changes you want.

metamorph has a warm-up period because a single session is not enough to judge your habits. The default warm-up is **5 sessions**.

| During warm-up | After warm-up |
|----------------|---------------|
| Report shows progress like `warm-up 2/5` | Report shows `ready` |
| Commands still work if data exists | Commands use fuller scoring context |
| Scores may be noisy | Scores are more useful |

---

## Main commands

| Command | What it does |
|---------|--------------|
| `/metamorph` | Interactive flow: show stats, pick targets, review diffs, approve or skip |
| `/metamorph --status` | Show warm-up progress, last analysis time, and top flags |
| `/metamorph --target <id>` | Improve one target directly |
| `/metamorph-report` | Refresh and print the text dashboard |

Example target IDs:

```text
architect
tdd-guide
backend-patterns
global
local
```

In `/metamorph`, you can select targets with:

```text
top 3
top 5
all
architect tdd-guide
```

By default, a run suggests changes for at most **3 targets**. Change that with `maxSuggestionsPerRun`.

---

## Setup and config commands

| Command | What it does |
|---------|--------------|
| `/metamorph-setup` | Open the setup wizard |
| `/metamorph-setup --reset` | Reset defaults, then open the wizard |
| `/metamorph-config show` | Print current settings |
| `/metamorph-config set key=value` | Change one setting |

Examples:

```bash
/metamorph-config set warmupSessions=3
/metamorph-config set flagThreshold=50
/metamorph-config set read.transcripts=full
/metamorph-config set write.targets.claudeMd=both
```

Common settings:

| Setting | Values | Default |
|---------|--------|---------|
| `warmupSessions` | `1` to `50` | `5` |
| `flagThreshold` | `0` to `100` | `40` |
| `maxSuggestionsPerRun` | `1` to `20` | `3` |
| `read.scope` | `global`, `project`, `both` | `both` |
| `read.transcripts` | `full`, `redacted`, `off` | `redacted` |
| `read.mistakeTracking` | `true`, `false` | `true` |
| `write.targets.agents` | `true`, `false` | `true` |
| `write.targets.skills` | `true`, `false` | `true` |
| `write.targets.claudeMd` | `false`, `global`, `local`, `both` | `false` |

Changes apply on the next hook run. You can also edit `config.jsonc` by hand.

### What `flagThreshold` means

metamorph gives each agent and skill a score from **0 to 100**.

Think of the score like a simple health check:

| Score range | What it usually means |
|-------------|-----------------------|
| `0` to `39` | Probably needs attention |
| `40` to `79` | Maybe okay, depends on your workflow |
| `80` to `100` | Looks useful and active |

`flagThreshold` is the line where metamorph starts warning you about low scores.

The default is:

```text
flagThreshold = 40
```

With that default, any score **below 40** gets the `rare` flag.

Examples:

| Score | Threshold | Result |
|-------|-----------|--------|
| `25/100` | `40` | Flagged as `rare` |
| `39/100` | `40` | Flagged as `rare` |
| `40/100` | `40` | Not flagged as `rare` |
| `55/100` | `40` | Not flagged as `rare` |

Changing the threshold changes how sensitive metamorph is:

| Threshold | What happens |
|-----------|--------------|
| Lower number, like `25` | Fewer things get flagged |
| Higher number, like `60` | More things get flagged |

If you only want warnings for the weakest agents and skills, lower the threshold. If you want metamorph to point out more possible cleanup work, raise it.

---

## Approve, reject, and undo changes

You can approve changes inside `/metamorph` after reviewing diffs:

```text
all
none
architect
architect tdd-guide
```

You can also manage pending suggestions later:

| Command | What it does |
|---------|--------------|
| `/metamorph-improve --list` | List pending suggestions |
| `/metamorph-improve --approve <runId>-<targetId>` | Apply one suggestion |
| `/metamorph-improve --approve all` | Apply all pending suggestions for the latest run |
| `/metamorph-improve --reject <runId>-<targetId>` | Discard one suggestion |
| `/metamorph-improve --reject all` | Discard all pending suggestions |

Rollback commands:

| Command | What it does |
|---------|--------------|
| `/metamorph-rollback --list` | List restorable files |
| `/metamorph-rollback --file <path>` | Restore the latest backup for one file |
| `/metamorph-rollback --run <runId>` | Restore all restorable files from one run |

When a suggestion is approved:

1. The diff is applied to a temporary copy.
2. The copy is validated.
3. The original file is backed up.
4. The validated copy replaces the original.

If validation fails, the original file is left unchanged.

Rollback keeps the most recent backup for each file. If you edited a file by hand after metamorph changed it, rollback warns before overwriting.

---

## Feedback

Use feedback when you want metamorph to remember a preference:

```bash
/metamorph-feedback "prefer shorter agent descriptions"
/metamorph-feedback "stop flagging code-reviewer"
/metamorph-feedback --list
/metamorph-feedback --clear
```

Each feedback entry can be up to **500 characters**.

---

## Reading the report

Run:

```text
/metamorph-report
```

metamorph refreshes and prints `report.md` from your plugin data folder.

Example:

```text
# metamorph · ready
124 sessions · 44 tools · 0 agent runs · 0 skill loads · redacted

_flag: — ok · never · rare · hot · tool · dead · mistake_

## Agents (25)

┌──────────────────────────────┬──────────────┬──────────────┐
│              id              │    score     │     flag     │
├──────────────────────────────┼──────────────┼──────────────┤
│  architect                   │    10/100    │    never     │
│  researcher                  │    40/100    │    rare      │
└──────────────────────────────┴──────────────┴──────────────┘
```

Flag meanings:

| Flag | Meaning |
|------|---------|
| `-` | Looks fine |
| `never` | Agent never used, or skill never applied |
| `rare` | Score is below `flagThreshold`, so metamorph thinks it may need attention |
| `hot` | Score is high and the target appears useful |
| `tool` | Declared tool usage does not match observed usage |
| `dead` | A section may not match your workflow |
| `dead?` | Same as `dead`, but lower confidence |
| `mistake` | Repeated correction pattern found |

Scores run from **0 to 100**. Lower scores usually mean more room to improve.

Score inputs:

| Factor | Weight |
|--------|--------|
| Invocation frequency | 40% |
| Tool usage match | 30% |
| Section coverage | 20% |
| Skill apply rate | 10% for skills |

The report may also show a language line such as `ts 42% · py 28%`, based on file types touched in sessions.

There is no HTML dashboard. metamorph uses a plain text `report.md`.

---

## Privacy

Transcript modes:

| Mode | What metamorph stores |
|------|-----------------------|
| `redacted` | Metadata such as tool names, file extensions, hashed path bits, and timestamps |
| `full` | Full transcript bodies and tool inputs |
| `off` | Counts only, with little per-event detail |

`redacted` is the default. It avoids full prompts and file contents, but some report flags become less certain.

Common secret patterns are scrubbed before storage. Scrubbing is best-effort, so keep deny-read globs for files that should never be read.

Session snippets sent to the diff step are wrapped as untrusted data. The AI is instructed to treat them as data, not as commands.

---

## Mistake tracking

metamorph can track repeated correction patterns. This helps it suggest better guardrails later.

Signals include:

| Signal | When it counts |
|--------|----------------|
| Fix after a completed tool | A tool completes, then you ask to fix or correct the result |
| Rejected suggestion | You reject a pending metamorph suggestion |

Signals do not include declined tools, failed commands, or complaints with no completed tool right before them.

Privacy behavior:

| Transcript mode | Mistake tracking behavior |
|-----------------|---------------------------|
| `redacted` | Pattern labels only |
| `full` | Short scrubbed excerpts |
| `off` | Mostly disabled, except rejected suggestions |

Turn it off with:

```bash
/metamorph-config set read.mistakeTracking=false
```

---

## Files and data

Everything is stored under Claude Code's plugin data directory:

```text
${CLAUDE_PLUGIN_DATA}
```

Usually:

```text
~/.claude/plugins/data/metamorph-metamorph/
```

Important paths:

| Path | Contents |
|------|----------|
| `config.jsonc` | Settings |
| `report.md` | Text dashboard |
| `data/analysis.json` | Scores and flags |
| `data/profile.json` | Session cache |
| `data/feedback.log` | Feedback entries |
| `data/style-profile.json` | Style patterns for suggested edits |
| `data/hook-errors.log` | Hook error log |
| `data/mistake-feedback.jsonl` | Mistake and rejection signals |
| `suggestions/` | Pending diffs |
| `backups/` | File backups |
| `backups/manifest.json` | Rollback metadata |

metamorph reads agents and skills from:

```text
~/.claude/agents/
~/.claude/skills/
```

Session transcripts come from:

```text
~/.claude/projects/
```

---

## Safety model

- No auto-apply: every file change requires approval.
- No background daemon: hooks run only at session start/end.
- Path checks block writes outside allowed folders.
- Symlink escapes are blocked.
- Approved writes are validated before replacing files.
- Rollback can detect manual edits after metamorph's last write.
- Secret scrubbing is best-effort, not a guarantee.

---

## Developer notes

End users do not need to build from source because `dist/` is included.

```bash
cd metamorph
npm install
npm run build
```

Useful CLI commands:

| Command | Purpose |
|---------|---------|
| `report-refresh` | Rebuild `report.md` from `analysis.json` |
| `improve-stats` | Print session summary lines |
| `improve-targets` | Print agent/skill tables |
| `prepare-improve-batch <ids...>` | Build improve context files |
| `session-end` | Run the SessionEnd hook manually |
| `session-start` | Run the SessionStart hook manually |

Manual report refresh:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" report-refresh
```

---

## License

MIT. See the [GitHub repository](https://github.com/K3vin-h/metamorph).
