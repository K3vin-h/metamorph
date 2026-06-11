# Scoring Model

How metamorph scores each target and what the flags mean. The implementation is `scoreTarget` in `dist/score/scorer.js`.

## What the score measures

Every agent and skill (collectively, **targets**) gets a number from **0 to 100**. The score answers one question:

> How well does this target's instruction file match how you actually use it?

A low score isn't always bad— it usually means there's room to improve. A high score means the target is pulling its weight and doing what it should be doing. An **invocation** is one use; **declared tools** are the tools a target's file says it needs, and **used tools** are the ones it was observed using.

## The formula

The final score is a weighted average of four sub-scores:

| Component | Weight | What it measures |
|-------------------|--------|------------------|
| Invocation rate | **40%** | How often the target is used |
| Tool usage | **30%** | Whether it uses the tools it declares |
| Section coverage | **20%** | Whether its instruction sections get used |
| Skill-apply rate | **10%** | (Skills only) Whether a loaded skill is applied |

```
combined = (invocation × 0.40) + (tool × 0.30) + (section × 0.20) + (skillApply × 0.10)
score    = round(combined), clamped to 0–100
```

### Invocation rate (40%)

The target's share of your total usage.

```
totalRuns       = total agent runs (or skill loads) across everything
invocationScore = (invocations ÷ totalRuns) × 100 × 5,  capped at 100
```

The `× 5` exists because you have many targets sharing the work — without it, a target would need to dominate the majority of sessions to look good. With it, a target that earns roughly **20% of the usage already maxes out** this component. It rewards a meaningful share, not total dominance.

> Example: 10 total agent runs, this agent used twice → `2 ÷ 10 = 0.2` → `0.2 × 100 × 5 = 100`. Maxed at 20% share.

### Tool usage (30%)

A target's file lists the tools it expects to use; this checks whether it actually uses them.

```
toolScore = (declared tools actually used ÷ declared tools) × 100
```

- Declares 4 tools, uses 2 → `2 ÷ 4 = 50`.
- Declares no tools → nothing to check, so it scores a neutral **100** (no penalty for something it never claimed).

### Section coverage (20%)

Instruction files are organized into **sections** (markdown headings like `## Security` or `## Testing`). This component estimates whether each section is actually used.

`computeSectionScore` keeps a dictionary (`SECTION_KEYWORDS`) mapping section topics to the work that would use them — a testing section maps to `test`, `spec`, `coverage`, `assert`, `tdd`. If you never did testing-type work, a "Testing" section looks unused, which metamorph calls a **dead section**.

```
sectionScore = (sections that look used ÷ total sections) × 100
```

A target with no sections scores a neutral **100**.

### Skill-apply rate (10%, skills only)

A skill can be **loaded** (opened) without being **applied** (actually followed). A skill that loads but is never followed isn't earning its place.

```
skillApply = (times applied ÷ times loaded) × 100
```

For agents this component doesn't apply and is fixed at 100, leaving the other three to decide the score.

## Flags

Alongside the number, `scoreTarget` attaches **flags** — short labels that explain why a target looks the way it does. These appear on the dashboard.

| Flag | When it appears | Confidence |
|------|-----------------|------------|
| `never-invoked-agent` / `never-applied-skill` | Used **0 times** | High |
| `rarely-used-agent` | Used, but score is below the threshold (default **40**) | Low |
| `hot-path` | Score **≥ 80** — a frequently used favorite | High |
| `unused-tool` | Declares a tool never seen in use | Depends (below) |
| `dead-section` / `low-confidence-dead-section` | A section looks unused — **only after 5+ uses** | Depends (below) |
| `never-applied-skill` | A skill loaded but was never applied | High |
| `recurring-mistakes` | The same mistake repeats (2+ times) | High if 4+, else low |

The first three (`never` / `rarely` / `hot-path`) are mutually exclusive — a target gets at most one, decided by its score. The rest can stack.

### Why a section needs 5+ uses before it's "dead"

With only one or two uses, the keyword guess is unreliable and would flag sections that simply haven't had a chance to be used yet. metamorph stays quiet about dead sections until a target has been used at least **5 times**, which suppresses false alarms on new or rarely-used targets.

### Why some flags are low-confidence

Confidence depends on your privacy setting (`read.transcripts`), covered in [privacy-model.md](privacy-model.md):

- In `full` mode metamorph sees the actual tool calls, so it's confident.
- In `redacted` or `off` mode it sees only rough metadata (or nothing), so it can't be sure.

Consequently:

- `unused-tool` is **high** confidence in `full` mode, **low** otherwise.
- A dead section is reported as `dead-section` (high) only in `full` mode; in `redacted`/`off` it's softened to `low-confidence-dead-section` (low).

The rule: more privacy → more caution about the claims metamorph makes.

## Saved section text

When a section is flagged, metamorph saves a copy of just that section's text so it can show the model later. The text passes through `scrubSecrets` first to remove secrets. Only flagged sections are saved, which keeps `analysis.json` small. That snippet is cleaned again and fenced as untrusted data before any model sees it.
