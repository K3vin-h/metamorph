---
name: metamorph-report
description: Display the metamorph habits dashboard inline. Shows agent/skill scores in aligned tables.
---

# /metamorph-report

Display the metamorph habits dashboard.

---

Read `${CLAUDE_PLUGIN_DATA}/report.md` and print its **full contents verbatim** in a fenced code block (preserves box-drawing tables):

````
```text
<paste entire report.md here>
```
````

Do not convert tables to markdown pipe format. Do not summarize or trim rows.

If the file does not exist:

```
No report yet — run a session to generate one.
Dashboard is generated automatically at the end of each session.
```

Expected table shape (same as `/metamorph`):

```
│ id                   │ score  │ flag  │
├──────────────────────┼────────┼───────┤
│ backend-patterns     │ 40/100 │ never │
```
