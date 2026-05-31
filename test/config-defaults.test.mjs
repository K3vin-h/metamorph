import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadConfig } from "../dist/config.js";

function withConfig(raw) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "metamorph-config-"));
  fs.writeFileSync(path.join(dir, "config.jsonc"), raw, "utf8");
  try {
    return loadConfig(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("config defaults", () => {
  it("defaults to redacted multi-source tracking and actionable improve filters", () => {
    const cfg = withConfig("{}");

    assert.equal(cfg.read.transcripts, "redacted");
    assert.equal(cfg.read.trackCursor, true);
    assert.equal(cfg.read.trackCodex, true);
    assert.equal(cfg.read.mistakeTracking, true);
    assert.equal(cfg.improve.skipNeverInvoked, true);
    assert.equal(cfg.improve.minScore, 30);
    assert.equal(cfg.improve.minInvocations, 1);
  });

  it("keeps explicit multi-source flags and clamps improve ranges", () => {
    const cfg = withConfig(`{
      "read": {
        "trackCursor": false,
        "trackCodex": true,
        "transcripts": "full"
      },
      "improve": {
        "skipNeverInvoked": false,
        "minScore": 150,
        "minInvocations": -5
      }
    }`);

    assert.equal(cfg.read.trackCursor, false);
    assert.equal(cfg.read.trackCodex, true);
    assert.equal(cfg.read.transcripts, "full");
    assert.equal(cfg.improve.skipNeverInvoked, false);
    assert.equal(cfg.improve.minScore, 100);
    assert.equal(cfg.improve.minInvocations, 0);
  });
});
