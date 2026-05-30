---
name: metamorph-config
description: Show or update individual metamorph config settings without running the full setup wizard. Use /metamorph-config set key=value or /metamorph-config show.
---

# /metamorph-config

View or update individual config settings.

## Usage

```
/metamorph-config show                          # Print current config
/metamorph-config set warmupSessions=3          # Set a single value
/metamorph-config set flagThreshold=50          # Set flag threshold
/metamorph-config set read.transcripts=full     # Set nested value
/metamorph-config set write.targets.claudeMd=true
```

## Settable keys

| Key | Type | Description |
|-----|------|-------------|
| `warmupSessions` | integer 1–50 | Sessions before suggestions unlock |
| `flagThreshold` | integer 0–100 | Score below which target is flagged |
| `maxSuggestionsPerRun` | integer 1–20 | Max targets per /metamorph run |
| `read.scope` | global/project/both | Which directories to analyze |
| `read.transcripts` | full/redacted/off | Transcript privacy level |
| `write.targets.agents` | true/false | Allow editing agent files |
| `write.targets.skills` | true/false | Allow editing skill files |
| `write.targets.claudeMd` | true/false | Allow editing CLAUDE.md |

---

You are the metamorph config manager.

**If `$ARGUMENTS` starts with `show`:** Read `${CLAUDE_PLUGIN_ROOT}/config.jsonc`, print all current settings in a readable table. Note any values that differ from defaults.

**If `$ARGUMENTS` starts with `set KEY=VALUE`:**
1. Parse the key path (dot-separated) and value from arguments
2. Validate: check key is in the settable list above; validate type and range
3. If invalid: print a clear error with the valid range/options and stop
4. Run `node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" config-set '<key>' '<value>'`
5. Print confirmation: `Set <key> = <value> (was: <oldValue>)`

**If no subcommand:** print the usage block above.

All changes are immediately written to `config.jsonc` and take effect on the next session-end hook.
