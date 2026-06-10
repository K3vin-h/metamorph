# Demo Plan — 60–90s

A reproducible walkthrough of the full metamorph loop: **install → observe → report → improve → inspect → approve/reject → rollback**. Target length 60–90s. No code execution is required to follow this script; it is a shot list + asset checklist for recording.

## Goal

Show, end to end, that metamorph is a **local-first, suggest-only** observability + improvement tool: it watches real usage, surfaces findings, proposes a reviewable diff, applies it only on approval, and can undo it.

## Pre-recording checklist

- [ ] Clean terminal, large readable font, 1280×720+ capture.
- [ ] A host with metamorph installed (Claude Code shown here; Cursor/Codex equivalent).
- [ ] At least one agent or skill with an obvious finding (e.g. an `inactive` or `unused-tool` flag) so the dashboard is interesting.
- [ ] Recorder ready: `asciinema rec demo.cast` for terminal-only, or screen capture (ScreenStudio/OBS) if showing the host UI.
- [ ] Optional: pre-warm so the dashboard reads `ready` (default warm-up is 5 sessions) — or briefly show the warm-up state, it tells a story too.

## Shot list (with timing)

| # | Beat | On screen | ~time |
|---|------|-----------|-------|
| 1 | **Install** | `/plugin marketplace add K3vin-h/metamorph` → `/plugin install metamorph` → `/metamorph-setup` (accept defaults: redacted transcripts, suggest-only) | 0:00–0:12 |
| 2 | **Observe** | Open/close a couple of sessions (or fast-forward). Narrate: "metamorph parses transcripts locally at session end — zero tokens, no network." | 0:12–0:22 |
| 3 | **Report** | `/metamorph-report` → dashboard renders inline with scores + flags and a clickable `report.md` link. Hover a flag like `inactive` / `unused-tool`. | 0:22–0:38 |
| 4 | **Request improvement** | `/metamorph` → pick one flagged target. Narrate: "Only this step uses tokens, and only on the sanitized context." | 0:38–0:50 |
| 5 | **Inspect the diff** | Open the generated `.diff` in `suggestions/`. Emphasize it's a **surgical** proposed change — nothing written yet. | 0:50–1:02 |
| 6 | **Approve & reject** | `/metamorph-improve` reject one suggestion ("No files changed"), then approve another → "validated, backed up, then written." | 1:02–1:18 |
| 7 | **Rollback** | `/metamorph-rollback --list` then restore the approved change → file returns to its previous version. | 1:18–1:30 |

## Exact command sequence (reproducible)

```text
/plugin marketplace add K3vin-h/metamorph
/plugin install metamorph
/metamorph-setup            # accept defaults (suggest-only, redacted)
# ... run a couple of normal sessions ...
/metamorph-report          # show dashboard + report.md link
/metamorph                 # select a flagged target → generates a .diff
# open suggestions/<run>-<target>.diff to inspect
/metamorph-improve         # reject one, then approve one
/metamorph-rollback --list # see restorable backups
/metamorph-rollback <file> # undo the approved change
```

## Key lines to say

- "Everything before the improve step is local and free — no tokens, no telemetry."
- "metamorph never auto-applies. You review every diff first."
- "Validated, backed up, then written — and one command undoes it."

## Deliverable assets (pick 2 of 3)

- [ ] **Terminal recording** (`asciinema` cast or MP4) of the sequence above.
- [ ] **Annotated dashboard screenshot** (`report.md` rendered) highlighting a score + flag.
- [ ] **Before/after diff still** showing the proposed `.diff` and the rollback confirmation.
