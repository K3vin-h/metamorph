"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const { writeWithBackup } = require("../dist/rollback/writer.js");
const { DEFAULTS } = require("../dist/config.js");
const { mkTemp, rmTemp, setupProjectClaudeMd } = require("./_setup.js");

// writeWithBackup runs validateContent on the proposed content before touching disk.
// These tests assert that gate rejects malformed proposals and accepts well-formed ones.

async function attemptWrite(content) {
  const project = setupProjectClaudeMd();
  const pluginRoot = mkTemp("mm-plugin-");
  try {
    return await writeWithBackup(project.target, content, "run-1", DEFAULTS, pluginRoot);
  } finally {
    rmTemp(pluginRoot);
    project.restore();
  }
}

test("frontmatter missing required keys is rejected", async () => {
  const res = await attemptWrite("---\nname: thing\n---\nbody\n");
  assert.equal(res.ok, false);
  assert.match(res.error, /Frontmatter missing required keys/);
});

test("unclosed code fence is rejected", async () => {
  const res = await attemptWrite("intro text\n```js\ncode without a closing fence\n");
  assert.equal(res.ok, false);
  assert.match(res.error, /Unclosed code fence/);
});

test("well-formed content passes validation and is written", async () => {
  const project = setupProjectClaudeMd();
  const pluginRoot = mkTemp("mm-plugin-");
  try {
    const content = "# Title\n\n```js\nconst x = 1;\n```\n";
    const res = await writeWithBackup(project.target, content, "run-1", DEFAULTS, pluginRoot);
    assert.ok(res.ok, res.error);
    assert.equal(fs.readFileSync(project.target, "utf8"), content);
  } finally {
    rmTemp(pluginRoot);
    project.restore();
  }
});
