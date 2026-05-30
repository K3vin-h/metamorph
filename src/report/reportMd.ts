import * as fs from "fs";
import * as path from "path";
import type { AnalysisResult, AgentProfile } from "../types.js";
import { loadConfig } from "../config.js";

function scoreBar(score: number): string {
  const filled = Math.round(score / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled) + ` ${score}`;
}

function topFlag(target: AgentProfile): string {
  if (target.flags.length === 0) return "—";
  const f = target.flags[0];
  return `${f.type}${f.target ? ` (${f.target})` : ""}${f.section ? ` "${f.section}"` : ""} [${f.confidence}]`;
}

export function generateReportMd(pluginRoot: string, analysis: AnalysisResult): void {
  const config = loadConfig(pluginRoot);
  const { sessionCount, totals, agents, skills, languages, feedback } = analysis;
  const warmupMet = sessionCount >= config.warmupSessions;

  const lines: string[] = [];

  lines.push("# metamorph — Habits Dashboard");
  lines.push(`_Generated: ${new Date(analysis.generatedAt).toLocaleString()}_`);
  lines.push("");

  // Warm-up banner
  if (!warmupMet) {
    lines.push(`> **Warming up: ${sessionCount}/${config.warmupSessions} sessions**`);
    lines.push("> Collecting data — improvement suggestions unlock after warm-up.");
    lines.push("");
  }

  // Summary stats
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Sessions analyzed | ${totals.sessions} |`);
  lines.push(`| Tool calls | ${totals.toolCalls} |`);
  lines.push(`| Agent runs | ${totals.agentRuns} |`);
  lines.push(`| Skill loads | ${totals.skillLoads} |`);
  lines.push(`| Privacy mode | ${analysis.readMode} |`);
  lines.push("");

  // Language distribution
  if (Object.keys(languages).length > 0) {
    lines.push("## Language Distribution");
    lines.push("");
    const sorted = Object.entries(languages).sort((a, b) => b[1] - a[1]);
    for (const [lang, pct] of sorted) {
      lines.push(`- \`${lang}\`: ${(pct * 100).toFixed(0)}%`);
    }
    lines.push("");
  }

  // Agents table
  if (agents.length > 0) {
    lines.push("## Agents");
    lines.push("");
    lines.push(`| Agent | Score | Invocations | Top Flag |`);
    lines.push(`|-------|-------|-------------|----------|`);
    for (const a of agents.sort((x, y) => x.score - y.score)) {
      lines.push(`| \`${a.id}\` | ${scoreBar(a.score)} | ${a.invocations} | ${topFlag(a)} |`);
    }
    lines.push("");
  }

  // Skills table
  if (skills.length > 0) {
    lines.push("## Skills");
    lines.push("");
    lines.push(`| Skill | Score | Loads | Top Flag |`);
    lines.push(`|-------|-------|-------|----------|`);
    for (const s of skills.sort((x, y) => x.score - y.score)) {
      lines.push(`| \`${s.id}\` | ${scoreBar(s.score)} | ${s.invocations} | ${topFlag(s)} |`);
    }
    lines.push("");
  }

  // Flagged targets detail
  const flagged = [...agents, ...skills].filter((t) => t.flags.some((f) => f.confidence === "high" || t.score < config.flagThreshold));
  if (flagged.length > 0) {
    lines.push("## Flagged Targets");
    lines.push("");
    for (const t of flagged.sort((a, b) => a.score - b.score)) {
      lines.push(`### \`${t.id}\` (score: ${t.score})`);
      for (const f of t.flags) {
        lines.push(`- **${f.type}**${f.target ? ` — \`${f.target}\`` : ""}${f.section ? ` — "${f.section}"` : ""} [${f.confidence} confidence]`);
      }
      if (warmupMet) {
        lines.push(`  → \`/metamorph --target ${t.id}\``);
      }
      lines.push("");
    }
  }

  // Feedback
  if (feedback.length > 0) {
    lines.push("## Feedback");
    lines.push("");
    for (const entry of feedback) {
      lines.push(`- ${entry}`);
    }
    lines.push("");
  }

  if (warmupMet) {
    lines.push("---");
    lines.push("Run `/metamorph` to see improvement suggestions.");
  }

  const reportPath = path.join(pluginRoot, "report.md");
  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
}
