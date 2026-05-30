---
name: metamorph-report
description: Display the metamorph habits dashboard inline. Shows agent/skill scores grouped by flag type.
---

# /metamorph-report

Display the metamorph habits dashboard.

---

Read the file at `${CLAUDE_PLUGIN_DATA}/report.md` and print its full contents inline.

If the file does not exist, print:
```
No report yet — run a session to generate one.
Dashboard is generated automatically at the end of each session.
```
