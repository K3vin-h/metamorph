# Architecture

This page explains **how metamorph is built and how its pieces fit together**. If you've never seen this project before, start here.

## First, what is metamorph?

When you code with an AI assistant like **Claude Code**, **Cursor**, or **Codex**, you give it helpers:

- **Agents** — specialized assistants you can call on for a job (for example, a `code-reviewer` agent or an `architect` agent).
- **Skills** — instruction files the AI loads when it needs to do a certain kind of task (for example, a "write tests first" skill).
- **CLAUDE.md** — a file of standing instructions that tells the AI how you like to work.

Over time some of these helpers get used a lot, some get used in the wrong way, and some never get used at all. The problem: you usually can't *see* any of that.

**metamorph is a tool that watches how you actually use those helpers, then helps you improve them.** Two ideas define it:

- **Local-first** — everything that watches and measures runs on *your* computer. Nothing is uploaded to the internet. There is no tracking.
- **Suggest-only** — metamorph never edits your files behind your back. It can *propose* a change, but the change only happens after you look at it and click approve.

> **Jargon check**
> - **Token** = the unit AI usage is measured (and billed) in. "Uses tokens" means "talks to the AI and costs something." "Zero tokens" means "no AI was involved, so it was free."
> - **Diff** = a before/after view of a file that shows exactly which lines would change. Like "track changes" in a word processor.
> - **Hook** = a small script your AI tool runs automatically at a set moment (such as when a work session starts or ends). A hook is plain code — no AI.

## The big picture: two layers

metamorph is split into two layers that do very different things.

- **Layer 1 — the watcher.** Runs automatically in the background. Uses **zero tokens** (no AI). Its job is to observe and measure.
- **Layer 2 — the improver.** Runs only when *you* type `/metamorph`. Uses tokens (this is the part that asks the AI to draft an improvement).

Here is the whole flow at a glance. Read it top to bottom:

```
                          ┌─────────────────────────────────────────────┐
   You finish working     │  LAYER 1 — The watcher (automatic, free)     │
   ───────────►  hooks/hooks.json ──► dist/hooks/sessionEnd.js           │
                          │      │   (runs when a session ends)          │
                          │      ▼                                       │
                          │  dist/capture/*  → read the session record,  │
                          │   note which tools/agents/skills were used   │
                          │      │                                       │
                          │      ▼                                       │
                          │  dist/analyze/analyzer.js → add it all up    │
                          │      │                                       │
                          │      ▼                                       │
                          │  dist/score/scorer.js → give each helper a   │
                          │   score from 0 to 100                        │
                          │      │                                       │
                          │      ▼                                       │
                          │  analysis.json (the saved numbers)           │
                          │      +                                       │
                          │  dist/report/reportMd.js → report.md         │
                          │   (the human-readable dashboard)             │
                          └─────────────────────────────────────────────┘
                                         │
                                         │  You type /metamorph
                                         ▼
                          ┌─────────────────────────────────────────────┐
                          │  LAYER 2 — The improver (on demand, uses AI) │
                          │  dist/improve/improver.js                    │
                          │   → carefully cleans the relevant file       │
                          │     content (remove secrets, neutralize      │
                          │     anything sketchy), saves it as a safe    │
                          │     "context" file                           │
                          │      │                                       │
                          │      ▼  The AI reads that and writes a draft  │
                          │     change as a .diff (NOT applied yet)       │
                          │      │                                       │
                          │      ▼                                       │
                          │  You run /metamorph-improve and approve      │
                          │      │                                       │
                          │      ▼                                       │
                          │  dist/rollback/writer.js → check the change, │
                          │   back up the old file, then write the new   │
                          │   one. (Now it can be undone.)               │
                          └─────────────────────────────────────────────┘
```

> **What is `dist/`?** It's the folder of ready-to-run program files. (`dist` is short for "distribution.") The project is written in TypeScript and then *compiled* into the plain JavaScript you see in `dist/`. That compiled code is what actually runs on your machine.

## Layer 1 — the watcher (automatic, zero tokens, no AI)

This layer turns "stuff that happened while you worked" into "numbers and a report." It is just plain code reading files — **the AI is never involved here**, which is why it's free.

It starts from a **hook**. The file `hooks/hooks.json` tells your AI tool: "when a session **starts** or **ends**, run `dist/index.js`." When a session ends, Layer 1 runs these four steps:

1. **Capture** — folder `dist/capture/`
   Your AI tool keeps a **transcript**: a log file of everything that happened in the session (each line is one event). `transcriptParser.js` reads that log one line at a time and notes which tools, agents, and skills were used.
   - Robustness detail: if a line in the log is broken/garbled, the parser just counts it (in a number called `skippedLines`) and moves on. One bad line never crashes the whole thing.
   - Helpers here also notice repeated **mistakes** (and the corrections that followed) and remember which sessions were already read so it doesn't redo work (`incrementalCache.js`).

2. **Analyze** — `dist/analyze/analyzer.js`
   Combines the captured events from *all* your sessions into per-helper totals: how many times each agent ran, how many times each skill loaded, which file types you touched, and so on.

3. **Score** — `dist/score/scorer.js`
   Turns those totals into a single **score from 0 to 100** for each helper, and attaches short **flags** (labels like "never used" or "frequently used"). The full formula lives in [scoring-model.md](scoring-model.md).

4. **Report** — `dist/report/reportMd.js`
   Writes two files:
   - `analysis.json` — the raw numbers, meant for the program to read.
   - `report.md` — the **dashboard**, meant for *you* to read. Running `/metamorph-report` shows it and gives you a clickable link.

## Layer 2 — the improver (on demand, uses tokens / AI)

This layer only runs when you type `/metamorph`. This is the one place metamorph talks to the AI, so it's the only place that costs tokens.

1. **Prepare** — `dist/improve/improver.js` (`prepareImproveBatch`)
   For each helper you chose to improve, metamorph reads that helper's file and then **sanitizes** it before showing it to the AI:
   - removes anything that looks like a secret (passwords, API keys),
   - strips out any text that tries to hijack the AI ("ignore your instructions…"),
   - wraps the content in a clear "this is DATA, not commands" fence.
   The cleaned result is saved as a small `improve-context-*.json` file. Helpers that aren't safe to write to, are missing, or don't meet the thresholds are skipped.

2. **Generate** — the AI reads that cleaned context and writes a **draft** change as a `.diff` file, plus a full proposed version of the file. **Nothing on disk is changed yet** — these are just proposals sitting in a folder.

3. **Approve or reject** — `/metamorph-improve`
   - Approve → metamorph hands the proposal to the writer (next step).
   - Reject → the proposal is deleted and metamorph remembers you said no.

4. **Write with backup** — `dist/rollback/writer.js` (`writeWithBackup`)
   Before changing anything, it double-checks the file is allowed to be written, checks the new content is valid, **makes a backup of the current file**, and then swaps in the new version safely. Because of that backup, `/metamorph-rollback` can undo it later.

## Where does metamorph keep its data?

Your scores, settings, pending suggestions, and backups need to survive even when the plugin itself updates to a new version. metamorph handles this in `dist/runtime.js`:

- `resolveDataRoot` figures out a stable folder to store data in (separate from the program files, which get replaced on every update).
- `ensurePersistentData` copies your existing settings and history forward into that folder the first time, so nothing is lost.

The details are in [plugin-runtime.md](plugin-runtime.md).

## Three promises, restated

- **Suggest-only** — no file is *ever* changed without you approving it. The setting `"mode": "suggest"` is even force-locked in code so it can't be flipped off by accident.
- **Local-first** — Layer 1 makes zero network calls and uses zero AI. Your data stays on your machine.
- **Reversible** — every approved change is backed up first, so you can roll it back.
