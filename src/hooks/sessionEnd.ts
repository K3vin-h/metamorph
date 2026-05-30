import * as path from "path";

export async function sessionEnd(pluginRoot: string, claudeRoot: string): Promise<void> {
  const sessionId = process.env.CLAUDE_SESSION_ID ?? `session-${Date.now()}`;

  // Incremental cache: parse only new sessions
  const { updateCache } = await import("../capture/incrementalCache");
  await updateCache(pluginRoot, claudeRoot, sessionId);

  // Session counter: idempotent increment
  const { increment } = await import("../capture/sessionCounter");
  const count = increment(pluginRoot, sessionId);

  // Aggregate + score
  const { runAnalysis } = await import("../analyze/analyzer");
  const analysis = await runAnalysis(pluginRoot, claudeRoot);

  // Style profile
  const { deriveStyleProfile } = await import("../style");
  await deriveStyleProfile(pluginRoot, claudeRoot, analysis);

  // Reports
  const { generateReportMd } = await import("../report/reportMd");
  const { generateReportHtml } = await import("../report/reportHtml");
  generateReportMd(pluginRoot, analysis);
  generateReportHtml(pluginRoot, analysis);

  // Digest to stdout
  const config = (await import("../config")).loadConfig(pluginRoot);
  const warmupMet = count >= config.warmupSessions;
  const topFlags = [...analysis.agents, ...analysis.skills]
    .filter((t) => t.flags.length > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  const lines = [
    "─".repeat(50),
    `metamorph — session ${count}${warmupMet ? "" : `/${config.warmupSessions} (warming up)`}`,
    `  analyzed: ${analysis.totals.sessions} sessions, ${analysis.totals.toolCalls} tool calls`,
  ];

  if (topFlags.length > 0) {
    lines.push("  flagged targets:");
    for (const t of topFlags) {
      lines.push(`    ${t.id} score=${t.score} (${t.flags[0].type})`);
    }
  }

  if (warmupMet) {
    lines.push("  run /metamorph to see improvement suggestions");
  }

  lines.push(`  report: ${path.join(pluginRoot, "report.md")}`);
  lines.push("─".repeat(50));

  console.log(lines.join("\n"));
}
