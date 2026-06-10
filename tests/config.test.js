"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { mergeWithDefaults, loadConfig, setConfigValue, DEFAULTS } = require("../dist/config.js");
const { mkTemp, rmTemp } = require("./_setup.js");

test("mergeWithDefaults returns defaults for non-object input", () => {
  assert.deepEqual(mergeWithDefaults(null), DEFAULTS);
  assert.deepEqual(mergeWithDefaults("nope"), DEFAULTS);
});

test("numeric settings are clamped to their valid ranges", () => {
  const high = mergeWithDefaults({ warmupSessions: 999, flagThreshold: 500, improve: { minScore: 200 } });
  assert.equal(high.warmupSessions, 50);
  assert.equal(high.flagThreshold, 100);
  assert.equal(high.improve.minScore, 100);

  const low = mergeWithDefaults({ warmupSessions: 0, flagThreshold: -10 });
  assert.equal(low.warmupSessions, 1);
  assert.equal(low.flagThreshold, 0);
});

test("invalid types fall back to defaults", () => {
  const merged = mergeWithDefaults({ warmupSessions: "x", read: { transcripts: "bogus" } });
  assert.equal(merged.warmupSessions, DEFAULTS.warmupSessions);
  assert.equal(merged.read.transcripts, DEFAULTS.read.transcripts);
});

test("claudeMd scope parsing (true -> both, false -> false, passthrough, invalid -> default)", () => {
  assert.equal(mergeWithDefaults({ write: { targets: { claudeMd: true } } }).write.targets.claudeMd, "both");
  assert.equal(mergeWithDefaults({ write: { targets: { claudeMd: false } } }).write.targets.claudeMd, false);
  assert.equal(mergeWithDefaults({ write: { targets: { claudeMd: "local" } } }).write.targets.claudeMd, "local");
  assert.equal(
    mergeWithDefaults({ write: { targets: { claudeMd: "weird" } } }).write.targets.claudeMd,
    DEFAULTS.write.targets.claudeMd,
  );
});

test("denyGlobs keeps only string entries", () => {
  const merged = mergeWithDefaults({ read: { denyGlobs: ["**/*.env", 42, null, "secrets*"] } });
  assert.deepEqual(merged.read.denyGlobs, ["**/*.env", "secrets*"]);
});

test("loadConfig on a missing file returns defaults", () => {
  assert.deepEqual(loadConfig("/path/that/does/not/exist"), DEFAULTS);
});

test("loadConfig strips JSONC comments before parsing", () => {
  const root = mkTemp("mm-cfg-");
  try {
    const jsonc = [
      "{",
      '  // line comment with a fake "string"',
      '  "warmupSessions": 7, /* block */',
      '  "read": { "transcripts": "off" }',
      "}",
    ].join("\n");
    fs.writeFileSync(path.join(root, "config.jsonc"), jsonc, "utf8");
    const cfg = loadConfig(root);
    assert.equal(cfg.warmupSessions, 7);
    assert.equal(cfg.read.transcripts, "off");
  } finally {
    rmTemp(root);
  }
});

test("setConfigValue rejects prototype-pollution key segments", () => {
  const root = mkTemp("mm-cfg-");
  try {
    assert.throws(() => setConfigValue(root, "__proto__.polluted", "true"), /Invalid config key segment/);
    assert.equal({}.polluted, undefined);
  } finally {
    rmTemp(root);
  }
});

test("setConfigValue updates a valid nested key", () => {
  const root = mkTemp("mm-cfg-");
  try {
    setConfigValue(root, "warmupSessions", "9");
    assert.equal(loadConfig(root).warmupSessions, 9);
  } finally {
    rmTemp(root);
  }
});
