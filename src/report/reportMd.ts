import * as fs from "fs";
import * as path from "path";
import type { AnalysisResult, AgentProfile } from "../types.js";
import { loadConfig } from "../config.js";

/** Short flag labels for compact tables (max ~8 chars). */
function shortFlag(flags: AgentProfile["flags"]): string {
  if (flags.length === 0) return "—";
  const f = flags[0];
  switch (f.type) {
    case "never-invoked-agent":
    case "never-applied-skill":
      return "never";
    case "rarely-used-agent":
      return "rare";
    case "hot-path":
      return "hot";
    case "recurring-mistakes":
      return "mistake";
    case "unused-tool":
      return "tool";
    case "dead-section":
      return "dead";
    case "low-confidence-dead-section":
      return "dead?";
    default:
      return "?";
  }
}

function targetTable(title: string, targets: AgentProfile[]): string[] {
  if (targets.length === 0) return [];

  const sorted = [...targets].sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
  const idW = Math.min(26, Math.max(14, ...sorted.map((t) => t.id.length)));

  const lines = [
    `## ${title} (${sorted.length})`,
    "",
    "```",
    `${"id".padEnd(idW)}  sc  flag`,
  ];

  for (const t of sorted) {
    lines.push(`${t.id.padEnd(idW)}  ${String(t.score).padStart(2)}  ${shortFlag(t.flags)}`);
  }

  lines.push("```", "");
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

  lines.push("", "_sc = score 0–100 · flag: — ok · never · rare · hot · tool · dead · mistake_", "");

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
