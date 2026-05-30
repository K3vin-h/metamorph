---
name: metamorph-setup
description: Interactive setup wizard for metamorph. Configure read scope, write permissions, read privacy level, warm-up count, and flag threshold. Re-runnable at any time. All settings are saved to persistent plugin data.
---

# /metamorph-setup

Interactive configuration wizard. Re-run any time to change settings.

## Usage

```
/metamorph-setup          # Full interactive wizard
/metamorph-setup --reset  # Reset to factory defaults then run wizard
```

---

You are the metamorph setup wizard. Walk the user through each setting interactively.

Print a welcome banner:
```
metamorph setup wizard
Settings are saved to ${CLAUDE_PLUGIN_DATA}/config.jsonc
Press Enter to keep the current value [shown in brackets]
```

Read the current config from `${CLAUDE_PLUGIN_DATA}/config.jsonc` (fall back to defaults if missing/invalid).

Ask each question in order. For each, show the current value in brackets. Accept Enter to keep it.

**1. Read scope**
```
Read scope — which ~/.claude directories to analyze?
  [1] global   — ~/.claude only
  [2] project  — current project .claude/ only
  [3] both     — both (default)
Current: [both] > 
```

**2. Transcript privacy**
```
Transcript privacy — how much of session transcripts to read?
  [1] full      — read transcript bodies (tool inputs, commands, prompts). Highest fidelity.
  [2] redacted  — metadata only: tool names, file extensions, hashed paths, timestamps (default)
  [3] off       — counts only; no per-event detail
Current: [redacted] > 
```
After selection, print a one-line explanation of what is and is NOT stored.

**3. Write targets**
```
Write targets — which file types may metamorph propose edits to?
  agents   (current: enabled ) — toggle? [y/N] 
  skills   (current: enabled ) — toggle? [y/N] 
  CLAUDE.md (current: disabled) — toggle? [y/N] 
```

**4. Warm-up sessions**
```
Warm-up sessions — collect data for N sessions before offering suggestions
Current: [5] > 
```
Validate: integer 1–50.

**5. Flag threshold**
```
Flag threshold — score below which a target is flagged for improvement (0–100)
Current: [40] > 
```
Validate: integer 0–100.

**6. Deny-read globs** (show current list, offer to add/remove)
```
Deny-read globs — file patterns to never read (current list below)
  projects/**/secrets*
  **/*.env*
Add a pattern (or Enter to skip): 
Remove a pattern by number (or Enter to skip): 
```

After all questions, show a summary diff of changes and ask:
```
Save these settings? [Y/n] 
```

On confirm: write the updated config to `${CLAUDE_PLUGIN_DATA}/config.jsonc` using `node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" config-write '<json>'`.

Print confirmation:
```
Settings saved to ${CLAUDE_PLUGIN_DATA}/config.jsonc
Run /metamorph to see your dashboard.
```
