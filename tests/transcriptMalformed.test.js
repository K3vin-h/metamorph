"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { parseTranscript } = require("../dist/capture/transcriptParser.js");
const { mkTemp, rmTemp } = require("./_setup.js");

const CLAUDE_ROOT = path.join(os.homedir(), ".claude");
const DENY = [];

function writeJsonl(lines) {
  const dir = mkTemp("mm-tx-");
  const file = path.join(dir, "transcript.jsonl");
  fs.writeFileSync(file, lines.join("\n"), "utf8");
  return { dir, file };
}

test("malformed JSON lines increment skippedLines without throwing", async () => {
  const validLine = JSON.stringify({ type: "assistant", message: { role: "assistant", content: [] } });
  const { dir, file } = writeJsonl(["{not json", "also not json", validLine]);
  try {
    const profile = await parseTranscript(file, "s1", "redacted", DENY, CLAUDE_ROOT);
    assert.equal(profile.skippedLines, 2);
  } finally {
    rmTemp(dir);
  }
});

test("blank lines are ignored, not counted as skipped", async () => {
  const { dir, file } = writeJsonl(["", "   ", ""]);
  try {
    const profile = await parseTranscript(file, "s1", "redacted", DENY, CLAUDE_ROOT);
    assert.equal(profile.skippedLines, 0);
    assert.deepEqual(profile.toolCalls, []);
  } finally {
    rmTemp(dir);
  }
});

test("non-existent transcript yields an empty profile", async () => {
  const profile = await parseTranscript("/no/such/transcript.jsonl", "s1", "redacted", DENY, CLAUDE_ROOT);
  assert.equal(profile.skippedLines, 0);
  assert.deepEqual(profile.toolCalls, []);
  assert.deepEqual(profile.agentInvocations, {});
});

test("off mode parses without throwing and records no tool calls", async () => {
  const line = JSON.stringify({
    type: "assistant",
    message: { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "Read", input: { file_path: "x.ts" } }] },
  });
  const { dir, file } = writeJsonl([line]);
  try {
    const profile = await parseTranscript(file, "s1", "off", DENY, CLAUDE_ROOT);
    assert.deepEqual(profile.toolCalls, []);
  } finally {
    rmTemp(dir);
  }
});

test("a well-formed Agent tool_use line is captured as an agent invocation", async () => {
  const line = JSON.stringify({
    type: "assistant",
    message: {
      role: "assistant",
      content: [{ type: "tool_use", id: "t1", name: "Agent", input: { subagent_type: "architect" } }],
    },
  });
  const { dir, file } = writeJsonl([line]);
  try {
    const profile = await parseTranscript(file, "s1", "redacted", DENY, CLAUDE_ROOT);
    assert.equal(profile.skippedLines, 0);
    assert.equal(profile.agentInvocations.architect, 1);
  } finally {
    rmTemp(dir);
  }
});
