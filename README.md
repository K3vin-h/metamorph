# metamorph

**Version 1.0.9**

metamorph is a plugin for **Claude Code**. It watches how you work — which agents you use, which skills you load, and what kinds of files you touch. Then it suggests small edits to your agent and skill files so they fit your real habits better.

**Nothing changes unless you say yes.** Every edit is a suggestion. You read the diff and approve it yourself.

---

## Quick start

1. Install the plugin (see [Install](#install)).
2. Run `/metamorph-setup` once to pick privacy and write settings.
3. Use Claude Code normally for a few sessions (default: **5**) while metamorph collects data in the background.
4. Run `/metamorph-report` to see your habits dashboard.
5. Run `/metamorph` to pick what to improve, review diffs, and accept the changes you want.

---

## What does it do?

1. **Watches** your sessions in the background. This step does **not** use AI tokens.
2. **Scores** each agent and skill from **0 to 100**. A lower score means there is more room to improve.
3. **Flags** issues — for example, an agent you never use, or a tool listed in a file but never seen in your sessions.
4. **Updates** a text dashboard (`report.md`) after each session.
5. **Suggests** small, focused edits — and waits for your approval before writing anything.
6. **Backs up** files it changes so you can undo with one command.

---

## What you need

| Requirement | Details |
|-------------|---------|
| **Claude Code** | With plugin and hook support |
| **Node.js 18+** | Runs the plugin’s background scripts |

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

```bash
/plugin marketplace update
/plugin update metamorph
```

Your settings and collected data stay in place after an update.

After updating, open a new Claude Code session (or run `/metamorph-report`) so `report.md` refreshes to the latest table format.

---

## First-time setup

Run once after installing:

```
/metamorph-setup
```

The wizard helps you set:

| Setting | What it means |
|---------|----------------|
| **Read scope** | Which config folders to analyze: `global`, `project`, or `both` |
| **Transcript privacy** | How much session data to store: `full`, `redacted`, or `off` |
| **Write targets** | Whether metamorph may suggest edits to agents, skills, and CLAUDE.md |
| **Warm-up sessions** | How many sessions to collect before the dashboard says “ready” (default: **5**) |
| **Flag threshold** | Scores below this number get flagged (default: **40**) |
| **Deny-read globs** | File patterns metamorph must never read (for example `**/*.env*`) |

Settings are saved in `${CLAUDE_PLUGIN_DATA}/config.jsonc`. Run `/metamorph-setup` again anytime to change them. Use `/metamorph-setup --reset` to restore defaults first.

**Safe defaults:**

- Transcripts: `redacted` (metadata only — not your full prompts)
- Can edit: agents and skills **on**, CLAUDE.md **off**
- Read scope: `both`
- Common secret file patterns are blocked from reads

---

## Warm-up period

metamorph needs a few sessions of data before scores are reliable.

| During warm-up | After warm-up |
|----------------|---------------|
| Dashboard title shows `warm-up 2/5` (example) | Dashboard title shows `ready` |
| `/metamorph-report` works | Same — full tables |
| You can still run `/metamorph` if session data exists | Same |

Warm-up is about collecting enough data — it is **not** a hard lock on commands.

---

## Commands

### Main commands

| Command | What it does |
|---------|--------------|
| `/metamorph` | Interactive: stats → pick targets → see diffs → accept or skip |
| `/metamorph --status` | Warm-up progress, last analysis time, top flags |
| `/metamorph --target <id>` | Improve one agent, skill, or CLAUDE.md directly |
| `/metamorph-report` | Refresh and show the text dashboard inline |

**Example target IDs:** `architect`, `tdd-guide`, `backend-patterns`, `global` (home CLAUDE.md), `local` (project CLAUDE.md)

In `/metamorph`, you can type specific IDs, `top 3`, `top N`, or `all`. By default, at most **3** targets run per turn (`maxSuggestionsPerRun`).

### Setup and config

| Command | What it does |
|---------|--------------|
| `/metamorph-setup` | Setup wizard |
| `/metamorph-setup --reset` | Reset defaults, then wizard |
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
| `warmupSessions` | 1–50 | Sessions before dashboard shows “ready” (default: 5) |
| `flagThreshold` | 0–100 | Scores below this get flagged (default: 40) |
| `maxSuggestionsPerRun` | 1–20 | Max targets per `/metamorph` run (default: 3) |
| `read.scope` | `global` / `project` / `both` | Which config folders to analyze |
| `read.transcripts` | `full` / `redacted` / `off` | How much transcript data to store |
| `read.mistakeTracking` | `true` / `false` | Track mistakes and corrections |
| `write.targets.agents` | `true` / `false` | Allow editing agent files |
| `write.targets.skills` | `true` / `false` | Allow editing skill files |
| `write.targets.claudeMd` | `false` / `global` / `local` / `both` | Which CLAUDE.md files may be edited |

Changes apply on the next session hook. You can also edit `config.jsonc` by hand (comments are allowed).

### Approve, reject, and undo

**Two ways to apply changes:**

1. **Inside `/metamorph`** — after diffs are shown, type `all`, specific IDs, or `none`.
2. **Later with `/metamorph-improve`** — if you skipped approval or closed the chat.

| Command | What it does |
|---------|--------------|
| `/metamorph-improve --list` | List pending suggestions |
| `/metamorph-improve --approve <runId>-<targetId>` | Apply one suggestion |
| `/metamorph-improve --approve all` | Apply all pending for the latest run |
| `/metamorph-improve --reject <runId>-<targetId>` | Discard one suggestion |
| `/metamorph-improve --reject all` | Discard all pending |
| `/metamorph-rollback --list` | List files you can restore |
| `/metamorph-rollback --file <path>` | Undo the last metamorph edit to one file |
| `/metamorph-rollback --run <runId>` | Restore all restorable files from one run |

**When you approve:**

1. The diff is applied to a temporary copy of the file.
2. The copy is checked (frontmatter, required keys, no broken code fences).
3. If checks pass, the original is backed up and the new version is written.
4. If checks fail, nothing on disk changes and you see an error.

**Rollback notes:**

- Only the **most recent** backup per file is kept.
- If you edited a file by hand after metamorph, rollback warns you before overwriting.
- Brand-new files metamorph created have nothing to restore — delete them manually if needed.

### Feedback

Tell metamorph what you care about. Feedback is stored and can influence future suggestions.

```bash
/metamorph-feedback "prefer shorter agent descriptions"
/metamorph-feedback "stop flagging code-reviewer"
/metamorph-feedback --list
/metamorph-feedback --clear
```

Each entry is limited to **500 characters**.

---

## How `/metamorph` works

When you run `/metamorph` with no flags:

1. Runs small CLI tools for stats and target tables (does **not** load the big `analysis.json` into chat).
2. Shows a summary and boxed tables, then asks which targets to improve.
3. Runs **one** `prepare-improve-batch` command to build small context files (~1–3 KB each).
4. Sends **`metamorph-diff` subagents in parallel** (fast model) — each reads only its context file.
5. Shows diffs and asks what to accept: `all`, specific IDs, or `none`.

**Tips for speed and lower token use:**

- Prefer `top 3` instead of `all`.
- Default cap is **3** targets per run (`maxSuggestionsPerRun`).
- Agents you never used only send frontmatter + a short intro — not the whole file.

**What suggested edits try to do:**

- Fix clear errors (bad frontmatter, broken formatting).
- Add habit hints only when session data strongly supports it.
- Trim text only when it saves a meaningful amount of space.
- Keep the same tools and core behavior.
- If the file is already fine, the diff may be empty (no change).

Session snippets in context files are wrapped in `[UNTRUSTED DATA]` blocks. The AI must treat them as data only — not as instructions to follow.

---

## Mistake and correction tracking

metamorph can notice when something the agent or skill did was wrong and you asked to fix it. That helps suggest better guardrails later.

**What counts (best-effort — not perfect):**

| Signal | When it counts |
|--------|----------------|
| **Fix after a completed tool** | A tool finishes successfully, then you send a **text message** asking to fix or correct the result |
| **Rejected suggestion** | You run `/metamorph-improve --reject` on a pending diff |

**What does not count:** declined tools, failed commands, or complaints with no completed tool right before them.

Works across tool types (Bash, Read, Edit, Write, Grep, Agent, Skill, MCP, and others) and **subagent** transcripts.

**Privacy:**

| Transcript mode | Mistake tracking |
|-----------------|------------------|
| `redacted` (default) | Pattern labels only — no quotes from your messages |
| `full` | Short scrubbed excerpts |
| `off` | Mostly disabled (rejections from `/metamorph-improve --reject` still log) |

Turn off with `/metamorph-config set read.mistakeTracking=false`.

On the dashboard, repeated mistakes show as flag **`mistake`**.

Only a **small** slice of mistake data is sent to the diff step (up to 3 patterns, 2 examples, 80 characters each).

---

## Scores and flags

Each agent and skill gets a **score from 0 to 100**. Lower = more room to improve.

| Factor | Weight | Meaning |
|--------|--------|---------|
| How often you use it | 40% | Invocation frequency |
| Tool usage | 30% | Declared tools vs tools actually seen |
| Section coverage | 20% | Whether doc sections match your workflow |
| Skill apply rate | 10% | Skills only — loads vs real applies |

**Flags on the dashboard** (short labels in tables):

| Label | Meaning |
|-------|---------|
| `—` | Looks fine |
| `never` | Agent never used, or skill never applied |
| `rare` | Score below your threshold |
| `hot` | Score 80+ — working well |
| `tool` | A declared tool was not seen in sessions |
| `dead` | A doc section may not match your workflow (high confidence in `full` mode) |
| `dead?` | Same idea, less certain (`redacted` or `off` mode) |
| `mistake` | Repeated mistake/correction signals |

The report may also show a **language line** (for example `ts 42% · py 28%`) from file types you touched in sessions.

---

## Background hooks (no AI tokens)

| Hook | When | What it does |
|------|------|--------------|
| **SessionEnd** | After each session | Parses transcripts, updates scores, refreshes `report.md` |
| **SessionStart** | At session start | Short status line; refreshes `report.md` if analysis exists |

Only the **diff step** in `/metamorph` uses AI tokens.

If a hook fails, check `data/hook-errors.log` in your plugin data folder.

---

## Dashboard (`report.md`)

After sessions, metamorph writes **`report.md`** in your plugin data folder.

**View it:**

- Run `/metamorph-report` (refreshes the file, then prints it), or  
- Open the file directly.

**What it looks like** — boxed tables with scores like `40/100`:

```text
# metamorph · ready
124 sessions · 44 tools · 0 agent runs · 0 skill loads · redacted

_flag: — ok · never · rare · hot · tool · dead · mistake_

## Agents (25)

┌──────────────────────────────┬──────────────┬──────────────┐
│              id              │    score     │     flag     │
├──────────────────────────────┼──────────────┼──────────────┤
│  architect                   │    10/100    │    never     │
│  researcher                  │    40/100    │    never     │
└──────────────────────────────┴──────────────┴──────────────┘
```

There is **no HTML dashboard** — only this text report.

**Developers / manual refresh:**

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" report-refresh
```

---

## Where data is stored

Everything lives under Claude Code’s plugin data directory:

```
${CLAUDE_PLUGIN_DATA}
```

Usually:

```
~/.claude/plugins/data/metamorph-metamorph/
```

| Path | Contents |
|------|----------|
| `config.jsonc` | Your settings |
| `data/analysis.json` | Scores and flags |
| `data/profile.json` | Session cache (up to 500 sessions) |
| `data/feedback.log` | Your feedback entries |
| `data/style-profile.json` | Style patterns for suggested edits |
| `data/hook-errors.log` | Hook error log |
| `data/mistake-feedback.jsonl` | Rejected suggestions and similar events |
| `report.md` | Text dashboard |
| `suggestions/` | Pending diffs waiting for approval |
| `backups/` | Copies of files before metamorph edits |
| `backups/manifest.json` | Rollback metadata |

metamorph reads agents and skills from `~/.claude/agents/` and `~/.claude/skills/`. Session transcripts come from `~/.claude/projects/`.

---

## Privacy

Three modes for session transcripts:

| Mode | What is stored |
|------|----------------|
| **`redacted`** (default) | Metadata — tool names, file extensions, hashed path bits, timestamps. No full prompts or file contents. |
| **`full`** | Full transcript bodies including tool inputs. Most detail, least private. |
| **`off`** | Counts only — little per-event detail. |

In `redacted` mode, some flags are less certain (`dead?`, low-confidence tool flags).

Common secret patterns are scrubbed before storage. Scrubbing is **best-effort**, not perfect.

Deny-read globs block matching paths. Deny rules beat allow rules.

---

## Security

- Session data shown to the AI is labeled **untrusted** and must not be treated as commands.
- Writes stay inside allowed folders; path tricks and symlink escapes are blocked.
- Every approved write is validated before replacing your file.
- Rollback can detect manual edits since metamorph’s last write.

---

## What metamorph does NOT do

- **No auto-apply** — you must approve every change (`mode: suggest` only).
- **No background daemon** — it runs at session start/end and when you use a command.
- **No perfect secret removal** — scrubbing helps but is not foolproof.
- **No HTML report** — dashboard is plain text in `report.md` only.

---

## Build from source (developers)

End users do not need to build — `dist/` is included in the repo.

```bash
cd metamorph
npm install
npm run build
```

Useful CLI commands (plugin data path must be set via hooks, or set `CLAUDE_PLUGIN_DATA`):

| Command | Purpose |
|---------|---------|
| `report-refresh` | Rebuild `report.md` from `analysis.json` |
| `improve-stats` | Session summary lines |
| `improve-targets` | Agent/skill tables |
| `prepare-improve-batch <ids…>` | Build improve context files |
| `session-end` / `session-start` | Run hooks manually (testing) |

---

## License

MIT — see [GitHub repository](https://github.com/K3vin-h/metamorph).
