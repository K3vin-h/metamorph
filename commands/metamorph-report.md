---
name: metamorph-report
description: Display the metamorph habits dashboard inline. Shows agent/skill scores in aligned tables.
---

# /metamorph-report

Display the metamorph habits dashboard.

---

**Step 1 — Refresh report (required).** Regenerates `report.md` with current table format:

```bash
node "${CURSOR_PLUGIN_ROOT:-${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}}/dist/index.js" report-refresh
```

If output is `No analysis.json found`, print that and stop.

**Step 2 — Display.** Read `${CLAUDE_PLUGIN_DATA:-${PLUGIN_DATA:-${CURSOR_PLUGIN_ROOT:-${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}}}}/report.md` and print its **full contents verbatim** inside a fenced code block:

````
```text
<paste entire report.md here>
```
````

Rules:
- Do **not** convert tables to markdown pipes or plain `id / sc / flag` columns.
- Do **not** summarize or skip rows.
- Preserve box-drawing lines exactly (`│`, `├`, `┼`, `┤`, `─`).

Expected table shape (full box, spaced cells):

```
┌──────────────────────────────┬──────────────┬──────────────┐
│              id              │    score     │     flag     │
├──────────────────────────────┼──────────────┼──────────────┤
│  backend-patterns            │    40/100    │  inactive   │
└──────────────────────────────┴──────────────┴──────────────┘
```

If `report-refresh` succeeded but the file is missing, say so and suggest running a session.
