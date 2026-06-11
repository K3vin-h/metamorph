---
name: metamorph-improve
description: Approve or reject a pending metamorph improvement suggestion. Run after /metamorph generates diffs. Approved changes are validated, backed up, then written.
---

# /metamorph-improve

Approve or reject a pending improvement suggestion.

## Usage

```
/metamorph-improve --list                          # List pending suggestions
/metamorph-improve --approve <runId>-<targetId>    # Apply an approved diff
/metamorph-improve --reject  <runId>-<targetId>    # Discard a suggestion
/metamorph-improve --approve all                   # Approve all pending for latest run
/metamorph-improve --reject  all                   # Reject all pending
```

Path shorthand — substitute literally in every command/path below:
`$ROOT` = `${CURSOR_PLUGIN_ROOT:-${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}}` · `$DATA` = `${CLAUDE_PLUGIN_DATA:-${PLUGIN_DATA:-$ROOT}}`

## What happens on approval

The CLI applies the diff to a temp copy, validates it (frontmatter keys, balanced code fences), backs up the current file to `$DATA/backups/`, then writes atomically and updates the backup manifest. Validation failure leaves the original untouched.

---

You are the metamorph approval handler.

**`--list`:** Run `node "$ROOT/dist/index.js" improve-list`. Group results by run ID. For each group print:
```
Run <runId>:
  <runId>-<targetId>  score:<N>  <top-flag>  (+N/-N lines)
  <runId>-<targetId>  score:<N>  <top-flag>  (+N/-N lines)
```
If none, print "No pending suggestions. Run /metamorph to generate new ones."
To approve any suggestion from any run: `/metamorph-improve --approve <runId>-<targetId>`

**`--approve <id>` or `--approve all`:**
1. Run `node "$ROOT/dist/index.js" improve-approve '<id>'`
2. The command handles: diff application to temp, validation, backup, atomic write, manifest update
3. Print the result for each file: success (with backup path) or failure (with reason)
4. On success: print rollback reminder: "To undo: /metamorph-rollback --file <path>"

**`--reject <id>` or `--reject all`:**
1. Run `node "$ROOT/dist/index.js" improve-reject '<id>'`
2. Deletes the suggestion file(s) from `$DATA/suggestions/`
3. Print confirmation: "Rejected <id>. No files were changed."

**No subcommand:** print usage above.
