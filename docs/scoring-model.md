# Scoring Model

This page explains **how metamorph gives each helper a score**, and what the little labels (called **flags**) mean. The code that does all of this is `scoreTarget` in `dist/score/scorer.js`.

## What is the score, in plain words?

Every agent and skill gets a number from **0 to 100**. The score answers one question:

> **"How well does this helper's instruction file match how you actually use it?"**

Think of it like a report card for each helper. A **low** score isn't an insult — it usually just means "there's room to improve this one." A **high** score means "this one is pulling its weight and matches reality."

> **Jargon check**
> - **Target** = any single thing being scored — one agent or one skill. (metamorph calls them "targets" because the formula treats them the same way.)
> - **Invocation** = one time the helper was actually used. "Invoked 5 times" = "used 5 times."
> - **Declared tools** = the tools a helper *says* it needs (listed in its file). **Used tools** = the tools it was actually *seen* using.

## How the score is built: a weighted average

The final score is a **weighted average** of four smaller scores. "Weighted" means some parts count more than others. Here are the four parts and how much each one counts:

| Part of the score | How much it counts | What it measures |
|-------------------|--------------------|------------------|
| Invocation rate | **40%** | How often this helper gets used |
| Tool usage | **30%** | Does it actually use the tools it claims to need? |
| Section coverage | **20%** | Do the sections of its instructions actually get used? |
| Skill-apply rate | **10%** | (Skills only) When loaded, does it actually get applied? |

The math, simplified:

```
combined = (invocation × 0.40) + (tool × 0.30) + (section × 0.20) + (skillApply × 0.10)
score    = combined, rounded, then kept between 0 and 100
```

Let's walk through each of the four parts.

### Part 1 — Invocation rate (40%, the biggest piece)

This measures **how big a share of your usage goes to this helper**.

```
totalRuns       = total number of agent runs (or skill loads) across everything
invocationScore = (invocations ÷ totalRuns) × 100 × 5,  capped at 100
```

Why the `× 5`? Without it, a helper would need to be used in the *majority* of your sessions to look good — which is unfair, because you have many helpers and they share the work. The `× 5` means a helper that gets even **about 20% of the usage already maxes out** this part at 100. In short: it rewards "earns a meaningful share," not "dominates everything."

> **Worked example:** if you had 10 total agent runs and this agent was used twice, that's `2 ÷ 10 = 0.2` → `0.2 × 100 × 5 = 100`. Maxed out at just 20% share.

### Part 2 — Tool usage (30%)

A helper's file lists the tools it expects to use. This part checks whether it actually uses them.

```
toolScore = (number of declared tools that were actually used ÷ number of declared tools) × 100
```

- Declares 4 tools but only ever uses 2 → `2 ÷ 4 = 50`.
- Declares **no** tools → there's nothing to check, so it gets a neutral **100** (it isn't penalized for something it never claimed).

### Part 3 — Section coverage (20%)

Instruction files are organized into **sections** (markdown headings like "## Security" or "## Testing"). This part estimates whether each section is actually being put to use.

How it guesses (`computeSectionScore`): it keeps a small dictionary (`SECTION_KEYWORDS`) connecting section topics to the kinds of work that would use them. For example, a section about *testing* is linked to words like `test`, `spec`, `coverage`, `assert`, `tdd`. If you never did any testing-type work, a "Testing" section looks unused — metamorph calls that a **dead section**.

```
sectionScore = (sections that look used ÷ total sections) × 100
```

A helper with no sections gets a neutral **100**.

### Part 4 — Skill-apply rate (10%, skills only)

There's a difference between a skill being **loaded** (opened) and being **applied** (actually followed). A skill that gets opened but never followed isn't earning its place.

```
skillApply = (times applied ÷ times loaded) × 100
```

For **agents**, this part doesn't apply, so it's fixed at 100 and the other three parts effectively decide the score.

## Flags: the plain-English labels

Alongside the number, `scoreTarget` attaches **flags** — short labels that explain *why* a helper looks the way it does. These are what you see on the dashboard.

| Flag | When it appears | How sure metamorph is |
|------|-----------------|-----------------------|
| `never-invoked-agent` / `never-applied-skill` | The helper was used **0 times** | High |
| `rarely-used-agent` | It *was* used, but its score is below the threshold (default **40**) | Low |
| `hot-path` | Its score is **80 or higher** — a frequently used favorite | High |
| `unused-tool` | It lists a tool it was never seen using | Depends (see below) |
| `dead-section` / `low-confidence-dead-section` | A section looks unused — **only after 5+ uses** | Depends (see below) |
| `never-applied-skill` | A skill was loaded but **never applied** | High |
| `recurring-mistakes` | The same mistake keeps happening (2+ times) | High if 4+, else low |

The first three (`never` / `rarely` / `hot-path`) are mutually exclusive — a helper gets at most one of them, decided by its score. The rest can stack on top.

### Why wait for 5 uses before calling a section "dead"?

With only one or two uses, the keyword-matching guess is unreliable and would cry "dead section!" about sections that simply haven't had a chance to be used yet. So metamorph **stays quiet about dead sections until a helper has been used at least 5 times.** This avoids nagging you with false alarms on brand-new or rarely-used helpers.

### Why some flags are "low confidence"

How sure metamorph can be depends on your **privacy setting** (`read.transcripts`), explained in [privacy-model.md](privacy-model.md). In short:

- In **`full`** mode metamorph can see the actual tool calls, so it's confident.
- In **`redacted`** or **`off`** mode it only sees rough metadata (or nothing), so it can't be sure.

Because of that:

- `unused-tool` is **high** confidence in `full` mode, **low** otherwise.
- A dead section is reported as `dead-section` (high) only in `full` mode; in `redacted`/`off` it's softened to `low-confidence-dead-section` (low).

The rule is simple: **more privacy → metamorph is more cautious about the claims it makes.**

## One more detail: saved section text

When a section is flagged, metamorph saves a copy of just that section's text (so it can show the AI later). Before saving, it runs the text through `scrubSecrets` to remove anything secret. Only *flagged* sections are saved this way, which keeps the `analysis.json` file small. That saved snippet is later cleaned again and fenced as untrusted data before any AI ever sees it.
