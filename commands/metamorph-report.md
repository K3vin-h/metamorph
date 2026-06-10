---
name: metamorph-report
description: Display the metamorph habits dashboard inline and show a clickable Markdown report link.
---

# /metamorph-report

Run this command and print the output verbatim (no formatting changes, no truncation):

```bash
node "${CURSOR_PLUGIN_ROOT:-${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}}/dist/index.js" report-print
```

- If output is `No analysis.json found`, print that and stop.
- Print all output exactly as-is. The output already contains a clickable `## [metamorph report](file://...)` heading and a fenced code block — do not rewrap, reformat, or add any extra code fences.
- Show the complete Agents and Skills tables in full — never truncate rows, add ellipsis, or summarize.
