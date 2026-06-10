"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

const pkg = readJson("package.json");
const claudePlugin = readJson(".claude-plugin/plugin.json");
const marketplace = readJson(".claude-plugin/marketplace.json");
const codexPlugin = readJson(".codex-plugin/plugin.json");
const cursorPlugin = readJson(".cursor-plugin/plugin.json");

test("version is identical across every manifest", () => {
  const versions = [
    pkg.version,
    claudePlugin.version,
    marketplace.plugins[0].version,
    codexPlugin.version,
    cursorPlugin.version,
  ];
  for (const v of versions) {
    assert.equal(v, pkg.version, `version mismatch: ${JSON.stringify(versions)}`);
  }
});

test("package.json declares required fields and an existing main entry", () => {
  assert.equal(pkg.name, "metamorph");
  assert.ok(pkg.main, "package.json missing main");
  assert.ok(fs.existsSync(path.join(ROOT, pkg.main)), `main entry missing: ${pkg.main}`);
});

test("plugin manifests declare a name", () => {
  assert.equal(claudePlugin.name, "metamorph");
  assert.equal(marketplace.name, "metamorph");
  assert.ok(codexPlugin.name);
  assert.ok(cursorPlugin.name);
});
