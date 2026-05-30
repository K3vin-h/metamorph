import * as fs from "fs";
import * as path from "path";
import type { AnalysisResult } from "../types.js";
import { logHookError } from "../hookErrors.js";

async function runStage(
  pluginRoot: string,
  name: string,
  fn: () => Promise<void> | void,
  failures: string[]
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logHookError(pluginRoot, `session-end:${name}`, err);
    failures.push(name);
  }
}

function loadAnalysisFromDisk(pluginRoot: string): AnalysisResult | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(pluginRoot, "data", "analysis.json"), "utf8"));
  } catch {
    return null;
  }
}

export async function sessionEnd(pluginRoot: string, claudeRoot: string): Promise<void> {
  const sessionId = process.env.CLAUDE_SESSION_ID ?? `session-${Date.now()}`;
  const failures: string[] = [];

  await runStage(pluginRoot, "updateCache", async () => {
    const { updateCache } = await import("../capture/incrementalCache.js");
    await updateCache(pluginRoot, claudeRoot, sessionId);
  }, failures);

  let count = 0;
  await runStage(pluginRoot, "increment", async () => {
    const { increment } = await import("../capture/sessionCounter.js");
    count = increment(pluginRoot, sessionId);
  }, failures);

  let analysis: AnalysisResult | null = null;
  await runStage(pluginRoot, "runAnalysis", async () => {
    const { runAnalysis } = await import("../analyze/analyzer.js");
    analysis = await runAnalysis(pluginRoot, claudeRoot);
  }, failures);

  if (!analysis) {
    analysis = loadAnalysisFromDisk(pluginRoot);
  }

  if (analysis) {
    const currentAnalysis = analysis;
    await runStage(pluginRoot, "deriveStyleProfile", async () => {
      const { deriveStyleProfile } = await import("../style.js");
      await deriveStyleProfile(pluginRoot, claudeRoot, currentAnalysis);
    }, failures);

    await runStage(pluginRoot, "generateReportMd", async () => {
      const { generateReportMd } = await import("../report/reportMd.js");
      generateReportMd(pluginRoot, currentAnalysis);
    }, failures);
  }

  const { loadConfig } = await import("../config.js");
  const config = loadConfig(pluginRoot);
  const sessionCount = count || analysis?.sessionCount || 0;
  const warmupMet = sessionCount >= config.warmupSessions;

  const lines = [
    "─".repeat(50),
    `metamorph — session ${sessionCount}${warmupMet ? "" : `/${config.warmupSessions} (warming up)`}`,
  ];

  if (failures.length > 0) {
    lines.push(`  warning: some steps failed (${failures.join(", ")}) — see data/hook-errors.log`);
  }

  if (analysis) {
    lines.push(`  analyzed: ${analysis.totals.sessions} sessions, ${analysis.totals.toolCalls} tool calls`);
    if (analysis.totals.skippedTranscriptLines && analysis.totals.skippedTranscriptLines > 0) {
      lines.push(`  note: ${analysis.totals.skippedTranscriptLines} malformed transcript lines skipped`);
    }

    const topFlags = [...analysis.agents, ...analysis.skills]
      .filter((t) => t.flags.length > 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);

    if (topFlags.length > 0) {
      lines.push("  flagged targets:");
      for (const t of topFlags) {
        lines.push(`    ${t.id} score=${t.score} (${t.flags[0].type})`);
      }
    }
  } else {
    lines.push("  analysis unavailable — check data/hook-errors.log");
  }

  if (warmupMet) {
    lines.push("  run /metamorph to see improvement suggestions");
  }

  lines.push(`  report: ${path.join(pluginRoot, "report.md")}`);
  lines.push("─".repeat(50));

  console.log(lines.join("\n"));
}
