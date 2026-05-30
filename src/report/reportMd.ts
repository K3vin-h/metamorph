import * as fs from "fs";
import * as path from "path";
import type { AnalysisResult, AgentProfile } from "../types.js";
import { loadConfig } from "../config.js";

function statusLabel(flags: AgentProfile["flags"]): string {
  if (flags.length === 0) return "ok";
  const f = flags[0];
  switch (f.type) {
    case "never-invoked-agent": return "never invoked";
    case "never-applied-skill": return "never invoked";
    case "rarely-used-agent": return "rarely used";
    case "unused-tool": return f.target ? `unused tool: ${f.target}` : "unused tool";
    case "dead-section": return "dead section";
    case "low-confidence-dead-section": return "possible dead section";
    case "hot-path": return "hot path";
  }
}

function targetTable(title: string, targets: AgentProfile[]): string[] {
  if (targets.length === 0) return [];

  const sorted = [...targets].sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
  const idWidth = Math.max("ID".length, ...sorted.map((t) => t.id.length));
  const lines = [`## ${title}`, "", "```", `${"ID".padEnd(idWidth)}  Score  Status`];

  for (const t of sorted) {
    lines.push(`${t.id.padEnd(idWidth)}  ${String(t.score).padStart(5)}  ${statusLabel(t.flags)}`);
  }

  lines.push("```", "");
  return lines;
}

export function generateReportMd(pluginRoot: string, analysis: AnalysisResult): void {
  const config = loadConfig(pluginRoot);
  const { sessionCount, totals, agents, skills, languages } = analysis;
  const warmupMet = sessionCount >= config.warmupSessions;

  const lines: string[] = [];

  const statusLine = warmupMet
    ? `# metamorph · ready`
    : `# metamorph · ${sessionCount}/${config.warmupSessions} warming up`;
  lines.push(statusLine);
  lines.push(`Sessions: ${totals.sessions} · Tools: ${totals.toolCalls} · Agents: ${totals.agentRuns} · Skills: ${totals.skillLoads} · Privacy: ${analysis.readMode}`);
  lines.push("");

  // Language distribution (single line)
  const langEntries = Object.entries(languages).sort((a, b) => b[1] - a[1]);
  if (langEntries.length > 0) {
    const langStr = langEntries.map(([l, p]) => `${l}:${(p * 100).toFixed(0)}%`).join(", ");
    lines.push(`Languages: ${langStr}`);
    lines.push("");
  }

  lines.push(...targetTable("Agents", agents));
  lines.push(...targetTable("Skills", skills));

  const actionLine = warmupMet
    ? "Run /metamorph for suggestions · Target any: /metamorph --target <id> · View: /metamorph-report"
    : "Suggestions unlock after warm-up · Target any: /metamorph --target <id> · View: /metamorph-report";
  lines.push(actionLine);

  const reportPath = path.join(pluginRoot, "report.md");
  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
}
