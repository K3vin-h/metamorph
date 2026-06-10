"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { matchGlob, checkReadPermission } = require("../dist/permissions.js");

const CLAUDE_ROOT = path.join(path.sep, "home", "u", ".claude");
const DENY = ["projects/**/secrets*", "**/*.env*", "**/.env", "**/credentials*"];

function underRoot(...parts) {
  return path.join(CLAUDE_ROOT, ...parts);
}

test("matchGlob handles **/, ** and * segments", () => {
  assert.ok(matchGlob("**/*.env*", "projects/foo/.env"));
  assert.ok(matchGlob("**/*.env*", "a/b/c/config.env.local"));
  assert.ok(matchGlob("agents/*", "agents/foo.md"));
  assert.ok(!matchGlob("agents/*", "agents/nested/foo.md"));
});

test("matchGlob rejects path traversal and absolute paths", () => {
  assert.ok(!matchGlob("**", "../escape"));
  assert.ok(!matchGlob("**", path.join(path.sep, "etc", "passwd")));
});

test("checkReadPermission denies files matching deny globs", () => {
  assert.ok(!checkReadPermission(underRoot("projects", "x", "secrets.txt"), DENY, CLAUDE_ROOT));
  assert.ok(!checkReadPermission(underRoot("projects", "x", "deep", ".env"), DENY, CLAUDE_ROOT));
  assert.ok(!checkReadPermission(underRoot("any", "where", "credentials.json"), DENY, CLAUDE_ROOT));
});

test("checkReadPermission allows ordinary agent and skill files", () => {
  assert.ok(checkReadPermission(underRoot("agents", "architect.md"), DENY, CLAUDE_ROOT));
  assert.ok(checkReadPermission(underRoot("skills", "tdd", "SKILL.md"), DENY, CLAUDE_ROOT));
});

test("checkReadPermission denies paths that escape the claude root", () => {
  assert.ok(!checkReadPermission(path.join(path.sep, "etc", "passwd"), DENY, CLAUDE_ROOT));
});
