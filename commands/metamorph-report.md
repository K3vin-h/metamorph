---
name: metamorph-report
description: Display the metamorph habits dashboard inline and show where the Markdown report is saved.
---

# /metamorph-report

Display the metamorph habits dashboard and the Markdown file path.

---

**Step 1 — Print report (required).** The CLI resolves the correct plugin data directory, regenerates `report.md`, prints its path, and prints the terminal-friendly report:

```bash
node "${CURSOR_PLUGIN_ROOT:-${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}}/dist/index.js" report-print
```

If output is `No analysis.json found`, print that and stop.

**Step 2 — Display.** Print the command output **verbatim**. It already includes the saved Markdown file path and a fenced terminal report:

````
<paste report-print output here>
````

Rules:
- Do **not** convert tables to markdown pipes or plain `id / sc / flag` columns.
- Do **not** summarize or skip rows.
- Preserve box-drawing lines exactly (`│`, `├`, `┼`, `┤`, `─`).
- Do **not** guess the report path from environment variables; use the `Report file:` line printed by the CLI.

Expected table shape (full box, spaced cells):

```
┌──────────────────────────────┬──────────────┬──────────────┐
│              id              │    score     │     flag     │
├──────────────────────────────┼──────────────┼──────────────┤
│  backend-patterns            │    40/100    │  inactive   │
└──────────────────────────────┴──────────────┴──────────────┘
```

If `report-refresh` succeeded but the file is missing, say so and suggest running a session.
