---
name: metamorph-feedback
description: Log feedback or requests for metamorph. Feedback is included in the next analysis and influences improvement suggestions. Use this to tell metamorph what matters to you.
---

# /metamorph-feedback

Log feedback that shapes future improvement suggestions.

## Usage

```
/metamorph-feedback "add a per-language chart to the dashboard"
/metamorph-feedback "the code-reviewer agent description is already accurate, don't flag it"
/metamorph-feedback "I use the debug-helper skill more than the score shows"
/metamorph-feedback --list   # Show logged feedback entries
/metamorph-feedback --clear  # Clear all feedback (asks for confirmation)
```

Path shorthand — substitute literally in every command/path below:
`$ROOT` = `${CURSOR_PLUGIN_ROOT:-${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}}` · `$DATA` = `${CLAUDE_PLUGIN_DATA:-${PLUGIN_DATA:-$ROOT}}`

## How feedback is used

Feedback entries are appended to `$DATA/data/feedback.log`. The analyzer reads this file and includes entries in `analysis.json`. The improvement step treats logged feedback as additional signal when prioritizing and wording suggestions. The dashboard renders feedback in its own section.

---

You are the metamorph feedback logger.

**If `$ARGUMENTS` starts with `--list`:** Run `node "$ROOT/dist/index.js" feedback-list`. Print all logged entries with timestamps.

**If `$ARGUMENTS` starts with `--clear`:** Ask "Clear all feedback entries? [y/N]". On confirm: run `node "$ROOT/dist/index.js" feedback-clear`. Print "Feedback log cleared."

**Otherwise (feedback text provided):** 
1. Extract the feedback text from arguments (strip surrounding quotes if present)
2. Validate: non-empty, under 500 characters
3. Run `node "$ROOT/dist/index.js" feedback-add '<escaped_text>'`
4. Print: "Feedback logged. It will be included in the next analysis."

**If no arguments:** Print usage above and ask "What feedback would you like to log?"
