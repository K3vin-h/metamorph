import * as fs from "fs";
import * as path from "path";
import type { AnalysisResult } from "../types.js";
import { loadConfig } from "../config.js";

function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as AnalysisResult;
  return (
    typeof v.sessionCount === "number" &&
    Array.isArray(v.agents) &&
    Array.isArray(v.skills) &&
    typeof v.totals === "object" &&
    v.totals !== null
  );
}

export async function sessionStart(pluginRoot: string, _claudeRoot: string): Promise<void> {
  const analysisPath = path.join(pluginRoot, "data", "analysis.json");

  if (!fs.existsSync(analysisPath)) {
    console.log("metamorph: no data yet — run a session to begin tracking.");
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
  } catch {
    console.log("metamorph: could not read analysis data.");
    return;
  }

  if (!isAnalysisResult(parsed)) {
    console.log("metamorph: analysis data is invalid or from an older version — run a session to refresh.");
    return;
  }

  const analysis = parsed;

  try {
    const { refreshReportFromDisk } = await import("../report/reportMd.js");
    refreshReportFromDisk(pluginRoot);
  } catch {
    // Non-fatal — session end will retry report generation
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

  lines.push(`  report: ${path.join(pluginRoot, "report.md")}`);
  lines.push("─".repeat(50));

  console.log(lines.join("\n"));
}
