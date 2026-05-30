import * as fs from "fs";
import * as path from "path";
import type { MistakeEvent } from "./types.js";

const feedbackPath = (pluginRoot: string) => path.join(pluginRoot, "data", "mistake-feedback.jsonl");
const MAX_ENTRIES = 100;

export function recordSuggestionRejected(
  pluginRoot: string,
  targetKind: "agent" | "skill",
  targetId: string,
  mistakeSummary: string
): void {
  const event: MistakeEvent = {
    sessionId: "metamorph",
    timestamp: new Date().toISOString(),
    targetKind,
    targetId,
    toolName: "metamorph",
    kind: "suggestion-rejected",
    mistakeSummary: mistakeSummary.slice(0, 80),
    confidence: "high",
  };

  const p = feedbackPath(pluginRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(event) + "\n", "utf8");
  trimLog(p);
}

function trimLog(logPath: string): void {
  try {
    const lines = fs.readFileSync(logPath, "utf8").split("\n").filter((l) => l.trim());
    if (lines.length <= MAX_ENTRIES) return;
    fs.writeFileSync(logPath, lines.slice(-MAX_ENTRIES).join("\n") + "\n", "utf8");
  } catch {
    // ignore
  }
}

export function readPersistedMistakeEvents(pluginRoot: string): MistakeEvent[] {
  const p = feedbackPath(pluginRoot);
  if (!fs.existsSync(p)) return [];
  const events: MistakeEvent[] = [];
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as MistakeEvent);
    } catch {
      continue;
    }
  }
  return events;
}