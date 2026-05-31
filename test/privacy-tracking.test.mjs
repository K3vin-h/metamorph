import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterTranscriptEvent } from "../dist/privacy.js";
import { extractSkillIdFromPath, isAgentTool } from "../dist/skillPath.js";

const claudeRoot = "/Users/example/.claude";

function assistant(content) {
  return {
    type: "assistant",
    role: "assistant",
    content,
    timestamp: "2026-05-31T00:00:00.000Z",
  };
}

describe("skill path extraction", () => {
  it("extracts skills from Claude, Cursor, and Windows-style paths", () => {
    assert.equal(
      extractSkillIdFromPath("/Users/example/.claude/skills/graphify/SKILL.md"),
      "graphify"
    );
    assert.equal(
      extractSkillIdFromPath("/Users/example/.cursor/skills-cursor/security-review/SKILL.md"),
      "security-review"
    );
    assert.equal(
      extractSkillIdFromPath("C:\\Users\\x\\.claude\\skills\\python-patterns\\skill.md"),
      "python-patterns"
    );
  });

  it("does not treat unrelated SKILL.md files as plugin skills", () => {
    assert.equal(extractSkillIdFromPath("/tmp/SKILL.md"), undefined);
    assert.equal(extractSkillIdFromPath("/Users/example/project/src/index.ts"), undefined);
  });
});

describe("privacy event tracking", () => {
  it("treats Cursor Task as an agent tool", () => {
    assert.equal(isAgentTool("Task"), true);
    assert.equal(isAgentTool("Agent"), true);
    assert.equal(isAgentTool("Read"), false);
  });

  it("redacted mode preserves agent and skill IDs without full tool input", () => {
    const events = filterTranscriptEvent(
      assistant([
        { type: "tool_use", name: "Task", input: { subagent_type: "code-reviewer" } },
        {
          type: "tool_use",
          name: "Read",
          input: { path: "/Users/example/.cursor/skills-cursor/graphify/SKILL.md" },
        },
      ]),
      "cursor-1",
      "redacted",
      [],
      claudeRoot
    );

    assert.equal(events[0].agentId, "code-reviewer");
    assert.equal(events[0].toolInput, undefined);
    assert.equal(events[1].skillId, "graphify");
    assert.equal(events[1].toolInput, undefined);
  });

  it("full mode keeps scrubbed tool input plus agent and skill metadata", () => {
    const fakeSecret = "sk-" + "abcdefghijklmnop";
    const events = filterTranscriptEvent(
      assistant([
        {
          type: "tool_use",
          name: "Task",
          input: { subagent_type: "security-reviewer", prompt: `token ${fakeSecret}` },
        },
        {
          type: "tool_use",
          name: "Read",
          input: { path: "/Users/example/.claude/skills/python-patterns/SKILL.md" },
        },
      ]),
      "full-1",
      "full",
      [],
      claudeRoot
    );

    assert.equal(events[0].agentId, "security-reviewer");
    assert.equal(events[0].toolInput.prompt, "token [REDACTED]");
    assert.equal(events[1].skillId, "python-patterns");
    assert.ok(events[1].toolInput);
  });

  it("blocks denied non-skill reads but still counts skill reads", () => {
    const events = filterTranscriptEvent(
      assistant([
        {
          type: "tool_use",
          name: "Read",
          input: { path: "/Users/example/.claude/projects/app/secrets.env" },
        },
        {
          type: "tool_use",
          name: "Read",
          input: { path: "/Users/example/.claude/skills/security-review/SKILL.md" },
        },
      ]),
      "deny-1",
      "redacted",
      ["projects/**/secrets*"],
      claudeRoot
    );

    assert.equal(events.length, 1);
    assert.equal(events[0].skillId, "security-review");
  });

  it("off mode emits no events", () => {
    const events = filterTranscriptEvent(
      assistant([{ type: "tool_use", name: "Task", input: { subagent_type: "x" } }]),
      "off-1",
      "off",
      [],
      claudeRoot
    );

    assert.deepEqual(events, []);
  });
});
