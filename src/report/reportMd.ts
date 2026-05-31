import * as fs from "fs";
import * as path from "path";
import type { AnalysisResult } from "../types.js";
import { loadConfig } from "../config.js";
import { formatAsciiTargetTable } from "./targetTable.js";

/** Regenerate report.md from data/analysis.json (updates format after plugin upgrades). */
export function refreshReportFromDisk(pluginRoot: string): boolean {
  const analysisPath = path.join(pluginRoot, "data", "analysis.json");
  if (!fs.existsSync(analysisPath)) return false;
  try {
    const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8")) as AnalysisResult;
    if (typeof analysis.sessionCount !== "number" || !Array.isArray(analysis.agents)) {
      return false;
    }
    generateReportMd(pluginRoot, analysis);
    return true;
  } catch {
    return false;
  }
}

export function generateReportMd(pluginRoot: string, analysis: AnalysisResult): void {
  const config = loadConfig(pluginRoot);
  const { sessionCount, totals, agents, skills, languages } = analysis;
  const warmupMet = sessionCount >= config.warmupSessions;

  const lines: string[] = [];

  lines.push(
    warmupMet
      ? `# metamorph · ready`
      : `# metamorph · warm-up ${sessionCount}/${config.warmupSessions}`
  );
  lines.push(
    `${totals.sessions} sessions · ${totals.toolCalls} tools · ${totals.agentRuns} agent runs · ${totals.skillLoads} skill loads · ${analysis.readMode}`
  );

  const langEntries = Object.entries(languages)
    .filter(([l]) => l.length <= 12 && !l.includes("\n"))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (langEntries.length > 0) {
    lines.push(langEntries.map(([l, p]) => `${l} ${(p * 100).toFixed(0)}%`).join(" · "));
  }

  lines.push(
    "",
    "_Score: 0–30 needs attention · 31–70 moderate · 71–100 healthy_",
    "_Flags: never=not used · rare=low usage · hot=high demand · tool=unused declared tool · dead=inactive section · mistake=recurring correction patterns_",
    ""
  );

  lines.push(...formatAsciiTargetTable("Agents", agents));
  lines.push(...formatAsciiTargetTable("Skills", skills));

  const remaining = config.warmupSessions - sessionCount;
  lines.push(
    warmupMet
      ? "/metamorph to improve · /metamorph --target <id> for one target · /metamorph-report to refresh"
      : `Warming up — ${remaining} more session${remaining === 1 ? "" : "s"} until improvement suggestions unlock · /metamorph-report to view`
  );

  const reportPath = path.join(pluginRoot, "report.md");
  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
}
