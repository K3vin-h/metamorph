"use strict";
// Tests for the production-hardening audit fixes:
// glob translation, separator normalization, config caps, feedback bounds,
// scorer NaN guards, corrupt-cache recovery, and mistake-summary scrubbing.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { mkTemp, rmTemp } = require("./_setup.js");

const { matchGlob } = require("../dist/permissions.js");
const { mergeWithDefaults, DEFAULTS } = require("../dist/config.js");
const { scoreTarget } = require("../dist/score/scorer.js");

test("matchGlob: **/ matches nested and zero-depth paths", () => {
  assert.ok(matchGlob("**/secrets*", "projects/a/b/secrets.txt"));
  assert.ok(matchGlob("**/secrets*", "secrets.txt"));
  assert.ok(matchGlob("skills/*/SKILL.md", "skills/tdd/SKILL.md"));
  assert.ok(!matchGlob("skills/*/SKILL.md", "skills/tdd/deep/SKILL.md"));
});

test("matchGlob: near-miss long paths complete fast (no catastrophic backtracking)", () => {
  const longPath = "a/".repeat(50) + "not-a-match";
  const start = Date.now();
  assert.ok(!matchGlob("**/secrets*", longPath));
  assert.ok(Date.now() - start < 1000, "glob match should be linear-time");
});

test("matchGlob: Windows backslash separators match slash-based globs", () => {
  assert.ok(matchGlob("projects/**/secrets*", "projects\\foo\\secrets.txt"));
  assert.ok(matchGlob("agents/*", "agents\\architect.md"));
});

test("mergeWithDefaults caps glob list size and entry length", () => {
  const merged = mergeWithDefaults({
    read: { denyGlobs: Array.from({ length: 150 }, (_, i) => `glob-${i}/*`) },
    write: { allow: ["x".repeat(300), "agents/*"], deny: [] },
  });
  assert.equal(merged.read.denyGlobs.length, 100);
  assert.deepEqual(merged.write.allow, ["agents/*"], "over-length glob dropped");
});

test("scoreTarget returns a finite score when totals are missing", () => {
  const result = scoreTarget(
    {
      id: "t", path: "agents/t.md", invocations: 2,
      declaredTools: [], usedTools: [], sections: [],
      rawContent: "", loads: 0, applied: 0,
    },
    {}, // corrupted analysis: no agentRuns/skillLoads
    DEFAULTS,
    "agent",
  );
  assert.ok(Number.isFinite(result.score), `score should be finite, got ${result.score}`);
});

test("addFeedback enforces the documented 500-char cap and trims the log file", () => {
  const root = mkTemp("mm-fb-");
  try {
    const { addFeedback, readFeedbackEntries } = require("../dist/feedback.js");
    addFeedback(root, "x".repeat(900));
    const entries = readFeedbackEntries(root);
    assert.equal(entries[0].length, 500);
    for (let i = 0; i < 230; i++) addFeedback(root, `entry ${i}`);
    const lines = fs.readFileSync(path.join(root, "data", "feedback.log"), "utf8")
      .split("\n").filter((l) => l.trim());
    assert.ok(lines.length <= 200, `log file should be trimmed, has ${lines.length} lines`);
  } finally {
    rmTemp(root);
  }
});

test("corrupt profile.json is renamed .corrupt and an empty cache returned", () => {
  const root = mkTemp("mm-cache-");
  try {
    const dataDir = path.join(root, "data");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, "profile.json"), "{not json", "utf8");
    const { readProfileCache } = require("../dist/capture/incrementalCache.js");
    const cache = readProfileCache(root);
    assert.deepEqual(cache, { sessions: {}, failedSessions: {} });
    assert.ok(fs.existsSync(path.join(dataDir, "profile.json.corrupt")), "corrupt file kept for forensics");
    assert.ok(!fs.existsSync(path.join(dataDir, "profile.json")), "corrupt file moved aside");
  } finally {
    rmTemp(root);
  }
});

test("recordSuggestionRejected scrubs secrets before writing to disk", () => {
  const root = mkTemp("mm-mf-");
  try {
    // Assembled at runtime so scanners never see a token-shaped literal
    const fakeToken = "ghp" + "_" + "AbCdEfGh1234567890AbCdEfGh1234567890AbCd";
    const { recordSuggestionRejected, readPersistedMistakeEvents } = require("../dist/mistakeFeedback.js");
    recordSuggestionRejected(root, "agent", "architect", `leaked ${fakeToken} in diff`);
    const raw = fs.readFileSync(path.join(root, "data", "mistake-feedback.jsonl"), "utf8");
    assert.ok(!raw.includes(fakeToken), "token must not reach disk");
    assert.ok(raw.includes("[REDACTED]"));
    const events = readPersistedMistakeEvents(root);
    assert.equal(events.length, 1);
  } finally {
    rmTemp(root);
  }
});
