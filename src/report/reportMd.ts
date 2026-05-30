import * as fs from "fs";
import * as path from "path";
import type { AnalysisResult } from "../types.js";
import { loadConfig } from "../config.js";
import { formatAsciiTargetTable } from "./targetTable.js";

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

  lines.push("", "_flag: — ok · never · rare · hot · tool · dead · mistake_", "");

  lines.push(...formatAsciiTargetTable("Agents", agents));
  lines.push(...formatAsciiTargetTable("Skills", skills));

  lines.push(
    warmupMet
      ? "/metamorph · /metamorph --target <id> · /metamorph-report"
      : "Warm-up — /metamorph-report to view · suggestions after warm-up"
  );

  const reportPath = path.join(pluginRoot, "report.md");
  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
}
