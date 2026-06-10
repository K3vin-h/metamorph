# Plugin Runtime

This page explains **how metamorph is packaged, how it starts and stops, and how it keeps your data safe across updates.** "Runtime" just means "the stuff that matters while the program is actually running."

## One plugin, three homes

metamorph is a **plugin** — an add-on you install into an AI coding tool. The neat part: the *same* program (`dist/index.js`) runs inside three different tools — **Claude Code**, **Cursor**, and **Codex**. Each tool just needs its own little "ID card" file (a **manifest**) describing the plugin, and its own list of **hooks**.

> **Jargon check**
> - **Manifest** = a small file (usually `.json`) that describes the plugin: its name, version, where its commands live, etc. Each host tool reads its own manifest.
> - **Hook** = a script the host runs automatically at a specific moment (session start, session end). No AI — just plain code.
> - **Entrypoint** = the single file the program starts from. Here it's `dist/index.js`.

| Host tool | Its manifest | Its hooks file | What it exposes |
|-----------|-------------|----------------|-----------------|
| Claude Code | `.claude-plugin/plugin.json` (+ `marketplace.json`) | `hooks/hooks.json` | `commands/`, `agents/` |
| Cursor | `.cursor-plugin/plugin.json` | `hooks/cursor-hooks.json` | `commands/` |
| Codex | `.codex-plugin/plugin.json` | `hooks/hooks.json` | `codex-skills/` |

All of these manifests list the **same version number**. (There's even an automated test, `tests/packageValidation.test.js`, that fails the build if they ever drift apart.)

Each hooks file ends up running the same command — just with a host-specific way of saying "where am I installed?":

```
node "<plugin-folder>/dist/index.js" session-start    # when a session begins
node "<plugin-folder>/dist/index.js" session-end      # when a session ends
```

(Claude and Codex use `SessionStart`/`SessionEnd`; Cursor uses lowercase `sessionStart`/`sessionEnd`. Same idea, slightly different spelling.)

## The commands you can type

These are the slash-commands metamorph adds. They live as Markdown files in `commands/`, each starting with a small `name`/`description` header.

| Command | What it does |
|---------|--------------|
| `/metamorph` | Look at your habits and let you pick helpers to improve |
| `/metamorph-report` | Show the habits dashboard and a clickable link to `report.md` |
| `/metamorph-setup` | A friendly wizard to set things up (privacy, what can be edited, thresholds) |
| `/metamorph-config` | Change one setting at a time, without the full wizard |
| `/metamorph-improve` | Approve or reject a pending suggestion |
| `/metamorph-rollback` | Undo a change — restore a file to its previous version |
| `/metamorph-feedback` | Leave a note that influences the next analysis |

The setup wizards for each host live in `dist/setup/` (`setupCodex.js`, `setupCursor.js`, `symlinkPlugin.js`).

## What happens during a work session (the lifecycle)

1. **Session starts** → the host runs `dist/hooks/sessionStart.js`.
   It figures out where your data lives, makes sure that data exists, and refreshes `report.md` so your dashboard is up to date the moment you open it.
2. **You work normally.** metamorph does **nothing** during the session — it doesn't watch you live, doesn't interrupt, and doesn't use AI. It just stays out of the way.
3. **Session ends** → the host runs `dist/hooks/sessionEnd.js`.
   This is when the Layer 1 watcher runs: read the session log → add up usage → score each helper → write the report. (Full details in [architecture.md](architecture.md).)
4. **Whenever you choose** → typing `/metamorph` runs Layer 2, the only step that uses AI/tokens.

**Both hooks fail gently.** Each has a time limit (10 seconds for start, 60 for end) and if anything goes wrong, the error is quietly logged by `dist/hookErrors.js` instead of crashing your session.

## Keeping your data safe when the plugin updates

Here's a problem every plugin faces: when you update to a new version, the plugin's program files get **replaced**. If metamorph kept your scores and settings *inside* those files, an update would wipe them out.

metamorph avoids this by storing your data in a **separate, stable folder** that updates don't touch. The logic is in `dist/runtime.js`:

- **`resolveDataRoot`** decides where your data folder is. If an environment variable like `CLAUDE_PLUGIN_DATA` is set, it uses that. Otherwise it figures it out from the install path — translating the throw-away install location `plugins/cache/{publisher}/{name}/{version}/` into the permanent home `plugins/data/{publisher}-{name}/`.
- **`ensurePersistentData`** runs the first time and **copies your existing settings and history forward** into that permanent folder — but only files that aren't already there (`copyPathIfMissing`), so it never overwrites newer data. One thing it deliberately does **not** copy is `report.md`, because the report is always freshly regenerated from `analysis.json` (copying an old one would show stale numbers).

Here's what ends up living in that permanent data folder:

| File / folder | What's inside |
|---------------|---------------|
| `config.jsonc` | Your settings (privacy, what's editable, thresholds) |
| `analysis.json` | The added-up usage numbers and scores (for the program) |
| `report.md` | The dashboard (for you) |
| `suggestions/` | Pending `.diff` proposals waiting for your approval |
| `data/` | Working files like `improve-context-*.json` and `proposed-*.md` |
| `backups/` | Saved copies of files + a `manifest.json`, used for rollback |

That separation is the reason your scores, settings, and undo history all survive a plugin update.
