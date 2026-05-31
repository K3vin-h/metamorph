import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseTranscript } from "../dist/capture/transcriptParser.js";

const claudeRoot = "/Users/example/.claude";

function writeTranscript(lines) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "metamorph-transcript-"));
  const file = path.join(dir, "session.jsonl");
  fs.writeFileSync(file, lines.join("\n") + "\n", "utf8");
  return { dir, file };
}

describe("parseTranscript", () => {
  it("counts Cursor Task agents and Read skill loads", async () => {
    const { dir, file } = writeTranscript([
      JSON.stringify({
        role: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "task-1",
              name: "Task",
              input: { subagent_type: "code-reviewer" },
            },
          ],
        },
      }),
      JSON.stringify({
        role: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "read-1",
              name: "Read",
              input: { path: "/Users/example/.cursor/skills-cursor/graphify/SKILL.md" },
            },
          ],
        },
      }),
    ]);

    try {
      const profile = await parseTranscript(file, "cursor-session", "redacted", [], claudeRoot);

      assert.equal(profile.agentInvocations["code-reviewer"], 1);
      assert.equal(profile.agentCallMappings["task-1"], "code-reviewer");
      assert.equal(profile.skillLoads.graphify, 1);
      assert.equal(profile.skillApplied.graphify, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips malformed JSONL without failing the whole parse", async () => {
    const { dir, file } = writeTranscript([
      "not json",
      JSON.stringify({
        role: "assistant",
        message: {
          content: [
            { type: "tool_use", id: "task-2", name: "Task", input: { subagent_type: "researcher" } },
          ],
        },
      }),
    ]);

    try {
      const profile = await parseTranscript(file, "bad-json", "redacted", [], claudeRoot);

      assert.equal(profile.skippedLines, 1);
      assert.equal(profile.agentInvocations.researcher, 1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns an empty profile for missing transcript files", async () => {
    const profile = await parseTranscript(
      "/tmp/metamorph-missing-transcript.jsonl",
      "missing",
      "redacted",
      [],
      claudeRoot
    );

    assert.deepEqual(profile.agentInvocations, {});
    assert.deepEqual(profile.skillLoads, {});
    assert.equal(profile.toolCalls.length, 0);
  });
});
