import type { AnalysisResult } from "../types.js";
import { loadConfig } from "../config.js";
import { displayFlag, shortFlag } from "./flagsShort.js";

function targetTableMarkdown(title: string, targets: AnalysisResult["agents"]): string {
  if (targets.length === 0) return "";
  const sorted = [...targets].sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
  const lines = [`## ${title} (${sorted.length})`, "", "| id | score | flag |", "| --- | ---: | :--- |"];
  for (const t of sorted) {
    lines.push(`| ${t.id} | ${t.score}/100 | ${displayFlag(t.flags)} |`);
  }
  lines.push("");
  return lines.join("\n");
}

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
  console.log(targetTableMarkdown("Agents", analysis.agents));
  console.log(targetTableMarkdown("Skills", analysis.skills));
  console.log(`Max per run: ${config.maxSuggestionsPerRun} (lowest scores kept if you pick more)`);
}

export function printImproveStatus(pluginRoot: string, analysis: AnalysisResult): void {
  const config = loadConfig(pluginRoot);
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
