import type { AnalysisResult } from "../types.js";
import { loadConfig } from "../config.js";
import { shortFlag } from "./flagsShort.js";
import { formatAsciiTargetTable } from "../report/targetTable.js";
import {
  countNeverUsed,
  filterActionableTargets,
} from "./actionableTargets.js";

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
  if (analysis.totals.sessionsByTool) {
    const { claudeCode, cursor, codex } = analysis.totals.sessionsByTool;
    const parts: string[] = [];
    if (claudeCode > 0) parts.push(`claude-code: ${claudeCode}`);
    if (cursor > 0) parts.push(`cursor: ${cursor}`);
    if (codex > 0) parts.push(`codex: ${codex}`);
    if (parts.length > 1) console.log(`Sources: ${parts.join(" · ")}`);
  }
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
  console.log("Score: 0–30 needs attention · 31–70 moderate usage · 71–100 healthy");
  console.log("Flags: never=not used · rare=low usage · hot=high demand · tool=unused declared tool · dead=inactive section · mistake=recurring correction patterns");
  console.log(`\nMax per run: ${config.maxSuggestionsPerRun} (lowest scores prioritized)`);
}

export function printImproveTargetsActionable(pluginRoot: string, analysis: AnalysisResult): void {
  const config = loadConfig(pluginRoot);
  const actionableAgents = filterActionableTargets(analysis.agents, config);
  const actionableSkills = filterActionableTargets(analysis.skills, config);
  const neverCount =
    countNeverUsed(analysis.agents) + countNeverUsed(analysis.skills);

  console.log("## Recommended targets (used, score ≥ " + config.improve.minScore + ")\n");

  if (actionableAgents.length === 0 && actionableSkills.length === 0) {
    console.log("No actionable targets yet — use agents/skills in sessions, then re-run session-end.");
  } else {
    for (const line of formatAsciiTargetTable("Agents", actionableAgents)) {
      console.log(line);
    }
    for (const line of formatAsciiTargetTable("Skills", actionableSkills)) {
      console.log(line);
    }
  }

  console.log(`\nNever used: ${neverCount} — consider pruning from ~/.claude/agents/ or ~/.cursor/skills-cursor/`);
  console.log("Efficient: /metamorph --target <id> · /metamorph-report (zero LLM)");
  console.log(`\nMax per run: ${config.maxSuggestionsPerRun} (pick from recommended, or 'top N')`);
}

export function printImproveStatus(pluginRoot: string, analysis: AnalysisResult): void {
  const config = loadConfig(pluginRoot);
  const actionable = [
    ...filterActionableTargets(analysis.agents, config),
    ...filterActionableTargets(analysis.skills, config),
  ].slice(0, 3);

  printImproveStats(pluginRoot, analysis);

  if (actionable.length > 0) {
    console.log("Recommended to improve:");
    for (const t of actionable) {
      console.log(`  ${t.id} ${t.score}/100 ${shortFlag(t.flags)}`);
    }
    console.log(`  → /metamorph --target ${actionable[0].id}`);
  }

  const top = [...analysis.agents, ...analysis.skills]
    .filter((t) => t.flags.length > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  if (top.length > 0) {
    console.log("Top flags (all targets):");
    for (const t of top) {
      console.log(`  ${t.id} ${t.score}/100 ${shortFlag(t.flags)}`);
    }
  }
}
