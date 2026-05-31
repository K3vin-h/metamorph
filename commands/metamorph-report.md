---
name: metamorph-report
description: Display the metamorph habits dashboard inline and show a clickable Markdown report link.
---

# /metamorph-report

Display the metamorph habits dashboard and a clickable Markdown link to the saved report.

---

**Step 1 — Print report (required).** The CLI resolves the correct plugin data directory, regenerates `report.md`, prints a clickable Markdown link, and prints the terminal-friendly report:

```bash
node "${CURSOR_PLUGIN_ROOT:-${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}}/dist/index.js" report-print
```

If output is `No analysis.json found`, print that and stop.

**Step 2 — Display.** Print the `Report file:` line as Markdown so the `report.md` link stays clickable, then print the report body exactly as the CLI emitted it:

````
<paste report-print output here>
````

Rules:
- Do **not** convert tables to markdown pipes or plain `id / sc / flag` columns.
- Do **not** summarize or skip rows.
- Preserve box-drawing lines exactly (`│`, `├`, `┼`, `┤`, `─`).
- Do **not** wrap the `Report file:` line in a code block.
- Do **not** guess the report path from environment variables; use the `Report file:` line printed by the CLI.

Expected table shape (full box, spaced cells):

```
┌──────────────────────────────┬──────────────┬──────────────┐
│              id              │    score     │     flag     │
├──────────────────────────────┼──────────────┼──────────────┤
│  backend-patterns            │    40/100    │  inactive    │
└──────────────────────────────┴──────────────┴──────────────┘
```

If `report-refresh` succeeded but the file is missing, say so and suggest running a session.
