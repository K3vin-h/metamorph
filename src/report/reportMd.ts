import * as fs from "fs";
import * as path from "path";
import type { AnalysisResult, AgentProfile } from "../types.js";
import { loadConfig } from "../config.js";
import { displayFlag } from "../improve/flagsShort.js";

const SCORE_MAX = 100;

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function targetTable(title: string, targets: AgentProfile[]): string[] {
  if (targets.length === 0) return [];

  const sorted = [...targets].sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));

  const lines = [
    `## ${title} (${sorted.length})`,
    "",
    "| id | score | flag |",
    "| --- | ---: | :--- |",
  ];

  for (const t of sorted) {
    lines.push(
      `| ${escapeCell(t.id)} | ${t.score}/${SCORE_MAX} | ${escapeCell(displayFlag(t.flags))} |`
    );
  }

  lines.push("");
  return lines;
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

  const langEntries = Object.entries(languages).sort((a, b) => b[1] - a[1]);
  if (langEntries.length > 0) {
    lines.push(langEntries.map(([l, p]) => `${l} ${(p * 100).toFixed(0)}%`).join(" · "));
  }

  lines.push("", "_flag: — ok · never · rare · hot · tool · dead · mistake_", "");

  lines.push(...targetTable("Agents", agents));
  lines.push(...targetTable("Skills", skills));

  lines.push(
    warmupMet
      ? "/metamorph · /metamorph --target <id> · /metamorph-report"
      : "Warm-up — /metamorph-report to view · suggestions after warm-up"
  );

  const reportPath = path.join(pluginRoot, "report.md");
  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
}
