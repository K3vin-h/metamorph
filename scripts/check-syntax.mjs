#!/usr/bin/env node
// Lint: parse-check every shipped JS file with `node --check`.
// No TypeScript source is shipped on this branch, so this is the syntax gate for dist/ + tests/.
import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIRS = ["dist", "tests"];

function collect(dir, acc) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, acc);
    else if (entry.endsWith(".js") || entry.endsWith(".mjs") || entry.endsWith(".cjs")) acc.push(full);
  }
  return acc;
}

const files = DIRS.flatMap((d) => collect(join(ROOT, d), []));
const failures = [];
for (const file of files) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (err) {
    failures.push(`${file}\n${err.stderr?.toString() ?? err.message}`);
  }
}

if (failures.length > 0) {
  console.error(`Syntax check failed for ${failures.length} file(s):\n\n${failures.join("\n\n")}`);
  process.exit(1);
}
console.log(`Syntax OK: ${files.length} file(s) checked.`);
