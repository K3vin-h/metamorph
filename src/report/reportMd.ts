import * as fs from "fs";
import * as path from "path";
import type { AnalysisResult, AgentProfile } from "../types.js";
import { loadConfig } from "../config.js";

function shortFlagLabel(flags: AgentProfile["flags"]): string {
  if (flags.length === 0) return "ok";
  const f = flags[0];
  switch (f.type) {
    case "never-invoked-agent": return "never-invoked";
    case "rarely-used-agent": return "rarely-used";
    case "hot-path": return "hot-path";
    case "dead-section": return "dead-section";
    case "low-confidence-dead-section": return "low-confidence-dead-section";
    case "unused-tool": return `unused-tool:${f.target ?? ""}`;
    case "never-applied-skill": return "never-applied";
    default: return f.type;
  }
}

function groupByFlag(targets: AgentProfile[]): Map<string, { ids: string[]; scores: number[] }> {
  const groups = new Map<string, { ids: string[]; scores: number[] }>();
  for (const t of targets) {
    const label = shortFlagLabel(t.flags);
    if (!groups.has(label)) groups.set(label, { ids: [], scores: [] });
    const g = groups.get(label)!;
    g.ids.push(t.id);
    g.scores.push(t.score);
  }
  return groups;
}

function median(scores: number[]): number {
  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
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

  // Agents grouped by flag
  if (agents.length > 0) {
    lines.push("## Agents");
    const groups = groupByFlag(agents.sort((a, b) => a.score - b.score));
    for (const [label, { ids, scores }] of groups) {
      lines.push(`${label} (${median(scores)}): ${ids.join(", ")}`);
    }
    lines.push("");
  }

  // Skills grouped by flag
  if (skills.length > 0) {
    lines.push("## Skills");
    const groups = groupByFlag(skills.sort((a, b) => a.score - b.score));
    for (const [label, { ids, scores }] of groups) {
      lines.push(`${label} (${median(scores)}): ${ids.join(", ")}`);
    }
    lines.push("");
  }

  const actionLine = warmupMet
    ? "Run /metamorph for suggestions · Target any: /metamorph --target <id> · View: /metamorph-report"
    : "Suggestions unlock after warm-up · Target any: /metamorph --target <id> · View: /metamorph-report";
  lines.push(actionLine);

  const reportPath = path.join(pluginRoot, "report.md");
  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
}
