import * as fs from "fs";
import * as path from "path";
import type { AnalysisResult } from "../types.js";
import { loadConfig } from "../config.js";

export async function sessionStart(pluginRoot: string, _claudeRoot: string): Promise<void> {
  const analysisPath = path.join(pluginRoot, "data", "analysis.json");

  if (!fs.existsSync(analysisPath)) {
    console.log("metamorph: no data yet — run a session to begin tracking.");
    return;
  }

  let analysis: AnalysisResult;
  try {
    analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
  } catch {
    console.log("metamorph: could not read analysis data.");
    return;
  }

  const config = loadConfig(pluginRoot);
  const { sessionCount, totals, agents, skills } = analysis;
  const warmupMet = sessionCount >= config.warmupSessions;

  const topFlags = [...agents, ...skills]
    .filter((t) => t.flags.length > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  const lines: string[] = ["─".repeat(50), "metamorph"];

  if (!warmupMet) {
    lines.push(`  warming up: ${sessionCount}/${config.warmupSessions} sessions`);
  } else {
    lines.push(`  sessions: ${sessionCount} | agents: ${totals.agentRuns} runs | skills: ${totals.skillLoads} loads`);
  }

  if (topFlags.length > 0) {
    lines.push("  top flags:");
    for (const t of topFlags) {
      const flag = t.flags[0];
      lines.push(`    ${t.id} (score ${t.score}) — ${flag.type} [${flag.confidence}]`);
    }
  }

  lines.push(`  dashboard: ${path.join(pluginRoot, "report.html")}`);
  lines.push("─".repeat(50));

  console.log(lines.join("\n"));
}
