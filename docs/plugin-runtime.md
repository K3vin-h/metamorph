# Plugin Runtime

How metamorph is packaged, how it starts and stops, and how it preserves your data across updates.

## One plugin, three hosts

metamorph is a plugin — an add-on installed into an AI coding tool. The same program (`dist/index.js`) runs inside three hosts: **Claude Code**, **Cursor**, and **Codex**. Each host needs its own **manifest** (a small `.json` describing the plugin — name, version, where commands live) and its own hooks file. The **entrypoint** is always `dist/index.js`.

| Host | Manifest | Hooks file | Exposes |
|-----------|-------------|----------------|-----------------|
| Claude Code | `.claude-plugin/plugin.json` (+ `marketplace.json`) | `hooks/hooks.json` | `commands/`, `agents/` |
| Cursor | `.cursor-plugin/plugin.json` | `hooks/cursor-hooks.json` | `commands/` |
| Codex | `.codex-plugin/plugin.json` | `hooks/hooks.json` | `codex-skills/` |

Every manifest lists the **same version number**. An automated test, `tests/packageValidation.test.js`, fails the build if they ever drift apart.

Each hooks file runs the same command, with a host-specific way of naming the install location:

```
node "<plugin-folder>/dist/index.js" session-start    # when a session begins
node "<plugin-folder>/dist/index.js" session-end      # when a session ends
```

Claude and Codex use `SessionStart`/`SessionEnd`; Cursor uses lowercase `sessionStart`/`sessionEnd`. Same behavior, different spelling.

## Commands

metamorph's slash-commands live as Markdown files in `commands/`, each opening with a `name`/`description` header.

| Command | What it does |
|---------|--------------|
| `/metamorph` | Review your habits and pick targets to improve |
| `/metamorph-report` | Show the dashboard and a clickable link to `report.md` |
| `/metamorph-setup` | Setup wizard (privacy, write targets, thresholds) |
| `/metamorph-config` | Change one setting without the full wizard |
| `/metamorph-improve` | Approve or reject a pending suggestion |
| `/metamorph-rollback` | Undo a change — restore a file to its previous version |
| `/metamorph-feedback` | Leave a note that influences the next analysis |

Per-host setup wizards live in `dist/setup/` (`setupCodex.js`, `setupCursor.js`, `symlinkPlugin.js`).

## Session lifecycle

1. **Session starts** → the host runs `dist/hooks/sessionStart.js`. It resolves your data location, ensures the data exists, and refreshes `report.md` so the dashboard is current the moment you open it.
2. **You work normally.** metamorph does nothing during the session — no live watching, no interruptions, no AI. It stays out of the way.
3. **Session ends** → the host runs `dist/hooks/sessionEnd.js`. This is when Layer 1 runs: read the session log → tally usage → score each target → write the report. (Details in [architecture.md](architecture.md).)
4. **On demand** → `/metamorph` runs Layer 2, the only step that uses AI/tokens.

Both hooks fail gracefully. Each has a time limit (10s for start, 60s for end), and any error is logged by `dist/hookErrors.js` rather than crashing your session.

## Data persistence across updates

Every plugin faces the same problem: updating to a new version replaces the program files. If metamorph kept your scores and settings inside those files, an update would wipe them.

metamorph stores your data in a separate, stable folder that updates don't touch. The logic is in `dist/runtime.js`:

- **`resolveDataRoot`** decides where the data folder is. If an environment variable like `CLAUDE_PLUGIN_DATA` is set, it uses that; otherwise it derives it from the install path, translating the throwaway install location `plugins/cache/{publisher}/{name}/{version}/` into the permanent home `plugins/data/{publisher}-{name}/`.
- **`ensurePersistentData`** runs once and copies existing settings and history forward into that permanent folder — but only files not already present (`copyPathIfMissing`), so it never overwrites newer data. It deliberately does **not** copy `report.md`, which is always regenerated fresh from `analysis.json` (an old copy would show stale numbers).

What lives in the permanent data folder:

| File / folder | Contents |
|---------------|----------|
| `config.jsonc` | Your settings (privacy, write targets, thresholds) |
| `analysis.json` | Tallied usage numbers and scores (for the program) |
| `report.md` | The dashboard (for you) |
| `suggestions/` | Pending `.diff` proposals awaiting approval |
| `data/` | Working files like `improve-context-*.json` and `proposed-*.md` |
| `backups/` | Saved file copies plus a `manifest.json`, used for rollback |

That separation is why your scores, settings, and undo history all survive a plugin update.
