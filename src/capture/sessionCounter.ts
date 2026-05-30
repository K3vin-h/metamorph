import * as fs from "fs";
import * as path from "path";
import type { SessionCounter } from "../types.js";

const counterPath = (pluginRoot: string) =>
  path.join(pluginRoot, "data", "session-counter.json");

function read(pluginRoot: string): SessionCounter {
  const p = counterPath(pluginRoot);
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return { count: 0, seenIds: [] };
  }
}

function write(pluginRoot: string, counter: SessionCounter): void {
  const p = counterPath(pluginRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(counter, null, 2), "utf8");
  fs.renameSync(tmp, p);
}

const MAX_SEEN_IDS = 2000;

// Idempotent: returns current count (increments only if sessionId not already seen)
export function increment(pluginRoot: string, sessionId: string): number {
  const counter = read(pluginRoot);
  const seenSet = new Set(counter.seenIds);
  if (!seenSet.has(sessionId)) {
    seenSet.add(sessionId);
    counter.seenIds = [...seenSet];
    if (counter.seenIds.length > MAX_SEEN_IDS) {
      counter.seenIds = counter.seenIds.slice(-MAX_SEEN_IDS);
    }
    counter.count++;
    write(pluginRoot, counter);
  }
  return counter.count;
}

export function getCount(pluginRoot: string): number {
  return read(pluginRoot).count;
}
