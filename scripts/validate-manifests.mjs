#!/usr/bin/env node
// Validate ("typecheck" slot): assert every JSON manifest and the JSONC config parse cleanly.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const JSON_FILES = [
  "package.json",
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  ".codex-plugin/plugin.json",
  ".cursor-plugin/plugin.json",
  "hooks/hooks.json",
  "hooks/cursor-hooks.json",
];

// Mirror of dist/config.js#stripJsoncComments — keep config.jsonc validatable without importing internals.
function stripJsoncComments(text) {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; ) {
    const c = text[i];
    if (inString) {
      if (c === "\\" && i + 1 < text.length) { out += c + text[i + 1]; i += 2; continue; }
      if (c === '"') inString = false;
      out += c; i++; continue;
    }
    if (c === '"') { inString = true; out += c; i++; continue; }
    if (c === "/" && text[i + 1] === "/") { while (i < text.length && text[i] !== "\n") i++; continue; }
    if (c === "/" && text[i + 1] === "*") { i += 2; while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++; i += 2; continue; }
    out += c; i++;
  }
  return out;
}

const errors = [];
for (const rel of JSON_FILES) {
  try {
    JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
  } catch (err) {
    errors.push(`${rel}: ${err.message}`);
  }
}
try {
  JSON.parse(stripJsoncComments(readFileSync(join(ROOT, "config.jsonc"), "utf8")));
} catch (err) {
  errors.push(`config.jsonc: ${err.message}`);
}

if (errors.length > 0) {
  console.error(`Manifest validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  process.exit(1);
}
console.log(`Manifests OK: ${JSON_FILES.length + 1} file(s) parsed.`);
