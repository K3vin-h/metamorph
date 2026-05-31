---
name: metamorph-report
description: Display the metamorph habits dashboard inline and show a clickable Markdown report link.
---

# /metamorph-report

Run this command and print the output verbatim (no formatting changes):

```bash
node "${CURSOR_PLUGIN_ROOT:-${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}}/dist/index.js" report-print
```

- If output is `No analysis.json found`, print that and stop.
- Print the `Report file:` line as-is (not in a code block) so the link stays clickable.
- Print the report body in a code block, preserving all box-drawing characters exactly.
