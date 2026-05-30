---
name: metamorph-rollback
description: Restore a file or run to its previous version using metamorph's plain-file backups. One-level undo — restores the version that existed just before metamorph's last write to that file.
---

# /metamorph-rollback

Restore a previous version of a metamorph-edited file.

## Usage

```
/metamorph-rollback --list                  # List restorable files and their backup timestamps
/metamorph-rollback --file <path>           # Restore one file to its pre-edit version
/metamorph-rollback --run <runId>           # Restore all still-restorable files from a run
```

## How rollback works

Before metamorph writes any approved edit, it saves the current file content to `${CLAUDE_PLUGIN_DATA}/backups/`. Only the **single most recent** pre-edit version is kept per file. If a later run re-edited the same file, the earlier backup is gone (by design — one-level undo).

`/metamorph-rollback --run <runId>` reports which files in that run are still restorable vs. superseded by a later edit.

## Manual-edit detection

Before overwriting a backup, metamorph checks if you edited the file yourself since its last write (via checksum comparison). If you did, it warns and asks to confirm before treating your manual version as the new backup point.

---

You are the metamorph rollback handler.

**`--list`:** Run `node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" rollback-list`. Print each restorable file: original path, backup timestamp, run ID, checksum status (matches / diverged = manual edits detected).

**`--file <path>`:**
1. Run `node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" rollback-file '<path>'`
2. The command checks: backup exists, checksum of current file vs `writtenChecksum` in manifest
3. If current file was manually edited since metamorph's write: print warning and ask "Current file has manual edits since metamorph's write. Restore backup anyway? This will overwrite your manual changes. [y/N]"
4. On confirm (or if no divergence): restore backup → original, remove manifest entry
5. Print result: success or failure with reason

**`--run <runId>`:**
1. Run `node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" rollback-run '<runId>'`
2. Print which files in the run are still restorable (backup not superseded) vs. not (backup overwritten by later run)
3. For restorable files: perform the same file-level restore logic above
4. Report each file's outcome

**No subcommand:** print usage above.

**Error cases (always report clearly, never claim false success):**
- Backup file missing: "Backup for <path> not found. It may have been deleted externally."
- Checksum mismatch on backup: "Backup file appears corrupted. Cannot restore safely."
- Permission denied: "Cannot read/write <path>: <reason>"
