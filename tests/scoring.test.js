"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { scoreTarget } = require("../dist/score/scorer.js");

const TOTALS = { agentRuns: 10, skillLoads: 10 };

function makeData(overrides = {}) {
  return {
    id: "x",
    path: "agents/x.md",
    invocations: 0,
    declaredTools: [],
    usedTools: [],
    sections: [],
    rawContent: "",
    loads: 0,
    applied: 0,
    mistakePatterns: [],
    ...overrides,
  };
}

function makeConfig(transcripts = "full") {
  return { flagThreshold: 40, read: { transcripts } };
}

function hasFlag(result, type) {
  return result.flags.some((f) => f.type === type);
}

test("never-invoked agent is flagged never-invoked-agent", () => {
  const result = scoreTarget(makeData({ invocations: 0 }), TOTALS, makeConfig(), "agent");
  assert.ok(hasFlag(result, "never-invoked-agent"));
});

test("never-loaded skill is flagged never-applied-skill", () => {
  const result = scoreTarget(makeData({ invocations: 0 }), TOTALS, makeConfig(), "skill");
  assert.ok(hasFlag(result, "never-applied-skill"));
});

test("heavily used agent with full tool coverage is a hot-path scoring >= 80", () => {
  const result = scoreTarget(
    makeData({ invocations: 10, declaredTools: ["Read"], usedTools: ["Read"] }),
    TOTALS,
    makeConfig(),
    "agent",
  );
  assert.ok(result.score >= 80);
  assert.ok(hasFlag(result, "hot-path"));
});

test("dead sections are suppressed below 5 invocations", () => {
  const result = scoreTarget(
    makeData({ invocations: 3, sections: ["## Security"], rawContent: "## Security\nstuff" }),
    TOTALS,
    makeConfig("full"),
    "agent",
  );
  assert.ok(!hasFlag(result, "dead-section"));
  assert.ok(!hasFlag(result, "low-confidence-dead-section"));
});

test("dead section flagged high-confidence in full mode at 5+ invocations", () => {
  const result = scoreTarget(
    makeData({ invocations: 5, sections: ["## Security"], rawContent: "## Security\nstuff" }),
    TOTALS,
    makeConfig("full"),
    "agent",
  );
  assert.ok(hasFlag(result, "dead-section"));
});

test("dead section downgraded to low-confidence in redacted mode", () => {
  const result = scoreTarget(
    makeData({ invocations: 5, sections: ["## Security"], rawContent: "## Security\nstuff" }),
    TOTALS,
    makeConfig("redacted"),
    "agent",
  );
  assert.ok(hasFlag(result, "low-confidence-dead-section"));
  assert.ok(!hasFlag(result, "dead-section"));
});

test("unused tool confidence depends on privacy mode", () => {
  const base = { invocations: 2, declaredTools: ["Read", "Grep"], usedTools: ["Read"] };
  const full = scoreTarget(makeData(base), TOTALS, makeConfig("full"), "agent");
  const redacted = scoreTarget(makeData(base), TOTALS, makeConfig("redacted"), "agent");
  const fullFlag = full.flags.find((f) => f.type === "unused-tool" && f.target === "Grep");
  const redactedFlag = redacted.flags.find((f) => f.type === "unused-tool" && f.target === "Grep");
  assert.equal(fullFlag.confidence, "high");
  assert.equal(redactedFlag.confidence, "low");
});

test("recurring mistakes escalate to high confidence at 4+ occurrences", () => {
  const result = scoreTarget(
    makeData({ invocations: 3, mistakePatterns: [{ count: 4 }] }),
    TOTALS,
    makeConfig(),
    "agent",
  );
  const flag = result.flags.find((f) => f.type === "recurring-mistakes");
  assert.equal(flag.confidence, "high");
});

test("score is always clamped to 0..100", () => {
  const result = scoreTarget(
    makeData({ invocations: 9999, declaredTools: ["Read"], usedTools: ["Read"] }),
    TOTALS,
    makeConfig(),
    "agent",
  );
  assert.ok(result.score >= 0 && result.score <= 100);
});
