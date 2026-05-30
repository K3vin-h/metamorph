"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionEnd = sessionEnd;
const path = __importStar(require("path"));
async function sessionEnd(pluginRoot, claudeRoot) {
    const sessionId = process.env.CLAUDE_SESSION_ID ?? `session-${Date.now()}`;
    // Incremental cache: parse only new sessions
    const { updateCache } = await Promise.resolve().then(() => __importStar(require("../capture/incrementalCache")));
    await updateCache(pluginRoot, claudeRoot, sessionId);
    // Session counter: idempotent increment
    const { increment } = await Promise.resolve().then(() => __importStar(require("../capture/sessionCounter")));
    const count = increment(pluginRoot, sessionId);
    // Aggregate + score
    const { runAnalysis } = await Promise.resolve().then(() => __importStar(require("../analyze/analyzer")));
    const analysis = await runAnalysis(pluginRoot, claudeRoot);
    // Style profile
    const { deriveStyleProfile } = await Promise.resolve().then(() => __importStar(require("../style")));
    await deriveStyleProfile(pluginRoot, claudeRoot, analysis);
    // Reports
    const { generateReportMd } = await Promise.resolve().then(() => __importStar(require("../report/reportMd")));
    const { generateReportHtml } = await Promise.resolve().then(() => __importStar(require("../report/reportHtml")));
    generateReportMd(pluginRoot, analysis);
    generateReportHtml(pluginRoot, analysis);
    // Digest to stdout
    const config = (await Promise.resolve().then(() => __importStar(require("../config")))).loadConfig(pluginRoot);
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
//# sourceMappingURL=sessionEnd.js.map