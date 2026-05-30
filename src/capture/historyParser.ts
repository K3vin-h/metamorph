import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";
import { checkReadPermission } from "../permissions.js";
import { logHookError } from "../hookErrors.js";

interface HistoryEntry {
  skillId?: string;
  agentId?: string;
  filePath?: string;
  timestamp?: string;
  type?: string;
}

export interface HistorySummary {
  skillLoads: Record<string, number>;
  skillApplied: Record<string, number>;
  fileExtensions: Record<string, number>;
}

const MAX_HISTORY_LINES = 10000;

async function parseHistoryJsonl(
  historyPath: string,
  summary: HistorySummary
): Promise<void> {
  const stream = fs.createReadStream(historyPath, "utf8");
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const tail: string[] = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    tail.push(line);
    if (tail.length > MAX_HISTORY_LINES) tail.shift();
  }

  for (const entryLine of tail) {
    try {
      const entry: HistoryEntry = JSON.parse(entryLine);
      if (entry.skillId) {
        summary.skillLoads[entry.skillId] = (summary.skillLoads[entry.skillId] ?? 0) + 1;
        if (entry.type === "apply") {
          summary.skillApplied[entry.skillId] = (summary.skillApplied[entry.skillId] ?? 0) + 1;
        }
      }
    } catch {
      // skip malformed lines
    }
  }
}

export async function parseHistory(
  claudeRoot: string,
  denyGlobs: string[]
): Promise<HistorySummary> {
  const summary: HistorySummary = {
    skillLoads: {},
    skillApplied: {},
    fileExtensions: {},
  };

  const historyPath = path.join(claudeRoot, "history.jsonl");
  if (fs.existsSync(historyPath)) {
    try {
      await parseHistoryJsonl(historyPath, summary);
    } catch (err) {
      logHookError(claudeRoot, "parse-history-jsonl", err);
    }
  }

  const fileHistoryDir = path.join(claudeRoot, "file-history");
  if (fs.existsSync(fileHistoryDir)) {
    try {
      const entries = fs.readdirSync(fileHistoryDir);
      for (const entry of entries) {
        const fullPath = path.join(fileHistoryDir, entry);
        if (!checkReadPermission(fullPath, denyGlobs, claudeRoot)) continue;
        const ext = path.extname(entry).toLowerCase();
        if (ext) {
          summary.fileExtensions[ext] = (summary.fileExtensions[ext] ?? 0) + 1;
        }
      }
    } catch (err) {
      logHookError(claudeRoot, "parse-file-history", err);
    }
  }

  return summary;
}
