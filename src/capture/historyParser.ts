import * as fs from "fs";
import * as path from "path";
import { checkReadPermission } from "../permissions.js";

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

export function parseHistory(
  claudeRoot: string,
  denyGlobs: string[]
): HistorySummary {
  const summary: HistorySummary = {
    skillLoads: {},
    skillApplied: {},
    fileExtensions: {},
  };

  // Parse history.jsonl
  const historyPath = path.join(claudeRoot, "history.jsonl");
  if (fs.existsSync(historyPath)) {
    const lines = fs.readFileSync(historyPath, "utf8").split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry: HistoryEntry = JSON.parse(line);
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

  // Parse file-history/ for language distribution
  const fileHistoryDir = path.join(claudeRoot, "file-history");
  if (fs.existsSync(fileHistoryDir)) {
    const entries = fs.readdirSync(fileHistoryDir);
    for (const entry of entries) {
      const fullPath = path.join(fileHistoryDir, entry);
      if (!checkReadPermission(fullPath, denyGlobs, claudeRoot)) continue;
      const ext = path.extname(entry).toLowerCase();
      if (ext) {
        summary.fileExtensions[ext] = (summary.fileExtensions[ext] ?? 0) + 1;
      }
    }
  }

  return summary;
}
