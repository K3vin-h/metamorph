# Security Review

This page explains **the dangers a tool like metamorph has to guard against, and exactly how it defends against each one.** metamorph reads your transcripts and files and is *able* to edit some of your files — so it has to be careful. The good news: every risky action passes through several independent safety checks, and it can never write a file without your approval.

> **Why does this need a security review at all?** Because metamorph (1) reads files that might contain secrets, and (2) can write to your agent/skill/`CLAUDE.md` files. Anything that reads sensitive data or writes files deserves a careful look.

## The dangers, and the defense for each

| The danger (in plain words) | How metamorph stops it | Where in the code |
|------------------------------|------------------------|-------------------|
| Tricking it into writing a file *outside* the allowed folders | Reject `..` tricks, then resolve the real path and confirm it's inside an allowed folder | `security.js#confinePath` |
| Using a **symlink** (a shortcut file) to escape to a forbidden place | Resolve the real location of the folder *before* trusting it | `security.js#confinePath` |
| Editing files you never said it could edit | Check the file's category and your allow/deny lists | `permissions.js#checkWritePermission` |
| Reading secret or off-limits files | Deny-read patterns + stay inside the home folder | `permissions.js#checkReadPermission` |
| Secrets leaking into saved data or to the AI | Find-and-redact secret patterns | `security.js#scrubSecrets` |
| File content trying to hijack the AI ("ignore your instructions") | Strip hijack phrases + fence content as "data only" | `security.js#stripDirectives`, `wrapUntrusted` |
| Sneaking a dangerous setting key in to corrupt the program | Only allow plain, safe key names | `config.js#setConfigValue` |
| A broken/half-written file replacing a good one | Validate the new content, then swap it in atomically | `writer.js#validateContent`, `writeWithBackup` |
| Silent or permanent changes you didn't want | Suggest-only approval + automatic backups | `improver.js`, `writer.js`, `rollback.js` |

The key idea below is **defense-in-depth**: a write doesn't pass *one* check, it passes *several* — path safety **and** permission **and** content validity — in that order. If any check fails, the write is refused.

## Defense 1 — staying inside allowed folders (`confinePath`)

> **What's a symlink?** A symlink ("symbolic link") is a file that's really a shortcut pointing somewhere else. Without care, a program told to write to `notes.txt` could be fooled if `notes.txt` is secretly a shortcut to a system file.

`confinePath` is metamorph's bouncer. It:

1. **Rejects any path containing `..`** outright (that's the "climb up a folder" trick).
2. **Resolves the real path** of the target (following any shortcuts). If the file doesn't exist yet, it resolves the real path of the *parent folder* first and then adds just the filename — this catches symlink escapes that a naive check would miss.
3. **Requires the real path to sit inside an allowed folder** (your `~/.claude` folder, plus your current project folder). Anything outside → rejected.

## Defense 2 — write permissions (`checkWritePermission`)

Even for a path that's inside the allowed folders, metamorph still checks whether *that specific file* is allowed to be written. It answers with a clear reason if it says no:

- `path-traversal` — the path still contains a `..` trick.
- `outside-root` — the file isn't in the home folder (and isn't an approved `CLAUDE.md`).
- `category-disabled` — you turned off edits for that category (`agents`, `skills`, or `claudeMd`) in your settings.
- `deny-glob` — the file matches a pattern in your "never write these" list.
- `allow-glob-missing` — you defined an "only write these" list and this file isn't on it.

`CLAUDE.md` files get an extra rule: you choose whether metamorph may edit the **global** one, the **project-local** one, **both**, or neither (`claudeMdScopeAllowed`). The default is `both`, and old `true`/`false` settings are translated automatically (`parseClaudeMdScope`).

## Defense 3 — read permissions (`checkReadPermission`)

This is the reading side, covered more fully in [privacy-model.md](privacy-model.md). It refuses to read anything that (a) sits outside your home folder or (b) matches a deny-read pattern like `**/*.env*`. The pattern matcher won't allow `..` or absolute paths, so the deny list can't be dodged.

## Defense 4 — protecting the settings file (`setConfigValue`)

> **What's "prototype pollution"?** In JavaScript, objects share a hidden parent called the *prototype*. If an attacker can set a key named `__proto__`, they can secretly change behavior for *every* object in the program — a classic, sneaky attack.

When you change a setting (for example via `/metamorph-config set`), every part of the setting's name must match a strict "plain identifier" rule (`SAFE_KEY_RE` = letters/numbers/underscores, starting with a letter). Dangerous names like `__proto__`, `constructor`, or `prototype` are flat-out rejected with `Invalid config key segment`. On top of that, loading settings always falls back to safe defaults if the file is missing or broken, and every number setting is clamped to a sensible range.

## Defense 5 — checking content before writing (`validateContent`)

Before `writeWithBackup` writes anything, it inspects the proposed content and refuses it if:

- it is **larger than 1 MB** (agent/skill files are kilobyte-scale; anything near a megabyte is malformed or hostile),
- it has a YAML header but is **missing the required `name` or `description`** fields, or
- it has an **unbalanced code fence** — an odd number of ` ``` ` lines, which usually means the file got cut off.

Only after it passes does metamorph write to a temporary file, **back up the current file**, and then atomically rename the temp file into place (an all-or-nothing swap, so you never end up with a half-written file). Rollback uses the same fence check (`validateBackupContent`) to make sure a backup isn't corrupted before restoring it.

## Defense 6 — the big one: suggest-only with backups

The strongest protection isn't a single check — it's the **shape** of the whole system:

- **Layer 1 never writes files at all.** It only watches and reports.
- **Layer 2 only writes after you approve.** The setting `"mode": "suggest"` is even force-locked in code (`mergeWithDefaults` always sets it back to `"suggest"`), so it can't be turned off.
- Typing `/metamorph` only creates *proposals* in a folder. Your real files aren't touched.
- `/metamorph-improve` is the **only** path that leads to a write, and only on approval. Rejecting deletes the proposal.
- Every approved write makes a **backup first**, so `/metamorph-rollback` can undo it. metamorph even notices if *you* edited the file by hand since its last write, and warns you before overwriting.
- If the backup index (`backups/manifest.json`) ever becomes corrupted, metamorph logs a clear error to `data/hook-errors.log` instead of silently losing your rollback history.

## Checklist for anyone changing the code

If you contribute to metamorph, keep these true:

- [ ] Any new "write a file" path goes through `confinePath` **and** `checkWritePermission`.
- [ ] Any file content shown to the AI is cleaned in order: `scrubSecrets` → `stripDirectives` → `wrapUntrusted`.
- [ ] Any new setting key is covered by the safe-name guard and clamped to a valid range.
- [ ] Any new writer validates content and backs up before overwriting.
- [ ] No code path can ever write a file without an explicit user approval.
