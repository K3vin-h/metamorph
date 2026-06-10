"use strict";
// Shared helpers for the metamorph test suite.
// Not a test file (no "test" token in the name) so the node:test runner ignores it.
const fs = require("fs");
const os = require("os");
const path = require("path");

// On macOS os.tmpdir() (/var/folders/...) is a symlink to /private/var/folders/....
// metamorph's write-permission check compares a realpath-resolved target against a
// non-resolved project path, so scratch dirs MUST be canonical or writes get rejected.
const REAL_TMP_BASE = fs.realpathSync(os.tmpdir());

function mkTemp(prefix) {
  return fs.mkdtempSync(path.join(REAL_TMP_BASE, prefix));
}

function rmTemp(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

// Creates a temp project containing .claude/CLAUDE.md, points CLAUDE_PROJECT_DIR at it,
// and returns the canonical target path plus a restore() that unwinds env + temp dirs.
function setupProjectClaudeMd(content) {
  const projectRoot = mkTemp("mm-proj-");
  const claudeDir = path.join(projectRoot, ".claude");
  fs.mkdirSync(claudeDir, { recursive: true });
  const target = path.join(claudeDir, "CLAUDE.md");
  if (content !== undefined) fs.writeFileSync(target, content, "utf8");
  const prevEnv = process.env.CLAUDE_PROJECT_DIR;
  process.env.CLAUDE_PROJECT_DIR = projectRoot;
  return {
    projectRoot,
    target,
    relPath: path.join(".claude", "CLAUDE.md"),
    restore() {
      if (prevEnv === undefined) delete process.env.CLAUDE_PROJECT_DIR;
      else process.env.CLAUDE_PROJECT_DIR = prevEnv;
      rmTemp(projectRoot);
    },
  };
}

module.exports = { REAL_TMP_BASE, mkTemp, rmTemp, setupProjectClaudeMd };
