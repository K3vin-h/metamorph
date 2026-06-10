"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

test("every command file exists with YAML frontmatter", () => {
  const cmdDir = path.join(ROOT, "commands");
  const files = fs.readdirSync(cmdDir).filter((f) => f.endsWith(".md"));
  assert.ok(files.length > 0, "no command files found");
  for (const f of files) {
    const text = fs.readFileSync(path.join(cmdDir, f), "utf8");
    assert.match(text, /^---\s*\n[\s\S]*?name:\s*\S/, `${f} missing frontmatter name`);
  }
});

test("hook manifests parse and reference existing dist entrypoints", () => {
  const hookFiles = ["hooks/hooks.json", "hooks/cursor-hooks.json"];
  for (const rel of hookFiles) {
    const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.doesNotThrow(() => JSON.parse(text), `${rel} is not valid JSON`);
    const distRefs = [...new Set(text.match(/dist\/[A-Za-z0-9_/-]+\.js/g) ?? [])];
    assert.ok(distRefs.length > 0, `${rel} references no dist entrypoint`);
    for (const ref of distRefs) {
      assert.ok(fs.existsSync(path.join(ROOT, ref)), `${rel} references missing file: ${ref}`);
    }
  }
});

test("agents directory is present and non-empty", () => {
  const agents = fs.readdirSync(path.join(ROOT, "agents")).filter((f) => f.endsWith(".md"));
  assert.ok(agents.length > 0, "agents directory has no .md files");
});

test("all three host plugin manifests parse", () => {
  for (const rel of [".claude-plugin/plugin.json", ".codex-plugin/plugin.json", ".cursor-plugin/plugin.json"]) {
    const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.doesNotThrow(() => JSON.parse(text), `${rel} is not valid JSON`);
  }
});
