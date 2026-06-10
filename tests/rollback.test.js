"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { writeWithBackup, readManifest } = require("../dist/rollback/writer.js");
const { rollbackFile } = require("../dist/rollback/rollback.js");
const { DEFAULTS } = require("../dist/config.js");
const { mkTemp, rmTemp, setupProjectClaudeMd } = require("./_setup.js");

// DEFAULTS.write.targets.claudeMd === "both", so a project-local .claude/CLAUDE.md
// is inside the allowed write roots — letting us exercise the real write/restore path.

test("writeWithBackup then rollbackFile restores the prior content and clears the manifest entry", async () => {
  const project = setupProjectClaudeMd("ORIGINAL\n");
  const pluginRoot = mkTemp("mm-plugin-");
  try {
    const write = await writeWithBackup(project.target, "IMPROVED\n", "run-1", DEFAULTS, pluginRoot);
    assert.ok(write.ok, write.error);
    assert.equal(fs.readFileSync(project.target, "utf8"), "IMPROVED\n");

    const restore = await rollbackFile(pluginRoot, project.relPath);
    assert.ok(restore.ok, restore.error);
    assert.equal(fs.readFileSync(project.target, "utf8"), "ORIGINAL\n");
    assert.equal(readManifest(pluginRoot).entries[project.relPath], undefined);
  } finally {
    rmTemp(pluginRoot);
    project.restore();
  }
});

test("a corrupted backup (unbalanced code fence) is refused", async () => {
  const project = setupProjectClaudeMd("ORIGINAL\n");
  const pluginRoot = mkTemp("mm-plugin-");
  try {
    await writeWithBackup(project.target, "IMPROVED\n", "run-1", DEFAULTS, pluginRoot);
    const entry = readManifest(pluginRoot).entries[project.relPath];
    fs.writeFileSync(entry.backupPath, "```js\nunclosed fence\n", "utf8");

    const restore = await rollbackFile(pluginRoot, project.relPath);
    assert.equal(restore.ok, false);
    assert.match(restore.error, /corrupt/i);
  } finally {
    rmTemp(pluginRoot);
    project.restore();
  }
});

test("rollback of an unknown path fails cleanly", async () => {
  const pluginRoot = mkTemp("mm-plugin-");
  try {
    const res = await rollbackFile(pluginRoot, "/no/such/path");
    assert.equal(res.ok, false);
    assert.match(res.error, /No backup found/);
  } finally {
    rmTemp(pluginRoot);
  }
});

test("a corrupted manifest.json is recovered as empty without throwing", () => {
  const pluginRoot = mkTemp("mm-plugin-");
  try {
    const backupsDir = path.join(pluginRoot, "backups");
    fs.mkdirSync(backupsDir, { recursive: true });
    fs.writeFileSync(path.join(backupsDir, "manifest.json"), "{not valid json", "utf8");
    assert.deepEqual(readManifest(pluginRoot), { entries: {} });
  } finally {
    rmTemp(pluginRoot);
  }
});

test("oversize proposed content (>1MB) is rejected before any write", async () => {
  const project = setupProjectClaudeMd("ORIGINAL\n");
  const pluginRoot = mkTemp("mm-plugin-");
  try {
    const huge = "x".repeat(1024 * 1024 + 1);
    const res = await writeWithBackup(project.target, huge, "run-1", DEFAULTS, pluginRoot);
    assert.equal(res.ok, false);
    assert.match(res.error, /exceeds/);
    assert.equal(fs.readFileSync(project.target, "utf8"), "ORIGINAL\n");
  } finally {
    rmTemp(pluginRoot);
    project.restore();
  }
});

test("a metamorph-created file (no backup) refuses restore", async () => {
  const pluginRoot = mkTemp("mm-plugin-");
  try {
    const backupsDir = path.join(pluginRoot, "backups");
    fs.mkdirSync(backupsDir, { recursive: true });
    const manifest = {
      entries: {
        "agents/new.md": {
          originalPath: path.join(pluginRoot, "agents", "new.md"),
          backupPath: null,
          runId: "run-x",
          timestamp: new Date().toISOString(),
          writtenChecksum: "abc",
        },
      },
    };
    fs.writeFileSync(path.join(backupsDir, "manifest.json"), JSON.stringify(manifest), "utf8");

    const res = await rollbackFile(pluginRoot, "agents/new.md");
    assert.equal(res.ok, false);
    assert.match(res.error, /No backup/);
  } finally {
    rmTemp(pluginRoot);
  }
});
