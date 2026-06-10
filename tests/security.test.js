"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { scrubSecrets, confinePath } = require("../dist/security.js");

function redacts(input) {
  return scrubSecrets(input).includes("[REDACTED]");
}

test("scrubSecrets redacts known credential formats", () => {
  const secrets = {
    "anthropic key": "sk-ant-api03-AbCdEfGh1234567890AbCdEfGh",
    "openai project key": "sk-proj-AbCdEfGh1234567890AbCd",
    "aws access key": "AKIAIOSFODNN7EXAMPLE",
    "github pat": "ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789",
    "slack token": "xoxb-123456789012-abcdefghij",
    "google api key": "AIzaSyA1234567890abcdefghijklmnopqrstuv",
    "jwt": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dQw4w9WgXcQdQw4w9WgXcQ",
    "env assignment": "DATABASE_URL=postgres://user:pass@host/db",
    "bearer header": "Authorization: Bearer abc123def456ghi789",
    "pem block": "-----BEGIN RSA PRIVATE KEY-----\nMIIEow\n-----END RSA PRIVATE KEY-----",
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
