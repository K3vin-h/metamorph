"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { scrubSecrets, confinePath } = require("../dist/security.js");

function redacts(input) {
  return scrubSecrets(input).includes("[REDACTED]");
}

test("scrubSecrets redacts known credential formats", () => {
  // Fixtures are assembled at runtime so secret scanners never see a token-shaped literal.
  // All values are synthetic (AWS one is Amazon's documented example key).
  const FAKE = "AbCdEfGh1234567890";
  const secrets = {
    "anthropic key": ["sk", "ant", "api03", FAKE + "AbCdEfGh"].join("-"),
    "openai project key": ["sk", "proj", FAKE + "AbCd"].join("-"),
    "aws access key": "AKIA" + "IOSFODNN7" + "EXAMPLE",
    "github pat": "ghp" + "_" + FAKE + FAKE,
    "slack token": ["xoxb", "123456789012", "abcdefghij"].join("-"),
    "google api key": "AIza" + "SyA1234567890abcdefghijklmnopqrstuv",
    "jwt": ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxMjM0NTY3ODkwIn0", "dQw4w9WgXcQdQw4w9WgXcQ"].join("."),
    "env assignment": "DATABASE_URL=postgres://user:pass@host/db",
    "bearer header": "Authorization: Bearer abc123def456ghi789",
    "pem block": ["-----BEGIN RSA PRIVATE KEY-----", "MIIEow", "-----END RSA PRIVATE KEY-----"].join("\n"),
  };
  for (const [label, value] of Object.entries(secrets)) {
    assert.ok(redacts(value), `should redact ${label}: ${value}`);
  }
});

test("scrubSecrets leaves ordinary text and code untouched", () => {
  const benign = [
    "const x = a.b.c;",
    "see docs at example.com/path.md for info",
    "version 1.2.3 released",
    "the quick brown fox jumps over the lazy dog",
    "import { useState } from 'react'",
  ];
  for (const text of benign) {
    assert.equal(scrubSecrets(text), text, `should not alter: ${text}`);
  }
});

test("confinePath rejects path traversal and out-of-root paths", () => {
  assert.equal(confinePath("/tmp/../etc/passwd", ["/tmp"]), null);
  assert.equal(confinePath("/etc/passwd", [path.join(__dirname, "..")]), null);
});

test("confinePath accepts a real path inside an allowed root", () => {
  const root = path.join(__dirname, "..");
  const target = path.join(root, "package.json");
  const confined = confinePath(target, [root]);
  assert.ok(confined !== null);
  assert.ok(confined.endsWith("package.json"));
});
