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
  fs.writeFileSync(p, JSON.stringify(counter, null, 2), "utf8");
}

const MAX_SEEN_IDS = 2000;

// Idempotent: returns current count (increments only if sessionId not already seen)
export function increment(pluginRoot: string, sessionId: string): number {
  const counter = read(pluginRoot);
  if (!counter.seenIds.includes(sessionId)) {
    counter.seenIds.push(sessionId);
    counter.count++;
    // Cap seenIds to prevent unbounded growth — older IDs are safe to drop since they
    // are already in the profile cache and cannot be double-counted
    if (counter.seenIds.length > MAX_SEEN_IDS) {
      counter.seenIds = counter.seenIds.slice(-MAX_SEEN_IDS);
    }
    write(pluginRoot, counter);
  }
  return counter.count;
}

export function getCount(pluginRoot: string): number {
  return read(pluginRoot).count;
}
