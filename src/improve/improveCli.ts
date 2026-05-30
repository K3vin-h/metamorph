import type { AnalysisResult } from "../types.js";
import { loadConfig } from "../config.js";
import { shortFlag } from "./flagsShort.js";
import { formatAsciiTargetTable } from "../report/targetTable.js";

export function printImproveStats(pluginRoot: string, analysis: AnalysisResult): void {
  const config = loadConfig(pluginRoot);
  const { sessionCount, totals } = analysis;
  const warmupMet = sessionCount >= config.warmupSessions;
  const warmup = warmupMet
    ? `${sessionCount}/${config.warmupSessions} ✓`
    : `${sessionCount}/${config.warmupSessions}`;

  console.log(`metamorph · ${sessionCount} sessions analyzed`);
  console.log(
    `Tools: ${totals.toolCalls} · Agents: ${totals.agentRuns} runs · Skills: ${totals.skillLoads} loads`
  );
  console.log(`Warm-up: ${warmup}`);
  if (analysis.generatedAt) {
    console.log(`Last analysis: ${analysis.generatedAt}`);
  }
}

export function printImproveTargets(pluginRoot: string, analysis: AnalysisResult): void {
  const config = loadConfig(pluginRoot);
  for (const line of formatAsciiTargetTable("Agents", analysis.agents)) {
    console.log(line);
  }
  for (const line of formatAsciiTargetTable("Skills", analysis.skills)) {
    console.log(line);
  }
  console.log(`Max per run: ${config.maxSuggestionsPerRun} (lowest scores kept if you pick more)`);
}

export function printImproveStatus(pluginRoot: string, analysis: AnalysisResult): void {
  const top = [...analysis.agents, ...analysis.skills]
    .filter((t) => t.flags.length > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  printImproveStats(pluginRoot, analysis);
  if (top.length > 0) {
    console.log("Top flags:");
    for (const t of top) {
      console.log(`  ${t.id} ${t.score}/100 ${shortFlag(t.flags)}`);
    }
  }
}
