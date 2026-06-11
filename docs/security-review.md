# Security Review

The threats a tool like metamorph must guard against, and exactly how it defends against each. metamorph reads your transcripts and files and can edit some of your files, so it has to be careful. Every risky action passes through several independent checks, and it can never write a file without your approval.

A security review is warranted because metamorph (1) reads files that may contain secrets, and (2) can write to your agent, skill, and `CLAUDE.md` files. Anything that reads sensitive data or writes files deserves scrutiny.

## Threats and controls

| Threat | Control | Location |
|------------------------------|------------------------|-------------------|
| Writing a file *outside* the allowed folders | Reject `..`, resolve the real path, confirm it's inside an allowed folder | `security.js#confinePath` |
| Using a symlink to escape to a forbidden location | Resolve the real location before trusting it | `security.js#confinePath` |
| Editing files you never permitted | Check the file's category against your allow/deny lists | `permissions.js#checkWritePermission` |
| Reading secret or off-limits files | Deny-read patterns + stay inside the home folder | `permissions.js#checkReadPermission` |
| Secrets leaking into saved data or to the model | Find-and-redact secret patterns | `security.js#scrubSecrets` |
| File content trying to hijack the model | Strip hijack phrases + fence content as data-only | `security.js#stripDirectives`, `wrapUntrusted` |
| A dangerous setting key corrupting the program | Allow only plain, safe key names | `config.js#setConfigValue` |
| A broken file replacing a good one | Validate content, then swap atomically | `writer.js#validateContent`, `writeWithBackup` |
| Silent or permanent changes you didn't want | Suggest-only approval + automatic backups | `improver.js`, `writer.js`, `rollback.js` |

The organizing principle is **defense-in-depth**: a write passes not one check but several — path safety **and** permission **and** content validity, in that order. If any check fails, the write is refused.

## Control 1 — path confinement (`confinePath`)

A symlink is a file that acts as a shortcut to somewhere else. Without care, a program told to write `notes.txt` could be fooled if `notes.txt` is secretly a shortcut to a system file. `confinePath` prevents this. It:

1. **Rejects any path containing `..`** outright (the directory-climb trick).
2. **Resolves the real path** of the target, following shortcuts. If the file doesn't exist yet, it resolves the real path of the *parent folder* first and appends the filename — catching symlink escapes a naive check would miss.
3. **Requires the real path to sit inside an allowed folder** (`~/.claude`, plus your current project folder). Anything outside is rejected.

## Control 2 — write permissions (`checkWritePermission`)

Even for a path inside the allowed folders, metamorph checks whether *that specific file* may be written, returning a clear reason on refusal:

- `path-traversal` — the path still contains a `..` trick.
- `outside-root` — the file isn't in the home folder (and isn't an approved `CLAUDE.md`).
- `category-disabled` — edits are turned off for that category (`agents`, `skills`, or `claudeMd`) in your settings.
- `deny-glob` — the file matches a "never write" pattern.
- `allow-glob-missing` — an "only write these" list is defined and this file isn't on it.

`CLAUDE.md` files get an extra rule: you choose whether metamorph may edit the **global** one, the **project-local** one, **both**, or neither (`claudeMdScopeAllowed`). The default is `both`, and legacy `true`/`false` settings are translated automatically (`parseClaudeMdScope`).

Glob matching itself is hardened: `**/` compiles to an unambiguous linear-time regex (no catastrophic backtracking), Windows backslash separators are normalized to slashes before matching so deny rules hold on every platform, and glob lists are capped (100 entries, 256 chars each) so a pathological config can't stall permission checks.

## Control 3 — read permissions (`checkReadPermission`)

The reading side, covered more fully in [privacy-model.md](privacy-model.md). It refuses to read anything that (a) sits outside your home folder or (b) matches a deny-read pattern like `**/*.env*`. The pattern matcher allows neither `..` nor absolute paths, and normalizes Windows separators before matching, so the deny list can't be dodged on any platform.

## Control 4 — config safety (`setConfigValue`)

Prototype pollution is a JavaScript attack: objects share a hidden parent (the *prototype*), so setting a key named `__proto__` can secretly change behavior for every object in the program.

When you change a setting (e.g. via `/metamorph-config set`), every segment of the setting's name must match a strict plain-identifier rule (`SAFE_KEY_RE` — letters/numbers/underscores, starting with a letter). Dangerous names like `__proto__`, `constructor`, or `prototype` are rejected with `Invalid config key segment`. Loading settings also falls back to safe defaults if the file is missing or broken, and every numeric setting is clamped to a sensible range.

## Control 5 — content validation (`validateContent`)

Before `writeWithBackup` writes anything, it inspects the proposed content and refuses it if:

- it is **larger than 1 MB** (agent/skill files are kilobyte-scale; anything near a megabyte is malformed or hostile),
- it has a YAML header but is **missing the required `name` or `description`** field, or
- it has an **unbalanced code fence** — an odd number of ` ``` ` lines, usually meaning the file was cut off.

Only after it passes does metamorph write to a temporary file, **back up the current file**, and atomically rename the temp file into place — an all-or-nothing swap, so you never end up with a half-written file. Rollback uses the same fence check (`validateBackupContent`) to confirm a backup isn't corrupted before restoring it.

## Control 6 — suggest-only with backups

The strongest protection isn't a single check — it's the shape of the whole system:

- **Layer 1 never writes files at all.** It only watches and reports.
- **Layer 2 only writes after approval.** `"mode": "suggest"` is force-locked in code (`mergeWithDefaults` always resets it to `"suggest"`), so it can't be turned off.
- Typing `/metamorph` only creates *proposals* in a folder. Your real files aren't touched.
- `/metamorph-improve` is the **only** path to a write, and only on approval. Rejecting deletes the proposal.
- Every approved write makes a **backup first**, so `/metamorph-rollback` can undo it. metamorph also detects whether you edited the file by hand since its last write and warns before overwriting.
- If the backup index (`backups/manifest.json`) becomes corrupted, metamorph logs a clear error to `data/hook-errors.log` instead of silently losing your rollback history.

## Contributor checklist

If you change the code, keep these true:

- [ ] Any new "write a file" path goes through `confinePath` **and** `checkWritePermission`.
- [ ] Any file content shown to the model is cleaned in order: `scrubSecrets` → `stripDirectives` → `wrapUntrusted`.
- [ ] Any new setting key is covered by the safe-name guard and clamped to a valid range.
- [ ] Any new writer validates content and backs up before overwriting.
- [ ] No code path can write a file without explicit user approval.
